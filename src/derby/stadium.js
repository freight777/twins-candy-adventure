import * as THREE from 'three';
import { canvasTex, glowSprite, rand, lerp, clamp } from '../util.js';

const mat = (o) => new THREE.MeshStandardMaterial({ roughness: .9, ...o });
const { sin, cos, PI } = Math;
const rad = (d) => d * PI / 180;

// ---------------------------------------------------------------- the shape of the park
// Distance from home plate to the outfield wall by angle off dead center (degrees). The foul poles sit at +-45 degrees.
// (The field is built at about 1 unit = 1.1 m, so 113 units is a 408 ft center field.)
const WALL_PTS = [[-80, 66], [-72, 70], [-60, 77], [-45, 88], [-22, 111], [0, 113], [22, 107], [45, 88], [60, 77], [72, 70], [80, 66]];
const catmull = (p0, p1, p2, p3, t) => .5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
export function wallR(th) {
  const d = clamp(th * 180 / PI, -80, 80); let i = 0; while (i < WALL_PTS.length - 2 && d > WALL_PTS[i + 1][0]) i++;
  const [a, ra] = WALL_PTS[i], [b, rb] = WALL_PTS[i + 1], t = (d - a) / (b - a);
  return catmull(WALL_PTS[Math.max(i - 1, 0)][1], ra, rb, WALL_PTS[Math.min(i + 2, WALL_PTS.length - 1)][1], t);
}
const TH0 = -1.38, TH1 = 1.38, SEC = .12, PITCH = 1.3, EYE = .17;           // stands cover this arc; aisles every SEC radians; seats are PITCH apart; the batter's eye is +-EYE wide
// three decks of stepped seating: radial offset from the wall, height of the first row, rows, row depth, row rise, shade (upper decks sit under the roof), how full
const TIERS = [
  { off: 4, y0: 8.7, rows: 20, depth: 1.25, rise: .72, shade: 1, fill: .92 },
  { off: 34, y0: 29, rows: 20, depth: 1.25, rise: .76, shade: .9, fill: .88 },
  { off: 64, y0: 49, rows: 24, depth: 1.25, rise: .82, shade: .74, fill: .8 },
];
const P3 = (th, r, y) => new THREE.Vector3(sin(th) * r, y, -cos(th) * r);

