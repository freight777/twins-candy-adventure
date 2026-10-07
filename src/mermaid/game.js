import '../board/board.css';
import './mermaid.css';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { skyEnv } from '../env.js';
import { ease, clamp, rand, pick, RAINBOW, stripedGeo, setCaustic } from '../util.js';
import { playMusic, sfx, voice, playScore, stopScore, clipAt, preloadVoice } from '../audio.js';
import { PIC } from '../learn/words.js';
import { levelOf } from '../learn/profile.js';
import { unitForLevel } from '../learn/code.js';
import { emojiSprite } from '../util.js';
import { ask } from '../engine/quiz.js';
import { makeReadingQuestion } from '../learn/reading.js';
import { settings as learn, award } from '../learn/profile.js';
import { createBoardGame } from '../board/deck.js';
import { buildOcean, FRIEND_TILES } from './ocean.js';
import { createMermaid, createSeahorse, heartGeo, LOOKS } from './mermaid.js';
import { ANTHEM, singWords } from './anthem.js';
import { createHouse, HOUSES } from './houses.js';

const HOVER = 2.3;                                   // swimming height above the path line
const SCALE = 1.15;
const FRIENDS = [
  { key: 'sparkle', name: 'Sparkle', emoji: '✨', css: '#ff7ab8', voice: 'sparkle', line: "Hi Esmae! I'm Sparkle! Let's shine together!", burst: [0xffd0f0, 0xff7ab8, 0xffffff],
    need: { emoji: '\u{1F380}', what: 'her hair clip', lost: 'Oh no! I lost my hair clip! Can you help me find it?' } },
  { key: 'rainbow', name: 'Rainbow', emoji: '\u{1F308}', css: '#5bc0ff', voice: 'rainbow', line: "Hello Esmae! I'm Rainbow! I love every color!", burst: RAINBOW,
    need: { emoji: '\u{1F41A}', what: 'her pretty shell', lost: 'Oh no! I lost my pretty shell! Can you help me find it?' } },
  { key: 'kitty', name: 'Kitty', emoji: '\u{1F431}', css: '#ff6a6a', voice: 'cat', line: "Hi Esmae! I'm Kitty! Let's swim and play!", burst: [0xff6a6a, 0xffb0b0, 0xffffff],
    need: { emoji: '\u{1F41F}', what: 'her toy fish', lost: 'Oh no! I lost my toy fish! Can you help me find it?' } },
];
const upBy = (y) => new THREE.Vector3(0, y, 0);
const _q = new THREE.Vector3(), _r = new THREE.Vector3();
let W, hero, lucy, king, queen;
const bubblesAt = (p, count = 6) => G.fx.burst(p, { count, colors: [0xffffff, 0xcff6ff, 0xa8e8ff], speed: .9, gravity: 2.4, life: 2, size: .9 });

