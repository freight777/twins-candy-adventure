import './mermaid.css';
import { loading } from '../engine/loading.js';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createPipeline } from '../engine/pipeline.js';
import { Q } from '../engine/quality.js';
import { skyEnv } from '../env.js';
import { Timers, Fx, ease, lerp, clamp, rand, pick, linearizeFrag, RAINBOW, stripedGeo } from '../util.js';
import { unlock, playMusic, say, sayAsync, sfx, stopSpeech, playScore, stopScore } from '../audio.js';
import { buildOcean, COLORS, N, FRIEND_TILES } from './ocean.js';
import { createMermaid, createSeahorse, createDolphin, heartGeo, LOOKS } from './mermaid.js';
import { ANTHEM } from './anthem.js';

const $ = (s) => document.querySelector(s);
const HOVER = 2.3;                                   // swimming height above the path line
const SCALE = 1.15;

// ---------------------------------------------------------------- renderer (same glossy pipeline as the other 3D games)
const canvas = $('#c');
const gfx = createPipeline(canvas, { exposure: 0.85, bloom: { strength: 0.22, radius: 0.6, threshold: 0.95 }, grade: { sat: 1.12, con: 1.05 } });
const renderer = gfx.renderer;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 1800);
gfx.onResize = (a) => { camera.aspect = a; camera.fov = clamp(THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(76 / 2)) / a)), 42, 82); camera.updateProjectionMatrix(); };
gfx.setScene(scene, camera); gfx.applyTier();
['gesturestart', 'dblclick', 'contextmenu'].forEach((ev) => document.addEventListener(ev, (e) => e.preventDefault()));

// ---------------------------------------------------------------- the cast
const FRIENDS = [
  { key: 'sparkle', name: 'Sparkle', emoji: '✨', css: '#ff7ab8', voice: 'sparkle', line: "Hi Esmae! I'm Sparkle! Let's shine together!", burst: [0xffd0f0, 0xff7ab8, 0xffffff] },
  { key: 'rainbow', name: 'Rainbow', emoji: '\u{1F308}', css: '#5bc0ff', voice: 'rainbow', line: "Hello Esmae! I'm Rainbow! I love every color!", burst: RAINBOW },
  { key: 'kitty', name: 'Kitty', emoji: '\u{1F431}', css: '#ff6a6a', voice: 'cat', line: "Hi Esmae! I'm Kitty! Let's swim and play!", burst: [0xff6a6a, 0xffb0b0, 0xffffff] },
];
const LUCY = { name: 'Lucy', emoji: '\u{1F496}', css: '#ff9ed8' };

const timers = new Timers(), fx = new Fx(scene, 900);
const sleep = (s) => new Promise((r) => timers.after(s, r));
const anim = (dur, fn, e = ease.inOut) => new Promise((r) => timers.tween(dur, fn, { ease: e, done: r }));
const ui = {
  /** resolves when the caption has been said (opts: priority, minMs) */
  bubble(emoji, caption = '', voice = 'uni', speak = true, opts = {}) {
    const said = caption && speak ? sayAsync(caption, voice, opts) : Promise.resolve(true);
    const b = $('#bubble'); b.classList.remove('hidden'); b.firstElementChild.textContent = emoji; b.lastElementChild.textContent = caption;
    b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
    return said;
  },
  hideBubble() { $('#bubble').classList.add('hidden'); },
  hearts(n) { $('#starcount').textContent = n; },
  show(sel, on = true) { $(sel).classList.toggle('hidden', !on); },
};
const sq = (c, cls = '') => `<div class="sq ${cls}" style="background:${c.css}"></div>`;
const cname = (card, cls = 'cname') => `<div class="${cls}" style="color:${card.c.css}">${card.double ? 'Double ' : ''}${card.c.name}</div>`;

