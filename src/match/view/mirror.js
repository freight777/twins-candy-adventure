// What the screen believes is on each square, kept by replaying the engine's steps one by one. The board animates from it,
// and after the last step it must equal game.cells exactly (checked in development builds and in tests/match/steps.test.js).
import { BABY } from '../game/engine.js';

export const mirrorOf = (g) => ({ cells: g.cells.map((c) => (c ? { id: c.id, k: c.k, sp: c.sp } : null)), tiles: Array.from(g.tiles) });

/** apply one step to the mirror (no drawing) */
export function applyStep(m, s) {
  const c = m.cells;
  switch (s.t) {
    case 'swap': [c[s.a], c[s.b]] = [c[s.b], c[s.a]]; break;
    case 'clear':
      for (const i of s.cells) { c[i] = null; if (m.tiles[i]) m.tiles[i]--; }
      for (const p of s.made) c[p.i] = { id: p.id, k: p.k, sp: p.sp };
      break;
    case 'fall': {
      const moving = s.moved.map((mv) => [mv, c[mv.from]]);
      for (const [mv] of moving) c[mv.from] = null;
      for (const [mv, p] of moving) c[mv.to] = p;
      for (const b of s.born) c[b.to] = { id: b.id, k: b.k, sp: 0 };
      break;
    }
    case 'baby': c[s.i] = { id: s.id, k: BABY, sp: 0 }; break;
    case 'home': for (const b of s.babies) c[b.i] = null; break;
    case 'gift': c[s.i] = { ...c[s.i], sp: s.sp }; break;
    case 'shuffle': for (const p of s.cells) c[p.i] = { ...c[p.i], k: p.k }; break;
    default: break;                                   // helper, win: nothing moves
  }
}

/** '' if the mirror matches the game, else a description of the first difference */
export function compare(m, g) {
  for (let i = 0; i < g.cells.length; i++) {
    const a = m.cells[i], b = g.cells[i];
    if (!a !== !b) return `square ${i}: screen ${a ? 'has ' + a.id : 'empty'}, game ${b ? 'has ' + b.id : 'empty'}`;
    if (a && (a.id !== b.id || a.k !== b.k || a.sp !== b.sp)) return `square ${i}: screen ${JSON.stringify(a)}, game ${JSON.stringify(b)}`;
    if (m.tiles[i] !== g.tiles[i]) return `tile ${i}: screen ${m.tiles[i]}, game ${g.tiles[i]}`;
  }
  return '';
}
