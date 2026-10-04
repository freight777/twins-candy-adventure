import * as THREE from 'three';
import { toon, mk, glowSprite, setStyle, getStyle, RAINBOW } from '../util.js';

const sph = (r, w = 20, h = 14) => new THREE.SphereGeometry(r, w, h);
const cyl = (rt, rb, h, s = 14) => new THREE.CylinderGeometry(rt, rb, h, s);

export function heartGeo(size = 1, depth = .3) {
  const s = new THREE.Shape();
  s.moveTo(0, -.9); s.bezierCurveTo(-1.5, -.1, -1.0, 1.0, 0, .45); s.bezierCurveTo(1.0, 1.0, 1.5, -.1, 0, -.9);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: .12, bevelSize: .1, bevelSegments: 4, curveSegments: 18 });
  g.translate(0, 0, -depth / 2); g.scale(size, size, size); return g;
}

/**
 * A cute 3D mermaid, built from smooth shapes. Upright it is ~6 units from fin to hair; it faces +Z and pivots at the hip,
 * so tilting the pitch group forward makes it swim. spec: hair[], clip{color,rainbow,sparkle}, tail[2], fin, shell, iris,
 * male, beard, crown ('king'|'queen'), trident, glitter
 */
export function createMermaid(spec) {
  const prev = getStyle(); setStyle('candy');
  const S = { iris: 0x4a2a9a, shell: 0xffd1e8, fin: spec.tail[1], ...spec };
  const root = new THREE.Group(), pitch = new THREE.Group(); root.add(pitch);
  const skinCol = 0xffd2b0, skin = toon(skinCol, { emissive: 0xffa878, emissiveIntensity: .32 });
  const male = !!S.male;

  // torso, shoulders, hips
  pitch.add(mk(new THREE.CapsuleGeometry(male ? .6 : .46, .75, 10, 20), skin, [0, .7, 0], [1, 1, .78]));
  pitch.add(mk(sph(male ? .62 : .52), skin, [0, .05, 0], [1, .9, .8]));
  if (!male) {
    [-1, 1].forEach((s) => pitch.add(mk(sph(.28, 16, 12), S.shell, [s * .22, 1.0, .3], [1, .85, .6])));
    pitch.add(mk(new THREE.TorusGeometry(.5, .045, 8, 28), 0xffffff, [0, .97, 0], [1, 1, .8]).rotateX(Math.PI / 2));
  } else pitch.add(mk(new THREE.TorusGeometry(.62, .09, 8, 28), 0xffc83d, [0, .5, 0], [1, 1, .8]).rotateX(Math.PI / 2));
  pitch.add(mk(cyl(.17, .21, .45), skin, [0, 1.4, 0]));

  // arms (pivot at the shoulder so they can drift)
  const arms = [];
  [-1, 1].forEach((s) => {
    const a = new THREE.Group(); a.position.set(s * (male ? .72 : .58), 1.12, 0); pitch.add(a);
    a.add(mk(new THREE.CapsuleGeometry(.14, .85, 8, 12), skin, [0, -.5, 0]));
    a.add(mk(sph(.17, 14, 10), skin, [0, -1.12, 0]));
    a.userData.s = s; arms.push(a);
  });

  // head
  const head = new THREE.Group(); head.position.set(0, 1.98, .02); pitch.add(head);
  head.add(mk(sph(.62), skin, [0, 0, 0], [1, .97, 1]));
  head.add(mk(sph(.07, 10, 8), 0xf0b090, [0, -.11, .62]));
  head.add(mk(new THREE.TorusGeometry(.12, .015, 6, 18, Math.PI).rotateZ(Math.PI), 0xb03a55, [0, -.29, .56]));
  const eyes = [];
  [-1, 1].forEach((s) => {
    const eye = new THREE.Group(); eye.position.set(s * .25, .04, .52); eye.rotation.y = s * .4; eye.scale.setScalar(.98); head.add(eye); eyes.push(eye);
    eye.add(mk(sph(.18), 0xffffff, [0, 0, 0], [1, 1.18, .55]), mk(sph(.125), S.iris, [0, -.01, .07], [1, 1.2, .5]), mk(sph(.07), 0x1a0d2a, [0, -.01, .12], [1, 1.2, .5]));
    eye.add(mk(sph(.05, 10, 8), 0xffffff, [s * -.04, .06, .15]), mk(sph(.025, 8, 6), 0xffffff, [s * .045, -.05, .15]));
    for (let k = 0; k < 3; k++) { const l = mk(new THREE.BoxGeometry(.014, .12, .014), 0x2a1a3a, [s * (.1 + k * .055), .2 - k * .04, .06]); l.rotation.z = -s * (.5 + k * .35); eye.add(l); }
    head.add(mk(new THREE.TorusGeometry(.2, .018, 6, 14, Math.PI * .8), 0x6a3a2a, [s * .27, .3, .5]).rotateZ(s * .15));
    const blush = new THREE.Mesh(new THREE.CircleGeometry(.12, 16), new THREE.MeshBasicMaterial({ color: 0xff7fa8, transparent: true, opacity: .5, depthWrite: false }));
    blush.position.set(s * .4, -.15, .44); blush.rotation.y = s * .8; head.add(blush);
  });

  // hair: a cap over the head, bangs, and long strands that float and sway
  const hairMats = S.hair.map((c) => toon(c, { emissive: c, emissiveIntensity: .14 }));
  const hm = (i) => hairMats[i % hairMats.length];
  const cap = new THREE.Mesh(new THREE.SphereGeometry(.68, 28, 18, 0, Math.PI * 2, 0, Math.PI * .56), hm(0)); cap.rotation.x = -.38; cap.position.set(0, .06, -.08); head.add(cap);
  for (let i = 0; i < 9; i++) { const a = (i / 8 - .5) * 2.2, b = mk(sph(.19, 12, 8), hm(i), [Math.sin(a) * .5, .46 - Math.abs(a) * .12, Math.cos(a) * .42 + .08], [1, 1.1, 1]); head.add(b); }
  const strands = [];                                   // long, smooth hair lobes that hang from the back of the head and sway
  for (let i = 0; i < 7; i++) {
    const off = i - 3, g = new THREE.Group(); g.position.set(off * .3, .35, -.42 - Math.abs(off) * .02); head.add(g);
    const len = 1.55 - Math.abs(off) * .13, mat = hm(i);
    const lobe = new THREE.Mesh(sph(1, 20, 14), mat); lobe.scale.set(.34 + (3 - Math.abs(off)) * .02, len, .3); lobe.position.y = -len * .9; g.add(lobe);
    const tip = new THREE.Mesh(sph(1, 16, 12), mat); tip.scale.set(.22, len * .55, .2); tip.position.set(off * .05, -len * 1.8, -.04); g.add(tip);
    g.userData = { i, off }; strands.push(g);
  }
  // heart hairclip
  const clipMat = S.clip.rainbow
    ? toon(0xffffff, { vertexColors: true, emissive: 0xffffff, emissiveIntensity: .15 })
    : toon(S.clip.color, { emissive: S.clip.color, emissiveIntensity: S.clip.sparkle ? .7 : .45, clearcoat: 1 });
  const hg = heartGeo(.46, .2);
  if (S.clip.rainbow) { const pos = hg.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color(); for (let i = 0; i < pos.count; i++) { c.set(RAINBOW[Math.min(5, Math.max(0, Math.floor((pos.getX(i) / .46 + 1.5) / 3 * 6)))]); col.set([c.r, c.g, c.b], i * 3); } hg.setAttribute('color', new THREE.BufferAttribute(col, 3)); }
  const clip = new THREE.Mesh(hg, clipMat); clip.position.set(.5, .5, .42); clip.rotation.set(-.15, .55, -.3); head.add(clip);
  let clipGlow = null;
  if (S.clip.sparkle || S.clip.rainbow) { clipGlow = glowSprite(S.clip.rainbow ? 0xffffff : 0xff9ed8, 1.6, .6); clipGlow.position.copy(clip.position).add(new THREE.Vector3(.05, 0, .1)); head.add(clipGlow); }
  if (S.crown) {
    const g = mk(new THREE.TorusGeometry(.4, .06, 8, 24), 0xffd24d, [0, .62, -.02], [1, 1, .9]).rotateX(Math.PI / 2); head.add(g);
    for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; head.add(mk(new THREE.ConeGeometry(.08, S.crown === 'king' ? .38 : .28, 8), 0xffd24d, [Math.sin(a) * .4, .82, Math.cos(a) * .4 - .02]), mk(sph(.05, 8, 6), i % 2 ? 0xff5fa4 : 0x6cc8ff, [Math.sin(a) * .4, 1.02, Math.cos(a) * .4 - .02])); }
  }
  if (S.beard) for (let i = 0; i < 8; i++) { const a = (i / 7 - .5) * 1.8; head.add(mk(sph(.17 - Math.abs(a) * .04, 10, 8), 0xf2f2f8, [Math.sin(a) * .35, -.42 - (1 - Math.abs(a)) * .1, Math.cos(a) * .4 + .15], [1, 1.2, 1])); }

  // tail: tapered segments that ripple, ending in a fin
  const tailSegs = [], NT = 12, tc = [new THREE.Color(S.tail[0]), new THREE.Color(S.tail[1])];
  for (let i = 0; i < NT; i++) {
    const f = i / (NT - 1), r = .6 * Math.pow(1 - f, .85) + .13, c = tc[0].clone().lerp(tc[1], f);
    const seg = mk(sph(r, 16, 12), toon(c, { emissive: c, emissiveIntensity: .16, clearcoat: 1 }), [0, -.15 - i * .3, 0], [1, 1.6, .85]); seg.userData = { i, f }; pitch.add(seg); tailSegs.push(seg);
    if (i % 2 === 1 && i < NT - 2) { const sc = mk(new THREE.TorusGeometry(r * .8, .02, 6, 18, Math.PI), new THREE.Color(c).lerp(new THREE.Color(0xffffff), .5).getHex(), [0, 0, r * .3]); sc.rotation.set(Math.PI / 2, 0, 0); seg.add(sc); }
  }
  const fin = new THREE.Group(); pitch.add(fin);
  const finMat = toon(S.fin, { emissive: S.fin, emissiveIntensity: .22, transparent: true, opacity: .93, side: THREE.DoubleSide });
  [-1, 1].forEach((s) => { const lobe = mk(sph(1, 18, 12), finMat, [s * .55, -.5, 0], [.95, .12, 1.55]); lobe.rotation.z = -s * .7; lobe.rotation.x = .1; fin.add(lobe); });
  fin.add(mk(sph(.3, 12, 8), finMat, [0, -.12, 0], [.8, 1.2, .5]));

  if (S.trident) {
    const t = new THREE.Group(); t.position.set(0, -1.12, .1); arms[1].add(t); t.rotation.x = 0;
    t.add(mk(cyl(.05, .05, 3.6, 8), 0xffd24d, [0, 1, 0]));
    [-1, 0, 1].forEach((s) => t.add(mk(new THREE.ConeGeometry(.07, .55, 8), 0xffd24d, [s * .26, 2.95 + (s ? 0 : .2), 0])));
    t.add(mk(new THREE.TorusGeometry(.26, .04, 6, 14, Math.PI).rotateZ(Math.PI), 0xffd24d, [0, 2.78, 0]));
  }
  // a halo of drifting glitter for the sparkly one
  let glitter = null;
  if (S.glitter) {
    const n = 40, p = new Float32Array(n * 3);
    glitter = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(p, 3)), new THREE.PointsMaterial({ size: .22, color: 0xffd0f0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, map: glowSprite().material.map }));
    glitter.frustumCulled = false; pitch.add(glitter); glitter.userData = { n, p };
  }
  setStyle(prev);

  // ---- swimming animation ----
  let phase = 0, blinkT = 2 + Math.random() * 3, blink = 0;
  const api = {
    root, pitch, head, speed: 0, lift: 0,
    /** speed 0 = floating, 1 = swimming, 1.5 = fast */
    update(dt, t, speed = 0) {
      phase += dt * (2.6 + speed * 4.2);
      const run = Math.min(speed, 1.6), idle = 1 - Math.min(speed, 1);
      pitch.rotation.x += ((api.upright ? .04 : .95 + Math.min(speed, 1) * .45) - pitch.rotation.x) * Math.min(1, dt * 4);
      pitch.position.y = Math.sin(t * 1.4) * .14 + (api.lift || 0);
      pitch.rotation.z = Math.sin(t * .8) * .05 + Math.sin(phase * .5) * .04 * run;
      const amp = .1 + run * .36;
      tailSegs.forEach((s) => { const f = s.userData.f; s.position.z = Math.sin(phase - f * 3.4) * amp * (f * 1.6 + .1); s.position.x = Math.sin(phase * .5 - f * 2) * .05 * f; });
      const last = tailSegs[tailSegs.length - 1];
      fin.position.set(last.position.x, last.position.y - .1, last.position.z);
      fin.rotation.x = Math.cos(phase - 3.4) * (.25 + run * .3);
      arms.forEach((a) => { const s = a.userData.s; a.rotation.z = s * (.5 + Math.sin(t * 1.5 + s) * .15 + run * .35); a.rotation.x = Math.sin(phase * .9 + s) * .25 * (.3 + run) - .2; });
      head.rotation.y = Math.sin(t * .9) * .12 * idle; head.rotation.x = Math.sin(t * 1.2) * .05 - .35 * Math.min(speed, 1);
      strands.forEach((g) => { const { i, off } = g.userData; g.rotation.z = off * .06 + Math.sin(t * 1.5 + i * .9) * (.08 + run * .06); g.rotation.x = -.1 - run * .55 + Math.sin(t * 1.2 + i * 1.7) * .1 + idle * .1; });
      blinkT -= dt; if (blinkT <= 0) { blink = .14; blinkT = 2.5 + Math.random() * 3.5; }
      blink = Math.max(0, blink - dt); eyes.forEach((e) => (e.scale.y = .98 * (blink > 0 ? .1 : 1)));
      if (clipGlow) clipGlow.material.opacity = .45 + Math.sin(t * 4) * .25;
      if (glitter) { const { n, p } = glitter.userData; for (let i = 0; i < n; i++) { const a = t * .6 + i * 1.7, r = 1.1 + (i % 5) * .25; p[i * 3] = Math.cos(a) * r; p[i * 3 + 1] = ((i * .37 + t * .3) % 4) - .5; p[i * 3 + 2] = Math.sin(a) * r * .8; } glitter.geometry.attributes.position.needsUpdate = true; }
    },
    lookToward(dx, dz, k = 1) { const a = Math.atan2(dx, dz); let d = a - root.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); root.rotation.y += d * k; },
  };
  return api;
}

