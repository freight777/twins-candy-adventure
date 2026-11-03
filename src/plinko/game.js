// Sparkle Plinko: pull the plunger down, let go, and the ball flies up the lane, round the dome and down through the pegs.
// Bumpers ring and count up (and grow more valuable the more they are hit), pickups float in the field (gems, a cloud or a
// bubble that carries the ball back up, a crown for double points, a rainbow or a trident that splits the ball into three),
// and the slot it lands in multiplies its points. Ten balls a round, a bonus ball when the treasure meter fills, and a
// leaderboard of family faces per board. Two boards: Rainbow Plinko (unicorns) and Mermaid Plinko (the lagoon).
// Not a learning game: no questions, just fun.
import './plinko.css';
import { loading } from '../engine/loading.js';
import { homeGate } from '../engine/gate.js';
import { unlock, playMusic, stopMusic, say, sfx } from '../audio.js';
import { earn } from '../engine/sticker.js';
import { createWorld } from './physics.js';
import { THEMES, PLAYERS, L, LANE_X, R, GATE_Y, PLUNGER_Y, BALL_R, SLOT_TOP, FLOOR, MULTS, SLOT_W, BUMP_VALUES, HITS_PER_LEVEL, BIG_SPOTS, GRAVITY, BOWL, launchSpeed, build, gapSpots } from './boards.js';
import { createRenderer, preloadEmoji } from './draw.js';
import { loadSfx, play, scaleRate, warm } from './sound.js';

const $ = (s) => document.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
homeGate();
['gesturestart', 'dblclick', 'contextmenu'].forEach((ev) => document.addEventListener(ev, (e) => e.preventDefault()));

const BALLS = 10, METER_MAX = 6000, MAX_BONUS = 3;     // a round scores ~15-20k: about one bonus ball every three or four balls
const LANE_CX = (LANE_X + R) / 2;

// ---------------------------------------------------------------- saved on this device: who is playing, and the leaderboards
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
};
let who = store.get('plinkoWho', 'adalyn'); if (!PLAYERS[who]) who = 'adalyn';
const boards = () => store.get('plinkoScores', { uni: [], sea: [] });
function saveScore(board, score) {
  const all = boards(), at = Date.now(), list = all[board] || [];
  const top = list.length ? list[0].score : 0;
  list.push({ who, score, at }); list.sort((a, b) => b.score - a.score || a.at - b.at); all[board] = list.slice(0, 10); store.set('plinkoScores', all);
  return { at, top: score > top && list.length > 1, rank: all[board].findIndex((s) => s.at === at) };
}
const bestOf = (board) => (boards()[board] || [])[0]?.score || 0;
function boardHTML(board, hl) {
  const list = (boards()[board] || []).slice(0, 5);
  if (!list.length) return `<p class="empty">${THEMES[board].hero} ? ? ?</p>`;
  return '<ol>' + list.map((s, i) => `<li class="${hl && s.at === hl ? 'me' : ''}"><span class="rk">${['\u{1F947}', '\u{1F948}', '\u{1F949}', '4', '5'][i]}</span>` +
    `<span class="av">${(PLAYERS[s.who] || PLAYERS.adalyn).emoji}</span><span class="sc">${s.score.toLocaleString()}</span></li>`).join('') + '</ol>';
}

// ---------------------------------------------------------------- state
const cv = $('#c'), view = createRenderer(cv);
const S = {
  state: 'boot', theme: THEMES.uni, world: null, pegs: [], bumpers: [], mover: null, slotFlash: MULTS.map(() => 0),
  ready: null, pull: 0, kick: 0, pulling: null, auto: null, ballsLeft: BALLS, launched: 0, score: 0, shown: 0, meter: 0, bonus: 0,
  t: 0, timeScale: 1, idle: 0, sinceMulti: 0, gemTimer: 0, readyTimer: 0, said: {}, jackpots: 0, endTimer: 0,
};

