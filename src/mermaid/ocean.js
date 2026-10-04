import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toon, mk, rand, pick, clamp, lerp, canvasTex, glowSprite, setStyle, RAINBOW } from '../util.js';
import { heartGeo, createDolphin } from './mermaid.js';

const sph = (r, w = 20, h = 14) => new THREE.SphereGeometry(r, w, h);
const cyl = (rt, rb, h, s = 12) => new THREE.CylinderGeometry(rt, rb, h, s);
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export const COLORS = [
  { name: 'red', hex: 0xff3b4e, css: '#ff3b4e' }, { name: 'purple', hex: 0xa64dff, css: '#a64dff' }, { name: 'yellow', hex: 0xffd83d, css: '#ffd83d' },
  { name: 'blue', hex: 0x3da5ff, css: '#3da5ff' }, { name: 'orange', hex: 0xff8a2a, css: '#ff8a2a' }, { name: 'green', hex: 0x3ddc6b, css: '#3ddc6b' },
];
export const N = 50;
const SC = 0.62;
const CP = [[-70, 40], [-50, 46], [-28, 40], [-8, 44], [14, 36], [34, 24], [44, 6], [34, -10], [14, -16], [-6, -12], [-26, -18], [-42, -32], [-38, -50], [-18, -60], [4, -54], [24, -60], [42, -74], [58, -90]]
  .map(([x, z]) => new THREE.Vector3(x * SC, 0, z * SC));
export const FRIEND_TILES = [9, 22, 35];                 // Sparkle, Rainbow, Kitty. Lucy (twin) waits at the palace
export const PEARL_TILES = [14, 28, 41];                 // giant clams with pearls

