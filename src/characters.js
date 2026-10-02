import * as THREE from 'three';
import { toon, mk, outline, RAINBOW } from './util.js';

const SKIN = 0xf3c8a2, HAIR = 0x5b3a24, EYE = 0x3a2315;
const sph = (r, w = 24, h = 18) => new THREE.SphereGeometry(r, w, h);
const cyl = (rt, rb, h, s = 16) => new THREE.CylinderGeometry(rt, rb, h, s);

/**
 * One of the identical twins. Brown hair, brown eyes, orange (Adalyn) or pink (Esmae) outfit.
 * forms: 'girl' | 'unicorn' | 'mermaid'
 * modes: 'idle' (walk/stand), 'fall' (tunnel pose), 'cheer'
 */
export function createTwin(name) {
  const isA = name === 'adalyn';
  const accent = isA ? 0xff8a1f : 0xff5fa8;
  const accent2 = isA ? 0xffc15a : 0xff9fcb;

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const shadow = mk(new THREE.CircleGeometry(.5, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .22, depthWrite: false }), [0, .02, 0]);
  shadow.rotation.x = -Math.PI / 2;
  root.add(shadow);

  // ---- dress & torso ----
  const skirtG = new THREE.Group(); body.add(skirtG);
  const skirt = outline(mk(cyl(.2, .46, .62, 20), accent, [0, .72, 0]), 1.06);
  const hem = mk(new THREE.TorusGeometry(.45, .04, 8, 24), 0xffffff, [0, .43, 0]); hem.rotation.x = Math.PI / 2;
  skirtG.add(skirt, hem);
  const top = outline(mk(sph(.25), accent, [0, 1.0, 0], [1, 1.1, .85]), 1.08);
  body.add(top);

  // mermaid torso (skin + shell top), hidden until transformation
  const mTorso = new THREE.Group(); mTorso.visible = false; body.add(mTorso);
  mTorso.add(mk(cyl(.18, .2, .36, 16), SKIN, [0, .95, 0]));
  mTorso.add(mk(sph(.13), 0xffa6d5, [-.1, 1.04, .14], [1, .9, .7]), mk(sph(.13), 0xffa6d5, [.1, 1.04, .14], [1, .9, .7]));

  // ---- arms ----
  const arms = [];
  for (const s of [-1, 1]) {
    const a = new THREE.Group(); a.position.set(s * .27, 1.06, 0);
    const arm = mk(new THREE.CapsuleGeometry(.07, .28, 4, 8), SKIN, [0, -.2, 0]);
    const hand = mk(sph(.085), SKIN, [0, -.42, 0]);
    const sleeve = mk(sph(.1), accent, [0, 0, 0]);
    a.add(arm, hand, sleeve); a.userData.side = s; arms.push(a); body.add(a);
  }

  // ---- legs & shoes ----
  const legsG = new THREE.Group(); body.add(legsG);
  const legs = [], shoes = [];
  for (const s of [-1, 1]) {
    const l = new THREE.Group(); l.position.set(s * .12, .46, 0);
    const shoe = mk(sph(.11), 0xffffff, [0, -.44, .04], [1, .65, 1.45]);
    l.add(mk(cyl(.06, .06, .4, 10), SKIN, [0, -.2, 0]), shoe);
    legs.push(l); shoes.push(shoe); legsG.add(l);
  }

  // ---- head ----
  const head = new THREE.Group(); head.position.y = 1.42; body.add(head);
  head.add(outline(mk(sph(.42, 28, 20), SKIN), 1.05));
  head.add(outline(mk(sph(.46), HAIR, [0, .04, -.08], [1.02, 1, 1]), 1.04));         // back of hair
  head.add(mk(sph(.33), HAIR, [0, .3, .2], [1.15, .5, .7]));                          // bangs
  for (const s of [-1, 1]) {
    head.add(mk(sph(.13), HAIR, [s * .38, -.05, .1], [1, 1.7, 1]));                   // side locks
    const tail = mk(sph(.17), HAIR, [s * .5, -.18, -.06], [1, 1.7, 1]); head.add(tail);
    head.add(mk(sph(.08), accent, [s * .43, .1, -.02]), mk(sph(.06), accent2, [s * .5, .13, -.02]));      // bows
    head.add(mk(sph(.065), EYE, [s * .15, -.02, .37], [1, 1.35, .5]), mk(sph(.022), 0xffffff, [s * .15 + .02, .03, .4]));
    head.add(mk(sph(.07), 0xff9a9a, [s * .25, -.13, .3], [1, .6, .4]));
  }
  const smile = mk(new THREE.TorusGeometry(.07, .014, 6, 16, Math.PI), 0xc0504d, [0, -.12, .39]); smile.rotation.z = Math.PI; head.add(smile);

  // ---- UNICORN extras ----
  const unicornG = new THREE.Group(); unicornG.visible = false; body.add(unicornG);
  const horn = mk(new THREE.ConeGeometry(.08, .45, 14), 0xfff3c4, [0, 2.07, .18]); horn.rotation.x = .28;
  for (let i = 0; i < 3; i++) { const r = mk(new THREE.TorusGeometry(.065 - i * .014, .014, 6, 14), 0xffc83d, [0, -.12 + i * .12, 0]); r.rotation.x = Math.PI / 2; horn.add(r); }
  unicornG.add(horn);
  for (const s of [-1, 1]) {
    const ear = mk(new THREE.ConeGeometry(.1, .27, 10), 0xfff3c4, [s * .3, 1.78, -.02]); ear.rotation.z = -s * .35;
    unicornG.add(ear, mk(sph(.05), 0xff9fcb, [s * .3, 1.76, .04], [1, 1.5, .5]));
  }
  RAINBOW.forEach((c, i) => unicornG.add(mk(sph(.13 - i * .004), c, [0, 1.8 - i * .17, -.34 - Math.sin(i * .5) * .12]))); // rainbow mane
  const uTail = new THREE.Group(); uTail.position.set(0, .7, -.3); unicornG.add(uTail);
  RAINBOW.forEach((c, i) => uTail.add(mk(sph(.12 + i * .012), c, [0, -i * .1 + .1, -.1 - i * .09])));

  // ---- MERMAID extras ----
  const mermaidG = new THREE.Group(); mermaidG.visible = false; body.add(mermaidG);
  const tail = new THREE.Group(); tail.position.set(0, .8, 0); mermaidG.add(tail);
  const tcols = [0x2fd6c8, 0x38dcc4, 0x58d8e8, 0x82c4f4, 0xb89cf8, 0xff8fd0];
  tcols.forEach((c, i) => {
    const r = .24 - i * .028;
    tail.add(outline(mk(sph(r, 16, 12), c, [0, -.08 - i * .13, -i * .03], [1, 1.0, .9]), 1.07));
  });
  const fin = new THREE.Group(); fin.position.set(0, -.88, -.18); tail.add(fin);
  for (const s of [-1, 1]) {
    const f = mk(sph(.22, 12, 8), 0xff8fd0, [s * .2, -.04, 0], [1, .55, .25]); f.rotation.z = s * .7; fin.add(f);
  }
  const mHair = mk(sph(.38), HAIR, [0, 1.0, -.4], [.95, 2.4, .5]); mermaidG.add(mHair);
  mermaidG.add(mk(sph(.07), 0xffa6d5, [.28, 1.7, .22], [1, .7, .6]), mk(sph(.04), 0xffe14d, [.28, 1.74, .27]));
  for (let i = 0; i < 5; i++) mermaidG.add(mk(sph(.025), 0xffffff, [-.18 + i * .09, 1.88 - Math.abs(i - 2) * .02, .28]));

  // ---- animation state ----
  const fxs = { lift: 0, spin: 0, squash: 1 };
  const T = {
    name, root, body, form: 'girl', mode: 'idle', fx: fxs, accent, phase: Math.random() * 6, face: 0,
    setForm(f) {
      T.form = f;
      const merm = f === 'mermaid';
      skirtG.visible = !merm; legsG.visible = !merm; top.visible = !merm; mTorso.visible = merm;
      arms.forEach((a) => (a.children[2].material.color.set(merm ? SKIN : accent)));
      unicornG.visible = f === 'unicorn'; mermaidG.visible = merm;
      shoes.forEach((s) => s.material.color.set(f === 'unicorn' ? 0xffd34d : 0xffffff));
    },
    lookToward(dx, dz, dt) {
      if (Math.abs(dx) + Math.abs(dz) < 1e-4) return;
      let d = Math.atan2(dx, dz) - T.face;
      while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      T.face += d * Math.min(1, dt * 12);
      root.rotation.y = T.face;
    },
    /** @param moving walking? @param swim 0..1 how deep in water */
    update(dt, t, moving = false, swim = 0) {
      T.phase += dt * (moving ? 11 : 2.5);
      const p = T.phase;
      const merm = T.form === 'mermaid';
      let by = 0, armX = 0, armZ = .12, legSwing = 0;

      if (T.mode === 'fall') {
        arms.forEach((a) => { a.rotation.z = a.userData.side * (2.5 + Math.sin(t * 8 + a.userData.side) * .3); a.rotation.x = 0; });
        legs.forEach((l, i) => { l.rotation.x = Math.sin(t * 9 + i * 2) * .7; });
        skirt.scale.set(1.35, .8, 1.35); tail.rotation.z = Math.sin(t * 8) * .3;
        body.position.y = 0;
      } else {
        skirt.scale.set(1, 1, 1);
        if (swim > .05) {
          by = -.3 * swim + Math.sin(t * 4) * .04;
          arms.forEach((a, i) => { a.rotation.x = Math.sin(t * 6 + i * 3) * 1.2; a.rotation.z = a.userData.side * .5; });
          legs.forEach((l, i) => { l.rotation.x = Math.sin(t * 8 + i * Math.PI) * .6; });
        } else if (T.mode === 'cheer') {
          by = Math.abs(Math.sin(t * 7)) * .18;
          arms.forEach((a) => { a.rotation.z = a.userData.side * (2.6 + Math.sin(t * 12) * .25); a.rotation.x = 0; });
          legs.forEach((l, i) => { l.rotation.x = 0; });
        } else {
          legSwing = moving ? Math.sin(p) * .75 : 0;
          armX = moving ? -Math.sin(p) * .8 : Math.sin(t * 1.8) * .05;
          by = moving ? Math.abs(Math.sin(p)) * .08 : Math.sin(t * 2) * .012;
          arms.forEach((a, i) => { a.rotation.x = armX * (i ? 1 : -1); a.rotation.z = a.userData.side * armZ; });
          legs.forEach((l, i) => { l.rotation.x = legSwing * (i ? 1 : -1); });
        }
        body.position.y = by;
        // mermaid: hop and wiggle the tail while moving, gently sway when still
        tail.rotation.z = merm ? Math.sin(moving ? p * .9 : t * 2) * (moving ? .28 : .12) : 0;
        body.rotation.z = merm && moving ? Math.sin(p * .9) * .08 : 0;
        if (merm && moving) body.position.y += Math.abs(Math.sin(p * .9)) * .16;
      }
      uTail.rotation.y = Math.sin(t * 3) * .35;
      uTail.rotation.x = Math.sin(t * 2.4) * .12;

      // transformation / special effects
      body.position.y += fxs.lift;
      body.rotation.y = fxs.spin;
      const sq = fxs.squash;
      body.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
      shadow.visible = root.position.y > -.1;
      shadow.scale.setScalar(Math.max(.4, 1 - fxs.lift * .2));
    },
  };
  return T;
}