let W, hero, lucy, king, queen, friends = [];
const S = { mode: 'boot', idx: 0, u: 0, speed: 0, hearts: 0, time: 0, followers: [], dirS: new THREE.Vector3(0, 0, -1), card: null, hint: 0, waiting: false, gifts: [], pets: [] };
const camTarget = new THREE.Vector3();
const pathPos = (u) => { const p = W.curve.getPointAt(clamp(u, 0, 1)); p.y += HOVER; return p; };
const pathTan = (u) => W.curve.getTangentAt(clamp(u, 0, 1));
const side = (t) => new THREE.Vector3(t.z, 0, -t.x).normalize();
const sparkleAt = (p, colors, count = 30, speed = 5) => fx.burst(p, { count, colors, speed, gravity: 1.2, life: 1.4, size: 1 });
const bubblesAt = (p, count = 6) => fx.burst(p, { count, colors: [0xffffff, 0xcff6ff, 0xa8e8ff], speed: .9, gravity: 2.4, life: 2, size: .9 });

function placeHero(u) {
  const p = pathPos(u), t = pathTan(u);
  hero.root.position.copy(p); hero.root.rotation.set(0, Math.atan2(t.x, t.z), 0); S.u = u;
}

// ---------------------------------------------------------------- boot
async function boot() {
  await new Promise((r) => setTimeout(r, 30));
  W = buildOcean(scene);
  scene.environment = skyEnv(renderer, 'ocean', { top: 0x8fe8ff, mid: 0x4ab8e8, bottom: 0x1a5a9a, sun: [10, 40, 5], sunColor: 0xe8fff8, sunPower: 5 }); scene.environmentIntensity = 0.5;
  scene.fog = new THREE.FogExp2(0x2a9fd0, 0.0105);
  scene.add(new THREE.HemisphereLight(0xcff8ff, 0x2a6aa0, 1.0));
  const sun = new THREE.DirectionalLight(0xe8fff8, 1.6); sun.position.set(14, 40, 10); scene.add(sun, sun.target);
  sun.castShadow = true; const sc = sun.shadow.camera; sc.left = sc.bottom = -36; sc.right = sc.top = 36; sc.near = 1; sc.far = 160; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.05; sun.shadow.radius = 3;
  S.sun = sun; S.sunOff = sun.position.clone();
  scene.traverse((o) => { const m = o.material; if (m && m.isShaderMaterial && !m.userData.lin) { m.fragmentShader = linearizeFrag(m.fragmentShader); m.userData.lin = true; m.needsUpdate = true; } });

  hero = createMermaid(LOOKS.esmae); hero.root.rotation.order = 'YXZ'; hero.root.scale.setScalar(SCALE); scene.add(hero.root); placeHero(0);
  friends = FRIENDS.map((f, i) => {
    const u = createMermaid(LOOKS[f.key]); u.root.scale.setScalar(SCALE); scene.add(u.root);
    const t = W.tiles[FRIEND_TILES[i]], sd = i % 2 ? 1 : -1, spot = t.pos.clone().add(side(t.tan).multiplyScalar(sd * 7)).add(new THREE.Vector3(0, 1.6 + i * .4, 0));
    return { ...f, i, u, met: false, speed: 0, spot, tile: FRIEND_TILES[i], side: sd };
  });
  lucy = createMermaid(LOOKS.lucy); lucy.root.scale.setScalar(SCALE); scene.add(lucy.root);
  king = createMermaid(LOOKS.king); queen = createMermaid(LOOKS.queen);
  [king, queen].forEach((m) => { m.upright = true; m.root.scale.setScalar(1.0); scene.add(m.root); });
  king.root.position.copy(W.kingSpot); queen.root.position.copy(W.queenSpot);
  [king, queen].forEach((m) => { m.root.rotation.y = Math.atan2(-W.endT.x, -W.endT.z); });
  resetFriends();
  S.dirS.copy(pathTan(0)).setY(0).normalize(); camera.position.copy(hero.root.position).addScaledVector(S.dirS, -11.5).addScaledVector(side(S.dirS), 6.5).add(new THREE.Vector3(0, 8.6, 0)); camTarget.copy(hero.root.position);

  $('#friends').innerHTML = [...FRIENDS, LUCY].map((f) => `<div class="fr" style="--c:${f.css}" title="${f.name}">${f.emoji}</div>`).join('');
  loading.done();
  S.mode = 'title'; ui.show('#title');
}

