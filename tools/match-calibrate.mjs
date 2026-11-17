// tools/calibrate.mjs — node tools/calibrate.mjs [games per level = 60] [report | summary]
import { createGame, play, moves, remaining, bestMove, groups, BABY } from '../src/match/game/engine.js';
import { makeLevel } from '../src/match/game/levels.js';
const RUNS = +process.argv[2] || 60, mode = process.argv[3] || 'calibrate';
const q = (a, p) => a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))];
function run(level, seed, bot) {
  const g = createGame(level, seed); let rs = seed * 2654435761 | 0; const r = () => { rs = (rs * 1664525 + 1013904223) | 0; return (rs >>> 0) / 4294967296; };
  let steps = 0, cascades = 0, bad = 0;
  while (!g.done && g.moves < 400) {
    const ms = moves(g); if (!ms.length) throw new Error('no moves L' + level.n);
    const m = bot === 'hint' ? bestMove(g) : ms[(r() * ms.length) | 0];
    const out = play(g, m); if (!out) throw new Error('valid move rejected L' + level.n + JSON.stringify(m));
    // invariants: board full, nothing lined up, no baby on a bottom square
    for (let i = 0; i < g.cells.length; i++) if (g.open[i] && !g.cells[i]) throw new Error('hole L' + level.n);
    if (!g.done && groups(g).length) throw new Error('unsettled L' + level.n);
    cascades += out.filter((s) => s.t === 'clear' && s.chain > 1).length;
  }
  return { moves: g.moves, helped: g.helped, shuffles: g.shuffles, done: g.done, cascades };
}
const pars = [], all = { rnd: [], hint: [], max: 0, helped: 0, runs: 0 };
for (let n = 1; n <= 100; n++) {
  const free = makeLevel(n, 1e9), h0 = []; for (let s = 1; s <= 12; s++) h0.push(run(free, n * 1000 + s, 'hint').moves);
  const par = Math.min(30, Math.max(8, Math.round(q(h0, 0.5) * 1.8) + 4)); pars.push(par);
  const L = makeLevel(n, par), rnd = []; let helped = 0, shuf = 0, mv = 0;
  for (let s = 1; s <= RUNS; s++) { const x = run(L, n * 1000 + s, 'random'); if (!x.done) throw new Error('unfinished L' + n); rnd.push(x.moves); helped += x.helped > 0; shuf += x.shuffles; mv += x.moves; }
  all.rnd.push(q(rnd, 0.5)); all.hint.push(q(h0, 0.5)); all.max = Math.max(all.max, ...rnd); all.helped += helped; all.runs += RUNS;
  const g = L.goal; if (mode === 'report') console.log(`L${String(n).padStart(3)} ${L.w}x${L.h} k${L.kinds} ${L.shape.padEnd(6)} ${(g.type + ' ' + (g.kinds ? g.kinds.length + 'x' + g.each : g.pattern || g.count)).padEnd(14)} par ${String(par).padStart(2)} | hint-follower median ${String(q(h0, 0.5)).padStart(2)} | random taps: median ${String(q(rnd, 0.5)).padStart(2)} p95 ${q(rnd, 0.95)} max ${Math.max(...rnd)} helped ${Math.round(helped / RUNS * 100)}% | shuffles/100 moves ${(shuf / mv * 100).toFixed(1)}`);
}
for (let w = 0; w < 10; w++) console.log(`world ${w + 1}: hint-follower median ${q(all.hint.slice(w * 10, w * 10 + 10), 0.5)} moves, random-tapper median ${q(all.rnd.slice(w * 10, w * 10 + 10), 0.5)}, longest level for random-tapper ${Math.max(...all.rnd.slice(w * 10, w * 10 + 10))}`);
console.log('longest single game', all.max, '| games that needed the helper', Math.round(all.helped / all.runs * 100) + '%');
console.log('export const PAR = [' + pars.join(', ') + '];');