// ---- the cast ----
export const LOOKS = {
  esmae:   { hair: [0xff8fc8, 0xff6fb5, 0xffa8d8], clip: { color: 0xff5fa4 }, tail: [0x3ad8d0, 0x7a6af0], fin: 0x9a8cff, shell: 0xffd1e8, iris: 0x5a3aa8 },
  lucy:    { hair: [0xff8fc8, 0xff6fb5, 0xffa8d8], clip: { color: 0xff5fa4 }, tail: [0x5ae8b0, 0x4a9af0], fin: 0x7ae0ff, shell: 0xffd1e8, iris: 0x3a7ac8 },
  kitty:   { hair: [0xff4d5a, 0xe8283a, 0xff6a6a], clip: { color: 0xff7ec0 }, tail: [0xff9a6a, 0xffd84d], fin: 0xffb04a, shell: 0xffe0a8, iris: 0x2a8a5a },
  sparkle: { hair: [0xffa8e8, 0xff8fd8, 0xffc0f0], clip: { color: 0xff6fd0, sparkle: true }, tail: [0xffb0f0, 0xffe27a], fin: 0xffd0f8, shell: 0xffe0f8, iris: 0xc03aa8, glitter: true },
  rainbow: { hair: RAINBOW, rainbowHair: true, clip: { rainbow: true }, tail: [0x5bc0ff, 0xb07cff], fin: 0x6be37d, shell: 0xfff0a0, iris: 0x2a6ae0 },
  king:    { hair: [0xe8e8f4, 0xcfd0e8], clip: { color: 0xffd24d }, tail: [0x2ab8c8, 0x2a6ae0], fin: 0x4ad8c8, shell: 0xffd24d, iris: 0x2a4aa8, male: true, beard: true, crown: 'king', trident: true },
  queen:   { hair: [0xb07cff, 0x9a5cf0, 0xc9a8ff], clip: { color: 0xffd24d }, tail: [0xb07cff, 0xff7ab8], fin: 0xff9ed8, shell: 0xffd24d, iris: 0x7a3aa8, crown: 'queen' },
};