function resetFriends() {
  friends.forEach((f) => { f.met = false; f.speed = 0; f.u.root.position.copy(f.spot); const p = W.tiles[f.tile].pos; f.u.root.rotation.set(0, Math.atan2(p.x - f.spot.x, p.z - f.spot.z), 0); });
  lucy.root.position.copy(W.terrace).add(new THREE.Vector3(W.endT.x * 3, 2.8, W.endT.z * 3)).addScaledVector(side(W.endT), 6);
  lucy.root.rotation.set(0, Math.atan2(-W.endT.x, -W.endT.z), 0); lucy.root.visible = true;
}

// ---------------------------------------------------------------- the game
const drawCard = () => { if (S.forceCard) { const c = S.forceCard; S.forceCard = null; return c; } return { c: COLORS[Math.floor(Math.random() * 6)], double: Math.random() < 0.25 }; };
function targetFor(card, from) {
  const hits = []; for (let j = from + 1; j < N - 1; j++) if (W.tiles[j].color === card.c) hits.push(j);
  if (!hits.length) return N - 1;
  return card.double ? (hits[1] ?? N - 1) : hits[0];
}

async function play() {
  S.mode = 'follow'; ui.show('#title', false); ui.show('#hud');
  ui.bubble('\u{1F9DC}‍♀️ \u{1F42C} \u{1F496}', "Let's go on a mermaid adventure, Esmae!", 'uni'); sfx.chime();
  await sleep(3.6); ui.hideBubble();
  while (S.idx < N - 1) await takeTurn();
  await finale();
}

function waitDraw() {
  return new Promise((res) => {
    S.hint = 0; S.waiting = true;
    const b = $('#deck'); b.classList.remove('hidden');
    b.onclick = () => { b.classList.add('hidden'); ui.show('#hint', false); S.waiting = false; res(); };
  });
}

async function takeTurn() {
  await waitDraw();
  sfx.pop();
  const card = S.card = drawCard();
  const face = $('.card-face'); face.innerHTML = (card.double ? sq(card.c) + sq(card.c) : sq(card.c)) + cname(card);
  ui.show('#card'); face.style.animation = 'none'; void face.offsetWidth; face.style.animation = '';
  sfx.chime(); say(`${card.double ? 'Double ' : ''}${card.c.name}!`, 'counter');
  await sleep(1.8);
  ui.show('#card', false);
  $('#chip').innerHTML = (card.double ? sq(card.c, 'sm') + sq(card.c, 'sm') : sq(card.c, 'sm')) + cname(card, 'cn'); ui.show('#chip');
  await runTo(targetFor(card, S.idx));
  ui.show('#chip', false);
  await resolveTile();
}

async function runLeg(i0, i1) {
  const u0 = i0 / (N - 1), u1 = i1 / (N - 1), steps = i1 - i0, dur = Math.max(0.7, steps * 0.34);
  S.speed = 1.5;
  await anim(dur, (k) => {
    const u = lerp(u0, u1, k); S.u = u;
    const p = pathPos(u), t = pathTan(u); hero.root.position.copy(p); hero.lookToward(t.x, t.z, 0.25);
    collectHearts(u);
    if (Math.random() < .6) bubblesAt(p.clone().add(new THREE.Vector3(-t.x * 1.6, -.4 + Math.random(), -t.z * 1.6)), 1);
  }, ease.inOut);
  S.speed = 0; S.idx = i1; sfx.hop();
}
async function runTo(target) {
  while (S.idx < target) {
    const nf = friends.filter((f) => !f.met && f.tile > S.idx && f.tile <= target).map((f) => f.tile)[0], next = nf ?? target;
    await runLeg(S.idx, next);
    if (nf != null) await meetFriend(friends.find((f) => f.tile === nf));
  }
}
function collectHearts(u) {
  W.hearts.forEach((h) => {
    if (h.taken || u < h.tile / (N - 1) - 0.006) return;
    h.taken = true; h.mesh.visible = false; addHearts(1); sfx.collect(S.hearts); sparkleAt(h.mesh.position.clone(), [0xff9ed8, 0xffffff, 0xff5fa4], 14, 3);
  });
}
function addHearts(n) { S.hearts += n; ui.hearts(S.hearts); $('#stars').animate([{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }], 300); }

