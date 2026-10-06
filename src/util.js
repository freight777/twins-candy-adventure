import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ---------- toon material (soft cartoon shading shared by everything) ----------
const gradientMap = new THREE.DataTexture(new Uint8Array([90, 160, 220, 255]), 4, 1, THREE.RedFormat);
gradientMap.minFilter = gradientMap.magFilter = THREE.NearestFilter;
gradientMap.needsUpdate = true;

// STYLE 'toon' = flat cartoon shading with outlines. STYLE 'candy' = glossy, soft "animated movie" look (no outlines).
// A scene switches style while it builds itself, so one scene can look like a cartoon and the next like a film.
let STYLE = 'toon';
export const setStyle = (s) => { STYLE = s; };
export const getStyle = () => STYLE;
/** a new material in the current style. opts.cheap = plain MeshStandardMaterial (no clearcoat/sheen) for big scenery surfaces */
export function makeToon(color, { cheap, unique, ...opts } = {}) {
  if (cheap && STYLE !== 'toon') return new THREE.MeshStandardMaterial({ color, roughness: opts.map ? 0.8 : 0.5, ...opts });
  return STYLE === 'film'
    ? new THREE.MeshPhysicalMaterial({ color, roughness: 0.6, clearcoat: 0.1, clearcoatRoughness: 0.4, sheen: 0.6, sheenRoughness: 0.5, sheenColor: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.5), ...opts })
    : STYLE === 'candy'
    ? new THREE.MeshPhysicalMaterial({ color, roughness: opts.map ? 0.78 : 0.34, clearcoat: opts.map ? 0 : 0.75, clearcoatRoughness: 0.16, ...opts })
    : new THREE.MeshToonMaterial({ color, gradientMap, ...opts });
}
/** key for a material recipe, or null when it can't be shared (textures, functions) */
export function recipeKey(...parts) {
  const out = [];
  const add = (v) => {
    if (v == null || typeof v !== 'object') { out.push(String(v)); return true; }
    if (v.isColor) { out.push('#' + v.getHexString()); return true; }
    if (v.isTexture && keep.has(v)) { out.push('tex:' + v.uuid); return true; }      // a shared texture can be part of a shared recipe
    if (v.isTexture || v.isMaterial || typeof v === 'function') return false;
    for (const k of Object.keys(v).sort()) { out.push(k + '='); if (!add(v[k])) return false; }
    return true;
  };
  for (const p of parts) if (!add(p)) return null;
  return out.join('|');
}
/** materials/textures shared between objects and scenes: never disposed (a WeakSet, because .clone() copies userData) */
export const keep = new WeakSet([gradientMap]);
const matCache = new Map();
/**
 * The standard cartoon/candy material. Identical recipes share ONE material (hundreds of meshes, a handful of shaders and
 * uniform uploads). Pass { unique: true } for a material you will change later (fade, recolour); textured ones are always unique.
 */
export function toon(color, opts = {}) {
  if (opts.unique || (opts.map && !keep.has(opts.map))) return makeToon(color, opts);
  const k = recipeKey(STYLE, typeof color === 'number' ? color : new THREE.Color(color).getHex(), opts);
  if (k === null) return makeToon(color, opts);
  let m = matCache.get(k);
  if (!m) { m = makeToon(color, opts); keep.add(m); matCache.set(k, m); }
  return m;
}
/** a shared material made by any factory, cached by its recipe (used for the candy materials) */
export function shared(make, ...recipe) {
  const k = recipeKey('shared', make.name, ...recipe);
  let m = k !== null && matCache.get(k);
  if (!m) { m = make(...recipe); keep.add(m); if (k !== null) matCache.set(k, m); }
  return m;
}
/** free an object's GPU memory, but never the shared materials/textures other scenes still use */
export function disposeObject(root) {
  root.traverse((o) => {
    if (o.geometry && !keep.has(o.geometry)) o.geometry.dispose();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
      if (keep.has(m)) return;
      for (const v of Object.values(m)) if (v && v.isTexture && !keep.has(v)) v.dispose();
      m.dispose();
    });
  });
}
/**
 * Merge the meshes under `root` that share a material into one mesh each (one draw call instead of dozens), in root's own
 * space so the object can still move, wobble and be tapped. Left alone: anything under a node with userData.dynamic,
 * invisible hit spheres, hidden or multi-material meshes, skinned/instanced meshes and compressed (non-float) geometry.
 */
