import * as THREE from 'three';
import { mk, canvasTex, rand, pick, shared } from './util.js';

// Candy the girls love, built from simple shapes: gummies, gummy worms, sour gummy kids, nerd-style candy boxes, sour rings and straws.
// Also party things for the truck: gift boxes, teddy bears, balloons.
const sph = (r, w = 14, h = 10) => new THREE.SphereGeometry(r, w, h);
const cyl = (rt, rb, h, s = 12) => new THREE.CylinderGeometry(rt, rb, h, s);

const GUMMY = [0xff3b5c, 0xff8a1f, 0xffd32a, 0x4ddc5a, 0x36a8ff, 0xb35cff, 0xff5fc8];
let _sugar;
const sugarTex = () => _sugar || (_sugar = canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 1400; i++) { const v = 200 + Math.floor(Math.random() * 55); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  for (let i = 0; i < 160; i++) { g.fillStyle = 'rgba(255,255,255,1)'; g.fillRect(Math.random() * w, Math.random() * h, 2.5, 2.5); }
}, [2, 2]));

/** shiny jelly-like gummy (one shared material per colour + recipe) */
const makeGummy = (color, opts = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.06, emissive: color, emissiveIntensity: 0.14, ...opts });
const gummy = (color, opts = {}) => shared(makeGummy, new THREE.Color(color).getHex(), opts);
/** sour sugar-coated candy */
const makeSour = (color) => new THREE.MeshPhysicalMaterial({ color, map: sugarTex(), roughness: 0.55, clearcoat: 0.15, emissive: color, emissiveIntensity: 0.1 });
const sour = (color) => shared(makeSour, new THREE.Color(color).getHex());
const dark = shared(function makeDark() { return new THREE.MeshBasicMaterial({ color: 0x2a1418 }); });
const shine = shared(function makeShine() { return new THREE.MeshBasicMaterial({ color: 0xffffff }); });
const makeLid = () => new THREE.MeshStandardMaterial({ color: 0xffffff });

function face(g, y, z, r = .06) {
  for (const s of [-1, 1]) g.add(mk(sph(r, 8, 6), dark, [s * r * 2.2, y, z]), mk(sph(r * .35, 6, 4), shine, [s * r * 2.2 + r * .3, y + r * .4, z + r * .8]));
  const sm = mk(new THREE.TorusGeometry(r * 1.6, r * .28, 6, 12, Math.PI), dark, [0, y - r * 2.2, z]); sm.rotation.z = Math.PI; g.add(sm);
}

function gummyBear(c = pick(GUMMY)) {
  const g = new THREE.Group(), m = gummy(c);
  g.add(mk(sph(.55, 18, 14), m, [0, .65, 0], [1, 1.15, .85]), mk(sph(.42, 18, 14), m, [0, 1.42, 0]));
  for (const s of [-1, 1]) g.add(mk(sph(.17), m, [s * .3, 1.78, 0]), mk(sph(.2, 12, 8), m, [s * .55, .85, .08], [1, 1.2, 1]), mk(sph(.24, 12, 8), m, [s * .3, .15, .1], [1, 1.1, 1.1]));
  g.add(mk(sph(.17, 12, 8), gummy(new THREE.Color(c).lerp(new THREE.Color(0xffffff), .45)), [0, 1.34, .34], [1.1, .8, .8]));
  g.add(mk(sph(.05, 8, 6), dark, [0, 1.4, .5]));
  for (const s of [-1, 1]) g.add(mk(sph(.05, 8, 6), dark, [s * .15, 1.53, .38]));
  return g;
}

function gummyWorm(c1 = pick(GUMMY), c2 = pick(GUMMY)) {
  const g = new THREE.Group();
  const pts = [[-1.4, .25, 0], [-.7, .55, .3], [0, .3, -.2], [.7, .6, .25], [1.4, .3, 0]].map((p) => new THREE.Vector3(...p));
  const curve = new THREE.CatmullRomCurve3(pts), seg = 40, rad = 10;
  const geo = new THREE.TubeGeometry(curve, seg, .26, rad, false);
  const cols = new Float32Array(geo.attributes.position.count * 3), a = new THREE.Color(c1), b = new THREE.Color(c2);
  for (let i = 0; i < geo.attributes.position.count; i++) { const s = Math.floor(i / (rad + 1)); const col = Math.floor(s / 5) % 2 ? a : b; cols.set([col.r, col.g, col.b], i * 3); }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  g.add(new THREE.Mesh(geo, gummy(0xffffff, { vertexColors: true, emissive: 0x000000, emissiveIntensity: 0 })));
  g.add(mk(sph(.26, 10, 8), gummy(c2), pts[4]), mk(sph(.26, 10, 8), gummy(c1), pts[0]));
  for (const s of [-1, 1]) g.add(mk(sph(.05, 8, 6), dark, [pts[4].x + .12, pts[4].y + .14, s * .13]));   // two little eyes on the head end
  return g;
}

function sourKid(c = pick(GUMMY)) {
  const g = new THREE.Group(), m = sour(c);
  g.add(mk(sph(.42, 16, 12), m, [0, 1.5, 0]), mk(new THREE.CapsuleGeometry(.3, .5, 6, 12), m, [0, .85, 0]));
  for (const s of [-1, 1]) {
    const arm = mk(new THREE.CapsuleGeometry(.12, .45, 4, 8), m, [s * .52, 1.0, 0]); arm.rotation.z = -s * 1.1; g.add(arm);
    g.add(mk(new THREE.CapsuleGeometry(.14, .4, 4, 8), m, [s * .2, .2, 0]));
  }
  face(g, 1.55, .38, .06);
  // mischievous grin (wider)
  g.add(mk(new THREE.TorusGeometry(.14, .03, 6, 12, Math.PI), dark, [0, 1.38, .4]).rotateZ(Math.PI));
  return g;
}