const G = createBoardGame({
  hero: { name: 'Esmae', voice: 'hero', emoji: '\u{1F9DC}‍♀️' }, friends: FRIENDS, twin: { name: 'Lucy', emoji: '\u{1F496}', css: '#ff9ed8' },
  deckIcon: '&#128026;', banner: 'You did it, Esmae!', music: 'ocean', debugName: 'mermaidGame', reader: 'esmae', scoreFrame: '\u{1F496}',
  pipeline: { exposure: 0.85, bloom: { strength: 0.22, radius: 0.6, threshold: 0.95 }, grade: { sat: 1.12, con: 1.05 }, shadows: false },
  shadows: false,                                                              // hard sun shadows under the sea looked wrong (and cost the most)
  lift: HOVER, cardTime: 1.8, leg: { perStep: .34, min: .7 },
  intro: ['\u{1F9DC}‍♀️ \u{1F42C} \u{1F496}', "Let's go on a mermaid adventure, Esmae!", 3.6],
  slide: ['\u{1F42C} \u{1F30A}', 'A dolphin ride!'],
  pickupColors: [0xff9ed8, 0xffffff, 0xff5fa4], joinColors: [0xff9ed8, 0xffffff, 0xff5fa4],
  sparkle: { gravity: 1.2, life: 1.4 }, tapUp: 1.8,
  meet: { side: 4.2, ahead: 1.2, dur: 1.5, hop: .55, up: [1.4, 1.5] }, parade: { side: 2, bob: .3 },
  cam: { back: 9.5, side: 3.6, up: 6.8, ahead: 3, lookUp: .2, ride: 5, bob: .4, floor: 2.5, greet: { back: 6, side: 10, up: 5.5, lookUp: 0 } },
  party: { center: () => W.terrace, r: 14, y: [4, 16], colors: RAINBOW.concat([0xffffff, 0xff9ed8]) },
  houses: { keys: ['sparkle', 'rainbow', 'kitty', 'lucy'], info: HOUSES, create: createHouse, lockedTwin: 'Meet Lucy at the palace first!' },
  build,
  hooks: {
    ready() {
      const S = G.S; S.dirS.copy(G.pathTan(0)).setY(0).normalize();
      G.camera.position.copy(hero.root.position).addScaledVector(S.dirS, -11.5).addScaledVector(G.side(S.dirS), 6.5).add(upBy(8.6)); G.camTarget.copy(hero.root.position);
    },
    puff: bubblesAt,
    trail: (p, t) => { if (Math.random() < .6) bubblesAt(_q.set(p.x - t.x * 1.6, p.y - .4 + Math.random(), p.z - t.z * 1.6), 1); },
    wake: (p, dt) => { if (Math.random() < dt * 25) bubblesAt(_q.copy(p).add(_r.set(rand(-.5, .5), rand(-1.5, .5), rand(-.5, .5))), 1); },
    stop: async (i) => { const pearl = W.pearls.find((p) => p.tile === i); if (pearl) await treat(pearl); },
    onFriend: kindness,
    // hearts are counted out loud up to ten; every full ten-frame is "a full frame of love"
    onScore(n, added, before) {
      if (Math.floor(n / 10) > Math.floor(before / 10)) { voice('full_frame_love', { priority: 1 }); award('esmae', 'frame-of-love'); return; }
      if (added === 1 && n <= 10) voice(`n_${n}`, { priority: 1, tag: 'count' });
    },
    ride: dolphinRide,
    finale,
    cheer: anthem,
    reset() {
      S.pearls = 0; document.querySelectorAll('#pearls i').forEach((e) => e.classList.remove('got')); W.pearls.forEach((p) => (p.pearl.visible = true));
      if (S.song) S.song.stop(); S.song = null; karaoke(null); stopScore(); S.giftOn = false; S.giftKinds.forEach((k) => (k.m.visible = false)); S.gifts = [];
      S.pets.forEach((p) => (p.root.visible = false)); playMusic('ocean');
    },
    resetTwin() {
      lucy.root.position.copy(W.terrace).add(new THREE.Vector3(W.endT.x * 3, 2.8, W.endT.z * 3)).addScaledVector(G.side(W.endT), 6);
      lucy.root.rotation.set(0, Math.atan2(-W.endT.x, -W.endT.z), 0); lucy.root.visible = true;
    },
    update(dt, t) { king.update(dt, t, 0); queen.update(dt, t, 0); updateGifts(dt, t); },
    camera(mode, desired, look, t) {
      if (mode === 'title') {                                                    // a slow swim around Esmae, so the title shows her
        const up = hero.root.position, a = t * .22 + .5;
        desired.set(up.x + Math.sin(a) * 8.5, up.y + 2.8, up.z + Math.cos(a) * 8.5); look.copy(up); look.y += 1.3; return true;
      }
      if (mode === 'finale') {                                                   // swing gently in front of the palace
        const f = W.endT, ang = Math.sin(t * .3) * .7, ca = Math.cos(ang), sa = Math.sin(ang), tc = W.terrace;
        desired.copy(tc).addScaledVector(_q.set(-f.x * ca + f.z * sa, 0, -f.z * ca - f.x * sa), 25); desired.y += 10.5;
        look.copy(tc).addScaledVector(f, 5); look.y += 3.5; return true;
      }
      return false;
    },
  },
});
const { ui, S, sleep, anim, sparkleAt } = G;
Object.assign(S, { gifts: [], giftKinds: [], pets: [], pearls: 0 });