/** a little seahorse (pet) */
export function createSeahorse(color = 0xffb04a) {
  const prev = getStyle(); setStyle('candy');
  const g = new THREE.Group(), m = toon(color, { emissive: color, emissiveIntensity: .2, clearcoat: 1 }), parts = [];
  for (let i = 0; i < 9; i++) { const f = i / 8, r = .26 * (1 - f * .75) + .05, p = mk(sph(r, 12, 8), m, [0, 1.1 - i * .17, -Math.sin(f * 2.4) * .3 + (i > 5 ? (i - 5) * .06 : 0)], [1, 1.1, 1]); p.userData = { i }; g.add(p); parts.push(p); }
  g.add(mk(sph(.3, 14, 10), m, [0, 1.38, .08], [1, 1, 1.05]), mk(cyl(.07, .1, .38, 10), m, [0, 1.38, .4]).rotateX(Math.PI / 2));
  g.children[g.children.length - 1].rotation.x = Math.PI / 2;
  [-1, 1].forEach((s) => g.add(mk(sph(.06, 8, 6), 0x1a0d2a, [s * .16, 1.44, .28])));
  const fin = mk(sph(.3, 10, 8), toon(0xffe27a, { transparent: true, opacity: .8 }), [0, .9, -.3], [.1, 1, .6]); g.add(fin);
  setStyle(prev);
  return { root: g, update(t) { parts.forEach((p) => { p.position.x = Math.sin(t * 2 - p.userData.i * .4) * .03 * p.userData.i; }); fin.rotation.y = Math.sin(t * 9) * .5; g.position.y += 0; } };
}

