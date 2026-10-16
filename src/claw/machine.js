// The claw machine and the arcade around it, built at real size (metres): a lacquered cabinet with chrome trim, glass you
// can see the room reflected in, a lit marquee with chasing bulbs, a printed backdrop, the prize chute behind its acrylic
// guard, the gantry rails, and the claw itself (a chrome solenoid housing with three hooked prongs and an LED ring that
// shines where it will land). Lighting is an "arcade room" made into a reflection map, a shadow-casting light in the
// machine's roof, an LED bar along the front, and the neon of the machines next door.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** the inside of the machine (metres). The prize chute is the front-left corner, behind a low acrylic guard. */
export const DIM = {
  W: .43, D: .375, H: .97,
  chute: { x0: -.43, x1: -.155, z0: .095, z1: .375 },
  guardH: .17,
  home: { x: -.292, z: .236 },
  top: .735,                                  // the claw hub's height when it is all the way up
  bounds: { x0: -.355, x1: .355, z0: -.29, z1: .285 },
};
/** the claw is modelled at 1:1 and scaled: s, the cap's height above the hub, the prongs' reach below it and how far out the open tips are */
export const CLAW = { s: 1.25, cap: .094 * 1.25, reach: .1 * 1.25, hub: .045 * 1.25, tipR: .052 * 1.25, len: .135 * 1.25 };
export const THEME_LOOK = {
  unicorn: { paint: 0xe58fc4, paint2: 0x8f6ad8, floor: 0x5a2f6e, sign: 'UNICORN', signCol: ['#ff8fd8', '#c9a2ff'], led: 0xffd6f0 },
  mermaid: { paint: 0x2fb9c9, paint2: 0x2f6fd0, floor: 0x123f5e, sign: 'MERMAID', signCol: ['#6ff3ff', '#8fb4ff'], led: 0xd6fbff },
};

function canvas(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; }
function tex(c, { srgb = true, repeat = null } = {}) {
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}
const rnd = (a, b) => a + Math.random() * (b - a);

