// The board-game engine Uni's and Esmae's adventures share. A turn: tap the deck, a colour card flips over, the hero travels
// to the next square of that colour, meeting friends on the way; a shortcut square jumps ahead; some squares are treat stops;
// the end of the path is each game's finale. Friends who have joined can be visited in their houses from the top bar.
// A game supplies its world, its cast and a few hooks (createBoardGame(cfg), then G.start()); turns, travel, the parade of
// friends, the camera, idle hints, taps, the houses and restarting live here once.
import * as THREE from 'three';
import { loading } from '../engine/loading.js';
import { homeGate } from '../engine/gate.js';
import { createPipeline } from '../engine/pipeline.js';
import { Q } from '../engine/quality.js';
import '../engine/quiz.css';
import { Timers, Fx, ease, lerp, clamp, rand, linearizeFrag, emojiSprite, RAINBOW } from '../util.js';
import { unlock, playMusic, say, sayAsync, voice, sfx, stopSpeech, level, currentSpeaker } from '../audio.js';
import { storyId } from '../engine/lines.js';
import { fovPunch } from '../engine/quiz.js';
import { earn } from '../engine/sticker.js';
import { renderShow } from '../learn/frame.js';
import { levelOf, startSession, kid } from '../learn/profile.js';
import { taughtThrough, trickyThrough, unitForLevel } from '../learn/code.js';
import { COLORS, N } from './path.js';

const $ = (s) => document.querySelector(s);
export const fovFor = (aspect) => clamp(THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(76 / 2)) / aspect)), 42, 82);

/** a colour word's first sound, when it is one the child has been taught (orange starts with "or", which CKLA teaches later) */
const FIRST = { red: 'r', purple: 'p', yellow: 'y', blue: 'b', green: 'g' };
/** the overlay both games show over the 3D view: speech bubble, deck, two cards to pick from, drawn card, house panel, banner */
function mountUI({ deckIcon, banner }) {
  $('#ui').insertAdjacentHTML('beforeend', `
    <div id="bubble" class="hidden"><div class="emoji"></div><div class="caption"></div></div>
    <div id="chip" class="hidden"></div>
    <button id="deck" class="hidden" aria-label="Draw a card"><span class="d-card c3"></span><span class="d-card c2"></span><span class="d-card c1"><i>${deckIcon}</i><b>Draw!</b></span></button>
    <div id="pick" class="hidden"><button class="pc" type="button" aria-label="This card"><span><i>${deckIcon}</i></span></button><button class="pc" type="button" aria-label="This card"><span><i>${deckIcon}</i></span></button></div>
    <div id="card" class="hidden"><div class="card-face"></div></div>
    <div id="mini" class="hidden"><div class="mt"></div><div class="mp"></div><div class="mf"></div></div>
    <button id="leave" class="hidden">&#8592; Back to the adventure</button>
    <div id="hint" class="hidden">&#128070;</div>
    <div id="banner" class="hidden"><span class="confetti l">&#127881;</span><div class="b-text">${banner}</div><span class="confetti r">&#127881;</span></div>
    <button id="again" class="hidden"><span>&#8635;</span> Play again</button>`);
}

/**
 * cfg: hero { name, voice, emoji }, friends [{ name, emoji, css }] + twin { name, emoji, css } (the top bar), deckIcon, banner,
 * music, debugName, reader (whose learning profile: 'adalyn' | 'esmae'), pipeline (createPipeline options), shadows (false: none), lift (hero height above the path line), walk (keep feet on the ground),
 * intro [emoji, line, seconds], slide [emoji, line] (shortcut bubble), pickupColors, joinColors, sparkle { gravity, life },
 * tapUp, party { center(), r, y: [lo, hi], colors }, leg { perStep, min }, meet { side, ahead, dur, hop, up: [friend, hero] },
 * parade { side, bob }, cam { back, side, up, ahead, lookUp, ride, bob, floor, greet { back, side, up, lookUp } },
 * houses { keys, info, create, lockedTwin, sticker } (optional), scoreFrame (an icon: show the score as a ten-frame of it), build(G).
 * hooks: ready, trail(p, t), wake(p), stop(i), ride(sc), onFriend(f) (after the hello, before joining: the learning moment),
 *        finale, cheer, reset, resetTwin, update(dt, t), onScore(total, added, before), onTap(hit), tapWorld(ray),
 *        camera(mode, desired, look, t) -> true when the game framed the shot itself, puff(p, n).
 */