export const TIME = { value: 0 };
/** make a material sway like it is in a current (kelp, grass, fans) */
function sway(mat, amp = .5) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.time = TIME;
    sh.vertexShader = 'uniform float time;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
      float ph = instanceMatrix[3].x*.21 + instanceMatrix[3].z*.17;
      #else
      float ph = 0.;
      #endif
      float hh = max(position.y, 0.);
      transformed.x += sin(time*1.1 + ph + hh*.35)*hh*${amp.toFixed(3)}*.12;
      transformed.z += cos(time*.9 + ph*1.3 + hh*.3)*hh*${amp.toFixed(3)}*.1;`);
  };
  mat.customProgramCacheKey = () => 'sway' + amp;
  return mat;
}
function emojiSprite(ch, size = 2.6) {
  const tex = canvasTex(128, 128, (g, w, h) => { g.font = '96px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, w / 2, h / 2 + 6); });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set(size, size, 1); return s;
}
function roundedGeo(w, depth, rad, bevel = .1) {
  const h = w / 2 - bevel, sh = new THREE.Shape();
  sh.moveTo(-h + rad, -h); sh.lineTo(h - rad, -h); sh.quadraticCurveTo(h, -h, h, -h + rad); sh.lineTo(h, h - rad); sh.quadraticCurveTo(h, h, h - rad, h);
  sh.lineTo(-h + rad, h); sh.quadraticCurveTo(-h, h, -h, h - rad); sh.lineTo(-h, -h + rad); sh.quadraticCurveTo(-h, -h, -h + rad, -h);
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 10 });
  g.rotateX(-Math.PI / 2); return g;
}
const part = (geo, pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1]) => { const g = geo.clone(); g.scale(...scl); g.rotateX(rot[0]); g.rotateY(rot[1]); g.rotateZ(rot[2]); g.translate(...pos); return g; };

export function buildOcean(scene) {
  setStyle('candy');
  const W = { tiles: [], animated: [], hearts: [], bubbleSets: [], jellies: [], fish: null, dolphins: [] };

  // ---------------------------------------------------------------- seabed + the path (which floats above it)
  const ends = new THREE.CatmullRomCurve3(CP, false, 'catmullrom', .5);
  const e0 = ends.getPointAt(1), eT = ends.getTangentAt(1).setY(0).normalize();
  const palaceXZ = { x: e0.x + eT.x * 44, z: e0.z + eT.z * 44 };
  const hills = (x, z) => Math.sin(x * .05 + 1) * 3 + Math.cos(z * .045) * 2.8 + Math.sin((x + z) * .025) * 4 + Math.sin(x * .4 + z * .3) * .12 + Math.sin(x * .13) * Math.cos(z * .11) * 1.5;
  const heightAt = (x, z) => {
    let h = hills(x, z);
    h += Math.pow(Math.max(0, (Math.hypot(x + 3, z + 14) - 64) / 42), 1.6) * 42;
    h = lerp(h, 0, 1 - smoothstep(14, 34, Math.hypot(x - palaceXZ.x, z - palaceXZ.z)));
    return h;
  };
  W.heightAt = heightAt;
  const raw = ends.getSpacedPoints(300), hs = raw.map((p) => heightAt(p.x, p.z));
  const ys = hs.map((_, i) => { let m = -1e9; for (let k = -14; k <= 14; k++) m = Math.max(m, hs[clamp(i + k, 0, 300)]); return m + 6; });
  const sm = ys.map((_, i) => { let s = 0, c = 0; for (let k = -18; k <= 18; k++) { s += ys[clamp(i + k, 0, 300)]; c++; } return s / c; });
  const curve = new THREE.CatmullRomCurve3(raw.filter((_, i) => i % 6 === 0 || i === 300).map((p) => { const i = raw.indexOf(p); return new THREE.Vector3(p.x, sm[i], p.z); }), false, 'catmullrom', .5);
  W.curve = curve;
  const dense = curve.getSpacedPoints(600), dx = new Float32Array(dense.length), dz = new Float32Array(dense.length);
  dense.forEach((p, i) => { dx[i] = p.x; dz[i] = p.z; });
  const pathDist = (x, z) => { let best = 1e9; for (let i = 0; i < dx.length; i++) { const d = (dx[i] - x) ** 2 + (dz[i] - z) ** 2; if (d < best) best = d; } return Math.sqrt(best); };
  W.pathDist = pathDist;
  const endP = curve.getPointAt(1), endT = curve.getTangentAt(1).setY(0).normalize();

  // terrain: warm sand with ripples, lit by wobbling caustic light
  {
    const SEG = 190, SIZE = 400, geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG).rotateX(-Math.PI / 2);
    const pos = geo.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color();
    const sand = [0xf6e2b4, 0xf0d29c, 0xfbeccd].map((v) => new THREE.Color(v));
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), y = heightAt(x, z); pos.setY(i, y);
      const n = Math.sin(x * .09) * Math.cos(z * .08) + Math.sin(x * .23 + z * .17) * .5;
      c.copy(sand[0]).lerp(sand[1], .5 + n * .5).lerp(sand[2], clamp(n * .5, 0, .5));
      if (Math.sin(x * .05 + 2) * Math.cos(z * .06 - 1) > .5) c.lerp(new THREE.Color(0xf4b8b0), .45);
      if (Math.sin(x * .07 - 1) * Math.cos(z * .05 + 2) > .6) c.lerp(new THREE.Color(0xa8e4d0), .4);
      c.lerp(new THREE.Color(0x6a8ac0), smoothstep(64, 120, Math.hypot(x + 3, z + 14)) * .85);
      col.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals();
    const ripple = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(190,170,120,.35)'; g.lineWidth = 3; for (let y = 0; y < h; y += 14) { g.beginPath(); for (let x = 0; x <= w; x += 8) g.lineTo(x, y + Math.sin(x * .07 + y) * 4); g.stroke(); } }, [70, 70]);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, map: ripple, roughness: .95 });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.time = TIME;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix*vec4(transformed,1.)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        varying vec3 vWP; uniform float time;
        float caus(vec2 p){ p *= .2; float t = time*.55; float v = sin(p.x*3.+t)+sin(p.y*3.2-t*1.1);
          vec2 q = vec2(p.x*.76-p.y*.64, p.x*.64+p.y*.76); v += sin(q.x*4.-t*.8)+sin(q.y*4.4+t); return pow(1.-abs(sin(v*1.2)), 7.); }`)
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= 1. + caus(vWP.xz)*.95*smoothstep(80.,10.,vWP.y+40.);');
    };
    const t = new THREE.Mesh(geo, mat); t.receiveShadow = true; scene.add(t);
  }

  // ---------------------------------------------------------------- the water around everything: sky of light above, deep blue below
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { time: TIME },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `varying vec3 vP; uniform float time;
      void main(){
        vec3 d = normalize(vP); float h = d.y;
        vec3 deep = vec3(.04,.22,.52), mid = vec3(.12,.55,.80), top = vec3(.55,.92,.98);
        vec3 c = h > 0. ? mix(mid, top, smoothstep(0.,.9,h)) : mix(mid, deep, smoothstep(0.,-.6,h));
        if (h > .2) { vec2 p = d.xz/(d.y+.05)*3.; float w = sin(p.x*2.+time*.8)+sin(p.y*2.3-time*.7)+sin((p.x+p.y)*1.7+time*.5); c += vec3(.5,.8,.7)*pow(max(w*.33+.5,0.),4.)*smoothstep(.2,.7,h); }
        gl_FragColor = vec4(c, 1.);
      }`,
  }));
  scene.add(sky); W.sky = sky;

  // ---------------------------------------------------------------- the squares (sea-glass tiles that float along the path)
  const tileGeo = roundedGeo(3.7, .34, .8), innerGeo = roundedGeo(2.5, .12, .55, .06), baseGeo = roundedGeo(4.15, .28, .9, .08), baseMat = toon(0xf4fbff);
  for (let i = 0; i < N; i++) {
    const u = i / (N - 1), p = curve.getPointAt(u), tan = curve.getTangentAt(u);
    const colr = i === 0 ? { hex: 0xffffff } : i === N - 1 ? { hex: 0xffd84d } : COLORS[(i - 1) % 6], g = new THREE.Group();
    g.position.copy(p); g.rotation.order = 'YXZ'; g.rotation.y = Math.atan2(tan.x, tan.z); g.rotation.x = -Math.asin(clamp(tan.y, -.6, .6));
    const base = new THREE.Mesh(baseGeo, baseMat); base.position.y = -.1; g.add(base);
    const tile = new THREE.Mesh(tileGeo, toon(colr.hex, { clearcoat: 1, clearcoatRoughness: .08 })); tile.position.y = .1; g.add(tile);
    const shine = new THREE.Mesh(innerGeo, toon(new THREE.Color(colr.hex).lerp(new THREE.Color(0xffffff), .45), { clearcoat: 1 })); shine.position.y = .5; g.add(shine);
    const gl = glowSprite(colr.hex, 6.5, .22); gl.position.y = .5; g.add(gl);
    scene.add(g);
    W.tiles.push({ i, pos: p.clone().add(new THREE.Vector3(0, .5, 0)), tan, u, color: i === 0 || i === N - 1 ? null : colr, group: g, bob: rand(0, 6) });
  }

  // ---------------------------------------------------------------- dolphin rides: shortcut arcs of bubbles
  const used = new Set([0, N - 1, ...FRIEND_TILES, ...PEARL_TILES]);
  W.shortcuts = [];
  for (let k = 0; k < 2; k++) {
    let best = null;
    for (let a = 4; a < N - 14; a++) {
      if (used.has(a) || W.shortcuts.some((s) => Math.abs(s.from - a) < 12)) continue;
      for (let b = a + 8; b <= Math.min(N - 3, a + 15); b++) {
        if (used.has(b)) continue;
        const d = W.tiles[a].pos.distanceTo(W.tiles[b].pos), score = d / (b - a);
        if (d < 40 && (!best || score < best.score)) best = { from: a, to: b, score };
      }
    }
    if (best) { W.shortcuts.push(best); used.add(best.from); used.add(best.to); }
  }
  W.shortcuts.forEach((s) => {
    const a = W.tiles[s.from].pos.clone(), b = W.tiles[s.to].pos.clone(), ctrl = a.clone().lerp(b, .5); ctrl.y += 9 + a.distanceTo(b) * .2;
    s.arc = new THREE.QuadraticBezierCurve3(a, ctrl, b);
    const n = 70, P = new Float32Array(n * 3), geo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(P, 3));
    for (let i = 0; i < n; i++) { const q = s.arc.getPoint(i / (n - 1)); P.set([q.x + rand(-.6, .6), q.y + rand(-.6, .6), q.z + rand(-.6, .6)], i * 3); }
    scene.add(Object.assign(new THREE.Points(geo, new THREE.PointsMaterial({ size: .9, map: bubbleTex(), transparent: true, depthWrite: false, opacity: .8 })), { frustumCulled: false }));
    const e = emojiSprite('\u{1F42C}', 3.4); e.position.copy(a).add(new THREE.Vector3(0, 4, 0)); scene.add(e); W.animated.push((t) => { e.position.y = a.y + 4 + Math.sin(t * 2 + s.from) * .3; });
  });
  W.shortcutAt = (i) => W.shortcuts.find((s) => s.from === i);

  // ---------------------------------------------------------------- hearts to collect
  const hgeo = heartGeo(.85, .3), hmat = new THREE.MeshStandardMaterial({ color: 0xff5fa4, emissive: 0xff3a8c, emissiveIntensity: 1.1, roughness: .35 });
  for (let i = 3; i < N - 2; i += 3) {
    if (FRIEND_TILES.includes(i) || PEARL_TILES.includes(i) || W.shortcuts.some((s) => s.from === i || s.to === i)) continue;
    const m = new THREE.Mesh(hgeo, hmat); m.position.copy(W.tiles[i].pos).add(new THREE.Vector3(0, 3.6, 0)); m.userData.noShadow = true;
    m.add(glowSprite(0xff9ed8, 3.6, .55)); scene.add(m); W.hearts.push({ mesh: m, tile: i, taken: false, y0: m.position.y });
  }

  // ---------------------------------------------------------------- the reef: instanced kelp, grass, coral, rocks
  const inst = (geo, mat, n, fn, shadow = true) => {
    const m = new THREE.InstancedMesh(geo, mat, n), o = new THREE.Object3D(), c = new THREE.Color();
    for (let i = 0; i < n; i++) { o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1); c.set(0xffffff); fn(i, o, c); o.updateMatrix(); m.setMatrixAt(i, o.matrix); m.setColorAt(i, c); }
    m.castShadow = shadow; m.receiveShadow = true; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; scene.add(m); return m;
  };
  const friendXZ = FRIEND_TILES.map((i) => { const t = W.tiles[i], sd = i % 2 ? 1 : -1; return new THREE.Vector3(t.pos.x + t.tan.z * sd * 7, 0, t.pos.z - t.tan.x * sd * 7); });
  const clear = (x, z, minPath) => pathDist(x, z) > minPath && Math.hypot(x - palaceXZ.x, z - palaceXZ.z) > 24 && !friendXZ.some((p) => Math.hypot(p.x - x, p.z - z) < 6);
  const spots = (n, minPath, area = [-110, 80, -125, 80]) => { const out = []; let tries = 0; while (out.length < n && tries++ < n * 60) { const x = rand(area[0], area[1]), z = rand(area[2], area[3]); if (clear(x, z, minPath)) out.push([x, z]); } return out; };
  const CORAL = [0xff7fb5, 0xff9f6a, 0xb07cff, 0xffd84d, 0xff6a8a, 0x7be0d0, 0xff8fe0];

  // kelp forest: crossed ribbons that sway in the current
  const kelpG = mergeGeometries([new THREE.PlaneGeometry(1.5, 10, 1, 16).translate(0, 5, 0), new THREE.PlaneGeometry(1.5, 10, 1, 16).translate(0, 5, 0).rotateY(Math.PI / 2)]);
  const kelpMat = sway(new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: .7, emissive: 0x2a6a20, emissiveIntensity: .25 }), 1);
  const kelp = spots(420, 12);
  inst(kelpG, kelpMat, kelp.length, (i, o, c) => { const [x, z] = kelp[i], h = rand(.8, 2.2); o.position.set(x, heightAt(x, z) - .3, z); o.scale.set(rand(.9, 1.6), h, rand(.9, 1.6)); o.rotation.y = rand(0, 6); c.set(pick([0x5fd070, 0x7bd86a, 0x9ad65a, 0x4ac08a, 0xc8c850])); }, false);
  const blade = new THREE.ConeGeometry(.14, 2.4, 4, 5).translate(0, 1.2, 0);
  const gMat = sway(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .8, emissive: 0x206030, emissiveIntensity: .2 }), .9);
  const grass = spots(3400, 3, [-90, 80, -110, 80]);
  inst(blade, gMat, grass.length, (i, o, c) => { const [x, z] = grass[i]; o.position.set(x, heightAt(x, z) - .1, z); o.scale.setScalar(rand(.6, 1.5)); o.rotation.y = rand(0, 6); c.set(pick([0x6fdc80, 0x8fe88a, 0x7fe0b8, 0xb8f08a])); }, false);

  // coral: branching, tube, brain, fans, plus rocks
  const branch = mergeGeometries([part(cyl(.28, .38, 2.4), [0, 1.2, 0]), part(cyl(.16, .24, 1.6), [.5, 2.3, 0], [0, 0, -.6]), part(cyl(.16, .24, 1.6), [-.5, 2.2, .2], [0, 0, .6]), part(cyl(.14, .2, 1.4), [0, 2.4, -.6], [.6, 0, 0]), part(sph(.28), [.95, 3, 0]), part(sph(.28), [-.95, 2.9, .3]), part(sph(.26), [0, 3.05, -1.1]), part(sph(.3), [0, 2.5, 0])]);
  const branches = spots(110, 8);
  inst(branch, toon(0xffffff), branches.length, (i, o, c) => { const [x, z] = branches[i], s = rand(.8, 2); o.position.set(x, heightAt(x, z) - .2, z); o.scale.setScalar(s); o.rotation.y = rand(0, 6); c.set(pick(CORAL)); });
  const tubeG = mergeGeometries([0, 1, 2, 3, 4, 5].map((k) => part(new THREE.CylinderGeometry(.34, .4, 1.4 + (k % 3) * .8, 12, 1, true), [Math.cos(k * 1.1) * .55, .8 + (k % 3) * .35, Math.sin(k * 1.1) * .55])));
  const tubes = spots(80, 8);
  inst(tubeG, new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: .5 }), tubes.length, (i, o, c) => { const [x, z] = tubes[i]; o.position.set(x, heightAt(x, z) - .2, z); o.scale.setScalar(rand(.9, 1.8)); o.rotation.y = rand(0, 6); c.set(pick([0xb07cff, 0xff9ed8, 0x7bd0ff, 0xffd84d])); }, true);
  const brainG = new THREE.IcosahedronGeometry(1.2, 3); { const p = brainG.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), d = 1 + Math.sin(x * 9) * Math.sin(z * 9) * .06 + Math.sin(y * 11) * .05; p.setXYZ(i, x * d, y * d * .75, z * d); } brainG.computeVertexNormals(); }
  const brains = spots(70, 8);
  inst(brainG, toon(0xffffff), brains.length, (i, o, c) => { const [x, z] = brains[i]; o.position.set(x, heightAt(x, z), z); o.scale.setScalar(rand(.9, 2.4)); o.rotation.y = rand(0, 6); c.set(pick([0xffa8a0, 0xc9a8ff, 0xffd89a, 0x9ee0c8, 0xff9ed8])); });
  const fanTex = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 3; for (let a = -1.2; a <= 1.2; a += .18) { g.beginPath(); g.moveTo(w / 2, h); g.lineTo(w / 2 + Math.sin(a) * w, h - Math.cos(a) * h); g.stroke(); } for (let r = 20; r < h; r += 18) { g.beginPath(); g.arc(w / 2, h, r, -Math.PI * .85, -Math.PI * .15); g.stroke(); } });
  const fanG = new THREE.CircleGeometry(1.8, 24).translate(0, 1.8, 0);
  const fans = spots(70, 9);
  inst(fanG, sway(new THREE.MeshStandardMaterial({ color: 0xffffff, map: fanTex, side: THREE.DoubleSide, roughness: .6 }), .5), fans.length, (i, o, c) => { const [x, z] = fans[i]; o.position.set(x, heightAt(x, z) - .1, z); o.scale.setScalar(rand(1, 2.4)); o.rotation.y = rand(0, 6); c.set(pick([0xff7fb5, 0xb07cff, 0xff9f6a, 0xffd84d])); });
  const rockG = new THREE.IcosahedronGeometry(1.6, 1); { const p = rockG.attributes.position; for (let i = 0; i < p.count; i++) { const k = 1 + Math.sin(p.getX(i) * 5.3) * Math.cos(p.getZ(i) * 4.1) * .18; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * .9, p.getZ(i) * k); } rockG.computeVertexNormals(); }
  const rocks = spots(90, 11);
  inst(rockG, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .85, flatShading: true }), rocks.length, (i, o, c) => { const [x, z] = rocks[i], s = rand(.8, 4.2); o.position.set(x, heightAt(x, z) + s * .2, z); o.scale.set(s, s * rand(.8, 1.6), s); o.rotation.y = rand(0, 6); c.set(pick([0x8a96c8, 0x9a8ac0, 0x7aa8c0, 0xb0a0c8])); });
  // glowing sea-lamps, starfish, urchins
  const lamps = spots(70, 5);
  inst(cyl(.06, .08, 2.6, 6), toon(0x5fc8a0), lamps.length, (i, o) => { const [x, z] = lamps[i]; o.position.set(x, heightAt(x, z) + 1.2, z); }, false);
  inst(sph(.4, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffffff }), lamps.length, (i, o, c) => { const [x, z] = lamps[i]; o.position.set(x, heightAt(x, z) + 2.7, z); c.set(new THREE.Color(pick([0xa8ffe8, 0xffa8ec, 0xa8d8ff, 0xfff0a0])).multiplyScalar(1.7)); }, false);
  const starfishG = (() => { const sh = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2, r = i % 2 ? .35 : 1; sh[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); } const g = new THREE.ExtrudeGeometry(sh, { depth: .2, bevelEnabled: true, bevelThickness: .08, bevelSize: .08, bevelSegments: 2 }); g.rotateX(-Math.PI / 2); return g; })();
  const stars = spots(120, 4);
  inst(starfishG, toon(0xffffff), stars.length, (i, o, c) => { const [x, z] = stars[i]; o.position.set(x, heightAt(x, z) + .05, z); o.scale.setScalar(rand(.6, 1.3)); o.rotation.y = rand(0, 6); c.set(pick([0xff7a5a, 0xff9ed8, 0xffb04a, 0xffd84d, 0xc9a8ff])); }, false);
  const urchinG = mergeGeometries([part(sph(.5, 12, 8), [0, .5, 0]), ...Array.from({ length: 22 }, (_, k) => { const a = k * 2.4, b = Math.acos(1 - (k + .5) / 11); return part(new THREE.ConeGeometry(.06, .8, 5), [Math.sin(b) * Math.cos(a) * .7, .5 + Math.cos(b) * .7, Math.sin(b) * Math.sin(a) * .7], [Math.sin(b) * Math.sin(a), 0, -Math.sin(b) * Math.cos(a)].map((v, j) => (j === 1 ? 0 : v * 1)), [1, 1, 1]); })]);
  const urchins = spots(40, 4);
  inst(urchinG, toon(0xffffff), urchins.length, (i, o, c) => { const [x, z] = urchins[i]; o.position.set(x, heightAt(x, z), z); o.scale.setScalar(rand(.8, 1.5)); c.set(pick([0x6a3aa8, 0xff5fa4, 0x3a8ac8])); });

  // ---------------------------------------------------------------- giant clams with pearls (treat stops)
  W.pearls = PEARL_TILES.map((i, k) => {
    const t = W.tiles[i], sd = k % 2 ? 1 : -1, hp = t.pos.clone().add(new THREE.Vector3(t.tan.z * sd * 5.6, 0, -t.tan.x * sd * 5.6)); hp.y = heightAt(hp.x, hp.z) + .3;
    const g = new THREE.Group(); g.position.copy(hp); g.rotation.y = Math.atan2(t.pos.x - hp.x, t.pos.z - hp.z); scene.add(g);
    const shellMat = toon(0xffc8e0, { clearcoat: 1 }), lower = mk(new THREE.SphereGeometry(2.2, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI), shellMat, [0, 1.2, 0], [1, .6, 1]);
    const lid = new THREE.Group(); lid.position.set(0, 1.3, -1.6); g.add(lid);
    const up = mk(new THREE.SphereGeometry(2.2, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), shellMat, [0, 0, 1.6], [1, .6, 1]); lid.add(up); lid.rotation.x = -.75;
    for (let r = 0; r < 7; r++) { const a = (r / 6 - .5) * 2.4; const rib = mk(new THREE.BoxGeometry(.12, .1, 2.2), 0xffa0cc, [Math.sin(a) * 1.2, 1.15, Math.cos(a) * .6 - .1]); rib.rotation.y = a; g.add(rib); }
    g.add(lower);
    const pearl = mk(sph(.75, 24, 18), toon(0xffffff, { emissive: 0xfff0ff, emissiveIntensity: .9, clearcoat: 1 }), [0, 1.9, .2]); g.add(pearl);
    const glow = glowSprite(0xffe8ff, 6, .6); glow.position.copy(pearl.position); g.add(glow);
    const e = emojiSprite('\u{1F9AA}', 3); e.position.copy(t.pos).add(new THREE.Vector3(0, 3.7, 0)); scene.add(e);
    W.animated.push((tt) => { e.position.y = t.pos.y + 3.7 + Math.sin(tt * 2.2 + i) * .3; pearl.position.y = 1.9 + Math.sin(tt * 1.5 + i) * .08; lid.rotation.x = -.45 - (.3 + Math.sin(tt * .8 + i) * .12) * (g.userData.open ? 1.5 : 1); });
    return { tile: i, group: g, spot: hp, pearl, glow };
  });

  // ---------------------------------------------------------------- fish, dolphins, jellyfish
  {
    const body = mergeGeometries([part(sph(.5, 12, 8), [0, 0, 0], [0, 0, 0], [.55, .75, 1.5]), part(new THREE.ConeGeometry(.42, .9, 4), [0, 0, -.95], [-Math.PI / 2, 0, 0], [.3, 1, 1]), part(new THREE.ConeGeometry(.3, .6, 4), [0, .5, -.1], [0, 0, 0], [.2, 1, 1])]);
    const fm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .4, metalness: .15 });
    fm.onBeforeCompile = (sh) => { sh.uniforms.time = TIME; sh.vertexShader = 'uniform float time;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n#ifdef USE_INSTANCING\nfloat fph = instanceMatrix[3].x*.7+instanceMatrix[3].z*.5;\n#else\nfloat fph = 0.;\n#endif\ntransformed.x += sin(time*9.+fph - position.z*3.)*max(-position.z-.2,0.)*.35;`); };
    const SCH = 16, PER = 16, total = SCH * PER, mesh = new THREE.InstancedMesh(body, fm, total); mesh.frustumCulled = false; mesh.castShadow = false; scene.add(mesh);
    const schools = Array.from({ length: SCH }, (_, s) => { const t = W.tiles[Math.floor(rand(0, N))].pos; return { cx: t.x + rand(-30, 30), cy: t.y + rand(-2, 10), cz: t.z + rand(-30, 30), R: rand(8, 20), sp: rand(.12, .3) * (Math.random() < .5 ? -1 : 1), ph: rand(0, 6), size: rand(.7, 1.4), col: [pick([0xffb04a, 0x5bc0ff, 0xff7ab8, 0xffe14d, 0x7be0a0, 0xb07cff]), pick([0xffffff, 0xffe0a0, 0xa8e8ff])], offs: Array.from({ length: PER }, () => new THREE.Vector3(rand(-3, 3), rand(-2, 2), rand(-3, 3))) }; });
    const o = new THREE.Object3D(), c = new THREE.Color();
    schools.forEach((s, si) => { for (let k = 0; k < PER; k++) { c.set(s.col[k % 2]); mesh.setColorAt(si * PER + k, c); } });
    W.fish = { mesh, schools };
    W.animated.push((t) => {
      schools.forEach((s, si) => {
        const a = t * s.sp + s.ph, hx = Math.cos(a) * s.R, hz = Math.sin(a) * s.R, yaw = Math.atan2(-Math.sin(a) * Math.sign(s.sp), Math.cos(a) * Math.sign(s.sp));
        for (let k = 0; k < PER; k++) {
          const of = s.offs[k], wob = Math.sin(t * 1.3 + k * 1.7) * .8;
          o.position.set(s.cx + hx + of.x + wob * Math.cos(yaw), s.cy + of.y + Math.sin(t * .7 + k) * .6, s.cz + hz + of.z + wob * Math.sin(yaw));
          o.rotation.set(0, yaw + Math.PI / 2 + Math.sin(t * 2 + k) * .15, 0); o.scale.setScalar(s.size); o.updateMatrix(); mesh.setMatrixAt(si * PER + k, o.matrix);
        }
      });
      mesh.instanceMatrix.needsUpdate = true;
    });
  }
  for (let i = 0; i < 4; i++) {
    const d = createDolphin(1.5 + rand(0, .4)), t0 = W.tiles[Math.floor(rand(8, N - 6))].pos, o = { d, cx: t0.x + rand(-25, 25), cz: t0.z + rand(-25, 25), cy: t0.y + rand(8, 18), R: rand(22, 40), sp: rand(.08, .14) * (i % 2 ? 1 : -1), ph: rand(0, 6) };
    scene.add(d.root); W.dolphins.push(o);
  }
  const jm = [[0xff7ab8, 0xffb8e0], [0xb07cff, 0xd8c0ff], [0x4ad8e8, 0xa8f0ff], [0xffd84d, 0xfff0a0]];
  for (let i = 0; i < 20; i++) {
    const [a, b] = pick(jm), j = new THREE.Group(), tp = W.tiles[Math.floor(rand(2, N - 2))], ang = rand(0, 6.28), dist = rand(7, 22);
    const dome = mk(new THREE.SphereGeometry(1.4, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: a, emissive: a, emissiveIntensity: .75, transparent: true, opacity: .62, roughness: .2 }), [0, 0, 0]);
    const inner = mk(new THREE.SphereGeometry(.8, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(b).multiplyScalar(1.5), transparent: true, opacity: .8 }), [0, .05, 0]);
    j.add(dome, inner);
    const tents = []; for (let k = 0; k < 9; k++) { const aa = (k / 9) * Math.PI * 2, tg = new THREE.Group(); tg.position.set(Math.cos(aa) * 1.1, 0, Math.sin(aa) * 1.1); const tt = mk(cyl(.05, .02, 2.8 + (k % 3) * .6, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(b).multiplyScalar(1.3), transparent: true, opacity: .7 }), [0, -1.5, 0]); tg.add(tt); j.add(tg); tents.push(tg); }
    j.add(glowSprite(b, 6, .35));
    const s = rand(.8, 1.8); j.scale.setScalar(s); j.userData = { dome, tents, ph: rand(0, 6), baseY: tp.pos.y + rand(-1, 9), s }; j.position.set(tp.pos.x + Math.cos(ang) * dist, j.userData.baseY, tp.pos.z + Math.sin(ang) * dist); scene.add(j); W.jellies.push(j);
  }

  // ---------------------------------------------------------------- bubbles, plankton, light rays
  function bubbleTex() { return canvasTex(64, 64, (g, w, h) => { g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = 4; g.beginPath(); g.arc(32, 32, 26, 0, 7); g.stroke(); g.fillStyle = 'rgba(200,240,255,.18)'; g.fill(); g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.arc(23, 22, 6, 0, 7); g.fill(); }); }
  {
    const n = 1100, P = new Float32Array(n * 3), spd = new Float32Array(n), geo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(P, 3));
    for (let i = 0; i < n; i++) { const t = W.tiles[Math.floor(rand(0, N))].pos; P.set([t.x + rand(-40, 40), t.y + rand(-12, 40), t.z + rand(-40, 40)], i * 3); spd[i] = rand(.8, 2.4); }
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: .85, map: bubbleTex(), transparent: true, depthWrite: false, opacity: .85 })); pts.frustumCulled = false; scene.add(pts);
    W.bubbles = { P, spd, n, geo };
  }
  {
    const n = 900, P = new Float32Array(n * 3), geo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(P, 3));
    for (let i = 0; i < n; i++) { const t = W.tiles[Math.floor(rand(0, N))].pos; P.set([t.x + rand(-35, 35), t.y + rand(-14, 24), t.z + rand(-35, 35)], i * 3); }
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: .22, color: 0xe8fff8, map: glowSprite().material.map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .8 })); pts.frustumCulled = false; scene.add(pts); W.plankton = { P, n, geo };
  }
  const rayTex = canvasTex(64, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); const m = g.createLinearGradient(0, 0, w, 0); m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(.5, 'rgba(0,0,0,0)'); m.addColorStop(1, 'rgba(0,0,0,1)'); g.globalCompositeOperation = 'destination-out'; g.fillStyle = m; g.fillRect(0, 0, w, h); });
  W.rays = [];
  for (let i = 0; i < 34; i++) {
    const t = W.tiles[Math.floor(rand(0, N))].pos, m = new THREE.Mesh(new THREE.PlaneGeometry(rand(6, 13), 70), new THREE.MeshBasicMaterial({ map: rayTex, transparent: true, opacity: .16, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, color: 0xbfffee }));
    m.position.set(t.x + rand(-45, 45), t.y + 24, t.z + rand(-45, 45)); m.rotation.set(0, rand(0, 3.14), .22); m.userData.ph = rand(0, 6); scene.add(m); W.rays.push(m);
  }

  // ---------------------------------------------------------------- the mermaid palace, terrace and thrones
  {
    const g = new THREE.Group(); g.position.set(palaceXZ.x, heightAt(palaceXZ.x, palaceXZ.z), palaceXZ.z); g.rotation.y = Math.atan2(-endT.x, -endT.z); g.scale.setScalar(1.35); scene.add(g);
    const pearl = toon(0xfff3fb, { clearcoat: 1 });
    g.add(mk(cyl(15, 17, 2.2, 36), 0xf6c8e0, [0, 1, 0]), mk(sph(9, 32, 20), pearl, [0, 7, 0], [1, .85, 1]));
    [[-11, -3, 0xff9ecb, 20], [11, -3, 0x8fe3f0, 20], [-8, 7, 0xc9a8ff, 17], [8, 7, 0xffe08a, 17], [0, -5, 0xff8fd0, 27]].forEach(([x, z, c, h]) => {
      g.add(mk(cyl(2.4, 2.8, h, 20), 0xfff0f8, [x, h / 2, z]), mk(new THREE.ConeGeometry(3.2, 7, 20), c, [x, h + 3.2, z]), mk(sph(.6), 0xffffff, [x, h + 7.4, z]));
      for (let k = 0; k < 4; k++) g.add(mk(new THREE.TorusGeometry(2.45 - k * .02, .14, 8, 22), c, [x, 2 + k * h / 4.4, z]).rotateX(Math.PI / 2));
      g.add(mk(new THREE.BoxGeometry(.9, 1.7, .3), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff0a0).multiplyScalar(1.5) }), [x, h * .6, z + 2.5]));
    });
    g.add(mk(new THREE.BoxGeometry(6.4, 6, .6), 0x6a3a8a, [0, 3.2, 8.6]), mk(sph(3.2), 0x6a3a8a, [0, 6.2, 8.6], [1, 1, .18]));
    const doorGlow = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 5.4), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffe8a0).multiplyScalar(1.4), transparent: true, opacity: .75 })); doorGlow.position.set(0, 3, 8.95); g.add(doorGlow);
    for (let k = 0; k < 18; k++) { const a = (k / 18) * Math.PI * 2; g.add(mk(sph(1.6 + (k % 3) * .4, 12, 8), pick(CORAL), [Math.sin(a) * 16, 1.6, Math.cos(a) * 16])); }
    const gl = glowSprite(0xfff0c0, 50, .35); gl.position.set(0, 18, 4); g.add(gl); W.palaceGlow = gl;
    W.palace = g;
  }
  {
    const tc = endP.clone().add(new THREE.Vector3(endT.x * 11, 0, endT.z * 11)); W.terrace = tc;
    const g = new THREE.Group(); g.position.set(tc.x, tc.y - .5, tc.z); scene.add(g);
    g.add(mk(cyl(11, 11.6, .8, 40), 0xffe9f6, [0, 0, 0]), mk(cyl(10, 10, .84, 40), 0xe86a9a, [0, .02, 0]), mk(cyl(7.6, 7.6, .88, 40), 0xffd84d, [0, .04, 0]));
    g.add(mk(cyl(8, 11, Math.max(2, tc.y - heightAt(tc.x, tc.z)), 24), 0xf6c8e0, [0, -Math.max(2, tc.y - heightAt(tc.x, tc.z)) / 2, 0]));
    const sd = new THREE.Vector3(endT.z, 0, -endT.x);
    const throne = (side) => {
      const t = new THREE.Group(); t.position.copy(tc).addScaledVector(endT, 5.2).addScaledVector(sd, side * 3.6); t.position.y = tc.y + .3; t.rotation.y = Math.atan2(-endT.x, -endT.z); scene.add(t);
      const shell = toon(0xffc8e0, { clearcoat: 1 });
      for (let k = 0; k < 9; k++) { const a = (k / 8 - .5) * 2.4, w = mk(new THREE.ConeGeometry(.75, 4.2, 6), k % 2 ? 0xffb0d0 : 0xffd8ea, [Math.sin(a) * 2.2, 2.6 + Math.cos(a) * .6, -1.1 - Math.abs(a) * .2], [1, 1, .5]); w.rotation.z = -a * .9; t.add(w); }
      t.add(mk(cyl(1.7, 2.1, .7, 16), 0xffd84d, [0, .3, 0]), mk(sph(1.4, 16, 10), toon(0xb07cff, { clearcoat: 1 }), [0, 1, 0], [1.2, .5, 1]));
      return t;
    };
    W.thrones = [throne(-1), throne(1)];
    W.kingSpot = W.thrones[0].position.clone().add(new THREE.Vector3(0, 2.2, 0)); W.queenSpot = W.thrones[1].position.clone().add(new THREE.Vector3(0, 2.2, 0));
  }
  W.endSpot = endP.clone().add(new THREE.Vector3(endT.x * 7, 1.8, endT.z * 7));
  W.endT = endT;

  W.update = (dt, t) => {
    TIME.value = t;
    W.tiles.forEach((tt) => { tt.group.position.y += Math.sin(t * 1.3 + tt.bob) * .004; });
    W.hearts.forEach((s) => { if (!s.taken) { s.mesh.rotation.y = t * 1.6 + s.tile; s.mesh.position.y = s.y0 + Math.sin(t * 2 + s.tile) * .35; } });
    W.animated.forEach((f) => f(t));
    W.dolphins.forEach((o, i) => { const a = t * o.sp + o.ph, r = o.R; const x = o.cx + Math.cos(a) * r, z = o.cz + Math.sin(a) * r, y = o.cy + Math.sin(t * .6 + i) * 4; const dir = Math.sign(o.sp); o.d.root.position.set(x, y, z); o.d.root.rotation.y = Math.atan2(-Math.sin(a) * dir, Math.cos(a) * dir); o.d.root.rotation.x = Math.cos(t * .6 + i) * .18; o.d.update(t, 1); });
    W.jellies.forEach((j) => { const u = j.userData; const p = .8 + Math.sin(t * 2 + u.ph) * .2; u.dome.scale.set(1 / Math.sqrt(p), p, 1 / Math.sqrt(p)); j.position.y = u.baseY + Math.sin(t * .6 + u.ph) * 1.5 + Math.sin(t * 2 + u.ph) * .25; u.tents.forEach((tg, k) => { tg.rotation.z = Math.sin(t * 1.6 + k + u.ph) * .25; tg.rotation.x = Math.cos(t * 1.4 + k * 1.3) * .25; }); });
    const B = W.bubbles; for (let i = 0; i < B.n; i++) { B.P[i * 3 + 1] += B.spd[i] * dt; B.P[i * 3] += Math.sin(t + i) * dt * .3; if (B.P[i * 3 + 1] > 60) B.P[i * 3 + 1] = -8; } B.geo.attributes.position.needsUpdate = true;
    const Pl = W.plankton; for (let i = 0; i < Pl.n; i++) { Pl.P[i * 3] += Math.sin(t * .4 + i) * dt * .5; Pl.P[i * 3 + 1] += Math.cos(t * .3 + i * 1.3) * dt * .3; } Pl.geo.attributes.position.needsUpdate = true;
    W.rays.forEach((m) => { m.material.opacity = .13 + Math.sin(t * .5 + m.userData.ph) * .06; m.position.x += Math.sin(t * .1 + m.userData.ph) * dt * .5; });
    if (W.palaceGlow) W.palaceGlow.material.opacity = .3 + Math.sin(t * 2) * .1;
  };
  setStyle('toon');
  return W;
}
