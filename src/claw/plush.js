// The prizes: stuffed toys built from soft shapes and shaded like real fabric. Every toy is a few merged meshes (one per
// material: plush fabric, satin yarn, felt, glossy safety eyes, gold lamé, sequins), coloured per vertex with baked
// contact shading where its parts meet, and a matching set of spheres for the physics. The fabric look comes from three
// things: sheen (the soft bright rim velvet and minky have), a fine pile bump made in the shader from the toy's own 3D
// position (so it never stretches and moves with the toy), and slow tone variation across the cloth.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ---------------------------------------------------------------- random numbers that can be repeated (a seed per toy)
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }   // mulberry32
const pickR = (r, a) => a[Math.floor(r() * a.length)];

// ---------------------------------------------------------------- 3D value noise (for lumpy handmade stuffing)
function h3(x, y, z) { let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 2147483647); n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; }
function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf), L = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => h3(xi + dx, yi + dy, zi + dz);
  return L(L(L(c(0, 0, 0), c(1, 0, 0), u), L(c(0, 1, 0), c(1, 1, 0), u), v), L(L(c(0, 0, 1), c(1, 0, 1), u), L(c(0, 1, 1), c(1, 1, 1), u), v), w);
}

// ---------------------------------------------------------------- materials (shared by every toy)
const FAB_GLSL = `
float fbH(vec3 p){ p = fract(p * .1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }
float fbN(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(mix(fbH(i), fbH(i + vec3(1,0,0)), f.x), mix(fbH(i + vec3(0,1,0)), fbH(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(fbH(i + vec3(0,0,1)), fbH(i + vec3(1,0,1)), f.x), mix(fbH(i + vec3(0,1,1)), fbH(i + vec3(1,1,1)), f.x), f.y), f.z); }
vec3 fbPerturb(vec3 sp, vec3 sn, vec2 dH, float fd){
  vec3 sx = normalize(dFdx(sp)), sy = normalize(dFdy(sp)), r1 = cross(sy, sn), r2 = cross(sn, sx);
  float det = dot(sx, r1) * fd; vec3 g = sign(det) * (dH.x * r1 + dH.y * r2);
  return normalize(abs(det) * sn - g); }`;

/**
 * Adds the cloth to a physical material. kind 'pile' = minky/fleece (3D noise bump), 'sequin' = rows of tilted sequins
 * (each catches the light on its own), 'smooth' = satin and plastic (tone only).
 */
function fabricify(mat, { kind = 'pile', freq = 320, bump = 1, tone = .08, seq = [46, 18] } = {}) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.fbBump = { value: bump }; sh.uniforms.fbTone = { value: tone }; sh.uniforms.fbSeq = { value: new THREE.Vector2(...seq) };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vFbP; varying vec2 vFbUv;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>\nvFbP = position * ${freq.toFixed(1)}; vFbUv = uv;`);
    let frag = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vFbP; varying vec2 vFbUv; uniform float fbBump, fbTone; uniform vec2 fbSeq;\n${FAB_GLSL}`)
      .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb *= 1. + fbTone * (fbN(vFbP * .045) - .55) * 2.;');
    if (kind === 'pile') {
      frag = frag.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { float fh = fbN(vFbP) * .62 + fbN(vFbP * 2.63 + 7.1) * .38; float fw = length(fwidth(vFbP));
          normal = fbPerturb(-vViewPosition, normal, vec2(dFdx(fh), dFdy(fh)) * fbBump * smoothstep(1.6, .3, fw), faceDirection); }`);
    } else if (kind === 'sequin') {
      frag = frag.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { vec2 g = vFbUv * fbSeq; g.x += step(1., mod(floor(g.y), 2.)) * .5; vec2 c = floor(g), f = fract(g) - .5;
          float a = fbH(vec3(c, 3.7)) * 6.2832, d = length(f);
          float fh = dot(f, vec2(cos(a), sin(a))) * .55 - smoothstep(.32, .5, d) * .25; float fw = length(fwidth(g));
          normal = fbPerturb(-vViewPosition, normal, vec2(dFdx(fh), dFdy(fh)) * fbBump * smoothstep(.9, .25, fw), faceDirection);
          diffuseColor.rgb *= .78 + .44 * fbH(vec3(c, 9.1)); }`);
    }
    sh.fragmentShader = frag;
  };
  mat.customProgramCacheKey = () => `fab-${kind}-${freq}`;
  return mat;
}