async function build() {
  await new Promise((r) => setTimeout(r, 30));
  const { scene } = G;
  setCaustic(.45);                                                              // everything built under the sea shimmers with caustic light
  W = G.W = buildOcean(scene);
  scene.environment = skyEnv(G.renderer, 'ocean', { top: 0x8fe8ff, mid: 0x4ab8e8, bottom: 0x1a5a9a, sun: [10, 40, 5], sunColor: 0xe8fff8, sunPower: 5 }); scene.environmentIntensity = 0.5;
  scene.fog = new THREE.FogExp2(0x2a9fd0, 0.0105);
  scene.add(new THREE.HemisphereLight(0xcff8ff, 0x2a6aa0, 1.0));
  G.addSun(0xe8fff8, 1.6, [14, 40, 10], 36);
  G.linearize(); W.cam = G.camera;
  const mermaid = (look, s = SCALE) => { const m = createMermaid(look); m.root.scale.setScalar(s); scene.add(m.root); return m; };
  hero = G.hero = mermaid(LOOKS.esmae);
  G.friends = FRIENDS.map((f, i) => {
    const t = W.tiles[FRIEND_TILES[i]], sd = i % 2 ? 1 : -1, spot = t.pos.clone().add(G.side(t.tan).multiplyScalar(sd * 7)).add(upBy(1.6 + i * .4));
    return { ...f, i, u: mermaid(LOOKS[f.key]), met: false, speed: 0, spot, tile: FRIEND_TILES[i], side: sd };
  });
  lucy = G.twin = mermaid(LOOKS.lucy);
  king = mermaid(LOOKS.king, 1); queen = mermaid(LOOKS.queen, 1);
  [king, queen].forEach((m) => { m.upright = true; m.root.rotation.y = Math.atan2(-W.endT.x, -W.endT.z); });
  king.root.position.copy(W.kingSpot); queen.root.position.copy(W.queenSpot);
  setCaustic(0);
  G.taps = [{ u: lucy, n: 'Lucy' }, { u: king, n: 'The King' }, { u: queen, n: 'The Queen' }];
  lucy.speaker = 'lucy'; king.speaker = 'king'; queen.speaker = 'queen'; G.talkers = [king, queen];
}

