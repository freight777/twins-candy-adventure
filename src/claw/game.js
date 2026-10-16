// Claw Machine: pick unicorns or mermaids, pick easy / medium / hard, then ten tries to win as many toys as you can.
// Nothing to learn and nothing to lose: just the real thing. The odds are set like a real machine's "payout": before the
// game starts, the ten tries are dealt a number of winning grabs (easy about half, medium about one in five, hard one), and a
// winning grab that lands on nothing (the claw dropped between toys) moves on to the next try, so a good aim is never cheated.
// Every other grab really grabs and really slips, at a different moment each time: just off the pile, at the top, or on
// the way to the chute. Everything you see is physical: the toys are rigid bodies, the claw is a chrome solenoid on a gantry.
import './claw.css';
import { loading } from '../engine/loading.js';
import { homeGate } from '../engine/gate.js';
import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { createPipeline } from '../engine/pipeline.js';
import { Q } from '../engine/quality.js';
import { Timers, Fx, ease, lerp, clamp } from '../util.js';
import { unlock, playMusic, sfx, voice, say, motor, arcadeBed } from '../audio.js';
import { buildMachine, buildShelf, DIM, CLAW } from './machine.js';
import { createPhysics } from './physics.js';
import { makeToy, plushMaterials, setFurLayers, furShown, forgetToy, makeGolden, twinkle, unicorn, mermaid, star, heart, rainbow, starfish, shell, fish, bunny, kitty, seahorse, octopus } from './plush.js';

const $ = (s) => document.querySelector(s);
homeGate();
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
};