const SIG_PROPS = ['type', 'roughness', 'metalness', 'clearcoat', 'clearcoatRoughness', 'sheen', 'sheenRoughness', 'emissiveIntensity', 'side', 'flatShading', 'opacity', 'transparent', 'depthWrite', 'envMapIntensity', 'toneMapped', 'fog', 'ior', 'specularIntensity', 'iridescence', 'transmission', 'alphaTest'];
const sigCache = new WeakMap(), colourMats = new Map();
/** the recipe of a shared, untextured material WITHOUT its colour (null if it can't be merged by colour) */
function colourFree(m) {
  if (sigCache.has(m)) return sigCache.get(m);
  let s = null;
  if (keep.has(m) && !m.vertexColors && m.color && !Object.entries(m).some(([k, v]) => v && v.isTexture && k !== 'gradientMap')) {
    s = SIG_PROPS.map((p) => String(m[p])).join(',') + '|' + (m.emissive ? m.emissive.getHex() : '') + '|' + (m.gradientMap ? m.gradientMap.uuid : '');
  }
  sigCache.set(m, s); return s;
}
/** one vertex-coloured copy of a recipe (white base colour, the per-vertex colours carry the look) */
function colourMat(sig, like, sheen) {
  let m = colourMats.get(sig);
  if (!m) { m = like.clone(); m.color.set(0xffffff); m.vertexColors = true; if (m.sheenColor) m.sheenColor.copy(sheen); keep.add(m); colourMats.set(sig, m); }
  return m;
}
export function bakeStatic(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), m4 = new THREE.Matrix4();
  const groups = new Map(), take = [];
  const visit = (o, blocked) => {
    if (o !== root && o.userData.dynamic) blocked = true;
    if (o.isMesh && !blocked && o.matrixWorld.determinant() > 0 && !o.isSkinnedMesh && !o.isInstancedMesh && o.visible && !Array.isArray(o.material) && o.material.visible !== false && !o.userData.onTap && !o.userData.keep) {
      const g = o.geometry, attrs = Object.keys(g.attributes).sort();
      if (attrs.every((a) => g.attributes[a].array instanceof Float32Array && !g.attributes[a].normalized && !g.attributes[a].isInterleavedBufferAttribute) && !Object.keys(g.morphAttributes).length) {
        const sig = colourFree(o.material);
        const key = [sig ? 'c:' + sig : o.material.uuid, attrs.join(','), !!g.index, o.castShadow, o.receiveShadow, o.renderOrder].join('|');
        (groups.get(key) || groups.set(key, { mat: o.material, sig, list: [], cast: o.castShadow, receive: o.receiveShadow, order: o.renderOrder }).get(key)).list.push(o);
      }
    }
    for (const c of o.children) visit(c, blocked);
  };
  visit(root, false);
  for (const grp of groups.values()) {
    if (grp.list.length < 2) continue;
    const mats = new Set(grp.list.map((o) => o.material)), byColour = mats.size > 1;   // several colours of one recipe -> vertex colours
    const geos = grp.list.map((o) => {
      const g = o.geometry.clone().applyMatrix4(m4.multiplyMatrices(inv, o.matrixWorld));
      if (byColour) { const c = o.material.color, n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); }
      return g;
    });
    const merged = mergeGeometries(geos, false); geos.forEach((g) => g.dispose());
    if (!merged) continue;
    let mat = grp.mat;
    if (byColour) { const sheen = new THREE.Color(0, 0, 0); mats.forEach((m) => m.sheenColor && sheen.add(m.sheenColor)); sheen.multiplyScalar(1 / mats.size); mat = colourMat(grp.sig + '|' + sheen.getHex(), grp.mat, sheen); }
    const mesh = new THREE.Mesh(merged, mat); mesh.castShadow = grp.cast; mesh.receiveShadow = grp.receive; mesh.renderOrder = grp.order;
    mesh.userData.noShadow = !grp.cast; mesh.userData.baked = true;
    root.add(mesh); take.push(...grp.list);
  }
  const gone = new Set(take);
  for (const o of take) { for (const c of [...o.children]) if (!gone.has(c)) root.attach(c); o.removeFromParent(); o.geometry.dispose(); }   // keep anything that rode on a merged mesh (glows, sprites)
  return root;
}