/** a ribbon along the park's curve: rowFn(th) gives [r, y, v] points across the ribbon; u is the angle. Faces the field unless `flip`. */
function ribbon(th0, th1, n, rowFn, flip = false) {
  const pos = [], uv = [], idx = [], k = rowFn(th0).length;
  for (let j = 0; j <= n; j++) { const th = lerp(th0, th1, j / n); rowFn(th).forEach(([r, y, v]) => { pos.push(sin(th) * r, y, -cos(th) * r); uv.push(th, v); }); }
  for (let j = 0; j < n; j++) for (let i = 0; i < k - 1; i++) { const a = j * k + i, b = a + 1, c = a + k, d = c + 1; if (flip) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/** A big-league ballpark in a realistic style (generic design, no team logos). Home plate is the origin; the mound is toward -Z. */
export function buildStadium(scene, T = {}) {
  const S = { cheering: 0, wallR: wallR(0) };

  // ---- sky: photographic gradient, haze at the horizon, soft thin clouds ----
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 40, 20), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `varying vec3 vP; void main(){ vec3 d = normalize(vP); float h = clamp(d.y, 0., 1.);
      vec3 c = mix(vec3(.86,.90,.95), vec3(.20,.42,.82), pow(h,.5)); c = mix(c, vec3(.96,.88,.78), pow(1.-h, 6.)*.6);
      vec3 s = normalize(vec3(.45,.32,-.8)); float sd = max(dot(d,s),0.); c += vec3(1.,.82,.55)*(pow(sd,400.)*3. + pow(sd,18.)*.45);
      gl_FragColor = vec4(c,1.); }`,
  }));
  scene.add(sky); S.sky = sky;
  // night sky: deep blue with a warm city glow on the horizon and a few stars
  const skyNight = new THREE.Mesh(new THREE.SphereGeometry(880, 40, 20), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `varying vec3 vP; float h21(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
      void main(){ vec3 d = normalize(vP); float h = clamp(d.y, 0., 1.);
      vec3 c = mix(vec3(.36,.40,.56), vec3(.07,.1,.24), pow(h, .5)); c += vec3(.3,.2,.12) * pow(1. - h, 7.);
      vec2 g = vec2(atan(d.x, d.z) * 220., d.y * 220.), fc = fract(g) - .5; float st = step(.994, h21(floor(g))) * smoothstep(.36, .0, length(fc)) * smoothstep(.12, .35, h); c += st * vec3(.8, .85, 1.) * (.35 + .65 * h21(floor(g) + 3.));
      gl_FragColor = vec4(c, 1.); }`,
  }));
  skyNight.visible = false; scene.add(skyNight); S.skyNight = skyNight;
  // the city beyond the park at night: a dark skyline with lit windows all the way round (seen when the camera looks back toward home), plus dark ground to fill the horizon
  const skyline = new THREE.Mesh(new THREE.CylinderGeometry(640, 640, 150, 120, 1, true), new THREE.MeshBasicMaterial({
    side: THREE.BackSide, fog: false, transparent: true, depthWrite: false,
    map: canvasTex(4096, 256, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      let x = 0; while (x < w) {
        const bw = 40 + Math.random() * 120, bh = 40 + Math.random() * 170 * (.45 + .55 * Math.random()), by = h - bh, shade = 8 + Math.random() * 10;
        g.fillStyle = `rgb(${shade},${shade + 3},${shade + 10})`; g.fillRect(x, by, bw, bh);
        for (let wy = by + 8; wy < h - 6; wy += 11) for (let wx = x + 6; wx < x + bw - 8; wx += 9) if (Math.random() < .34) { g.fillStyle = Math.random() < .8 ? 'rgba(255,214,140,.75)' : 'rgba(190,220,255,.7)'; g.fillRect(wx, wy, 4, 5); }
        if (Math.random() < .18) { g.fillStyle = '#ff3a3a'; g.fillRect(x + bw / 2, by - 8, 3, 8); }
        x += bw + Math.random() * 14;
      }
      const gr = g.createLinearGradient(0, h - 70, 0, h); gr.addColorStop(0, 'rgba(40,30,28,0)'); gr.addColorStop(1, 'rgba(40,30,28,.5)'); g.fillStyle = gr; g.fillRect(0, h - 70, w, 70);
    }, [1, 1]),
  }));
  skyline.position.y = 62; skyline.visible = false; skyline.renderOrder = -1; scene.add(skyline); S.skyline = skyline;
  const darkGround = new THREE.Mesh(new THREE.CircleGeometry(900, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x07090d, fog: false })); darkGround.position.y = -.6; scene.add(darkGround); S.darkGround = darkGround;
  const cloudTex = canvasTex(256, 128, (g, w, h) => { for (let i = 0; i < 40; i++) { const x = 40 + Math.random() * 176, y = 40 + Math.random() * 48, r = 20 + Math.random() * 34, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); } });
  S.clouds = [];
  for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(rand(160, 300), rand(50, 90)), new THREE.MeshBasicMaterial({ map: cloudTex, transparent: true, depthWrite: false, fog: false, opacity: rand(.6, .95) })); m.position.set(rand(-380, 380), rand(110, 220), rand(-420, -150)); m.rotation.x = -.35; scene.add(m); S.clouds.push(m); }

  // ---- ground: mowed grass, raked dirt, warning track, chalk ----
  const noise = (g, w, h, n, a) => { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * a})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); g.fillStyle = `rgba(255,255,255,${Math.random() * a * .6})`; g.fillRect(Math.random() * w, Math.random() * h, 1, 3); } };
  const grassTex = canvasTex(512, 512, (g, w, h) => { const bands = 8; for (let i = 0; i < bands; i++) { g.fillStyle = i % 2 ? '#2f6e32' : '#3b8038'; g.fillRect(0, i * (h / bands), w, h / bands + 1); } noise(g, w, h, 14000, .12); }, [1, 16]);
  grassTex.anisotropy = 8;
  // photographic PBR surfaces (ambientCG, CC0): colour + normal + roughness maps, tiled
  const DIRT_TINT = 0xb9825c;
  const pbr = (t, rx, ry, extra = {}) => { const set = (x) => { const c = x.clone(); c.wrapS = c.wrapT = THREE.RepeatWrapping; c.repeat.set(rx, ry); c.anisotropy = 8; c.needsUpdate = true; return c; }; return new THREE.MeshStandardMaterial({ map: set(t.c), normalMap: set(t.n), roughnessMap: set(t.r), roughness: 1, ...extra }); };
  const mow = (m) => {          // mowing stripes: alternate bands of lighter and darker turf
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix*vec4(transformed,1.)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= mix(.78, 1.08, step(.5, fract(vWP.z/9.)));');
    };
    m.customProgramCacheKey = () => 'mow'; return m;
  };
  const grassMat = T.grass ? mow(pbr(T.grass, 150, 150, { color: 0xe4f2d0 })) : null;
  S.grassMat = grassMat;
  const grass = new THREE.Mesh(new THREE.CircleGeometry(230, 64).rotateX(-Math.PI / 2), grassMat || mat({ map: grassTex })); grass.position.set(0, -.02, -60); grass.receiveShadow = true; scene.add(grass);
  const dirtTex = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#b57b4a'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(80,40,10,.18)'; g.lineWidth = 2; for (let y = 0; y < h; y += 9) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y + Math.random() * 4); g.stroke(); } noise(g, w, h, 6000, .25); }, [6, 6]);
  const soft = new THREE.Vector2(.75, .75);                       // gentler pebbles: infield clay is fine-grained
  const dirt = T.dirt ? pbr(T.dirt, 7, 7, { color: DIRT_TINT, normalScale: soft }) : mat({ map: dirtTex, roughness: 1 });
  // infield: bases at the corners of a 90-ft diamond. Dirt base paths form the diamond's edges, the inside is grass,
  // and there is dirt around home, the mound and each base (second base sits in the dirt too).
  const dirtShapeTex = dirtTex.clone(); dirtShapeTex.repeat.set(1 / 7, 1 / 7); dirtShapeTex.needsUpdate = true;
  const dirtFlat = T.dirt ? pbr(T.dirt, .38, .38, { color: DIRT_TINT, normalScale: soft }) : mat({ map: dirtShapeTex, roughness: 1 });
  const dirtBase = T.dirt ? pbr(T.dirt, 3.4, 3.4, { color: DIRT_TINT, normalScale: soft }) : dirtFlat;
  const diamond = (half, cs) => { const pts = [[0, cs - half], [half, cs], [0, cs + half], [-half, cs]]; const sh = new THREE.Shape(); pts.forEach(([x, y], i) => sh[i ? 'lineTo' : 'moveTo'](x, y)); sh.closePath(); return sh; };
  const ringShape = diamond(19 + 4.4, 19); ringShape.holes.push(diamond(19 - 5, 19));
  const ring = new THREE.Mesh(new THREE.ShapeGeometry(ringShape).rotateX(-Math.PI / 2), dirtFlat); ring.position.y = .015; ring.receiveShadow = true; scene.add(ring);
  [[19, -19], [0, -38], [-19, -19]].forEach(([x, z]) => { const c = new THREE.Mesh(new THREE.CircleGeometry(4.6, 36).rotateX(-Math.PI / 2), dirtBase); c.position.set(x, .016, z); c.receiveShadow = true; scene.add(c); });
  const home = new THREE.Mesh(new THREE.CircleGeometry(9, 40).rotateX(-Math.PI / 2), dirt); home.position.set(0, .02, -.3); home.receiveShadow = true; scene.add(home);
  // warning track: a band of dirt that follows the wall all the way around
  const trackMat = T.dirt ? pbr(T.dirt, 40, 3, { color: 0xa87650 }) : mat({ color: 0x9a5f3a });
  const track = new THREE.Mesh(ribbon(TH0, TH1, 160, (th) => [[wallR(th) - 8.5, .02, 0], [wallR(th) + .01, .02, 1]]), trackMat); track.receiveShadow = true; scene.add(track);
  // wear on the clay: packed dark patches, footprints in the batter's boxes, scuffs on the chalk and a stride hole in front of the rubber (a transparent decal over the dirt)
  {
    const SZ = 1024, SCALE = 40 / SZ;                                    // 40 units wide, centred on the plate
    const wear = canvasTex(SZ, SZ, (g) => {
      g.clearRect(0, 0, SZ, SZ);
      const P = (x, z) => [SZ / 2 + x / SCALE, SZ / 2 + (z + .3) / SCALE];                 // world -> canvas (z up the field is -)
      for (let i = 0; i < 260; i++) { const [px, py] = [Math.random() * SZ, Math.random() * SZ], r = 14 + Math.random() * 46, gr = g.createRadialGradient(px, py, 0, px, py, r); const dark = Math.random() < .6; gr.addColorStop(0, dark ? 'rgba(70,38,20,.16)' : 'rgba(255,220,180,.10)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.arc(px, py, r, 0, 7); g.fill(); }   // mottling so the tiles never repeat
      [-1, 1].forEach((s) => {                                                              // batter's boxes: packed, darker clay and a few footprints
        const [bx, by] = P(s * 3.2, 0), bw = 3.3 / SCALE, bh = 6.2 / SCALE, gr = g.createRadialGradient(bx, by, 10, bx, by, bh * .7); gr.addColorStop(0, 'rgba(60,32,18,.42)'); gr.addColorStop(1, 'rgba(60,32,18,0)'); g.fillStyle = gr; g.fillRect(bx - bw * 1.3, by - bh * .85, bw * 2.6, bh * 1.7);
        for (let i = 0; i < 7; i++) { const fx = bx + (Math.random() - .5) * bw * .8, fy = by + (Math.random() - .5) * bh * .8; g.save(); g.translate(fx, fy); g.rotate((Math.random() - .5) * 1.2 + (s > 0 ? 0 : Math.PI) + Math.PI / 2); g.fillStyle = 'rgba(40,20,10,.2)'; g.beginPath(); g.ellipse(0, 0, 6, 15, 0, 0, 7); g.fill(); g.restore(); }
      });
      { const [px, py] = P(0, 0), gr = g.createRadialGradient(px, py, 8, px, py, 150); gr.addColorStop(0, 'rgba(50,28,16,.38)'); gr.addColorStop(1, 'rgba(50,28,16,0)'); g.fillStyle = gr; g.beginPath(); g.arc(px, py, 150, 0, 7); g.fill(); }   // trampled around the plate
      for (let i = 0; i < 36; i++) { const s = Math.random() < .5 ? -1 : 1, [lx, ly] = P(s * (3.2 + (Math.random() - .5) * 3.3), (Math.random() - .5) * 6.2); g.fillStyle = `rgba(255,255,250,${.025 + Math.random() * .05})`; g.beginPath(); g.ellipse(lx, ly, 5 + Math.random() * 16, 2 + Math.random() * 4, Math.random() * 3, 0, 7); g.fill(); }   // chalk scuffs in the boxes
    });
    wear.wrapS = wear.wrapT = THREE.ClampToEdgeWrapping; wear.repeat.set(1, 1);
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(40, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: wear, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, fog: true }));
    decal.position.set(0, .03, -.3); decal.renderOrder = 0; scene.add(decal); S.wear = decal;
    const moundWear = canvasTex(256, 256, (g, w, h) => { g.clearRect(0, 0, w, h); let gr = g.createRadialGradient(w / 2, h * .62, 6, w / 2, h * .62, 80); gr.addColorStop(0, 'rgba(45,24,12,.5)'); gr.addColorStop(1, 'rgba(45,24,12,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); gr = g.createRadialGradient(w / 2, h * .36, 4, w / 2, h * .36, 46); gr.addColorStop(0, 'rgba(255,225,190,.22)'); gr.addColorStop(1, 'rgba(255,225,190,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
    const md = new THREE.Mesh(new THREE.PlaneGeometry(8, 8).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: moundWear, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })); md.position.set(0, .71, -15.8); scene.add(md);
  }
  const mound = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 5, .7, 32), dirt); mound.position.set(0, .35, -16.5); mound.receiveShadow = true; scene.add(mound);
  const rubber = new THREE.Mesh(new THREE.BoxGeometry(1.8, .1, .4), mat({ color: 0xf2f2f2 })); rubber.position.set(0, .75, -16.5); scene.add(rubber);
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, .1, 5), mat({ color: 0xf4f4f4, roughness: .6 })); plate.position.set(0, .07, 0); scene.add(plate);
  [[19, -19], [0, -38], [-19, -19]].forEach(([x, z]) => { const b = new THREE.Mesh(new THREE.BoxGeometry(1.6, .22, 1.6), mat({ color: 0xf4f4f4 })); b.position.set(x, .12, z); b.castShadow = true; scene.add(b); });
  const chalk = mat({ color: 0xf2f2ee, roughness: 1 });                    // lit, so it catches the sun like real chalk instead of glowing
  const poleR = wallR(rad(45));
  [-1, 1].forEach((s) => { const l = new THREE.Mesh(new THREE.PlaneGeometry(.35, poleR).rotateX(-Math.PI / 2), chalk); l.position.set(s * poleR * .3536, .06, -poleR * .3536); l.rotation.y = -s * Math.PI / 4; scene.add(l); });
  [-1, 1].forEach((s) => { const cx = s * 3.2, w = 3.3, d = 6.2, t = .14; [[0, -d / 2, w, t], [0, d / 2, w, t], [-w / 2, 0, t, d], [w / 2, 0, t, d]].forEach(([x, z, sx, sz]) => { const e = new THREE.Mesh(new THREE.PlaneGeometry(sx, sz).rotateX(-Math.PI / 2), chalk); e.position.set(cx + x, .05, z); scene.add(e); }); });
  S.zones = {};
  [-1, 1].forEach((s) => { const r = new THREE.Mesh(new THREE.RingGeometry(.42, .6, 30).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })); r.position.set(s * .8, .11, -.4); scene.add(r); S.zones[s] = r; });

  // ---- outfield wall: navy padding, painted distances, a yellow top line, foul poles ----
  const WH = 8;
  const wallTex = canvasTex(256, 128, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#1a2c52'); gr.addColorStop(.85, '#13213f'); gr.addColorStop(1, '#0d172c'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, 0, 3, h); g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(3, 0, 2, h);                // padding panel seams
    for (let i = 0; i < 600; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * .03})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    g.fillStyle = '#e8c020'; g.fillRect(0, 0, w, 5);                                                                                        // yellow top line
  }, [1, 1]);
  wallTex.repeat.set(wallR(0) * (TH1 - TH0) / 12, 1);
  const wall = new THREE.Mesh(ribbon(TH0, TH1, 160, (th) => [[wallR(th), 0, 0], [wallR(th), WH, 1]]), mat({ map: wallTex, side: THREE.DoubleSide, roughness: .55 })); scene.add(wall);
  const ledge = new THREE.Mesh(ribbon(TH0, TH1, 160, (th) => [[wallR(th) - .5, WH, 0], [wallR(th) + .2, WH + .05, 1]]), mat({ color: 0xe8c020, roughness: .5, side: THREE.DoubleSide })); scene.add(ledge);
  // painted distances (feet) at the poles and in the alleys
  [[-45, '318'], [-22, '399'], [0, '408'], [22, '385'], [45, '314']].forEach(([deg, txt]) => {
    const th = rad(deg), tex = canvasTex(256, 160, (g, w, h) => { g.fillStyle = '#f2f2ee'; g.font = '800 120px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, w / 2, h / 2 + 6); });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(9.6, 6), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.position.copy(P3(th, wallR(th) - .15, 3.8)); m.lookAt(0, 3.8, 0); scene.add(m);
  });
  // a few sponsor boards on the wall (generic names, muted colours so they sit quietly behind the action)
  [[-1.15, 'ICE POPS', '#1b2a4d', '#ffd24d'], [-.95, 'CITY BANK', '#e9e9e4', '#14234a'], [-.58, 'SPEED TIRES', '#222a3a', '#ffffff'], [-.19, 'SLUGGER SNACKS', '#14234a', '#ffffff'],
    [.19, 'BIG DOG HOT DOGS', '#7a1c24', '#ffffff'], [.58, 'DERBY DAY', '#14234a', '#ffd24d'], [.95, 'HOME RUN JUICE', '#222a3a', '#ffffff'], [1.15, 'PLAY BALL', '#e9e9e4', '#14234a']].forEach(([th, txt, bg, fg]) => {
    const tex = canvasTex(512, 104, (g, w, h) => { g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 4; g.strokeRect(6, 6, w - 12, h - 12); g.fillStyle = fg; g.font = '800 54px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, w / 2, h / 2 + 3, w - 40); });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(18.5, 3.76), new THREE.MeshStandardMaterial({ map: tex, roughness: .6, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.position.copy(P3(th, wallR(th) - .12, 4.3)); m.lookAt(0, 4.3, 0); scene.add(m);
  });
  [-1, 1].forEach((s) => { const th = s * rad(45), pole = new THREE.Mesh(new THREE.CylinderGeometry(.22, .22, 32, 10), mat({ color: 0xe8c020 })); pole.position.copy(P3(th, wallR(th), 16)); scene.add(pole); });
  // batter's eye: the big dark screen behind center field so hitters can see the ball
  const eyeW = 2 * wallR(0) * sin(EYE), eye = new THREE.Mesh(new THREE.BoxGeometry(eyeW, 27, 5), mat({ color: 0x0b0d12, roughness: .7 })); eye.position.set(0, 13.5, -wallR(0) - 3.2); scene.add(eye);
  const louverTex = canvasTex(128, 256, (g, w, h) => {              // dark panelled screen: faint vertical seams, a slightly lighter top where the lights reach it
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#171b24'); gr.addColorStop(.5, '#0d1016'); gr.addColorStop(1, '#07080b'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(0, 0, 2, h); g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(2, 0, 3, h);
    for (let y = 40; y < h; y += 48) { g.fillStyle = 'rgba(255,255,255,.035)'; g.fillRect(0, y, w, 2); }
  }, [eyeW / 4, 1]);
  const eyeFace = new THREE.Mesh(new THREE.PlaneGeometry(eyeW, 27), mat({ map: louverTex, roughness: .55, metalness: .15 })); eyeFace.position.set(0, 13.5, -wallR(0) - .65); scene.add(eyeFace);
  const eyeTop = new THREE.Mesh(new THREE.BoxGeometry(eyeW + 1.4, .9, 5.8), mat({ color: 0x2a2f3a, roughness: .6 })); eyeTop.position.set(0, 27.3, -wallR(0) - 3.2); scene.add(eyeTop);

  // ---- the stands: three stepped decks (seat backs and aisles drawn in the shader), concrete, a roof with a white frieze ----
  const concrete = T.conc ? pbr(T.conc, 40, 2, { color: 0x8c909b, side: THREE.DoubleSide }) : mat({ color: 0x70737b, side: THREE.DoubleSide });
  const treadMat = T.conc ? pbr(T.conc, 1, 1, { color: 0x70747e }) : mat({ color: 0x70737b });
  const seatMat = (shade) => {
    const m = mat({ roughness: .78, side: THREE.DoubleSide, color: 0xffffff });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uShade = { value: shade };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 aRow; varying vec2 vRow; varying vec2 vSeatUv;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvRow = aRow; vSeatUv = uv;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        uniform float uShade; varying vec2 vRow; varying vec2 vSeatUv;
        float h21(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }`).replace('#include <color_fragment>', `#include <color_fragment>
        {
          float sec = vSeatUv.x / ${SEC.toFixed(3)}, f = fract(sec), aw = clamp(1.25 / (${SEC.toFixed(3)} * vRow.x), .02, .3), isAisle = step(f, aw);
          float n = max(1., floor(${SEC.toFixed(3)} * vRow.x * (1. - aw) / ${PITCH.toFixed(2)})), s = (f - aw) / (1. - aw) * n, cell = floor(s); vec2 q = vec2(fract(s), vSeatUv.y);
          vec2 d = abs(q - vec2(.5, .5)) - vec2(.34, .36) + .14; float sd = length(max(d, 0.)) - .14, aa = max(fwidth(sd), .02);
          float seat = 1. - smoothstep(-aa, aa, sd), rnd = h21(vec2(cell, vRow.y + floor(sec) * 7.));
          vec3 seatC = vec3(.05, .085, .19) * (.75 + .5 * rnd) * (1. + .5 * smoothstep(.55, .95, q.y) * seat);
          vec3 gapC = vec3(.025, .03, .045), conc = vec3(.33, .34, .37) * (.9 + .2 * h21(vec2(vRow.y, 3.)));
          diffuseColor.rgb = mix(mix(gapC, seatC, seat), conc, isAisle) * uShade;
        }`);
    };
    m.customProgramCacheKey = () => 'seats'; return m;
  };
  /** every seat-row of a deck as one riser mesh (the vertical seat backs) and one tread mesh (the steps) */
  const terrace = (Tr, ranges) => {
    const rPos = [], rNrm = [], rUv = [], rRow = [], rIdx = [], tPos = [], tNrm = [], tUv = [], tIdx = [];
    for (const [a, b] of ranges) {
      const n = Math.max(2, Math.round((b - a) / (TH1 - TH0) * 170));
      for (let i = 0; i < Tr.rows; i++) {
        const hTop = Tr.y0 + i * Tr.rise, rb = rPos.length / 3, tb = tPos.length / 3;
        for (let j = 0; j <= n; j++) {
          const th = lerp(a, b, j / n), r0 = wallR(th) + Tr.off + i * Tr.depth, s = sin(th), c = -cos(th);
          rPos.push(s * r0, hTop - Tr.rise, c * r0, s * r0, hTop, c * r0); rNrm.push(-s, 0, -c, -s, 0, -c); rUv.push(th, 0, th, 1); rRow.push(r0, i, r0, i);
          tPos.push(s * r0, hTop, c * r0, s * (r0 + Tr.depth), hTop, c * (r0 + Tr.depth)); tNrm.push(0, 1, 0, 0, 1, 0); tUv.push(th * 20, 0, th * 20, .18);
        }
        for (let j = 0; j < n; j++) { const ra = rb + j * 2, ta = tb + j * 2; rIdx.push(ra, ra + 2, ra + 1, ra + 1, ra + 2, ra + 3); tIdx.push(ta, ta + 2, ta + 1, ta + 1, ta + 2, ta + 3); }
      }
    }
    const mk = (pos, nrm, uv, idx, row) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); if (row) g.setAttribute('aRow', new THREE.Float32BufferAttribute(row, 2)); g.setIndex(idx); return g; };
    return { risers: mk(rPos, rNrm, rUv, rIdx, rRow), treads: mk(tPos, tNrm, tUv, tIdx) };
  };
  const arcs = [[[TH0, -EYE], [EYE, TH1]], [[TH0, TH1]], [[TH0, TH1]]];                 // the lowest deck leaves a gap for the batter's eye
  TIERS.forEach((Tr, k) => {
    const { risers, treads } = terrace(Tr, arcs[k]);
    scene.add(new THREE.Mesh(risers, seatMat(Tr.shade)), new THREE.Mesh(treads, treadMat));
  });
  // concrete fascias between the decks, club windows, and the roof with its frieze
  const topY = (Tr) => Tr.y0 + (Tr.rows - 1) * Tr.rise, fas = (r, y0, y1) => new THREE.Mesh(ribbon(TH0, TH1, 170, (th) => [[wallR(th) + r, y0, 0], [wallR(th) + r, y1, 1]]), concrete);
  scene.add(fas(TIERS[1].off - .5, topY(TIERS[0]), TIERS[1].y0 - .6), fas(TIERS[2].off - .5, topY(TIERS[1]), TIERS[2].y0 - .6));
  const glass = mat({ color: 0x0a1220, roughness: .12, metalness: .6, envMapIntensity: 1.2 });
  scene.add(new THREE.Mesh(ribbon(TH0, TH1, 170, (th) => [[wallR(th) + TIERS[1].off - .6, topY(TIERS[0]) + 1.2, 0], [wallR(th) + TIERS[1].off - .6, TIERS[1].y0 - 2.8, 1]]), glass));
  const roofY = 84, roofR = TIERS[2].off + 30;
  const roof = new THREE.Mesh(ribbon(TH0, TH1, 140, (th) => [[wallR(th) + TIERS[2].off - 2, roofY, 0], [wallR(th) + roofR + 8, roofY - 8, 1]], true), mat({ color: 0x1c1f27, roughness: .8, side: THREE.DoubleSide })); scene.add(roof);
  const back = new THREE.Mesh(ribbon(TH0, TH1, 140, (th) => [[wallR(th) + roofR + 3.6, topY(TIERS[2]), 0], [wallR(th) + roofR + 3.6, roofY - 5, 1]], false), mat({ color: 0x23262e, side: THREE.DoubleSide })); scene.add(back);
  // the white frieze: a lattice of arches hanging from the roof edge (cut-outs so the sky shows through)
  const frTex = canvasTex(512, 128, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#ecebe4'; g.fillRect(0, 0, w, 26); for (let x = 0; x < w; x += 64) { g.fillStyle = '#ecebe4'; g.fillRect(x, 26, 64, h - 26); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.moveTo(x + 10, h); g.lineTo(x + 10, 70); g.arc(x + 32, 70, 22, Math.PI, 0); g.lineTo(x + 54, h); g.closePath(); g.fill(); g.globalCompositeOperation = 'source-over'; } }, [1, 1]);
  frTex.repeat.set((wallR(0) + TIERS[2].off) * (TH1 - TH0) / 48, 1);
  const frieze = new THREE.Mesh(ribbon(TH0, TH1, 170, (th) => [[wallR(th) + TIERS[2].off - 2.2, roofY - 8, 0], [wallR(th) + TIERS[2].off - 2.2, roofY + 1.2, 1]]), new THREE.MeshStandardMaterial({ map: frTex, alphaTest: .5, side: THREE.DoubleSide, roughness: .6 })); scene.add(frieze);

  // ---- LED ribbon boards along the fascias, a big video board, and lamp banks on the roof ----
  const ledC = document.createElement('canvas'); ledC.width = 2048; ledC.height = 64; const ledT = new THREE.CanvasTexture(ledC); ledT.colorSpace = THREE.SRGBColorSpace; ledT.wrapS = THREE.RepeatWrapping; ledT.repeat.set(6.5, 1);
  { const g = ledC.getContext('2d'); g.fillStyle = '#05070c'; g.fillRect(0, 0, 2048, 64); g.font = '800 46px Arial, sans-serif'; g.textBaseline = 'middle'; const msg = ['HOME RUN DERBY', '★', "TONY'S BIG DAY", '★', 'SWING AWAY!', '★', 'GO FOR THE FENCES', '★']; let x = 20; msg.forEach((t, i) => { g.fillStyle = i % 2 ? '#ffb030' : '#ffffff'; g.fillText(t, x, 34); x += g.measureText(t).width + 56; }); ledT.needsUpdate = true; }
  const ledM = new THREE.MeshBasicMaterial({ map: ledT, color: new THREE.Color(1.6, 1.6, 1.6), fog: false });
  scene.add(new THREE.Mesh(ribbon(TH0, TH1, 170, (th) => [[wallR(th) + TIERS[1].off - .75, TIERS[1].y0 - 2.7, 0], [wallR(th) + TIERS[1].off - .75, TIERS[1].y0 - .7, 1]]), ledM));
  scene.add(new THREE.Mesh(ribbon(TH0, TH1, 170, (th) => [[wallR(th) + TIERS[2].off - .75, TIERS[2].y0 - 2.7, 0], [wallR(th) + TIERS[2].off - .75, TIERS[2].y0 - .7, 1]]), ledM));
  S.led = ledT;
  const lampM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff2d0).multiplyScalar(1.6), fog: false }), glows = [];
  for (let i = 0; i < 9; i++) {
    const th = lerp(-1.1, 1.1, i / 8), bank = new THREE.Group(); bank.position.copy(P3(th, wallR(th) + TIERS[2].off - 1, roofY + 4)); bank.lookAt(0, roofY - 6, 0); scene.add(bank);
    bank.add(new THREE.Mesh(new THREE.BoxGeometry(24, 8.5, 1.4), mat({ color: 0x30343d })));
    for (let a = 0; a < 8; a++) for (let b = 0; b < 3; b++) { const lamp = new THREE.Mesh(new THREE.CircleGeometry(1.2, 12), lampM); lamp.position.set(-10.5 + a * 3, -2.6 + b * 2.7, .75); bank.add(lamp); }
    const gl = glowSprite(0xfff0c8, 46, .2); gl.position.copy(bank.position); scene.add(gl); glows.push(gl);
  }
  // flags waving on the roof edge (navy pennants with a white star; the cloth ripples in the vertex shader)
  const FU = { time: { value: 0 } };
  const flagTex = canvasTex(256, 150, (g, w, h) => { g.fillStyle = '#14234a'; g.fillRect(0, 0, w, h); g.fillStyle = '#f2f2ee'; g.fillRect(0, h - 22, w, 10); g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 22 : 50; g.lineTo(w / 2 + Math.cos(a) * r, h / 2 - 8 + Math.sin(a) * r); } g.closePath(); g.fill(); });
  const flagMat = new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide, roughness: .85 });
  flagMat.onBeforeCompile = (sh) => {
    sh.uniforms.uFlagT = FU.time;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uFlagT;').replace('#include <begin_vertex>', '#include <begin_vertex>\nfloat fk = (position.x + 4.) / 8.; transformed.z += sin(position.x * 1.1 - uFlagT * 4.2 + position.y * .6) * 1.1 * fk; transformed.y += sin(position.x * .8 - uFlagT * 3.1) * .25 * fk;');
  };
  flagMat.customProgramCacheKey = () => 'flag';
  for (let i = 0; i < 13; i++) {
    const th = lerp(-1.25, 1.25, i / 12), base = P3(th, wallR(th) + TIERS[2].off - 1.5, roofY + 1);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.14, .2, 15, 8), mat({ color: 0xd8dae0, metalness: .4 })); pole.position.copy(base); pole.position.y += 7.5; scene.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(8, 4.8, 14, 4), flagMat); flag.position.copy(base); flag.position.y += 12.4;
    flag.lookAt(0, flag.position.y, 0); flag.translateX(4.2); scene.add(flag);
  }
  // the video board (it shows the score); mounted on the upper-deck fascia right of center
  const sbC = document.createElement('canvas'); sbC.width = 1280; sbC.height = 720; const sbT = new THREE.CanvasTexture(sbC); sbT.colorSpace = THREE.SRGBColorSpace; sbT.anisotropy = 4;
  const bth = .3, bw = 44, bh = 24.75, boardPos = P3(bth, wallR(bth) + TIERS[2].off - 4, 58);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), new THREE.MeshBasicMaterial({ map: sbT, color: new THREE.Color(1.15, 1.15, 1.15), fog: false })); board.position.copy(boardPos); board.lookAt(0, 58, 0); scene.add(board);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(bw + 3, bh + 3, 2), mat({ color: 0x1b2230, metalness: .3 })); frame.position.copy(boardPos); frame.lookAt(0, 58, 0); frame.translateZ(-1.3); scene.add(frame);
  S.setScore = (hr, outs, name) => {
    const g = sbC.getContext('2d'), W = 1280, H = 720; g.fillStyle = '#04070d'; g.fillRect(0, 0, W, H);
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0b1a3a'); bg.addColorStop(1, '#030610'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 6) { g.fillStyle = 'rgba(255,255,255,.025)'; g.fillRect(0, y, W, 2); }
    g.fillStyle = '#e8334a'; g.fillRect(0, 0, W, 18); g.fillStyle = '#14234a'; g.fillRect(0, H - 18, W, 18);
    g.textAlign = 'center'; g.fillStyle = '#ffb030'; g.font = '800 92px Arial, sans-serif'; g.fillText('HOME RUN DERBY', W / 2, 150);
    g.fillStyle = '#f2f2f2'; g.font = '700 68px Arial, sans-serif'; g.fillText(((name || 'Tony') + "'S").toUpperCase(), W / 2, 240);
    g.fillStyle = '#5dff7a'; g.font = '800 250px "Courier New", monospace'; g.fillText(String(hr), 340, 520); g.fillStyle = '#9fb0d8'; g.font = '700 54px Arial, sans-serif'; g.fillText('HOME RUNS', 340, 600);
    for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(800 + i * 120, 470, 44, 0, 7); g.fillStyle = i < outs ? '#ff3a4a' : 'rgba(255,255,255,.08)'; g.fill(); g.lineWidth = 6; g.strokeStyle = '#ff3a4a'; g.stroke(); }
    g.fillStyle = '#9fb0d8'; g.font = '700 54px Arial, sans-serif'; g.fillText('OUTS', 920, 600); sbT.needsUpdate = true;
  };
  S.setScore(0, 0);
  /** flash a big message on the video board for a few seconds (then the score comes back) */
  let boardFlash = null, lastScore = [0, 0, 'Tony'];
  const setScoreBase = S.setScore; S.setScore = (hr, outs, name) => { lastScore = [hr, outs, name]; if (!boardFlash) setScoreBase(hr, outs, name); };
  S.celebrate = (text, sub, sec = 4) => { boardFlash = { text, sub, t: sec, k: 0 }; };
  const drawFlash = (inv) => {
    const g = sbC.getContext('2d'), W = 1280, H = 720; g.fillStyle = inv ? '#ffd24d' : '#0b1a3a'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 18; i++) { g.save(); g.translate(W / 2, H / 2); g.rotate(i * Math.PI / 9); g.fillStyle = inv ? 'rgba(255,255,255,.35)' : 'rgba(255,210,77,.12)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(W, -60); g.lineTo(W, 60); g.closePath(); g.fill(); g.restore(); }
    g.textAlign = 'center'; g.lineJoin = 'round'; g.font = '800 170px Arial, sans-serif'; g.lineWidth = 18; g.strokeStyle = inv ? '#14234a' : '#000'; g.strokeText(boardFlash.text, W / 2, H / 2 + 20); g.fillStyle = inv ? '#e8334a' : '#ffd24d'; g.fillText(boardFlash.text, W / 2, H / 2 + 20);
    g.font = '800 80px Arial, sans-serif'; g.lineWidth = 10; g.strokeStyle = '#14234a'; g.strokeText(boardFlash.sub, W / 2, H / 2 + 140); g.fillStyle = '#fff'; g.fillText(boardFlash.sub, W / 2, H / 2 + 140); sbT.needsUpdate = true;
  };

  // ---- the crowd: painted fans (skin tones, hair, caps, shirts; about a third cheering) seated in the rows as camera-facing cutouts ----
  const CW = 96, CH = 128, COLS = 8, ROWS = 6;
  const crowdTex = canvasTex(CW * COLS, CH * ROWS, (g) => {
    const skins = ['#f3d2b4', '#e6b88f', '#cf9a6d', '#a8734a', '#7a4f33', '#5a3a28'], hairs = ['#1e130b', '#3b2616', '#6b4423', '#b78a42', '#d8c08a', '#8e8e90', '#0e0e10'];
    const shirts = ['#14234a', '#14234a', '#14234a', '#1c2f5e', '#f2f2f2', '#f2f2f2', '#e4e4e0', '#9aa0ac', '#6d7482', '#b02030', '#2a4a9a', '#33343c', '#c8b090'], caps = ['#14234a', '#14234a', '#14234a', '#f2f2f2', '#b02030', '#33343c'];
    const pick1 = (arr) => arr[Math.floor(Math.random() * arr.length)];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const x0 = c * CW, y0 = r * CH, cx = x0 + CW / 2, skin = pick1(skins), hair = pick1(hairs), shirt = pick1(shirts), cheer = Math.random() < .3, hasCap = Math.random() < .45, capC = pick1(caps), tilt = (Math.random() - .5) * .14;
      g.save(); g.translate(cx, y0 + CH); g.rotate(tilt); g.translate(-cx, -(y0 + CH));
      if (cheer) { g.strokeStyle = shirt; g.lineWidth = 13; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx + 24, y0 + CH - 26); g.lineTo(cx + 34, y0 + 34); g.stroke(); g.fillStyle = skin; g.beginPath(); g.arc(cx + 34, y0 + 28, 8.5, 0, 7); g.fill(); }
      g.beginPath(); g.moveTo(x0 + 5, y0 + CH); g.quadraticCurveTo(x0 + 7, y0 + 72, cx - 20, y0 + 64); g.lineTo(cx + 20, y0 + 64); g.quadraticCurveTo(x0 + CW - 7, y0 + 72, x0 + CW - 5, y0 + CH); g.closePath();
      g.fillStyle = shirt; g.fill(); const sh = g.createLinearGradient(0, y0 + 60, 0, y0 + CH); sh.addColorStop(0, 'rgba(255,255,255,.12)'); sh.addColorStop(1, 'rgba(0,0,0,.4)'); g.fillStyle = sh; g.fill();
      g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 1.5; g.stroke();
      g.fillStyle = skin; g.fillRect(cx - 7, y0 + 54, 14, 14); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(cx - 7, y0 + 54, 14, 5);
      const hg = g.createRadialGradient(cx - 5, y0 + 34, 4, cx, y0 + 40, 22); hg.addColorStop(0, skin); hg.addColorStop(1, 'rgba(0,0,0,.35)');
      g.beginPath(); g.ellipse(cx, y0 + 40, 17, 20, 0, 0, 7); g.fillStyle = skin; g.fill(); g.fillStyle = hg; g.globalAlpha = .55; g.fill(); g.globalAlpha = 1; g.strokeStyle = 'rgba(0,0,0,.25)'; g.stroke();
      if (hasCap) { g.fillStyle = capC; g.beginPath(); g.ellipse(cx, y0 + 30, 19, 16, 0, Math.PI, 0); g.fill(); g.beginPath(); g.ellipse(cx + 9, y0 + 31, 15, 4.5, 0, 0, 7); g.fill(); }
      else { g.fillStyle = hair; g.beginPath(); g.ellipse(cx, y0 + 31, 18, 15, 0, Math.PI, 0); g.fill(); if (Math.random() < .4) { g.fillRect(cx - 18, y0 + 31, 6, 24); g.fillRect(cx + 12, y0 + 31, 6, 24); } }
      g.fillStyle = '#1a1210'; g.beginPath(); g.arc(cx - 6, y0 + 42, 1.8, 0, 7); g.arc(cx + 6, y0 + 42, 1.8, 0, 7); g.fill();
      g.strokeStyle = '#4a1a14'; g.lineWidth = 1.6; g.beginPath(); if (cheer) { g.fillStyle = '#4a1a14'; g.ellipse(cx, y0 + 51, 5, 3.4, 0, 0, 7); g.fill(); } else { g.moveTo(cx - 4, y0 + 51); g.quadraticCurveTo(cx, y0 + 53, cx + 4, y0 + 51); g.stroke(); }
      g.restore();
    }
  });
  crowdTex.anisotropy = 4;
  // one fan for every occupied seat: seats are laid out exactly like the seat shader does (sections, aisles, PITCH-wide seats)
  const spots = [];
  TIERS.forEach((Tr, k) => {
    for (let i = 0; i < Tr.rows; i++) {
      for (let sec = Math.floor(TH0 / SEC); sec <= Math.ceil(TH1 / SEC); sec++) {
        const thm = (sec + .5) * SEC; if (thm < TH0 || thm > TH1) continue; if (k === 0 && Math.abs(thm) < EYE + .03) continue;
        const r0m = wallR(thm) + Tr.off + i * Tr.depth, aw = clamp(1.25 / (SEC * r0m), .02, .3), n = Math.max(1, Math.floor(SEC * r0m * (1 - aw) / PITCH));
        for (let c = 0; c < n; c++) {
          if (Math.random() > Tr.fill * (.92 + .08 * Math.sin(sec * 1.7 + i * .3))) continue;
          const th = (sec + aw + ((c + .5) / n) * (1 - aw)) * SEC; if (th < TH0 || th > TH1) continue;
          spots.push({ th, r: wallR(th) + Tr.off + i * Tr.depth + Tr.depth * .62, y: Tr.y0 + i * Tr.rise - .38, k, i });
        }
      }
    }
  });
  for (let i = spots.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [spots[i], spots[j]] = [spots[j], spots[i]]; }      // shuffled, so thinning the crowd thins it evenly
  const FAN = spots.length, fanGeo = new THREE.PlaneGeometry(1, 1).translate(0, .5, 0), cells = new Float32Array(FAN * 2), phs = new Float32Array(FAN);
  const U = { cheer: { value: 0 }, time: { value: 0 } };
  const crowdMat = new THREE.MeshBasicMaterial({ map: crowdTex, alphaTest: .45, side: THREE.DoubleSide });
  crowdMat.onBeforeCompile = (sh) => {
    sh.uniforms.uCheer = U.cheer; sh.uniforms.uTime = U.time;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 aCell; attribute float aPh; uniform float uCheer, uTime;')
      .replace('#include <uv_vertex>', `#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv = uv * vec2(${(1 / COLS).toFixed(4)}, ${(1 / ROWS).toFixed(4)}) + aCell;\n#endif`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nfloat hop = abs(sin(uTime * 9. + aPh * 6.2831)) * uCheer, fid = step(.9, fract(aPh * 13.7)) * max(0., sin(uTime * 2.1 + aPh * 91.)) * .12;\ntransformed.y = transformed.y * (1. + .2 * uCheer * step(.4, fract(aPh * 7.31))) + hop * .5 + fid;');
  };
  crowdMat.customProgramCacheKey = () => 'crowd2';
  const fans = new THREE.InstancedMesh(fanGeo, crowdMat, FAN), d = new THREE.Object3D(), col = new THREE.Color();
  fanGeo.setAttribute('aCell', new THREE.InstancedBufferAttribute(cells, 2)); fanGeo.setAttribute('aPh', new THREE.InstancedBufferAttribute(phs, 1));
  S.fans = [];
  spots.forEach((p, i) => {
    const x = sin(p.th) * p.r, z = -cos(p.th) * p.r, w = rand(1.15, 1.5), hgt = w * (CH / CW) * rand(.95, 1.05), ry = Math.atan2(-x, -z);
    d.position.set(x, p.y, z); d.rotation.set(0, ry, 0); d.scale.set(w, hgt, 1); d.updateMatrix(); fans.setMatrixAt(i, d.matrix);
    const cx = Math.floor(Math.random() * COLS), cy = Math.floor(Math.random() * ROWS); cells[i * 2] = cx / COLS; cells[i * 2 + 1] = 1 - (cy + 1) / ROWS; phs[i] = Math.random();
    const tone = TIERS[p.k].shade * rand(.8, 1.0); col.setRGB(tone, tone, tone); fans.setColorAt(i, col);
    if (i < 400) S.fans.push({ x, y: p.y, z });
  });
  fans.instanceColor.needsUpdate = true; fans.frustumCulled = false; scene.add(fans); S.fanMesh = fans; S.fanTotal = FAN;
  S.setDensity = (f) => { fans.count = Math.max(1, Math.floor(FAN * clamp(f, .1, 1))); };
  S.flashes = []; for (let i = 0; i < 80; i++) { const sp = glowSprite(0xffffff, 3, 0); const f = S.fans[Math.floor(Math.random() * S.fans.length)]; sp.position.set(f.x, f.y + 1, f.z); scene.add(sp); S.flashes.push({ sp, t: rand(0, 6) }); }

  // ---- lighting: low warm afternoon sun, soft sky fill, long shadows ----
  const hemi = new THREE.HemisphereLight(0xbcd4ff, 0x4a5a3a, T.hdr ? .25 : .7); scene.add(hemi);
  const sunI = T.hdr ? 2.4 : 3.0, sun = new THREE.DirectionalLight(0xffe2b8, sunI); sun.position.set(34, 38, 26); sun.castShadow = true;
  const c = sun.shadow.camera; c.left = c.bottom = -30; c.right = c.top = 30; c.near = 1; c.far = 150; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -.0004; sun.shadow.normalBias = .04; sun.shadow.radius = 2;
  sun.target.position.set(0, 0, -10); scene.add(sun, sun.target); S.sun = sun;
  // night game: stadium lights. The two key lights sit up behind the plate (so the players are lit from the camera side, with shadows),
  // a wide one washes the outfield, and a dim one from the center-field roof puts a rim of light on the players.
  const litSpots = [];
  [
    { p: [-62, 88, 96], t: [0, 0, -8], a: .3, pen: .6, i: 30000, shadow: true },
    { p: [62, 88, 96], t: [0, 0, -8], a: .3, pen: .6, i: 30000, shadow: true },
    { p: [0, 110, 120], t: [0, 0, -62], a: .8, pen: .8, i: 85000 },
    { p: [0, 92, -170], t: [0, 0, -4], a: .22, pen: .7, i: 25000 },
  ].forEach((L) => {
    const sp = new THREE.SpotLight(0xfff1d8, L.i, 0, L.a, L.pen, 2); sp.position.set(...L.p); sp.target.position.set(...L.t); sp.visible = false;
    if (L.shadow) { sp.castShadow = true; sp.shadow.mapSize.set(2048, 2048); sp.shadow.camera.near = 60; sp.shadow.camera.far = 320; sp.shadow.bias = -.0003; sp.shadow.normalBias = .04; }
    scene.add(sp, sp.target); litSpots.push(sp);
  });
  S.litSpots = litSpots; S.mode = 'day';
  /** shadow quality by graphics tier: the day sun, and the night key lights (one on medium, both on high) */
  S.setShadows = (tier) => { sun.castShadow = tier !== 'low'; litSpots.forEach((sp, i) => { if (i < 2) sp.castShadow = tier === 'high' || (tier === 'medium' && i === 0); }); };
  S.setMode = (mode, hasHdr = T.hdr) => {
    const night = mode === 'night'; S.mode = mode;
    hemi.color.set(night ? 0x4a5f9a : 0xbcd4ff); hemi.groundColor.set(night ? 0x151a26 : 0x4a5a3a); hemi.intensity = night ? .65 : (hasHdr ? .25 : .7); sun.intensity = hasHdr ? 2.4 : 3.0;
    sun.visible = !night; litSpots.forEach((sp) => (sp.visible = night));
    skyNight.visible = night; skyline.visible = night; darkGround.visible = night;
    if (S.grassMat) { S.grassMat.emissive.set(night ? 0x2a6a2c : 0x000000); S.grassMat.emissiveIntensity = night ? .22 : 0; }       // the turf glows a little under the lights without brightening the players sky.visible = !night && !hasHdr;
    lampM.color.copy(new THREE.Color(0xfff2d0)).multiplyScalar(night ? 5 : 1.6); glows.forEach((g) => (g.material.opacity = night ? .55 : .2));
    ledM.color.setScalar(night ? 2.2 : 1.4); board.material.color.setScalar(night ? 1.5 : 1.1);
    crowdMat.color.setScalar(night ? .72 : 1); S.clouds.forEach((m) => (m.visible = !night && !hasHdr));
  };

  S.update = (dt, t) => {
    S.clouds.forEach((m) => { m.position.x += dt * .8; if (m.position.x > 400) m.position.x = -400; });
    const nFlash = S.mode === 'night' ? 80 : 28;                       // more cameras popping at a night game
    S.flashes.forEach((f, i) => { if (i >= nFlash) { f.sp.material.opacity = 0; return; } f.t -= dt; f.sp.material.opacity = f.t < .12 && f.t > 0 ? .95 : 0; if (f.t < -rand(1, 5)) f.t = rand(.5, 4); });
    S.cheering = Math.max(0, S.cheering - dt); U.cheer.value = Math.min(1, S.cheering); U.time.value = t; FU.time.value = t;
    ledT.offset.x = (t * .02) % 1;
    if (boardFlash) { boardFlash.t -= dt; boardFlash.k -= dt; if (boardFlash.t <= 0) { boardFlash = null; setScoreBase(...lastScore); } else if (boardFlash.k <= 0) { boardFlash.k = .22; boardFlash.inv = !boardFlash.inv; drawFlash(boardFlash.inv); } }
  };
  S.cheer = (sec = 3) => { S.cheering = sec; };
  /** a point on the seats (lower or middle deck) in the direction `ang` (radians off center field) */
  S.landing = (ang) => {
    const k = Math.random() < .65 ? 0 : 1, Tr = TIERS[k], i = Math.floor(rand(3, Tr.rows - 3)); let th = ang; if (k === 0 && Math.abs(th) < EYE + .05) th = th < 0 ? -EYE - .06 : EYE + .06;
    return P3(th, wallR(th) + Tr.off + i * Tr.depth + Tr.depth * .6, Tr.y0 + i * Tr.rise + .6);
  };
  return S;
}