// ---------------------------------------------------------------- renderer: the shared pipeline plus a film look
const canvas = $('#c');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, .04, 40);
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, sat: { value: 1.04 }, con: { value: 1.06 }, time: { value: 0 }, grain: { value: .028 }, warm: { value: .02 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float sat, con, time, grain, warm; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
    void main(){ vec2 q0 = vUv - .5, off = q0 * dot(q0, q0) * .008;                                   // a touch of lens fringing toward the corners
      vec4 t = vec4(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b, texture2D(tDiffuse, vUv).a);
      float l = dot(t.rgb, vec3(.2126,.7152,.0722)); vec3 c = mix(vec3(l), t.rgb, sat); c = (c - .5) * con + .5;
      c += vec3(warm, warm * .3, -warm) * (1. - l);                                                       // warm shadows, like film stock
      vec2 q = vUv - .5; c *= 1. - dot(q, q) * .62;
      c += (hash(vUv * vec2(1920., 1080.) + fract(time) * 61.) - .5) * grain;
      gl_FragColor = vec4(clamp(c, 0., 1.), t.a); }`,
});
const gtao = new GTAOPass(scene, camera, 256, 256); gtao.blendIntensity = .85; gtao.updateGtaoMaterial({ radius: .05, distanceExponent: 1.4, thickness: .05, scale: 1, samples: 12 });
const bokeh = new BokehPass(scene, camera, { focus: 1.6, aperture: .0035, maxblur: .006 });
const depthSkip = [];
const collectDepthSkip = () => { depthSkip.length = 0; scene.traverse((o) => { const m = o.material; if (o.isSprite || o.isPoints || (o.isMesh && m && (Array.isArray(m) ? m.some((x) => x.transparent) : m.transparent))) depthSkip.push(o); }); };
[gtao, bokeh].forEach((p) => { const run = p.render.bind(p); p.render = (...a) => { const vis = depthSkip.map((o) => o.visible); depthSkip.forEach((o) => (o.visible = false)); try { run(...a); } finally { depthSkip.forEach((o, i) => (o.visible = vis[i])); } }; });
const pipe = createPipeline(canvas, { toneMapping: THREE.ACESFilmicToneMapping, exposure: .95, bloom: { strength: .18, radius: .5, threshold: 1.25 }, gradePass: grade, extraPasses: [gtao, bokeh] });
const renderer = pipe.renderer;
pipe.setScene(scene, camera);
let machine = null, phys = null, shelf = null;
const view = { fov: 38, aspect: 1 };
pipe.onTier = (q) => {
  // ambient occlusion and depth of field on every tier but the lowest (the iPad included); the automatic quality steps down if it's slow
  gtao.enabled = bokeh.enabled = q.name !== 'low';
  setFurLayers(q.name === 'high' ? 12 : q.name === 'medium' ? 7 : 0);
  if (machine) { const r = machine.roof; r.shadow.mapSize.set(q.shadow || 768, q.shadow || 768); r.shadow.map?.dispose(); r.shadow.map = null; }
};
/** the glass window of the machine always fills the screen: fit its height (and its width on narrow screens) */
pipe.onResize = (a) => {
  view.aspect = a; camera.aspect = a;
  const d = 1.62, H = 1.14, Wd = 1.12;
  const vfH = 2 * Math.atan(H / 2 / d), vfW = 2 * Math.atan(Wd / 2 / d / a);
  view.fov = THREE.MathUtils.radToDeg(Math.max(vfH, vfW)); camera.fov = view.fov; camera.updateProjectionMatrix();
};
pipe.applyTier();
['gesturestart', 'dblclick', 'contextmenu'].forEach((ev) => document.addEventListener(ev, (e) => e.preventDefault()));

// ---------------------------------------------------------------- state
const TRIES = 10, TOYS = 26;
const LEVELS = { easy: [4, 5, 5, 6], medium: [2, 2, 2, 1, 3], hard: [1] };
const timers = new Timers(), fx = new Fx(scene, 400);
const sleep = (s) => new Promise((r) => timers.after(s, r));
const anim = (dur, fn, e = ease.inOut) => new Promise((r) => timers.tween(dur, fn, { ease: e, done: r }));
const S = {
  state: 'boot', who: store.get('clawWho', null), theme: store.get('clawTheme', 'unicorn'), level: store.get('clawLevel', 'easy'), toys: [], plan: [], try: 0, results: [], won: [],
  claw: { x: DIM.home.x, y: DIM.top, z: DIM.home.z, open: .15, angle: null, vx: 0, vz: 0, mvx: 0, mvz: 0, pvx: 0, pvz: 0, bob: 0, sw: { x: 0, z: 0, vx: 0, vz: 0 } }, stick: { x: 0, z: 0 }, keys: { x: 0, z: 0 }, button: 0,
  held: null, catchWait: null, time: 0, cam: { k: 0, push: 0, goalP: new THREE.Vector3(), goalL: new THREE.Vector3() }, hinted: false, moved: 0, reveal: null, endView: 0, seed: (Math.random() * 1e9) | 0,
};
if (!['unicorn', 'mermaid'].includes(S.theme)) S.theme = 'unicorn';

// ---------------------------------------------------------------- the pile
const randQuat = () => new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 6.3, Math.random() * 6.3, Math.random() * 6.3));
function newToy(i) { const t = makeToy(S.theme, i, S.seed++); scene.add(t); S.toys.push(t); return t; }
function removeToy(t) { forgetToy(t); phys.remove(t); scene.remove(t); t.traverse((o) => o.geometry?.dispose()); S.toys = S.toys.filter((x) => x !== t); }
/** a full machine, already settled (behind the loading screen) */
function fillNow() {
  for (let i = 0; i < TOYS; i++) { phys.add(newToy(i), dropPoint(.62), randQuat()); phys.settle(.14); }
  phys.settle(2.5); phys.sync(); keepInside(true); ensureGolden();
}
/** there is always exactly one golden toy in the machine, somewhere you can see it (on top, not buried) */
function ensureGolden() {
  if (S.toys.some((t) => t.userData.golden)) return;
  const top = [...S.toys].sort((a, b) => b.position.y - a.position.y).slice(0, 10).filter((t) => t.position.z > -.15 && t.position.z < .22);
  const pick = top[Math.floor(Math.random() * top.length)] || S.toys[0]; if (pick) makeGolden(pick);
}
/** somewhere over the bed (not over the chute guard), anywhere from wall to wall */
function dropPoint(y) {
  const { x0, x1, z0, z1 } = DIM.bounds; let best = null;
  for (let tries = 0; tries < 60 && (!best || best.n < 5); tries++) {
    const x = lerp(x0 - .02, x1 + .02, Math.random()), z = lerp(z0 - .02, z1, Math.random());
    if (x < DIM.chute.x1 + .12 && z > DIM.chute.z0 - .12) continue;
    const h = phys ? phys.probe(x, z).y : 0;                              // the lowest of a few spots: toys fill the hollows, the bed stays level
    if (!best || h < best.h) best = { x, z, h, n: (best?.n || 0) + 1 }; else best.n++;
  }
  return new THREE.Vector3(best.x, Math.max(y, best.h + .2) + Math.random() * .06, best.z);
}
/** toys rain in from the top, one after another (choosing a theme, refilling after a game) */
async function rainIn(n) {
  const gold = S.toys.some((t) => t.userData.golden) ? -1 : Math.floor(n * (.6 + Math.random() * .35));   // the golden one lands near the top
  for (let i = 0; i < n; i++) { const t = newToy(i), p = dropPoint(.68); if (i === gold) makeGolden(t); t.position.copy(p); phys.add(t, p, randQuat()); if (i % 3 === 0) sfx.thud(.5); await sleep(.07); }
  await sleep(1.8);
}
/** anything that rolled into the chute when no one was playing goes back on top of the pile */
function keepInside(silent, dt = 0) {
  for (const t of S.toys) {
    const b = phys.bodyOf(t); if (!b || b.userData.held || b.world == null) continue;
    if (b.position.y < -.1 || !Number.isFinite(b.position.y)) {
      if (S.catchResolve && inChute(b.position) && !silent) { caught(t); continue; }      // a lucky extra only counts while the claw is letting go over the chute
      backOnPile(b); continue;
    }
    // a toy that has come to rest in the chute (wedged in the hole, or sitting on the chute side of the guard) would block
    // the next prize: after a moment it goes back on the pile
    if (overChute(b.position) && b.position.y < .5 && b.velocity.lengthSquared() < .04) {
      b.userData.stuck = (b.userData.stuck || 0) + dt;
      if (b.userData.stuck > .8) { backOnPile(b); sfx.pop(); }
    } else b.userData.stuck = 0;
  }
}
function backOnPile(b) { b.position.copy(dropPoint(.6)); b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0); b.userData.stuck = 0; b.wakeUp(); }
/** before a prize goes down, anything in the chute is moved out of its way */
function clearChute() { for (const t of S.toys) { const b = phys.bodyOf(t); if (b && !b.userData.held && b.world && overChute(b.position) && b.position.y > -.1 && b.position.y < .55) backOnPile(b); } }
const overChute = (p) => p.x < DIM.chute.x1 && p.z > DIM.chute.z0;
const inChute = (p) => p.x < DIM.chute.x1 + .02 && p.z > DIM.chute.z0 - .02;

// ---------------------------------------------------------------- boot
async function boot() {
  await new Promise((r) => setTimeout(r, 30));
  const tick = loading.counter(4);
  machine = buildMachine(scene, renderer, S.theme); tick();
  scene.environment = machine.env; scene.environmentIntensity = .6; scene.background = new THREE.Color(0x07060c); scene.fog = new THREE.Fog(0x07060c, 3.5, 7);
  plushMaterials(); tick();
  phys = createPhysics(); fillNow();
  let lastThud = 0; phys.onImpact = (t, v) => { const now = performance.now(); if (now - lastThud < 90 || S.state === 'boot') return; lastThud = now; sfx.thud(Math.min(1, v / 2.5) * .8); }; shelf = buildShelf(scene); tick();
  pipe.applyTier(); collectDepthSkip();
  placeCamera(1);
  try { await Promise.race([renderer.compileAsync(scene, camera), new Promise((r) => setTimeout(r, 5000))]); } catch { /* compiles on the first frame instead */ }
  tick(); loading.done();
  S.state = 'title'; showTitle();
}

// ---------------------------------------------------------------- UI helpers
const show = (sel, on = true) => $(sel).classList.toggle('hidden', !on);
const banner = (html, cls = '', sec = 2) => { const b = $('#bigtext'); b.innerHTML = html; b.className = cls; show('#bigtext'); b.style.animation = 'none'; void b.offsetWidth; b.style.animation = ''; if (sec) timers.after(sec, () => show('#bigtext', false)); };
function setHud() {
  $('#tries').innerHTML = Array.from({ length: TRIES }, (_, i) => {
    const r = S.results[i]; const cls = r ? r.type : i === S.try && S.state !== 'over' ? 'now' : '';
    return `<i class="${cls}${S.who === 'both' ? (i % 2 ? ' pe' : ' pa') : ''}">${r && r.type === 'win' ? r.emoji : ''}</i>`;
  }).join('');
  $('#count').textContent = S.won.length;
}
const controls = (on) => { show('#stick', on); show('#drop', on); show('#peek', on); document.body.classList.toggle('aiming', on); };
/** look down from up high (like standing on tiptoe at a real machine to see how far back the claw is), or back to normal */
function setPeek(on) { S.peek = on; $('#peek').classList.toggle('on', on); }

function showTitle(step = 'who') {
  controls(false); show('#hud', false); show('#over', false); show('#shelfUI', false); show('#title');
  show('#pickWho', step === 'who'); show('#pickTheme', step === 'theme'); show('#pickLevel', false);
  document.querySelectorAll('#pickWho .choice').forEach((b) => b.classList.toggle('picked', b.dataset.who === S.who));
  document.querySelectorAll('#pickTheme .choice').forEach((b) => b.classList.toggle('picked', b.dataset.theme === S.theme));
}
function chooseWho(who) { unlock(); sfx.pop(); playMusic('arcade'); arcadeBed(true); S.who = who; store.set('clawWho', who); showTitle('theme'); }

// ---------------------------------------------------------------- each girl's toy shelf: every toy she has ever won, kept on this iPad
/** whose try this is: with "take turns" Adalyn has the even tries and Esmae the odd ones */
const ownerOf = (i) => (S.who === 'both' ? (i % 2 ? 'esmae' : 'adalyn') : S.who);
const PLAYERS = { adalyn: { name: "Adalyn's toys", color: '#ff8a1f' }, esmae: { name: "Esmae's toys", color: '#ff4fa3' } };
const KINDS = { unicorn, mermaid, star, heart, rainbow, starfish, shell, fish, bunny, kitty, seahorse, octopus };
const collection = (who) => store.get(`clawShelf:${who}`, []);
function keepToys(who, toys) { if (!who || !toys.length) return; const all = collection(who); toys.forEach((t) => all.push({ k: t.userData.toy.kind, s: t.userData.toy.seed, g: !!t.userData.golden })); store.set(`clawShelf:${who}`, all.slice(-500)); }
const shelfToys = [];
/** fresh: how many of the newest toys pop onto the shelf one by one (the end of a game); ui: show the back / A / E buttons */
async function openShelf(who = S.who === 'esmae' ? 'esmae' : 'adalyn', { fresh = 0, ui = true } = {}) {
  if (!S.who) return;
  if (S.state === 'shelf') clearShelf(); else if (!fresh) sfx.pop();
  S.state = 'shelf'; S.shelfWho = who; show('#title', false); show('#over', false);
  document.querySelectorAll('#shelfWho button').forEach((b) => b.classList.toggle('on', b.dataset.shelf === who));
  const all = collection(who), list = all.slice(-shelf.slots.length);
  shelf.setName(PLAYERS[who].name, PLAYERS[who].color);
  list.forEach((r, i) => {
    const make = KINDS[r.k]; if (!make) return;
    const t = make(r.s); if (r.g) makeGolden(t);
    t.quaternion.setFromEuler(_e.set(0, (Math.random() - .5) * .5, 0)); t.scale.setScalar(.86); t.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(t), slot = shelf.slots[i];
    t.position.set(slot.x + (Math.random() - .5) * .02, slot.y - (box.min.y - t.position.y), slot.z);
    if (i >= list.length - fresh) { t.userData.base = t.scale.x; t.scale.setScalar(.001); t.userData.fresh = true; }
    scene.add(t); shelfToys.push(t);
  });
  $('#shelfCount').textContent = `\u{1F9F8} ${all.length - fresh}`; show('#shelfUI', ui);
  anim(1, (k) => { shelf.light.intensity = 7 * k; shelf.fill.intensity = .8 * k; });
  if (fresh) {                                                               // the new ones arrive: each pops in with a sparkle and a chime
    await sleep(1.2); let n = all.length - fresh;
    for (const t of shelfToys.filter((x) => x.userData.fresh)) {
      const s0 = t.userData.base; t.userData.fresh = false; sfx.collect(n % 6); if (t.userData.golden) sfx.sparkle(); else sfx.plush(.8);
      fx.burst(t.position, { count: 26, colors: [0xffffff, 0xffe9a8, 0xffb3e6], speed: .5, gravity: -.3, life: .8, size: .9 });
      anim(.5, (k) => t.scale.setScalar(Math.max(.001, s0 * ease.outBack(k))));
      $('#shelfCount').textContent = `\u{1F9F8} ${++n}`; await sleep(.45);
    }
    await sleep(.8);
  } else if (all.length) { await sleep(.9); voice(`n_${Math.min(30, all.length)}`, { priority: 1 }); }
}
const _tapP = new THREE.Vector3();
canvas.addEventListener('pointerdown', (e) => {
  if (S.state !== 'shelf' || !shelfToys.length) return;
  // the nearest toy to the finger (generous: small fingers miss), measured on the screen
  camera.updateMatrixWorld(); let t = null, best = 80 * 80;
  for (const toy of shelfToys) { _tapP.copy(toy.position).project(camera); const dx = (_tapP.x + 1) / 2 * innerWidth - e.clientX, dy = (1 - _tapP.y) / 2 * innerHeight - e.clientY, d = dx * dx + dy * dy; if (d < best) { best = d; t = toy; } }
  if (!t) return;
  if (t.userData.hopping) return; t.userData.hopping = true; sfx.plush(); if (t.userData.golden) sfx.sparkle();
  const y0 = t.position.y, r0 = t.rotation.y, s0 = t.scale.x;
  anim(.7, (k) => { t.position.y = y0 + Math.sin(k * Math.PI) * .07; t.rotation.y = r0 + k * Math.PI * 2; const sq = Math.sin(k * Math.PI * 3) * .08 * (1 - k); t.scale.set(s0 * (1 + sq), s0 * (1 - sq), s0 * (1 + sq)); }, ease.linear).then(() => { t.position.y = y0; t.rotation.y = r0; t.scale.setScalar(s0); t.userData.hopping = false; });
});
async function closeShelf() {
  sfx.pop(); show('#shelfUI', false); S.state = 'title';
  await anim(.6, (k) => { shelf.light.intensity = 7 * (1 - k); shelf.fill.intensity = .8 * (1 - k); });
  clearShelf();
  showTitle('theme');
}
function clearShelf() { for (const t of shelfToys) { forgetToy(t); scene.remove(t); t.traverse((o) => o.geometry?.dispose()); } shelfToys.length = 0;
}
async function chooseTheme(theme) {
  if (S.busy) return; S.busy = true; unlock(); sfx.pop(); playMusic('arcade'); arcadeBed(true);
  store.set('clawTheme', theme);
  if (theme !== S.theme) {
    S.theme = theme; machine.setTheme(theme);
    document.querySelectorAll('#pickTheme .choice').forEach((b) => b.classList.toggle('picked', b.dataset.theme === theme));
    show('#pickTheme', false);
    for (const t of [...S.toys]) removeToy(t);
    await rainIn(TOYS);
  } else show('#pickTheme', false);
  show('#pickLevel'); document.querySelectorAll('#pickLevel .choice').forEach((b) => b.classList.toggle('picked', b.dataset.level === S.level));
  S.busy = false;
}
function chooseLevel(level) { if (S.busy) return; unlock(); sfx.pop(); S.level = level; store.set('clawLevel', level); show('#title', false); start(); }

// ---------------------------------------------------------------- the game
function dealPlan() {
  const pick = (a) => a[Math.floor(Math.random() * a.length)], plan = Array(TRIES).fill(false);
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };   // (Fisher-Yates: every try equally likely)
  const deal = (tries, n) => shuffle([...tries]).slice(0, n).forEach((i) => { plan[i] = true; });
  const all = [...Array(TRIES).keys()];
  if (S.who !== 'both') deal(all, pick(LEVELS[S.level]));
  else {                                                                     // taking turns: the same luck for both girls (on hard, one win each)
    const each = S.level === 'easy' ? pick([2, 2, 3, 3]) : 1;
    deal(all.filter((i) => i % 2 === 0), each); deal(all.filter((i) => i % 2 === 1), each);
  }
  return plan;
}
async function start() {
  S.state = 'starting'; playMusic('arcade'); arcadeBed(true);
  if (S.toys.length < TOYS) await rainIn(TOYS - S.toys.length);
  ensureGolden();
  S.plan = dealPlan(); S.try = 0; S.results = []; S.won = []; S.endView = 0;
  show('#hud'); setHud();
  while (S.try < TRIES) await oneTry();
  await gameOver();
}

async function oneTry() {
  S.state = 'aim'; S.moved = 0; setHud(); sfx.coin(); setPeek(false);
  if (S.who === 'both') { const w = ownerOf(S.try); banner(`<span class="initial ${w[0]}">${w[0].toUpperCase()}</span>`, 'turn', 1.4); say(w === 'adalyn' ? "Adalyn's turn!" : "Esmae's turn!", 'narrator'); }
  controls(true);
  if (!S.hinted) $('#stick').classList.add('hint');
  await new Promise((r) => (S.dropNow = r));
  S.dropNow = null; controls(false); $('#stick').classList.remove('hint'); $('#drop').classList.remove('hint'); S.hinted = true;
  S.state = 'try';
  const res = await grab(S.plan[S.try]);
  S.results[S.try] = res; S.try++; setHud();
  await sleep(res.type === 'win' ? .2 : .5);
}

/** where the claw's prongs will touch first, straight below (x, z) */
function landing(x, z) {
  const c = phys.probe(x, z), hits = [c];
  for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3 + Math.PI / 2; hits.push(phys.probe(x + Math.cos(a) * CLAW.tipR, z - Math.sin(a) * CLAW.tipR)); }
  let y = c.y + CLAW.hub; for (let i = 1; i < 4; i++) y = Math.max(y, hits[i].y + CLAW.reach);
  return { y: clamp(y, CLAW.reach + .015, DIM.top - .05), hits };
}
/** pick the toy the claw closed on: the one straight below if it's near the top, else the highest one under a prong */
function targetOf(stopY, hits) {
  const ok = (h) => h.toy && h.y > stopY - .19;
  if (ok(hits[0])) return hits[0].toy;
  let best = null; for (let i = 1; i < 4; i++) if (ok(hits[i]) && (!best || hits[i].y > best.y)) best = hits[i];
  return best ? best.toy : null;
}

async function grab(shouldWin) {
  const C = S.claw, x = C.x, z = C.z;
  machine.setButton(1); timers.after(.25, () => machine.setButton(0));
  // 1. down, opening as it goes
  sfx.click(); const { y: stopY, hits } = landing(x, z);
  const downDur = (DIM.top - stopY) / .42;
  motor(.8, .75); anim(.4, (k) => { C.open = lerp(.15, 1, k); });
  await anim(downDur, (k) => { C.y = lerp(DIM.top, stopY, k); }, motorEase);
  motor(0); sfx.clunk(); phys.nudge(x, stopY - .1, z, .12, .006); S.cam.shake = .5; C.bob = 1; machine.flash(.6);
  await sleep(.3);
  // 2. close
  const target = targetOf(stopY, hits);
  if (shouldWin && !target) carryWin();
  const win = shouldWin && !!target;
  const R = target ? target.userData.toy.radius : 0;
  const shut = target ? clamp(Math.asin(clamp((R * .4 - .028 * CLAW.s) / CLAW.len, -.5, .5)), -.08, .3) : -.1;
  const openA = lerp(-.1, .62, 1);
  sfx.click(); motor(.4, 1.4);
  await anim(.55, (k) => { C.angle = lerp(openA, shut, k); C.y = stopY - .028 * k; });
  motor(0);
  if (target) {
    phys.hold(target); sfx.plush();
    S.held = { toy: target, off0: target.position.clone().sub(clawVec()), q0: target.quaternion.clone(), up: uprightOf(target.quaternion), k: 0, slide: 0, loose: 0 };
  }
  await sleep(.25);
  // 3. up: a winning grab holds firm; a losing one slips at some point
  const fail = win ? null : pickFail();
  const liftTo = (y0, frac) => anim((DIM.top - y0) * frac / .3, (k) => { C.y = lerp(y0, y0 + (DIM.top - y0) * frac, k); }, ease.inOut);
  motor(.8, .7);
  if (target && fail === 'early') {
    await liftTo(C.y, .12 + Math.random() * .1); motor(0); await loosen(.3); drop(); await sleep(.5);
    motor(.8, .7); await liftTo(C.y, 1);
  } else if (target && fail === 'lift') {
    const frac = .35 + Math.random() * .45;
    const y0 = C.y; await liftTo(y0, frac); motor(0); await loosen(.45); drop(); await sleep(.3);
    motor(.8, .7); await liftTo(C.y, 1);
  } else {
    await liftTo(C.y, 1);
  }
  motor(0); sfx.clunk();
  // 4. over to the chute
  if (target && fail === 'top') { await sleep(.35); await wiggle(); drop(); await sleep(.4); }
  const travel = async (fracStop = 1) => {
    const x0 = C.x, z0 = C.z, dist = Math.hypot(DIM.home.x - x0, DIM.home.z - z0), dur = Math.max(.6, dist / .3);
    motor(.7, 1); let done = false;
    await anim(dur * fracStop, (k) => { if (done) return; const kk = k * fracStop; C.x = lerp(x0, DIM.home.x, kk); C.z = lerp(z0, DIM.home.z, kk); }, fracStop < 1 ? ease.in : ease.inOut);
    done = true; motor(0);
  };
  if (target && fail === 'carry') { await travel(.2 + Math.random() * .3); await loosen(.2); drop(); await sleep(.3); }
  await sleep(.15);
  await travel(1);
  await sleep(.2);
  // 5. open over the chute
  let caughtToy = null;
  S.catchWait = new Promise((r) => (S.catchResolve = r));
  const a0 = C.angle ?? -.1; sfx.click(); await anim(.3, (k) => { C.angle = lerp(a0, .62, k); });
  if (S.held && win) {
    clearChute();
    // a winning toy goes straight down the hole (its body stays out of the world, so it can't catch on the guard)
    const t = S.held.toy; t.scale.setScalar(1); const y0 = t.position.y, sx = (Math.random() - .5) * 5, sz = (Math.random() - .5) * 5; S.held = null; sfx.click();
    t.position.x += (DIM.home.x - t.position.x) * .5; t.position.z += (DIM.home.z - t.position.z) * .5;
    await anim(.55, (k) => { t.position.y = y0 - 4.9 * (k * .55) ** 2 - .3 * k; t.rotation.x += sx * .016; t.rotation.z += sz * .016; }, ease.linear);
    caught(t);
  } else if (S.held) drop(true);
  caughtToy = await Promise.race([S.catchWait, sleep(S.recentDrop ? 1.4 : .4).then(() => null)]);
  S.catchResolve = null; S.recentDrop = false;
  await anim(.4, (k) => { C.angle = lerp(.62, lerp(-.1, .62, .15), k); });
  C.angle = null; C.open = .15;
  if (caughtToy) { await reveal(caughtToy); return { type: 'win', emoji: caughtToy.userData.toy.emoji }; }
  if (shouldWin && target) carryWin();                            // (it bounced out somehow: the win isn't lost)
  if (target) { say('Oops! Next time!', 'narrator'); banner('<span>So close!</span>', 'soft', 1.6); } else { voice('hmm_try_again', { priority: 1 }); banner('<span>Oops!</span>', 'soft', 1.4); }
  sfx.soft();
  return { type: 'miss' };
}
/** a motor's speed curve: a quick spin-up, a steady run, a quick stop */
const motorEase = (t) => { const a = .12, d = 2 * a * (1 - a); return t < a ? t * t / d : t > 1 - a ? 1 - (1 - t) * (1 - t) / d : (t - a / 2) / (1 - a); };
/** a planned win that couldn't happen moves to the next try that isn't already a win */
function carryWin() { for (let i = S.try + 1; i < TRIES; i++) if (!S.plan[i] && ownerOf(i) === ownerOf(S.try)) { S.plan[i] = true; return; } }
function pickFail() { const r = Math.random(); return r < .2 ? 'early' : r < .55 ? 'lift' : r < .78 ? 'top' : 'carry'; }
const clawVec = () => machine.clawPos.clone();
/** the toy's rotation turned so it hangs the way a stuffed toy hangs from a claw: upright, keeping which way it faced */
function uprightOf(q) {
  const f = new THREE.Vector3(0, 0, 1).applyQuaternion(q); f.y = 0; if (f.lengthSq() < 1e-4) f.set(0, 0, 1);
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(.25, Math.atan2(f.x, f.z), 0));
}
/** the grip gives: prongs ease open and the toy slides down a little */
async function loosen(t) { const H = S.held; if (!H) return; const a0 = S.claw.angle; await anim(t, (k) => { S.claw.angle = a0 + .14 * k; H.slide = .025 * k; }); }
async function wiggle() { const a0 = S.claw.angle; for (let i = 0; i < 2; i++) { await anim(.12, (k) => { S.claw.angle = a0 + .1 * k; S.held && (S.held.slide = .01 * k); }); await anim(.12, (k) => { S.claw.angle = a0 + .1 * (1 - k); }); } }
/** let go of whatever the claw is holding */
function drop(intoChute = false) {
  const H = S.held; if (!H) return; S.held = null; H.toy.scale.setScalar(1);
  phys.release(H.toy, { x: S.claw.vx * .8, y: -.05, z: S.claw.vz * .8 }, intoChute ? .3 : 1);
  S.recentDrop = true; sfx.click();
}
/** a toy fell all the way down the chute */
function caught(t) {
  phys.remove(t); t.visible = false; S.toys = S.toys.filter((x) => x !== t); sfx.chute(); timers.after(.45, () => { sfx.door(); sfx.bell(); });
  S.catchResolve?.(t);
}

// ---------------------------------------------------------------- winning: the toy pops up in front of you
const hero = new THREE.SpotLight(0xfff0f6, 0, 3.5, .45, .7, 1.2); hero.castShadow = false; scene.add(hero, hero.target);
const rim = new THREE.PointLight(0xff9fe0, 0, 2, 1.5); scene.add(rim);
async function reveal(t) {
  S.state = 'reveal'; t.userData.owner = ownerOf(S.try); S.won.push(t); setHud();
  // 1. down at the prize door: the lamp comes on, the toy shoves the flap open and tumbles out toward you
  const D = machine.door, d = D.at; S.cam.doorWant = true;
  t.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  t.visible = true; t.scale.setScalar(.55); t.quaternion.setFromEuler(_e.set(Math.random() - .5, Math.random() * 6.3, Math.random() - .5));
  t.position.set(d.x, d.y - .01, d.z - .07);
  anim(.4, (k) => { D.lamp.intensity = .8 * k; });
  await sleep(.65);
  sfx.door(); const q0 = t.quaternion.clone(), q1 = new THREE.Quaternion().setFromEuler(_e.set(-.35, (Math.random() - .5) * .8, 0));
  await anim(.5, (k) => { D.flap.rotation.x = -1.15 * Math.sin(Math.min(1, k * 1.4) * Math.PI / 2); t.position.set(d.x, d.y - .01 + Math.sin(k * Math.PI) * .03, d.z - .07 + k * .17); t.quaternion.slerpQuaternions(q0, q1, k); }, ease.out);
  anim(.6, (k) => { D.flap.rotation.x = -1.15 * (1 - k) + Math.sin(k * 9) * .06 * (1 - k); }, ease.inOut);
  await sleep(.45);
  // 2. back up: it rises into the light in front of the glass
  S.cam.doorWant = false; anim(.8, (k) => { D.lamp.intensity = .8 * (1 - k); });
  const G = S.cam.goalP, dir = S.cam.goalL.clone().sub(G).normalize(), side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize(), up = new THREE.Vector3().crossVectors(side, dir);
  const at = G.clone().addScaledVector(dir, .9).addScaledVector(up, .035), from = t.position.clone();
  const s0 = t.scale.x;
  await sleep(.4);
  t.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  hero.position.copy(G).addScaledVector(up, .5).addScaledVector(side, .35); hero.target.position.copy(at);
  rim.position.copy(at).addScaledVector(dir, .35).addScaledVector(up, .25);
  S.reveal = { t, spin: 0, at };
  anim(.4, (k) => { hero.intensity = 3 * k; rim.intensity = 1 * k; });
  const gold = !!t.userData.golden;
  machine.flash(1); sfx.fanfare(); voice(gold ? 'wow' : ['you_got_it', 'wow', 'yes_great'][S.won.length % 3], { priority: 2 });
  import('../engine/celebrate.js').then((m) => { m.confetti(scene, camera); if (gold) { m.fireworks(scene, camera, 5); timers.after(.6, () => m.confetti(scene, camera)); } });
  if (gold) { sfx.magic(); timers.after(.8, () => voice('you_got_it', { priority: 2 })); store.set('clawGolden', store.get('clawGolden', 0) + 1); }
  banner(`<span class="em">${t.userData.toy.emoji}</span><span>${gold ? 'Golden!' : 'You got it!'}</span>`, gold ? 'good gold' : 'good', gold ? 3 : 2.4);
  await anim(1.0, (k) => { const e = ease.inOut(k); t.position.lerpVectors(from, at, e); t.position.z += Math.sin(k * Math.PI) * .1; t.scale.setScalar(lerp(s0, 1, ease.out(k))); });
  await Promise.race([sleep(2.1), new Promise((r) => (S.skipReveal = r))]); S.skipReveal = null;
  // fly to the prize counter in the corner
  const corner = new THREE.Vector3(.86, .78, .5).unproject(camera), p0 = t.position.clone();
  sfx.collect(S.won.length - 1);
  await anim(.55, (k) => { t.position.lerpVectors(p0, corner, k); t.scale.setScalar(1 - .85 * k); hero.intensity = 3 * (1 - k); rim.intensity = 1 - k; }, ease.in);
  t.visible = false; t.scale.setScalar(1); S.reveal = null; $('#prizebox').classList.remove('bump'); void $('#prizebox').offsetWidth; $('#prizebox').classList.add('bump');
  S.state = 'try';
}

// ---------------------------------------------------------------- the end: every toy you won, lined up on the counter
async function gameOver() {
  S.state = 'over'; controls(false); motor(0); setHud();
  await sleep(.6);
  S.won.sort((a, b) => (a.userData.owner === b.userData.owner ? 0 : a.userData.owner === 'adalyn' ? -1 : 1));     // (taking turns: Adalyn's on the left, Esmae's on the right)
  const n = S.won.length, top = machine.counter.position.y + .02, cx = machine.counter.position.x, cz = machine.counter.position.z;
  const perRow = n > 5 ? Math.ceil(n / 2) : n;
  S.won.forEach((t, i) => {
    const row = n > 5 ? (i < perRow ? 0 : 1) : 0, inRow = row ? n - perRow : perRow, j = row ? i - perRow : i;
    t.quaternion.setFromEuler(new THREE.Euler(0, (Math.random() - .5) * .6, 0)); t.scale.setScalar(.001); t.visible = true; t.position.set(0, 0, 0); t.updateMatrixWorld(true);
    t.scale.setScalar(1); const box = new THREE.Box3().setFromObject(t); t.scale.setScalar(.001);
    const sp = Math.min(.125, .56 / Math.max(1, inRow));
    t.position.set(cx + (j - (inRow - 1) / 2) * sp, top - box.min.y, cz + (n > 5 ? (row ? .07 : -.07) : 0));
    t.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  });
  machine.counterLight.intensity = 0; S.endView = 0;
  await anim(1.6, (k) => { S.endView = k; machine.counterLight.intensity = 6 * k; });
  if (!n) { say('Oops! Next time!', 'narrator'); await sleep(1.2); }
  else {
    await voice('lets_count', { priority: 2 });
    for (let i = 0; i < n; i++) {
      const t = S.won[i]; sfx.collect(i);
      anim(.45, (k) => t.scale.setScalar(Math.max(.001, ease.outBack(k))));
      await voice(`n_${i + 1}`, { priority: 2, minMs: 520 });
    }
  }
  for (const w of ['adalyn', 'esmae']) keepToys(w, S.won.filter((t) => t.userData.owner === w));
  const key = `clawBest:${S.who}:${S.theme}:${S.level}`, best = store.get(key, 0);
  if (best && n > best) await voice(n === best + 1 ? 'one_more_than_last' : 'new_best', { priority: 2 });
  if (n > best) store.set(key, n);
  else if (n) await voice('well_done', { priority: 2 });
  // then home they go: over to each winner's shelf, where the new toys pop into place
  for (const w of ['adalyn', 'esmae']) {
    const k = S.won.filter((t) => t.userData.owner === w).length; if (!k) continue;
    S.endView = 0; await openShelf(w, { fresh: k, ui: false });
  }
  $('#final').textContent = n;
  const row = (list) => list.map((t) => `<span>${t.userData.toy.emoji}</span>`).join('');
  $('#over .toys').innerHTML = S.who === 'both' ? ['adalyn', 'esmae'].map((w) => `<div class="mine"><i class="initial ${w[0]}">${w[0].toUpperCase()}</i>${row(S.won.filter((t) => t.userData.owner === w)) || ''}</div>`).join('') : row(S.won) || '<span>\u{1F9F8}</span>';
  show('#hud', false); show('#over');
}
async function again(changeTheme) {
  sfx.pop(); show('#over', false);
  if (S.state === 'shelf') { clearShelf(); shelf.light.intensity = shelf.fill.intensity = 0; S.state = 'over'; }
  for (const t of S.won) { t.visible = false; forgetToy(t); scene.remove(t); t.traverse((o) => o.geometry?.dispose()); }
  S.won = []; S.results = [];
  await anim(1.1, (k) => { S.endView = 1 - k; machine.counterLight.intensity = 6 * (1 - k); });
  if (changeTheme) { S.state = 'title'; showTitle(changeTheme === 'shelf' ? 'theme' : 'who'); if (changeTheme === 'shelf') openShelf(); return; }
  start();
}

// ---------------------------------------------------------------- input: an on-screen joystick, the big button, keys
const stickEl = $('#stick'), knob = stickEl.querySelector('.knob');
let stickId = null;
function stickMove(e) {
  const r = stickEl.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, R = r.width * .38;
  let dx = (e.clientX - cx) / R, dy = (e.clientY - cy) / R; const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; }
  S.stick.x = dx; S.stick.z = dy; knob.style.transform = `translate(${dx * R}px, ${dy * R}px)`;
}
stickEl.addEventListener('pointerdown', (e) => { e.preventDefault(); unlock(); stickId = e.pointerId; try { stickEl.setPointerCapture(e.pointerId); } catch { /* ok */ } stickMove(e); });
stickEl.addEventListener('pointermove', (e) => { if (e.pointerId === stickId) stickMove(e); });
const stickUp = (e) => { if (e.pointerId !== stickId) return; stickId = null; S.stick.x = S.stick.z = 0; knob.style.transform = ''; };
stickEl.addEventListener('pointerup', stickUp); stickEl.addEventListener('pointercancel', stickUp); stickEl.addEventListener('lostpointercapture', stickUp);
const pressDrop = () => { if (S.state === 'aim' && S.dropNow) { sfx.pop(); S.dropNow(); } };
$('#drop').addEventListener('pointerdown', (e) => { e.preventDefault(); unlock(); pressDrop(); });
$('#peek').addEventListener('pointerdown', (e) => { e.preventDefault(); unlock(); if (S.state !== 'aim') return; sfx.swoosh(); setPeek(!S.peek); });
const KEYS = { ArrowLeft: ['x', -1], ArrowRight: ['x', 1], ArrowUp: ['z', -1], ArrowDown: ['z', 1], a: ['x', -1], d: ['x', 1], w: ['z', -1], s: ['z', 1] };
addEventListener('keydown', (e) => { const k = KEYS[e.key]; if (k) { S.keys[k[0]] = k[1]; e.preventDefault(); } if (e.key === ' ' || e.key === 'Enter') { pressDrop(); if (S.skipReveal) S.skipReveal(); } });
addEventListener('keyup', (e) => { const k = KEYS[e.key]; if (k && S.keys[k[0]] === k[1]) S.keys[k[0]] = 0; });
addEventListener('pointerdown', (e) => { if (S.skipReveal && !e.target.closest('#home')) S.skipReveal(); });
document.querySelectorAll('#pickTheme .choice').forEach((b) => b.addEventListener('click', () => chooseTheme(b.dataset.theme)));
document.querySelectorAll('#pickLevel .choice').forEach((b) => b.addEventListener('click', () => chooseLevel(b.dataset.level)));
$('#backTheme').addEventListener('click', () => { sfx.pop(); show('#pickLevel', false); show('#pickTheme'); });
document.querySelectorAll('#pickWho .choice').forEach((b) => b.addEventListener('click', () => chooseWho(b.dataset.who)));
$('#backWho').addEventListener('click', () => { sfx.pop(); showTitle('who'); });
$('#shelfBtn').addEventListener('click', () => openShelf());
document.querySelectorAll('#shelfWho button').forEach((b) => b.addEventListener('click', () => { if (S.shelfWho !== b.dataset.shelf) { sfx.pop(); openShelf(b.dataset.shelf); } }));
$('#shelfBack').addEventListener('click', closeShelf);
$('#overShelf').addEventListener('click', () => again('shelf'));
$('#again').addEventListener('click', () => again(false));
$('#change').addEventListener('click', () => again(true));

// ---------------------------------------------------------------- per frame
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _p = new THREE.Vector3(), _l = new THREE.Vector3(), _e = new THREE.Euler(), _hang = new THREE.Vector3(), _end1 = new THREE.Vector3(), _end2 = new THREE.Vector3();
let attract = { x: DIM.home.x, z: DIM.home.z, t: 0 };
function update(dt) {
  S.time += dt; const t = S.time, C = S.claw;
  timers.update(dt); fx.update(dt);
  // the claw: joystick while aiming, a lazy wander on the title screen
  const px = C.x, pz = C.z;
  if (S.state === 'aim') {
    // the gantry's motors spin up and brake (no instant starts), and knock against the end stops at the walls
    // response curve: a small push creeps (for lining up exactly), a full push runs; a little dead zone in the middle
    const rx = clamp(S.stick.x + S.keys.x, -1, 1), rz = clamp(S.stick.z + S.keys.z, -1, 1), rm = Math.hypot(rx, rz);
    const curve = rm < .1 ? 0 : Math.pow((Math.min(1, rm) - .1) / .9, 1.7) / Math.max(rm, 1e-3), ix = rx * curve, iz = rz * curve, sp = .3, acc = 1.5 * dt;
    C.mvx += clamp(ix * sp - C.mvx, -acc, acc); C.mvz += clamp(iz * sp - C.mvz, -acc, acc);
    C.x += C.mvx * dt; C.z += C.mvz * dt;
    const bx = clamp(C.x, DIM.bounds.x0, DIM.bounds.x1), bz = clamp(C.z, DIM.bounds.z0, DIM.bounds.z1);
    if ((bx !== C.x && Math.abs(C.mvx) > .12) || (bz !== C.z && Math.abs(C.mvz) > .12)) sfx.clunk();
    if (bx !== C.x) C.mvx = 0; if (bz !== C.z) C.mvz = 0; C.x = bx; C.z = bz;
    const m = Math.hypot(C.mvx, C.mvz) / sp;
    motor(m > .03 ? Math.min(1, m) : 0, .8 + m * .3); S.moved += Math.hypot(C.x - px, C.z - pz);
    if (S.moved > .05 && !S.hinted) { $('#stick').classList.remove('hint'); $('#drop').classList.add('hint'); }
    machine.setStick(rx, rz);
  } else if (S.state === 'title') {
    attract.t -= dt; if (attract.t <= 0) { attract = { x: lerp(DIM.bounds.x0, DIM.bounds.x1, Math.random()), z: lerp(DIM.bounds.z0, DIM.bounds.z1, Math.random()), t: 2.5 + Math.random() * 2 }; }
    C.x += (attract.x - C.x) * (1 - Math.exp(-.8 * dt)); C.z += (attract.z - C.z) * (1 - Math.exp(-.8 * dt));
    machine.setStick(0, 0);
  } else machine.setStick(0, 0);
  if (S.state !== 'aim') C.mvx = C.mvz = 0;
  C.vx = (C.x - px) / Math.max(dt, 1e-4); C.vz = (C.z - pz) / Math.max(dt, 1e-4);
  swingClaw(dt);
  C.bob *= Math.exp(-5 * dt);
  machine.setClaw(C.x, C.y - .007 * Math.sin(S.time * 26) * C.bob, C.z, C.sw.x, C.sw.z);
  if (S.state === 'aim') { const h = phys.probe(C.x, C.z, C.y - .02); _p.set(C.x, h.y, C.z); machine.setLaser(_p, t); } else machine.setLaser(null);   // (where the claw will come down: under the carriage)
  if (C.angle != null) machine.setProngAngle(C.angle); else machine.setOpen(C.open);
  // physics, then the toy in the claw's grip (it settles into a hanging pose, swings a little, slides when the grip gives)
  phys.step(dt); phys.sync(); keepInside(false, dt);
  const H = S.held;
  if (H) {
    H.k = Math.min(1, H.k + dt * 1.6); const e = ease.inOut(H.k);
    _p.copy(H.off0).lerp(_hang.set(0, -(.07 * CLAW.s + H.toy.userData.toy.radius * .42) - H.slide, 0), e);
    H.swing = (H.swing || 0) * Math.exp(-2.5 * dt) + clamp(C.vx, -1, 1) * dt * 2.2; H.swingZ = (H.swingZ || 0) * Math.exp(-2.5 * dt) + clamp(C.vz, -1, 1) * dt * 2.2;
    H.sq = Math.min(1, (H.sq || 0) + dt * 5); const sq = Math.sin(Math.min(1, H.sq) * Math.PI / 2) * (1 - .4 * Math.min(1, H.k));   // squeezed by the prongs, easing a little once it hangs
    H.toy.scale.set(1 - .08 * sq, 1 + .06 * sq, 1 - .08 * sq);
    const hp = machine.clawPos; H.toy.position.set(hp.x + _p.x - H.swing * .05, hp.y + _p.y, hp.z + _p.z - H.swingZ * .05);
    _q.slerpQuaternions(H.q0, H.up, e * .85); H.toy.quaternion.copy(_q).premultiply(_q2.setFromEuler(_e.set(-H.swingZ * .6, 0, H.swing * .6)));
  }
  twinkle(t);
  if (S.reveal) { const R = S.reveal; R.spin += dt; R.t.quaternion.setFromEuler(_e.set(.12 + Math.sin(t * 1.3) * .05, Math.sin(R.spin * 1.1) * .9, Math.sin(t * .9) * .05)); }
  machine.lights(t, S.state === 'reveal' ? 'win' : ['title', 'boot', 'over'].includes(S.state) ? 'attract' : 'play');
  grade.uniforms.time.value = t;
  placeCamera(dt);
}
/** the claw hangs on its cable: a damped pendulum pushed by the carriage's acceleration (two small steps a frame for stability) */
function swingClaw(dt) {
  const C = S.claw, W = C.sw, L = Math.max(.08, .865 - (C.y + CLAW.cap)) + .04, h = dt / 2;
  const ax = clamp((C.vx - C.pvx) / Math.max(dt, 1e-3), -5, 5) * .55, az = clamp((C.vz - C.pvz) / Math.max(dt, 1e-3), -5, 5) * .55; C.pvx = C.vx; C.pvz = C.vz;
  for (let i = 0; i < 2; i++) {
    W.vx += (-(9.8 / L) * Math.sin(W.x) - ax / L * Math.cos(W.x) - 4 * W.vx) * h; W.x = clamp(W.x + W.vx * h, -.35, .35);
    W.vz += (-(9.8 / L) * Math.sin(W.z) - az / L * Math.cos(W.z) - 4 * W.vz) * h; W.z = clamp(W.z + W.vz * h, -.35, .35);
  }
}
/** the camera: in front of the glass, drifting a little like a hand-held shot, leaning toward the claw, and over to the counter at the end */
function placeCamera(dt) {
  const C = S.claw, t = S.time, k = 1 - Math.exp(-2.2 * dt);
  const aiming = ['aim', 'try', 'reveal'].includes(S.state), dropping = S.state === 'try' && C.y < DIM.top - .02;
  S.cam.push += ((dropping ? 1 : 0) - S.cam.push) * (1 - Math.exp(-1.5 * dt));
  const wideWant = ['boot', 'title', 'starting'].includes(S.state) ? 1 : 0;                 // the title shows the whole machine, marquee and all
  S.cam.wide = S.cam.wide == null ? wideWant : S.cam.wide + (wideWant - S.cam.wide) * (1 - Math.exp(-1.6 * dt));
  const wd = ease.inOut(clamp(S.cam.wide, 0, 1));
  const lx = aiming ? C.x * .35 : 0, ly = lerp(.36, Math.max(.2, C.y - .25), S.cam.push * .5);
  _p.set(lx * .45 + Math.sin(t * .31) * .012, .88 + Math.sin(t * .23) * .008 - S.cam.push * .05, 1.62 + .42 - S.cam.push * .16);
  _l.set(lx, ly, lerp(0, C.z, S.cam.push * .5));
  _p.y += wd * .2; _p.z += wd * .62; _l.y += wd * .2;
  // the tiptoe view: up high, looking down through the front glass, so how far back the claw is shows plainly
  S.cam.peek = (S.cam.peek || 0) + (((S.peek && ['aim', 'try'].includes(S.state)) ? 1 : 0) - (S.cam.peek || 0)) * (1 - Math.exp(-2.6 * dt));
  if (S.cam.peek > .001) {
    const e = ease.inOut(clamp(S.cam.peek, 0, 1)), lx2 = C.x * .55, lz2 = C.z * .55;
    _p.lerp(_end1.set(lx2 * .8, 1.14, 1.12), e); _l.lerp(_end2.set(lx2, .4, lz2 - .05), e);
  }
  S.cam.door = (S.cam.door || 0) + ((S.cam.doorWant ? 1 : 0) - (S.cam.door || 0)) * (1 - Math.exp(-3 * dt));
  S.cam.goalP.copy(_p); S.cam.goalL.copy(_l);                                               // where the camera wants to be in play (the reveal aims from here)
  if (S.cam.door > .001) {
    const e = ease.inOut(clamp(S.cam.door, 0, 1)), d = machine.door.at;
    _p.lerp(_end1.set(d.x + .1, d.y + .26, d.z + .62), e); _l.lerp(_end2.set(d.x + .02, d.y - .01, d.z + .06), e);
  }
  S.cam.shelf = (S.cam.shelf || 0) + ((S.state === 'shelf' ? 1 : 0) - (S.cam.shelf || 0)) * (1 - Math.exp(-2.4 * dt));
  if (S.cam.shelf > .001 && shelf) { const e = ease.inOut(clamp(S.cam.shelf, 0, 1)); _p.lerp(shelf.view.p, e); _l.lerp(shelf.view.l, e); }
  if (S.endView > 0) {
    const e = ease.inOut(S.endView), cp = machine.counter.position;
    _p.lerp(_end1.set(cp.x - .06, cp.y + .52, cp.z + 1.12), e); _l.lerp(_end2.set(cp.x, cp.y - .03, cp.z), e);
  }
  if (S.cam.shake) { S.cam.shake = Math.max(0, S.cam.shake - dt * 2.5); _p.y += (Math.random() - .5) * .004 * S.cam.shake; }
  if (!S.cam.init || dt >= 1) { camera.position.copy(_p); S.cam.look = _l.clone(); S.cam.init = true; }
  else { camera.position.lerp(_p, k); S.cam.look.lerp(_l, k); }
  camera.lookAt(S.cam.look);
  const fov = view.fov * (1 - .1 * S.cam.push) * (S.endView > 0 ? lerp(1, .9, S.endView) : 1);
  if (Math.abs(camera.fov - fov) > .01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  const focusAt = S.cam.shelf > .5 ? shelf.view.l : S.cam.door > .3 ? machine.door.at : S.reveal ? S.reveal.t.position : S.endView > .5 ? machine.counter.position : machine.laser.visible ? machine.laser.position : machine.claw.position;
  bokeh.uniforms.focus.value = lerp(bokeh.uniforms.focus.value, camera.position.distanceTo(focusAt), 1 - Math.exp(-6 * Math.min(dt, .1)));
}

// ---------------------------------------------------------------- the claw cam: a camera under the claw, drawn into the little frame after the main picture
const clawCam = new THREE.PerspectiveCamera(58, 4 / 3, .01, 3), camEl = $('#clawcam');
function renderClawCam() {
  const on = ['aim', 'try'].includes(S.state) && Q.name !== 'low' && S.cam.peek < .5; camEl.classList.toggle('hidden', !on); if (!on) return;
  const r = camEl.getBoundingClientRect(); if (r.width < 10) return;
  const hp = machine.clawPos; clawCam.position.set(hp.x, hp.y - .03, hp.z); clawCam.up.set(0, 0, -1); clawCam.lookAt(hp.x, hp.y - 1, hp.z + .0001);
  clawCam.aspect = r.width / r.height; clawCam.updateProjectionMatrix();
  const au = renderer.shadowMap.autoUpdate; renderer.shadowMap.autoUpdate = false;                       // (the shadows were just drawn for the main picture)
  renderer.setRenderTarget(null); renderer.setScissorTest(true);
  renderer.setViewport(r.left, innerHeight - r.bottom, r.width, r.height); renderer.setScissor(r.left, innerHeight - r.bottom, r.width, r.height);
  const ex = renderer.toneMappingExposure; renderer.toneMappingExposure = ex * .62; furShown(false); renderer.render(scene, clawCam); furShown(true); renderer.toneMappingExposure = ex;
  renderer.setScissorTest(false); renderer.setViewport(0, 0, innerWidth, innerHeight); renderer.shadowMap.autoUpdate = au;
}
pipe.start((dt, raw) => { if (!machine || !phys) return false; update(dt); pipe.render(raw); renderClawCam(); return false; });
window.claw = { S, scene, openShelf, keepToys, THREE, renderClawCam: () => renderClawCam(), camera, renderer, pipe, get machine() { return machine; }, get phys() { return phys; }, step: (dt = 1 / 60) => update(dt), chooseTheme, chooseLevel, pressDrop, passes: { gtao, bokeh, grade }, Q, kinds: { unicorn, mermaid, star, heart, rainbow, starfish, shell, fish, bunny, kitty, seahorse, octopus } };
boot().catch((e) => { console.error(e); loading.fail(); });
