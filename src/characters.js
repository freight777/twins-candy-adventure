import * as THREE from 'three';
import { toon, mk, outline, glowSprite, setStyle, getStyle, RAINBOW } from './util.js';

const SKIN = 0xf3c8a2, HAIR = 0x5b3a24, EYE = 0x3a2315;
const sph = (r, w = 24, h = 18) => new THREE.SphereGeometry(r, w, h);
const cyl = (rt, rb, h, s = 16) => new THREE.CylinderGeometry(rt, rb, h, s);

/**
 * One of the identical twins. Brown hair, brown eyes, orange (Adalyn) or pink (Esmae) outfit.
 * forms: 'girl' | 'unicorn' | 'mermaid'
 * modes: 'idle' (walk/stand), 'fall' (tunnel pose), 'cheer'
 */
function buildTwin(name) {
  const isA = name === 'adalyn';
  let ribbons = null, finG = null, mHair = null;
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

  // swimsuit extras (shown instead of the skirt when the girls go in the ocean): bottoms, ruffle, polka dots
  const swimG = new THREE.Group(); swimG.visible = false; body.add(swimG);
  swimG.add(mk(cyl(.2, .25, .3, 18), accent, [0, .66, 0]));
  const ruffle = mk(new THREE.TorusGeometry(.27, .05, 8, 24), 0xffffff, [0, .5, 0]); ruffle.rotation.x = Math.PI / 2; swimG.add(ruffle);
  for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; swimG.add(mk(sph(.035, 8, 6), 0xffffff, [Math.cos(a) * .245, .7, Math.sin(a) * .245])); }
  for (const s of [-1, 1]) swimG.add(mk(sph(.04, 8, 6), 0xffffff, [s * .1, 1.12, .2]));

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
  const horn = outline(mk(new THREE.ConeGeometry(.11, .68, 16), 0xfffbe6, [0, 2.2, .2]), 1.07); horn.rotation.x = .3;
  for (let i = 0; i < 5; i++) { const r = mk(new THREE.TorusGeometry(.095 - i * .017, .017, 6, 14), 0xffc83d, [0, -.24 + i * .12, 0]); r.rotation.x = Math.PI / 2; horn.add(r); }
  const hornGlow = glowSprite(0xfff1a0, .9, .45); hornGlow.position.set(0, .34, 0); horn.add(hornGlow);
  unicornG.add(horn);
  for (const s of [-1, 1]) {
    const ear = outline(mk(new THREE.ConeGeometry(.14, .4, 10), 0xfffbe6, [s * .34, 1.86, -.02]), 1.06); ear.rotation.z = -s * .4;
    unicornG.add(ear, mk(sph(.06), 0xff9fcb, [s * .33, 1.84, .05], [1, 1.9, .5]));
    // flowing rainbow ribbons from the sides of the head
    const rib = new THREE.Group(); rib.position.set(s * .44, 1.5, -.1); unicornG.add(rib); (ribbons = ribbons || []).push(rib);
    RAINBOW.forEach((c, i) => rib.add(mk(sph(.075), c, [s * (i * .04), -.06 - i * .13, -.04 - i * .05])));
  }
  RAINBOW.forEach((c, i) => unicornG.add(mk(sph(.17 - i * .006), c, [0, 1.85 - i * .19, -.36 - Math.sin(i * .5) * .14])));   // rainbow mane
  const uTail = new THREE.Group(); uTail.position.set(0, .7, -.3); unicornG.add(uTail);
  RAINBOW.forEach((c, i) => uTail.add(outline(mk(sph(.15 + i * .02), c, [0, -i * .13 + .15, -.1 - i * .12]), 1.08)));
  unicornG.add(mk(new THREE.TorusGeometry(.43, .035, 6, 24), 0xffc83d, [0, .43, 0]).rotateX(Math.PI / 2));      // golden hem trim

  // ---- MERMAID extras ----
  const mermaidG = new THREE.Group(); mermaidG.visible = false; body.add(mermaidG);
  const tail = new THREE.Group(); tail.position.set(0, .8, 0); mermaidG.add(tail);
  const tcols = [0x1fd0c0, 0x2fd6c8, 0x3fd8d8, 0x58d8f0, 0x82c4f4, 0xa8a8f8, 0xc88cf8, 0xff8fd0];
  tcols.forEach((c, i) => {
    const r = .27 - i * .028;
    const seg = outline(mk(sph(r, 16, 12), c, [0, -.08 - i * .125, -i * .035], [1, 1.0, .9]), 1.07);
    for (let k = 0; k < 3; k++) seg.add(mk(sph(r * .28, 8, 6), 0xffffff, [(k - 1) * r * .55, r * .25, r * .8], [1, .6, .4]));   // shiny scales
    tail.add(seg);
  });
  const fin = new THREE.Group(); fin.position.set(0, -1.05, -.26); tail.add(fin); finG = fin;
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
    const f = mk(sph(.28 - k * .04, 12, 8), k % 2 ? 0xff8fd0 : 0xc88cf8, [s * (.22 + k * .1), -.06 - k * .1, 0], [1.1, .5, .22]); f.rotation.z = s * (.5 + k * .35); fin.add(f);
  }
  mHair = new THREE.Group(); mHair.position.set(0, 1.5, -.38); mermaidG.add(mHair);
  for (let i = 0; i < 4; i++) mHair.add(mk(sph(.36 - i * .03), HAIR, [Math.sin(i * 1.3) * .08, -i * .28, -i * .03], [.95, 1.3, .55]));
  mermaidG.add(mk(sph(.09), 0xff7fb8, [.3, 1.74, .2], [1, .7, .6]), mk(sph(.05), 0xffe14d, [.3, 1.78, .26]));   // starfish clip
  for (let i = 0; i < 5; i++) mermaidG.add(mk(sph(.028), 0xffffff, [-.18 + i * .09, 1.9 - Math.abs(i - 2) * .02, .28]));   // pearl headband
  for (let i = 0; i < 9; i++) { const a = (i / 8) * Math.PI - Math.PI / 2; mermaidG.add(mk(sph(.035), 0xfffaf0, [Math.sin(a) * .2, 1.2 - Math.cos(a) * .02 + .07, .17 + Math.cos(a) * .06])); }   // pearl necklace
  mermaidG.add(mk(sph(.17, 12, 8), 0xff9fd0, [-.1, 1.05, .15], [1, .8, .6]), mk(sph(.17, 12, 8), 0xff9fd0, [.1, 1.05, .15], [1, .8, .6]));   // bigger shell top

  // ---- animation state ----
  const fxs = { lift: 0, spin: 0, squash: 1 };
  const T = {
    name, root, body, form: 'girl', outfit: 'dress', mode: 'idle', fx: fxs, accent, phase: Math.random() * 6, face: 0,
    setForm(f) {
      T.form = f;
      if (f !== 'girl') T.outfit = 'dress';          // unicorn and mermaid have their own outfits
      const merm = f === 'mermaid';
      mTorso.visible = merm;
      arms.forEach((a) => (a.children[2].material.color.set(merm ? SKIN : accent)));
      unicornG.visible = f === 'unicorn'; mermaidG.visible = merm;
      root.scale.setScalar(f === 'girl' ? 1 : 1.12);
      T.applyOutfit();
    },
    /** 'dress' or 'swim' (swimsuit, bare feet). Only matters while she is a regular girl. */
    setOutfit(o) { T.outfit = o; T.applyOutfit(); },
    applyOutfit() {
      const merm = T.form === 'mermaid', swim = T.outfit === 'swim' && T.form === 'girl';
      skirtG.visible = !merm && !swim; legsG.visible = !merm; top.visible = !merm; swimG.visible = swim;
      shoes.forEach((s) => s.material.color.set(T.form === 'unicorn' ? 0xffd34d : swim ? SKIN : 0xffffff));
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
      if (ribbons) ribbons.forEach((r, i) => { r.rotation.z = Math.sin(t * 3 + i * 2) * .16 + (moving ? (i ? -.35 : .35) : 0); r.rotation.x = moving ? .5 : Math.sin(t * 2) * .1; });
      if (mHair) { mHair.rotation.z = Math.sin(t * 2) * .07; mHair.rotation.x = moving ? .2 : Math.sin(t * 1.5) * .05; }
      if (finG) finG.rotation.z = Math.sin(t * 5) * .18;

      // transformation / special effects
      body.position.y += fxs.lift;
      body.rotation.y = fxs.spin;
      const sq = fxs.squash;
      body.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
      shadow.visible = root.position.y > -.1;
      shadow.scale.setScalar(Math.max(.4, 1 - fxs.lift * .2));
    },
  };
  shadow.userData.noShadow = true;
  root.traverse((o) => { if (o.isMesh && !o.userData.noShadow) o.castShadow = true; });
  return T;
}