/** a dolphin (for the shortcut rides and the open water) */
export function createDolphin(scale = 1) {
  const prev = getStyle(); setStyle('candy');
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const top = toon(0x6a9ad8, { clearcoat: 1 }), belly = toon(0xe8f2ff);
  body.add(mk(new THREE.CapsuleGeometry(.6, 2.0, 10, 18).rotateX(Math.PI / 2), top, [0, 0, 0]), mk(sph(.52, 16, 12), belly, [0, -.18, .3], [.95, .6, 2.2]));
  body.add(mk(sph(.5, 16, 12), top, [0, .08, 1.45]), mk(new THREE.CapsuleGeometry(.2, .55, 8, 12).rotateX(Math.PI / 2), belly, [0, -.08, 2.0]));
  [-1, 1].forEach((s) => body.add(mk(sph(.07, 8, 6), 0x1a0d2a, [s * .38, .22, 1.7])));
  const dorsal = mk(new THREE.ConeGeometry(.28, .8, 12), top, [0, .78, -.1]); dorsal.rotation.x = -.5; body.add(dorsal);
  [-1, 1].forEach((s) => { const f = mk(new THREE.ConeGeometry(.2, .9, 10), top, [s * .65, -.35, .7]); f.rotation.z = s * 1.0; f.rotation.x = .3; body.add(f); });
  const tail = new THREE.Group(); tail.position.set(0, 0, -1.55); body.add(tail);
  tail.add(mk(new THREE.CapsuleGeometry(.28, .6, 8, 12).rotateX(Math.PI / 2), top, [0, 0, -.35]));
  [-1, 1].forEach((s) => { const l = mk(sph(1, 14, 10), top, [s * .55, 0, -.85], [.65, .1, .35]); l.rotation.y = s * .4; tail.add(l); });
  g.scale.setScalar(scale);
  setStyle(prev);
  return { root: g, body, update(t, speed = 1) { body.rotation.x = Math.sin(t * 3 * speed) * .08; tail.rotation.x = Math.sin(t * 3 * speed - 1) * .4; } };
}
