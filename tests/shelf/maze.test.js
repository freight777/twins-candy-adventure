// Puzzle Shelf §4 acceptance (Phase 0 part): 1,000 seeds × 10 levels — every maze is perfect (a spanning tree: every cell reachable,
// exactly cells − 1 links, links symmetric and between grid neighbours), start ≠ end, the solution is a real path from start to end,
// and the numbers sit inside the level's band. Shaped masks join in Phase 1. Run: node tests/shelf/maze.test.js
import assert from 'node:assert/strict';
import { makeMaze, flood, LEVELS } from '../../src/shelf/maze/gen.js';
import { pageId, parsePage, hash } from '../../src/shelf/engine/pageid.js';

const SEEDS = +process.argv[2] || 1000;
let n = 0;
for (let level = 1; level <= 10; level++) {
  const L = LEVELS[level];
  for (let s = 1; s <= SEEDS; s++) {
    const m = makeMaze(level, s * 7907), { grid, links } = m;
    let edges = 0;
    for (const [c, set] of links) for (const d of set) { edges++; assert.ok(links.get(d).has(c), 'links are two-way'); assert.ok(grid.neighbours(c).includes(d), 'links join neighbours'); }
    assert.equal(edges / 2, grid.cells.length - 1, `L${level} s${s}: a perfect maze has cells − 1 links`);
    assert.equal(flood(links, m.start).size, grid.cells.length, `L${level} s${s}: every cell reachable`);
    assert.notEqual(m.start, m.end);
    assert.equal(m.path[0], m.start); assert.equal(m.path.at(-1), m.end); assert.equal(m.path.length, m.len + 1);
    for (let i = 1; i < m.path.length; i++) assert.ok(links.get(m.path[i - 1]).has(m.path[i]), 'solution steps are open');
    assert.ok(m.choices >= L.choices[0] && m.choices <= L.choices[1] && m.longestTrap <= L.trap, `L${level} s${s}: inside the band`);
    n++;
  }
}
// page ids round-trip, and a book page is the same page every time
assert.equal(pageId(parsePage('maze:gameday:5:1234')), 'maze:gameday:5:1234');
assert.equal(hash('maze-gameday', 7), hash('maze-gameday', 7)); assert.notEqual(hash('maze-gameday', 7), hash('maze-gameday', 8));
console.log(`maze ok (${n} mazes)`);