/** Grown-ups sitting on towels: mom and dad. */
export function createAdult(kind) {
  const g = new THREE.Group();
  const dad = kind === 'dad';
  const top = dad ? 0x4d9be6 : 0xffd84d, hair = dad ? 0x3b2a20 : 0x7a4a2a, skin = dad ? 0xe8b88e : 0xf1c9a5;
  g.add(outline(mk(cyl(.3, .36, .8, 14), top, [0, .7, 0]), 1.05));
  const head = outline(mk(sph(.3), skin, [0, 1.4, 0]), 1.05); g.add(head);
  g.add(mk(sph(.32), hair, [0, 1.47, -.06], [1, .9, 1]));
  for (const s of [-1, 1]) {
    g.add(mk(sph(.04), EYE, [s * .1, 1.42, .27], [1, 1.3, .5]));
    g.add(mk(cyl(.05, .05, .75, 8), skin, [s * .15, .22, .55]).rotateX(Math.PI / 2));
  }
  const smile = mk(new THREE.TorusGeometry(.06, .012, 6, 12, Math.PI), 0xc0504d, [0, 1.3, .29]); smile.rotation.z = Math.PI; g.add(smile);
  if (!dad) { g.add(mk(sph(.34), hair, [0, 1.1, -.2], [1, 1.5, .6])); g.add(mk(cyl(.62, .62, .04, 20), 0xfff2c8, [0, 1.62, 0]), mk(cyl(.3, .32, .2, 16), 0xff8fb8, [0, 1.7, 0])); } // sun hat
  // waving arm
  const arm = new THREE.Group(); arm.position.set(.36, 1.0, 0);
  arm.add(mk(new THREE.CapsuleGeometry(.07, .4, 4, 8), skin, [0, .25, 0]), mk(sph(.09), skin, [0, .55, 0]));
  g.add(arm);
  const arm2 = mk(new THREE.CapsuleGeometry(.07, .4, 4, 8), skin, [-.4, .75, .1]); arm2.rotation.z = .4; g.add(arm2);
  g.userData.arm = arm;
  return g;
}