export function createBoardGame(cfg) {
  const HERO = cfg.hero, hooks = cfg.hooks || {}, LIFT = cfg.lift ?? 0.82;
  const L = { perStep: .3, min: .6, ...cfg.leg }, M = { side: 3.7, ahead: 1.1, dur: 1.4, hop: .5, up: [2.4, 3], ...cfg.meet };
  const PA = { side: 1.5, bob: 0, ...cfg.parade }, SP = { gravity: -2, life: 1.3, ...cfg.sparkle };
  const C = { back: 13.5, side: 1.2, up: 9, ahead: 5, lookUp: 2.2, ride: 7, bob: 0, floor: 3, ...cfg.cam };
  C.greet = { back: 3.5, side: 7, up: 5, lookUp: 2.2, ...(cfg.cam && cfg.cam.greet) };
  homeGate(); mountUI(cfg);

  // ---------------------------------------------------------------- renderer, scene, camera
  const S = { mode: 'boot', idx: 0, u: 0, speed: 0, stars: 0, time: 0, followers: [], dirS: new THREE.Vector3(0, 0, -1), hint: 0, waiting: false, housesDone: new Set() };
  const canvas = $('#c'), gfx = createPipeline(canvas, cfg.pipeline);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(55, 1, 0.1, 1800), camTarget = new THREE.Vector3();
  gfx.onResize = (a) => { camera.aspect = a; camera.fov = fovFor(a); camera.updateProjectionMatrix(); if (S.house) S.house.resize(a); };
  gfx.applyTier();
  ['gesturestart', 'dblclick', 'contextmenu'].forEach((ev) => document.addEventListener(ev, (e) => e.preventDefault()));

  const timers = new Timers(), fx = new Fx(scene, 900);
  const sleep = (s) => new Promise((r) => timers.after(s, r));
  const anim = (dur, fn, e = ease.inOut) => new Promise((r) => timers.tween(dur, fn, { ease: e, done: r }));
  const ui = {
    /** resolves when the caption has been said (opts: priority, minMs) */
    bubble(emoji, caption = '', who = HERO.voice, speak = true, opts = {}) {
      const said = caption && speak ? sayAsync(caption, who, opts) : Promise.resolve(true);
      const b = $('#bubble'); b.classList.remove('hidden'); b.firstElementChild.textContent = emoji; b.lastElementChild.textContent = caption;
      b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
      return said;
    },
    hideBubble() { $('#bubble').classList.add('hidden'); },
    /** the score: a number, or (cfg.scoreFrame) a ten-frame of icons plus one token per full frame of ten */
    score(n) {
      $('#starcount').textContent = n;
      if (!cfg.scoreFrame) return;
      const box = $('#stars'), T = box.querySelector('.tens'), tens = Math.floor(n / 10), ones = n % 10;
      while (T.children.length < tens) T.appendChild(document.createElement('i'));
      while (T.children.length > tens) T.lastChild.remove();
      let k = 0;
      box.querySelectorAll('.sf i').forEach((c, i) => { const on = i < ones; if (on && !c.classList.contains('on')) c.style.animationDelay = `${k++ * 90}ms`; c.classList.toggle('on', on); });
    },
    show(sel, on = true) { $(sel).classList.toggle('hidden', !on); },
  };
  const G = { cfg, S, gfx, renderer: gfx.renderer, scene, camera, camTarget, timers, fx, sleep, anim, ui, W: null, hero: null, friends: [], twin: null, taps: [], talkers: [] };

  // ---------------------------------------------------------------- helpers the games use too
  const _p = new THREE.Vector3(), _t = new THREE.Vector3(), _q = new THREE.Vector3(), _r = new THREE.Vector3(), _s = new THREE.Vector3(), _d = new THREE.Vector3(), _l = new THREE.Vector3(), _m = new THREE.Vector3();
  /** a point / direction along the path (pass a vector to fill; the frame loop reuses scratch vectors) */
  const pathPos = (u, out = new THREE.Vector3()) => { G.W.curve.getPointAt(clamp(u, 0, 1), out); out.y += LIFT; return out; };
  const pathTan = (u, out = new THREE.Vector3()) => G.W.curve.getTangentAt(clamp(u, 0, 1), out);
  const side = (t, out = new THREE.Vector3()) => out.set(t.z, 0, -t.x).normalize();
  const above = (c, h) => c.root.position.clone().add(_r.set(0, h, 0));
  const sparkleAt = (p, colors, count = 30, speed = 5) => fx.burst(p, { count, colors, speed, gravity: SP.gravity, life: SP.life, size: 1 });
  const puff = (p, n) => hooks.puff && hooks.puff(p, n);
  /** a hop with the twelve principles: a quick dip first, a stretch on the way up, a squash when she lands */
  const hop = (c, dur = M.hop, h = 1.3) => {
    const body = c.body || c.pitch;
    return anim(dur + .1, (k) => {
      const t = k * (dur + .1), dip = t < .1, u = dip ? 0 : (t - .1) / dur;
      c.lift = dip ? -Math.sin(t / .1 * Math.PI) * .12 : Math.sin(u * Math.PI) * h;
      if (body) { const sq = dip ? -Math.sin(t / .1 * Math.PI) * .12 : u < .5 ? Math.sin(u * 2 * Math.PI) * .1 : u > .85 ? -Math.sin((u - .85) / .15 * Math.PI) * .14 : 0; body.scale.set(1 - sq * .5, 1 + sq, 1 - sq * .5); }
    }, ease.linear).then(() => { if (body) body.scale.set(1, 1, 1); c.lift = 0; });
  };
  /** move an object from a to b (k = 0..1); walkers never sink into the hills */
  const glide = (o, a, b, k) => { o.position.lerpVectors(a, b, k); if (cfg.walk) o.position.y = Math.max(o.position.y, G.W.heightAt(o.position.x, o.position.z)); };
  const face = (c, p) => c.lookToward(p.x - c.root.position.x, p.z - c.root.position.z, 1);
  const markMet = (i) => { const b = document.querySelectorAll('.fr')[i]; if (b) b.classList.add('met'); };
  function placeHero(u) { const p = pathPos(u), t = pathTan(u); G.hero.root.position.copy(p); G.hero.root.rotation.set(0, Math.atan2(t.x, t.z), 0); S.u = u; }
  function addStars(n) {
    const before = S.stars; S.stars += n; ui.score(S.stars); $('#stars').animate([{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }], 300);
    if (hooks.onScore) hooks.onScore(S.stars, n, before);
  }
  /** the sun follows the hero so the shadow map covers what the camera sees */
  function addSun(color, intensity, pos, half) {
    const sun = new THREE.DirectionalLight(color, intensity); sun.position.set(...pos); scene.add(sun, sun.target);
    sun.castShadow = cfg.shadows !== false; const sc = sun.shadow.camera; sc.left = sc.bottom = -half; sc.right = sc.top = half; sc.near = 1; sc.far = 160; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.05; sun.shadow.radius = 3;
    S.sun = sun; S.sunOff = sun.position.clone(); return sun;
  }
  /** the world's sky/water shaders write sRGB colours; the pipeline wants linear ones */
  const linearize = () => scene.traverse((o) => { const m = o.material; if (m && m.isShaderMaterial && !m.userData.lin) { m.fragmentShader = linearizeFrag(m.fragmentShader); m.userData.lin = true; m.needsUpdate = true; } });
  Object.assign(G, { pathPos, pathTan, side, above, sparkleAt, puff, hop, glide, face, markMet, placeHero, addStars, addSun, linearize, meetFriend, ride, visit, leave });

  // ---------------------------------------------------------------- cards and turns
  const sq = (c, cls = '') => `<div class="sq ${cls}" style="background:${c.css}"></div>`;
  const unit = () => unitForLevel(cfg.reader ? levelOf(cfg.reader, 'reading') : 0);
  const cname = (card, cls = 'cname') => {
    const w = card.c.name, tricky = !!cfg.reader && trickyThrough(unit()).includes(w);       // blue, yellow: CKLA Unit 5 Tricky Words
    return `<div class="${cls}${tricky ? ' readable lit' : ''}" style="color:${card.c.css}">${card.double ? 'Double ' : ''}${w}</div>`;
  };
  /** "rrr... red!": at reading level 1+ the card says its first sound before the word (only sounds her unit has taught) */
  function cardLine(card) {
    const c = card.c.name, line = storyId('counter', `${card.double ? 'Double ' : ''}${c}!`), s = FIRST[c];
    const lvl = cfg.reader ? levelOf(cfg.reader, 'reading') : 0;
    const ids = !card.double && lvl >= 1 && s && taughtThrough(unit()).includes(s) ? [`snd_${s}`, line] : [line];
    return voice(ids, { priority: 2, gap: .3, fallback: `${card.double ? 'Double ' : ''}${c}!` });
  }
  function drawCard() {
    if (S.forceCard) { const c = S.forceCard; S.forceCard = null; return c; }
    return { c: COLORS[Math.floor(Math.random() * 6)], double: Math.random() < 0.25 };
  }
  /** the next square of the card's colour (the second one for a double); the castle/palace if there is none left */
  function targetFor(card, from) {
    const hits = []; for (let j = from + 1; j < N - 1; j++) if (G.W.tiles[j].color === card.c) hits.push(j);
    if (!hits.length) return N - 1;
    return card.double ? (hits[1] ?? N - 1) : hits[0];
  }
  function waitDraw() {
    return new Promise((res) => {
      S.hint = 0; S.waiting = true;
      const b = $('#deck'); b.classList.remove('hidden');
      b.onclick = () => { b.classList.add('hidden'); ui.show('#hint', false); S.waiting = false; res(); };
    });
  }
  /** two face-down cards: she chooses one (the outcome is just as random, but now it is HER card) */
  function pickCard() {
    return new Promise((res) => {
      const el = $('#pick'), cards = el.querySelectorAll('.pc');
      cards.forEach((b) => b.classList.remove('chosen', 'gone'));
      el.classList.remove('hidden'); S.picking = true; S.hint = 0;
      voice('pick_a_card', { priority: 1 });
      el.onclick = (e) => {
        const b = e.target.closest('.pc'); if (!b || !S.picking) return;
        S.picking = false; ui.show('#hint', false); sfx.pop();
        cards.forEach((x) => x.classList.add(x === b ? 'chosen' : 'gone'));
        sleep(.28).then(() => { el.classList.add('hidden'); res(); });
      };
    });
  }
  async function takeTurn() {
    await waitDraw();
    sfx.pop();
    await pickCard();
    const card = S.card = drawCard();
    const faceEl = $('.card-face'); faceEl.innerHTML = (card.double ? sq(card.c) + sq(card.c) : sq(card.c)) + cname(card);
    ui.show('#card'); faceEl.style.animation = 'none'; void faceEl.offsetWidth; faceEl.style.animation = '';
    sfx.chime();
    await Promise.all([cardLine(card), sleep(cfg.cardTime || 1.7)]);           // the card stays up until it has been said
    ui.show('#card', false);
    $('#chip').innerHTML = (card.double ? sq(card.c, 'sm') + sq(card.c, 'sm') : sq(card.c, 'sm')) + cname(card, 'cn'); ui.show('#chip');
    await runTo(targetFor(card, S.idx));
    ui.show('#chip', false);
    await resolveTile();
  }
  async function play() {
    S.mode = 'follow'; ui.show('#title', false); ui.show('#hud');
    const last = cfg.reader ? kid(cfg.reader).lastPlayed : 0;
    if (cfg.reader) startSession(cfg.reader);
    if (last && Date.now() - last > 3 * 864e5) { await ui.bubble(`${HERO.emoji} \u{1F496}`, 'Welcome back! I missed you!', HERO.voice, true, { priority: 2 }); await sleep(.3); }   // three days away
    const [emoji, line, secs] = cfg.intro;
    ui.bubble(emoji, line); sfx.chime(); await sleep(secs); ui.hideBubble();
    if (S.surprise && S.surprise.fresh) { S.surprise.fresh = false; G.face(G.hero, S.surprise.obj.position); await ui.bubble(S.surprise.emoji + ' \u2728', 'Look! Something new today!', HERO.voice, true, { priority: 2 }); await sleep(.5); ui.hideBubble(); }
    while (S.idx < N - 1) await takeTurn();
    await finale();
  }

  // ---------------------------------------------------------------- travelling
  async function runLeg(i0, i1) {
    const u0 = i0 / (N - 1), u1 = i1 / (N - 1), dur = Math.max(L.min, (i1 - i0) * L.perStep);
    S.speed = 1.5;
    await anim(dur, (k) => {
      const u = lerp(u0, u1, k); S.u = u;
      const p = pathPos(u, _p), t = pathTan(u, _t); G.hero.root.position.copy(p); G.hero.lookToward(t.x, t.z, 0.25);
      collect(u);
      if (hooks.trail) hooks.trail(p, t);
    }, ease.inOut);
    S.speed = 0; S.idx = i1; sfx.hop();
  }
  /** travel to a square, stopping to meet any friend waiting on the way */
  async function runTo(target) {
    while (S.idx < target) {
      const nf = G.friends.filter((f) => !f.met && f.tile > S.idx && f.tile <= target).map((f) => f.tile)[0], next = nf ?? target;
      await runLeg(S.idx, next);
      if (nf != null) await meetFriend(G.friends.find((f) => f.tile === nf));
    }
  }
  function collect(u) {
    for (const s of G.W.pickups) {
      if (s.taken || u < s.tile / (N - 1) - 0.006) continue;
      s.taken = true; s.mesh.visible = false; addStars(1);
      sfx.collect(S.stars); sparkleAt(s.mesh.position.clone(), cfg.pickupColors, 14, 3);
    }
  }
  async function resolveTile(depth = 0) {
    if (S.idx >= N - 1 || depth > 3) return;
    const sc = G.W.shortcutAt(S.idx);
    if (sc) {
      ui.bubble(cfg.slide[0], cfg.slide[1]); sfx.magic(); await sleep(0.9);
      await hooks.ride(sc); ui.hideBubble();
      for (const f of G.friends.filter((f) => !f.met && f.tile < S.idx)) await meetFriend(f);   // friends the shortcut skipped come to say hi
      return resolveTile(depth + 1);
    }
    if (hooks.stop) await hooks.stop(S.idx);
  }
  /** ride a shortcut's arc; frame(point, tangent, k) poses the hero (and whatever carries her) */
  async function ride(sc, dur, frame) {
    S.speed = 1.2; S.riding = true;
    const u0 = sc.from / (N - 1), u1 = sc.to / (N - 1);
    await anim(dur, (k) => { frame(sc.arc.getPoint(k, _p), sc.arc.getTangent(k, _t), k); S.u = lerp(u0, u1, k); }, ease.inOut);
    S.riding = false; S.speed = 0; G.hero.root.rotation.x = 0; S.idx = sc.to; placeHero(sc.to / (N - 1)); sfx.tada();
  }

  // ---------------------------------------------------------------- friends
  async function meetFriend(f) {
    f.met = true; S.greeting = f; S.mode = 'greet';
    const hero = G.hero, t = pathTan(S.u), dest = hero.root.position.clone().add(side(t).multiplyScalar(f.side * M.side)).addScaledVector(t, M.ahead), a = f.u.root.position.clone();
    S.speed = 0; sfx.chime();
    f.u.lookToward(dest.x - a.x, dest.z - a.z, 1);
    await anim(M.dur, (k) => { glide(f.u.root, a, dest, k); f.speed = 1.4; f.u.lookToward(dest.x - a.x, dest.z - a.z, .3); }, ease.inOut);
    f.speed = 0;
    face(hero, f.u.root.position); face(f.u, hero.root.position);
    sparkleAt(above(f.u, M.up[0]), f.burst, 60, 6); sfx.sparkle(); puff(f.u.root.position.clone(), 12);
    const said = ui.bubble(`${f.emoji} ${HERO.emoji}`, f.line, f.voice, true, { priority: 2, minMs: 1800 });
    await hop(f.u); await hop(hero); await said; await sleep(.3);
    if (hooks.onFriend) await hooks.onFriend(f);
    sparkleAt(above(hero, M.up[1]), cfg.joinColors, 40, 5); sfx.magic(); addStars(3);
    markMet(f.i);
    await ui.bubble('\u{1F31F}', `${f.name} joins the adventure!`, HERO.voice, true, { priority: 2, minMs: 1500 }); await sleep(.4); ui.hideBubble();
    S.followers.push(f); S.mode = 'follow';
  }
  function resetCast() {
    G.friends.forEach((f) => { f.met = false; f.speed = 0; f.u.root.position.copy(f.spot); const p = G.W.tiles[f.tile].pos; f.u.root.rotation.set(0, Math.atan2(p.x - f.spot.x, p.z - f.spot.z), 0); });
    if (hooks.resetTwin) hooks.resetTwin();
  }
  /** met friends follow along behind the hero, alternating sides */
  function parade(dt, t) {
    S.followers.forEach((f, k) => {
      const u = Math.max(0, S.u - (k + 1) * 0.034), p = pathPos(u, _p), tn = pathTan(u, _t), pos = f.u.root.position;
      const target = _q.copy(p).addScaledVector(side(tn, _s), (k % 2 ? 1 : -1) * PA.side); target.y += Math.sin(t * 1.4 + k) * PA.bob;
      const prev = _r.copy(pos); pos.lerp(target, 1 - Math.exp(-5 * dt));
      const v = pos.distanceTo(prev) / Math.max(dt, 1e-3); f.speed = clamp(v / 4.5, 0, 1.5);
      if (v > 0.8) f.u.lookToward(pos.x - prev.x, pos.z - prev.z, 0.2); else f.u.lookToward(tn.x, tn.z, 0.05);
    });
  }

  // ---------------------------------------------------------------- the end, and again
  async function finale() {
    S.mode = 'greet'; S.greeting = G.twin;
    for (const f of G.friends.filter((f) => !f.met)) await meetFriend(f);
    S.mode = 'finale';
    await hooks.finale();
    ui.hideBubble(); ui.show('#banner'); ui.show('#again'); stopSpeech();
    if (hooks.cheer) hooks.cheer();
    S.celebrate = true; S.mode = 'finale';
    $('#again').onclick = () => { $('#fade').style.opacity = 1; setTimeout(restart, 520); };
  }
  function restart() {
    if (hooks.reset) hooks.reset();
    Object.assign(S, { celebrate: false, mode: 'follow', idx: 0, followers: [], stars: 0, speed: 0, greeting: null, twinMet: false, housesDone: new Set() });
    ui.score(0); G.hero.lift = 0;
    placeHero(0); resetCast(); G.W.pickups.forEach((s) => { s.taken = false; s.mesh.visible = true; });
    document.querySelectorAll('.fr').forEach((e) => e.classList.remove('met'));
    ui.show('#banner', false); ui.show('#again', false); ui.hideBubble(); timers.clear();
    $('#fade').style.opacity = 0;
    play();
  }

  // ---------------------------------------------------------------- friends' houses (mini-games), from the top bar
  function visit(i) {
    const H = cfg.houses;
    if (!H || S.house || !G.W || S.mode === 'boot' || S.mode === 'title') return;
    const f = i < G.friends.length ? G.friends[i] : null, met = f ? f.met : S.twinMet;
    if (!met) { ui.bubble('\u{1F512}', f ? `Meet ${f.name} on the path first!` : H.lockedTwin, HERO.voice); timers.after(2.6, () => ui.hideBubble()); return; }
    if (S.picking) { ui.bubble('\u{1F0CF}', 'Pick a card first!', HERO.voice); timers.after(2, () => ui.hideBubble()); return; }
    if (!(S.waiting || S.celebrate)) { ui.bubble('\u23F3', `Wait for ${HERO.name} to stop first!`, HERO.voice); timers.after(2, () => ui.hideBubble()); return; }
    const key = H.keys[i], info = H.info[key];
    S.houseWas = { deck: !$('#deck').classList.contains('hidden'), banner: !$('#banner').classList.contains('hidden'), again: !$('#again').classList.contains('hidden') };
    ['#deck', '#banner', '#again', '#hint', '#bubble', '#chip', '#card'].forEach((x) => ui.show(x, false));
    stopSpeech();
    $('#mini .mp').textContent = ''; const mf = $('#mini .mf'); mf.innerHTML = ''; delete mf.dataset.goal;
    S.house = H.create(key, {
      env: scene.environment, say, voice, sfx, who: cfg.reader, hero: HERO.voice, level: (strand) => levelOf(cfg.reader, strand),
      addStars: (n) => {
        if (S.housesDone.has(key)) return; S.housesDone.add(key); addStars(n);
        if (H.sticker && H.keys.every((k) => S.housesDone.has(k))) earn(cfg.reader, H.sticker);   // every house's game done
      },
      status: (txt) => { $('#mini .mp').textContent = txt; },
      count: showCount,
    });
    S.house.resize(innerWidth / innerHeight);
    $('#mini .mt').textContent = info.title; ui.show('#mini'); ui.show('#leave');
    say(`Welcome to ${info.title}! ${info.how}`, HERO.voice);
  }
  /** the house panel's ten-frame (a five-frame for goals up to 5): fill = how many, or which cells (array of booleans);
   *  colors = a colour per cell (a recipe); the voice says the new number */
  function showCount(fill, goal, { colors = null, speak = true } = {}) {
    const box = $('#mini .mf');
    if (+box.dataset.goal !== goal) { renderShow(box, { frame: goal <= 5 ? 5 : 10, dots: 0 }); box.classList.add('mf'); box.dataset.goal = goal; }
    const on = (i) => (Array.isArray(fill) ? !!fill[i] : i < fill), n = Array.isArray(fill) ? fill.filter(Boolean).length : fill;
    box.querySelectorAll('.cell').forEach((c, i) => {
      c.classList.toggle('off', i >= goal); c.classList.toggle('dot', on(i));
      if (colors && colors[i]) { c.style.borderColor = colors[i]; c.style.setProperty('--dot', colors[i]); } else { c.style.borderColor = ''; c.style.removeProperty('--dot'); }
    });
    if (speak && n > 0) voice(`n_${n}`, { priority: 1, tag: 'count' });
  }
  function leave() {
    if (!S.house) return;
    S.house.dispose(); S.house = null; stopSpeech(); ui.show('#mini', false); ui.show('#leave', false);
    const w = S.houseWas || {}; if (w.deck && S.waiting) ui.show('#deck'); if (w.banner) ui.show('#banner'); if (w.again) ui.show('#again');
  }
  $('#leave').addEventListener('click', leave);
  addEventListener('ae:tada', () => fovPunch(S.house ? S.house.camera : camera));

  // ---------------------------------------------------------------- per frame
  /** the usual shot: behind and above the hero, looking a little ahead (sd: sideways offset) */
  function followShot(desired, look, t, sd = C.side) {
    const up = G.hero.root.position, hi = S.riding ? C.ride : 0;
    desired.copy(up).addScaledVector(S.dirS, -C.back - hi * .6).addScaledVector(side(S.dirS, _s), sd); desired.y += C.up + hi + Math.sin(t * .5) * C.bob;
    look.copy(up).addScaledVector(S.dirS, C.ahead); look.y += C.lookUp;
  }
  G.followShot = followShot;
  /** if a collider (W.colliders: tree tops as spheres) sits between what we look at and the camera, bring the camera in front of it */
  function unblock(look, desired) {
    const cols = G.W.colliders; if (!cols) return;
    const dx = desired.x - look.x, dy = desired.y - look.y, dz = desired.z - look.z, len = Math.hypot(dx, dy, dz) || 1;
    let f = 1;
    for (const c of cols) {
      const ox = c.x - look.x, oy = c.y - look.y, oz = c.z - look.z, s = (ox * dx + oy * dy + oz * dz) / len;   // along the sight line
      if (s < 0 || s > len + c.r) continue;
      const d2 = ox * ox + oy * oy + oz * oz - s * s, r2 = (c.r + .6) * (c.r + .6);
      if (d2 < r2) f = Math.min(f, Math.max(.4, (s - Math.sqrt(r2 - d2)) / len));
    }
    if (f < 1) desired.set(look.x + dx * f, look.y + dy * f, look.z + dz * f);
  }
  function updateCamera(dt, t) {
    if (S.debugCam) { camera.position.copy(S.debugCam.p); camera.lookAt(S.debugCam.l); return; }
    const k = 1 - Math.exp(-3 * dt), desired = _d, look = _l;
    const tt = pathTan(clamp(S.u + 0.03, 0, 1), _t); tt.y = 0; tt.normalize();
    S.dirS.lerp(tt, 1 - Math.exp(-1.6 * dt)).normalize();
    if (hooks.camera && hooks.camera(S.mode, desired, look, t)) { /* the game framed this shot (title, finale) */ }
    else if (S.mode === 'greet' && S.greeting) {
      const g = (S.greeting.u || S.greeting).root.position, mid = _m.copy(G.hero.root.position).lerp(g, .5), gr = C.greet;
      desired.copy(mid).addScaledVector(S.dirS, -gr.back).addScaledVector(side(S.dirS, _s), (S.greeting.side || 1) * -gr.side); desired.y += gr.up;
      look.copy(mid); look.y += gr.lookUp;
    } else followShot(desired, look, t);
    desired.y = Math.max(desired.y, G.W.heightAt(desired.x, desired.z) + C.floor);
    unblock(look, desired);
    camera.position.lerp(desired, k); camTarget.lerp(look, 1 - Math.exp(-4 * dt)); camera.lookAt(camTarget);
  }
  function update(dt) {
    S.time += dt; const t = S.time;
    timers.update(dt); fx.update(dt); G.W.update(dt, t);
    G.hero.update(dt, t, S.speed);
    // whoever's voice is speaking moves her mouth (the hero, a friend, the twin, the King and Queen)
    const who = currentSpeaker(), lv = Math.min(1, level.v * 3);
    for (const c of G.talkers) c.talk = who && c.speaker === who ? lv : 0;
    G.friends.forEach((f) => f.u.update(dt, t, f.speed));
    if (G.twin) G.twin.update(dt, t, S.twinSpeed || 0);
    if (S.surprise) S.surprise.obj.position.y = S.surprise.y + Math.sin(t * 1.6) * .35;
    if (hooks.update) hooks.update(dt, t);
    parade(dt, t);
    if (S.speed > .4 && hooks.wake) hooks.wake(G.hero.root.position, dt);
    const P = cfg.party;
    if (S.celebrate && Math.random() < dt * 5) { const c = P.center(); sparkleAt(_q.set(c.x + rand(-P.r, P.r), c.y + rand(P.y[0], P.y[1]), c.z + rand(-P.r, P.r)), P.colors, 50, 7); if (Math.random() < .3) sfx.pop(); }
    if (S.sun) {
      const f = G.hero.root.position; S.sun.target.position.copy(f); S.sun.position.copy(f).add(S.sunOff);
      const want = Q.shadow > 0 && cfg.shadows !== false; if (S.sun.castShadow !== want) S.sun.castShadow = want;
      if (want && S.sun.shadow.mapSize.x !== Q.shadow) { S.sun.shadow.mapSize.set(Q.shadow, Q.shadow); S.sun.shadow.map && S.sun.shadow.map.dispose(); S.sun.shadow.map = null; }
    }
    // a bouncing finger over the deck (or the cards to pick from) if nobody taps for a while
    if (S.waiting || S.picking) {
      S.hint += dt;
      if (S.hint > (S.picking ? 6 : 9)) { const h = $('#hint'), d = $(S.picking ? '#pick .pc' : '#deck').getBoundingClientRect(); h.classList.remove('hidden'); h.style.left = (d.left + d.width / 2) + 'px'; h.style.top = (d.top - 70) + 'px'; }
    }
    updateCamera(dt, t);
  }

  // tapping a character makes it giggle, say its name and hop
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  canvas.addEventListener('pointerdown', (e) => {
    unlock();
    const r = canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    if (S.house) { S.house.pointer(ndc.clone()); return; }
    if (!G.W) return;
    ray.setFromCamera(ndc, camera);
    const hit = G.taps.find((a) => a.u.root.visible && ray.intersectObject(a.u.root, true).length);
    if (!hit) { if (hooks.tapWorld) hooks.tapWorld(ray); return; }
    if (hooks.onTap) hooks.onTap(hit);
    sfx.giggle(); say(hit.n + '!', HERO.voice, { priority: 0 }); sparkleAt(above(hit.u, cfg.tapUp ?? 2.6), RAINBOW.concat([0xffffff]), 36, 5); puff(hit.u.root.position.clone(), 10);
    hop(hit.u, .5);
  });

  // ---------------------------------------------------------------- boot
  async function boot() {
    await cfg.build(G);
    G.hero.root.rotation.order = 'YXZ'; placeHero(0); resetCast();
    G.taps = [{ u: G.hero, n: HERO.name }, ...G.friends.map((f) => ({ u: f.u, n: f.name })), ...G.taps];
    G.hero.speaker = HERO.voice; G.friends.forEach((f) => (f.u.speaker = f.voice));
    G.talkers = [G.hero, ...G.friends.map((f) => f.u), ...(G.twin ? [G.twin] : []), ...(G.talkers || [])];
    if (hooks.ready) hooks.ready();
    dailySurprise();
    if (cfg.scoreFrame) { const st = $('#stars'); st.classList.add('framed'); st.innerHTML = `<span class="tens"></span><span class="sf">${`<i>${cfg.scoreFrame}</i>`.repeat(10)}</span><span id="starcount" hidden>0</span>`; }
    const tag = cfg.houses ? 'button' : 'div';
    $('#friends').innerHTML = [...cfg.friends, cfg.twin].map((f, i) => `<${tag} class="fr" data-i="${i}" style="--c:${f.css}" title="${f.name}${cfg.houses ? "'s house" : ''}">${f.emoji}</${tag}>`).join('');
    if (cfg.houses) document.querySelectorAll('.fr').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); unlock(); visit(+b.dataset.i); }));
    loading.done();
    S.mode = 'title'; ui.show('#title');
  }
  /** one new thing in the world each day, beside the first squares; mentioned the first time it is seen that day */
  function dailySurprise() {
    const d = new Date(), m = d.getMonth(), day = d.getDate();
    const emoji = m === 9 ? '\u{1F383}' : m === 11 ? '\u26C4' : m === 1 && day === 14 ? '\u{1F49D}' : ['\u{1F388}', '\u{1F308}', '\u{1F98B}', '\u{1F381}', '\u{1F33B}', '\u{1FA81}', '\u{1F422}'][d.getDay()];
    const t = G.W.tiles[3], obj = emojiSprite(emoji, 4); obj.position.copy(t.pos).addScaledVector(side(t.tan), 6).add(_r.set(0, 2.6, 0)); scene.add(obj);
    let fresh = true; const key = `ae:surprise:${cfg.debugName}`;
    try { fresh = localStorage.getItem(key) !== d.toDateString(); localStorage.setItem(key, d.toDateString()); } catch { /* private mode */ }
    S.surprise = { obj, emoji, fresh, y: obj.position.y };
  }
  G.start = () => {
    gfx.start((dt) => {
      if (!G.W) return false;
      // (no bloom indoors: a bright little room is mostly above the bloom threshold and turned into pink-white haze)
      gfx.bloomPass.enabled = Q.bloom && !S.house;
      if (S.house) { S.house.update(dt); gfx.setScene(S.house.scene, S.house.camera); }
      else { update(dt); gfx.setScene(scene, camera); }
    });
    $('#play').addEventListener('click', () => { unlock(); playMusic(cfg.music); play(); });
    window[cfg.debugName] = {
      S, G, scene, camera, step: (dt = 1 / 60) => G.W && update(dt), visit, leave,
      get W() { return G.W; }, get hero() { return G.hero; }, get friends() { return G.friends; },
      tp: (i) => { S.idx = i; placeHero(i / (N - 1)); }, force: (name, double = false) => { S.forceCard = { c: COLORS.find((c) => c.name === name), double }; },
    };
    boot().catch((e) => { console.error(e); loading.fail(); });
  };
  return G;
}
