import * as THREE from 'three';
import { mk } from './util.js';

const sph = (r, w = 20, h = 14) => new THREE.SphereGeometry(r, w, h);
const cyl = (rt, rb, h, s = 8) => new THREE.CylinderGeometry(rt, rb, h, s);

/**
 * The talking cat: a friendly gray tabby with stripes, big kind eyes, round glasses and a small smile.
 * Everything starts invisible and fades in (the glasses first, then the rest of him).
 */
export function makeCat() {
  const g = new THREE.Group(), body = [], glasses = [];
  const gray = 0xaab1bb, stripe = 0x707884, belly = 0xf3f4f7, pink = 0xffa3bb, frame = 0x20c4b4;
  const reg = (m, list = body) => { m.material.transparent = true; m.material.opacity = 0; list.push(m.material); return m; };

  // body, belly and stripes
  g.add(reg(mk(sph(1), gray, [0, 0, 0], [1, 1.15, .9])));
  g.add(reg(mk(sph(.8), belly, [0, -.1, .45], [.9, 1.05, .6])));
  for (let i = 0; i < 4; i++) { const r = mk(new THREE.TorusGeometry(.97 - Math.abs(i - 1.5) * .06, .042, 6, 24), stripe, [0, -.6 + i * .42, 0]); r.rotation.x = Math.PI / 2; r.scale.set(1, .9, 1); g.add(reg(r)); }

  // head
  const head = new THREE.Group(); head.position.set(0, 1.75, .15); g.add(head);
  head.add(reg(mk(sph(.95), gray, [0, 0, 0], [1.2, 1, 1])));
  for (const x of [-.3, 0, .3]) { const s = mk(sph(.1), stripe, [x, .86 - Math.abs(x) * .3, .6], [.55, 1.6, .5]); s.rotation.z = -x * .8; head.add(reg(s)); }       // forehead stripes
  for (const s of [-1, 1]) for (let k = 0; k < 2; k++) { const c = mk(sph(.08), stripe, [s * 1.0, -.15 - k * .17, .55], [1.7, .45, .5]); c.rotation.z = s * (.15 + k * .1); head.add(reg(c)); }   // cheek stripes
  for (const s of [-1, 1]) {
    const ear = mk(new THREE.ConeGeometry(.35, .7, 4), gray, [s * .75, .85, 0]); ear.rotation.z = -s * .35; head.add(reg(ear));
    head.add(reg(mk(new THREE.ConeGeometry(.2, .4, 4), pink, [s * .75, .8, .12]).rotateZ(-s * .35)));
    // big, kind eyes: white, dark pupil, sparkle
    head.add(reg(mk(sph(.25), 0xffffff, [s * .4, .2, .8], [1, 1.1, .55])), reg(mk(sph(.17), 0x2b2430, [s * .4, .2, .93], [1, 1.1, .5])), reg(mk(sph(.06), 0xffffff, [s * .4 + .05, .27, 1.0])));
    head.add(reg(mk(sph(.16), 0xffb3c7, [s * .62, -.18, .72], [1.2, .7, .4])));                                                                                 // blush
    for (let k = 0; k < 3; k++) { const w = mk(cyl(.012, .012, .8, 4), 0xe4e8ee, [s * .95, -.2 - k * .07, .65]); w.rotation.z = s * (Math.PI / 2 + (k - 1) * .2); head.add(reg(w)); }   // whiskers
    // round glasses
    const ring = mk(new THREE.TorusGeometry(.33, .05, 8, 28), frame, [s * .4, .2, 1.0]); head.add(reg(ring, glasses));
    const temple = mk(cyl(.025, .025, .55, 6), frame, [s * .78, .22, .74]); temple.rotation.x = Math.PI / 2; temple.rotation.z = 0; head.add(reg(temple, glasses));
  }
  head.add(reg(mk(cyl(.025, .025, .18, 6), frame, [0, .24, 1.01]).rotateZ(Math.PI / 2), glasses));         // bridge of the glasses
  head.add(reg(mk(sph(.09), pink, [0, -.06, .96], [1.3, .8, .7])));                                              // nose
  for (const s of [-1, 1]) { const m = mk(new THREE.TorusGeometry(.1, .022, 6, 12, Math.PI), 0xc2576f, [s * .1, -.2, .94]); m.rotation.z = Math.PI; head.add(reg(m)); }   // small happy smile

  // tail with stripes
  const tail = new THREE.Group(); g.add(tail); const tailBalls = [];
  for (let i = 0; i < 9; i++) { const b = reg(mk(sph(.3 - i * .018), i % 2 ? stripe : gray)); tail.add(b); tailBalls.push(b); }
  // little paws
  for (const s of [-1, 1]) { const a = reg(mk(sph(.22), gray, [s * .9, .2, .5], [1, 1.4, 1])); g.add(a); g.add(reg(mk(sph(.14), belly, [s * .9, -.08, .56]))); g.userData['arm' + (s > 0 ? 'R' : 'L')] = a; }

  g.traverse((o) => { if (o.isMesh && o.material && o.material.clearcoat !== undefined) { o.material.clearcoat = 0; o.material.roughness = 0.85; } });     // soft fur, not shiny metal
  g.userData = { ...g.userData, body, grin: glasses, head, tail, tailBalls };
  return g;
}
