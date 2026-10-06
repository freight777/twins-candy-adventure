// Esmae's friends' houses (like Uni's): four little underwater rooms (src/board/house.js), each with a counting mini-game.
// Goals grow with her math level; the panel's ten-frame fills and the voice counts along.
import * as THREE from 'three';
import { toon, mk, glowSprite, emojiSprite, ease, rand, pick, lerp, RAINBOW } from '../util.js';
import { createRoom, bubbleTex } from '../board/house.js';
import { createMermaid, heartGeo, LOOKS } from './mermaid.js';

const sph = (r, w = 20, h = 14) => new THREE.SphereGeometry(r, w, h);
const cyl = (rt, rb, h, s = 20) => new THREE.CylinderGeometry(rt, rb, h, s);
const V = (x, y, z) => new THREE.Vector3(x, y, z);

export const HOUSES = {
  sparkle: { title: "Sparkle's Shell Salon", goal: 5, how: 'Tap the hair clips to put them in her hair!' },
  rainbow: { title: "Rainbow's Coral Band", goal: 6, how: 'Tap every color to play music!' },
  kitty:   { title: "Kitty's Fish Cafe", goal: 4, how: 'Give each fish one treat!' },
  lucy:    { title: "Lucy's Bubble Room", goal: 5, how: 'Pop the bubbles!' },
};
const THEMES = {
  sparkle: { wall: 0xffc8e6, floor: 0xfff0dc, rug: 0xff8fc8, ceil: 0xffb0d8, light: 0xffe0f0, win: 0x3aa8e0 },
  rainbow: { wall: 0xd4f2ff, floor: 0xfff4dc, rug: 0x7be0d0, ceil: 0xa8e4ff, light: 0xe8fff8, win: 0x3aa8e0 },
  kitty:   { wall: 0xffdcc8, floor: 0xfff0d8, rug: 0xff9a8a, ceil: 0xffbca8, light: 0xfff0e0, win: 0x3aa8e0 },
  lucy:    { wall: 0xe4d8ff, floor: 0xfff4f8, rug: 0xc9a8ff, ceil: 0xd8c4ff, light: 0xf8f0ff, win: 0x3aa8e0 },
};
/** goals sized by her math level: 5 / 8 / 10 for the open-ended counts */
const bigGoal = (lvl) => (lvl <= 1 ? 5 : lvl <= 3 ? 8 : 10);
const mermaid = (look) => () => { const m = createMermaid(look); m.upright = true; return m; };

/** A friend's underwater house to visit (api: see board/house.js) */
export function createHouse(key, api) {
  const H = createRoom(key, api, { info: HOUSES[key], theme: THEMES[key], water: true, standY: 2.4, visitor: mermaid(LOOKS.esmae), host: mermaid(LOOKS[key]) });
  GAMES[key](H, api, api.level ? api.level('math') : 0);
  return H.ready();
}

