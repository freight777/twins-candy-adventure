// Puzzle Shelf §4 acceptance. Run: node tests/shelf/maze.test.js [seeds = 1000]
//  · 1,000 seeds × 10 levels: every maze perfect (a spanning tree: every cell reachable, exactly cells − 1 links, links two-way and
//    between neighbours), start ≠ end, the solution a real path, the numbers inside the level's band;
//  · every fitted size (fitLevel dropping 1–6 levels, portrait and landscape): same checks;
//  · every theme's every shape at every level that uses shapes: the same checks on the masked grid, and the shape almost never
//    has to fall back to a plain page (the spec's "rejects masks that fail more than 1 time in 5", made much stricter);
//  · stars sit on the solution (not on start or finish), bonus stars in dead ends; page ids round-trip.
import assert from 'node:assert/strict';
import { makeMaze, flood, LEVELS } from '../../src/shelf/maze/gen.js';
import { fitted, buildPage, shapeGrid, scaleBand } from '../../src/shelf/maze/page.js';
import { THEMES } from '../../src/shelf/themes.js';
import { hexCircle, roundGrid } from '../../src/shelf/maze/grids.js';
import { pageId, parsePage, hash } from '../../src/shelf/engine/pageid.js';

const SEEDS = +process.argv[2] || 1000, t0 = Date.now();
function perfect(m, L, tag) {
  const { grid, links } = m; let edges = 0;
  for (const [c, set] of links) for (const d of set) { edges++; assert.ok(links.get(d).has(c), `${tag}: links are two-way`); assert.ok(grid.neighbours(c).includes(d), `${tag}: links join neighbours`); }
  assert.equal(edges / 2, grid.cells.length - 1, `${tag}: a perfect maze has cells − 1 links`);
  assert.equal(flood(links, m.start).size, grid.cells.length, `${tag}: every cell reachable`);
  assert.notEqual(m.start, m.end, `${tag}: start ≠ end`);
  assert.equal(m.path[0], m.start); assert.equal(m.path.at(-1), m.end); assert.equal(m.path.length, m.len + 1);
  for (let i = 1; i < m.path.length; i++) assert.ok(links.get(m.path[i - 1]).has(m.path[i]), `${tag}: solution steps are open`);
  assert.ok(m.choices >= L.choices[0] && m.choices <= L.choices[1] && m.longestTrap <= L.trap, `${tag}: inside the band (${m.choices} in ${L.choices}, trap ${m.longestTrap} ≤ ${L.trap})`);
}
let n = 0;
for (let level = 1; level <= 10; level++) for (let s = 1; s <= SEEDS; s++) { perfect(makeMaze(level, s * 7907), LEVELS[level], `L${level} s${s}`); n++; }
const plain = n;

for (let L = 2; L <= 10; L++) for (let k = Math.max(1, L - 6); k < L; k++) for (const land of [false, true]) {
  const f = fitted(L, k, land);
  for (let s = 1; s <= Math.ceil(SEEDS / 5); s++) { perfect(makeMaze(L, s * 6007, undefined, f), f, `fit L${L}→${k}${land ? ' landscape' : ''} s${s}`); n++; }
}
const fits = n - plain;

const fallbacks = [];
for (const theme of Object.values(THEMES)) for (const shape of theme.shapes) for (let L = 3; L <= 10; L++) {
  const f = fitted(L, L), g = shapeGrid(shape, f); assert.ok(g, `${shape}: has a silhouette`);
  const gen = { ...f, w: g.w, h: g.h, choices: scaleBand(f, g.count), mat: theme.mats[0], shape };
  let fell = 0; const runs = Math.ceil(SEEDS / 20);
  for (let s = 1; s <= runs; s++) {
    const p = buildPage({ type: 'maze', theme: theme.id, level: L, seed: s * 4099 + L }, gen);
    if (!p.gen.shape) { fell++; perfect(p.maze, p.gen, `${shape} L${L} fallback`); continue; }
    perfect(p.maze, p.gen, `${theme.id}/${shape} L${L} s${s}`);
    const live = new Set(p.maze.grid.cells); for (const c of p.maze.grid.cells) assert.ok(p.shape.mask(c % p.gen.w, (c / p.gen.w) | 0), 'only shape cells are used');
    assert.equal(live.size, p.shape.count);
    n++;
  }
  if (fell / runs > 0.05) fallbacks.push(`${theme.id}/${shape} L${L}: ${fell}/${runs} fell back to a plain page`);
}
assert.deepEqual(fallbacks, [], 'shapes that cannot make their mazes:\n' + fallbacks.join('\n'));