function buildWorld(theme) {
  const w = createWorld({ gravity: GRAVITY, bowl: BOWL });
  Object.assign(S, build(w));
  S.mover.phase = rnd(0, 6);
  w.onHit = onHit; w.onSensor = onSensor;
  S.world = w; S.theme = theme;
}

// ---------------------------------------------------------------- the HUD (DOM, so it stays crisp and the emoji are Fluent pictures)
function hud() {
  $('#score').textContent = Math.round(S.shown).toLocaleString();
  $('#balls').innerHTML = Array.from({ length: BALLS + S.bonus }, (_, i) => `<i class="${i < S.launched ? 'used' : i >= BALLS ? 'bonus' : ''}"></i>`).join('');
  $('#meter i').style.width = `${Math.min(100, (S.meter / METER_MAX) * 100)}%`;
}
function react(cls) { const h = $('#hero'); h.classList.remove('hop', 'spin', 'wiggle'); void h.offsetWidth; h.classList.add(cls); }
let bannerT = 0;
function banner(text, cls = '') {
  const b = $('#banner'); b.className = cls; b.textContent = text; void b.offsetWidth; b.classList.add('show');
  clearTimeout(bannerT); bannerT = setTimeout(() => b.classList.remove('show'), 1600);
}
const line = (k) => say(S.theme.lines[k], S.theme.voice, { priority: 1 });
function show(id, on = true) { $(id).classList.toggle('hidden', !on); }

// ---------------------------------------------------------------- a round
function start(board) {
  unlock(); warm();
  const theme = THEMES[board] || THEMES.uni;
  buildWorld(theme); view.setTheme(theme);
  document.body.dataset.board = theme.id;
  Object.assign(S, { state: 'play', ready: null, pull: 0, kick: 0, pulling: null, auto: null, ballsLeft: BALLS, launched: 0, score: 0, shown: 0, meter: 0, bonus: 0, idle: 0, sinceMulti: 1, gemTimer: .5, readyTimer: .4, said: {}, jackpots: 0, endTimer: 0, timeScale: 1 });
  S.slotFlash.fill(0);
  $('#hero').textContent = theme.hero; $('#pname').textContent = theme.name;
  $('#best').textContent = bestOf(theme.id).toLocaleString(); $('#me').textContent = PLAYERS[who].emoji;
  show('#title', false); show('#over', false); show('#board', false); show('#panel');
  playMusic(theme.music);
  for (let i = 0; i < 4; i++) spawn('gem');
  spawn('lift');
  hud();
}
function readyBall() {
  if (S.ready || S.ballsLeft <= 0 || S.state !== 'play') return;
  S.ready = S.world.addBall(LANE_CX, PLUNGER_Y - BALL_R - 2, BALL_R, { pinned: true, pts: 0, chain: 0, trail: [] });
  S.idle = 0;
  if (S.ballsLeft === 1 && S.launched > 0) { banner('LAST BALL!', 'last'); line('last'); spawn('multi'); }
  else if (!S.said.pull) { S.said.pull = true; line('pull'); }
}
function launch(p) {
  const b = S.ready; if (!b) return;
  b.pinned = false; b.vx = rnd(-8, 8); b.vy = -(launchSpeed(p) + rnd(-10, 10));
  S.ready = null; S.pull = 0; S.kick = -14; S.pulling = null; S.auto = null;
  S.ballsLeft--; S.launched++; S.readyTimer = .9; S.idle = 0; $('#hint').classList.remove('show');
  play('thunk', { vol: .9 }); sfx.swoosh();
  // a new surprise in the field now and then; the multiball comes more likely the longer it has been away
  S.sinceMulti++;
  if (S.launched >= 2 && Math.random() < .12 + S.sinceMulti * .1) spawn('multi');
  if (Math.random() < .35) spawn('lift');
  if (S.launched >= 3 && Math.random() < .22) spawn('crown');
  hud();
}