// ---------------------------------------------------------------- fur: the plush pile as real fibres
// Each fabric mesh carries a second, instanced copy of itself: up to 12 thin shells stacked a few millimetres out along
// the surface. Every shell keeps only the fibres tall enough to reach it, so close up you see individual fibres and a soft,
// fuzzy outline, and from further away they blend (alpha to coverage) into the velvet halo plush has. One draw per mesh.
export const FUR = { max: 12, k: { value: 7 }, len: { value: .0028 } };
/** how many shells to draw (0 = off): set from the graphics quality */
export function setFurLayers(k) { FUR.k.value = Math.max(1, k); FUR.on = k > 0; furMeshes.forEach((m) => { m.count = k; m.visible = k > 0; }); }
const furMeshes = new Set();
/** hide or show every toy's fur for one render (the claw cam has no anti-aliasing for the fibres) */
export function furShown(on) { if (FUR.on === false) return; furMeshes.forEach((m) => { m.visible = on; }); }
let FURMAT = null;
function furMaterial() {
  if (FURMAT) return FURMAT;
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, alphaToCoverage: true });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.furK = FUR.k; sh.uniforms.furLen = FUR.len;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float furK, furLen; varying vec3 vFurP; varying float vLayer;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n vLayer = (float(gl_InstanceID) + 1.) / furK; vFurP = position * 880.; transformed += objectNormal * furLen * vLayer;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      uniform float furK; varying vec3 vFurP; varying float vLayer;
      float fuH(vec3 p){ p = fract(p * .1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      { vec3 c = floor(vFurP), f = fract(vFurP) - .5; float h = fuH(c), r = length(f.xy + f.z * .3);
        float strand = step(vLayer, .35 + h * .75) * (1. - smoothstep(.3, .48 + .1 * (1. - vLayer), r));
        float far = smoothstep(.7, 2.6, length(fwidth(vFurP)));
        float a = mix(strand, (1. - vLayer) * .5, far); if (a < .02) discard;
        diffuseColor.a = a; diffuseColor.rgb *= mix(.62, 1.1, vLayer); }`);
  };
  m.customProgramCacheKey = () => 'plush-fur';
  return (FURMAT = m);
}
function addFur(mesh) {
  const fur = new THREE.InstancedMesh(mesh.geometry, furMaterial(), FUR.max);
  const I = new THREE.Matrix4(); for (let i = 0; i < FUR.max; i++) fur.setMatrixAt(i, I);
  fur.count = FUR.on === false ? 0 : FUR.k.value; fur.visible = FUR.on !== false; fur.castShadow = false; fur.receiveShadow = true; fur.frustumCulled = false; fur.userData.fur = true;
  mesh.add(fur); furMeshes.add(fur);
  return fur;
}
/** a toy that's gone for good: forget its fur too */
export function forgetToy(toy) { toy.traverse((o) => { if (o.userData.fur) furMeshes.delete(o); }); }

/** the printed satin label sewn into every toy: a red heart, a tiny brand line and the washing-care rows */
function tagTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 96; const g = c.getContext('2d');
  g.fillStyle = '#fbf8f2'; g.fillRect(0, 0, 64, 96);
  g.fillStyle = '#e8304f'; g.beginPath(); g.moveTo(32, 40); g.bezierCurveTo(14, 28, 18, 12, 32, 22); g.bezierCurveTo(46, 12, 50, 28, 32, 40); g.fill();
  g.fillStyle = '#7a6a80'; g.font = '700 11px sans-serif'; g.textAlign = 'center'; g.fillText('A&E', 32, 56);
  g.fillStyle = 'rgba(90,80,100,.45)'; for (let i = 0; i < 4; i++) g.fillRect(12, 64 + i * 7, 40 - (i % 2) * 12, 2);
  g.strokeStyle = 'rgba(0,0,0,.08)'; for (let y = 0; y < 96; y += 3) { g.beginPath(); g.moveTo(0, y); g.lineTo(64, y); g.stroke(); }   // the satin weave
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
/** a care label sticking out of a seam at p, turned by rot (a thin satin card, folded where it's sewn in) */
function tag(T, p, rot = [0, 0, 0]) {
  const g = new THREE.BoxGeometry(.017, .026, .0012); g.translate(0, -.013, 0);
  T.add(place(g, p, rot), 'tag', '#ffffff');
}
/** the piped seam where a pillow's front and back are sewn together: a little welt around its widest edge */
function edgeSeam(T, shape, out, color) {
  const pts = shape.getSpacedPoints(140); pts.pop(); const cw = THREE.ShapeUtils.isClockWise(pts), P3 = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[(i - 1 + pts.length) % pts.length], b = pts[(i + 1) % pts.length], tx = b.x - a.x, ty = b.y - a.y, l = Math.hypot(tx, ty) || 1;
    const nx = (cw ? -ty : ty) / l, ny = (cw ? tx : -tx) / l; P3.push(new THREE.Vector3(pts[i].x + nx * out, pts[i].y + ny * out, 0));
  }
  T.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(P3, true), 220, .0016, 5, true), 'felt', color);
  let low = P3[0]; for (const q of P3) if (q.y < low.y) low = q; return low;
}

let MATS = null;
export function plushMaterials() {
  if (MATS) return MATS;
  const P = (o) => new THREE.MeshPhysicalMaterial(o);
  MATS = {
    fabric: fabricify(P({ vertexColors: true, roughness: .9, sheen: 1, sheenRoughness: .5, sheenColor: new THREE.Color(.95, .95, .95), envMapIntensity: .9 }), { freq: 390, bump: .8, tone: .07 }),
    hair: fabricify(P({ vertexColors: true, roughness: .62, sheen: 1, sheenRoughness: .3, sheenColor: new THREE.Color(.8, .8, .8), side: THREE.DoubleSide }), { freq: 520, bump: .7, tone: .1 }),
    felt: fabricify(P({ vertexColors: true, roughness: 1, sheen: .5, sheenRoughness: .7, sheenColor: new THREE.Color(.4, .4, .4) }), { freq: 700, bump: .6, tone: .05 }),
    satin: fabricify(P({ vertexColors: true, roughness: .34, metalness: .05, sheen: .7, sheenRoughness: .25, sheenColor: new THREE.Color(1, 1, 1) }), { kind: 'smooth', freq: 150, tone: .05 }),
    sequin: fabricify(P({ vertexColors: true, metalness: .35, roughness: .3, iridescence: .8, iridescenceIOR: 1.45, iridescenceThicknessRange: [260, 520], clearcoat: .4, envMapIntensity: 1.2 }), { kind: 'sequin', bump: .9, tone: 0, seq: [40, 22] }),
    gold: fabricify(P({ color: 0xf0c060, metalness: .92, roughness: .32, envMapIntensity: 1.2 }), { freq: 420, bump: .8, tone: .04 }),
    eye: P({ color: 0x060606, roughness: .06, clearcoat: 1, clearcoatRoughness: .02, envMapIntensity: 1.6 }),
    tag: P({ vertexColors: true, map: tagTexture(), roughness: .32, sheen: .6, sheenRoughness: .3, sheenColor: new THREE.Color(1, 1, 1), side: THREE.DoubleSide }),
    pearl: P({ color: 0xfff4ee, roughness: .14, clearcoat: 1, iridescence: .9, iridescenceIOR: 1.6, sheen: .4, envMapIntensity: 1.4 }),
  };
  return MATS;
}

// ---------------------------------------------------------------- building blocks
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
function place(g, p = [0, 0, 0], rot = [0, 0, 0], s = [1, 1, 1]) {
  _e.set(rot[0], rot[1], rot[2]); _q.setFromEuler(_e); g.applyMatrix4(_m.compose(_v.set(...p), _q, _s.set(...s)));
  if (s[0] * s[1] * s[2] < 0) {                                       // mirrored: turn the triangles back the right way out
    if (!g.index) { const idx = []; for (let i = 0; i < g.attributes.position.count; i++) idx.push(i); g.setIndex(idx); }
    const a = g.index.array; for (let i = 0; i < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; }
  }
  return g;
}
/** a lumpy ellipsoid (stuffing never fills a seam perfectly) */
function ellGeo(r, c, rot, { seg = 28, lump = .035, seed = 1 } = {}) {
  const g = new THREE.SphereGeometry(1, seg, Math.max(8, Math.round(seg * .72))), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    _v.fromBufferAttribute(p, i); const n = noise3(_v.x * 1.7 + seed * 7.3, _v.y * 1.7 + seed, _v.z * 1.7 - seed * 3.1);
    _v.multiplyScalar(1 + lump * (n - .5) * 2); p.setXYZ(i, _v.x, _v.y, _v.z);
  }
  place(g, c, rot, r); g.computeVertexNormals(); return g;
}
/** a tube along a curve that tapers from r0 to r1, with round ends */
function tubeGeo(pts, r0, r1, { seg = 20, rad = 10, ends = true } = {}) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  const g = new THREE.TubeGeometry(curve, seg, 1, rad, false), p = g.attributes.position, n = g.attributes.normal, c = new THREE.Vector3();
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, r = r0 + (r1 - r0) * t; curve.getPointAt(t, c);
    for (let j = 0; j <= rad; j++) { const k = i * (rad + 1) + j; p.setXYZ(k, c.x + n.getX(k) * r, c.y + n.getY(k) * r, c.z + n.getZ(k) * r); }
  }
  if (!ends) return [g];
  const a = curve.getPointAt(0), b = curve.getPointAt(1);
  return [g, place(new THREE.SphereGeometry(r0, rad, Math.max(6, rad >> 1)), a.toArray()), place(new THREE.SphereGeometry(r1, rad, Math.max(6, rad >> 1)), b.toArray())];
}
/** a puffy pillow from a 2D outline (stars, hearts, fins, wings) centred on z = 0 */
function puffGeo(shape, depth, puff, { seg = 5, curve = 28 } = {}) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: puff, bevelSize: puff * .8, bevelSegments: seg, curveSegments: curve });
  g.translate(0, 0, -depth / 2); g.computeVertexNormals(); return g;
}
const starShape = (ro, ri, n = 5, round = .25) => {
  const s = new THREE.Shape(), pts = [];
  for (let i = 0; i < n * 2; i++) { const a = Math.PI / 2 + i * Math.PI / n, r = i % 2 ? ri : ro; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
  // rounded points: quadratic corners through each vertex
  const mid = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const L = pts.length; s.moveTo(...mid(pts[L - 1], pts[0], 1 - round));
  for (let i = 0; i < L; i++) { const a = pts[i], b = pts[(i + 1) % L]; s.quadraticCurveTo(a[0], a[1], ...mid(a, b, round)); s.lineTo(...mid(a, b, 1 - round)); }
  return s;
};
const heartShape = (w) => {
  const s = new THREE.Shape(), k = w / 2;
  s.moveTo(0, -k * .95); s.bezierCurveTo(k * .55, -k * .45, k * 1.05, -k * .05, k * .98, k * .38); s.bezierCurveTo(k * .9, k * .86, k * .32, k * .98, 0, k * .58);
  s.bezierCurveTo(-k * .32, k * .98, -k * .9, k * .86, -k * .98, k * .38); s.bezierCurveTo(-k * 1.05, -k * .05, -k * .55, -k * .45, 0, -k * .95); return s;
};

/** a toy under construction: parts with a material and a colour, plus the ellipsoids used for contact shading and physics */
class Toy {
  constructor(kind, seed) { this.kind = kind; this.seed = seed; this.parts = []; this.occ = []; this.cols = []; }
  add(geos, mat, color, opts = {}) { for (const g of [].concat(geos)) this.parts.push({ g, mat, color: color == null ? null : new THREE.Color(color), self: opts.self ?? null, paint: opts.paint || null }); return this; }
  /** an occluder that shades the other parts but not the ones added with { self: id } */
  occluder(c, r) { this.occ.push({ c: new THREE.Vector3(...c), r: new THREE.Vector3(...r), q: new THREE.Quaternion() }); return this.occ.length - 1; }
  /** a soft ellipsoid part; occ = shades its neighbours; col = a physics sphere */
  ell(r, c, color, { mat = 'fabric', rot = [0, 0, 0], occ = true, col = false, seg = 28, lump = .035, paint = null } = {}) {
    const id = this.occ.length;
    if (occ) this.occ.push({ c: new THREE.Vector3(...c), r: new THREE.Vector3(...r), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)) });
    if (col) this.cols.push({ c: new THREE.Vector3(...c), r: (r[0] + r[1] + r[2]) / 3 });
    return this.add(ellGeo(r, c, rot, { seg, lump, seed: this.seed + this.parts.length }), mat, color, { self: occ ? id : null, paint });
  }
  /** shade every vertex: darker where the part tucks under or presses into another part (baked ambient occlusion) */
  finish(scale = 1) {
    const M = plushMaterials(), groups = new Map(), iq = new THREE.Quaternion(), p = new THREE.Vector3(), n = new THREE.Vector3(), d = new THREE.Vector3();
    for (const part of this.parts) {
      let g = part.g; if (!g.index) { const idx = []; for (let i = 0; i < g.attributes.position.count; i++) idx.push(i); g.setIndex(idx); }
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
      g.morphAttributes = {};
      const pos = g.attributes.position, nor = g.attributes.normal, col = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        p.fromBufferAttribute(pos, i); n.fromBufferAttribute(nor, i);
        let ao = .72 + .28 * THREE.MathUtils.smoothstep(n.y, -1, .5);
        for (let k = 0; k < this.occ.length; k++) {
          if (k === part.self) continue; const o = this.occ[k];
          iq.copy(o.q).invert(); d.copy(p).sub(o.c).applyQuaternion(iq).divide(o.r);
          const dist = d.length() - 1; if (dist < .45) ao *= .55 + .45 * THREE.MathUtils.smoothstep(dist, -.15, .45);
        }
        const c = part.paint ? part.paint(p, n) : part.color; const cc = c || WHITE;
        col[i * 3] = cc.r * ao; col[i * 3 + 1] = cc.g * ao; col[i * 3 + 2] = cc.b * ao;
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      if (!groups.has(part.mat)) groups.set(part.mat, []); groups.get(part.mat).push(g);
    }
    // centre on the physics spheres' mass, so the toy tumbles about its middle
    const cm = new THREE.Vector3(); let wsum = 0; for (const c of this.cols) { const w = c.r ** 3; cm.addScaledVector(c.c, w); wsum += w; } cm.divideScalar(wsum || 1);
    const root = new THREE.Group(); root.name = this.kind;
    for (const [mat, list] of groups) {
      const geo = mergeGeometries(list, false); list.forEach((g) => g.dispose());
      geo.translate(-cm.x, -cm.y, -cm.z); geo.scale(scale, scale, scale); geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, M[mat]); mesh.castShadow = mesh.receiveShadow = true; root.add(mesh);
      if (mat === 'fabric') addFur(mesh);
    }
    const spheres = this.cols.map((c) => ({ p: c.c.clone().sub(cm).multiplyScalar(scale), r: c.r * scale }));
    let R = 0; root.children.forEach((m) => { if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere(); R = Math.max(R, m.geometry.boundingSphere.center.length() + m.geometry.boundingSphere.radius); });
    root.userData.toy = { kind: this.kind, seed: this.seed, spheres, radius: R, emoji: EMOJI[this.kind] || '\u{1F381}' };
    return root;
  }
}
const WHITE = new THREE.Color(1, 1, 1);
const EMOJI = { dragon: '\u{1F409}', turtle: '\u{1F422}', bunny: '\u{1F430}', kitty: '\u{1F431}', seahorse: '\u{1F40E}', octopus: '\u{1F419}', unicorn: '\u{1F984}', mermaid: '\u{1F9DC}‍♀️', star: '⭐', heart: '\u{1F496}', rainbow: '\u{1F308}', starfish: '\u{1F31F}', shell: '\u{1F41A}', fish: '\u{1F420}' };

// ---------------------------------------------------------------- faces
/** glossy black safety eyes set into a head (ellipsoid centre c, radii r), looking along dir; with two tiny lashes */
function eyes(T, r, c, { y = .18, x = .5, size = .18, lashes = true, lash = 0x2a1a22, closed = false } = {}) {
  for (const s of [-1, 1]) {
    const d = new THREE.Vector3(s * x, y, 1).normalize(), at = new THREE.Vector3(...c).add(d.clone().multiply(new THREE.Vector3(...r)).multiplyScalar(1.0));
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), d), e = new THREE.Euler().setFromQuaternion(q);
    const er = r[0] * size;
    if (closed) {                                                          // embroidered sleepy eyes: a curved stitch with three little lashes under it
      const P = (u, v) => at.clone().add(new THREE.Vector3(u * er, v * er, er * .15).applyQuaternion(q));
      T.add(tubeGeo([P(-1, .15), P(-.5, -.3), P(0, -.42), P(.5, -.3), P(1, .15)].map((v) => v.toArray()), er * .19, er * .19, { seg: 12, rad: 5 }), 'felt', lash);
      for (const u of [-.5, 0, .5]) T.add(tubeGeo([P(u, -.36), P(u * 1.3, -.75)].map((v) => v.toArray()), er * .09, er * .06, { seg: 3, rad: 4, ends: false }), 'felt', lash);
      continue;
    }
    T.add(ellGeo([er, er, er * .62], at.toArray(), [e.x, e.y, e.z], { seg: 16, lump: 0 }), 'eye', null);
    if (lashes) for (const k of [0, 1]) {
      const base = at.clone().add(new THREE.Vector3(s * er * (.55 + k * .35), er * (.75 - k * .35), 0));
      const tip = base.clone().add(new THREE.Vector3(s * er * (.55 + k * .2), er * (.45 - k * .1), er * .25));
      T.add(tubeGeo([base.toArray(), base.clone().lerp(tip, .5).add(new THREE.Vector3(0, er * .12, 0)).toArray(), tip.toArray()], er * .1, er * .06, { seg: 4, rad: 4 }), 'felt', lash);
    }
  }
}
/** round felt cheeks */
function cheeks(T, r, c, color, { y = -.05, x = .78 } = {}) {
  for (const s of [-1, 1]) {
    const d = new THREE.Vector3(s * x, y, .62).normalize(), at = new THREE.Vector3(...c).add(d.clone().multiply(new THREE.Vector3(...r)).multiplyScalar(1.03));
    const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), d));
    T.add(ellGeo([r[0] * .2, r[0] * .15, r[0] * .04], at.toArray(), [e.x, e.y, e.z], { seg: 14, lump: 0 }), 'felt', color);
  }
}
/** an embroidered smile */
function smile(T, at, w, color = 0x8a2e4a) { const [x, y, z] = at; T.add(tubeGeo([[x - w, y + w * .35, z - w * .2], [x, y - w * .15, z + w * .05], [x + w, y + w * .35, z - w * .2]], w * .12, w * .12, { seg: 10, rad: 5 }), 'felt', color); }

// ---------------------------------------------------------------- palettes (real plush colours: soft, a little dusty, never neon)
const UNI = [
  { body: '#f6efe8', snout: '#ffe0e8', hoof: '#f2b6cf', mane: ['#ff9ec4', '#ffc98a', '#fff1a0', '#a8e6c4', '#9fd3ff', '#c7a8ff'] },
  { body: '#ffd9e6', snout: '#fff1f4', hoof: '#e98fb6', mane: ['#c9a2ff', '#f9a8d4', '#ffffff', '#b28dff'] },
  { body: '#e4d8ff', snout: '#f6f0ff', hoof: '#b9a1f5', mane: ['#ff9fd0', '#8fd8ff', '#ffe08a', '#ffffff'] },
  { body: '#d9f5ea', snout: '#f2fffa', hoof: '#86d6b8', mane: ['#ffb3d1', '#ffd38a', '#c9b2ff'] },
  { body: '#dcefff', snout: '#f4faff', hoof: '#8ec5f2', mane: ['#ffc2e2', '#cdb4ff', '#9fe7ff', '#fff5a8'] },
  { body: '#fff3d6', snout: '#fffaf0', hoof: '#f0c56b', mane: ['#ff8fab', '#ffb86b', '#b0e57c', '#7ec8ff', '#b79cff'] },
];
const SKIN = ['#f9dcc6', '#f2c7a5', '#d9a07a', '#a8704e', '#7d4e35'];
const HAIR = ['#d9442e', '#8f5bd6', '#2fb7b0', '#ff7fb0', '#f3cf6b', '#5a3626', '#3a78d8'];
const TAIL = ['#2fbfb4', '#8a5be0', '#ff6fae', '#38c78a', '#3d8ff0', '#22a6c9'];
const FIN = { '#2fbfb4': '#9ff0e6', '#8a5be0': '#d6bfff', '#ff6fae': '#ffc4dd', '#38c78a': '#b7f2cf', '#3d8ff0': '#b9d7ff', '#22a6c9': '#a6e9f7' };

// ---------------------------------------------------------------- the toys
export function unicorn(seed) {
  const r = rng(seed), pal = pickR(r, UNI), T = new Toy('unicorn', seed), mane = pal.mane, mc = (i) => mane[i % mane.length];
  const head = [[.054, .05, .05], [0, .13, .03]];
  T.ell([.052, .05, .062], [0, .055, -.012], pal.body, { col: true, lump: .04 });                      // body (sitting)
  T.ell([.04, .042, .034], [0, .072, .028], pal.body);                                                  // chest
  T.ell(...head, pal.body, { col: true });                                                              // head
  T.ell([.033, .023, .03], [0, .104, .068], pal.snout, { rot: [.15, 0, 0] });                           // muzzle
  for (const s of [-1, 1]) {                                                                            // embroidered nostrils: two little curved stitches
    const x = s * .011, y = .104, z = .0975;
    T.add(tubeGeo([[x - s * .003, y + .003, z - .002], [x + s * .001, y, z], [x - s * .001, y - .004, z - .002]], .0012, .0012, { seg: 6, rad: 4 }), 'felt', '#9a5470');
  }
  eyes(T, ...head, { y: .42, x: .5, size: .17, closed: r() < .16 });
  cheeks(T, ...head, '#ff9fbf', { y: .05, x: .86 });
  for (const s of [-1, 1]) {                                                                            // ears: an outer cone with a pink inside
    const ear = new THREE.LatheGeometry([[0, 0], [.016, .002], [.014, .016], [.006, .028], [0, .032]].map(([x, y]) => new THREE.Vector2(x, y)), 14);
    T.add(place(ear, [s * .033, .165, .012], [-.2, 0, -s * .38], [1, 1, .55]), 'fabric', pal.body);
    const inner = new THREE.LatheGeometry([[0, 0], [.009, .002], [.008, .012], [.003, .02], [0, .022]].map(([x, y]) => new THREE.Vector2(x, y)), 12);
    T.add(place(inner, [s * .034, .168, .018], [-.2, 0, -s * .38], [1, 1, .4]), 'felt', pal.snout === '#fffaf0' ? '#ffd3e0' : '#ffc3d6');
  }
  {                                                                                                      // the horn: a twisted gold cone
    const pts = [], N = 9; for (let i = 0; i <= N; i++) { const t = i / N; pts.push(new THREE.Vector2(.0125 * (1 - t) * (1 + .18 * Math.cos(t * Math.PI * 7)) + .001, t * .058)); }
    const g = new THREE.LatheGeometry(pts, 18), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = y * 60; p.setXYZ(i, x * Math.cos(a) - z * Math.sin(a), y, x * Math.sin(a) + z * Math.cos(a)); }
    g.computeVertexNormals(); T.add(place(g, [0, .172, .048], [.38, 0, 0]), 'gold', null);
  }
  for (let i = 0; i < 12; i++) {                                                                        // the mane: plump satin curls from the crown down the neck, alternating sides
    const t = i / 11, s = i % 2 ? 1 : -1, a = .45 + t * 1.55, y = .128 + Math.cos(a) * .056, z = .022 - Math.sin(a) * .06, base = [s * .004, y, z];
    const out = [s * .026, y - .006, z - .01], end = [s * .036, y - .03, z - .022];
    T.add(tubeGeo([base, out, end, [s * .03, end[1] - .014, end[2] - .002]], .016, .008, { seg: 14, rad: 10 }), 'hair', mc(i));
  }
  for (let i = 0; i < 7; i++) { const a = .35 + i * .27; T.ell([.019, .016, .02], [0, .128 + Math.cos(a) * .06, .022 - Math.sin(a) * .064], mc(i + 2), { mat: 'hair', occ: false, seg: 16 }); }   // the crest along the top
  for (const s of [-1, 1]) for (const k of [0, 1]) T.add(tubeGeo([[s * (.008 + k * .008), .178 - k * .004, .055 - k * .008], [s * (.02 + k * .008), .168 - k * .006, .07 - k * .008], [s * (.026 + k * .008), .152 - k * .006, .066 - k * .01]], .009, .005, { seg: 8, rad: 8 }), 'hair', mc(s < 0 ? k : 3 + k));   // forelock
  for (let i = 0; i < 4; i++) {                                                                         // tail
    const s = (i - 1.5) * .012;
    T.add(tubeGeo([[s * .3, .05, -.07], [s, .048, -.098], [s * 1.6, .028, -.118], [s * 2.2, .008, -.108]], .016, .008, { seg: 12, rad: 9 }), 'hair', mc(i + 1));
  }
  for (const s of [-1, 1]) {                                                                            // legs: front legs out in front, hind legs tucked, with felt hooves
    T.add(tubeGeo([[s * .027, .052, .036], [s * .03, .028, .062], [s * .031, .016, .082]], .017, .016, { seg: 8, rad: 12 }), 'fabric', pal.body);
    T.ell([.018, .011, .018], [s * .031, .012, .093], pal.hoof, { mat: 'felt', rot: [-1.1, 0, 0], seg: 14, occ: false });
    T.ell([.026, .03, .04], [s * .046, .034, -.018], pal.body);
    T.add(tubeGeo([[s * .05, .02, -.005], [s * .054, .016, .03], [s * .056, .015, .046]], .016, .015, { seg: 8, rad: 12 }), 'fabric', pal.body);
    T.ell([.017, .011, .017], [s * .056, .015, .058], pal.hoof, { mat: 'felt', rot: [-1.3, 0, 0], seg: 14, occ: false });
  }
  tag(T, [.026, .035, -.075], [.35, .6, -.15]);
  for (const s of [-1, 1]) T.cols.push({ c: new THREE.Vector3(s * .031, .016, .086), r: .016 }, { c: new THREE.Vector3(s * .055, .016, .05), r: .016 });   // hooves, so legs don't poke through the glass
  T.cols.push({ c: new THREE.Vector3(0, .03, -.104), r: .02 }, { c: new THREE.Vector3(0, .172, .04), r: .018 });                                       // tail, horn
  if (r() < .45) for (const s of [-1, 1]) {                                                            // some have little felt wings
    const w = new THREE.Shape(); w.moveTo(0, 0); w.bezierCurveTo(.02, .03, .05, .045, .062, .04); w.bezierCurveTo(.05, .028, .052, .02, .042, .014); w.bezierCurveTo(.046, .006, .04, -.004, .03, -.002); w.bezierCurveTo(.03, -.01, .016, -.012, 0, 0);
    T.add(place(puffGeo(w, .002, .004, { seg: 3, curve: 16 }), [s * .036, .08, -.05], [0, -s * 1.2, s * .5], [s, 1, 1]), 'satin', r() < .5 ? '#fff8f0' : pal.hoof);
  }
  accessorize(T, r, { top: [0, .172, .02], side: [.04, .165, .0], r: .04, tilt: -.25 });
  return T.finish(1.12);
}

export function mermaid(seed) {
  const r = rng(seed), T = new Toy('mermaid', seed), skin = pickR(r, SKIN), hair = pickR(r, HAIR), tail = pickR(r, TAIL), fin = FIN[tail], top = pickR(r, ['#c39bff', '#ff9ec7', '#ffd36e', '#9fe3ff']);
  const head = [[.05, .049, .048], [0, .165, 0]];
  // the tail: one long tapering sequin tube with a satin waistband, ending in a puffy two-lobed fin
  T.add(tubeGeo([[0, .06, 0], [0, .015, .008], [0, -.03, .014], [0, -.07, .006], [0, -.098, -.01]], .036, .014, { seg: 26, rad: 20 }), 'sequin', tail);
  T.occ.push({ c: new THREE.Vector3(0, -.01, .006), r: new THREE.Vector3(.032, .07, .03), q: new THREE.Quaternion() });
  T.cols.push({ c: new THREE.Vector3(0, .02, .004), r: .033 }, { c: new THREE.Vector3(0, -.06, .006), r: .024 }, { c: new THREE.Vector3(0, -.105, -.012), r: .03 }, { c: new THREE.Vector3(0, .13, -.035), r: .03 });
  T.add(place(new THREE.TorusGeometry(.031, .006, 10, 28), [0, .062, 0], [Math.PI / 2, 0, 0]), 'satin', fin);
  for (const s of [-1, 1]) {
    const f = new THREE.Shape(); f.moveTo(0, 0); f.bezierCurveTo(.01, -.012, .03, -.03, .052, -.034); f.quadraticCurveTo(.046, -.026, .05, -.018); f.quadraticCurveTo(.04, -.016, .043, -.006); f.quadraticCurveTo(.03, -.004, .03, .006); f.bezierCurveTo(.018, .006, .006, .004, 0, 0);
    T.add(place(puffGeo(f, .003, .007, { seg: 4, curve: 18 }), [0, -.1, -.012], [0, 0, 0], [s * 1.3, 1.3, 1]), 'satin', fin);
  }
  tag(T, [.03, .0, .0], [0, Math.PI / 2 - .2, .15]);
  T.ell([.032, .042, .026], [0, .092, 0], skin, { col: true });                                          // torso
  for (const s of [-1, 1]) {                                                                            // shell top: two ribbed satin scallops
    const g = new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { _v.fromBufferAttribute(p, i); const a = Math.atan2(_v.z, _v.x), k = 1 + .08 * Math.abs(Math.sin(a * 5)) * (1 - _v.y); p.setXYZ(i, _v.x * k, _v.y, _v.z * k); }
    g.computeVertexNormals(); T.add(place(g, [s * .015, .1, .022], [Math.PI / 2 - .2, 0, s * .25], [.014, .006, .015]), 'satin', top);
  }
  for (const s of [-1, 1]) {                                                                            // arms and hands
    T.add(tubeGeo([[s * .028, .118, 0], [s * .042, .095, .008], [s * .046, .07, .016]], .0115, .0105, { seg: 8, rad: 10 }), 'fabric', skin);
    T.ell([.012, .013, .01], [s * .047, .062, .019], skin, { occ: false, seg: 14 });
  }
  T.ell([.014, .014, .014], [0, .125, 0], skin, { occ: false, seg: 14 });                                // neck
  T.ell(...head, skin, { col: true });                                                                  // head
  eyes(T, ...head, { y: .05, x: .4, size: .17, closed: r() < .16 });
  cheeks(T, ...head, '#ff98ad', { y: -.22, x: .74 });
  smile(T, [0, .145, .0495], .0075);
  {                                                                                                      // hair: a yarn cap, bangs, long locks down the back
    const cap = new THREE.SphereGeometry(1, 30, 22, 0, Math.PI * 2, 0, 1.96);
    T.add(place(cap, head[1], [-1.0, 0, 0], [.056, .056, .055]), 'hair', hair);
    for (let i = 0; i < 5; i++) { const x = (i - 2) * .015; T.add(tubeGeo([[x * .6, .212, .01], [x, .206, .036], [x * 1.3, .195, .049]], .011, .006, { seg: 8, rad: 8 }), 'hair', hair); }
    const style = r();                                                    // long and flowing, a high ponytail, or two space buns
    const locks = style < .5 ? 14 : 8, short = style < .5 ? 1 : .45;
    for (let i = 0; i < locks; i++) {
      const a = Math.PI * (.04 + .92 * i / (locks - 1)), sx = -Math.cos(a), sz = -Math.sin(a), len = (.085 + r() * .03) * short, w = Math.sin(i * 2.1) * .006;
      const p0 = [sx * .04, .19, sz * .036], p1 = [sx * .056, .155, sz * .05], p2 = [sx * .055 + w, .155 - len * .5, sz * .046 + .004], p3 = [sx * .05 - w, .155 - len, sz * .038];
      T.add(tubeGeo([p0, p1, p2, p3], .017, .01, { seg: 14, rad: 10 }), 'hair', hair);
    }
    const tie = pickR(r, ['#ff6f9a', '#ffd84d', '#9fd8ff', '#c9a8ff', '#ffffff']);
    if (style >= .5 && style < .78) {                                     // ponytail: a scrunchie at the back of the crown and a big swishy tail
      T.add(place(new THREE.TorusGeometry(.013, .006, 10, 24), [0, .205, -.035], [1.1, 0, 0]), 'satin', tie);
      for (let k = 0; k < 3; k++) T.add(tubeGeo([[(k - 1) * .006, .207, -.04], [(k - 1) * .01, .2, -.075], [(k - 1) * .014, .165, -.088], [(k - 1) * .01, .12, -.078]], .016, .007, { seg: 14, rad: 10 }), 'hair', hair);
      T.cols.push({ c: new THREE.Vector3(0, .17, -.075), r: .022 });
    } else if (style >= .78) {                                            // space buns, each with a little bow-coloured band
      for (const s of [-1, 1]) {
        T.ell([.022, .02, .022], [s * .036, .208, -.006], hair, { mat: 'hair', seg: 18, lump: .06 });
        T.add(place(new THREE.TorusGeometry(.016, .004, 8, 22), [s * .033, .195, -.005], [Math.PI / 2 - .2, 0, -s * .5]), 'satin', tie);
      }
    }
    if (r() < .6) T.add(place(puffGeo(starShape(.014, .007, 5, .3), .002, .003, { seg: 2, curve: 6 }), [.036, .205, .022], [0, .5, .3]), 'felt', '#ffd84d');
  }
  accessorize(T, r, { top: [0, .205, .006], side: [.045, .19, .0], r: .042, tilt: -.45, tiara: true });
  return T.finish(1.0);
}

/** a puffy friend with a face (stars, hearts, starfish) */
function facePillow(kind, seed, shape, color, { depth = .022, puff = .018, face = [0, 0], dots = null } = {}) {
  const r = rng(seed), T = new Toy(kind, seed), z = depth / 2 + puff * .96;
  T.add(puffGeo(shape, depth, puff, { seg: 6 }), 'fabric', null, { paint: dots ? (p) => dots(p) : null });
  if (!dots) T.parts[T.parts.length - 1].color = new THREE.Color(color);
  const seamCol = new THREE.Color(color || '#ffffff'); if (dots) seamCol.copy(dots(new THREE.Vector3(9, 9, 9))); seamCol.multiplyScalar(.82);
  const low = edgeSeam(T, shape, puff * .8 + .0004, seamCol);
  tag(T, [low.x + .012, low.y + .004, 0], [0, 0, .5]);
  const [fx, fy] = face, er = .0075;
  for (const s of [-1, 1]) T.add(ellGeo([er, er, er * .75], [fx + s * .017, fy + .008, z + .0015], [0, 0, 0], { seg: 14, lump: 0 }), 'eye', null);
  for (const s of [-1, 1]) T.add(ellGeo([.008, .006, .0025], [fx + s * .028, fy - .006, z + .0012], [0, 0, 0], { seg: 12, lump: 0 }), 'felt', '#ff8fb0');
  smile(T, [fx, fy - .008, z + .0032], .007);
  T.occluder([fx, fy, 0], [.06, .06, z]); T.parts[0].self = 0;
  const n = 4; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + .4; T.cols.push({ c: new THREE.Vector3(Math.cos(a) * .028, Math.sin(a) * .028, 0), r: z * 1.02 }); }
  T.cols.push({ c: new THREE.Vector3(0, 0, 0), r: z * 1.05 });
  void r; return T;
}
export function star(seed) { const r = rng(seed); return facePillow('star', seed, starShape(.072, .036, 5, .28), pickR(r, ['#ffd84d', '#ffe27a', '#ffc6e0', '#c9b8ff']), { face: [0, -.004] }).finish(1.3); }
export function heart(seed) { const r = rng(seed); return facePillow('heart', seed, heartShape(.13), pickR(r, ['#ff6f9a', '#ff9cc0', '#e8506f', '#c99bff']), { face: [0, .006] }).finish(1.3); }
export function starfish(seed) {
  const r = rng(seed), base = new THREE.Color(pickR(r, ['#ff9a6b', '#ff8fb3', '#ffb84d', '#c99bff'])), dot = base.clone().lerp(new THREE.Color('#fff4e0'), .55);
  return facePillow('starfish', seed, starShape(.078, .03, 5, .34), null, { face: [0, -.004], depth: .016, puff: .015, dots: (p) => (noise3(p.x * 160, p.y * 160, p.z * 160) > .72 ? dot : base) }).finish(1.3);
}
export function rainbow(seed) {
  const r = rng(seed), T = new Toy('rainbow', seed), bands = ['#ff6b6b', '#ffa94d', '#ffe066', '#69db7c', '#4dabf7', '#b197fc'];
  bands.forEach((c, i) => T.add(place(new THREE.TorusGeometry(.068 - i * .0095, .0058, 10, 36, Math.PI), [0, -.01, 0]), 'fabric', c));
  for (const s of [-1, 1]) {
    for (const [x, y, rr] of [[0, 0, .02], [s * .016, .006, .016], [-s * .014, .004, .015], [0, .014, .014]]) T.ell([rr, rr * .9, rr * .9], [s * .058 + x, -.012 + y, 0], '#ffffff', { seg: 16 });
    T.cols.push({ c: new THREE.Vector3(s * .058, -.008, 0), r: .024 });
  }
  T.cols.push({ c: new THREE.Vector3(0, .05, 0), r: .02 }, { c: new THREE.Vector3(-.035, .035, 0), r: .016 }, { c: new THREE.Vector3(.035, .035, 0), r: .016 });
  tag(T, [-.058, -.03, 0], [0, 0, .3]);
  const side = r() < .5 ? .058 : -.058;
  for (const s of [-1, 1]) T.add(ellGeo([.0048, .0048, .0035], [side + s * .0065, -.006, .0215], [0, 0, 0], { seg: 10, lump: 0 }), 'eye', null);
  smile(T, [side, -.0135, .0222], .0045);
  return T.finish(1.4);
}
/** a scallop shell pillow: a fan with a wavy top edge, ribs in two tones, a face, and a pearl at its hinge */
export function shell(seed) {
  const r = rng(seed), base = new THREE.Color(pickR(r, ['#ffb3cc', '#ffd0b0', '#dcc8ff', '#bfe6ff'])), rib = base.clone().lerp(new THREE.Color('#fff6f0'), .45);
  const sh = new THREE.Shape(), N = 7, R = .07; sh.moveTo(-.016, -.05);
  for (let i = 0; i <= N; i++) { const a = Math.PI * (.93 - .86 * i / N), am = Math.PI * (.93 - .86 * (i - .5) / N); if (i === 0) sh.lineTo(Math.cos(a) * R, Math.sin(a) * R - .02); else sh.quadraticCurveTo(Math.cos(am) * R * 1.14, Math.sin(am) * R * 1.14 - .02, Math.cos(a) * R, Math.sin(a) * R - .02); }
  sh.lineTo(.016, -.05); sh.lineTo(-.016, -.05);
  const T = facePillow('shell', seed, sh, null, { face: [0, .005], depth: .018, puff: .016, dots: (p) => (Math.cos(Math.atan2(p.y + .045, p.x) * N * 2) > .2 ? rib : base) });
  T.add(place(new THREE.SphereGeometry(.014, 24, 16), [0, -.052, .012]), 'pearl', null);
  return T.finish(1.35);
}
export function fish(seed) {
  const r = rng(seed), T = new Toy('fish', seed), [a, b] = pickR(r, [['#ffb347', '#ffffff'], ['#5ec8ff', '#ffe16b'], ['#ff7fb0', '#fff0f6'], ['#b48cff', '#ffe0f4']]);
  const A = new THREE.Color(a), B = new THREE.Color(b);
  T.ell([.06, .046, .032], [0, 0, 0], null, { paint: (p) => (Math.sin(p.x * 120) > .55 ? B : A) });
  T.parts[T.parts.length - 1].color = A;
  const t = new THREE.Shape(); t.moveTo(0, 0); t.bezierCurveTo(.02, .03, .045, .045, .05, .036); t.quadraticCurveTo(.036, 0, .05, -.036); t.bezierCurveTo(.045, -.045, .02, -.03, 0, 0);
  T.add(place(puffGeo(t, .006, .007, { seg: 4 }), [-.052, 0, 0], [0, 0, Math.PI]), 'satin', b);
  const d = new THREE.Shape(); d.moveTo(-.02, 0); d.quadraticCurveTo(-.005, .03, .022, .016); d.lineTo(.02, 0); d.lineTo(-.02, 0);
  T.add(place(puffGeo(d, .002, .004, { seg: 3 }), [0, .036, 0]), 'satin', b);
  for (const s of [-1, 1]) {
    const er = .011, at = [.03, .012, s * .026];
    T.add(ellGeo([er, er, er * .55], at, [0, s * .9, 0], { seg: 14, lump: 0 }), 'eye', null);
    T.add(ellGeo([.008, .006, .002], [.04, -.012, s * .023], [0, s * .9, 0], { seg: 12, lump: 0 }), 'felt', '#ff8fb0');
  }
  tag(T, [-.03, -.04, .0], [0, 0, -.25]);
  T.cols.push({ c: new THREE.Vector3(.03, 0, 0), r: .036 }, { c: new THREE.Vector3(-.03, 0, 0), r: .034 }, { c: new THREE.Vector3(-.075, 0, 0), r: .022 });
  return T.finish(1.4);
}

// ---------------------------------------------------------------- the golden one: one rare toy per machine
const GOLD = new THREE.Color('#ffb21f'), twinklers = new Set();
let GOLDMAT = null, sparkTex = null;
/** the four-pointed sparkle picture the rare toys' twinkles use (made once) */
function sparkTexture() {
  if (sparkTex) return sparkTex;
  {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.2, 'rgba(255,240,180,.6)'); gr.addColorStop(1, 'rgba(255,220,120,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#fff'; g.beginPath(); g.moveTo(32, 0); g.quadraticCurveTo(34, 30, 64, 32); g.quadraticCurveTo(34, 34, 32, 64); g.quadraticCurveTo(30, 34, 0, 32); g.quadraticCurveTo(30, 30, 32, 0); g.fill();
    sparkTex = new THREE.CanvasTexture(cv); sparkTex.colorSpace = THREE.SRGBColorSpace;
  }
  return sparkTex;
}
/** turn a toy golden: its cloth (and fur) shimmers gold, its yarn turns champagne, and a few sparkles circle it */
export function makeGolden(toy) {
  if (toy.userData.golden) return toy;
  toy.userData.golden = true; toy.userData.toy.emoji = '\u{1F31F}';
  if (!GOLDMAT) GOLDMAT = fabricify(new THREE.MeshPhysicalMaterial({ vertexColors: true, metalness: .82, roughness: .3, sheen: 1, sheenRoughness: .3, sheenColor: new THREE.Color(1, .8, .35), iridescence: .25, iridescenceIOR: 1.5, envMapIntensity: 2.4, emissive: new THREE.Color(.16, .09, 0) }), { freq: 390, bump: .9, tone: .05 });
  const M = plushMaterials(), g3 = GOLD.toArray();
  toy.traverse((o) => {
    if (o.userData.fur) { furMeshes.delete(o); o.visible = false; return; }        // gold lamé is short and shiny: no pile
    if (!o.isMesh || o.isInstancedMesh) return;
    const tint = o.material === M.fabric ? .92 : o.material === M.hair || o.material === M.felt ? .45 : 0; if (!tint) return;
    const c = o.geometry.attributes.color;
    for (let i = 0; i < c.count; i++) { const v = [c.getX(i), c.getY(i), c.getZ(i)], ao = Math.min(1, Math.max(...v) * 1.15); c.setXYZ(i, ...v.map((x, k) => THREE.MathUtils.lerp(x, g3[k] * ao, tint))); }
    c.needsUpdate = true; if (o.material === M.fabric) o.material = GOLDMAT;
  });
  sparkTexture();
  const R = toy.userData.toy.radius * .8, n = 12, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(R * (.7 + Math.random() * .4)); pos.set(v.toArray(), i * 3); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const sp = new THREE.Points(geo, new THREE.PointsMaterial({ map: sparkTex, size: .045, color: new THREE.Color(4, 3.2, 1.8), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  sp.userData.spark = true; sp.frustumCulled = false; toy.add(sp); twinklers.add(sp);
  return toy;
}
/** the ultra-rare sparkly one: holographic pearly cloth that shifts through every colour as it turns, and rainbow sparkles */
let HOLOMAT = null;
export function makeSparkly(toy) {
  if (toy.userData.golden || toy.userData.sparkly) return toy;
  toy.userData.sparkly = true; toy.userData.toy.emoji = '\u{1F48E}';
  if (!HOLOMAT) HOLOMAT = fabricify(new THREE.MeshPhysicalMaterial({ vertexColors: true, metalness: .3, roughness: .28, iridescence: 1, iridescenceIOR: 2.1, iridescenceThicknessRange: [180, 820], sheen: 1, sheenRoughness: .3, sheenColor: new THREE.Color(.9, .85, 1), clearcoat: .6, envMapIntensity: 1.8 }), { freq: 390, bump: .7, tone: .03 });
  const M = plushMaterials(), pearl = new THREE.Color('#f4f0ff');
  toy.traverse((o) => {
    if (o.userData.fur) { furMeshes.delete(o); o.visible = false; return; }
    if (!o.isMesh || o.isInstancedMesh) return;
    const tint = o.material === M.fabric ? .8 : o.material === M.hair || o.material === M.felt ? .35 : 0; if (!tint) return;
    const c = o.geometry.attributes.color, g3 = pearl.toArray();
    for (let i = 0; i < c.count; i++) { const v = [c.getX(i), c.getY(i), c.getZ(i)], ao = Math.min(1, Math.max(...v) * 1.1); c.setXYZ(i, ...v.map((x, k) => THREE.MathUtils.lerp(x, g3[k] * ao, tint))); }
    c.needsUpdate = true; if (o.material === M.fabric) o.material = HOLOMAT;
  });
  sparkTexture();
  const R = toy.userData.toy.radius * .8, n = 16, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), hue = new THREE.Color();
  for (let i = 0; i < n; i++) { pos.set(new THREE.Vector3().randomDirection().multiplyScalar(R * (.7 + Math.random() * .4)).toArray(), i * 3); hue.setHSL(i / n, 1, .65); col.set([hue.r * 3, hue.g * 3, hue.b * 3], i * 3); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const sp = new THREE.Points(geo, new THREE.PointsMaterial({ map: sparkTex, size: .045, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  sp.userData.spark = true; sp.frustumCulled = false; toy.add(sp); twinklers.add(sp);
  return toy;
}
/** the golden toys' sparkles turn and twinkle (call every frame) */
export function twinkle(t) { for (const sp of twinklers) { if (!sp.parent) { twinklers.delete(sp); continue; } sp.rotation.y = t * .7; sp.rotation.x = Math.sin(t * .5) * .3; sp.material.size = .03 + .025 * Math.abs(Math.sin(t * 5.3)); sp.material.opacity = .6 + .4 * Math.sin(t * 7.1); } }

/** what goes in each machine: mostly the hero toys, plus friends */
// ---------------------------------------------------------------- accessories: some toys come with a bow, a tiara or a flower crown
const BOWS = ['#ff5f8f', '#ff9ccb', '#b48cff', '#5fc8ff', '#ffd84d', '#ff6b6b'];
/** a satin bow: two puffy loops, two tails and a knot */
function bow(T, p, rot, color, k = 1) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(k, k, k));
  const parts = [];
  for (const s of [-1, 1]) {
    parts.push(ellGeo([.016, .011, .006], [s * .015, .002, 0], [0, 0, s * .35], { seg: 16, lump: .02 }));
    parts.push(ellGeo([.004, .012, .003], [s * .006, -.012, -.001], [0, 0, s * .4], { seg: 10, lump: 0 }));
  }
  parts.push(ellGeo([.006, .007, .006], [0, 0, .002], [0, 0, 0], { seg: 12, lump: 0 }));
  parts.forEach((g) => g.applyMatrix4(m)); T.add(parts, 'satin', color);
}
/** a little gold tiara: a curved band, three points and a pink pearl in the middle */
function tiara(T, c, r, tilt) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...c), new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, 0, 0)), new THREE.Vector3(1, 1, 1)), parts = [];
  parts.push(new THREE.TorusGeometry(r * .9, .0042, 8, 30, Math.PI * .9).rotateZ(Math.PI * .05).rotateX(Math.PI / 2 - .35));
  for (const a of [-.5, 0, .5]) { const h = a ? .022 : .032; parts.push(new THREE.ConeGeometry(.006, h, 8).translate(Math.sin(a) * r * .9, h / 2 + .002, Math.cos(a) * r * .9 * .94)); }
  parts.forEach((g) => g.applyMatrix4(m)); T.add(parts, 'gold', null);
  T.add(place(new THREE.SphereGeometry(.008, 14, 10), [0, .026, r * .85]).applyMatrix4(m), 'pearl', null);
}
/** a crown of little felt flowers around the top of the head */
function flowerCrown(T, c, r, tilt, rr) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...c), new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, 0, 0)), new THREE.Vector3(1, 1, 1));
  const cols = [pickR(rr, ['#ff8fb8', '#ffffff', '#c9a8ff', '#ffb36b']), pickR(rr, ['#fff3a0', '#9fd8ff', '#ff9fd0'])];
  for (let i = 0; i < 6; i++) {
    const a = (i / 5 - .5) * 2.4, fx = Math.sin(a) * r, fz = Math.cos(a) * r, col = cols[i % 2], petals = [];
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(fx, r * .6, fz).normalize()), fm = new THREE.Matrix4().compose(new THREE.Vector3(fx, 0, fz), q, new THREE.Vector3(1, 1, 1));
    for (let k = 0; k < 5; k++) { const b = k / 5 * Math.PI * 2; petals.push(ellGeo([.0095, .006, .0026], [Math.cos(b) * .0105, Math.sin(b) * .0105, 0], [0, 0, b], { seg: 8, lump: 0 })); }
    petals.forEach((g) => g.applyMatrix4(fm).applyMatrix4(m)); T.add(petals, 'felt', col);
    T.add(ellGeo([.005, .005, .0035], [0, 0, .002], [0, 0, 0], { seg: 8, lump: 0 }).applyMatrix4(fm).applyMatrix4(m), 'felt', '#ffd84d');
  }
}
/** about a third of the dolls and animals wear something */
function accessorize(T, r, { top, side, r: hr, tilt, tiara: canTiara = false }) {
  const x = r(); if (x > .36) return;
  if (x < .14) bow(T, side, [0, .3, -.5], pickR(r, BOWS), 1.75);
  else if (x < .25 && canTiara) tiara(T, top, hr * .68, tilt);
  else flowerCrown(T, top, hr * .72, tilt, r);
}

// ---------------------------------------------------------------- more friends: a bunny and a kitty (unicorn machine), a seahorse and an octopus (mermaid machine)
/** a sitting bunny: round body and head, tall ears with pink felt insides, a cotton tail, big feet */
export function bunny(seed) {
  const r = rng(seed), T = new Toy('bunny', seed), body = pickR(r, ['#fbf7f2', '#efe2d2', '#ffd9e6', '#ddd6ec', '#d9f2e6']), inner = '#ffb3c9';
  const head = [[.048, .044, .045], [0, .118, .024]];
  T.ell([.05, .05, .056], [0, .052, -.012], body, { col: true, lump: .04 });
  T.ell(...head, body, { col: true });
  T.ell([.022, .016, .016], [0, .106, .064], body, {});                                                  // muzzle
  T.ell([.006, .0045, .004], [0, .114, .079], '#ff8fae', { mat: 'felt', occ: false, seg: 12, lump: 0 });  // nose
  eyes(T, ...head, { y: .3, x: .45, size: .17, closed: r() < .16 }); cheeks(T, ...head, '#ffa8c0', { y: -.05, x: .82 }); smile(T, [0, .099, .078], .006);
  for (const s of [-1, 1]) {
    T.ell([.016, .052, .011], [s * .02, .19, .012], body, { rot: [-.15, 0, -s * .22], col: true });
    T.ell([.009, .038, .004], [s * .021, .19, .023], inner, { mat: 'felt', rot: [-.15, 0, -s * .22], occ: false });
    T.ell([.018, .013, .032], [s * .028, .013, .045], body, {});                                             // big feet
    T.ell([.014, .022, .014], [s * .035, .06, .035], body, { rot: [.4, 0, s * .3] });                         // arms
  }
  T.ell([.02, .02, .02], [0, .04, -.07], '#ffffff', { mat: 'hair', seg: 16 });                                  // cotton tail
  tag(T, [.03, .03, -.06], [.3, .6, -.1]);
  accessorize(T, r, { top: [0, .158, .022], side: [.03, .16, .02], r: .034, tilt: -.2 });
  return T.finish(1.15);
}
/** a sitting kitty: pointy ears, whiskers, a long curling tail, tabby stripes on some */
export function kitty(seed) {
  const r = rng(seed), T = new Toy('kitty', seed), [base, stripe] = pickR(r, [['#ffb366', '#f08a2e'], ['#c9c4cf', '#9a93a3'], ['#fbf7f2', null], ['#3a3440', null], ['#ffd9b0', '#e8a868']]);
  const A = new THREE.Color(base), B = stripe ? new THREE.Color(stripe) : A, tabby = (p) => (Math.sin(p.y * 260 + p.x * 40) > .45 ? B : A);
  const head = [[.05, .045, .045], [0, .115, .022]];
  T.ell([.048, .05, .055], [0, .052, -.012], null, { col: true, lump: .04, paint: tabby });
  T.ell(...head, null, { col: true, paint: tabby });
  T.ell([.02, .014, .014], [0, .103, .062], '#fff6ee', {});
  T.ell([.006, .004, .004], [0, .11, .074], '#ff8fae', { mat: 'felt', occ: false, seg: 12, lump: 0 });
  eyes(T, ...head, { y: .25, x: .5, size: .19, lash: base === '#3a3440' ? 0xfff0f0 : 0x2a1a22, closed: r() < .16 }); cheeks(T, ...head, '#ffa8c0', { y: -.08, x: .82 });
  for (const s of [-1, 1]) {
    const ear = new THREE.LatheGeometry([[0, 0], [.018, .001], [.012, .02], [.004, .03], [0, .032]].map(([x, y]) => new THREE.Vector2(x, y)), 4);
    T.add(place(ear, [s * .03, .148, .012], [-.1, Math.PI / 4, -s * .3], [1, 1, .6]), 'fabric', base);
    for (const k of [-1, 0, 1]) T.add(tubeGeo([[s * .014, .104 + k * .004, .071], [s * .04, .106 + k * .009, .07], [s * .06, .108 + k * .015, .062]], .0009, .0007, { seg: 6, rad: 4 }), 'felt', base === '#3a3440' ? '#ffffff' : '#5a4a50');
    T.ell([.017, .013, .03], [s * .026, .013, .045], null, { paint: tabby });
  }
  T.add(tubeGeo([[0, .03, -.06], [.03, .02, -.09], [.06, .05, -.09], [.065, .09, -.07], [.05, .1, -.05]], .011, .008, { seg: 18, rad: 10 }), 'fabric', null);
  T.parts[T.parts.length - 1].paint = tabby;
  T.cols.push({ c: new THREE.Vector3(.05, .06, -.085), r: .018 });
  tag(T, [-.03, .03, -.06], [.3, -.6, .1]);
  accessorize(T, r, { top: [0, .158, .02], side: [.034, .15, .02], r: .036, tilt: -.25 });   // (a kitty can wear a bow or flowers too)
  return T.finish(1.15);
}
/** a seahorse: an S-shaped body that curls into its tail, a snout, a little crest and a fin on its back */
export function seahorse(seed) {
  const r = rng(seed), T = new Toy('seahorse', seed), c = new THREE.Color(pickR(r, ['#ffc23a', '#ff7f6a', '#3fc4b8', '#a77fff', '#ff6fb8'])), belly = c.clone().lerp(new THREE.Color('#fff8e8'), .5);
  const ring = c.clone().multiplyScalar(.82), paint = (p, n) => (n.z > .72 ? belly : Math.sin(p.y * 330) > .55 ? ring : c);   // a pale belly and the ridged rings seahorses have
  T.ell([.03, .042, .03], [0, .052, .012], null, { col: true, paint });                                   // the potbelly
  T.add(tubeGeo([[0, .085, .0], [-.002, .105, -.006], [0, .122, -.002]], .02, .017, { seg: 10, rad: 14 }), 'fabric', null, { paint });   // neck
  const head = [[.026, .025, .03], [0, .132, .006]];
  T.ell(...head, null, { col: true, rot: [.35, 0, 0], paint });
  T.add(tubeGeo([[0, .127, .028], [0, .12, .048], [0, .114, .066]], .0095, .0078, { seg: 8, rad: 12 }), 'fabric', null, { paint: () => c });   // snout
  T.add(tubeGeo([[0, .02, .004], [0, -.012, -.008], [-.004, -.04, -.012], [.004, -.06, -.004], [.016, -.06, .006], [.016, -.046, .01], [.006, -.042, .004]], .02, .006, { seg: 30, rad: 12 }), 'fabric', null, { paint });   // the curly tail
  for (let i = 0; i < 4; i++) T.ell([.006, .013, .006], [0, .158 - i * .016, -.016 - i * .008], c, { mat: 'felt', rot: [-.6 - i * .2, 0, 0], occ: false, seg: 10 });   // crest
  const f = new THREE.Shape(); f.moveTo(0, 0); f.quadraticCurveTo(-.032, .012, -.024, .042); f.lineTo(0, .034); f.closePath();
  T.add(place(puffGeo(f, .002, .004, { seg: 3 }), [-.002, .036, -.016], [0, Math.PI / 2, 0]), 'satin', c.clone().lerp(new THREE.Color('#ffffff'), .3));
  eyes(T, ...head, { y: .2, x: .66, size: .21 }); cheeks(T, ...head, '#ff9fb8', { y: -.2, x: .86 });
  T.cols.push({ c: new THREE.Vector3(0, .1, 0), r: .022 }, { c: new THREE.Vector3(0, -.035, -.004), r: .02 });
  tag(T, [-.016, .0, -.01], [0, -1.2, .2]);
  return T.finish(1.35);
}
/** an octopus: a big soft dome of a head and eight curly legs with paler suckers underneath */
export function octopus(seed) {
  const r = rng(seed), T = new Toy('octopus', seed), c = new THREE.Color(pickR(r, ['#b48cff', '#ff8fb3', '#ff9a6b', '#6fd3e0', '#ff6f9a'])), pale = c.clone().lerp(new THREE.Color('#fff4ee'), .55);
  const head = [[.046, .046, .043], [0, .068, 0]];
  T.ell(...head, c, { col: true, lump: .05 });
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2 + .2, ca = Math.cos(a), sa = Math.sin(a), curl = (r() - .5) * .02;
    T.add(tubeGeo([[ca * .028, .035, sa * .028], [ca * .058, .012, sa * .058], [ca * .085, .008, sa * .085 + curl], [ca * .095, .022, sa * .095], [ca * .085, .03, sa * .085]], .014, .005, { seg: 18, rad: 10 }), 'fabric', null, { paint: (p, n) => (n.y < -.4 ? pale : c) });
  }
  eyes(T, ...head, { y: .05, x: .42, size: .2 }); cheeks(T, ...head, '#ff9fb8', { y: -.22, x: .8 }); smile(T, [0, .048, .044], .008);
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + .6; T.cols.push({ c: new THREE.Vector3(Math.cos(a) * .065, .015, Math.sin(a) * .065), r: .025 }); }
  tag(T, [.04, .04, -.02], [0, 2.2, .2]);
  return T.finish(1.2);
}

/** a baby dragon: chubby, a paler tummy, two little horns, felt wings, spikes down its back and a spade on its tail */
export function dragon(seed) {
  const r = rng(seed), T = new Toy('dragon', seed), c = new THREE.Color(pickR(r, ['#7fd8a8', '#b49cff', '#ff9fc0', '#7fc4ff', '#ffb36b'])), tum = c.clone().lerp(new THREE.Color('#fff6e0'), .6), horn = '#fff1c4';
  const plate = tum.clone().multiplyScalar(.9), paint = (p, n) => (n.z > .55 && p.y < .1 ? (Math.sin(p.y * 280) > .75 ? plate : tum) : c);   // a ridged dragon tummy
  const head = [[.05, .046, .046], [0, .118, .02]];
  T.ell([.05, .052, .055], [0, .052, -.008], null, { col: true, paint, lump: .04 });
  T.ell(...head, null, { col: true, paint: () => c });
  T.ell([.03, .019, .022], [0, .1, .058], c, {});                                                        // a little snout
  for (const s of [-1, 1]) T.ell([.0025, .0035, .0015], [s * .01, .105, .079], '#5a3a4a', { mat: 'felt', occ: false, seg: 8, lump: 0 });
  for (let i = 0; i < 3; i++) T.ell([.004, .01, .007], [0, .165 - i * .006, .02 - i * .022], tum, { mat: 'felt', rot: [-.3 - i * .4, 0, 0], occ: false, seg: 10 });   // head spikes
  eyes(T, ...head, { y: .25, x: .52, size: .18, closed: r() < .16 }); cheeks(T, ...head, '#ff9fb8', { y: -.12, x: .84 }); smile(T, [0, .094, .079], .007);
  for (const s of [-1, 1]) {
    T.add(tubeGeo([[s * .024, .148, .01], [s * .03, .168, .0], [s * .036, .18, -.016]], .0075, .0025, { seg: 8, rad: 8 }), 'felt', horn);   // curved horns
    const w = new THREE.Shape(); w.moveTo(0, 0); w.quadraticCurveTo(.02, .05, .055, .045); w.quadraticCurveTo(.045, .03, .05, .018); w.quadraticCurveTo(.035, .018, .036, .006); w.quadraticCurveTo(.02, .008, 0, 0);
    T.add(place(puffGeo(w, .002, .004, { seg: 3 }), [s * .04, .08, -.035], [0, -s * .7, s * .2], [s * 1.5, 1.5, 1.5]), 'satin', tum);   // wings (big enough to see from the front)
    T.ell([.017, .012, .03], [s * .028, .013, .045], c, {});                                               // feet
    T.ell([.013, .02, .013], [s * .036, .06, .035], c, { rot: [.4, 0, s * .3] });                           // arms
  }
  for (let i = 0; i < 5; i++) { const a = .3 + i * .32; T.ell([.005, .011, .008], [0, .1 + Math.cos(a) * .03 - i * .016, -.035 - Math.sin(a) * .02 - i * .008], tum, { mat: 'felt', rot: [-.5 - i * .25, 0, 0], occ: false, seg: 10 }); }   // back spikes
  T.add(tubeGeo([[0, .03, -.06], [.02, .015, -.09], [.05, .012, -.1], [.07, .02, -.09]], .016, .007, { seg: 16, rad: 10 }), 'fabric', c);   // tail
  const sp = new THREE.Shape(); sp.moveTo(0, -.012); sp.quadraticCurveTo(.014, 0, 0, .016); sp.quadraticCurveTo(-.014, 0, 0, -.012);
  T.add(place(puffGeo(sp, .002, .003, { seg: 2 }), [.078, .024, -.086], [0, 0, -1.2]), 'felt', tum);
  T.cols.push({ c: new THREE.Vector3(.05, .015, -.095), r: .016 });
  tag(T, [-.03, .03, -.06], [.3, -.6, .1]);
  return T.finish(1.15);
}
/** a sea turtle: a domed shell with darker plates, a paler tummy, a smiley head and four flippers */
export function turtle(seed) {
  const r = rng(seed), T = new Toy('turtle', seed), shellC = new THREE.Color(pickR(r, ['#3fb07a', '#2fa6a0', '#8fbf4a', '#c08a4a'])), line = shellC.clone().multiplyScalar(.62), skin = new THREE.Color(pickR(r, ['#a8e6a0', '#9fe0d8', '#cfe89a']));
  const plates = (p) => (Math.min(Math.abs(Math.sin(p.x * 95)), Math.abs(Math.sin(p.z * 95 + p.x * 48))) < .18 ? line : shellC);
  T.ell([.07, .036, .075], [0, .04, 0], null, { col: true, paint: plates, lump: .03 });                    // shell
  T.add(place(new THREE.TorusGeometry(.068, .007, 8, 40).scale(1, 1.08, 1), [0, .022, 0], [Math.PI / 2, 0, 0]), 'fabric', line);   // its rim
  T.ell([.062, .016, .066], [0, .016, 0], skin.clone().lerp(new THREE.Color('#fff7e0'), .45), {});         // tummy
  const head = [[.03, .028, .032], [0, .045, .088]];
  T.ell(...head, skin, { col: true });
  eyes(T, ...head, { y: .3, x: .55, size: .22 }); cheeks(T, ...head, '#ff9fb8', { y: -.1, x: .85 }); smile(T, [0, .036, .117], .007);
  for (const [x, z, s] of [[.06, .045, 1], [-.06, .045, -1], [.05, -.055, 1], [-.05, -.055, -1]]) T.ell([.034, .008, .018], [x, .018, z], skin, { rot: [0, z > 0 ? -s * .5 : s * .4, -s * .2] });   // flippers
  T.ell([.008, .006, .016], [0, .018, -.08], skin, {});
  T.cols.push({ c: new THREE.Vector3(.04, .02, .03), r: .03 }, { c: new THREE.Vector3(-.04, .02, -.03), r: .03 });
  tag(T, [.05, .02, -.05], [0, 2.3, .2]);
  return T.finish(1.2);
}

export const THEMES = {
  unicorn: { hero: unicorn, friends: [star, heart, rainbow, bunny, kitty, dragon], heroShare: .58 },
  mermaid: { hero: mermaid, friends: [starfish, shell, fish, seahorse, octopus, turtle], heroShare: .53 },
};
export function makeToy(theme, i, seed) {
  const th = THEMES[theme], r = rng(seed * 31 + 7);
  const fn = r() < th.heroShare ? th.hero : th.friends[i % th.friends.length];
  return fn(seed);
}
