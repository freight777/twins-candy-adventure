import * as THREE from 'three';

// ---------- toon material (soft cartoon shading shared by everything) ----------
const gradientMap = new THREE.DataTexture(new Uint8Array([90, 160, 220, 255]), 4, 1, THREE.RedFormat);
gradientMap.minFilter = gradientMap.magFilter = THREE.NearestFilter;
gradientMap.needsUpdate = true;

// STYLE 'toon' = flat cartoon shading with outlines. STYLE 'candy' = glossy, soft "animated movie" look (no outlines).
// A scene switches style while it builds itself, so one scene can look like a cartoon and the next like a film.
let STYLE = 'toon';
export const setStyle = (s) => { STYLE = s; };
export const getStyle = () => STYLE;
export const toon = (color, opts = {}) => STYLE === 'film'
  ? new THREE.MeshPhysicalMaterial({ color, roughness: 0.6, clearcoat: 0.1, clearcoatRoughness: 0.4, sheen: 0.6, sheenRoughness: 0.5, sheenColor: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.5), ...opts })
  : STYLE === 'candy'
  ? new THREE.MeshPhysicalMaterial({ color, roughness: opts.map ? 0.78 : 0.34, clearcoat: opts.map ? 0 : 0.75, clearcoatRoughness: 0.16, ...opts })
  : new THREE.MeshToonMaterial({ color, gradientMap, ...opts });

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

const outlineMat = new THREE.MeshBasicMaterial({ color: 0x4a2c3a, side: THREE.BackSide });
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
  return _glow || (_glow = canvasTex(128, 128, (g, w, h) => {
    const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.25, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, w, h);
  }));
}
export function starTex() {
  return _star || (_star = canvasTex(64, 64, (g, w, h) => {
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.3, 'rgba(255,255,255,.5)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff';
    g.beginPath(); g.moveTo(32, 2); g.quadraticCurveTo(34, 30, 62, 32); g.quadraticCurveTo(34, 34, 32, 62); g.quadraticCurveTo(30, 34, 2, 32); g.quadraticCurveTo(30, 30, 32, 2); g.fill();
  }));
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
export class Fx {
  constructor(scene, max = 600) {
    this.max = max; this.i = 0;
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 3); this.base = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3); this.life = new Float32Array(max); this.maxLife = new Float32Array(max).fill(1); this.grav = new Float32Array(max);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({
      size: .55, map: starTex(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
    scene.add(this.points);
    this.pos.fill(9999);
  }
  burst(p, { count = 30, colors = [0xffffff], speed = 4, gravity = -6, life = 1, size, up = 0, spread = 0.1 } = {}) {
    const c = new THREE.Color();
    for (let n = 0; n < count; n++) {
      const i = this.i++ % this.max;
      const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1), sp = speed * (0.35 + Math.random() * 0.65);
      this.pos.set([p.x + (Math.random() - .5) * spread, p.y + (Math.random() - .5) * spread, p.z + (Math.random() - .5) * spread], i * 3);
      this.vel.set([Math.sin(ph) * Math.cos(th) * sp, Math.sin(ph) * Math.sin(th) * sp + up, Math.cos(ph) * sp], i * 3);
      c.set(colors[Math.floor(Math.random() * colors.length)]);
      this.base.set([c.r, c.g, c.b], i * 3);
      this.maxLife[i] = this.life[i] = life * (0.7 + Math.random() * 0.6);
      this.grav[i] = gravity;
    }
    if (size) this.points.material.size = size;
  }
  update(dt) {
    const { pos, vel, col, base, life, maxLife, grav } = this;
    for (let i = 0; i < this.max; i++) {
      if (life[i] <= 0) { if (col[i * 3] !== 0 || col[i * 3 + 1] !== 0 || col[i * 3 + 2] !== 0) col.fill(0, i * 3, i * 3 + 3); continue; }
      life[i] -= dt;
      vel[i * 3 + 1] += grav[i] * dt;
      pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      const k = Math.max(life[i] / maxLife[i], 0);
      col[i * 3] = base[i * 3] * k; col[i * 3 + 1] = base[i * 3 + 1] * k; col[i * 3 + 2] = base[i * 3 + 2] * k;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}

export const candyCaneTex = () => canvasTex(64, 128, (g, w, h) => {
  g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.fillStyle = '#ff4d6d';
  for (let i = -2; i < 4; i++) { g.beginPath(); g.moveTo(0, i * 32); g.lineTo(w, i * 32 - 16); g.lineTo(w, i * 32 + 16); g.lineTo(0, i * 32 + 32); g.fill(); }
});
export const swirlTex = (a, b) => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = a; g.fillRect(0, 0, w, h); g.strokeStyle = b; g.lineWidth = 26; g.lineCap = 'round'; g.beginPath();
  for (let t = 0; t < 14; t += .05) { const r = t * 8; g.lineTo(w / 2 + Math.cos(t) * r, h / 2 + Math.sin(t) * r); } g.stroke();
});

export const RAINBOW =[0xff4d4d, 0xff9f2e, 0xffe14d, 0x5be37d, 0x4db8ff, 0xb07cff];
export const CANDY = [0xff6fb5, 0xffd84d, 0x62e0d0, 0xb07cff, 0xff9f4d, 0xffffff];
