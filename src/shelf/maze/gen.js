// src/maze/gen.js — perfect-maze generator on any cell graph (square grid here; other grids only change `neighbours`).
export const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

/** Square grid, optionally masked. mask(x, y) → false removes a cell (that is how shaped mazes are made). */
export function squareGrid(w, h, mask = () => true) {
  const id = (x, y) => y * w + x, cells = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mask(x, y)) cells.push(id(x, y));
  const live = new Set(cells);
  const neighbours = (c) => { const x = c % w, y = (c / w) | 0, out = [];
    if (x > 0 && live.has(c - 1)) out.push(c - 1); if (x < w - 1 && live.has(c + 1)) out.push(c + 1);
    if (y > 0 && live.has(c - w)) out.push(c - w); if (y < h - 1 && live.has(c + w)) out.push(c + w); return out; };
  return { w, h, cells, neighbours };
}

/** Growing Tree. `twist` 0..1: 1 = always continue from the newest cell (long winding corridors, few junctions — easy to follow),
 *  0 = pick a random open cell (short dead ends everywhere — fiddly). Returns links: Map(cell → Set(cell)). */
export function carve(grid, rand, twist = 0.8) {
  const links = new Map(grid.cells.map((c) => [c, new Set()])), seen = new Set(), active = [];
  const first = grid.cells[(rand() * grid.cells.length) | 0]; seen.add(first); active.push(first);
  while (active.length) {
    const i = rand() < twist ? active.length - 1 : (rand() * active.length) | 0, c = active[i];
    const open = grid.neighbours(c).filter((n) => !seen.has(n));
    if (!open.length) { active.splice(i, 1); continue; }
    const n = open[(rand() * open.length) | 0];
    links.get(c).add(n); links.get(n).add(c); seen.add(n); active.push(n);
  }
  return seen.size === grid.cells.length ? links : null;          // null = the mask left an island; caller picks another mask/seed
}

/** Distances from one cell through the carved maze. */
export function flood(links, from) {
  const dist = new Map([[from, 0]]), q = [from];
  for (let i = 0; i < q.length; i++) for (const n of links.get(q[i])) if (!dist.has(n)) { dist.set(n, dist.get(q[i]) + 1); q.push(n); }
  return dist;
}
const farthest = (dist) => [...dist].reduce((a, b) => (b[1] > a[1] ? b : a));

/** Longest path in the maze (two floods) → start, end, the solution, and the numbers used for levelling. */
export function measure(links) {
  const a = farthest(flood(links, links.keys().next().value))[0], dA = flood(links, a), [b, len] = farthest(dA);
  const path = [b]; while (path[0] !== a) path.unshift([...links.get(path[0])].find((n) => dA.get(n) === dA.get(path[0]) - 1));
  const onPath = new Set(path);
  let deadEnds = 0, choices = 0, longestTrap = 0;
  for (const [c, l] of links) if (l.size === 1 && c !== a && c !== b) deadEnds++;
  for (const c of path) for (const n of links.get(c)) if (!onPath.has(n)) {            // a wrong turn off the solution
    choices++; const seen = new Set([c, n]), q = [[n, 1]]; let deep = 1;
    for (let i = 0; i < q.length; i++) for (const m of links.get(q[i][0])) if (!seen.has(m)) { seen.add(m); q.push([m, q[i][1] + 1]); deep = Math.max(deep, q[i][1] + 1); }
    longestTrap = Math.max(longestTrap, deep);
  }
  return { start: a, end: b, path, len, deadEnds, choices, longestTrap };
}

/** Make one maze for a level. Tries seeds until the numbers fall inside the level's band, so difficulty is consistent page to page. */
export function makeMaze(level, seed, mask) {
  const L = LEVELS[level];
  for (let k = 0; k < 200; k++) {
    const rand = rng(seed + k * 7919), grid = squareGrid(L.w, L.h, mask), links = carve(grid, rand, L.twist);
    if (!links) continue;
    const m = measure(links);
    if (m.choices >= L.choices[0] && m.choices <= L.choices[1] && m.longestTrap <= L.trap) return { grid, links, ...m, seed: seed + k * 7919, level };
  }
  throw new Error(`no maze for level ${level} seed ${seed}`);
}

// w × h cells, twist, allowed number of wrong turns off the solution, deepest allowed wrong path (in cells)
export const LEVELS = [
  null,
  { w: 4, h: 5, twist: 1.0, choices: [1, 3], trap: 3 },      // 1  first maze ever
  { w: 5, h: 6, twist: 1.0, choices: [2, 4], trap: 4 },      // 2
  { w: 6, h: 7, twist: 0.95, choices: [3, 6], trap: 5 },     // 3
  { w: 7, h: 9, twist: 0.9, choices: [4, 8], trap: 7 },      // 4
  { w: 8, h: 10, twist: 0.9, choices: [6, 11], trap: 9 },    // 5  about the book's "Level 2" page
  { w: 10, h: 12, twist: 0.85, choices: [8, 15], trap: 12 }, // 6
  { w: 11, h: 14, twist: 0.8, choices: [10, 20], trap: 16 }, // 7
  { w: 13, h: 16, twist: 0.75, choices: [14, 28], trap: 22 },// 8
  { w: 15, h: 19, twist: 0.7, choices: [18, 38], trap: 30 }, // 9
  { w: 17, h: 22, twist: 0.65, choices: [24, 50], trap: 40 },// 10 big-kid maze
];