// stars and decoration on a spread of real pages (the page decides plain or shaped itself)
for (const theme of Object.keys(THEMES)) for (let L = 1; L <= 10; L++) for (let s = 1; s <= 20; s++) {
  const p = buildPage({ type: 'maze', theme, level: L, seed: hash(theme, L, s) }, null, null), on = new Set(p.maze.path);
  assert.equal(new Set(p.stars).size, 3, 'three different stars'); for (const c of p.stars) assert.ok(on.has(c) && c !== p.maze.start && c !== p.maze.end, 'stars on the way');
  for (const c of p.bonus) assert.ok(!on.has(c) && p.maze.links.get(c).size === 1, 'bonus stars in dead ends');
  assert.ok(p.decor.length >= 6 && p.decor.length <= 10, 'six to ten pictures around the page');
}

// Phase 6 grids: geometry that agrees with itself, and pages that make their mazes
for (const g of [hexCircle(9, 10, 4.2), hexCircle(21, 24, 10.1), roundGrid(3), roundGrid(6), roundGrid(11)]) {
  const tag = `${g.kind} ${g.cells.length} cells`;
  for (const c of g.cells) {
    const [x, y] = g.centre(c); assert.equal(g.cellAt(x, y), c, `${tag}: the centre of ${c} is in ${c}`);
    assert.ok(x > 0 && y > 0 && x < g.size[0] && y < g.size[1], `${tag}: ${c} inside the drawing`);
    for (const d of g.neighbours(c)) { assert.ok(g.neighbours(d).includes(c), `${tag}: neighbours both ways`); const [u, v] = g.centre(d), dist = Math.hypot(x - u, y - v); assert.ok(dist > 0.75 && dist < 2.4, `${tag}: ${c}–${d} ${dist.toFixed(2)} apart`); }
  }
  assert.ok(g.cells.some((c) => g.outside(c)), `${tag}: has an edge`);
}
let specials = 0;
for (let L = 4; L <= 10; L++) for (let s = 1; s <= Math.ceil(SEEDS / 5); s++) {
  const p = buildPage({ type: 'maze', theme: 'gameday', level: L, seed: s * 3301 + L }, null, { w: 1100, h: 760 });
  if (!p.gen.grid) continue; specials++;
  perfect(p.maze, p.gen, `${p.gen.grid} L${L} s${s}`);
  const again = buildPage({ type: 'maze', theme: 'gameday', level: L, seed: s * 3301 + L }, JSON.parse(JSON.stringify(p.gen)));
  assert.deepEqual(again.maze.path, p.maze.path, 'a saved honeycomb or round page comes back the same');
  const [W, H] = p.maze.grid.size; assert.ok((W + 2.2) * 30 <= 1100 + 1 && (H + 2.2) * 30 <= 760 + 1, `${p.gen.grid} L${L}: fits at 30 px a corridor (${W}×${H})`);
}
assert.ok(specials > SEEDS / 5, `honeycomb and round pages turn up (${specials})`);

assert.equal(pageId(parsePage('maze:gameday:5:1234')), 'maze:gameday:5:1234');
assert.equal(hash('maze-gameday', 7), hash('maze-gameday', 7)); assert.notEqual(hash('maze-gameday', 7), hash('maze-gameday', 8));
console.log(`maze ok (${plain} level mazes, ${fits} fitted, ${n - plain - fits} shaped; ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