// ---------------------------------------------------------------- pickups in the field
function freeSpot(list, minGap) {
  const taken = S.world.sensors;
  const ok = list.filter(([x, y]) => taken.every((s) => Math.hypot(s.x - x, s.y - y) > minGap) && S.world.balls.every((b) => Math.hypot(b.x - x, b.y - y) > 50));
  return ok.length ? pick(ok) : null;
}
function spawn(kind) {
  const w = S.world;
  if (kind !== 'gem' && w.sensors.some((s) => s.kind === kind)) return;
  const spot = kind === 'gem' ? freeSpot(gapSpots(), 46) : freeSpot(BIG_SPOTS, 60);
  if (!spot) return;
  const r = { gem: 10, multi: 18, lift: 20, crown: 16 }[kind];
  w.addSensor(spot[0], spot[1], r, { kind, age: 0 });
  if (kind === 'multi') S.sinceMulti = 0;
  if (kind !== 'gem') { view.P.ring(spot[0], spot[1], '#ffffff', 10, 50, .5); play('pop', { rate: 1.3, vol: .6 }); }
}
function onSensor(b, s) {
  const w = S.world, P = view.P;
  if (s.kind === 'gem') {
    w.removeSensor(s); b.pts += 5; S.gemTimer = 1.2;
    P.spark(s.x, s.y, 10, '#ffffff', 200); P.text('+5', s.x, s.y - 12, { size: 20 });
    play('gem', { rate: rnd(.9, 1.3), vol: .8 });
  } else if (s.kind === 'multi') {
    w.removeSensor(s);
    for (const dir of [-1, 1]) w.addBall(s.x + dir * 8, s.y - 6, BALL_R, { vx: dir * rnd(220, 320), vy: rnd(-420, -320), pts: 0, chain: 0, trail: [], extra: true });
    b.vy = Math.min(b.vy, -200);
    banner('3 BALLS!', 'multi'); line('multi'); play(S.theme.jingles.multi, { vol: .9 }); react('spin');
    view.V.flash = .7; view.V.flashColor = '#fff'; view.V.shake = 6;
    P.ring(s.x, s.y, '#ffffff', 20, 140, .6); P.spark(s.x, s.y, 24, '#ff9ff3', 380); P.emoji(s.x, s.y, S.theme.multi, 5, 420);
  } else if (s.kind === 'crown') {
    w.removeSensor(s); b.crown = true;
    banner('DOUBLE!', 'crown'); line('double'); play('bonus'); react('hop');
    P.spark(s.x, s.y, 18, '#ffd84d', 300); P.ring(s.x, s.y, '#ffd84d', 16, 90);
  } else if (s.kind === 'lift') {
    w.removeSensor(s); b.lift = { y0: s.y }; b.x = s.x; b.y = s.y; b.vx = b.vy = 0; b.pts += 15;
    P.text('+15', s.x, s.y - 30, { size: 22 }); play('drop', { rate: 1.2 }); if (!S.said.lift) { S.said.lift = true; line('lift'); }
  }
}
function onHit(b, shape, speed) {
  const P = view.P, pan = (b.x / 280 - 1) * .6;
  if (shape.kind === 'peg') {
    if (speed < 60 || S.t - (shape.at || -1) < .08) return;      // a real bounce, once (not a ball resting against it)
    shape.at = S.t; shape.lit = 1; b.chain++; b.pts += 1;
    play(`peg${b.chain % 3}`, { rate: scaleRate(b.chain), vol: clamp(speed / 700, .15, .7), pan, minGap: .025 });
    if (speed > 320) P.spark(shape.x, shape.y, 3, S.theme.pegLit, 120);
  } else if (shape.kind === 'bumper') {
    if (S.t - (b.hitAt?.get(shape) ?? -1) < .15) return;      // one score per real bounce, not per jiggle
    (b.hitAt ||= new Map()).set(shape, S.t);
    const bp = shape; bp.pulse = 1; bp.hits++; b.pts += bp.value; b.chain = 0;
    P.text(`+${bp.value}`, bp.x, bp.y - 36, { size: 24 }); P.spark(bp.x, bp.y, 12, S.theme.bumperRing[bp.level][2], 300); P.ring(bp.x, bp.y, '#ffffff', 24, 64, .35);
    play(`bump${bp.level % 3}`, { rate: 1 + bp.level * .15, vol: .75, pan, minGap: .04 });
    react('hop'); view.V.shake = Math.max(view.V.shake, 3);
    if (bp.hits % HITS_PER_LEVEL === 0 && bp.level < BUMP_VALUES.length - 1) {
      bp.level++; bp.value = BUMP_VALUES[bp.level];
      setTimeout(() => { P.text('LEVEL UP!', bp.x, bp.y - 58, { size: 18, col: '#fff36b', max: 1.3 }); P.ring(bp.x, bp.y, '#fff36b', 24, 100, .6); play('power', { vol: .8 }); }, 120);
    }
  } else if (shape.kind === 'mover') {
    if (S.t - (b.hitAt?.get(shape) ?? -1) < .6) return;
    (b.hitAt ||= new Map()).set(shape, S.t);
    shape.pulse = 1; b.pts += 25;
    P.text('+25', shape.x, shape.y - 34, { size: 24, col: '#fff36b' }); P.emoji(shape.x, shape.y, '\u{1F496}', 3, 260);
    if (S.theme.id === 'sea') sfx.squeak(); else sfx.sparkle();
    play('bonus', { vol: .5, minGap: .2 });
  } else if (shape.kind === 'kicker') {
    play('wall', { rate: 1.5, vol: .6, pan, minGap: .05 }); P.spark(b.x, b.y, 5, '#ffffff', 160);
  } else if (speed > 260 && shape.kind !== 'plunger') {
    play('wall', { rate: shape.kind === 'divider' ? 1.3 : 1, vol: clamp(speed / 900, .1, .5), pan, minGap: .06 });
  }
}

