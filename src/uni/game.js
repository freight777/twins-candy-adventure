import './uni.css';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { Q, loadTier, lowerTier } from '../quality.js';
import { skyEnv } from '../env.js';
import { preloadModels } from '../assets.js';
import { Timers, Fx, ease, lerp, clamp, rand, pick, linearizeFrag, RAINBOW } from '../util.js';
import { unlock, playMusic, say, sfx, stopSpeech } from '../audio.js';
import { buildWorld, COLORS, N, FRIEND_TILES, ICE_TILES } from './world.js';
import { createUnicorn, LOOKS } from './unicorn.js';

const $ = (s) => document.querySelector(s);
const FEET = 0.82;                                   // standing height above the path line
const SCALE = 1.1;

// ---------------------------------------------------------------- renderer (same glossy pipeline as the candy game)
const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 0.82;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
loadTier();
const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 1800);
const renderPass = new RenderPass(scene, camera);
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.12, 0.5, 1.0);
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, sat: { value: 1.14 }, con: { value: 1.05 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float sat, con; varying vec2 vUv;
    void main(){ vec4 t = texture2D(tDiffuse, vUv); float l = dot(t.rgb, vec3(.2126,.7152,.0722));
      vec3 c = mix(vec3(l), t.rgb, sat); c = (c - .5)*con + .5; gl_FragColor = vec4(clamp(c, 0., 1.), t.a); }`,
});
composer.addPass(renderPass); composer.addPass(bloom); composer.addPass(new OutputPass()); composer.addPass(grade);
function applyTier() {
  const pr = Math.min(window.devicePixelRatio, Q.pr);
  bloom.enabled = Q.bloom; renderer.setPixelRatio(pr); composer.setPixelRatio(pr); composer.setSize(innerWidth, innerHeight);
}
function resize() {
  const w = innerWidth, h = innerHeight, a = w / h;
  renderer.setSize(w, h, false); composer.setSize(w, h);
  camera.aspect = a; camera.fov = clamp(THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(76 / 2)) / a)), 42, 82); camera.updateProjectionMatrix();
}
applyTier(); resize(); addEventListener('resize', resize); addEventListener('orientationchange', () => setTimeout(resize, 200));
['gesturestart', 'dblclick', 'contextmenu'].forEach((ev) => document.addEventListener(ev, (e) => e.preventDefault()));

// ---------------------------------------------------------------- the cast
const FRIENDS = [
  { key: 'sparkle', name: 'Sparkle', emoji: '\u{1F496}', css: '#ff7ab8', voice: 'sparkle', line: "Hi Uni! I'm Sparkle! Let's sparkle together!", burst: [0xffd84d, 0xff7ab8, 0xffffff] },
  { key: 'rainbow', name: 'Rainbow', emoji: '\u{1F308}', css: '#5bc0ff', voice: 'rainbow', line: "Hello Uni! I'm Rainbow! I love all the colors!", burst: RAINBOW },
  { key: 'cloud', name: 'Cloud', emoji: '☁️', css: '#a8d0ff', voice: 'cloud', line: "Hi Uni! I'm Cloud. I'm soft and fluffy!", burst: [0xffffff, 0xcfe6ff, 0xe8d8ff] },
  { key: 'rain', name: 'Rain', emoji: '\u{1F4A7}', css: '#7f96f0', voice: 'rain', line: "Hi Uni! I'm Rain. Splish splash!", burst: [0x7fc4ff, 0xbfd0ff, 0xffffff] },
];
const TWIN = { name: 'Uni', emoji: '\u{1F984}', css: '#d8a8ff' };

const timers = new Timers(), fx = new Fx(scene, 900);
const sleep = (s) => new Promise((r) => timers.after(s, r));
const anim = (dur, fn, e = ease.inOut) => new Promise((r) => timers.tween(dur, fn, { ease: e, done: r }));

const ui = {
  bubble(emoji, caption = '', voice = 'uni', speak = true) {
    if (caption && speak) say(caption, voice);
    const b = $('#bubble'); b.classList.remove('hidden'); b.firstElementChild.textContent = emoji; b.lastElementChild.textContent = caption;
    b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
  },
  hideBubble() { $('#bubble').classList.add('hidden'); },
  stars(n) { $('#starcount').textContent = n; },
  show(sel, on = true) { $(sel).classList.toggle('hidden', !on); },
};
const sq = (c, cls = '') => `<div class="sq ${cls}" style="background:${c.css}"></div>`;
const cname = (card, cls = 'cname') => `<div class="${cls}" style="color:${card.c.css}">${card.double ? 'Double ' : ''}${card.c.name}</div>`;

let W, uni, twin, friends = [];
const S = { mode: 'boot', idx: 0, u: 0, speed: 0, stars: 0, time: 0, followers: [], dirS: new THREE.Vector3(0, 0, -1), card: null, busy: false, hint: 0, waiting: false };
const camTarget = new THREE.Vector3();
const pathPos = (u) => { const p = W.curve.getPointAt(clamp(u, 0, 1)); p.y += FEET; return p; };
const pathTan = (u) => W.curve.getTangentAt(clamp(u, 0, 1));
const groundY = (x, z) => W.heightAt(x, z);
const side = (t) => new THREE.Vector3(t.z, 0, -t.x).normalize();
const sparkleAt = (p, colors, count = 30, speed = 5) => fx.burst(p, { count, colors, speed, gravity: -2, life: 1.3, size: 1 });

function placeUni(u) {
  const p = pathPos(u), t = pathTan(u);
  uni.root.position.copy(p); uni.root.rotation.set(0, Math.atan2(t.x, t.z), 0); S.u = u;
}

// ---------------------------------------------------------------- boot
async function boot() {
  await preloadModels(['food/ice-cream-cne', 'food/ice-cream', 'food/sundae', 'food/popsicle', 'food/popsicle-chocolate', 'food/cupcake', 'food/donut-sprinkles', 'food/lollypop', 'food/cake-birthday', 'nature/lily_large']);
  await new Promise((r) => setTimeout(r, 30));
  W = buildWorld(scene);
  scene.environment = skyEnv(renderer, 'uni', { top: 0xa8b8ff, mid: 0xffe8f6, bottom: 0xffd0ea, sun: [25, 30, -15], sunPower: 6 }); scene.environmentIntensity = 0.32;
  scene.fog = new THREE.Fog(0xf3dcff, 170, 620);
  scene.add(new THREE.HemisphereLight(0xfff4ff, 0xffc0e0, 0.7));
  const sun = new THREE.DirectionalLight(0xfff0d6, 1.9); sun.position.set(22, 36, 14); scene.add(sun, sun.target);
  sun.castShadow = true; const sc = sun.shadow.camera; sc.left = sc.bottom = -34; sc.right = sc.top = 34; sc.near = 1; sc.far = 160; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.05; sun.shadow.radius = 3;
  S.sun = sun; S.sunOff = sun.position.clone();
  scene.traverse((o) => { const m = o.material; if (m && m.isShaderMaterial && !m.userData.lin) { m.fragmentShader = linearizeFrag(m.fragmentShader); m.userData.lin = true; m.needsUpdate = true; } });

  uni = createUnicorn(LOOKS.uni); uni.root.rotation.order = 'YXZ'; uni.root.scale.setScalar(SCALE); scene.add(uni.root); placeUni(0);
  friends = FRIENDS.map((f, i) => {
    const u = createUnicorn(LOOKS[f.key]); u.root.scale.setScalar(SCALE); scene.add(u.root);
    const o = { ...f, i, u, met: false, speed: 0, spot: W.friendSpots[i], tile: FRIEND_TILES[i], side: i % 2 ? 1 : -1 };
    return o;
  });
  twin = createUnicorn(LOOKS.twin); twin.root.scale.setScalar(SCALE); scene.add(twin.root);
  resetFriends();
  camera.position.copy(uni.root.position).add(new THREE.Vector3(8, 4.4, 9)); camTarget.copy(uni.root.position);

  $('#friends').innerHTML = [...FRIENDS, TWIN].map((f) => `<div class="fr" style="--c:${f.css}" title="${f.name}">${f.emoji}</div>`).join('');
  $('#loading').classList.add('done');
  S.mode = 'title'; ui.show('#title');
  setTimeout(() => $('#loading').remove(), 800);
}

function resetFriends() {
  friends.forEach((f) => {
    f.met = false; f.speed = 0; f.u.root.position.copy(f.spot); f.u.root.position.y = groundY(f.spot.x, f.spot.z);
    const p = W.tiles[f.tile].pos; f.u.root.rotation.y = Math.atan2(p.x - f.spot.x, p.z - f.spot.z);
  });
  twin.root.position.copy(W.endSpot); twin.root.position.y = groundY(W.endSpot.x, W.endSpot.z) + 0.3;
  const e = W.tiles[N - 1]; twin.root.rotation.y = Math.atan2(-e.tan.x, -e.tan.z); twin.root.visible = true;
}

// ---------------------------------------------------------------- the game
function drawCard() {
  if (S.forceCard) { const c = S.forceCard; S.forceCard = null; return c; }
  const c = COLORS[Math.floor(Math.random() * 6)], double = Math.random() < 0.25;
  return { c, double };
}
function targetFor(card, from) {
  const hits = []; for (let j = from + 1; j < N - 1; j++) if (W.tiles[j].color === card.c) hits.push(j);
  if (!hits.length) return N - 1;
  return card.double ? (hits[1] ?? N - 1) : hits[0];
}

async function play() {
  S.mode = 'follow'; ui.show('#title', false); ui.show('#hud');
  ui.bubble('\u{1F984} ✨ \u{1F308}', "Let's go on an adventure, Uni!", 'uni'); sfx.chime();
  await sleep(3.4); ui.hideBubble();
  while (S.idx < N - 1) {
    await takeTurn();
  }
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
  await sleep(1.7);
  ui.show('#card', false);
  $('#chip').innerHTML = (card.double ? sq(card.c, 'sm') + sq(card.c, 'sm') : sq(card.c, 'sm')) + cname(card, 'cn'); ui.show('#chip');
  const target = targetFor(card, S.idx);
  await runTo(target);
  ui.show('#chip', false);
  await resolveTile();
}

async function runLeg(i0, i1) {
  const u0 = i0 / (N - 1), u1 = i1 / (N - 1), steps = i1 - i0, dur = Math.max(0.6, steps * 0.3);
  S.speed = 1.5;
  await anim(dur, (k) => {
    const u = lerp(u0, u1, k); S.u = u;
    const p = pathPos(u), t = pathTan(u); uni.root.position.copy(p); uni.lookToward(t.x, t.z, 0.25);
    collectStars(u);
    fx.burst(p.clone().add(new THREE.Vector3(-t.x * 1.4, 1.1 + Math.random() * .7, -t.z * 1.4)), { count: 1, colors: RAINBOW, speed: .6, gravity: -.4, life: 1, size: .8 });
  }, ease.inOut);
  S.speed = 0; S.idx = i1;
  sfx.hop();
}
async function runTo(target) {
  while (S.idx < target) {
    const nextFriend = friends.filter((f) => !f.met && f.tile > S.idx && f.tile <= target).map((f) => f.tile)[0];
    const next = nextFriend ?? target;
    await runLeg(S.idx, next);
    if (nextFriend != null) await meetFriend(friends.find((f) => f.tile === nextFriend));
  }
}

function collectStars(u) {
  W.stars.forEach((s) => {
    if (s.taken || u < s.tile / (N - 1) - 0.006) return;
    s.taken = true; s.mesh.visible = false; addStars(1);
    sfx.collect(S.stars); sparkleAt(s.mesh.position.clone(), [0xffe14d, 0xffffff, 0xffb347], 14, 3);
  });
}
function addStars(n) { S.stars += n; ui.stars(S.stars); const el = $('#stars'); el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }], 300); }

async function resolveTile(depth = 0) {
  if (S.idx >= N - 1 || depth > 3) return;
  const i = S.idx, sc = W.shortcutAt(i);
  if (sc) {
    ui.bubble('\u{1F308} \u{1F680}', 'Rainbow slide!', 'uni'); sfx.magic();
    await sleep(0.9);
    await ride(sc);
    ui.hideBubble();
    // friends skipped over by the slide come running to say hi
    for (const f of friends.filter((f) => !f.met && f.tile < S.idx)) await meetFriend(f);
    return resolveTile(depth + 1);
  }
  const ice = W.iceProps.find((p) => p.tile === i);
  if (ice) await iceCream(ice);
}

async function ride(sc) {
  S.speed = 1.2; S.riding = true;
  const u0 = sc.from / (N - 1), u1 = sc.to / (N - 1);
  await anim(2.4, (k) => {
    const p = sc.arc.getPoint(k), t = sc.arc.getTangent(k); p.y += 0.45;
    uni.root.position.copy(p); uni.lookToward(t.x, t.z, 0.3); uni.root.rotation.x = -Math.asin(clamp(t.y, -.7, .7)) * 0.8;
    S.u = lerp(u0, u1, k);
    fx.burst(p.clone().add(new THREE.Vector3(0, .6, 0)), { count: 3, colors: RAINBOW, speed: 1.4, gravity: -1.5, life: 1.2, size: 1 });
  }, ease.inOut);
  S.riding = false; S.speed = 0; uni.root.rotation.x = 0; S.idx = sc.to; placeUni(sc.to / (N - 1)); sfx.tada();
  sparkleAt(uni.root.position.clone().add(new THREE.Vector3(0, 2, 0)), RAINBOW, 50, 6);
}

async function iceCream(ice) {
  ui.bubble('\u{1F366} \u{1F60B}', 'Yummy ice cream!', 'uni'); sfx.yum();
  const p = ice.spot.clone(); uni.lookToward(p.x - uni.root.position.x, p.z - uni.root.position.z, 1);
  await anim(.5, (k) => { uni.root.rotation.y = uni.root.rotation.y; uni.lift = Math.sin(k * Math.PI) * 1.2; }, ease.linear); uni.lift = 0;
  for (let k = 0; k < 3; k++) { sfx.crunch(); sparkleAt(ice.holder.position.clone().add(new THREE.Vector3(0, 4.5, 0)), [0xffa8d8, 0xffffff, 0xfff0a0, 0x9ff0c8], 18, 3); ice.holder.scale.setScalar(1 - k * .05); await sleep(.45); }
  ice.holder.scale.setScalar(1); addStars(3); sfx.sparkle();
  await sleep(1.4); ui.hideBubble();
}

async function meetFriend(f) {
  f.met = true; S.greeting = f;
  S.mode = 'greet';
  const t = pathTan(S.u), sd = side(t).multiplyScalar(f.side * 3.7);
  const dest = uni.root.position.clone().add(sd).add(t.clone().multiplyScalar(1.1));
  const a = f.u.root.position.clone();
  S.speed = 0; sfx.chime();
  f.u.lookToward(dest.x - a.x, dest.z - a.z, 1);
  await anim(1.4, (k) => {
    const x = lerp(a.x, dest.x, k), z = lerp(a.z, dest.z, k), y = lerp(a.y, dest.y, k);
    f.u.root.position.set(x, Math.max(y, groundY(x, z)), z); f.speed = 1.4; f.u.lookToward(dest.x - a.x, dest.z - a.z, .3);
  }, ease.inOut);
  f.speed = 0;
  uni.lookToward(f.u.root.position.x - uni.root.position.x, f.u.root.position.z - uni.root.position.z, 1);
  f.u.lookToward(uni.root.position.x - f.u.root.position.x, uni.root.position.z - f.u.root.position.z, 1);
  sparkleAt(f.u.root.position.clone().add(new THREE.Vector3(0, 2.4, 0)), f.burst, 60, 6); sfx.sparkle();
  ui.bubble(`${f.emoji} \u{1F984}`, f.line, f.voice);
  const hop = (u) => anim(.5, (k) => { u.lift = Math.sin(k * Math.PI) * 1.3; }, ease.linear);
  await hop(f.u); await hop(uni); await sleep(1.8);
  sparkleAt(uni.root.position.clone().add(new THREE.Vector3(0, 3, 0)), [0xffe14d, 0xffffff, 0xff9ecb], 40, 5); sfx.magic();
  addStars(3);
  document.querySelectorAll('.fr')[f.i].classList.add('met');
  ui.bubble('\u{1F31F}', `${f.name} joins the adventure!`, 'uni'); await sleep(2.2); ui.hideBubble();
  S.followers.push(f); S.mode = 'follow';
}

async function finale() {
  S.mode = 'greet'; S.greeting = twin;
  for (const f of friends.filter((f) => !f.met)) await meetFriend(f);
  S.mode = 'finale';
  ui.bubble('\u{1F3F0} ✨', 'The Rainbow Castle! We made it!', 'uni'); sfx.fanfare();
  await sleep(2.6);
  const a = twin.root.position.clone(), uniP = uni.root.position.clone(), dest = uniP.clone().add(pathTan(1).multiplyScalar(4.2));
  twin.lookToward(uniP.x - a.x, uniP.z - a.z, 1);
  ui.bubble('\u{1F984}\u{1F984}', "Whoa! Another unicorn named Uni!", 'uni');
  await anim(1.6, (k) => { const x = lerp(a.x, dest.x, k), z = lerp(a.z, dest.z, k); twin.root.position.set(x, Math.max(lerp(a.y, uniP.y, k), groundY(x, z)), z); S.twinSpeed = 1.3; twin.lookToward(uniP.x - x, uniP.z - z, .4); });
  S.twinSpeed = 0;
  uni.lookToward(twin.root.position.x - uniP.x, twin.root.position.z - uniP.z, 1);
  sparkleAt(twin.root.position.clone().add(new THREE.Vector3(0, 2.4, 0)), RAINBOW.concat([0xffffff]), 90, 7); sfx.tada(); sfx.giggle();
  document.querySelectorAll('.fr')[4].classList.add('met');
  ui.bubble('\u{1F495}', "Hi! I'm Uni too! We have the same name!", 'uni');
  const hop = (u) => anim(.55, (k) => { u.lift = Math.sin(k * Math.PI) * 1.5; }, ease.linear);
  await hop(twin); await hop(uni); await sleep(2.4);
  addStars(5);
  ui.hideBubble(); ui.show('#banner'); ui.show('#again'); sfx.fanfare(); stopSpeech(); say('You did it, Uni! You made it to the castle!', 'uni');
  S.celebrate = true; S.mode = 'finale';
  $('#again').onclick = () => { $('#fade').style.opacity = 1; setTimeout(restart, 520); };
}

function restart() {
  S.celebrate = false; S.mode = 'follow'; S.idx = 0; S.followers = []; S.stars = 0; S.speed = 0; ui.stars(0); S.greeting = null; uni.lift = 0;
  placeUni(0); resetFriends(); W.stars.forEach((s) => { s.taken = false; s.mesh.visible = true; });
  document.querySelectorAll('.fr').forEach((e) => e.classList.remove('met'));
  ui.show('#banner', false); ui.show('#again', false); ui.hideBubble(); timers.clear();
  camera.position.set(0, 20, 0);
  $('#fade').style.opacity = 0;
  play();
}

// ---------------------------------------------------------------- per-frame
function updateCamera(dt, t) {
  const k = 1 - Math.exp(-3 * dt);
  let desired, look;
  const tt = pathTan(clamp(S.u + 0.03, 0, 1)); tt.y = 0; tt.normalize();
  S.dirS.lerp(tt, 1 - Math.exp(-1.6 * dt)).normalize();
  const up = uni.root.position;
  if (S.mode === 'title') {
    const a = t * 0.2 + 0.4;
    desired = new THREE.Vector3(up.x + Math.sin(a) * 12, up.y + 4.4, up.z + Math.cos(a) * 12); look = up.clone().add(new THREE.Vector3(0, 2.4, 0));
  } else if (S.mode === 'greet' && S.greeting) {
    const g = S.greeting.u ? S.greeting.u.root.position : twin.root.position, mid = up.clone().lerp(g, .5), sd = side(S.dirS);
    desired = mid.clone().addScaledVector(S.dirS, -3.5).addScaledVector(sd, (S.greeting.side || 1) * -7).add(new THREE.Vector3(0, 5, 0));
    look = mid.clone().add(new THREE.Vector3(0, 2.2, 0));
  } else if (S.mode === 'finale') {
    const e = pathTan(1); e.y = 0; e.normalize();
    const ang = Math.sin(t * .35) * .8, ca = Math.cos(ang), sa = Math.sin(ang), c = up.clone();
    const back = new THREE.Vector3(-e.x * ca + -e.z * sa * -1, 0, -e.z * ca + -e.x * sa);
    desired = c.clone().addScaledVector(back, 17).add(new THREE.Vector3(0, 7.5, 0)); look = c.add(new THREE.Vector3(0, 5, 0));
  } else {
    const hi = S.riding ? 7 : 0;
    desired = up.clone().addScaledVector(S.dirS, -13.5 - hi * .6).addScaledVector(side(S.dirS), 1.2).add(new THREE.Vector3(0, 9 + hi, 0));
    look = up.clone().addScaledVector(S.dirS, 5).add(new THREE.Vector3(0, 2.2, 0));
  }
  desired.y = Math.max(desired.y, groundY(desired.x, desired.z) + 3);
  camera.position.lerp(desired, k); camTarget.lerp(look, 1 - Math.exp(-4 * dt)); camera.lookAt(camTarget);
}

function update(dt) {
  S.time += dt; const t = S.time;
  timers.update(dt); fx.update(dt); W.update(dt, t);
  uni.update(dt, t, S.speed);
  friends.forEach((f) => f.u.update(dt, t, f.speed));
  twin.update(dt, t, S.twinSpeed || 0);
  // the parade: met friends trot along behind Uni
  S.followers.forEach((f, k) => {
    const u = Math.max(0, S.u - (k + 1) * 0.034), p = pathPos(u), tn = pathTan(u), pos = f.u.root.position;
    const target = p.clone().addScaledVector(side(tn), (k % 2 ? 1 : -1) * 1.5);
    const prev = pos.clone(); pos.lerp(target, 1 - Math.exp(-5 * dt));
    const v = pos.distanceTo(prev) / Math.max(dt, 1e-3); f.speed = clamp(v / 4.5, 0, 1.5);
    if (v > 0.8) f.u.lookToward(pos.x - prev.x, pos.z - prev.z, 0.2); else f.u.lookToward(tn.x, tn.z, 0.05);
  });
  if (S.speed > .4) { const p = uni.root.position; fx.burst(p.clone().add(new THREE.Vector3(0, 0.3, 0)), { count: 1, colors: [0xffffff, 0xffe9a0], speed: .4, gravity: -.2, life: .8, size: .6 }); }
  if (S.celebrate && Math.random() < dt * 5) { const c = uni.root.position; sparkleAt(new THREE.Vector3(c.x + rand(-18, 18), c.y + rand(10, 24), c.z + rand(-18, 18)), RAINBOW.concat([0xffffff]), 50, 7); if (Math.random() < .3) sfx.pop(); }
  // sun & shadows follow Uni
  if (S.sun) { const f = uni.root.position; S.sun.target.position.copy(f); S.sun.position.copy(f).add(S.sunOff); const want = Q.shadow > 0; if (S.sun.castShadow !== want) S.sun.castShadow = want; if (want && S.sun.shadow.mapSize.x !== Q.shadow) { S.sun.shadow.mapSize.set(Q.shadow, Q.shadow); S.sun.shadow.map && S.sun.shadow.map.dispose(); S.sun.shadow.map = null; } }
  // finger hint if nobody taps the deck for a while
  if (S.waiting) { S.hint += dt; if (S.hint > 9) { const h = $('#hint'), d = $('#deck').getBoundingClientRect(); h.classList.remove('hidden'); h.style.left = (d.left + d.width / 2) + 'px'; h.style.top = (d.top - 70) + 'px'; } }
  updateCamera(dt, t);
}

// tapping a unicorn makes it giggle and hop
const ray = new THREE.Raycaster();
canvas.addEventListener('pointerdown', (e) => {
  unlock();
  const r = canvas.getBoundingClientRect(); ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
  const all = [{ u: uni, n: 'Uni' }, ...friends.map((f) => ({ u: f.u, n: f.name })), { u: twin, n: 'Uni' }];
  const hit = all.find((a) => a.u.root.visible && ray.intersectObject(a.u.root, true).length);
  if (!hit) return;
  sfx.giggle(); say(hit.n + '!', 'uni'); sparkleAt(hit.u.root.position.clone().add(new THREE.Vector3(0, 2.6, 0)), RAINBOW.concat([0xffffff]), 36, 5);
  anim(.5, (k) => { hit.u.lift = Math.sin(k * Math.PI) * 1.3; }, ease.linear);
});

// ---------------------------------------------------------------- go
const clock = new THREE.Clock(); let slow = 0, frames = 0;
renderer.setAnimationLoop(() => {
  if (!W) return;
  const raw = clock.getDelta(), dt = Math.min(raw, 0.05);
  update(dt); composer.render(dt);
  if (raw > 0.03 && raw < 0.5) slow++;
  if (++frames === 150) { if (slow > 80 && lowerTier()) { applyTier(); resize(); } slow = 0; frames = 0; }
});
$('#play').addEventListener('click', () => { unlock(); playMusic('forest'); play(); });
window.uniGame = { S, scene, camera, get W() { return W; }, tp: (i) => { S.idx = i; placeUni(i / (N - 1)); }, force: (name, double = false) => { S.forceCard = { c: COLORS.find((c) => c.name === name), double }; } };
boot().catch((e) => { console.error(e); $('.l-text').textContent = 'Oops, something went wrong. Please reload!'; });
