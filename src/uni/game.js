import '../board/board.css';
import './uni.css';
import * as THREE from 'three';
import { loading } from '../engine/loading.js';
import { skyEnv } from '../env.js';
import { preloadModels, onProgress, model } from '../assets.js';
import { ease, lerp, clamp, rand, RAINBOW } from '../util.js';
import { say, sfx } from '../audio.js';
import { ask } from '../engine/quiz.js';
import { makeReadingQuestion } from '../learn/reading.js';
import { settings as learn } from '../learn/profile.js';
import { createBoardGame } from '../board/deck.js';
import { N } from '../board/path.js';
import { buildWorld, FRIEND_TILES } from './world.js';
import { createUnicorn, LOOKS } from './unicorn.js';
import { createHouse, HOUSES } from './houses.js';

const SCALE = 1.1;
const FRIENDS = [
  { key: 'sparkle', name: 'Sparkle', emoji: '\u{1F496}', css: '#ff7ab8', voice: 'sparkle', line: "Hi Uni! I'm Sparkle! Let's sparkle together!", burst: [0xffd84d, 0xff7ab8, 0xffffff] },
  { key: 'rainbow', name: 'Rainbow', emoji: '\u{1F308}', css: '#5bc0ff', voice: 'rainbow', line: "Hello Uni! I'm Rainbow! I love all the colors!", burst: RAINBOW },
  { key: 'cloud', name: 'Cloud', emoji: '☁️', css: '#a8d0ff', voice: 'cloud', line: "Hi Uni! I'm Cloud. I'm soft and fluffy!", burst: [0xffffff, 0xcfe6ff, 0xe8d8ff] },
  { key: 'rain', name: 'Rain', emoji: '\u{1F4A7}', css: '#7f96f0', voice: 'rain', line: "Hi Uni! I'm Rain. Splish splash!", burst: [0x7fc4ff, 0xbfd0ff, 0xffffff] },
];
const upBy = (y) => new THREE.Vector3(0, y, 0);
const _q = new THREE.Vector3();
let W, uni, twin, kingU, queenU;

const G = createBoardGame({
  hero: { name: 'Uni', voice: 'uni', emoji: '\u{1F984}' }, friends: FRIENDS, twin: { name: 'Uni', emoji: '\u{1F984}', css: '#d8a8ff' },
  deckIcon: '&#129412;', banner: 'You did it, Uni!', music: 'forest', debugName: 'uniGame', reader: 'adalyn',
  pipeline: { exposure: 0.82, bloom: { strength: 0.12, radius: 0.5, threshold: 1.0 }, grade: { sat: 1.14, con: 1.05 } },
  lift: 0.82, walk: true,
  intro: ['\u{1F984} ✨ \u{1F308}', "Let's go on an adventure, Uni!", 3.4],
  slide: ['\u{1F308} \u{1F680}', 'Rainbow slide!'],
  pickupColors: [0xffe14d, 0xffffff, 0xffb347], joinColors: [0xffe14d, 0xffffff, 0xff9ecb],
  party: { center: () => uni.root.position, r: 18, y: [10, 24], colors: RAINBOW.concat([0xffffff]) },
  houses: { keys: ['sparkle', 'rainbow', 'cloud', 'rain', 'uni'], info: HOUSES, create: createHouse, lockedTwin: 'Meet your twin at the castle first!' },
  build,
  hooks: {
    ready() { G.camera.position.copy(uni.root.position).add(new THREE.Vector3(8, 4.4, 9)); G.camTarget.copy(uni.root.position); },
    trail: (p, t) => G.fx.burst(_q.set(p.x - t.x * 1.4, p.y + 1.1 + Math.random() * .7, p.z - t.z * 1.4), { count: 1, colors: RAINBOW, speed: .6, gravity: -.4, life: 1, size: .8 }),
    wake: (p) => G.fx.burst(_q.set(p.x, p.y + .3, p.z), { count: 1, colors: [0xffffff, 0xffe9a0], speed: .4, gravity: -.2, life: .8, size: .6 }),
    stop: async (i) => { const ice = W.iceProps.find((p) => p.tile === i); if (ice) await iceCream(ice); },
    // each friend asks Adalyn one reading question before joining (errorless: it always ends on a right answer)
    async onFriend(f) {
      if (!learn.on) return;
      ui.hideBubble();
      const r = await ask(makeReadingQuestion('adalyn'), 'adalyn');
      if (r.correct && r.first) { G.addStars(2); sparkleAt(G.above(f.u, 2.6), [0xffe14d, 0xffffff, 0xff9ecb], 50, 6); sfx.sparkle(); }
    },
    ride: rainbowSlide,
    finale,
    cheer() { sfx.fanfare(); say('You did it, Uni! You made it to the castle!', 'uni'); },
    reset() { clearTreats(); [kingU, queenU].forEach((m) => (m.root.visible = false)); G.camera.position.set(0, 20, 0); },
    resetTwin() {
      twin.root.position.copy(W.endSpot); twin.root.position.y = W.heightAt(W.endSpot.x, W.endSpot.z) + 0.3;
      const e = W.tiles[N - 1]; twin.root.rotation.y = Math.atan2(-e.tan.x, -e.tan.z); twin.root.visible = true;
    },
    update(dt, t) { kingU.update(dt, t, 0); queenU.update(dt, t, 0); updateTreats(dt, t); },
    camera(mode, desired, look, t) {
      const up = uni.root.position;
      if (mode === 'title') {                                                    // a slow orbit around Uni
        const a = t * 0.2 + 0.4;
        desired.set(up.x + Math.sin(a) * 12, up.y + 4.4, up.z + Math.cos(a) * 12); look.copy(up); look.y += 2.4; return true;
      }
      if (mode === 'finale') {                                                   // swing gently in front of the castle
        const e = G.pathTan(1, look); e.y = 0; e.normalize();
        const ang = Math.sin(t * .35) * .8, ca = Math.cos(ang), sa = Math.sin(ang);
        desired.copy(up).addScaledVector(_q.set(-e.x * ca + e.z * sa, 0, -e.z * ca - e.x * sa), 17); desired.y += 7.5;
        look.copy(up); look.y += 5; return true;
      }
      return false;
    },
  },
});
const { ui, S, sleep, anim, fx, sparkleAt } = G;