// Make raw shader colours (which we wrote in screen colour space) come out right when rendering through the post-processing chain.
export const linearizeFrag = (src) => src.replace('void main()', 'void origMain()')
  + '\nvoid main(){ origMain(); gl_FragColor.rgb = pow(max(gl_FragColor.rgb, vec3(0.)), vec3(2.2)); }';

/** Let this object (and everything inside it) cast shadows. */
export function shade(obj) { obj.traverse((o) => { if (o.isMesh && !o.userData.noShadow) o.castShadow = true; }); return obj; }

// mk(geometry, colorOrMaterial, [x,y,z], [sx,sy,sz]) -> Mesh
export function mk(geo, color, pos = [0, 0, 0], scale = [1, 1, 1]) {
  const mat = typeof color === 'object' ? color : toon(color);
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos);
  m.scale.set(...scale);
  return m;
}

const outlineMat = new THREE.MeshBasicMaterial({ color: 0x4a2c3a, side: THREE.BackSide }); keep.add(outlineMat);
export function outline(m, s = 1.07) {
  if (STYLE !== 'toon') return m;
  const o = new THREE.Mesh(m.geometry, outlineMat);
  o.userData.noShadow = true;
  o.scale.setScalar(s);
  m.add(o);
  return m;
}

// ---------- math ----------
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = (a) => a[Math.floor(Math.random() * a.length)];
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
export const ease = {
  linear: (t) => t,
  inOut: (t) => t * t * (3 - 2 * t),
  out: (t) => 1 - (1 - t) * (1 - t),
  in: (t) => t * t,
  outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
};

// ---------- tweens & delayed calls, owned by a scene so they die with it ----------
export class Timers {
  constructor() { this.list = []; }
  after(sec, fn) { this.list.push({ wait: sec, fn }); }
  tween(dur, fn, { ease: e = ease.inOut, done, delay = 0 } = {}) {
    this.list.push({ wait: delay, dur, t: 0, fn, e, done, tween: true });
  }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const o = this.list[i];
      if (o.wait > 0) { o.wait -= dt; if (o.wait > 0) continue; dt = -o.wait; o.wait = 0; }
      if (!o.tween) { this.list.splice(i, 1); o.fn(); continue; }
      o.t += dt;
      const k = Math.min(o.t / o.dur, 1);
      o.fn(o.e(k), k);
      if (k >= 1) { this.list.splice(i, 1); o.done && o.done(); }
    }
  }
  clear() { this.list.length = 0; }
}

// ---------- textures ----------
export function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  if (repeat) t.repeat.set(...repeat);
  return t;
}

let _glow, _star;
export function glowTex() {
  if (_glow) return _glow;
  _glow = canvasTex(128, 128, (g, w, h) => {
    const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.25, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, w, h);
  });
  keep.add(_glow); return _glow;
}
export function starTex() {
  if (_star) return _star;
  _star = canvasTex(64, 64, (g, w, h) => {
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.3, 'rgba(255,255,255,.5)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff';
    g.beginPath(); g.moveTo(32, 2); g.quadraticCurveTo(34, 30, 62, 32); g.quadraticCurveTo(34, 34, 32, 62); g.quadraticCurveTo(30, 34, 2, 32); g.quadraticCurveTo(30, 30, 32, 2); g.fill();
  });
  keep.add(_star); return _star;
}