async function resolveTile(depth = 0) {
  if (S.idx >= N - 1 || depth > 3) return;
  const i = S.idx, sc = W.shortcutAt(i);
  if (sc) {
    ui.bubble('\u{1F42C} \u{1F30A}', 'A dolphin ride!', 'uni'); sfx.magic(); await sleep(0.9);
    await ride(sc); ui.hideBubble();
    for (const f of friends.filter((f) => !f.met && f.tile < S.idx)) await meetFriend(f);
    return resolveTile(depth + 1);
  }
  const pearl = W.pearls.find((p) => p.tile === i);
  if (pearl) await treat(pearl);
}

async function ride(sc) {
  S.speed = 1.2; S.riding = true;
  const dolphin = createDolphin(1.9); scene.add(dolphin.root);
  const u0 = sc.from / (N - 1), u1 = sc.to / (N - 1);
  await anim(2.6, (k) => {
    const p = sc.arc.getPoint(k), t = sc.arc.getTangent(k);
    dolphin.root.position.copy(p).add(new THREE.Vector3(0, -.2, 0)); dolphin.root.rotation.set(-Math.asin(clamp(t.y, -.8, .8)), Math.atan2(t.x, t.z), 0, 'YXZ'); dolphin.update(S.time, 1.8);
    hero.root.position.copy(p).add(new THREE.Vector3(0, 1.5, 0)); hero.lookToward(t.x, t.z, 0.3); hero.root.rotation.x = -Math.asin(clamp(t.y, -.7, .7)) * 0.7;
    S.u = lerp(u0, u1, k);
    bubblesAt(p.clone().add(new THREE.Vector3(0, 0, 0)), 3);
    if (Math.random() < .4) sparkleAt(p, [0xffffff, 0xffe0f0, 0xcff6ff], 2, 1.4);
  }, ease.inOut);
  S.riding = false; S.speed = 0; hero.root.rotation.x = 0; S.idx = sc.to; placeHero(sc.to / (N - 1)); sfx.tada();
  sparkleAt(hero.root.position.clone().add(new THREE.Vector3(0, 1, 0)), RAINBOW, 50, 6);
  const end = dolphin.root.position.clone(), fwd = new THREE.Vector3(Math.sin(dolphin.root.rotation.y), .6, Math.cos(dolphin.root.rotation.y));
  await anim(1.4, (k) => { dolphin.root.position.copy(end).addScaledVector(fwd, k * 22); dolphin.update(S.time, 1.8); }, ease.in);
  scene.remove(dolphin.root);
}

async function treat(pr) {
  ui.bubble('\u{1F9AA} \u{1F90D}', 'A shiny pearl!', 'uni'); sfx.yum();
  pr.group.userData.open = true; hero.lookToward(pr.spot.x - hero.root.position.x, pr.spot.z - hero.root.position.z, 1);
  await anim(.5, (k) => { hero.lift = Math.sin(k * Math.PI) * 1.2; }, ease.linear); hero.lift = 0;
  sparkleAt(pr.spot.clone().add(new THREE.Vector3(0, 2.6, 0)), [0xffffff, 0xffd8f0, 0xfff0a0], 50, 5); sfx.sparkle(); bubblesAt(pr.spot.clone().add(new THREE.Vector3(0, 1.6, 0)), 14);
  addHearts(3); await sleep(1.8); ui.hideBubble(); pr.group.userData.open = false;
}