// ---------------------------------------------------------------- the squares' surprises
async function dolphinRide(sc) {
  const dolphin = W.rideDolphin; dolphin.root.visible = true;
  await G.ride(sc, 2.6, (p, t) => {
    dolphin.root.position.copy(p); dolphin.root.position.y -= .2; dolphin.root.rotation.set(-Math.asin(clamp(t.y, -.8, .8)), Math.atan2(t.x, t.z), 0, 'YXZ'); dolphin.update(S.time, 1.8);
    hero.root.position.copy(p); hero.root.position.y += 1.5; hero.lookToward(t.x, t.z, 0.3); hero.root.rotation.x = -Math.asin(clamp(t.y, -.7, .7)) * 0.7;
    bubblesAt(p, 3);
    if (Math.random() < .4) sparkleAt(p, [0xffffff, 0xffe0f0, 0xcff6ff], 2, 1.4);
  });
  sparkleAt(G.above(hero, 1), RAINBOW, 50, 6);
  const end = dolphin.root.position.clone(), fwd = new THREE.Vector3(Math.sin(dolphin.root.rotation.y), .6, Math.cos(dolphin.root.rotation.y));
  await anim(1.4, (k) => { dolphin.root.position.copy(end).addScaledVector(fwd, k * 22); dolphin.update(S.time, 1.8); }, ease.in);
  dolphin.root.visible = false;
}
async function treat(pr) {
  ui.bubble('\u{1F9AA} \u{1F90D}', 'A shiny pearl!', 'hero'); sfx.yum();
  pr.group.userData.open = true; G.face(hero, pr.spot);
  await anim(.5, (k) => { hero.lift = Math.sin(k * Math.PI) * 1.2; }, ease.linear); hero.lift = 0;
  sparkleAt(pr.spot.clone().add(upBy(2.6)), [0xffffff, 0xffd8f0, 0xfff0a0], 50, 5); sfx.sparkle(); bubblesAt(pr.spot.clone().add(upBy(1.6)), 14);
  await flyPearl(pr);
  G.addStars(3); await sleep(1.2); ui.hideBubble(); pr.group.userData.open = false;
}
/** the pearl leaves the clam and lands in the pearl tray at the top of the screen: kids expect to GET things */
function flyPearl(pr) {
  const slot = document.querySelectorAll('#pearls i')[S.pearls || 0]; if (!slot) return Promise.resolve();
  const v = pr.pearl.getWorldPosition(new THREE.Vector3()).project(G.camera), r = slot.getBoundingClientRect();
  const x0 = (v.x + 1) / 2 * innerWidth, y0 = (1 - v.y) / 2 * innerHeight, x1 = r.left + r.width / 2, y1 = r.top + r.height / 2;
  const el = document.createElement('div'); el.className = 'fly-pearl'; document.body.appendChild(el); pr.pearl.visible = false;
  const a = el.animate([{ transform: `translate(${x0}px, ${y0}px) scale(1.7)` }, { transform: `translate(${(x0 + x1) / 2}px, ${Math.min(y0, y1) - 60}px) scale(1.4)`, offset: .45 }, { transform: `translate(${x1}px, ${y1}px) scale(.9)` }], { duration: 950, easing: 'ease-in-out', fill: 'forwards' });
  return new Promise((res) => { a.onfinish = () => { el.remove(); slot.classList.add('got'); S.pearls = (S.pearls || 0) + 1; sfx.collect(S.pearls); res(); }; });
}

// ---------------------------------------------------------------- kindness: each friend has lost something, and finding it IS the reading question
async function kindness(f) {
  const n = f.need;
  await ui.bubble(`${f.emoji} ${n.emoji} \u2753`, n.lost, f.voice, true, { priority: 2, minMs: 1600 });
  if (learn.on) { ui.hideBubble(); await ask(makeReadingQuestion('esmae'), 'esmae'); }
  // there it is, half buried in the sand right here! up it pops, and Esmae swims it over to her friend
  const item = emojiSprite(n.emoji, 1.8), hp = hero.root.position, start = hp.clone().addScaledVector(G.pathTan(S.u), 1.6), mid = hp.clone().add(upBy(2.4)), to = f.u.root.position.clone().add(upBy(1.6));
  start.y -= 2; item.position.copy(start); G.scene.add(item); sfx.magic(); bubblesAt(start.clone(), 16);
  await anim(.7, (k) => item.position.lerpVectors(start, mid, k), ease.outBack);
  sparkleAt(mid, [0xffffff, 0xffe0f0, 0xfff0a0], 30, 4); await sleep(.35);
  await anim(.85, (k) => { item.position.lerpVectors(mid, to, k); item.position.y += Math.sin(k * Math.PI) * 1.2; });
  G.scene.remove(item); item.material.dispose();
  sparkleAt(to, f.burst, 60, 6); sfx.tada(); G.hop(f.u, .55, 1.5);
  await ui.bubble(`${G.cfg.hero.emoji} ${n.emoji} ${f.emoji}`, `Esmae gave ${f.name} ${n.what}!`, 'hero', true, { priority: 2, minMs: 1600 });
  await ui.bubble(`${f.emoji} \u{1F496}`, "Thank you, Esmae! You're so kind!", f.voice, true, { priority: 2, minMs: 1300 });
}