// ---------------------------------------------------------------- printed and painted surfaces
function backdropCanvas(theme) {
  return canvas(1024, 1024, (g, w, h) => {
    if (theme === 'unicorn') {
      const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#8fb6ff'); sky.addColorStop(.5, '#e8c8ff'); sky.addColorStop(1, '#ffd6ea'); g.fillStyle = sky; g.fillRect(0, 0, w, h);
      const cols = ['#ff7b8a', '#ffb070', '#ffe27a', '#8fe39a', '#7cc4ff', '#b79cff'];
      cols.forEach((c, i) => { g.strokeStyle = c; g.globalAlpha = .75; g.lineWidth = 46; g.beginPath(); g.arc(w / 2, h * .95, 440 - i * 44, Math.PI, 0); g.stroke(); });
      g.globalAlpha = 1;
      const cloud = (x, y, s) => { g.fillStyle = '#fff'; [[0, 0, 1], [-.9, .25, .7], [.9, .2, .75], [-.35, -.35, .7], [.4, -.3, .65]].forEach(([dx, dy, r]) => { g.beginPath(); g.arc(x + dx * s, y + dy * s, r * s, 0, 7); g.fill(); }); };
      cloud(200, 800, 70); cloud(830, 790, 80); cloud(520, 900, 90); cloud(150, 260, 40); cloud(860, 200, 46);
      for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(255,255,255,${rnd(.4, .95)})`; const x = rnd(0, w), y = rnd(0, h * .7), r = rnd(2, 6); g.beginPath(); g.moveTo(x, y - r * 2.4); g.lineTo(x + r * .5, y - r * .5); g.lineTo(x + r * 2.4, y); g.lineTo(x + r * .5, y + r * .5); g.lineTo(x, y + r * 2.4); g.lineTo(x - r * .5, y + r * .5); g.lineTo(x - r * 2.4, y); g.lineTo(x - r * .5, y - r * .5); g.fill(); }
    } else {
      const sea = g.createLinearGradient(0, 0, 0, h); sea.addColorStop(0, '#5fd4ff'); sea.addColorStop(.55, '#1f7fc0'); sea.addColorStop(1, '#0d3f74'); g.fillStyle = sea; g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 9; i++) { const x = rnd(0, w), gr = g.createLinearGradient(x, 0, x + 120, h); gr.addColorStop(0, 'rgba(255,255,255,.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(x - 30, 0); g.lineTo(x + 40, 0); g.lineTo(x + 260, h); g.lineTo(x + 120, h); g.fill(); }
      g.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 16; i++) { const x = rnd(0, w), hh = rnd(200, 460); g.strokeStyle = ['#2fae7a', '#3cc48a', '#1f8f6a'][i % 3]; g.lineWidth = rnd(14, 26); g.lineCap = 'round'; g.beginPath(); g.moveTo(x, h); for (let k = 1; k <= 8; k++) g.lineTo(x + Math.sin(k * 1.3 + i) * 26, h - hh * k / 8); g.stroke(); }
      for (let i = 0; i < 7; i++) { const x = rnd(0, w), r = rnd(40, 90); g.fillStyle = ['#ff7fa8', '#ffa36b', '#c58bff'][i % 3]; g.beginPath(); g.ellipse(x, h - r * .4, r, r * .7, 0, Math.PI, 0); g.fill(); }
      for (let i = 0; i < 60; i++) { const x = rnd(0, w), y = rnd(0, h), r = rnd(4, 16); g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2.5; g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke(); g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.arc(x - r * .35, y - r * .35, r * .25, 0, 7); g.fill(); }
    }
    // a printed panel: a little paper grain and a soft hot spot from the light above
    const v = g.createRadialGradient(w / 2, 0, 50, w / 2, h * .3, w); v.addColorStop(0, 'rgba(255,255,255,.05)'); v.addColorStop(1, 'rgba(0,0,0,.3)'); g.fillStyle = v; g.fillRect(0, 0, w, h);
  });
}
function signCanvas(look) {
  return canvas(1024, 256, (g, w, h) => {
    g.fillStyle = '#0a0612'; g.fillRect(0, 0, w, h);
    const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, look.signCol[0]); gr.addColorStop(1, look.signCol[1]);
    g.font = '700 120px Fredoka, "Arial Rounded MT Bold", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const [blur, a] of [[40, .9], [18, 1], [6, 1]]) { g.shadowColor = look.signCol[0]; g.shadowBlur = blur; g.globalAlpha = a; g.fillStyle = gr; g.fillText(`${look.sign} CLAW`, w / 2, h / 2 + 6); }
    g.shadowBlur = 0; g.globalAlpha = 1; g.fillStyle = 'rgba(255,255,255,.85)'; g.font = '700 116px Fredoka, "Arial Rounded MT Bold", sans-serif'; g.fillText(`${look.sign} CLAW`, w / 2, h / 2 + 6);
  });
}
function carpetCanvas() {
  return canvas(512, 512, (g, w, h) => {
    g.fillStyle = '#0d0b24'; g.fillRect(0, 0, w, h);
    const cols = ['#ff3fa4', '#2ee6ff', '#ffd23f', '#8c5bff', '#46ff8f'];
    for (let i = 0; i < 70; i++) {
      g.strokeStyle = cols[i % cols.length]; g.fillStyle = cols[(i + 2) % cols.length]; g.lineWidth = 5; const x = rnd(0, w), y = rnd(0, h), s = rnd(8, 22);
      const k = i % 4; g.beginPath();
      if (k === 0) { g.arc(x, y, s, 0, 7); g.stroke(); } else if (k === 1) { g.moveTo(x - s, y); for (let j = 0; j < 5; j++) g.lineTo(x - s + j * s / 2, y + (j % 2 ? -s / 2 : s / 2)); g.stroke(); }
      else if (k === 2) { g.arc(x, y, s / 3, 0, 7); g.fill(); } else { g.moveTo(x, y - s); g.lineTo(x + s * .8, y + s * .6); g.lineTo(x - s * .8, y + s * .6); g.closePath(); g.stroke(); }
    }
    const id = g.getImageData(0, 0, w, h), d = id.data; for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - .5) * 26; d[i] += n; d[i + 1] += n; d[i + 2] += n; } g.putImageData(id, 0, 0);
  });
}
/** fingerprints and wipe marks on the glass, as a roughness map (only visible where the glass catches a reflection) */
function smudgeCanvas() {
  return canvas(512, 512, (g, w, h) => {
    g.fillStyle = '#0d0d0d'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) { const x = rnd(0, w), y = rnd(h * .35, h), r = rnd(10, 22); const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(120,120,120,.55)'); gr.addColorStop(1, 'rgba(120,120,120,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, r * .8, r, rnd(-.6, .6), 0, 7); g.fill(); }
    g.strokeStyle = 'rgba(90,90,90,.35)'; for (let i = 0; i < 6; i++) { g.lineWidth = rnd(20, 50); g.beginPath(); const y = rnd(0, h); g.moveTo(0, y); g.bezierCurveTo(w * .3, y + rnd(-60, 60), w * .6, y + rnd(-60, 60), w, y + rnd(-60, 60)); g.stroke(); }
  });
}
function panelCanvas(look) {
  return canvas(1024, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#1a1426'); gr.addColorStop(1, '#0c0912'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = look.signCol[0]; g.lineWidth = 6; g.globalAlpha = .8;
    const ring = (x) => { g.beginPath(); g.arc(x, h / 2, 92, 0, 7); g.stroke(); };
    ring(w * .3); ring(w * .7);
    g.fillStyle = look.signCol[1]; const arrow = (x, y, a) => { g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.moveTo(0, -16); g.lineTo(14, 8); g.lineTo(-14, 8); g.closePath(); g.fill(); g.restore(); };
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; arrow(w * .3 + Math.sin(a) * 112, h / 2 - Math.cos(a) * 112, a); }
    g.globalAlpha = 1;
  });
}
/** the attract screens of the machines next door (always a little out of focus behind the glass) */
function gameScreen(i) {
  return canvas(256, 192, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, i ? '#2a0f3a' : '#061a3a'); gr.addColorStop(1, i ? '#7a1f5a' : '#0d4a7a'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const cols = i ? ['#ffd36e', '#ff6fb5', '#ffffff'] : ['#7ae8ff', '#8cff9a', '#ffffff'];
    for (let k = 0; k < 18; k++) { g.fillStyle = cols[k % 3]; g.globalAlpha = .9; const x = rnd(10, w - 10), y = rnd(10, h - 40); g.fillRect(x, y, rnd(8, 20), rnd(8, 20)); }
    g.globalAlpha = 1; g.fillStyle = cols[0]; g.fillRect(20, h - 26, w - 40, 10);
  });
}
function woodCanvas() {
  return canvas(512, 512, (g, w, h) => {
    g.fillStyle = '#6b3e22'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) { const t = Math.sin(y * .05 + Math.sin(y * .013) * 4) * .5 + .5; g.fillStyle = `rgba(${40 + t * 40},${20 + t * 20},${10},${.25 + t * .2})`; g.fillRect(0, y, w, 2); }
    for (let i = 0; i < 300; i++) { g.fillStyle = 'rgba(30,14,6,.25)'; g.fillRect(rnd(0, w), rnd(0, h), rnd(20, 120), 1); }
  });
}

// ---------------------------------------------------------------- the arcade as a reflection map
function arcadeEnv(renderer) {
  const s = new THREE.Scene(), box = new THREE.Mesh(new THREE.BoxGeometry(12, 5, 12), new THREE.MeshBasicMaterial({ color: 0x0b0a14, side: THREE.BackSide }));
  box.position.y = 1.5; s.add(box);
  const panel = (w, h, col, k, pos, look = [0, 0, 0]) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(k), side: THREE.DoubleSide })); m.position.set(...pos); m.lookAt(...look); s.add(m); };
  panel(1.4, .5, 0xfff2e0, 5, [0, 3.9, 0], [0, 0, 0]);                                    // ceiling lights
  panel(1.2, .4, 0xfff2e0, 3.5, [2.5, 3.9, 2], [2.5, 0, 2]); panel(1.2, .4, 0xfff2e0, 3.5, [-2.5, 3.9, -1.5], [-2.5, 0, -1.5]); panel(1.2, .4, 0xfff2e0, 3, [0, 3.9, 3.5], [0, 0, 3.5]);
  panel(4, .08, 0xff3fa4, 9, [0, 1.6, -5.9]); panel(.08, 3, 0x2ee6ff, 8, [-5.9, 1.5, 0], [0, 1.5, 0]); panel(.08, 3, 0x8c5bff, 8, [5.9, 1.5, 1], [0, 1.5, 1]);   // neon strips on the walls
  panel(2.4, .9, 0xffe8f6, .9, [-1.5, 1.6, 5.9], [0, 1.4, 0]);                              // the arcade behind the player
  panel(1.2, 1.6, 0x3f8cff, 2, [-3, 1.1, 5.5], [0, 1, 0]); panel(1.2, 1.6, 0xff6fb5, 2, [3, 1.1, 5.5], [0, 1, 0]);
  panel(2, .3, 0xffffff, 6, [0, 1.15, .2], [0, 0, .2]);                                    // the machine's own roof light, just above
  // the arcade behind you: a row of machines with glowing screens and marquees, and rows of ceiling lights (the glass shows them)
  const scr = [0x3fd0ff, 0xff5fb0, 0xffd34d, 0x7cff8a, 0xb07cff, 0xff8a3d, 0x4dc3ff];
  for (let i = 0; i < 7; i++) { const x = -4.2 + i * 1.4; panel(.7, .55, scr[i], 2.4, [x, 1.0, 5.8], [x, 1.0, 0]); panel(.8, .16, scr[(i + 3) % 7], 4, [x, 1.75, 5.8], [x, 1.75, 0]); }
  for (const z of [-2.5, 0, 2.5, 4.8]) for (const x of [-3, 0, 3]) panel(.9, .18, 0xfff0e0, 3, [x, 3.95, z], [x, 0, z]);
  const pm = new THREE.PMREMGenerator(renderer), t = pm.fromScene(s, .035).texture; pm.dispose();
  s.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
  return t;
}

// ---------------------------------------------------------------- decorations inside the machine: printed foam-board cut-outs
// standing against the backdrop (white edges, glossy print on the front) and a few things dangling on fishing line
const SHP = {
  circle(r) { const s = new THREE.Shape(); s.absarc(0, 0, r, 0, Math.PI * 2, false); return s; },
  star(ro, ri, n = 5) { const s = new THREE.Shape(); for (let i = 0; i <= n * 2; i++) { const a = Math.PI / 2 + i * Math.PI / n, r = i % 2 ? ri : ro; i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r); } return s; },
  cloud(w) { const s = new THREE.Shape(), k = w / 2; s.moveTo(-k, 0); s.absarc(-k * .55, k * .2, k * .45, Math.PI, Math.PI * .35, true); s.absarc(0, k * .45, k * .55, Math.PI * .85, Math.PI * .15, true); s.absarc(k * .55, k * .2, k * .45, Math.PI * .65, 0, true); s.lineTo(-k, 0); return s; },
  heart(w) { const s = new THREE.Shape(), k = w / 2; s.moveTo(0, -k * .9); s.bezierCurveTo(k * .6, -k * .4, k * 1.1, 0, k, k * .4); s.bezierCurveTo(k * .9, k * .9, k * .3, k, 0, k * .6); s.bezierCurveTo(-k * .3, k, -k * .9, k * .9, -k, k * .4); s.bezierCurveTo(-k * 1.1, 0, -k * .6, -k * .4, 0, -k * .9); return s; },
  arch(r0, r1) { const s = new THREE.Shape(); s.absarc(0, 0, r1, 0, Math.PI, false); s.absarc(0, 0, r0, Math.PI, 0, true); s.closePath(); return s; },
  weed(h, w, seed) { const s = new THREE.Shape(), N = 10, L = [], R = []; for (let i = 0; i <= N; i++) { const t = i / N, x = Math.sin(t * 5 + seed) * w * .8, ww = w * (1 - t * .7); L.push([x - ww / 2, t * h]); R.push([x + ww / 2, t * h]); } s.moveTo(...L[0]); L.forEach((p) => s.lineTo(...p)); s.quadraticCurveTo(L[N][0] + w * .2, h + w * .4, R[N][0], R[N][1]); R.reverse().forEach((p) => s.lineTo(...p)); s.closePath(); return s; },
  coral(h) { const s = new THREE.Shape(), b = (x0, y0, x1, y1, w) => { const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy), nx = -dy / l * w, ny = dx / l * w; const p = new THREE.Path(); return [[x0 + nx, y0 + ny], [x1 + nx * .6, y1 + ny * .6], [x1 - nx * .6, y1 - ny * .6], [x0 - nx, y0 - ny]]; };
    const pts = [[-.02, 0], [-.025, h * .45], [-.11, h * .75], [-.12, h * .9], [-.09, h * .92], [-.01, h * .62], [-.01, h * .98], [.025, h], [.03, h * .6], [.1, h * .82], [.125, h * .8], [.04, h * .4], [.03, 0]];
    s.moveTo(...pts[0]); pts.forEach((p) => s.lineTo(...p)); s.closePath(); void b; return s; },
};
function cutout(shape, color, depth = .008) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: .0015, bevelSize: .0015, bevelSegments: 2, curveSegments: 20 });
  const m = new THREE.Mesh(g, [new THREE.MeshPhysicalMaterial({ color, roughness: .3, clearcoat: .7, clearcoatRoughness: .15 }), new THREE.MeshStandardMaterial({ color: 0xf6f2ee, roughness: .85 })]);
  m.castShadow = m.receiveShadow = true; return m;
}
function buildDecor(theme) {
  const g = new THREE.Group(), sway = [], z = -DIM.D + .012;
  const put = (m, x, y, zz = z, rz = 0) => { m.position.set(x, y, zz); m.rotation.z = rz; g.add(m); return m; };
  const hang = (m, x, y, len) => { const pivot = new THREE.Group(); pivot.position.set(x, DIM.H - .01, z + .02); m.position.y = -len; pivot.add(m);
    const line = new THREE.Mesh(new THREE.CylinderGeometry(.0007, .0007, len, 4).translate(0, -len / 2, 0), new THREE.MeshBasicMaterial({ color: 0xdddddd, transparent: true, opacity: .5 })); pivot.add(line); g.add(pivot); sway.push({ o: pivot, k: Math.random() * 6, a: .07 }); void y; };
  if (theme === 'unicorn') {
    ['#ff8fa8', '#ffc27a', '#fff09a', '#9fe6a8', '#8fcfff'].forEach((c, i) => put(cutout(SHP.arch(.27 - i * .034, .3 - i * .034), c, .006), 0, .02, z + i * .0015));
    put(cutout(SHP.cloud(.2), '#ffffff', .01), -.29, .02, z + .02); put(cutout(SHP.cloud(.22), '#ffffff', .01), .3, .02, z + .02);
    put(cutout(SHP.heart(.09), '#ff7fb0'), -.36, .42, z + .004, .2); put(cutout(SHP.heart(.07), '#c79bff'), .37, .5, z + .004, -.25);
    [[-.24, .19, '#ffd84d'], [.06, .13, '#fff2a0'], [.27, .22, '#ffd84d']].forEach(([x, len, c]) => hang(cutout(SHP.star(.04, .018), c, .006), x, 0, len));
  } else {
    [[-.39, .5, 1], [-.31, .38, 2.4], [.33, .44, 4], [.4, .55, 5.5]].forEach(([x, h, sd]) => sway.push({ o: put(cutout(SHP.weed(h, .045, sd), sd > 3 ? '#3cc48a' : '#2fae7a', .006), x, 0, z + .01), k: sd, a: .04, base: true }));
    put(cutout(SHP.coral(.3), '#ff7f9f'), .2, 0, z + .006); put(cutout(SHP.coral(.24), '#ffa36b'), -.17, 0, z + .006);
    const shell = cutout(SHP.cloud(.16), '#ffc9dd', .01); put(shell, .02, .03, z + .02);
    [[-.22, .2, '#ffb84d'], [.1, .14, '#ff8fb3'], [.28, .24, '#ffd84d']].forEach(([x, len, c]) => hang(cutout(SHP.star(.038, .016), c, .006), x, 0, len));
  }
  g.userData.sway = sway; return g;
}

/**
 * Fewer draw calls: every mesh under root that never moves is baked into one mesh per material (same look, one draw each
 * instead of dozens). Anything under a node in `keep` (the claw, the gantry, the joystick, the flap, the decorations) is left alone.
 */
function mergeStatic(root, keep) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), groups = new Map(), victims = [];
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material) || o.material.transparent) return;
    for (let p = o; p && p !== root; p = p.parent) if (keep.has(p)) return;
    const g = o.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) return;
    if (!groups.has(o.material)) groups.set(o.material, { geos: [], cast: false, recv: false });
    const e = groups.get(o.material); e.geos.push(g); e.cast ||= o.castShadow; e.recv ||= o.receiveShadow; victims.push(o);
  });
  for (const [mat, e] of groups) {
    if (e.geos.length < 2) { e.geos.forEach((g) => g.dispose()); victims.splice(0, victims.length, ...victims.filter((v) => v.material !== mat)); continue; }
    const geos = e.geos.some((g) => !g.index) ? e.geos.map((g) => (g.index ? g.toNonIndexed() : g)) : e.geos;
    const merged = mergeGeometries(geos); if (!merged) continue;
    const m = new THREE.Mesh(merged, mat); m.castShadow = e.cast; m.receiveShadow = e.recv; m.matrixAutoUpdate = false; root.add(m);
    victims.filter((v) => v.material === mat).forEach((v) => { v.parent.remove(v); v.geometry.dispose(); });
  }
}

// ---------------------------------------------------------------- the toy shelf: a wooden bookcase in a corner of the arcade where each girl's toys are kept
export function buildShelf(scene) {
  const g = new THREE.Group(); g.position.set(0, -.92, 4.3); scene.add(g);
  const wood = new THREE.MeshPhysicalMaterial({ map: tex(woodCanvas(), { repeat: [2, 1] }), roughness: .5, clearcoat: .4, clearcoatRoughness: .25 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x3a2418, roughness: .8 });
  const box = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, .008), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m); return m; };
  const W = 1.5, rows = [.06, .4, .74, 1.08], top = 1.42;
  box(W + .08, top + .04, .03, dark, 0, top / 2, -.19);
  for (const s of [-1, 1]) box(.04, top + .04, .4, wood, s * (W / 2 + .02), top / 2, 0);
  for (const y of [...rows.map((r) => r - .02), top]) box(W + .04, .035, .4, wood, 0, y, 0);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(6, 4), new THREE.MeshStandardMaterial({ color: 0x2b1a33, roughness: .95 })); wall.position.set(0, 1.5, -.22); g.add(wall);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(.7, .14), new THREE.MeshBasicMaterial({ transparent: true })); sign.position.set(0, top + .13, -.15); g.add(sign);
  const light = new THREE.SpotLight(0xffe6cc, 0, 4, .62, .7, 1.2); light.position.set(.5, 2.3, 1.7); light.target.position.set(0, .6, 0); g.add(light, light.target);
  const fill = new THREE.PointLight(0xffd9ef, 0, 3, 1.5); fill.position.set(-.6, .8, 1.1); g.add(fill);
  const slots = []; for (let r = rows.length - 1; r >= 0; r--) for (let c = 0; c < 6; c++) slots.push(new THREE.Vector3(-.6 + c * .24, rows[r], .02).add(g.position));
  return {
    group: g, slots, light, fill,
    setName(name, color) {
      const c = canvas(512, 100, (x, w, h) => { x.font = '700 64px Fredoka, "Arial Rounded MT Bold", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.shadowColor = color; x.shadowBlur = 18; x.fillStyle = '#fff'; x.fillText(name, w / 2, h / 2 + 4); });
      sign.material.map?.dispose(); sign.material.map = tex(c); sign.material.needsUpdate = true;
    },
    view: { p: new THREE.Vector3(0, .02, 6.75), l: new THREE.Vector3(0, -.13, 4.3) },
    merge() { mergeStatic(g, new Set([sign])); },
  };
}

// ---------------------------------------------------------------- the machine
export function buildMachine(scene, renderer, theme) {
  RectAreaLightUniformsLib.init();
  const look = { ...THEME_LOOK[theme] }, G = new THREE.Group(); scene.add(G);
  const env = arcadeEnv(renderer);
  const paint = new THREE.MeshPhysicalMaterial({ color: look.paint, metalness: .35, roughness: .32, clearcoat: 1, clearcoatRoughness: .06, iridescence: .25, iridescenceIOR: 1.4 });
  const paint2 = new THREE.MeshPhysicalMaterial({ color: look.paint2, metalness: .35, roughness: .32, clearcoat: 1, clearcoatRoughness: .06 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xf4f6fa, metalness: 1, roughness: .07 });
  const satinMetal = new THREE.MeshStandardMaterial({ color: 0xc9ced6, metalness: 1, roughness: .32 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x2a2c33, metalness: .8, roughness: .45 });
  const blackPlastic = new THREE.MeshPhysicalMaterial({ color: 0x0c0c10, roughness: .42, clearcoat: .5, clearcoatRoughness: .3 });
  const smudge = tex(smudgeCanvas(), { srgb: false });
  // glass: only its reflection is drawn (added on top), so you see straight through it but the room shows in it at an angle
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x000000, roughness: .03, roughnessMap: smudge, metalness: 0, specularIntensity: 1, envMapIntensity: 2.1, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const acrylic = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: .05, transparent: true, opacity: .1, envMapIntensity: 2, depthWrite: false, side: THREE.DoubleSide });
  const rb = (w, h, d, r = .012, seg = 3) => new RoundedBoxGeometry(w, h, d, seg, r);
  const add = (geo, mat, pos, { cast = true, recv = true, parent = G, rot = null } = {}) => { const m = new THREE.Mesh(geo, mat); m.position.set(...pos); if (rot) m.rotation.set(...rot); m.castShadow = cast; m.receiveShadow = recv; parent.add(m); return m; };

  // ---- the cabinet: base, corner posts, roof box, and the trim between them
  const W = .98, D = .84;
  add(rb(W, .92, D, .02), paint, [0, -.47, 0]);                                              // lower cabinet
  add(rb(W + .01, .04, D + .01, .012), chrome, [0, -.005, 0]);                                // chrome band under the glass
  add(rb(W + .02, .05, D + .02, .02), blackPlastic, [0, -.915, 0]);                            // kick plate
  for (const x of [-1, 1]) for (const z of [-1, 1]) add(rb(.05, 1.02, .05, .012), z > 0 ? paint2 : paint, [x * (W / 2 - .025), .5, z * (D / 2 - .025)]);   // posts
  for (const x of [-1, 1]) add(rb(.012, 1.0, .012, .005), chrome, [x * (W / 2 - .052), .5, D / 2 - .006]);   // chrome edge on the front posts
  add(rb(W + .01, .3, D + .01, .02), paint2, [0, 1.15, 0]);                                     // roof box
  add(rb(W + .02, .03, D + .02, .012), chrome, [0, 1.0, 0]);
  add(rb(W + .02, .025, D + .02, .01), chrome, [0, 1.305, 0]);
  // ---- the marquee: a lit sign with a ring of chasing bulbs
  const signTex = tex(signCanvas(look));
  const sign = add(new THREE.PlaneGeometry(.78, .195), new THREE.MeshBasicMaterial({ map: signTex, color: new THREE.Color(2.2, 2.2, 2.2) }), [0, 1.15, D / 2 + .012], { cast: false, recv: false });
  const bulbN = 34, bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(.0085, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 4.2, 3.2) }), bulbN);
  const bulbPos = []; { const w = .84, h = .25; for (let i = 0; i < bulbN; i++) { const t = i / bulbN, per = 2 * (w + h), d = t * per; let x, y; if (d < w) { x = -w / 2 + d; y = h / 2; } else if (d < w + h) { x = w / 2; y = h / 2 - (d - w); } else if (d < 2 * w + h) { x = w / 2 - (d - w - h); y = -h / 2; } else { x = -w / 2; y = -h / 2 + (d - 2 * w - h); } bulbPos.push([x, 1.15 + y, D / 2 + .016]); } }
  const _mm = new THREE.Matrix4(); bulbPos.forEach((p, i) => { bulbs.setMatrixAt(i, _mm.makeTranslation(...p)); bulbs.setColorAt(i, new THREE.Color(1, 1, 1)); });
  G.add(bulbs);
  // ---- inside: the floor the toys lie on (velvet), the printed backdrop, the chute and its guard
  const velvet = new THREE.MeshPhysicalMaterial({ color: look.floor, roughness: .95, sheen: 1, sheenRoughness: .5, sheenColor: new THREE.Color(.5, .4, .6) });
  const floorGeo = mergeGeometries([new THREE.BoxGeometry(2 * DIM.W, .02, DIM.chute.z0 + DIM.D).translate(0, -.01, (DIM.chute.z0 - DIM.D) / 2), new THREE.BoxGeometry(DIM.W - DIM.chute.x1, .02, DIM.D - DIM.chute.z0).translate((DIM.W + DIM.chute.x1) / 2, -.01, (DIM.D + DIM.chute.z0) / 2)]);
  const floor = add(floorGeo, velvet, [0, 0, 0], { cast: false });
  const backTex = tex(backdropCanvas(theme));
  const backMat = new THREE.MeshStandardMaterial({ map: backTex, roughness: .55, emissive: 0xffffff, emissiveMap: backTex, emissiveIntensity: .06 });
  const back = add(new THREE.PlaneGeometry(2 * DIM.W + .02, DIM.H), backMat, [0, DIM.H / 2, -DIM.D - .002], { cast: false });
  let decor = buildDecor(theme); G.add(decor);
  for (const x of [-1, 1]) add(new THREE.PlaneGeometry(2 * DIM.D, DIM.H), glass, [x * (DIM.W + .012), DIM.H / 2, 0], { cast: false, recv: false, rot: [0, Math.PI / 2, 0] });
  const front = add(new THREE.PlaneGeometry(W - .1, 1.0), glass, [0, .5, D / 2 - .012], { cast: false, recv: false }); front.renderOrder = 5;
  // chute: a dark shaft, a chrome lip, a clear guard on its two inner sides
  const cx = (DIM.chute.x0 + DIM.chute.x1) / 2, cz = (DIM.chute.z0 + DIM.chute.z1) / 2, cw = DIM.chute.x1 - DIM.chute.x0, cd = DIM.chute.z1 - DIM.chute.z0;
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(cw, .5, cd), new THREE.MeshStandardMaterial({ color: 0x050407, roughness: .9, side: THREE.BackSide })); shaft.position.set(cx, -.25, cz); G.add(shaft);
  add(rb(cw + .012, .012, .012, .004), chrome, [cx, .003, DIM.chute.z0]); add(rb(.012, .012, cd + .012, .004), chrome, [DIM.chute.x1, .003, cz]);
  const g1 = add(new THREE.PlaneGeometry(cw, DIM.guardH), acrylic, [cx, DIM.guardH / 2, DIM.chute.z0], { cast: false, recv: false }); g1.renderOrder = 4;
  const g2 = add(new THREE.PlaneGeometry(cd, DIM.guardH), acrylic, [DIM.chute.x1, DIM.guardH / 2, cz], { cast: false, recv: false, rot: [0, Math.PI / 2, 0] }); g2.renderOrder = 4;
  add(new THREE.CylinderGeometry(.004, .004, cw, 8).rotateZ(Math.PI / 2), chrome, [cx, DIM.guardH, DIM.chute.z0]);
  add(new THREE.CylinderGeometry(.004, .004, cd, 8).rotateX(Math.PI / 2), chrome, [DIM.chute.x1, DIM.guardH, cz]);
  // ---- the gantry: two rails, a bridge that slides along them, a carriage that slides along the bridge
  for (const x of [-1, 1]) add(rb(.026, .03, 2 * DIM.D, .004), satinMetal, [x * (DIM.W - .01), .935, 0]);
  const bridge = add(rb(2 * DIM.W, .026, .03, .004), satinMetal, [0, .93, 0]);
  const carriage = new THREE.Group(); G.add(carriage);
  add(rb(.075, .045, .075, .008), darkMetal, [0, .9, 0], { parent: carriage });
  add(new THREE.CylinderGeometry(.018, .018, .05, 20).rotateZ(Math.PI / 2), chrome, [0, .9, .05], { parent: carriage });
  add(new THREE.CylinderGeometry(.012, .012, .02, 16), darkMetal, [0, .87, 0], { parent: carriage });
  const cable = add(new THREE.CylinderGeometry(.0022, .0022, 1, 6).translate(0, -.5, 0), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: .6, roughness: .5 }), [0, .865, 0], { parent: carriage });
  // ---- the claw
  const claw = new THREE.Group(); claw.scale.setScalar(CLAW.s); G.add(claw);
  add(new THREE.CylinderGeometry(.02, .027, .018, 28), chrome, [0, .085, 0], { parent: claw });
  add(new THREE.CylinderGeometry(.03, .03, .055, 32), chrome, [0, .05, 0], { parent: claw });
  add(new THREE.TorusGeometry(.031, .004, 8, 32).rotateX(Math.PI / 2), blackPlastic, [0, .035, 0], { parent: claw });
  add(new THREE.CylinderGeometry(.03, .022, .02, 28), chrome, [0, .012, 0], { parent: claw });
  const ledRing = add(new THREE.TorusGeometry(.019, .003, 8, 28).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(look.led).multiplyScalar(4) }), [0, 0, 0], { parent: claw, cast: false });
  const prongGeo = mergeGeometries([
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[0, 0, 0], [.02, -.022, 0], [.04, -.06, 0], [.042, -.095, 0], [.03, -.122, 0], [.012, -.134, 0]].map((p) => new THREE.Vector3(...p))), 24, .0045, 8, false),
    new THREE.SphereGeometry(.0045, 8, 6),
    new THREE.SphereGeometry(.0065, 10, 8).scale(1, .7, 1.3).translate(.012, -.134, 0),
    new THREE.BoxGeometry(.012, .02, .016).translate(.002, -.004, 0),
  ]), prongs = [];
  for (let i = 0; i < 3; i++) {
    const arm = new THREE.Group(); arm.rotation.y = i * Math.PI * 2 / 3 + Math.PI / 2; claw.add(arm);
    const pivot = new THREE.Group(); pivot.position.set(.018, 0, 0); arm.add(pivot);
    add(prongGeo, chrome, [0, 0, 0], { parent: pivot });
    add(new THREE.CylinderGeometry(.002, .002, .05, 6), darkMetal, [.012, .025, 0], { parent: arm, rot: [0, 0, -.5] });   // linkage
    prongs.push(pivot);
  }
  const clawLed = new THREE.SpotLight(look.led, .9, 1.1, .28, .75, 1.4); clawLed.position.set(0, -.01, 0); claw.add(clawLed); claw.add(clawLed.target); clawLed.target.position.set(0, -1, 0);

  // ---- the control panel: a ledge in front with a ball-top joystick and a big lit button
  const ledge = add(rb(W, .07, .24, .015), paint2, [0, -.04, D / 2 + .1]);
  const panelTex = tex(panelCanvas(look));
  add(new THREE.PlaneGeometry(W - .06, .2), new THREE.MeshPhysicalMaterial({ map: panelTex, roughness: .3, clearcoat: 1 }), [0, -.004, D / 2 + .1], { rot: [-Math.PI / 2, 0, 0], cast: false });
  const stick = new THREE.Group(); stick.position.set(-W * .2, -.004, D / 2 + .1); G.add(stick);
  add(new THREE.CylinderGeometry(.024, .03, .008, 24), chrome, [0, .004, 0], { parent: stick });
  const stickTop = new THREE.Group(); stick.add(stickTop);
  add(new THREE.CylinderGeometry(.005, .006, .07, 12), chrome, [0, .035, 0], { parent: stickTop });
  add(new THREE.SphereGeometry(.022, 28, 20), new THREE.MeshPhysicalMaterial({ color: 0xe8203a, roughness: .12, clearcoat: 1 }), [0, .078, 0], { parent: stickTop });
  const button = new THREE.Group(); button.position.set(W * .2, -.004, D / 2 + .1); G.add(button);
  add(new THREE.CylinderGeometry(.042, .046, .01, 32), chrome, [0, .005, 0], { parent: button });
  const btnCap = add(new THREE.CylinderGeometry(.034, .036, .02, 32), new THREE.MeshPhysicalMaterial({ color: 0xff3048, roughness: .18, clearcoat: 1, transmission: 0, emissive: 0xff2040, emissiveIntensity: .6 }), [0, .016, 0], { parent: button });
  // the prize door and coin slot on the lower cabinet
  // the prize door: a chrome-edged opening with a dark pocket behind it and a smoky flap hinged at the top (it swings out
  // when a toy comes through), and a little lamp inside that comes on when a prize arrives
  const doorAt = new THREE.Vector3(-.27, -.46, D / 2);
  add(rb(.24, .2, .02, .01), blackPlastic, [doorAt.x, doorAt.y + .005, D / 2 + .005]);
  add(rb(.21, .155, .006, .004), chrome, [doorAt.x, doorAt.y, D / 2 + .013]);
  const pocket = new THREE.Mesh(new THREE.BoxGeometry(.19, .135, .2), new THREE.MeshStandardMaterial({ color: 0x0c0a10, roughness: .8, side: THREE.BackSide })); pocket.position.set(doorAt.x, doorAt.y, D / 2 - .085); pocket.receiveShadow = true; G.add(pocket);
  const flap = new THREE.Group(); flap.position.set(doorAt.x, doorAt.y + .068, D / 2 + .018); G.add(flap);
  const flapMesh = add(rb(.19, .134, .006, .004).translate(0, -.067, 0), new THREE.MeshPhysicalMaterial({ color: 0x1a1a24, roughness: .15, transparent: true, opacity: .78, clearcoat: 1, depthWrite: false }), [0, 0, 0], { parent: flap, cast: false });
  flapMesh.renderOrder = 6;
  const doorLamp = new THREE.PointLight(0xffe6c8, 0, .5, 1.6); doorLamp.position.set(doorAt.x, doorAt.y + .05, D / 2 - .05); G.add(doorLamp);
  add(rb(.07, .12, .02, .008), chrome, [.27, -.36, D / 2 + .005]);
  add(new THREE.PlaneGeometry(.012, .05), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, .4, .3) }), [.27, -.36, D / 2 + .016], { cast: false });

  // ---- the room: carpet, the machines next door with their glowing screens, a wall with neon
  const carpetTex = tex(carpetCanvas(), { repeat: [6, 6] });
  add(new THREE.PlaneGeometry(8, 8), new THREE.MeshStandardMaterial({ map: carpetTex, roughness: 1 }), [0, -.94, 1], { rot: [-Math.PI / 2, 0, 0], cast: false });
  const neighbours = [];
  for (const [x, col, scr, i] of [[-1.12, 0x232c66, 0x7ae8ff, 0], [1.12, 0x4a1a3e, 0xffd36e, 1]]) {
    const n = new THREE.Group(); n.position.set(x, 0, -.15); G.add(n);
    add(rb(.9, 2.2, .85, .03), new THREE.MeshPhysicalMaterial({ color: col, metalness: .4, roughness: .35, clearcoat: .8 }), [0, .18, 0], { parent: n });
    add(rb(.8, .62, .1, .02), blackPlastic, [0, .55, .43], { parent: n });
    const screen = add(new THREE.PlaneGeometry(.68, .5), new THREE.MeshBasicMaterial({ map: tex(gameScreen(i)), color: new THREE.Color(1, 1, 1) }), [0, .55, .485], { parent: n, cast: false });
    add(new THREE.PlaneGeometry(.78, .16), new THREE.MeshBasicMaterial({ color: new THREE.Color(scr).multiplyScalar(2.2) }), [0, 1.12, .43], { parent: n, cast: false });
    add(rb(.86, .06, .3, .02), new THREE.MeshPhysicalMaterial({ color: col, metalness: .4, roughness: .35, clearcoat: .8 }), [0, -.05, .55], { parent: n });
    neighbours.push(screen);
  }
  add(new THREE.PlaneGeometry(9, 4), new THREE.MeshStandardMaterial({ color: 0x0c0a16, roughness: .9 }), [0, .9, -1.6], { cast: false });
  for (const [x, y, w, c] of [[-2.1, 1.8, 1.4, 0xff3fa4], [2.2, 1.6, 1.1, 0x2ee6ff], [0, 2.1, 2.2, 0x8c5bff]]) add(new THREE.CylinderGeometry(.012, .012, w, 8).rotateZ(Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(6) }), [x, y, -1.58], { cast: false });
  // the prize counter, off to the right, where the toys you win wait for you
  const wood = tex(woodCanvas(), { repeat: [2, 1] });
  const counter = new THREE.Group(); counter.position.set(1.0, -.36, .78); G.add(counter);
  add(rb(.62, .04, .36, .01), new THREE.MeshPhysicalMaterial({ map: wood, roughness: .45, clearcoat: .6, clearcoatRoughness: .2 }), [0, 0, 0], { parent: counter });
  add(rb(.58, .56, .32, .01), new THREE.MeshStandardMaterial({ color: 0x2a1a30, roughness: .7 }), [0, -.3, 0], { parent: counter });
  const counterLight = new THREE.SpotLight(0xffe2c4, 0, 2.2, .6, .7, 1.4); counterLight.position.set(1.05, .9, 1.3); counterLight.target.position.set(1.0, -.34, .78); G.add(counterLight, counterLight.target);

  // ---- lights inside the machine
  const roof = new THREE.SpotLight(0xfff4ea, 5, 2.2, 1.0, .8, 1.3); roof.position.set(0, .965, .06); roof.target.position.set(0, 0, -.02); G.add(roof, roof.target);
  roof.castShadow = true; roof.shadow.bias = -.0004; roof.shadow.normalBias = .006; roof.shadow.camera.near = .1; roof.shadow.camera.far = 1.6; roof.shadow.radius = 4;
  const ledBar = add(rb(2 * DIM.W - .04, .012, .02, .004), new THREE.MeshBasicMaterial({ color: new THREE.Color(look.led).multiplyScalar(2) }), [0, .955, DIM.D - .03], { cast: false });
  const area = new THREE.RectAreaLight(look.led, 2.5, 2 * DIM.W, .04); area.position.set(0, .95, DIM.D - .04); area.lookAt(0, 0, -.15); G.add(area);
  const backLed = new THREE.RectAreaLight(0xffffff, 2.5, 2 * DIM.W, .03); backLed.position.set(0, .95, -DIM.D + .03); backLed.lookAt(0, 0, .1); G.add(backLed);
  const roomKey = new THREE.SpotLight(0xffe8f2, 3, 6, .7, .9, 1.5); roomKey.position.set(.6, 2.6, 2.6); roomKey.target.position.set(0, .2, 0); G.add(roomKey, roomKey.target);

  // dust in the light: a few hundred specks drifting slowly inside the machine, catching the roof light
  const moteN = 260, motePos = new Float32Array(moteN * 3), moteSeed = new Float32Array(moteN);
  for (let i = 0; i < moteN; i++) { motePos.set([rnd(-DIM.W, DIM.W), rnd(.05, .95), rnd(-DIM.D, DIM.D)], i * 3); moteSeed[i] = Math.random() * 100; }
  const moteGeo = new THREE.BufferGeometry(); moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3).setUsage(THREE.DynamicDrawUsage));
  const moteTex = tex(canvas(32, 32, (g) => { const r = g.createRadialGradient(16, 16, 0, 16, 16, 16); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 32, 32); }));
  const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({ size: .0035, map: moteTex, color: new THREE.Color(1.3, 1.2, 1.1), transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending }));
  motes.frustumCulled = false; G.add(motes);
  // the aiming laser: a red dot on whatever is straight below the claw (newer machines have one); a hot core and a soft bloom
  const laserTex = tex(canvas(64, 64, (g) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.12, 'rgba(255,80,80,1)'); r.addColorStop(.35, 'rgba(255,0,0,.35)'); r.addColorStop(1, 'rgba(255,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); }));
  const laser = new THREE.Sprite(new THREE.SpriteMaterial({ map: laserTex, color: new THREE.Color(9, .5, .45), transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending }));
  laser.scale.setScalar(.026); laser.renderOrder = 20; laser.visible = false; G.add(laser);
  const _bulb = new THREE.Color(), _led = new THREE.Color(), _base = new THREE.Color(); let flash = 0, lastT = 0;
  const api = {
    group: G, laser, door: { at: doorAt, flap, lamp: doorLamp }, env, claw, prongs, carriage, bridge, cable, clawLed, ledRing, roof, area, sign, bulbs, stickTop, btnCap, counter, counterLight, neighbours, look,
    clawPos: new THREE.Vector3(DIM.home.x, DIM.top, DIM.home.z),
    /** 0 = prongs shut, 1 = wide open; or an exact angle via setProngAngle */
    setOpen(k) { const a = THREE.MathUtils.lerp(-.1, .62, k); prongs.forEach((p) => { p.rotation.z = a; }); },
    setProngAngle(a) { prongs.forEach((p) => { p.rotation.z = a; }); },
    /** the carriage at (x, z), the claw hub at height y, swinging on its cable by (ax, az) radians */
    setClaw(x, y, z, ax = 0, az = 0) {
      const L = Math.max(.01, .865 - (y + CLAW.cap)), hx = x + Math.sin(ax) * L, hz = z + Math.sin(az) * L;
      api.clawPos.set(hx, y, hz); claw.position.set(hx, y, hz); claw.rotation.set(-az, 0, ax);
      bridge.position.z = z; carriage.position.set(x, 0, z);
      cable.scale.y = L; cable.rotation.set(-az, 0, ax);
    },
    /** the laser dot at a point (or hidden), flickering a little like a real diode */
    setLaser(p, t = 0) { laser.visible = !!p; if (p) { laser.position.set(p.x, p.y + .006, p.z); laser.scale.setScalar(.04 + .006 * Math.sin(t * 37) * Math.sin(t * 23)); } },
    /** joystick tilt (-1..1 each way) and the button pressed in (0..1) */
    setStick(x, z) { stickTop.rotation.set(z * .35, 0, -x * .35); },
    setButton(k) { btnCap.position.y = .016 - k * .008; btnCap.material.emissiveIntensity = .6 + k * 2.4; },
    setTheme(t) {
      Object.assign(look, THEME_LOOK[t]);
      paint.color.set(look.paint); paint2.color.set(look.paint2); velvet.color.set(look.floor);
      signTex.image = signCanvas(look); signTex.needsUpdate = true;
      backTex.image = backdropCanvas(t); backTex.needsUpdate = true;
      G.remove(decor); decor.traverse((o) => { o.geometry?.dispose(); [].concat(o.material || []).forEach((m) => m.dispose()); }); decor = buildDecor(t); G.add(decor);
      panelTex.image = panelCanvas(look); panelTex.needsUpdate = true;
      clawLed.color.set(look.led); area.color.set(look.led); ledBar.material.color.set(look.led).multiplyScalar(2); ledRing.material.color.set(look.led).multiplyScalar(4);
    },
    /** bulbs chase around the sign; mode 'attract' (title), 'play', 'win' (all flashing) */
    /** a quick bright pulse of every light in the cabinet (the claw landing, a win) */
    flash(k = 1) { flash = Math.max(flash, k); },
    lights(t, mode) {
      for (const s of decor.userData.sway) { if (s.base) s.o.rotation.z = Math.sin(t * .9 + s.k) * s.a; else { s.o.rotation.z = Math.sin(t * .7 + s.k) * s.a; s.o.rotation.x = Math.sin(t * .5 + s.k * 1.3) * s.a * .5; } }
      // the LED strip, the light it throws and the claw's ring: the theme's colour while playing, a slow rainbow drift on the
      // title screen, a fast rainbow chase on a win; everything flares for a moment on a flash
      const dt = Math.min(.1, Math.max(0, t - lastT)); lastT = t; flash *= Math.exp(-4 * dt);
      _base.set(look.led);
      if (mode === 'attract') _led.setHSL((t * .06) % 1, .55, .78).lerp(_base, .35);
      else if (mode === 'win') _led.setHSL((t * 1.6) % 1, .9, .62);
      else _led.copy(_base);
      const boost = 1 + flash * 1.5 + (mode === 'win' ? .6 * (Math.sin(t * 18) > 0 ? 1 : 0) : 0);
      ledBar.material.color.copy(_led).multiplyScalar(2 * boost); area.color.copy(_led); area.intensity = 2.5 * boost;
      ledRing.material.color.copy(_led).multiplyScalar(4 * boost); clawLed.color.copy(_led);
      roof.intensity = 5 * (1 + flash * .35); sign.material.color.setScalar(2.2 * (mode === 'win' ? .75 + .5 * (Math.sin(t * 9) > 0 ? 1 : 0) : 1 + flash * .4));
      for (let i = 0; i < moteN; i++) {                                         // a lazy curl of air: each speck wanders and sinks a little, then comes back round
        const k = moteSeed[i], j = i * 3;
        motePos[j] += Math.sin(t * .23 + k) * .00012; motePos[j + 1] += Math.sin(t * .17 + k * 1.7) * .0001 - .00004; motePos[j + 2] += Math.cos(t * .19 + k * .7) * .00012;
        if (motePos[j + 1] < .03) motePos[j + 1] = .95;
      }
      moteGeo.attributes.position.needsUpdate = true;
      const c = _bulb;
      for (let i = 0; i < bulbN; i++) {
        let k;
        if (mode === 'win') k = (Math.floor(t * 8) % 2) ? 1 : .15;
        else if (mode === 'attract') k = .25 + .75 * Math.pow(.5 + .5 * Math.sin(t * 5 - i * .55), 3);
        else k = (i + Math.floor(t * 6)) % 3 === 0 ? 1 : .3;
        bulbs.setColorAt(i, c.setScalar(k));
      }
      bulbs.instanceColor.needsUpdate = true;
      neighbours.forEach((s, i) => s.material.color.setScalar(1.1 + .25 * Math.sin(t * (2.3 + i) + i)));
    },
    floor, back,
  };
  api.setClaw(DIM.home.x, DIM.top, DIM.home.z); api.setOpen(.15);
  mergeStatic(G, new Set([claw, carriage, bridge, stick, button, flap, decor]));
  return api;
}
