// Sparkle Match — a match-3 a five-year-old can play alone and always win (see the build spec). Phase 1: real pieces for both doors,
// every animation in §6's table, the three power-up effects, sounds, the hint hand. Deep links:
//   match.html?level=34&theme=mermaid&seed=7
import './match.css';
import { Application, Sprite, Graphics, Container } from 'pixi.js';
import gsap from 'gsap';
import confetti from 'canvas-confetti';
import { holdGate } from '../engine/gate.js';
import { applyBedtime } from '../engine/bedtime.js';
import { unlock, voice } from '../audio.js';
import { sfxSprite } from '../engine/sfxsprite.js';
import { createGame, play, remaining, bestMove } from './game/engine.js';
import { makeLevel } from './game/levels.js';
import { THEMES, slug } from './themes.js';
import { Board } from './view/board.js';
import { loadArt } from './view/piece.js';
import { attachInput } from './view/input.js';
import { createHint } from './view/hint.js';
import MAP from './sfx.json';

const $ = (s) => document.querySelector(s), BASE = import.meta.env.BASE_URL;
const q = new URLSearchParams(location.search);
const themeId = q.get('theme') === 'mermaid' ? 'mermaid' : 'unicorn', theme = THEMES[themeId];
const newSeed = () => (Math.random() * 1e6) | 0;
const artSrc = (name) => `${BASE}assets/match/${slug(name)}.webp`;
document.body.dataset.theme = themeId;
document.querySelector('meta[name="theme-color"]').content = theme.bg[0];
['gesturestart', 'dblclick', 'contextmenu'].forEach((ev) => document.addEventListener(ev, (e) => e.preventDefault()));
applyBedtime();
holdGate($('#home'), () => { location.href = './'; }, { ms: 1200, onTap: () => voice('hold_to_go_home', { priority: 0 }) });
const sfx = sfxSprite(`${BASE}assets/match/sfx.mp3`, MAP);
addEventListener('pointerdown', () => { unlock(); sfx.warm(); }, { capture: true });

const app = new Application();
await app.init({ resizeTo: window, backgroundAlpha: 0, antialias: true, autoDensity: true, resolution: Math.min(2, devicePixelRatio || 1) });
$('#stage').appendChild(app.canvas);
const tex = await loadArt(theme);
const board = new Board(app, theme, tex), flyLayer = new Container(); app.stage.addChild(flyLayer);
const hint = await createHint(board);
$('#friend').src = artSrc(theme.art.friend);

let g = null, level = 1, seed = 0, busy = false, pending = null, idle = 0;

function layout() {
  const r = $('#boardbox').getBoundingClientRect();
  board.layout({ x: r.left, y: r.top, w: r.width, h: r.height });
}
addEventListener('resize', () => requestAnimationFrame(layout));

function start(n, s) {
  level = Math.min(100, Math.max(1, n | 0)); seed = s | 0;
  g = createGame(makeLevel(level), seed); pending = null; flying = 0;
  hint.hide(); board.load(g); drawGoal(); layout();
  $('#win').classList.add('hidden'); $('#friend').classList.remove('dance');
  history.replaceState(null, '', `?level=${level}&theme=${themeId}&seed=${seed}`);
  poke();
}