// ---------------------------------------------------------------- the anthem, and a read-along: each bar lights up a word she can read
function anthem() {
  const words = singWords(unitForLevel(levelOf('esmae', 'reading')));
  preloadVoice([...new Set(words)].map((w) => `w_${w}`));
  S.song = playScore(ANTHEM, {
    onBar: (b, when) => { karaoke(words[b]); clipAt(`w_${words[b]}`, when + .02); },
    onEnd: () => { karaoke(null); S.song = null; playMusic('ocean', { fadeIn: 3 }); },          // back into the sea music, no silence
  });
}
function karaoke(word) {
  let el = document.getElementById('karaoke');
  if (!el) { el = document.createElement('div'); el.id = 'karaoke'; el.innerHTML = '<span class="kp"></span><span class="kw readable"></span>'; document.getElementById('ui').appendChild(el); }
  el.classList.toggle('hidden', !word || !!S.house);
  if (!word) return;
  el.querySelector('.kp').textContent = PIC[word] || ''; el.querySelector('.kw').textContent = word;
  el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
}

// ---------------------------------------------------------------- the Mermaid Palace: Lucy, the King and Queen, a lifetime of gifts
async function finale() {
  ui.bubble('\u{1F3F0} \u{1F451}', 'The Mermaid Palace! We made it!', 'hero'); sfx.fanfare();
  const tc = W.terrace, f = W.endT, sd = G.side(f);
  const a = hero.root.position.clone(), dest = tc.clone().addScaledVector(f, -3).add(upBy(HOVER + .3));
  S.speed = 1.2;
  await anim(2.4, (k) => { hero.root.position.lerpVectors(a, dest, k); hero.lookToward(f.x, f.z, .2); if (Math.random() < .5) bubblesAt(hero.root.position.clone(), 1); }); S.speed = 0;
  hero.lookToward(f.x, f.z, 1);
  // Lucy, her twin
  const la = lucy.root.position.clone(), ld = dest.clone().addScaledVector(sd, 3.8).add(upBy(.1));
  const lucySaid = ui.bubble('\u{1F9DC}‍♀️\u{1F9DC}‍♀️', "Esmae! It's me, Lucy! We're twins!", 'lucy', true, { priority: 2, minMs: 2000 });
  S.twinSpeed = 1.3; lucy.lookToward(ld.x - la.x, ld.z - la.z, 1);
  await anim(1.6, (k) => { lucy.root.position.lerpVectors(la, ld, k); lucy.lookToward(f.x, f.z, .1); }); S.twinSpeed = 0;
  sparkleAt(G.above(lucy, 1.4), [0xff9ed8, 0xffffff, 0xff5fa4], 80, 7); sfx.tada(); sfx.giggle();
  G.markMet(3); G.addStars(5); S.twinMet = true;                              // (Lucy's house opens)
  await G.hop(lucy, .55, 1.5); await G.hop(hero, .55, 1.5); await lucySaid; await sleep(.4);
  // the king and queen
  await ui.bubble('\u{1F451}', 'Welcome to the Mermaid Palace, Esmae and Lucy! Thank you for spreading so much love.', 'king', true, { priority: 2, minMs: 3000 }); await sleep(.4);
  await ui.bubble('\u{1F451}', 'You and your friends are so kind. We have gifts for you!', 'queen', true, { priority: 2, minMs: 2500 }); await sleep(.3);
  const gift = ui.bubble('\u{1F381} \u{1F496}', 'A lifetime supply of hair clips, toys, mermaid pets, and candy!', 'king', true, { priority: 2, minMs: 2500 });
  makeGifts(); sfx.magic(); sfx.fanfare();
  [king, queen].forEach((m) => sparkleAt(G.above(m, 3), [0xffd84d, 0xffffff, 0xff9ed8], 60, 7));
  await gift; await sleep(2.2);
}
/** the royal gifts and seahorse pets: built the first time, shown again (re-scattered) on every replay */
function makeGifts() {
  if (!S.giftKinds.length) buildGifts();
  const c = new THREE.Color(), tc = W.terrace, items = [];
  S.giftKinds.forEach((k) => { k.m.visible = true; for (let i = 0; i < k.n; i++) { c.set(k.cols[i % k.cols.length]); k.m.setColorAt(i, c); items.push({ k, i, a: rand(0, 6.28), r: rand(5, 14), h: rand(1, 11), sp: rand(.2, .5) * (Math.random() < .5 ? -1 : 1), s: rand(.8, 1.3), at: rand(0, 3.5), ph: rand(0, 6) }); } if (k.m.instanceColor) k.m.instanceColor.needsUpdate = true; });
  S.gifts = items; S.giftT = 0; S.giftOn = true; S.giftCenter = tc.clone().addScaledVector(W.endT, 1);
  S.pets.forEach((p, i) => { p.root.visible = true; p.root.position.copy(tc).add(upBy(3)); p.a = (i / 6) * 6.28; });
}
function buildGifts() {
  const mk1 = (geo, n, mat) => { const m = new THREE.InstancedMesh(geo, mat, n); m.frustumCulled = false; m.castShadow = false; G.scene.add(m); return m; };
  const std = (o = {}) => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .4, metalness: .1, ...o });
  const lolly = mergeGeometries([new THREE.SphereGeometry(.55, 14, 10).scale(1, 1, .25).translate(0, .9, 0), new THREE.CylinderGeometry(.06, .06, 1.4, 6).translate(0, .1, 0)]);
  const bear = mergeGeometries([new THREE.SphereGeometry(.55, 12, 10), new THREE.SphereGeometry(.38, 12, 10).translate(0, .75, 0), new THREE.SphereGeometry(.14, 8, 6).translate(-.28, 1.05, 0), new THREE.SphereGeometry(.14, 8, 6).translate(.28, 1.05, 0)]);
  const kinds = [
    { m: mk1(heartGeo(.6, .22), 40, std({ emissive: 0xff3a8c, emissiveIntensity: .25 })), n: 40, cols: [0xff5fa4, 0xff8fc8, 0xff7ec0, 0xffb0d8] },     // hair clips
    { m: mk1(lolly, 34, std({ roughness: .3 })), n: 34, cols: [0xff6fb5, 0xffd84d, 0x62e0d0, 0xb07cff, 0xff9f4d] },                             // candy
    { m: mk1(stripedGeo(new THREE.SphereGeometry(.7, 16, 12), RAINBOW), 14, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .4 })), n: 14, cols: [0xffffff] },   // beach balls
    { m: mk1(bear, 12, std({ roughness: .7 })), n: 12, cols: [0xffc8a0, 0xffe0f0, 0xd8c0ff, 0xc0f0ff] },                                              // teddy toys
  ];
  S.giftKinds = kinds;
  for (let i = 0; i < 6; i++) { const p = createSeahorse(pick([0xffb04a, 0xff7ab8, 0x7be0d0, 0xb07cff, 0xffd84d])); p.root.scale.setScalar(1.1); G.scene.add(p.root); S.pets.push(p); }
}
const gdum = new THREE.Object3D();
function updateGifts(dt, t) {
  if (!S.giftOn || !S.giftKinds.length) return;
  S.giftT += dt; const c = S.giftCenter;
  S.gifts.forEach((g) => {
    const k = clamp((S.giftT - g.at) / 1.2, 0, 1), a = g.a + t * g.sp;
    gdum.position.set(c.x + Math.cos(a) * g.r, c.y + g.h * ease.out(k) + Math.sin(t * 1.2 + g.ph) * .5, c.z + Math.sin(a) * g.r);
    gdum.rotation.set(t * .6 + g.ph, t * .9 + g.ph, 0); gdum.scale.setScalar(g.s * k); gdum.updateMatrix(); g.k.m.setMatrixAt(g.i, gdum.matrix);
  });
  S.giftKinds.forEach((k) => (k.m.instanceMatrix.needsUpdate = true));
  S.pets.forEach((p, i) => { const a = p.a + t * .35, r = 6 + Math.sin(t + i) * 1; p.root.position.set(c.x + Math.cos(a) * r, c.y + 3 + Math.sin(t * 1.3 + i) * 1.2 + i * .5, c.z + Math.sin(a) * r); p.root.rotation.y = -a; p.update(t); });
}

G.start();
