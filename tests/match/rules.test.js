// tests/rules.test.js — the rule book, checked on boards laid out by hand. Run: node tests/rules.test.js (or wrap in vitest).
import assert from 'node:assert/strict';
import { createGame, play, ROW, BURST, STAR, RAINBOW } from '../../src/match/game/engine.js';
const level = (preset) => ({ w: 5, h: 5, kinds: 4, par: 1e9, goal: { type: 'pop', count: 1e9 }, preset });
const kinds = (g) => g.cells.map((c) => c.k).join('');

// 4 in a row → a row-clearing power-up, left on the square the child moved
let g = createGame(level(['23013', '00102', '12321', '31230', '23103']), 1), steps = play(g, { a: 2, b: 7 });
let first = steps.find((s) => s.t === 'clear');
assert.deepEqual(first.cells.sort((a, b) => a - b), [5, 6, 7, 8]); assert.equal(first.made[0].sp, ROW); assert.equal(first.made[0].i, 7); assert.equal(g.got.specials >= 1, true);

// tapping it clears its whole row
let at = g.cells.findIndex((c) => c.sp === ROW);
if (at >= 0) { const y = (at / 5) | 0; first = play(g, { tap: at }).find((s) => s.t === 'clear'); for (let x = 0; x < 5; x++) assert.ok(first.cells.includes(y * 5 + x)); }

// 5 in a row → a rainbow star
g = createGame(level(['23013', '00100', '12321', '31230', '23103']), 1); first = play(g, { a: 2, b: 7 }).find((s) => s.t === 'clear');
assert.equal(first.made[0].sp, STAR); assert.equal(g.cells.some((c) => c.k === RAINBOW) || g.got.specials >= 1, true);

// swapping a rainbow star with a piece clears every piece of that kind
at = g.cells.findIndex((c) => c.sp === STAR);
if (at >= 0) { const nb = at % 5 < 4 ? at + 1 : at - 1, k = g.cells[nb].k; if (k >= 0 && !g.cells[nb].sp) { const had = g.cells.map((c, i) => (c.k === k ? i : -1)).filter((i) => i >= 0 && i !== nb);
  first = play(g, { a: at, b: nb }).find((s) => s.t === 'clear'); for (const i of had) assert.ok(first.cells.includes(i)); } }

// an L or T shape → a burst
g = createGame(level(['23013', '00123', '12031', '31020', '23103']), 1); first = play(g, { a: 2, b: 7 }).find((s) => s.t === 'clear');
assert.equal(first.made[0].sp, BURST); assert.equal(first.cells.length, 5);

// a swap that lines nothing up is refused and changes nothing
g = createGame(level(['23013', '00102', '12321', '31230', '23103']), 1); const before = kinds(g);
assert.equal(play(g, { a: 0, b: 1 }), null); assert.equal(kinds(g), before); assert.equal(g.moves, 0);
// so is a swap of two squares that are not neighbours (end of one row, start of the next)
assert.equal(play(g, { a: 4, b: 5 }), null);
console.log('rules ok');