/** an emoji as a camera-facing picture (one shared texture per emoji) */
const _emoji = new Map();
export function emojiTex(ch) {
  if (!_emoji.has(ch)) {
    const t = canvasTex(128, 128, (g, w, h) => { g.font = '100px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, w / 2, h / 2 + 8); });
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; keep.add(t); _emoji.set(ch, t);
  }
  return _emoji.get(ch);
}
export function emojiSprite(ch, size = 2.4) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTex(ch), transparent: true, depthWrite: false }));
  s.scale.set(size, size, 1);
  return s;
}
/** a sky dome: a soft gradient from the horizon colour to the zenith colour (colours as [r, g, b] 0..1) */
export function makeSky({ radius = 500, horizon = [1, .95, .88], zenith = [.4, .75, 1], k = 1.6, offset = .1, curve = .7, fog = false } = {}) {
  const v3 = (c) => `vec3(${c.map((x) => x.toFixed(3)).join(',')})`;
  return new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `varying vec3 vP; void main(){ float h = clamp(vP.y*${k.toFixed(2)}+${offset.toFixed(2)},0.,1.); gl_FragColor = vec4(mix(${v3(horizon)}, ${v3(zenith)}, pow(h,${curve.toFixed(2)})),1.); }`,
  }));
}
/** puffy clouds (each one merged into a few meshes); returns the cloud groups so the scene can drift them */
export function makeClouds(scene, n, { puffs = [4, 4], r = [3, 5], spacing = 4, colors = [0xffffff], x = [-160, 160], y = [24, 50], z = [-230, -110] } = {}) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const c = new THREE.Group(), m = Math.round(rand(puffs[0], puffs[1] + .49));
    for (let k = 0; k < m; k++) c.add(mk(new THREE.SphereGeometry(rand(r[0], r[1]), 16, 12), toon(pick(colors)), [k * spacing - (m - 1) * spacing / 2, rand(-.5, 1.2), rand(-1, 1)], [1.3, .8, .9]));
    c.position.set(rand(x[0], x[1]), rand(y[0], y[1]), rand(z[0], z[1])); c.userData.noShadow = true; c.userData.bake = true;
    scene.add(c); out.push(c);
  }
  return out;
}
/** a soft round contact shadow lying on the ground (one shared texture; each blob has its own material so it can fade) */
let _blob;
export function blobShadow(size = 2.4, opacity = .3) {
  if (!_blob) {
    _blob = canvasTex(64, 64, (g, w, h) => { const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31); gr.addColorStop(0, 'rgba(40,20,60,1)'); gr.addColorStop(.55, 'rgba(40,20,60,.55)'); gr.addColorStop(1, 'rgba(40,20,60,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
    _blob.wrapS = _blob.wrapT = THREE.ClampToEdgeWrapping; keep.add(_blob);
  }
  const m = new THREE.Mesh(shared(() => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), 'blobGeo'), new THREE.MeshBasicMaterial({ map: _blob, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  m.scale.set(size, 1, size); m.renderOrder = 1; m.userData.noShadow = true; m.userData.blob = opacity;
  return m;
}
export function glowSprite(color = 0xffffff, size = 3, opacity = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.set(size, size, 1);
  return s;
}

// Colour a geometry in stripes around its Y axis (beach ball, umbrella, candy spheres)
export function stripedGeo(geo, colors, count = colors.length) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const pos = g.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i += 3) {
    let cx = 0, cz = 0;
    for (let k = 0; k < 3; k++) { cx += pos.getX(i + k); cz += pos.getZ(i + k); }
    const idx = Math.floor(((Math.atan2(cz, cx) + Math.PI) / (2 * Math.PI)) * count) % colors.length;
    c.set(colors[idx]);
    for (let k = 0; k < 3; k++) col.set([c.r, c.g, c.b], (i + k) * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
export const vertexToon = () => toon(0xffffff, { vertexColors: true });

// ---------- sparkle particles ----------
/** the sparkle material: three's PointsMaterial (fog, size attenuation, colour space all as before) with a per-particle size */
function sparkleMaterial() {
  const m = new THREE.PointsMaterial({ size: 1, map: starTex(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aSize;').replace('gl_PointSize = size;', 'gl_PointSize = size * aSize;');
  };
  m.customProgramCacheKey = () => 'fx-sparkle';
  return m;
}
const _fxc = new THREE.Color(), WHITE = [0xffffff];
/** A ring buffer of sparkles. Every particle keeps its own size, colour, life and gravity. */
export class Fx {
  constructor(scene, max = 600) {
    this.max = max; this.i = 0;
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 3); this.base = new Float32Array(max * 3); this.size = new Float32Array(max);
    this.vel = new Float32Array(max * 3); this.life = new Float32Array(max); this.maxLife = new Float32Array(max).fill(1); this.grav = new Float32Array(max);
    const geo = new THREE.BufferGeometry(), dyn = (a, n) => new THREE.BufferAttribute(a, n).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', dyn(this.pos, 3)); geo.setAttribute('color', dyn(this.col, 3)); geo.setAttribute('aSize', dyn(this.size, 1));
    this.points = new THREE.Points(geo, sparkleMaterial());
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
    scene.add(this.points);
    this.pos.fill(9999);
  }
  /** p: where (any {x,y,z}; it is copied, so scratch vectors are fine). size is per burst and stays with those particles. */
  burst(p, { count = 30, colors = WHITE, speed = 4, gravity = -6, life = 1, size = .55, up = 0, spread = 0.1 } = {}) {
    const { pos, vel, base } = this;
    for (let n = 0; n < count; n++) {
      const i = this.i++ % this.max, i3 = i * 3;
      const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1), sp = speed * (0.35 + Math.random() * 0.65), sph = Math.sin(ph);
      pos[i3] = p.x + (Math.random() - .5) * spread; pos[i3 + 1] = p.y + (Math.random() - .5) * spread; pos[i3 + 2] = p.z + (Math.random() - .5) * spread;
      vel[i3] = sph * Math.cos(th) * sp; vel[i3 + 1] = sph * Math.sin(th) * sp + up; vel[i3 + 2] = Math.cos(ph) * sp;
      _fxc.set(colors[Math.floor(Math.random() * colors.length)]);
      base[i3] = _fxc.r; base[i3 + 1] = _fxc.g; base[i3 + 2] = _fxc.b;
      this.maxLife[i] = this.life[i] = life * (0.7 + Math.random() * 0.6);
      this.grav[i] = gravity; this.size[i] = size;
    }
    this.points.geometry.attributes.aSize.needsUpdate = true;
  }
  update(dt) {
    const { pos, vel, col, base, life, maxLife, grav } = this;
    for (let i = 0; i < this.max; i++) {
      const i3 = i * 3;
      if (life[i] <= 0) { if (col[i3] !== 0 || col[i3 + 1] !== 0 || col[i3 + 2] !== 0) { col[i3] = col[i3 + 1] = col[i3 + 2] = 0; } continue; }
      life[i] -= dt;
      vel[i3 + 1] += grav[i] * dt;
      pos[i3] += vel[i3] * dt; pos[i3 + 1] += vel[i3 + 1] * dt; pos[i3 + 2] += vel[i3 + 2] * dt;
      const k = Math.max(life[i] / maxLife[i], 0);
      col[i3] = base[i3] * k; col[i3 + 1] = base[i3 + 1] * k; col[i3 + 2] = base[i3 + 2] * k;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}

/** red-and-white stripes (one shared texture; clone it if you need a different repeat) */
let _cane;
export const candyCaneTex = () => _cane || (keep.add(_cane = canvasTex(64, 128, (g, w, h) => {
  g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.fillStyle = '#ff4d6d';
  for (let i = -2; i < 4; i++) { g.beginPath(); g.moveTo(0, i * 32); g.lineTo(w, i * 32 - 16); g.lineTo(w, i * 32 + 16); g.lineTo(0, i * 32 + 32); g.fill(); }
})), _cane);
const _swirl = new Map();
/** a lollipop swirl in two colours (shared per colour pair) */
export const swirlTex = (a, b) => _swirl.get(a + b) || (_swirl.set(a + b, canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = a; g.fillRect(0, 0, w, h); g.strokeStyle = b; g.lineWidth = 26; g.lineCap = 'round'; g.beginPath();
  for (let t = 0; t < 14; t += .05) { const r = t * 8; g.lineTo(w / 2 + Math.cos(t) * r, h / 2 + Math.sin(t) * r); } g.stroke();
})), keep.add(_swirl.get(a + b)), _swirl.get(a + b));

export const RAINBOW =[0xff4d4d, 0xff9f2e, 0xffe14d, 0x5be37d, 0x4db8ff, 0xb07cff];
export const CANDY = [0xff6fb5, 0xffd84d, 0x62e0d0, 0xb07cff, 0xff9f4d, 0xffffff];