async function build() {
  onProgress.cb = (p) => loading.set(p * .8);
  await preloadModels(['food/ice-cream-cne', 'food/ice-cream', 'food/sundae', 'food/popsicle', 'food/popsicle-chocolate', 'food/cupcake', 'food/donut-sprinkles', 'food/lollypop', 'food/cake-birthday', 'nature/lily_large']);
  onProgress.cb = null;
  await new Promise((r) => setTimeout(r, 30));
  const { scene } = G;
  W = G.W = buildWorld(scene);
  scene.environment = skyEnv(G.renderer, 'uni', { top: 0xa8b8ff, mid: 0xffe8f6, bottom: 0xffd0ea, sun: [25, 30, -15], sunPower: 6 }); scene.environmentIntensity = 0.32;
  scene.fog = new THREE.Fog(0xf3dcff, 170, 620);
  scene.add(new THREE.HemisphereLight(0xfff4ff, 0xffc0e0, 0.7));
  G.addSun(0xfff0d6, 1.9, [22, 36, 14], 34);
  G.linearize();
  const unicorn = (look, s = SCALE) => { const u = createUnicorn(look); u.root.scale.setScalar(s); scene.add(u.root); return u; };
  uni = G.hero = unicorn(LOOKS.uni);
  G.friends = FRIENDS.map((f, i) => ({ ...f, i, u: unicorn(LOOKS[f.key]), met: false, speed: 0, spot: W.friendSpots[i], tile: FRIEND_TILES[i], side: i % 2 ? 1 : -1 }));
  twin = G.twin = unicorn(LOOKS.twin);
  kingU = unicorn(LOOKS.king, 1.45); queenU = unicorn(LOOKS.queen, 1.45);
  [kingU, queenU].forEach((m) => (m.root.visible = false));
  G.taps = [{ u: twin, n: 'Uni' }];
}

// ---------------------------------------------------------------- the squares' surprises
async function rainbowSlide(sc) {
  await G.ride(sc, 2.4, (p, t) => {
    p.y += 0.45; uni.root.position.copy(p); uni.lookToward(t.x, t.z, 0.3); uni.root.rotation.x = -Math.asin(clamp(t.y, -.7, .7)) * 0.8;
    fx.burst(_q.set(p.x, p.y + .6, p.z), { count: 3, colors: RAINBOW, speed: 1.4, gravity: -1.5, life: 1.2, size: 1 });
  });
  sparkleAt(G.above(uni, 2), RAINBOW, 50, 6);
}
async function iceCream(ice) {
  ui.bubble('\u{1F366} \u{1F60B}', 'Yummy ice cream!', 'uni'); sfx.yum();
  G.face(uni, ice.spot);
  await anim(.5, (k) => { uni.lift = Math.sin(k * Math.PI) * 1.2; }, ease.linear); uni.lift = 0;
  for (let k = 0; k < 3; k++) { sfx.crunch(); sparkleAt(ice.holder.position.clone().add(upBy(4.5)), [0xffa8d8, 0xffffff, 0xfff0a0, 0x9ff0c8], 18, 3); ice.holder.scale.setScalar(1 - k * .05); await sleep(.45); }
  ice.holder.scale.setScalar(1); G.addStars(3); sfx.sparkle();
  await sleep(1.4); ui.hideBubble();
}