// ---------------------------------------------------------------- landing in a slot
function land(b, i) {
  const m = MULTS[i], base = Math.max(5, b.pts), total = base * m * (b.crown ? 2 : 1), cx = L + (i + .5) * SLOT_W, P = view.P;
  S.world.removeBall(b);
  S.score += total; S.slotFlash[i] = 1;
  P.coins(cx, SLOT_TOP + 40, Math.min(30, 6 + m * 2));
  P.text(`+${total}`, cx, SLOT_TOP - 24, { size: 30 + Math.min(26, m * 2.6), max: 1.5 });
  if (m > 1 || b.crown) P.text(`${base} × ${m}${b.crown ? ' × 2' : ''}`, cx, SLOT_TOP - 62, { size: 18, max: 1.5, vy: -50 });
  play('coins', { vol: .9 }); setTimeout(() => play('chips', { vol: .6 }), 160);
  if (m === 10) jackpot(cx);
  else if (m === 3) { play('bonus', { vol: .7 }); P.spark(cx, SLOT_TOP + 30, 16, S.theme.slot[i], 300); react('hop'); }
  // the treasure meter fills with every point; full = a bonus ball
  S.meter += total;
  if (S.meter >= METER_MAX && S.bonus < MAX_BONUS) {
    S.meter -= METER_MAX; S.bonus++; S.ballsLeft++;
    setTimeout(() => { banner('BONUS BALL!', 'bonus'); line('bonus'); play('bonus'); sfx.tada(); $('#meter').classList.add('full'); setTimeout(() => $('#meter').classList.remove('full'), 1400); }, m === 10 ? 1800 : 300);
  }
  if (S.bonus >= MAX_BONUS) S.meter = Math.min(S.meter, METER_MAX);
  hud();
}
function jackpot(cx) {
  const P = view.P, V = view.V;
  S.jackpots++;
  banner('JACKPOT!', 'jackpot'); line('jackpot'); play(S.theme.jingles.win, { vol: 1 }); sfx.fanfare(); react('spin');
  V.flash = 1; V.flashColor = '#fff6c2'; V.shake = 14;
  P.confetti(cx, SLOT_TOP, 50); P.rain(S.theme.friends, 30);
  for (let i = 0; i < 3; i++) setTimeout(() => { P.ring(cx, SLOT_TOP + 30, pick(['#ff9ff3', '#fff36b', '#7fd6ff']), 20, 220, .8); P.spark(cx, SLOT_TOP, 26, '#fff36b', 520); play('coins', { rate: 1 + i * .15 }); }, i * 220);
  if (PLAYERS[who] && ['adalyn', 'esmae', 'tony'].includes(who)) earn(who, S.theme.id === 'uni' ? 'plinko-rainbow' : 'plinko-lagoon');
}

