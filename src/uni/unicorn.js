import * as THREE from 'three';
import { toon, mk, canvasTex, glowSprite, blobShadow, emojiTex, keep, addOutlines, setStyle, getStyle } from '../util.js';

const sph = (r, w = 22, h = 16) => new THREE.SphereGeometry(r, w, h);
const cyl = (rt, rb, h, s = 16) => new THREE.CylinderGeometry(rt, rb, h, s);

/** the candy-striped horn: one texture for every unicorn (so they share one horn material too) */
let _horn;
const hornTex = () => _horn || (_horn = canvasTex(64, 128, (g, w, h) => {
  g.fillStyle = '#fff2c4'; g.fillRect(0, 0, w, h);
  for (let i = -4; i < 8; i++) { g.fillStyle = i % 2 ? '#ffd36a' : '#ffb3dc'; g.beginPath(); g.moveTo(0, i * 22); g.lineTo(w, i * 22 - 22); g.lineTo(w, i * 22 - 4); g.lineTo(0, i * 22 + 18); g.fill(); }
}), keep.add(_horn), _horn);

/**
 * A cute 3D unicorn, built from smooth shapes. Faces +Z, stands on y=0, about 3.4 units tall to the ears.
 * spec: body, belly, mane[], iris, horn, hoof, cutie (emoji), crown, accessory ('raincloud'), puff (fluffy cloud-style mane)
 */