/** Grown-ups sitting on towels: mom and dad. */
function buildAdult(kind) {
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

// ---- "film" look: soft, slightly glossy materials and no outlines, so the girls match the movie-like worlds ----
function polishFilm(root) {
  root.traverse((o) => {
    if (!o.isMesh || !o.material || !o.material.color) return;
    const hex = o.material.color.getHexString();
    if (hex === SKIN.toString(16)) { o.material.roughness = 0.5; o.material.emissive = new THREE.Color(0xff9a6a); o.material.emissiveIntensity = 0.07; }   // warm glow, like light passing through skin
    else if (hex === HAIR.toString(16).padStart(6, '0')) { o.material.roughness = 0.34; o.material.clearcoat = 0.55; o.material.clearcoatRoughness = 0.25; o.material.sheen = 0; }
    else if (hex === EYE.toString(16)) { o.material.roughness = 0.1; o.material.clearcoat = 1; o.material.clearcoatRoughness = 0.05; o.material.sheen = 0; }
  });
}
function film(fn, arg) {
  const prev = getStyle(); setStyle('film');
  try { const r = fn(arg); polishFilm(r.root || r); return r; } finally { setStyle(prev); }
}
export const createTwin = (name) => film(buildTwin, name);
export const createAdult = (kind) => film(buildAdult, kind);