async function meetFriend(f) {
  f.met = true; S.greeting = f; S.mode = 'greet';
  const t = pathTan(S.u), dest = hero.root.position.clone().add(side(t).multiplyScalar(f.side * 4.2)).add(t.clone().multiplyScalar(1.2)), a = f.u.root.position.clone();
  S.speed = 0; sfx.chime();
  await anim(1.5, (k) => { f.u.root.position.lerpVectors(a, dest, k); f.speed = 1.4; f.u.lookToward(dest.x - a.x, dest.z - a.z, .3); }, ease.inOut);
  f.speed = 0;
  hero.lookToward(f.u.root.position.x - hero.root.position.x, f.u.root.position.z - hero.root.position.z, 1);
  f.u.lookToward(hero.root.position.x - f.u.root.position.x, hero.root.position.z - f.u.root.position.z, 1);
  sparkleAt(f.u.root.position.clone().add(new THREE.Vector3(0, 1.4, 0)), f.burst, 60, 6); sfx.sparkle(); bubblesAt(f.u.root.position.clone(), 12);
  const said = ui.bubble(`${f.emoji} \u{1F9DC}‍♀️`, f.line, f.voice, true, { priority: 2, minMs: 1800 });
  const hop = (u) => anim(.55, (k) => { u.lift = Math.sin(k * Math.PI) * 1.3; }, ease.linear);
  await hop(f.u); await hop(hero); await said; await sleep(.3);
  sparkleAt(hero.root.position.clone().add(new THREE.Vector3(0, 1.5, 0)), [0xff9ed8, 0xffffff, 0xff5fa4], 40, 5); sfx.magic(); addHearts(3);
  document.querySelectorAll('.fr')[f.i].classList.add('met');
  await ui.bubble('\u{1F31F}', `${f.name} joins the adventure!`, 'uni', true, { priority: 2, minMs: 1500 }); await sleep(.4); ui.hideBubble();
  S.followers.push(f); S.mode = 'follow';
}

// ---------------------------------------------------------------- the royal finale
function makeGifts() {
  const mk1 = (geo, n, mat) => { const m = new THREE.InstancedMesh(geo, mat, n); m.frustumCulled = false; m.castShadow = false; scene.add(m); return m; };
  const std = (o = {}) => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .4, metalness: .1, ...o });
  const lolly = mergeGeometries([new THREE.SphereGeometry(.55, 14, 10).scale(1, 1, .25).translate(0, .9, 0), new THREE.CylinderGeometry(.06, .06, 1.4, 6).translate(0, .1, 0)]);
  const bear = mergeGeometries([new THREE.SphereGeometry(.55, 12, 10), new THREE.SphereGeometry(.38, 12, 10).translate(0, .75, 0), new THREE.SphereGeometry(.14, 8, 6).translate(-.28, 1.05, 0), new THREE.SphereGeometry(.14, 8, 6).translate(.28, 1.05, 0)]);
  const kinds = [
    { m: mk1(heartGeo(.6, .22), 40, std({ emissive: 0xff3a8c, emissiveIntensity: .25 })), n: 40, cols: [0xff5fa4, 0xff8fc8, 0xff7ec0, 0xffb0d8] },     // hair clips
    { m: mk1(lolly, 34, std({ roughness: .3 })), n: 34, cols: [0xff6fb5, 0xffd84d, 0x62e0d0, 0xb07cff, 0xff9f4d] },                             // candy
    { m: mk1(stripedGeo(new THREE.SphereGeometry(.7, 16, 12), RAINBOW), 14, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .4 })), n: 14, cols: [0xffffff] },   // beach balls
    { m: mk1(bear, 12, std({ roughness: .7 })), n: 12, cols: [0xffc8a0, 0xffe0f0, 0xd8c0ff, 0xc0f0ff] },                                              // teddy toys
  ];
  const c = new THREE.Color(), tc = W.terrace;
  const items = [];
  kinds.forEach((k, ki) => { for (let i = 0; i < k.n; i++) { c.set(k.cols[i % k.cols.length]); k.m.setColorAt(i, c); items.push({ k, i, a: rand(0, 6.28), r: rand(5, 14), h: rand(1, 11), sp: rand(.2, .5) * (Math.random() < .5 ? -1 : 1), s: rand(.8, 1.3), at: rand(0, 3.5), ph: rand(0, 6) }); } if (k.m.instanceColor) k.m.instanceColor.needsUpdate = true; });
  S.gifts = items; S.giftKinds = kinds; S.giftT = 0; S.giftOn = true; S.giftCenter = tc.clone().addScaledVector(W.endT, 1);
  // seahorse pets
  for (let i = 0; i < 6; i++) { const p = createSeahorse(pick([0xffb04a, 0xff7ab8, 0x7be0d0, 0xb07cff, 0xffd84d])); p.root.scale.setScalar(1.1); p.root.position.copy(tc).add(new THREE.Vector3(0, 3, 0)); p.a = (i / 6) * 6.28; scene.add(p.root); S.pets.push(p); }
}