export function createUnicorn(spec) {
  const prev = getStyle(); setStyle('candy');
  const S = { belly: spec.body, iris: 0x7a4ed1, horn: 0xffe27a, hoof: 0xffc83d, ...spec };
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const skin = toon(S.body, { emissive: S.body, emissiveIntensity: .26 }), skinL = toon(S.belly, { emissive: S.belly, emissiveIntensity: .26 });

  // torso: a capsule with a rounder chest and rump
  body.add(mk(new THREE.CapsuleGeometry(.62, 1.0, 10, 22).rotateX(Math.PI / 2), skin, [0, 1.3, 0]));
  body.add(mk(sph(.7), skin, [0, 1.32, -.6]), mk(sph(.66), skin, [0, 1.3, .62]));
  body.add(mk(sph(.5, 18, 12), skinL, [0, 1.0, .05], [1.05, .75, 2.1]));          // lighter tummy

  // neck + head
  const neck = new THREE.Group(); neck.position.set(0, 1.7, .78); neck.rotation.x = .62; body.add(neck);
  neck.add(mk(cyl(.36, .5, 1.15), skin, [0, .55, 0]));
  const head = new THREE.Group(); head.position.set(0, 2.86, 1.55); head.rotation.x = .35; body.add(head);
  head.add(mk(sph(.63), skin, [0, 0, 0], [1, .96, 1.02]));
  head.add(mk(sph(.38), skinL, [0, -.22, .56], [.92, .8, 1.15]));
  head.add(mk(sph(.05, 10, 8), 0x7a3a4a, [-.12, -.17, .97]), mk(sph(.055, 10, 8), 0x7a3a4a, [.12, -.17, .97]));
  const smile = mk(new THREE.TorusGeometry(.11, .014, 6, 18, Math.PI).rotateZ(Math.PI), 0x9a3a55, [0, -.31, .99]); head.add(smile);
  const eyes = [];
  [-1, 1].forEach((s) => {
    const eye = new THREE.Group(); eye.position.set(s * .36, .1, .5); eye.rotation.y = s * .6; eye.scale.setScalar(1.18); head.add(eye); eyes.push(eye);
    eye.add(mk(sph(.2), 0xffffff, [0, 0, 0], [1, 1.18, .55]));
    eye.add(mk(sph(.14), S.iris, [0, -.01, .07], [1, 1.2, .5]));
    eye.add(mk(sph(.08), 0x1a0d2a, [0, -.01, .12], [1, 1.2, .5]));
    eye.add(mk(sph(.055, 10, 8), 0xffffff, [s * -.04, .07, .15]), mk(sph(.028, 8, 6), 0xffffff, [s * .05, -.06, .15]));
    for (let k = 0; k < 3; k++) {                                                 // lashes
      const l = mk(new THREE.BoxGeometry(.016, .13, .016), 0x2a1a3a, [s * (.1 + k * .06), .21 - k * .04, .06]); l.rotation.z = -s * (.5 + k * .35); eye.add(l);
    }
    const blush = new THREE.Mesh(new THREE.CircleGeometry(.12, 16), new THREE.MeshBasicMaterial({ color: 0xff7fa8, transparent: true, opacity: .5, depthWrite: false }));
    blush.position.set(s * .48, -.15, .42); blush.rotation.y = s * .95; head.add(blush);
  });
  [-1, 1].forEach((s) => {                                                        // ears
    const ear = mk(new THREE.ConeGeometry(.16, .5, 12), skin, [s * .33, .6, -.1]); ear.rotation.z = -s * .28; ear.rotation.x = -.1; head.add(ear);
    const inner = mk(new THREE.ConeGeometry(.095, .38, 10), 0xffb0cf, [s * .33, .58, -.06]); inner.rotation.z = -s * .28; inner.rotation.x = -.1; head.add(inner);
  });
  // spiral horn
  const hornMat = toon(0xffffff, { map: hornTex(), emissive: 0xffd88a, emissiveIntensity: .25 });
  const horn = new THREE.Group(); horn.position.set(0, .62, .32); horn.rotation.x = .5; head.add(horn);
  horn.add(mk(new THREE.ConeGeometry(.15, 1.35, 20), hornMat, [0, .68, 0]));
  const hornGlow = glowSprite(0xffe9a0, 1.5, .7); hornGlow.position.set(0, 1.35, 0); horn.add(hornGlow);
  if (S.crown) {                                                                   // little flower crown
    const cols = [0xff7fb5, 0xffffff, 0xffe14d, 0xb07cff, 0x7be0ff];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const f = mk(sph(.075, 10, 8), cols[i % cols.length], [Math.sin(a) * .4, .43 + Math.cos(a) * .12, Math.cos(a) * .32 - .06]); head.add(f);
    }
  }

  if (S.royal) {                                                                   // royal crown wrapped around the base of the horn (or a tiara for the queen)
    const gold = toon(0xffd24d, { emissive: 0xffb800, emissiveIntensity: .25, clearcoat: 1 }), ring = new THREE.Group(); ring.position.set(0, .66, .34); ring.rotation.x = Math.PI / 2 + .5; head.add(ring);
    ring.add(mk(new THREE.TorusGeometry(.2, .05, 8, 24), gold));
    for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; const c = mk(new THREE.ConeGeometry(.05, S.royal === 'king' ? .26 : .18, 6), gold, [Math.cos(a) * .2, Math.sin(a) * .2, 0]); c.rotation.x = Math.PI / 2; c.lookAt(0, 0, 1); ring.add(c); ring.add(mk(sph(.04, 8, 6), i % 2 ? 0xff5fa4 : 0x6cc8ff, [Math.cos(a) * .2, Math.sin(a) * .2, .17])); }
  }
  // mane: a flowing chain of soft blobs down the neck, plus a forelock
  const maneC = S.mane.map((c) => new THREE.Color(c));
  const colAt = (t) => { const f = t * (maneC.length - 1), i = Math.min(maneC.length - 2, Math.floor(f)); return maneC[i].clone().lerp(maneC[i + 1], f - i); };
  const mane = [];
  const addMane = (parent, x, y, z, r, t) => { const m = mk(sph(r, 14, 10), toon(colAt(t)), [x, y, z], S.puff ? [1.15, 1.1, 1.15] : [.85, 1, 1.2]); m.userData.base = m.position.clone(); m.userData.k = mane.length; parent.add(m); mane.push(m); };
  for (let i = 0; i < 9; i++) {
    const y = .05 + i * .125, r = (S.puff ? .26 : .2) - i * .006, z = -(0.47 - (y / 1.15) * .17) - .05;
    addMane(neck, 0, y, z, r, i / 8);
    if (i % 2 === 0) { addMane(neck, -.14, y + .03, z + .03, r * .8, ((i + 1) / 9)); addMane(neck, .14, y + .03, z + .03, r * .8, ((i + 2) / 10)); }
  }
  addMane(head, 0, .52, -.12, .21, .1); addMane(head, -.09, .5, .06, .17, .2); addMane(head, .1, .42, .46, .13, .9);   // forelock behind the horn
  addMane(head, -.14, .33, .5, .12, .6); addMane(head, .2, .3, .5, .1, .4);

  // tail
  const tail = new THREE.Group(); tail.position.set(0, 1.55, -1.18); body.add(tail);
  const tailParts = [];
  for (let i = 0; i < 10; i++) {
    const r = (S.puff ? .28 : .2) * (i > 7 ? 1.2 : 1) - i * .008;
    const m = mk(sph(r, 14, 10), toon(colAt(i / 9)), [0, .05 * i - .02 * i * i * .5, -.17 * i], S.puff ? [1.2, 1.1, 1.1] : [.9, 1, 1.15]);
    m.userData.base = m.position.clone(); m.userData.i = i; tail.add(m); tailParts.push(m);
  }
  if (!S.puff) [-1, 1].forEach((s) => { for (let i = 2; i < 9; i += 2) { const m = mk(sph(.14, 10, 8), toon(colAt(((i + 1) % 10) / 9)), [s * .12, .05 * i - .02 * i * i * .5 - .1, -.17 * i - .05]); m.userData.base = m.position.clone(); m.userData.i = i; tail.add(m); tailParts.push(m); } });

  // legs (hip -> knee -> hoof) so they can swing and bend when galloping
  const legs = [];
  [[-.36, .62], [.36, .62], [-.38, -.64], [.38, -.64]].forEach(([x, z], k) => {
    const hip = new THREE.Group(); hip.position.set(x, .98, z); body.add(hip);
    hip.add(mk(cyl(.21, .15, .56), skin, [0, -.28, 0]));
    const knee = new THREE.Group(); knee.position.set(0, -.56, 0); hip.add(knee);
    knee.add(mk(cyl(.15, .11, .46), skin, [0, -.23, 0]));
    knee.add(mk(sph(.18, 14, 10), S.hoof, [0, -.47, .03], [1.08, .72, 1.3]));
    knee.add(mk(sph(.13, 10, 8), skin, [0, 0, 0]));
    legs.push({ hip, knee, k });
  });

  // cutie mark on each flank
  const cm = emojiTex(S.cutie);
  [-1, 1].forEach((s) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(.55, .55), new THREE.MeshBasicMaterial({ map: cm, transparent: true, depthWrite: false }));
    p.position.set(s * .715, 1.36, -.55); p.rotation.y = s * Math.PI / 2; body.add(p);
  });

  // accessory: a little personal raincloud for Rain
  let cloud = null, drops = [];
  if (S.accessory === 'raincloud') {
    cloud = new THREE.Group(); cloud.position.set(0, 4.9, 1.5); body.add(cloud);
    [[0, 0, 0, .55], [-.5, -.1, 0, .4], [.5, -.1, 0, .42], [.2, .3, 0, .4], [-.2, .28, .1, .36]].forEach(([x, y, z, r]) => cloud.add(mk(sph(r), toon(0xc9d4f2), [x, y, z], [1, .75, 1])));
    for (let i = 0; i < 6; i++) { const d = mk(sph(.06, 8, 6), 0x7fc4ff, [(i - 2.5) * .22, -.4, 0], [.7, 1.4, .7]); d.userData.ph = i / 6; cloud.add(d); drops.push(d); }
  }
  // grounding: a soft contact shadow under the hooves on every tier, and real shadows from the big shapes where the tier
  // has a shadow map (eyes, lashes and other little parts would only add shadow-pass draws)
  const blob = blobShadow(2.5, .34); blob.position.set(0, -.1, -.05); root.add(blob);
  addOutlines(root, .22);                                                     // storybook ink lines on the big shapes
  root.traverse((o) => {
    if (!o.isMesh || o === blob || o.userData.outline || o.material.transparent) return;
    o.geometry.computeBoundingSphere(); const s = o.scale;
    if (o.geometry.boundingSphere.radius * Math.max(s.x, s.y, s.z) > .25) o.castShadow = true;   // ~20 of ~70 parts
  });
  setStyle(prev);

  // ---- animation ----
  let phase = 0, blinkT = 2 + Math.random() * 3, blink = 0, earT = 3;
  const api = {
    root, body, head, speed: 0, mood: 1, eyes, hornGlow, blob,
    /** t = scene time, speed 0 = standing, 1 = trotting, 2 = galloping */
    update(dt, t, speed = 0) {
      phase += dt * (3 + speed * 5.5) * (speed > 0.05 ? 1 : 0);
      const run = Math.min(speed, 1.6), idle = 1 - Math.min(speed, 1);
      body.position.y = (speed > .05 ? Math.abs(Math.sin(phase)) * .16 * run : Math.sin(t * 2) * .012) + (api.lift || 0);
      body.rotation.x = speed > .05 ? Math.sin(phase * 2) * .035 * run : 0;
      neck.rotation.x = .62 + Math.sin(t * 1.3) * .03 * idle + (speed > .05 ? Math.sin(phase * 2) * .05 * run : 0);
      head.rotation.x = .35 + Math.sin(t * 1.7) * .05 * idle + (S.look || 0);
      head.rotation.y = Math.sin(t * .8) * .12 * idle;
      legs.forEach(({ hip, knee, k }) => {
        if (speed > .05) {
          const p = phase + [0, .7, Math.PI, Math.PI + .7][k], a = Math.sin(p) * .75 * run;
          hip.rotation.x = k < 2 ? a : -a * .9; knee.rotation.x = Math.max(0, Math.cos(p + (k < 2 ? 0 : Math.PI))) * 1.1 * run;
        } else { hip.rotation.x *= .85; knee.rotation.x *= .85; }
      });
      mane.forEach((m) => { const b = m.userData.base, k = m.userData.k; m.position.x = b.x + Math.sin(t * 3 + k * .7) * .05 * (1 + speed * 1.5); m.position.z = b.z - speed * .05 * (k % 5) + Math.sin(t * 2.4 + k) * .02; });
      tailParts.forEach((m) => { const b = m.userData.base, i = m.userData.i; m.position.x = b.x + Math.sin(t * 2.6 - i * .55) * .045 * i * (1 + speed); m.position.y = b.y + (speed > .05 ? Math.sin(phase * 2 - i * .4) * .03 * i : 0); });
      blinkT -= dt; if (blinkT <= 0) { blink = .14; blinkT = 2.5 + Math.random() * 3.5; }
      blink = Math.max(0, blink - dt); const e = blink > 0 ? .1 : 1; eyes.forEach((ey) => (ey.scale.y = 1.18 * e));
      hornGlow.material.opacity = .55 + Math.sin(t * 3) * .2;
      const up = Math.max(0, body.position.y); blob.scale.setScalar(2.5 * (1 - Math.min(.45, up * .3))); blob.material.opacity = .34 * (1 - Math.min(.6, up * .4));   // shrinks as she hops
      if (cloud) { cloud.position.y = 4.9 + Math.sin(t * 1.5) * .08; drops.forEach((d) => { const f = (d.userData.ph + t * .9) % 1; d.position.y = -.3 - f * 1.3; d.material.opacity = 1; d.scale.y = 1.4 - f * .4; }); }
    },
    jump(h) { body.position.y += h; },
    lookToward(dx, dz, k = 1) { const a = Math.atan2(dx, dz); let d = a - root.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); root.rotation.y += d * k; },
  };
  return api;
}

