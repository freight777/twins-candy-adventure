import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toon, mk, rand, pick, clamp, lerp, canvasTex, glowSprite, emojiSprite, candyCaneTex as caneBase, setStyle, RAINBOW } from '../util.js';
import { model } from '../assets.js';
import { N, controlPoints, starGeo, buildTiles, findShortcuts, pickupTiles, pathField, instancer, spotFinder } from '../board/path.js';
const candyCaneTex = (ry = 4) => { const t = caneBase().clone(); t.repeat.set(2, ry); return t; };

const sph = (r, w = 20, h = 14) => new THREE.SphereGeometry(r, w, h);
const cyl = (rt, rb, h, s = 12) => new THREE.CylinderGeometry(rt, rb, h, s);
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// the path climbs gently through the forest: heights for the shared board's control points
const PATH_Y = [0, .5, 1, 2, 3, 3.5, 3, 2, 2.5, 4, 5, 4, 2, 1.5, 2, 3, 4, 5];
export const FRIEND_TILES = [7, 16, 26, 36];          // Sparkle, Rainbow, Cloud, Rain wait beside these squares; twin Uni waits at the castle
const ICE_TILES = [11, 21, 31, 42];

export function buildWorld(scene) {
  setStyle('candy');
  const W = { tiles: [], animated: [], pickups: [], clouds: [], butterflies: [], iceProps: [] };

  // ---------------------------------------------------------------- the path
  const curve = new THREE.CatmullRomCurve3(controlPoints(PATH_Y), false, 'catmullrom', .5);
  W.curve = curve;
  const field = pathField(curve), pathDist = field.dist;           // nearest-path distance from a precomputed grid (path height in field.y)

  const endP = curve.getPointAt(1), endT = curve.getTangentAt(1).setY(0).normalize();
  const castleXZ = { x: endP.x + endT.x * 18, z: endP.z + endT.z * 18 };
  const lake = { x: -2, z: -22, r: 9 };
  const hills = (x, z) => Math.sin(x * .045 + 1.3) * 2.2 + Math.cos(z * .05) * 2 + Math.sin((x + z) * .03) * 3 + Math.sin(x * .11) * Math.cos(z * .09) * 1.2;
  const heightAt = (x, z) => {
    let h = hills(x, z);
    const r = Math.hypot(x + 3, z + 14);
    h += Math.pow(Math.max(0, (r - 62) / 40), 1.7) * 34;                                    // mountains all around
    const d = pathDist(x, z);
    h = lerp(h, field.y - .25, 1 - smoothstep(4, 15, d));
    h = lerp(h, endP.y - .25, 1 - smoothstep(16, 34, Math.hypot(x - castleXZ.x, z - castleXZ.z)));
    const ld = Math.hypot(x - lake.x, z - lake.z);
    h -= Math.exp(-(ld * ld) / (lake.r * lake.r * .55)) * 5.5;
    return h;
  };
  W.heightAt = heightAt; W.lake = lake;

  // ---------------------------------------------------------------- terrain
  {
    const SEG = 190, SIZE = 400, geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG).rotateX(-Math.PI / 2);
    const pos = geo.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color();
    const greens = [0x74e89a, 0x8ff088, 0xc2f46e, 0x6fe0bc, 0xffb8e0, 0xcaa8ff].map((v) => new THREE.Color(v));
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), y = heightAt(x, z); pos.setY(i, y);
      const n = Math.sin(x * .09) * Math.cos(z * .08) + Math.sin(x * .23 + z * .17) * .5;
      c.copy(greens[0]).lerp(greens[1], .5 + n * .5).lerp(greens[2], clamp(n * .6, 0, .6));
      if (Math.sin(x * .05 + 2) * Math.cos(z * .06 - 1) > .55) c.lerp(greens[4], .3);        // pink meadow patches
      if (Math.sin(x * .07 - 1) * Math.cos(z * .05 + 2) > .62) c.lerp(greens[5], .25);          // lilac patches
      const d = pathDist(x, z); c.lerp(new THREE.Color(0xfff0d8), (1 - smoothstep(2.4, 6.5, d)) * .85);
      const r = Math.hypot(x + 3, z + 14); c.lerp(new THREE.Color(0xd9c4ff), smoothstep(70, 130, r) * .8);
      col.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals();
    const noise = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#f0f0f0'; g.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${200 + Math.random() * 55 | 0},255,${200 + Math.random() * 55 | 0},.35)`; g.fillRect(Math.random() * w, Math.random() * h, 3, 3); } }, [90, 90]);
    const t = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, map: noise, roughness: .9 }));
    t.receiveShadow = true; scene.add(t);
  }

  // ---------------------------------------------------------------- sky, sun, far mountains
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { time: { value: 0 } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `varying vec3 vP; uniform float time;
      float hash(vec3 p){ p = fract(p*.3183099+.1); p *= 17.; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
      void main(){
        vec3 d = normalize(vP); float h = d.y;
        vec3 top = vec3(.40,.52,1.), mid = vec3(.80,.72,1.), hor = vec3(1.,.82,.92), low = vec3(1.,.92,.80);
        vec3 c = h > 0. ? mix(hor, mix(mid, top, smoothstep(.15,.8,h)), smoothstep(0.,.35,h)) : mix(hor, low, smoothstep(0.,-.4,h));
        vec3 sunD = normalize(vec3(.3,.34,-.9)); float s = max(dot(d, sunD), 0.);
        c += vec3(1.,.9,.6) * (pow(s, 8.)*.5 + pow(s, 200.)*3.);
        // a big rainbow arching up from beyond the castle
        vec3 rc = normalize(vec3(-.05,-.22,-1.)); float ang = acos(clamp(dot(d, rc), -1., 1.));
        float rb = (ang - .78) / .2;
        if (rb > 0. && rb < 1. && h > -.02) {
          vec3 bandc = rb < .17 ? vec3(1.,.3,.35) : rb < .34 ? vec3(1.,.65,.25) : rb < .5 ? vec3(1.,.95,.35) : rb < .67 ? vec3(.4,.9,.5) : rb < .84 ? vec3(.35,.7,1.) : vec3(.7,.5,1.);
          c = mix(c, bandc, .62 * smoothstep(0.,.05,rb) * smoothstep(1.,.95,rb) * smoothstep(-.02,.15,h));
        }
        // twinkly stars high up
        if (h > .45) { float st = step(.9975, hash(floor(d*220.))); c += vec3(1.,.95,.8) * st * (.5+.5*sin(time*3.+hash(floor(d*220.))*40.)) * smoothstep(.45,.8,h); }
        gl_FragColor = vec4(c, 1.);
      }`,
  }));
  scene.add(sky); W.sky = sky;
  const sunSpr = glowSprite(0xfff0c0, 150, .9); sunSpr.position.set(.3 * 800, .34 * 800, -.9 * 800); sunSpr.material.fog = false; scene.add(sunSpr);

  // ice-cream mountains far away
  [[-170, -170, 70, 0xffb3d9], [-90, -230, 90, 0xb9f0e0], [20, -250, 100, 0xffd9a8], [130, -210, 80, 0xd4bcff], [200, -110, 70, 0xffb3d9], [-210, -60, 80, 0xb9e4ff], [-200, 70, 60, 0xffe9a8], [200, 40, 70, 0xb9f0e0], [-120, 160, 70, 0xffb3d9], [130, 170, 80, 0xd4bcff]]
    .forEach(([x, z, r, c]) => {
      const m = mk(new THREE.ConeGeometry(r, r * 1.5, 24), c, [x, r * .55, z]); m.add(mk(new THREE.ConeGeometry(r * .36, r * .55, 24), 0xffffff, [0, r * .6, 0])); scene.add(m);
    });

  // ---------------------------------------------------------------- the squares
  W.tiles = buildTiles(scene, curve, { base: 0xfff6fb, lift: .12, glow: [5.5, .13] });

  // ---------------------------------------------------------------- shortcut rainbows (found where the path bends back on itself)
  W.shortcuts = findShortcuts(W.tiles, [...FRIEND_TILES, ...ICE_TILES]);
  W.shortcuts.forEach((s) => {
    const a = W.tiles[s.from].pos.clone().add(new THREE.Vector3(0, .3, 0)), b = W.tiles[s.to].pos.clone().add(new THREE.Vector3(0, .3, 0));
    const dir = b.clone().sub(a).setY(0).normalize(), side = new THREE.Vector3(dir.z, 0, -dir.x), apex = 10 + a.distanceTo(b) * .2;
    const ctrl = a.clone().lerp(b, .5); ctrl.y += apex * 2;
    const arcOf = (off) => new THREE.QuadraticBezierCurve3(a.clone().addScaledVector(side, off), ctrl.clone().addScaledVector(side, off), b.clone().addScaledVector(side, off));
    s.arc = arcOf(0);
    RAINBOW.forEach((c, k) => {
      const t = new THREE.Mesh(new THREE.TubeGeometry(arcOf((k - 2.5) * .58), 56, .3, 8), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: .55, roughness: .4 }));
      t.userData.noShadow = true; scene.add(t);
    });
    const e = emojiSprite('🌈', 3.4); e.position.copy(a).add(new THREE.Vector3(0, 4.2, 0)); scene.add(e); W.animated.push((t) => { e.position.y = a.y + 4.2 + Math.sin(t * 2 + s.from) * .3; });
  });
  W.shortcutAt = (i) => W.shortcuts.find((s) => s.from === i);

  // ---------------------------------------------------------------- stars to collect along the path
  const starG = starGeo(.9, .42, .3), starMat = new THREE.MeshStandardMaterial({ color: 0xffd84d, emissive: 0xffc83a, emissiveIntensity: 1.6, roughness: .35, metalness: .2 });
  for (const i of pickupTiles([...FRIEND_TILES, ...ICE_TILES], W.shortcuts)) {
    const m = new THREE.Mesh(starG, starMat); m.position.copy(W.tiles[i].pos).add(new THREE.Vector3(0, 3.2, 0)); m.userData.noShadow = true;
    m.add(glowSprite(0xffe680, 3.4, .6)); scene.add(m);
    W.pickups.push({ mesh: m, tile: i, taken: false, y0: m.position.y });
  }

  // ---------------------------------------------------------------- forest (instanced, so there can be lots)
  const inst = instancer(scene);
  const friendSpots = FRIEND_TILES.map((i) => { const t = W.tiles[i], side = i % 2 ? 1 : -1, n = new THREE.Vector3(t.tan.z, 0, -t.tan.x).multiplyScalar(side * 6.2); const p = t.pos.clone().add(n); p.y = heightAt(p.x, p.z) + .12; return p; });
  W.friendSpots = friendSpots;
  W.colliders = [];                                         // tree tops the camera must not end up inside (board/deck.js)
  const block = (x, y, z, r) => W.colliders.push({ x, y, z, r });
  const endTile = W.tiles[N - 1];
  const castleAt = new THREE.Vector3(castleXZ.x, endP.y, castleXZ.z);
  const clear = (x, z, minPath = 7) => {
    if (pathDist(x, z) < minPath) return false;
    if (Math.hypot(x - lake.x, z - lake.z) < lake.r + 3) return false;
    if (friendSpots.some((p) => Math.hypot(p.x - x, p.z - z) < 8)) return false;
    if (Math.hypot(x - castleAt.x, z - castleAt.z) < 26) return false;
    if (minPath > 8 && Math.hypot(x - W.tiles[0].pos.x, z - W.tiles[0].pos.z) < 22) return false;
    return true;
  };
  const spots = spotFinder(clear);
  const PASTELS = [0xff9ecb, 0xc9a8ff, 0x9ff0c8, 0xffc9a0, 0x8fd3ff, 0xfff0a0, 0xff8fb0, 0xb6f09a];

  // puffy pastel trees
  const trees = spots(210, 11);
  const trunkM = toon(0xffffff, { clearcoat: 0, roughness: .8 }), leafM = toon(0xffffff);
  const th = trees.map(([x, z]) => ({ x, z, y: heightAt(x, z), h: rand(3.5, 7.5), s: rand(.8, 1.45), c: pick(PASTELS), c2: pick(PASTELS) }));
  th.forEach((t) => block(t.x, t.y + t.h + t.s * 1.1, t.z, t.s * 3.4));
  inst(cyl(.28, .48, 1, 10), trunkM, th.length, (i, o, c) => { const t = th[i]; o.position.set(t.x, t.y + t.h / 2 - .3, t.z); o.scale.set(t.s, t.h, t.s); c.set(0xb78aa8); });
  inst(sph(1, 20, 14), leafM, th.length, (i, o, c) => { const t = th[i]; o.position.set(t.x, t.y + t.h + t.s * 1.3, t.z); o.scale.setScalar(t.s * 3.1); c.set(t.c); });
  inst(sph(1, 16, 12), leafM, th.length, (i, o, c) => { const t = th[i]; o.position.set(t.x + t.s * 1.8, t.y + t.h + t.s * .5, t.z + t.s * .5); o.scale.setScalar(t.s * 2.1); c.set(t.c2); });
  inst(sph(1, 16, 12), leafM, th.length, (i, o, c) => { const t = th[i]; o.position.set(t.x - t.s * 1.5, t.y + t.h + t.s * .3, t.z - t.s * .8); o.scale.setScalar(t.s * 2); c.set(t.c); });

  // ice-cream trees: a waffle cone topped with scoops, cherry and drips
  const iceT = spots(44, 12).map(([x, z]) => ({ x, z, y: heightAt(x, z), s: rand(.8, 1.3), c: pick([0xff9ecb, 0x9ff0c8, 0xfff3d0, 0xc9a8ff, 0xffc9a0]), c2: pick([0xff9ecb, 0x9ff0c8, 0xfff3d0, 0x8fd3ff]) }));
  const waffle = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#e8b86a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#b8803a'; g.lineWidth = 5; for (let i = -h; i < w + h; i += 24) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.stroke(); g.beginPath(); g.moveTo(i + h, 0); g.lineTo(i, h); g.stroke(); } }, [3, 3]);
  inst(new THREE.ConeGeometry(1.5, 5.5, 14).rotateX(Math.PI), toon(0xffffff, { map: waffle }), iceT.length, (i, o) => { const t = iceT[i]; o.position.set(t.x, t.y + 2.4 * t.s, t.z); o.scale.setScalar(t.s); o.rotation.y = i; });
  inst(sph(1, 20, 14), leafM, iceT.length, (i, o, c) => { const t = iceT[i]; o.position.set(t.x, t.y + 6 * t.s, t.z); o.scale.set(2.05 * t.s, 1.75 * t.s, 2.05 * t.s); c.set(t.c); });
  inst(sph(1, 18, 12), leafM, iceT.length, (i, o, c) => { const t = iceT[i]; o.position.set(t.x, t.y + 8.1 * t.s, t.z); o.scale.setScalar(1.55 * t.s); c.set(t.c2); });
  inst(sph(1, 14, 10), toon(0xffffff), iceT.length, (i, o, c) => { const t = iceT[i]; o.position.set(t.x, t.y + 9.7 * t.s, t.z); o.scale.setScalar(.5 * t.s); c.set(0xe8334a); });
  inst(new THREE.TorusGeometry(1.75, .42, 10, 24).rotateX(Math.PI / 2), leafM, iceT.length, (i, o, c) => { const t = iceT[i]; o.position.set(t.x, t.y + 5.1 * t.s, t.z); o.scale.setScalar(t.s); c.set(t.c); });

  // star trees: tall slim pines with a glowing star on top
  iceT.forEach((t) => block(t.x, t.y + 7 * t.s, t.z, 2.7 * t.s));
  const starT = spots(22, 11).map(([x, z]) => ({ x, z, y: heightAt(x, z), s: rand(.9, 1.5), c: pick([0x7fe3c8, 0x9ad8ff, 0xb9a8ff]) }));
  starT.forEach((t) => block(t.x, t.y + 6.5 * t.s, t.z, 2.7 * t.s));
  inst(new THREE.ConeGeometry(2, 6, 12), leafM, starT.length, (i, o, c) => { const t = starT[i]; o.position.set(t.x, t.y + 5.5 * t.s, t.z); o.scale.setScalar(t.s); c.set(t.c); });
  inst(new THREE.ConeGeometry(1.6, 5, 12), leafM, starT.length, (i, o, c) => { const t = starT[i]; o.position.set(t.x, t.y + 8.4 * t.s, t.z); o.scale.setScalar(t.s); c.set(t.c); });
  inst(cyl(.3, .4, 3), trunkM, starT.length, (i, o, c) => { const t = starT[i]; o.position.set(t.x, t.y + 1.2, t.z); c.set(0xb78aa8); });
  const tinyStar = starGeo(.8, .38, .25);
  inst(tinyStar, new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffe27a).multiplyScalar(1.8) }), starT.length, (i, o) => { const t = starT[i]; o.position.set(t.x, t.y + 12.4 * t.s, t.z); o.scale.setScalar(t.s); }, false);

  // mushrooms, bushes, crystals
  const mush = spots(70, 8).map(([x, z]) => ({ x, z, y: heightAt(x, z), s: rand(.6, 1.6), c: pick(PASTELS) }));
  inst(cyl(.3, .4, 1.3, 10), toon(0xffffff), mush.length, (i, o, c) => { const t = mush[i]; o.position.set(t.x, t.y + .6 * t.s, t.z); o.scale.setScalar(t.s); c.set(0xfff3e6); });
  inst(new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), toon(0xffffff), mush.length, (i, o, c) => { const t = mush[i]; o.position.set(t.x, t.y + 1.2 * t.s, t.z); o.scale.set(t.s * 1.3, t.s * .9, t.s * 1.3); c.set(t.c); });
  const bush = spots(150, 4.2);
  inst(sph(1, 14, 10), leafM, bush.length, (i, o, c) => { const [x, z] = bush[i], s = rand(.8, 1.7); o.position.set(x, heightAt(x, z) + s * .5, z); o.scale.set(s * 1.3, s, s * 1.3); c.set(pick(PASTELS)); });
  const crys = spots(34, 9);
  inst(new THREE.OctahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: .35, roughness: .15, metalness: .1 }), crys.length * 3, (i, o, c) => {
    const [x, z] = crys[Math.floor(i / 3)], k = i % 3; o.position.set(x + (k - 1) * .9, heightAt(x, z) + .9 + k * .3, z + (k % 2) * .6); o.scale.set(.6, rand(1.2, 2.6), .6); o.rotation.set(rand(-.3, .3), rand(0, 3), rand(-.3, .3)); c.set(pick([0xff9ecb, 0xc9a8ff, 0x8fd3ff, 0x9ff0c8]));
  });

  // flowers & grass
  const stems = spots(900, 3.2, [-80, 70, -100, 70]);
  inst(cyl(.04, .04, 1, 5), toon(0x5fcf6a), stems.length, (i, o) => { const [x, z] = stems[i]; o.position.set(x, heightAt(x, z) + .35, z); o.scale.set(1, .7, 1); }, false);
  inst(sph(.17, 8, 6), toon(0xffffff), stems.length, (i, o, c) => { const [x, z] = stems[i]; o.position.set(x, heightAt(x, z) + .72, z); c.set(pick([0xff7fb5, 0xffffff, 0xffe14d, 0xb07cff, 0x7be0ff, 0xff9f4d])); }, false);
  const blade = mergeGeometries([0, 1, 2].map((k) => { const g = new THREE.ConeGeometry(.09, .6, 4); g.translate(0, .3, 0); g.rotateZ((k - 1) * .35); g.rotateY(k * 2.1); return g; }));
  const grass = spots(3200, 2.8, [-90, 80, -110, 80]);
  inst(blade, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .8 }), grass.length, (i, o, c) => { const [x, z] = grass[i]; o.position.set(x, heightAt(x, z) - .05, z); o.scale.setScalar(rand(.8, 1.6)); o.rotation.y = rand(0, 6); c.set(pick([0x6fdc80, 0x8fe88a, 0xb8f08a, 0x7fe0b8])); }, false);

  // candy-cane lamp posts with star lanterns along both sides of the path
  const posts = [];
  for (let i = 1; i < N - 1; i += 3) { const t = W.tiles[i], n = new THREE.Vector3(t.tan.z, 0, -t.tan.x); [-1, 1].forEach((s) => { const p = t.pos.clone().add(n.clone().multiplyScalar(s * 3.4)); p.y = heightAt(p.x, p.z); posts.push({ p, yaw: Math.atan2(n.x * s, n.z * s) }); }); }
  inst(cyl(.14, .16, 3.2, 8), toon(0xffffff, { map: candyCaneTex(4) }), posts.length, (i, o) => { const q = posts[i].p; o.position.set(q.x, q.y + 1.5, q.z); }, true);
  inst(sph(.34, 12, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff0a0).multiplyScalar(1.6) }), posts.length, (i, o) => { const q = posts[i].p; o.position.set(q.x, q.y + 3.4, q.z); }, false);
  posts.forEach((q, i) => { if (i % 3 === 0) { const gl = glowSprite(0xfff0a0, 5, .45); gl.position.copy(q.p).add(new THREE.Vector3(0, 3.4, 0)); scene.add(gl); } });

  // big ice-cream treats standing in the forest (real sculpted models)
  const GIANTS = [['ice-cream-cne', 9], ['sundae', 7], ['popsicle', 10], ['popsicle-chocolate', 10], ['cupcake', 6], ['donut-sprinkles', 5], ['lollypop', 11], ['cake-birthday', 6], ['ice-cream', 8]];
  spots(18, 15).forEach(([x, z], i) => {
    const [n, h0] = GIANTS[i % GIANTS.length], h = h0 * rand(.9, 1.3), m = model(`food/${n}`, { height: h });
    if (!m) return; m.position.set(x, heightAt(x, z) - .2, z); block(x, m.position.y + h * .5, z, h * .55); m.rotation.y = rand(0, 6); m.rotation.z = rand(-.1, .1); scene.add(m);
  });

  // ---------------------------------------------------------------- ice-cream stops (a big cone next to the square)
  ICE_TILES.forEach((i, k) => {
    const t = W.tiles[i], n = new THREE.Vector3(t.tan.z, 0, -t.tan.x), side = k % 2 ? 1 : -1, p = t.pos.clone().add(n.multiplyScalar(side * 5.2)); p.y = heightAt(p.x, p.z);
    const m = model(`food/${k % 2 ? 'ice-cream' : 'ice-cream-cne'}`, { height: 5.2 });
    const holder = new THREE.Group(); holder.position.copy(p); scene.add(holder);
    if (m) holder.add(m); else holder.add(mk(new THREE.ConeGeometry(1, 3, 12).rotateX(Math.PI), 0xe8b86a, [0, 1.5, 0]), mk(sph(1.3), 0xff9ecb, [0, 3.4, 0]));
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.1, 2.6, 36).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffa8d8).multiplyScalar(1.5), transparent: true, opacity: .6, depthWrite: false, blending: THREE.AdditiveBlending }));
    ring.position.y = .15; holder.add(ring);
    const e = emojiSprite('\u{1F366}', 3); e.position.copy(t.pos).add(new THREE.Vector3(0, 3.6, 0)); scene.add(e);
    W.animated.push((tt) => { e.position.y = t.pos.y + 3.6 + Math.sin(tt * 2.2 + i) * .3; holder.rotation.y = Math.sin(tt * .6 + i) * .15; });
    W.iceProps.push({ tile: i, holder, spot: p });
  });
  // soft rings where the friends will stand
  friendSpots.forEach((p, k) => {
    const col = [0xff9ed8, 0xffe14d, 0x9fd8ff, 0x9fb0ff][k];
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.6, 3.2, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(1.5), transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending }));
    ring.position.copy(p).add(new THREE.Vector3(0, .15, 0)); scene.add(ring);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(2.6, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .22, depthWrite: false }));
    disc.position.copy(ring.position); scene.add(disc);
  });

  // ---------------------------------------------------------------- the lake
  const waterMat = new THREE.ShaderMaterial({
    transparent: true, uniforms: { time: { value: 0 } },
    vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }',
    fragmentShader: `varying vec2 vUv; varying vec3 vW; uniform float time;
      void main(){ vec2 p = vW.xz*.5; float w = sin(p.x*2.+time*1.3)*sin(p.y*2.2+time*1.1) + sin((p.x+p.y)*3.+time*2.);
        vec3 c = mix(vec3(.55,.85,1.), vec3(.95,.7,1.), .5+.5*sin(vW.x*.12+vW.z*.1+time*.2)); c += pow(max(w*.5+.5,0.),6.)*.55;
        float e = length(vUv-.5)*2.; gl_FragColor = vec4(c, .86*(1.-smoothstep(.82,1.,e))); }`,
  });
  const water = new THREE.Mesh(new THREE.CircleGeometry(lake.r + 1.5, 48).rotateX(-Math.PI / 2), waterMat); water.position.set(lake.x, heightAt(lake.x, lake.z) + 3.3, lake.z); scene.add(water);
  W.waterMat = waterMat;
  for (let i = 0; i < 7; i++) { const a = rand(0, 6.28), r = rand(1, lake.r - 2), p = model('nature/lily_large', { size: 2 }); if (p) { p.position.set(lake.x + Math.cos(a) * r, water.position.y + .05, lake.z + Math.sin(a) * r); scene.add(p); } }

  // ---------------------------------------------------------------- sky life: clouds, floating islands, rainbows over the path
  for (let i = 0; i < 16; i++) {
    const c = new THREE.Group(); for (let k = 0; k < 5; k++) c.add(mk(sph(rand(5, 8)), toon(pick([0xffffff, 0xffe9f6, 0xeaf3ff])), [k * 6 - 12, rand(-1, 2), rand(-2, 2)], [1.4, .85, 1]));
    c.position.set(rand(-220, 220), rand(55, 110), rand(-280, 40)); c.userData.noShadow = true; scene.add(c); W.clouds.push(c);
  }
  [[-48, 30, -40, 10], [40, 42, -55, 8], [-5, 36, -85, 9]].forEach(([x, y, z, r], i) => {
    const g = new THREE.Group(); g.position.set(x, y, z);
    g.add(mk(new THREE.ConeGeometry(r, r * 1.2, 16).rotateX(Math.PI), 0xc9a8ff, [0, -r * .6, 0]), mk(cyl(r, r, .8, 24), 0x9ff0c8, [0, .2, 0]));
    const tr = mk(cyl(.25, .35, 3.5), 0xb78aa8, [r * .2, 2.4, 0]); g.add(tr, mk(sph(2.1), pick(PASTELS), [r * .2, 5, 0]), mk(sph(1.2), pick(PASTELS), [r * .2 + 1.6, 4.2, 0.4]));
    for (let k = 0; k < 6; k++) g.add(mk(sph(.28, 8, 6), pick([0xff7fb5, 0xffe14d, 0xffffff]), [rand(-r * .7, r * .7), .75, rand(-r * .7, r * .7)]));
    g.userData.noShadow = true; scene.add(g); W.animated.push((t) => { g.position.y = y + Math.sin(t * .5 + i * 2) * 1.2; g.rotation.y = t * .05; });
  });
  [0.12, 0.38, 0.62, 0.86].forEach((u, i) => {
    const t = W.tiles[Math.round(u * (N - 1))], center = t.pos.clone(), n = new THREE.Vector3(t.tan.z, 0, -t.tan.x).normalize();
    if (W.shortcuts.some((s) => Math.abs(s.from - t.i) < 6 || Math.abs(s.to - t.i) < 6)) return;
    const g = new THREE.Group(); g.position.copy(center); g.rotation.y = Math.atan2(n.x, n.z) + Math.PI / 2; g.userData.noShadow = true;
    RAINBOW.forEach((c, k) => { const r = 8.2 - k * .45; const a = new THREE.Mesh(new THREE.TorusGeometry(r, .26, 8, 40, Math.PI), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: .5, roughness: .5 })); a.userData.noShadow = true; g.add(a); });
    scene.add(g);
  });

  // ---------------------------------------------------------------- floating sparkle motes + butterflies
  const MOTES = 520, mpos = new Float32Array(MOTES * 3), mcol = new Float32Array(MOTES * 3), mc = new THREE.Color();
  for (let i = 0; i < MOTES; i++) { const t = W.tiles[Math.floor(rand(0, N))].pos; mpos.set([t.x + rand(-26, 26), t.y + rand(.5, 12), t.z + rand(-26, 26)], i * 3); mc.set(pick([0xfff0a0, 0xffb8e0, 0xb8f0ff, 0xffffff, 0xd8c0ff])); mcol.set([mc.r, mc.g, mc.b], i * 3); }
  const mgeo = new THREE.BufferGeometry(); mgeo.setAttribute('position', new THREE.BufferAttribute(mpos, 3)); mgeo.setAttribute('color', new THREE.BufferAttribute(mcol, 3));
  const motes = new THREE.Points(mgeo, new THREE.PointsMaterial({ size: .5, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, map: glowSprite().material.map }));
  motes.frustumCulled = false; scene.add(motes);
  W.animated.push((t) => { for (let i = 0; i < MOTES; i++) { mpos[i * 3 + 1] += Math.sin(t * .8 + i) * .004; mpos[i * 3] += Math.sin(t * .5 + i * 1.7) * .006; } mgeo.attributes.position.needsUpdate = true; });
  for (let i = 0; i < 26; i++) {
    const b = new THREE.Group(), col = pick([0xff7fb5, 0x7bd8ff, 0xffe14d, 0xc9a8ff]);
    const wing = new THREE.PlaneGeometry(.9, .7).translate(.45, 0, 0), wm = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: .4, side: THREE.DoubleSide, roughness: .6 });
    const wl = new THREE.Mesh(wing, wm), wr = new THREE.Mesh(wing, wm); wr.scale.x = -1; wl.rotation.x = wr.rotation.x = Math.PI / 2; b.add(wl, wr, mk(sph(.1), 0x3a2a4a));
    const t = W.tiles[Math.floor(rand(0, N))].pos; b.userData = { cx: t.x + rand(-9, 9), cz: t.z + rand(-9, 9), cy: t.y + rand(1.5, 4.5), ph: rand(0, 6), sp: rand(.4, .9), noShadow: true, wl, wr };
    scene.add(b); W.butterflies.push(b);
  }

  // ---------------------------------------------------------------- start arch & castle
  {
    const u6 = 6 / curve.getLength(), p6 = curve.getPointAt(u6), t6 = curve.getTangentAt(u6);
    const g = new THREE.Group(); g.position.copy(p6).add(new THREE.Vector3(0, .2, 0)); g.rotation.y = Math.atan2(t6.x, t6.z); scene.add(g);
    [-1, 1].forEach((s) => g.add(mk(cyl(.4, .4, 8.5, 12), toon(0xffffff, { map: candyCaneTex(8) }), [s * 4.4, 4, 0]), mk(sph(.7), 0xff6fb5, [s * 4.4, 8.6, 0])));
    RAINBOW.forEach((c, k) => { const a = new THREE.Mesh(new THREE.TorusGeometry(4.4 - k * .38 + 0, .22, 8, 36, Math.PI), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: .5 })); a.position.y = 8.2; g.add(a); });
    const drawSign = (c, w, h) => { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.strokeStyle = '#ff6fb5'; c.lineWidth = 14; c.strokeRect(7, 7, w - 14, h - 14); c.fillStyle = '#ff4fa0'; c.font = '700 96px Fredoka, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('START', w / 2, h / 2 + 6); };
    const sign = canvasTex(512, 160, drawSign);
    // the sign is painted again once Fredoka has loaded (the first paint may use a fallback font)
    if (document.fonts) document.fonts.load('700 96px Fredoka').then(() => { drawSign(sign.image.getContext('2d'), 512, 160); sign.needsUpdate = true; }).catch(() => {});
    W.startSign = new THREE.Group(); g.add(W.startSign);
    [1, -1].forEach((s) => { const sg = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 1.7), new THREE.MeshBasicMaterial({ map: sign })); sg.position.set(0, 7.3, s * .1); sg.rotation.y = s > 0 ? 0 : Math.PI; W.startSign.add(sg); });   // readable from both sides
  }
  {
    const C = new THREE.Group(); C.position.copy(castleAt); C.position.y = heightAt(castleAt.x, castleAt.z) - .4; C.rotation.y = Math.atan2(-endTile.tan.x, -endTile.tan.z); C.scale.setScalar(1.35); scene.add(C);
    const wall = 0xfff0fa, tw = [[-8, -4, 0xff9ecb], [8, -4, 0x9fd8ff], [-8, 4, 0xc9a8ff], [8, 4, 0xffe08a], [0, -2, 0x9ff0c8]];
    C.add(mk(new THREE.BoxGeometry(15, 11, 9), wall, [0, 5.5, 0]));
    for (let i = 0; i < 8; i++) C.add(mk(new THREE.BoxGeometry(1.2, 1.3, 1.3), wall, [-6.3 + i * 1.8, 11.6, 4.1]));
    tw.forEach(([x, z, c], k) => {
      const h = k === 4 ? 21 : 15;
      C.add(mk(cyl(1.9, 2.1, h, 18), 0xfff8ee, [x, h / 2, z]), mk(new THREE.ConeGeometry(2.7, 5.5, 18), c, [x, h + 2.7, z]), mk(sph(.4), 0xffd84d, [x, h + 5.8, z]));
      const win = mk(new THREE.BoxGeometry(.8, 1.5, .2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffe27a).multiplyScalar(1.5) }), [x, h * .6, z + 1.9]); C.add(win);
    });
    C.add(mk(new THREE.BoxGeometry(4.8, 4.6, .4), 0x8a4a7a, [0, 2.3, 4.6]), mk(sph(2.4), 0x8a4a7a, [0, 4.6, 4.6], [1, 1, .17]), mk(sph(.22), 0xffc83d, [1.5, 2.2, 4.85]));
    RAINBOW.forEach((c, k) => { const a = new THREE.Mesh(new THREE.TorusGeometry(9 - k * .5, .3, 8, 40, Math.PI), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: .5 })); a.position.set(0, 9, 6); C.add(a); });
    const gl = glowSprite(0xffe9a0, 36, .5); gl.position.set(0, 13, 6); C.add(gl); W.castleGlow = gl;
    W.castle = C;
  }
  W.endSpot = (() => { const p = endTile.pos.clone().add(new THREE.Vector3(endT.x * 6.5, 0, endT.z * 6.5)); p.y = endTile.pos.y; return p; })();
  {   // a red-carpet walkway from the last square to the castle gate
    const len = 12, w = new THREE.Group(); w.position.copy(endTile.pos).add(new THREE.Vector3(endT.x * (len / 2 + 2.2), -.28, endT.z * (len / 2 + 2.2))); w.rotation.y = Math.atan2(endT.x, endT.z); scene.add(w);
    w.add(mk(new THREE.BoxGeometry(5.2, .3, len), 0xffe27a, [0, 0, 0]), mk(new THREE.BoxGeometry(4.2, .34, len - .4), 0xe8405e, [0, .02, 0]));
    [-1, 1].forEach((sd) => { for (let k = 0; k < 4; k++) w.add(mk(sph(.28, 10, 8), 0xfff0a0, [sd * 2.9, .5, -len / 2 + 1 + k * (len - 2) / 3])); });
  }

  W.update = (dt, t) => {
    W.waterMat.uniforms.time.value = t; W.sky.material.uniforms.time.value = t;
    W.clouds.forEach((c) => { c.position.x += dt * 1.1; if (c.position.x > 240) c.position.x = -240; });
    W.pickups.forEach((s) => { if (!s.taken) { s.mesh.rotation.y = t * 1.6 + s.tile; s.mesh.position.y = s.y0 + Math.sin(t * 2 + s.tile) * .35; } });
    W.animated.forEach((f) => f(t));
    W.butterflies.forEach((b) => { const d = b.userData, a = t * d.sp + d.ph; b.position.set(d.cx + Math.cos(a) * 5, d.cy + Math.sin(a * 2) * .8, d.cz + Math.sin(a * 1.3) * 5); b.rotation.y = -a + Math.PI / 2; const f = Math.sin(t * 16 + d.ph) * .9; d.wl.rotation.z = f; d.wr.rotation.z = -f; });
    if (W.castleGlow) W.castleGlow.material.opacity = .4 + Math.sin(t * 2.2) * .12;
  };
  setStyle('toon');
  return W;
}
