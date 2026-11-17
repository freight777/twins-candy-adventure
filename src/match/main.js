// Sparkle Match — a match-3 a five-year-old can play alone and always win (see the build spec). Phase 0: the tested engine
// on screen with plain coloured pieces, swipe and tap-tap input, every step animated, and deep links:
//   match.html?level=34&theme=mermaid&seed=7
import './match.css';
import { Application } from 'pixi.js';
import gsap from 'gsap';
import { holdGate } from '../engine/gate.js';
import { applyBedtime } from '../engine/bedtime.js';
import { unlock, voice } from '../audio.js';
import { createGame, play, remaining } from './game/engine.js';
import { makeLevel } from './game/levels.js';
import { THEMES } from './themes.js';
import { Board } from './view/board.js';
import { attachInput } from './view/input.js';

const $ = (s) => document.querySelector(s);
const q = new URLSearchParams(location.search);
const themeId = q.get('theme') === 'mermaid' ? 'mermaid' : 'unicorn', theme = THEMES[themeId];
const newSeed = () => (Math.random() * 1e6) | 0;
document.body.dataset.theme = themeId;
document.querySelector('meta[name="theme-color"]').content = theme.bg[0];
['gesturestart', 'dblclick', 'contextmenu'].forEach((ev) => document.addEventListener(ev, (e) => e.preventDefault()));
addEventListener('pointerdown', unlock, { once: true });
applyBedtime();
holdGate($('#home'), () => { location.href = './'; }, { ms: 1200, onTap: () => voice('hold_to_go_home', { priority: 0 }) });

const app = new Application();
await app.init({ resizeTo: window, backgroundAlpha: 0, antialias: true, autoDensity: true, resolution: Math.min(2, devicePixelRatio || 1) });
$('#stage').appendChild(app.canvas);
const board = new Board(app, theme);

let g = null, level = 1, seed = 0, busy = false, pending = null;

function layout() {
  const r = $('#boardbox').getBoundingClientRect();
  board.layout({ x: r.left, y: r.top, w: r.width, h: r.height });
}
addEventListener('resize', () => requestAnimationFrame(layout));

function start(n, s) {
  level = Math.min(100, Math.max(1, n | 0)); seed = s | 0;
  g = createGame(makeLevel(level), seed); pending = null;
  board.load(g); drawGoal(); layout();
  $('#win').classList.add('hidden');
  history.replaceState(null, '', `?level=${level}&theme=${themeId}&seed=${seed}`);
}

/** the goal bar: a picture and a big numeral for each thing still to do (pictures and numerals only, no words) */
function drawGoal() {
  const goal = g.level.goal, items = [];
  const left = (n) => Math.max(0, n);
  if (goal.type === 'collect') goal.kinds.forEach((k) => items.push({ pic: `<div class="pic" style="background:${theme.colors[k]}"></div>`, n: left(goal.each - g.got.pieces[k]) }));
  else if (goal.type === 'tiles') items.push({ pic: '<div class="pic tile"></div>', n: remaining(g) });
  else if (goal.type === 'make') items.push({ pic: `<div class="pic power" style="background:${theme.colors[0]}"></div>`, n: remaining(g) });
  else if (goal.type === 'drop') items.push({ pic: `<div class="pic emoji">${theme.home}</div>`, n: remaining(g) });
  else items.push({ pic: '<div class="pic emoji">\u{1F389}</div>', n: remaining(g) });
  $('#goal').innerHTML = items.map((it) => `<div class="chip${it.n ? '' : ' done'}">${it.pic}<span class="num">${it.n || '✓'}</span></div>`).join('');
}

/** one move from the child; while the board is still busy, remember the latest one and play it when it settles */
async function submit(m) {
  if (!g || g.done) return;
  if (busy) { pending = m; return; }
  busy = true;
  try {
    const steps = play(g, m);
    if (!steps) { if (m.a !== undefined) await board.wobble(m.a, m.b); }
    else { await board.play(steps); drawGoal(); }
  } finally { busy = false; }
  if (g.done) { $('#win').classList.remove('hidden'); return; }
  if (pending) { const p = pending; pending = null; submit(p); }
}
attachInput(app.canvas, board, submit);
$('#next').addEventListener('click', () => start(level >= 100 ? 1 : level + 1, newSeed()));

start(+q.get('level') || 1, q.has('seed') ? +q.get('seed') : newSeed());
window.match = { board, submit, start, app, gsap, get game() { return g; }, get busy() { return busy; } };   // for tests and the screenshot tool
if (import.meta.env.DEV) Promise.all([import('./dev/soak.js'), import('./game/engine.js')]).then(([d, E]) => { window.match.soak = d.installSoak(window.match, E); });