// ---- the cast ----
const RB = [0xff5a7a, 0xff9f4d, 0xffe14d, 0x6be37d, 0x5bc0ff, 0xb07cff];
export const LOOKS = {
  uni:     { body: 0xfff6ff, belly: 0xffe3f6, mane: [0xff9ecb, 0xffe08a, 0x9ff0c8, 0x8fd3ff, 0xc9a8ff], iris: 0xc040a0, cutie: '\u{1F366}', crown: true },
  sparkle: { body: 0xffbfe0, belly: 0xffe0f0, mane: [0xffd84d, 0xff7ab8, 0xffe9a0], iris: 0xe8308a, cutie: '⭐' },
  rainbow: { body: 0xfffbea, belly: 0xffffff, mane: RB, iris: 0x3a8ae0, cutie: '\u{1F308}' },
  cloud:   { body: 0xdcefff, belly: 0xffffff, mane: [0xffffff, 0xcfe6ff, 0xffffff, 0xe6f2ff], iris: 0x4a8ee0, cutie: '☁️', puff: true },
  rain:    { body: 0x8ea2ee, belly: 0xbccaf8, mane: [0xe6efff, 0x6f86e0, 0xbfd0ff, 0x4a62c8], iris: 0x2a4fb8, cutie: '\u{1F4A7}', accessory: 'raincloud' },
};
LOOKS.twin = LOOKS.uni;
LOOKS.king = { body: 0xe6eeff, belly: 0xffffff, mane: [0xffd24d, 0xfff0a0, 0xffffff, 0xffd24d], iris: 0x2a4ab8, cutie: '👑', royal: 'king' };
LOOKS.queen = { body: 0xffe4f6, belly: 0xffffff, mane: [0xff9ecb, 0xffd24d, 0xc9a8ff, 0xff9ecb], iris: 0x9a2a9a, cutie: '💎', royal: 'queen', crown: true };