async function finale() {
  S.mode = 'greet'; S.greeting = lucy;
  for (const f of friends.filter((f) => !f.met)) await meetFriend(f);
  S.mode = 'finale';
  ui.bubble('\u{1F3F0} \u{1F451}', 'The Mermaid Palace! We made it!', 'uni'); sfx.fanfare();
  const tc = W.terrace, f = W.endT, sd = side(f);
  const a = hero.root.position.clone(), dest = tc.clone().addScaledVector(f, -3).add(new THREE.Vector3(0, HOVER + .3, 0));
  S.speed = 1.2;
  await anim(2.4, (k) => { hero.root.position.lerpVectors(a, dest, k); hero.lookToward(f.x, f.z, .2); if (Math.random() < .5) bubblesAt(hero.root.position.clone(), 1); }); S.speed = 0;
  hero.lookToward(f.x, f.z, 1);
  // Lucy, her twin
  const la = lucy.root.position.clone(), ld = dest.clone().addScaledVector(sd, 3.8).add(new THREE.Vector3(0, .1, 0));
  const lucySaid = ui.bubble('\u{1F9DC}‍♀️\u{1F9DC}‍♀️', "Esmae! It's me, Lucy! We're twins!", 'sparkle', true, { priority: 2, minMs: 2000 });
  S.lucySpeed = 1.3; lucy.lookToward(ld.x - la.x, ld.z - la.z, 1);
  await anim(1.6, (k) => { lucy.root.position.lerpVectors(la, ld, k); lucy.lookToward(f.x, f.z, .1); }); S.lucySpeed = 0;
  sparkleAt(lucy.root.position.clone().add(new THREE.Vector3(0, 1.4, 0)), [0xff9ed8, 0xffffff, 0xff5fa4], 80, 7); sfx.tada(); sfx.giggle();
  document.querySelectorAll('.fr')[3].classList.add('met'); addHearts(5);
  const hop = (u) => anim(.55, (k) => { u.lift = Math.sin(k * Math.PI) * 1.5; }, ease.linear);
  await hop(lucy); await hop(hero); await lucySaid; await sleep(.4);
  // the king and queen
  await ui.bubble('\u{1F451}', 'Welcome to the Mermaid Palace, Esmae! Thank you for spreading so much love.', 'king', true, { priority: 2, minMs: 3000 }); await sleep(.4);
  await ui.bubble('\u{1F451}', 'You and your friends are so kind. We have gifts for you!', 'queen', true, { priority: 2, minMs: 2500 }); await sleep(.3);
  const gift = ui.bubble('\u{1F381} \u{1F496}', 'A lifetime supply of hair clips, toys, mermaid pets, and candy!', 'king', true, { priority: 2, minMs: 2500 });
  makeGifts(); sfx.magic(); sfx.fanfare();
  [king, queen].forEach((m) => sparkleAt(m.root.position.clone().add(new THREE.Vector3(0, 3, 0)), [0xffd84d, 0xffffff, 0xff9ed8], 60, 7));
  await gift; await sleep(2.2);
  ui.hideBubble(); ui.show('#banner'); ui.show('#again'); stopSpeech(); playScore(ANTHEM);
  S.celebrate = true;
  $('#again').onclick = () => { $('#fade').style.opacity = 1; setTimeout(restart, 520); };
}