// ---------------------------------------------------------------- end of the round
function finish() {
  S.state = 'over';
  const theme = S.theme, P = view.P;
  play(theme.jingles.end); sfx.tada(); P.rain(theme.friends, 24); line('end'); react('spin');
  const res = saveScore(theme.id, S.score);
  if (['adalyn', 'esmae', 'tony'].includes(who) && S.score >= 20000) earn(who, 'plinko-super');
  setTimeout(() => {
    if (res.top) { banner('NEW HIGH SCORE!', 'jackpot'); line('best'); P.rain(['\u{1F3C6}', '⭐', '\u{1F947}'], 18); }
    $('#final').textContent = S.score.toLocaleString(); $('#overHero').textContent = theme.hero;
    $('#overBoard').innerHTML = boardHTML(theme.id, res.at); $('#other').innerHTML = `${THEMES[theme.id === 'uni' ? 'sea' : 'uni'].hero} Other board`;
    show('#over');
  }, 1300);
}

// ---------------------------------------------------------------- title screen
function titleScreen() {
  S.state = 'title'; stopMusic(); show('#panel', false); show('#over', false); show('#title');
  document.querySelectorAll('#who button').forEach((b) => b.classList.toggle('on', b.dataset.who === who));
  for (const id of ['uni', 'sea']) $(`#best-${id}`).textContent = bestOf(id) ? bestOf(id).toLocaleString() : '-';
  if (!S.world) { buildWorld(THEMES.uni); view.setTheme(THEMES.uni); }
}
document.querySelectorAll('#who button').forEach((b) => b.addEventListener('click', () => {
  unlock(); who = b.dataset.who; store.set('plinkoWho', who); sfx.pop();
  document.querySelectorAll('#who button').forEach((x) => x.classList.toggle('on', x === b));
}));
document.querySelectorAll('.bcard').forEach((b) => b.addEventListener('click', () => { sfx.magic(); start(b.dataset.board); }));
$('#lbBtn').addEventListener('click', () => { unlock(); sfx.pop(); $('#lbUni').innerHTML = boardHTML('uni'); $('#lbSea').innerHTML = boardHTML('sea'); show('#board'); });
$('#closeBoard').addEventListener('click', () => show('#board', false));
$('#again').addEventListener('click', () => start(S.theme.id));
$('#other').addEventListener('click', () => start(S.theme.id === 'uni' ? 'sea' : 'uni'));
$('#menu').addEventListener('click', titleScreen);

// ---------------------------------------------------------------- the plunger: pull down anywhere on the board side, let go
const PULL_PX = () => Math.max(120, innerHeight * .24);
let lastNotch = 0;
cv.addEventListener('pointerdown', (e) => {
  unlock(); warm();
  if (S.state !== 'play' || !S.ready || S.auto) return;
  e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch { /* fine */ }
  S.pulling = { y0: e.clientY, at: performance.now(), id: e.pointerId }; lastNotch = 0;
});
cv.addEventListener('pointermove', (e) => {
  if (!S.pulling || e.pointerId !== S.pulling.id) return;
  S.pull = clamp((e.clientY - S.pulling.y0) / PULL_PX(), 0, 1);
  const notch = Math.floor(S.pull * 8); if (notch !== lastNotch) { lastNotch = notch; play('tick', { rate: 1 + S.pull * .8, vol: .7 }); }
});
function release(e) {
  if (!S.pulling || (e && e.pointerId !== S.pulling.id)) return;
  const quick = performance.now() - S.pulling.at < 350; S.pulling = null;
  if (S.pull >= .08) launch(S.pull);
  else if (quick) S.auto = { t: 0 };           // a tap: the plunger pulls itself halfway and lets go
  else S.pull = 0;
}
cv.addEventListener('pointerup', release); cv.addEventListener('pointercancel', release);
addEventListener('keydown', (e) => { if (e.code === 'Space' && !e.repeat && S.ready && !S.pulling) { S.pulling = { key: true, y0: 0, at: performance.now() }; } });
addEventListener('keyup', (e) => { if (e.code === 'Space' && S.pulling?.key) { S.pulling = null; launch(Math.max(.1, S.pull)); } });