// ------------------------------------------------------------------------------------------------ the goal bar: pictures and numerals only
const shown = {};
function goalItems() {
  const goal = g.level.goal, img = (n) => `<img src="${artSrc(n)}" alt="" draggable="false">`;
  if (goal.type === 'collect') return goal.kinds.map((k) => ({ key: 'k' + k, pic: `<div class="pic" style="--c:${theme.colors[k]}">${img(theme.names[k])}</div>`, n: Math.max(0, goal.each - g.got.pieces[k]) }));
  if (goal.type === 'tiles') return [{ key: 'tiles', pic: '<div class="pic tile"></div>', n: remaining(g) }];
  if (goal.type === 'make') return [{ key: 'make', pic: `<div class="pic power ${themeId}" style="--c:${theme.colors[1]}">${img(theme.names[1])}</div>`, n: remaining(g) }];
  if (goal.type === 'drop') return [{ key: 'drop', pic: `<div class="pic friend">${img(theme.art.home)}</div>`, n: remaining(g) }];
  return [{ key: 'pop', pic: `<div class="pic party">${img(theme.art.party)}</div>`, n: remaining(g) }];
}
function drawGoal() {
  const items = goalItems();
  $('#chips').innerHTML = items.map((it) => `<div class="chip" data-key="${it.key}">${it.pic}<span class="num"></span></div>`).join('');
  items.forEach((it) => setChip(it.key, it.n, false));
}
function setChip(key, n, juicy = true) {
  const chip = document.querySelector(`.chip[data-key="${key}"]`); if (!chip) return;
  const was = shown[key]; shown[key] = n;
  chip.querySelector('.num').textContent = n > 0 ? n : '';
  chip.classList.toggle('done', n <= 0);
  if (juicy && was !== n) { chip.classList.remove('bump'); void chip.offsetWidth; chip.classList.add('bump'); if (n <= 0 && was > 0) sfx.play('done'); }
}
/** a collected thing flies to its goal picture; the number ticks down when it lands */
let flying = 0;
function fly({ key, n, x, y, tex: t }) {
  const chip = document.querySelector(`.chip[data-key="${key}"] .pic`); if (!chip) return;
  const r = chip.getBoundingClientRect(), size = 100 * (board.scale || 0.5);
  let s;
  if (t) { s = new Sprite(t); s.anchor.set(0.5); s.width = s.height = size * 0.8; }
  else { s = new Graphics().roundRect(-40, -40, 80, 80, 16).fill(0xffd23f).stroke({ width: 6, color: 0xffffff }); s.scale.set(size / 100); }
  s.position.set(x, y); flyLayer.addChild(s); flying++;
  const k = (r.width * 0.9) / (t ? s.width / s.scale.x : 100), d = 0.5 + Math.random() * 0.12;
  gsap.to(s, { x: r.left + r.width / 2, duration: d, ease: 'power1.inOut' });
  gsap.to(s, { y: r.top + r.height / 2, duration: d, ease: 'back.in(1.6)' });
  gsap.to(s.scale, { x: k, y: k, duration: d, ease: 'power1.in', onComplete: () => {
    s.destroy(); flying--; sfx.play('tick', { vol: 0.7, minGap: 0.03 });
    setChip(key, Math.max(0, (shown[key] ?? 0) - n));
    if (!flying && !busy) settleGoal();
  } });
}
/** after the flights: the bar shows exactly what the engine says */
function settleGoal() { for (const it of goalItems()) if (shown[it.key] !== it.n) setChip(it.key, it.n); }

// ------------------------------------------------------------------------------------------------ the friend beside the board
let cheerAt = 0;
function cheer() {
  const f = $('#friend'); f.classList.remove('cheer'); void f.offsetWidth; f.classList.add('cheer');
  if (performance.now() - cheerAt > 2500) { cheerAt = performance.now(); sfx.play(themeId === 'unicorn' ? 'jUniCheer' : 'jSeaCheer', { vary: false, vol: 0.8 }); }
}
board.hooks = { sound: (c, o) => sfx.play(c, o), cheer, fly };

// ------------------------------------------------------------------------------------------------ moves
function poke() { clearTimeout(idle); hint.hide(); idle = setTimeout(offerHint, 5000); }
function offerHint() { if (busy || !g || g.done) return poke(); hint.show(bestMove(g)); }

/** one move from the child; while the board is still busy, remember the latest one and play it when it settles */
async function submit(m) {
  if (!g || g.done) return;
  if (busy) { pending = m; return; }
  busy = true; poke();
  let refused = false;
  try {
    const steps = play(g, m);
    if (!steps) { refused = m.a !== undefined; if (refused) await board.wobble(m.a, m.b); }
    else await board.play(steps);
  } finally { busy = false; }
  if (!flying) settleGoal();
  if (g.done) return celebrate();
  if (refused && !pending) { clearTimeout(idle); hint.show(bestMove(g)); return; }   // a swap that matched nothing: show the hint at once
  if (pending) { const p = pending; pending = null; submit(p); }
}
function celebrate() {
  clearTimeout(idle); hint.hide();
  sfx.play(themeId === 'unicorn' ? 'jUniWin' : 'jSeaWin', { vary: false });
  $('#friend').classList.add('dance');
  const colors = theme.colors.concat(['#ffffff']);
  confetti({ particleCount: 120, spread: 90, startVelocity: 42, origin: { x: 0.5, y: 0.65 }, colors, disableForReducedMotion: true, zIndex: 4 });
  setTimeout(() => confetti({ particleCount: 60, angle: 60, spread: 60, origin: { x: 0, y: 0.8 }, colors, disableForReducedMotion: true, zIndex: 4 }), 250);
  setTimeout(() => confetti({ particleCount: 60, angle: 120, spread: 60, origin: { x: 1, y: 0.8 }, colors, disableForReducedMotion: true, zIndex: 4 }), 400);
  setTimeout(() => $('#win').classList.remove('hidden'), 1400);       // then a single "next" arrow
}
attachInput(app.canvas, board, submit);
app.canvas.addEventListener('pointerdown', poke);
$('#next').addEventListener('click', () => start(level >= 100 ? 1 : level + 1, newSeed()));

start(+q.get('level') || 1, q.has('seed') ? +q.get('seed') : newSeed());
window.match = { board, submit, start, app, gsap, hint, get game() { return g; }, get busy() { return busy; } };   // for tests and the screenshot tool
if (import.meta.env.DEV) Promise.all([import('./dev/soak.js'), import('./game/engine.js')]).then(([d, E]) => { window.match.soak = d.installSoak(window.match, E); });