function restart() {
  stopScore(); S.celebrate = false; S.mode = 'follow'; S.idx = 0; S.followers = []; S.hearts = 0; S.speed = 0; ui.hearts(0); S.greeting = null; hero.lift = 0;
  S.giftOn = false; (S.giftKinds || []).forEach((k) => scene.remove(k.m)); S.giftKinds = []; S.gifts = []; S.pets.forEach((p) => scene.remove(p.root)); S.pets = [];
  placeHero(0); resetFriends(); W.hearts.forEach((s) => { s.taken = false; s.mesh.visible = true; });
  document.querySelectorAll('.fr').forEach((e) => e.classList.remove('met'));
  ui.show('#banner', false); ui.show('#again', false); ui.hideBubble(); timers.clear();
  $('#fade').style.opacity = 0; playMusic('ocean');
  play();
}

// ---------------------------------------------------------------- per-frame
function updateCamera(dt, t) {
  if (S.debugCam) { camera.position.copy(S.debugCam.p); camera.lookAt(S.debugCam.l); return; }
  const k = 1 - Math.exp(-3 * dt);
  let desired, look;
  const tt = pathTan(clamp(S.u + 0.03, 0, 1)); tt.y = 0; tt.normalize();
  S.dirS.lerp(tt, 1 - Math.exp(-1.6 * dt)).normalize();
  const up = hero.root.position;
  if (false) {
  } else if (S.mode === 'greet' && S.greeting) {
    const g = S.greeting.u ? S.greeting.u.root.position : lucy.root.position, mid = up.clone().lerp(g, .5), sd = side(S.dirS);
    desired = mid.clone().addScaledVector(S.dirS, -6).addScaledVector(sd, (S.greeting.side || 1) * -10).add(new THREE.Vector3(0, 5.5, 0)); look = mid.clone();
  } else if (S.mode === 'finale') {
    const f = W.endT, ang = Math.sin(t * .3) * .7, ca = Math.cos(ang), sa = Math.sin(ang), tc = W.terrace;
    const back = new THREE.Vector3(-f.x * ca + f.z * sa, 0, -f.z * ca - f.x * sa);
    desired = tc.clone().addScaledVector(back, 25).add(new THREE.Vector3(0, 10.5, 0)); look = tc.clone().addScaledVector(f, 5).add(new THREE.Vector3(0, 3.5, 0));
  } else {
    const hi = S.riding ? 5 : 0;
    desired = up.clone().addScaledVector(S.dirS, -9.5 - hi * .6).addScaledVector(side(S.dirS), S.mode === 'title' ? 5 + Math.sin(t * .4) * 2 : 3.6).add(new THREE.Vector3(0, 6.8 + hi + Math.sin(t * .5) * .4, 0));
    look = up.clone().addScaledVector(S.dirS, 3).add(new THREE.Vector3(0, .2, 0));
  }
  desired.y = Math.max(desired.y, W.heightAt(desired.x, desired.z) + 2.5);
  camera.position.lerp(desired, k); camTarget.lerp(look, 1 - Math.exp(-4 * dt)); camera.lookAt(camTarget);
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

function update(dt) {
  S.time += dt; const t = S.time;
  timers.update(dt); fx.update(dt); W.update(dt, t);
  hero.update(dt, t, S.speed);
  friends.forEach((f) => f.u.update(dt, t, f.speed));
  lucy.update(dt, t, S.lucySpeed || 0); king.update(dt, t, 0); queen.update(dt, t, 0);
  S.followers.forEach((f, k) => {
    const u = Math.max(0, S.u - (k + 1) * 0.034), p = pathPos(u), tn = pathTan(u), pos = f.u.root.position;
    const target = p.clone().addScaledVector(side(tn), (k % 2 ? 1 : -1) * 2.0).add(new THREE.Vector3(0, Math.sin(t * 1.4 + k) * .3, 0));
    const prev = pos.clone(); pos.lerp(target, 1 - Math.exp(-5 * dt));
    const v = pos.distanceTo(prev) / Math.max(dt, 1e-3); f.speed = clamp(v / 4.5, 0, 1.5);
    if (v > 0.8) f.u.lookToward(pos.x - prev.x, pos.z - prev.z, 0.2); else f.u.lookToward(tn.x, tn.z, 0.05);
  });
  if (S.speed > .4 && Math.random() < dt * 25) bubblesAt(hero.root.position.clone().add(new THREE.Vector3(rand(-.5, .5), rand(-1.5, .5), rand(-.5, .5))), 1);
  if (S.celebrate && Math.random() < dt * 5) { const c = W.terrace; sparkleAt(new THREE.Vector3(c.x + rand(-14, 14), c.y + rand(4, 16), c.z + rand(-14, 14)), RAINBOW.concat([0xffffff, 0xff9ed8]), 50, 7); if (Math.random() < .3) sfx.pop(); }
  updateGifts(dt, t);
  if (S.sun) { const f = hero.root.position; S.sun.target.position.copy(f); S.sun.position.copy(f).add(S.sunOff); const want = Q.shadow > 0; if (S.sun.castShadow !== want) S.sun.castShadow = want; if (want && S.sun.shadow.mapSize.x !== Q.shadow) { S.sun.shadow.mapSize.set(Q.shadow, Q.shadow); S.sun.shadow.map && S.sun.shadow.map.dispose(); S.sun.shadow.map = null; } }
  if (S.waiting) { S.hint += dt; if (S.hint > 9) { const h = $('#hint'), d = $('#deck').getBoundingClientRect(); h.classList.remove('hidden'); h.style.left = (d.left + d.width / 2) + 'px'; h.style.top = (d.top - 70) + 'px'; } }
  updateCamera(dt, t);
}

const ray = new THREE.Raycaster();
canvas.addEventListener('pointerdown', (e) => {
  unlock();
  const r = canvas.getBoundingClientRect(); ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
  const all = [{ u: hero, n: 'Esmae' }, ...friends.map((f) => ({ u: f.u, n: f.name })), { u: lucy, n: 'Lucy' }, { u: king, n: 'The King' }, { u: queen, n: 'The Queen' }];
  const hit = all.find((a) => a.u.root.visible && ray.intersectObject(a.u.root, true).length);
  if (!hit) return;
  sfx.giggle(); say(hit.n + '!', 'uni', { priority: 0 }); sparkleAt(hit.u.root.position.clone().add(new THREE.Vector3(0, 1.8, 0)), RAINBOW.concat([0xffffff]), 36, 5); bubblesAt(hit.u.root.position.clone(), 10);
  anim(.5, (k) => { hit.u.lift = Math.sin(k * Math.PI) * 1.3; }, ease.linear);
});

// ---------------------------------------------------------------- go
gfx.start((dt) => { if (!W) return false; update(dt); });
$('#play').addEventListener('click', () => { unlock(); playMusic('ocean'); play(); });
window.mermaidGame = { S, scene, camera, get W() { return W; }, get hero() { return hero; }, get friends() { return friends; }, get lucy() { return lucy; }, tp: (i) => { S.idx = i; placeHero(i / (N - 1)); }, force: (name, double = false) => { S.forceCard = { c: COLORS.find((c) => c.name === name), double }; } };
boot().catch((e) => { console.error(e); loading.fail(); });