function nerds(c1 = pick(GUMMY), c2 = pick(GUMMY)) {
  const g = new THREE.Group();
  g.add(mk(new THREE.BoxGeometry(.55, 1.5, .55), gummy(c1, { roughness: .35 }), [-.28, .8, 0]), mk(new THREE.BoxGeometry(.55, 1.5, .55), gummy(c2, { roughness: .35 }), [.28, .8, 0]));
  g.add(mk(new THREE.BoxGeometry(1.12, .18, .57), shared(makeLid), [0, 1.6, 0]));
  for (let i = 0; i < 22; i++) g.add(mk(sph(rand(.05, .09), 6, 5), gummy(GUMMY[i % GUMMY.length], { emissiveIntensity: .25 }), [rand(-.8, .8), .09, rand(-.5, .9)]));       // little pellets spilling out
  return g;
}

function sourRing(c = pick(GUMMY)) {
  const g = new THREE.Group(), r = mk(new THREE.TorusGeometry(.6, .26, 14, 24), sour(c), [0, .85, 0]); r.rotation.x = Math.PI / 2 - .5; g.add(r); return g;
}
function sourStraw(c = pick(GUMMY)) {
  const g = new THREE.Group(), s = mk(cyl(.17, .17, 2.2, 10), sour(c), [0, 1.1, 0]); s.rotation.z = .25; g.add(s);
  g.add(mk(cyl(.175, .175, .35, 10), sour(0xffffff), [-.1, 1.1, 0]).rotateZ(.25)); return g;
}

export const CANDY_KINDS = {
  gummyBear: { make: () => gummyBear(), emoji: '\u{1F43B}', h: 2.0 },
  gummyWorm: { make: () => gummyWorm(), emoji: '\u{1FAB1}', h: 1.2 },
  sourKid: { make: () => sourKid(), emoji: '\u{1F36C}', h: 2.0 },
  nerds: { make: () => nerds(), emoji: '\u{1F36C}', h: 1.9 },
  sourRing: { make: () => sourRing(), emoji: '\u{1F36C}', h: 1.4 },
  sourStraw: { make: () => sourStraw(), emoji: '\u{1F36C}', h: 2.2 },
};
export const makeCandy = (kind) => CANDY_KINDS[kind].make();

// ---------- party things the truck brings besides candy ----------
const phys = (o) => new THREE.MeshPhysicalMaterial(o);
const P = (o) => shared(phys, o);            // a shared MeshPhysicalMaterial per recipe
export function makeGift(c = pick(GUMMY)) {
  const g = new THREE.Group(), ribbon = P({ color: 0xffffff, roughness: .3, clearcoat: .6 });
  g.add(mk(new THREE.BoxGeometry(1, .8, 1), P({ color: c, roughness: .35, clearcoat: .5 }), [0, .4, 0]), mk(new THREE.BoxGeometry(1.06, .18, 1.06), P({ color: c, roughness: .35 }), [0, .85, 0]));
  g.add(mk(new THREE.BoxGeometry(.18, .98, 1.08), ribbon, [0, .45, 0]), mk(new THREE.BoxGeometry(1.08, .98, .18), ribbon, [0, .45, 0]));
  g.add(mk(sph(.17, 10, 8), ribbon, [-.15, 1.02, 0], [1.2, .8, .8]), mk(sph(.17, 10, 8), ribbon, [.15, 1.02, 0], [1.2, .8, .8]));
  return g;
}
export function makeTeddy(c = 0xc98a4b) {
  const g = new THREE.Group(), m = P({ color: c, roughness: .85, sheen: 1, sheenColor: 0xffe0b0 }), lt = P({ color: 0xf4d6a8, roughness: .85 });
  g.add(mk(sph(.5, 16, 12), m, [0, .55, 0], [1, 1.1, .9]), mk(sph(.38, 16, 12), m, [0, 1.3, 0]), mk(sph(.28, 12, 8), lt, [0, .5, .36], [1, 1.1, .5]), mk(sph(.16, 10, 8), lt, [0, 1.2, .32], [1.2, .9, .8]), mk(sph(.06, 8, 6), dark, [0, 1.25, .46]));
  for (const s of [-1, 1]) g.add(mk(sph(.14), m, [s * .27, 1.6, 0]), mk(sph(.07, 8, 6), dark, [s * .14, 1.38, .33]), mk(sph(.17, 10, 8), m, [s * .52, .75, .1]), mk(sph(.2, 10, 8), m, [s * .3, .12, .15]));
  g.add(mk(new THREE.TorusGeometry(.3, .06, 6, 16), P({ color: 0xff4d6d, roughness: .4 }), [0, 1.0, 0]).rotateX(Math.PI / 2));   // bow
  return g;
}
export function makeBalloon(c = pick(GUMMY)) {
  const g = new THREE.Group();
  g.add(mk(sph(.55, 16, 12), P({ color: c, roughness: .15, clearcoat: 1 }), [0, 3, 0], [1, 1.2, 1]), mk(cyl(.01, .01, 3, 4), shine, [0, 1.5, 0]));
  return g;
}