// ---------------------------------------------------------------- the Rainbow Castle: twin Uni, the King and Queen, a lifetime of treats
async function finale() {
  sfx.fanfare(); await ui.bubble('\u{1F3F0} ✨', 'The Rainbow Castle! We made it!', 'uni', true, { priority: 2, minMs: 2000 });
  const a = twin.root.position.clone(), uniP = uni.root.position.clone(), dest = uniP.clone().add(G.pathTan(1).multiplyScalar(4.2));
  twin.lookToward(uniP.x - a.x, uniP.z - a.z, 1);
  ui.bubble('\u{1F984}\u{1F984}', 'Whoa! Another unicorn named Uni!', 'uni');
  await anim(1.6, (k) => {
    const x = lerp(a.x, dest.x, k), z = lerp(a.z, dest.z, k);
    twin.root.position.set(x, Math.max(lerp(a.y, uniP.y, k), W.heightAt(x, z)), z); S.twinSpeed = 1.3; twin.lookToward(uniP.x - x, uniP.z - z, .4);
  });
  S.twinSpeed = 0;
  G.face(uni, twin.root.position);
  sparkleAt(G.above(twin, 2.4), RAINBOW.concat([0xffffff]), 90, 7); sfx.tada(); sfx.giggle();
  G.markMet(4);
  const said = ui.bubble('\u{1F495}', "Hi! I'm Uni too! We have the same name!", 'uni', true, { priority: 2, minMs: 2000 });
  await G.hop(twin, .55, 1.5); await G.hop(uni, .55, 1.5); await said; await sleep(.4);
  G.addStars(5); S.twinMet = true;
  await royalGift();
}
async function royalGift() {
  const e = W.tiles[N - 1].pos, tn = G.pathTan(1); tn.y = 0; tn.normalize(); const sd = G.side(tn);
  const gate = e.clone().addScaledVector(tn, 10);
  [[kingU, 1], [queenU, -1]].forEach(([m, sg]) => {
    const p = gate.clone().addScaledVector(sd, sg * 3.6); p.y = W.heightAt(p.x, p.z) + .25;
    m.root.position.copy(p); m.root.rotation.y = Math.atan2(-tn.x, -tn.z); m.root.visible = true;
    sparkleAt(p.clone().add(upBy(3)), [0xffd84d, 0xffffff, 0xff9ecb], 50, 6);
  });
  sfx.fanfare();
  await ui.bubble('👑', 'Welcome, brave Uni! You made it to the Rainbow Castle!', 'king', true, { priority: 2, minMs: 2500 }); await sleep(.4);
  await ui.bubble('👑', 'Your kindness sparkles like magic! We have a gift for you!', 'queen', true, { priority: 2, minMs: 2500 }); await sleep(.3);
  const gift = ui.bubble('🍦 🎁', 'A lifetime supply of Uni treats!', 'king', true, { priority: 2, minMs: 2000 });
  makeTreats(); sfx.magic(); sfx.tada(); G.addStars(10);
  [kingU, queenU].forEach((m) => sparkleAt(G.above(m, 4), RAINBOW.concat([0xffffff]), 70, 7));
  await gift; await sleep(2.5);
}
const TREAT_MODELS = ['ice-cream-cne', 'ice-cream', 'sundae', 'popsicle', 'popsicle-chocolate', 'cupcake', 'donut-sprinkles', 'lollypop', 'cake-birthday'];
function makeTreats() {
  const e = W.tiles[N - 1].pos, tn = G.pathTan(1); tn.y = 0; tn.normalize();
  S.treatCenter = e.clone().addScaledVector(tn, 7); S.treats = [];
  for (let i = 0; i < 44; i++) {
    const m = model('food/' + TREAT_MODELS[i % TREAT_MODELS.length], { height: rand(1.5, 2.6) });
    if (!m) continue; m.traverse((o) => { if (o.isMesh) o.castShadow = false; }); m.scale.setScalar(0.001); G.scene.add(m);
    S.treats.push({ m, base: m.userData.baseScale || 1, a: rand(0, 6.28), r: rand(5, 14), h: rand(1, 12), sp: rand(.2, .5) * (Math.random() < .5 ? -1 : 1), at: rand(0, 3.5), ph: rand(0, 6) });
  }
  S.treatT = 0;
}
function clearTreats() { (S.treats || []).forEach((t) => G.scene.remove(t.m)); S.treats = []; }
function updateTreats(dt, t) {
  if (!S.treats || !S.treats.length) return;
  S.treatT += dt; const c = S.treatCenter;
  S.treats.forEach((g) => {
    const k = clamp((S.treatT - g.at) / 1.2, 0, 1), a = g.a + t * g.sp;
    g.m.position.set(c.x + Math.cos(a) * g.r, c.y + g.h * ease.out(k) + Math.sin(t * 1.3 + g.ph) * .5, c.z + Math.sin(a) * g.r);
    g.m.rotation.set(Math.sin(t + g.ph) * .3, t * .8 + g.ph, 0); g.m.scale.setScalar(Math.max(.001, g.base * k));
  });
}

G.start();