const GAMES = {
  /** float the hair clips into Sparkle's hair */
  sparkle(H, api, lvl) {
    const { scene, fx } = H, host = H.host; H.goal = bigGoal(lvl);
    // a big scallop-shell mirror on the back wall
    const shell = new THREE.Group(); shell.position.set(0, 3.2, -9.6); scene.add(shell);
    shell.add(mk(new THREE.CircleGeometry(3, 40, 0, Math.PI), toon(0xffd0e8), [0, 0, 0]), mk(new THREE.CircleGeometry(2.1, 40, 0, Math.PI), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: .06 }), [0, .25, .05]));
    for (let k = 0; k <= 8; k++) { const a = (k / 8) * Math.PI, r = mk(new THREE.BoxGeometry(.16, 3, .14), 0xffa8d0, [Math.cos(a) * 1.5, Math.sin(a) * 1.5, .02]); r.rotation.z = a - Math.PI / 2; shell.add(r); }
    scene.add(mk(new THREE.BoxGeometry(6, .5, 2.2), toon(0xffffff), [0, 1.6, -8.4]), mk(cyl(.25, .3, 1.4, 12), 0xffd0e8, [-2.4, .7, -8.4]), mk(cyl(.25, .3, 1.4, 12), 0xffd0e8, [2.4, .7, -8.4]));
    const cols = [0xff5fa4, 0xffd84d, 0x62e0d0, 0xb07cff, 0xff9f4d, 0x7bd0ff], geo = heartGeo(.42, .16), clips = [];
    const place = (c) => { c.position.set(rand(-6.5, 6.5), rand(2.2, 7.5), rand(-5, 1.5)); c.userData.y0 = c.position.y; c.userData.ph = rand(0, 6); c.visible = true; c.userData.free = true; c.scale.setScalar(1); scene.add(c); };
    for (let i = 0; i < 9; i++) {
      const col = cols[i % cols.length], c = new THREE.Mesh(geo, toon(col, { emissive: col, emissiveIntensity: .3 })); c.add(glowSprite(col, 2.2, .45)); place(c); clips.push(c);
      H.tapOn(c, async () => {
        if (!c.userData.free || H.count >= H.goal) return; c.userData.free = false;
        const k = H.count++; H.progress(); api.sfx.collect(k); fx.burst(c.position.clone(), { count: 20, colors: [col, 0xffffff], speed: 3, gravity: 0, life: .8, size: .8 });
        // into her hair: a headband of clips across the front of her head, outside the hair, each facing out
        host.head.attach(c); c.children.forEach((g) => (g.visible = false));
        const from = c.position.clone(), q0 = c.quaternion.clone(), ang = ((k % 10) - 4.5) * .29, to = V(Math.sin(ang) * .8, .47 + Math.cos(ang) * .12, Math.cos(ang) * .56 + .05), s0 = c.scale.x;
        const q1 = new THREE.Quaternion().setFromEuler(new THREE.Euler(-.25, ang, 0));
        await H.anim(.6, (e) => { c.position.lerpVectors(from, to, e); c.quaternion.slerpQuaternions(q0, q1, e); c.scale.setScalar(lerp(s0, .4, e)); }, ease.out);
        H.hop(host, .8); api.sfx.sparkle();
        if (H.count >= H.goal) H.celebrate();
      }, 1.3);
    }
    H.extra.push({ update: (t) => clips.forEach((c) => { if (c.userData.free) { c.rotation.y = t * 1.4 + c.userData.ph; c.position.y = c.userData.y0 + Math.sin(t * 1.6 + c.userData.ph) * .4; } }) });
  },

  /** play every colour of the coral band */
  rainbow(H, api) {
    const { scene, fx, timers } = H, notes = new Set(), pipes = [];
    RAINBOW.forEach((c, k) => { const arc = new THREE.Mesh(new THREE.TorusGeometry(9 - k * .7, .4, 10, 40, Math.PI), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: .1, roughness: .6 })); arc.position.set(0, .3, -9.6); scene.add(arc); pipes.push({ arc }); });
    H.host.root.position.x = 7.2; H.visitor.root.position.x = -7.2;
    RAINBOW.forEach((c, k) => {
      const h = 2.4 + (k % 3) * .5 + (5 - k) * .25, p = new THREE.Group(); p.position.set((k - 2.5) * 1.9, 0, .4 - Math.abs(k - 2.5) * .35); scene.add(p);
      const mat = toon(c, { emissive: c, emissiveIntensity: .15, clearcoat: 1, unique: true });
      p.add(mk(cyl(.55, .7, h, 18), mat, [0, h / 2, 0]), mk(new THREE.TorusGeometry(.55, .14, 8, 20).rotateX(Math.PI / 2), 0xffffff, [0, h, 0]), mk(sph(.3, 12, 8), mat, [.75, h * .55, 0]), mk(sph(.24, 12, 8), mat, [-.7, h * .35, .1]));
      pipes[k].mat = mat;
      H.tapOn(p, () => {
        api.sfx.note(k); p.scale.y = 1.15; timers.tween(.4, (e) => { p.scale.y = 1.15 - .15 * e; }, { ease: ease.out });
        fx.burst(p.position.clone().add(V(0, h + .4, 0)), { count: 22, colors: [c, 0xffffff, 0xcff6ff], speed: 3, gravity: 1.5, life: 1.4, size: .9 });
        pipes[k].arc.material.emissiveIntensity = 1.1; H.hop(H.host, .9);
        if (!notes.has(k)) { notes.add(k); H.count = notes.size; H.progress(); if (notes.size >= 6) H.celebrate(); }
      }, 1.6);
    });
    H.extra.push({ update: (t) => pipes.forEach(({ arc }, k) => { arc.material.emissiveIntensity = lerp(arc.material.emissiveIntensity, notes.has(k) ? (H.done ? .9 + Math.sin(t * 3 + k) * .2 : .5) : .1, .05); }) });
  },

  /** one treat for each fish (one-to-one: a fish that has had its treat just wiggles) */
  kitty(H, api, lvl) {
    const { scene, fx } = H, host = H.host, n = H.goal = lvl <= 1 ? 4 : 6, fish = [];
    scene.add(mk(new THREE.BoxGeometry(5.5, 2.2, 2), toon(0xffffff), [0, 1.1, -8.6]), mk(new THREE.BoxGeometry(5.9, .3, 2.4), 0xff9a8a, [0, 2.3, -8.6]));     // the cafe counter
    const jar = new THREE.Group(); jar.position.set(0, 2.4, -8.4); scene.add(jar);
    jar.add(mk(cyl(.7, .7, 1.4, 18), new THREE.MeshStandardMaterial({ color: 0xd8f4ff, transparent: true, opacity: .45, roughness: .1 }), [0, .7, 0]), mk(cyl(.75, .75, .25, 18), 0xff9a8a, [0, 1.5, 0]));
    for (let i = 0; i < 9; i++) jar.add(mk(sph(.16, 8, 6), 0xffa040, [rand(-.4, .4), rand(.2, 1.1), rand(-.4, .4)]));
    const body = sph(.6, 16, 12), tail = new THREE.ConeGeometry(.45, .7, 10).rotateX(Math.PI / 2), cols = [0xffb04a, 0x5bc0ff, 0xff7ab8, 0x7be0a0, 0xb07cff, 0xffe14d];
    for (let i = 0; i < n; i++) {
      const g = new THREE.Group(), c = cols[i % cols.length];
      g.add(mk(body, toon(c), [0, 0, 0], [.8, .8, 1.2]), mk(tail, toon(c), [0, 0, -.95], [.4, 1, 1]), mk(sph(.1, 8, 6), 0x1a0d2a, [.32, .15, .45]), mk(sph(.1, 8, 6), 0x1a0d2a, [-.32, .15, .45]));
      const want = emojiSprite('\u{1F364}', 1.1); want.position.y = 1.1; g.add(want);
      const heart = emojiSprite('\u{1F496}', 1); heart.position.y = 1.1; heart.visible = false; g.add(heart);
      const row = i % 2, col = Math.floor(i / 2), cols2 = Math.ceil(n / 2); g.scale.setScalar(1.45);         // two rows between the mermaids
      g.userData = { cx: (col - (cols2 - 1) / 2) * 2.7 + row * .6, cy: 2.5 + row * 2.2, cz: .6 - row * .9, ph: rand(0, 6), fed: false, want, heart, wig: 0 };
      scene.add(g); fish.push(g);
      H.tapOn(g, async () => {
        const u = g.userData; u.wig = .6;
        if (u.fed) { api.sfx.giggle(); return; }                                  // this one already has a treat
        u.fed = true; u.want.visible = false;
        const treat = mk(sph(.22, 10, 8), 0xffa040, [0, 0, 0]); scene.add(treat);
        const a = jar.position.clone().add(V(0, 1.8, 0)), b = g.position.clone();
        api.sfx.pop(); H.hop(host, .7);
        await H.anim(.55, (k) => { treat.position.lerpVectors(a, b, k); treat.position.y += Math.sin(k * Math.PI) * 1.5; });
        scene.remove(treat); treat.geometry.dispose(); u.heart.visible = true; api.sfx.yum();
        fx.burst(b, { count: 18, colors: [0xff9ed8, 0xffffff, 0xffd84d], speed: 3, gravity: 0, life: .9, size: .8 });
        H.count = fish.filter((f) => f.userData.fed).length; H.progress(); if (H.count >= n) H.celebrate();
      }, 1.2);
    }
    H.extra.push({ update: (t, dt) => fish.forEach((g) => {
      const u = g.userData, a = t * .6 + u.ph; u.wig = Math.max(0, u.wig - dt);
      g.position.set(u.cx + Math.cos(a) * .5, u.cy + Math.sin(t * 1.3 + u.ph) * .25, u.cz + Math.sin(a) * .4);
      g.rotation.y = Math.sin(a) * .5 + Math.sin(t * 25) * u.wig * .5;
    }) });
  },

  /** pop the bubbles as they float up */
  lucy(H, api, lvl) {
    const { scene, fx } = H; H.goal = bigGoal(lvl);
    const vents = [[-4.5, -3], [0, -5.5], [4.5, -3]].map(([x, z]) => { const v = new THREE.Group(); v.position.set(x, 0, z); scene.add(v); v.add(mk(new THREE.SphereGeometry(.9, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), toon(0xffc8e0, { clearcoat: 1 }), [0, 0, 0], [1, .5, 1])); return v; });
    const mat = new THREE.MeshStandardMaterial({ color: 0xd8f0ff, emissive: 0x9fd8ff, emissiveIntensity: .25, transparent: true, opacity: .35, roughness: .05, metalness: .2, depthWrite: false });
    const geo = sph(.75, 24, 16), bubbles = [];
    const spawn = (b) => { const v = pick(vents); b.position.set(v.position.x + rand(-.5, .5), .6, v.position.z + rand(-.5, .5)); b.userData.sp = rand(.7, 1.3); b.userData.ph = rand(0, 6); b.userData.s = rand(.8, 1.25); b.scale.setScalar(.1); b.userData.grow = 0; b.visible = true; };
    for (let i = 0; i < 7; i++) {
      const b = new THREE.Mesh(geo, mat), shine = new THREE.Sprite(new THREE.SpriteMaterial({ map: bubbleTex(), transparent: true, depthWrite: false })); shine.scale.setScalar(1.7); b.add(shine);
      spawn(b); b.position.y = rand(.6, 8); b.userData.grow = 1; scene.add(b); bubbles.push(b);
      H.tapOn(b, () => {
        if (!b.visible) return; b.visible = false; api.sfx.pop();
        fx.burst(b.position.clone(), { count: 26, colors: [0xffffff, 0xcff6ff, 0xffd0f0], speed: 4, gravity: 0, life: .8, size: .8 });
        if (H.count < H.goal) { H.count++; H.progress(); if (H.count >= H.goal) H.celebrate(); }
        H.sleep(.8).then(() => spawn(b));
      }, 1.1);
    }
    H.extra.push({ update: (t, dt) => bubbles.forEach((b) => {
      if (!b.visible) return; const u = b.userData;
      u.grow = Math.min(1, u.grow + dt * 1.5); b.scale.setScalar(u.s * ease.outBack(u.grow));
      b.position.y += u.sp * dt; b.position.x += Math.sin(t * 1.4 + u.ph) * dt * .4;
      if (b.position.y > 9.5) spawn(b);
    }) });
  },
};