// ---------------------------------------------------------------- per frame
function update(dt) {
  S.t += dt;
  const V = view.V, w = S.world;
  if (!w) return;
  // the plunger
  if (S.pulling?.key) S.pull = Math.min(1, S.pull + dt * 1.1);
  if (S.auto) { S.auto.t += dt; S.pull = Math.min(.55, S.auto.t * 1.8); if (S.auto.t > .45) launch(.55); }
  S.kick += (0 - S.kick) * Math.min(1, dt * 14);
  if (S.ready) { S.ready.y = PLUNGER_Y - BALL_R - 2 + S.pull * 40; S.ready.x = LANE_CX; }
  // the mover swims (or flutters) back and forth across the top of the field
  const m = S.mover, nx = 260 + Math.sin(S.t * .55 + m.phase) * 160;      // never close enough to a wall to pin a ball there
  m.vx = (nx - m.x) / Math.max(dt, 1e-3); m.x = nx; m.vy = 0; m.pulse = Math.max(0, m.pulse - dt * 3);

  // slow motion and a gentle zoom when a ball is about to drop into the jackpot slot
  const jx = L + 3.5 * SLOT_W;
  const tease = w.balls.find((b) => !b.pinned && !b.lift && b.y > 610 && b.y < SLOT_TOP + 10 && Math.abs(b.x - jx) < SLOT_W * .75 && b.vy > 0);
  const wantT = tease ? .4 : 1;
  S.timeScale += (wantT - S.timeScale) * Math.min(1, dt * (tease ? 10 : 4));
  V.zoom += ((tease ? 1.12 : 1) - V.zoom) * Math.min(1, dt * 5);
  if (tease) { V.fx += (tease.x - V.fx) * Math.min(1, dt * 6); V.fy += (tease.y - V.fy) * Math.min(1, dt * 6); }
  const sdt = dt * S.timeScale;

  for (const b of w.balls) if (b.lift) {               // carried back up in a cloud / bubble, then let go
    b.y -= 170 * sdt; b.x += Math.sin(S.t * 5) * 30 * sdt; b.x = clamp(b.x, L + 30, LANE_X - 30);
    if (S.theme.id === 'sea' && Math.random() < .3) view.P.bubbles(b.x, b.y + 20, 1);
    if (b.y <= GATE_Y + 20) { b.lift = null; b.vx = rnd(-90, 90); b.vy = -60; play('pop', { vol: .9 }); view.P.spark(b.x, b.y, 14, '#ffffff', 260); view.P.ring(b.x, b.y, '#ffffff', 20, 60); }
  }
  w.step(sdt);

  for (const b of [...w.balls]) {
    if (b.pinned) continue;
    b.trail.push([b.x, b.y]); if (b.trail.length > 14) b.trail.shift();
    b.age = (b.age || 0) + sdt; if (b.age > 12) b.tired = true;          // a long rally winds down: no more springy kicks, so it settles
    if (S.theme.trail === 'bubbles' && !b.lift && Math.random() < .35) view.P.bubbles(b.x, b.y, 1);
    if (b.y > FLOOR - 34 && b.x < LANE_X) { land(b, clamp(Math.floor((b.x - L) / SLOT_W), 0, MULTS.length - 1)); continue; }
    // never stuck: resting on a bumper, or rattling in one place, earns a nudge
    if (!b.watch || S.t - b.watch[2] > 1) {
      const moved = b.watch ? Math.hypot(b.x - b.watch[0], b.y - b.watch[1]) : 99;
      b.watch = [b.x, b.y, S.t];
      if (moved < 8 && !b.lift) { b.vx = pick([-1, 1]) * rnd(150, 220); b.vy = -260; b.x += Math.sign(260 - b.x) * 4; }
    }
    if (!(b.y < 1000) || !(b.x > -50 && b.x < 650)) { land(b, Number.isFinite(b.x) ? clamp(Math.floor((b.x - L) / SLOT_W), 0, MULTS.length - 1) : 0); continue; }   // safety net: an escaped ball still scores
  }
  for (const p of S.pegs) if (p.lit > 0) p.lit = Math.max(0, p.lit - dt * 1.6);
  for (const bp of S.bumpers) bp.pulse = Math.max(0, bp.pulse - dt * 3.5);
  for (const s of w.sensors) s.age = (s.age || 0) + dt;
  for (let i = 0; i < S.slotFlash.length; i++) S.slotFlash[i] = Math.max(0, S.slotFlash[i] - dt * 1.6);
  if (S.state === 'play') {
    if (w.sensors.filter((s) => s.kind === 'gem').length < 4) { S.gemTimer -= dt; if (S.gemTimer <= 0) { spawn('gem'); S.gemTimer = 1.2; } }
    // the next ball rolls onto the plunger once the last one is on its way
    const inLane = w.balls.some((b) => !b.pinned && b.x > LANE_X && b.y > GATE_Y - 20);
    if (!S.ready && S.ballsLeft > 0 && !inLane) { S.readyTimer -= dt; if (S.readyTimer <= 0) readyBall(); }
    if (S.ready && !S.pulling && !S.auto) { S.idle += dt; if (S.idle > 4) placeHint(); }
    if (S.ballsLeft <= 0 && !S.ready && !w.balls.length) { S.endTimer += dt; if (S.endTimer > .7) finish(); }
  }
  // the score counts up like a slot machine
  if (S.shown < S.score) { S.shown = Math.min(S.score, S.shown + Math.max(1, (S.score - S.shown) * dt * 5)); $('#score').textContent = Math.round(S.shown).toLocaleString(); }
  view.update(dt);
}
function placeHint() {
  const h = $('#hint'); if (h.classList.contains('show')) return;
  const [x, y] = view.toScreen(LANE_CX, PLUNGER_Y - 30); h.style.left = `${x}px`; h.style.top = `${y}px`; h.classList.add('show');
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(.05, Math.max(0, (now - last) / 1000)); last = now;
  if (!document.hidden) { update(dt); view.frame(S, S.t, dt); }
  requestAnimationFrame(loop);
}
addEventListener('resize', () => { view.resize(); document.documentElement.style.setProperty('--panel-w', `${view.V.panelW}px`); $('#hint').classList.remove('show'); });

async function boot() {
  view.resize(); document.documentElement.style.setProperty('--panel-w', `${view.V.panelW}px`);
  const tick = loading.counter(3);
  const all = new Set([...Object.values(THEMES).flatMap((t) => [t.hero, t.bumper, t.mover, t.multi, t.crown, t.gem, t.lift, ...t.friends]), '\u{1F496}', '\u{1F3C6}', '⭐', '\u{1F947}', '\u{1F98B}', '\u{1F420}', '\u{1F41F}', '\u{1F41A}', '\u{1F980}']);
  await Promise.all([preloadEmoji([...all]).then(tick), loadSfx().then(tick), document.fonts.load('700 24px Fredoka').catch(() => {}).then(tick)]);
  titleScreen();
  loading.done();
  requestAnimationFrame(loop);
}
window.plinko = { S, view, start, launch, step: (dt = 1 / 60) => update(dt), spawn, titleScreen, soundReady: warm };
boot().catch((e) => { console.error(e); loading.fail(); });
