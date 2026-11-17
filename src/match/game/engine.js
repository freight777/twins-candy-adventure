// src/game/engine.js — the whole rule book for the match-3 game. No drawing, no timers, no DOM: give it a move, get back
// the list of things that happened (steps) for the screen to animate. Runs the same in the browser and in tests.
export const BABY = -1, RAINBOW = -2;                  // special piece kinds; ordinary pieces are 0 … kinds-1
export const ROW = 1, COL = 2, BURST = 3, STAR = 4;    // power-ups: clear a row, a column, a 3×3 block, or every piece of one kind

const next = (g) => { g.s = (g.s + 0x6d2b79f5) | 0; let t = Math.imul(g.s ^ (g.s >>> 15), 1 | g.s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (g, n) => (next(g) * n) | 0;
const piece = (g, k, sp = 0) => ({ id: g.uid++, k, sp });

export const SHAPES = {                                 // '.' = no square there. Every shape keeps its top row open so pieces can fall in.
  full: null,
  round: ['.#####.', '#######', '#######', '#######', '#######', '#######', '.#####.'],
  gem: ['..###..', '.#####.', '#######', '#######', '#######', '.#####.', '..###..'],
  castle: ['#.#.#.#', '#######', '#######', '#######', '#######', '#######', '#######'],
  heart: ['.##.##.', '#######', '#######', '#######', '.#####.', '..###..', '...#...'],
};
export const TILES = {                                  // where the sparkle tiles go: (x, y, w, h) → layers
  center: (x, y, w, h) => (x > 0 && y > 0 && x < w - 1 && y < h - 1 ? 1 : 0),
  rows: (x, y) => (y % 2 ? 1 : 0),
  border: (x, y, w, h) => (x === 0 || y === 0 || x === w - 1 || y === h - 1 ? 1 : 0),
  checker: (x, y) => ((x + y) % 2 ? 1 : 0),
  all: () => 1,
  deep: (x, y, w, h) => (x > 0 && y > 0 && x < w - 1 && y < h - 1 ? 2 : 1),
};

export function createGame(level, seed) {
  const { w, h } = level, n = w * h, shape = SHAPES[level.shape || 'full'];
  for (let attempt = 0; ; attempt++) {
    const g = { level, w, h, K: level.kinds, s: (seed + attempt * 7919) | 0, uid: 1, cells: new Array(n).fill(null), open: new Uint8Array(n), tiles: new Uint8Array(n),
      got: { pieces: new Array(level.kinds).fill(0), all: 0, tiles: 0, babies: 0, specials: 0 }, babies: 0, moves: 0, helped: 0, shuffles: 0, done: false };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x; g.open[i] = !shape || shape[y][x] === '#' ? 1 : 0;
      if (!g.open[i]) continue;
      if (level.goal.type === 'tiles') g.tiles[i] = TILES[level.goal.pattern](x, y, w, h);
      let k; do k = pick(g, g.K); while ((x > 1 && same(g, i - 1, k) && same(g, i - 2, k)) || (y > 1 && same(g, i - w, k) && same(g, i - 2 * w, k)));
      g.cells[i] = piece(g, level.preset ? +level.preset[y][x] : k);                 // preset = rows of digits, for tutorials and tests
    }
    if (level.goal.type === 'drop') for (let b = 0; b < (level.goal.atOnce || 1); b++) placeBaby(g);
    for (let b = 0; b < (level.gifts || 0); b++) { const spots = normals(g); if (spots.length) g.cells[spots[pick(g, spots.length)]].sp = 1 + pick(g, 3); }
    if (level.preset || moves(g).length) return g;
  }
}
const same = (g, i, k) => g.cells[i] && g.cells[i].k === k;
const normals = (g) => g.cells.map((c, i) => (c && c.k >= 0 && !c.sp ? i : -1)).filter((i) => i >= 0);
function placeBaby(g) {                                   // a baby appears in the top square of a random column that has none
  const cols = []; for (let x = 0; x < g.w; x++) { let top = -1, has = false; for (let y = 0; y < g.h; y++) { const i = y * g.w + x; if (g.open[i] && top < 0) top = i; if (g.cells[i]?.k === BABY) has = true; } if (top >= 0 && !has) cols.push(top); }
  if (!cols.length) return null; const i = cols[pick(g, cols.length)]; g.cells[i] = piece(g, BABY); g.babies++; return { i, id: g.cells[i].id };
}

/** Every group of 3+ in a line right now. Each group says which power-up it earns, if any. */
export function groups(g) {
  const { w, h, cells } = g, H = new Uint8Array(w * h), V = new Uint8Array(w * h);
  const scan = (len, step, at, out) => { for (let a = 0; a < len.outer; a++) { let run = 1; for (let b = 1; b <= len.inner; b++) {
    const i = at(a, b), p = at(a, b - 1), ok = b < len.inner && cells[i] && cells[p] && cells[i].k >= 0 && cells[i].k === cells[p].k;
    if (ok) run++; else { if (run >= 3) for (let r = 1; r <= run; r++) out[at(a, b - r)] = run; run = 1; } } } };
  scan({ outer: h, inner: w }, 1, (y, x) => y * w + x, H);
  scan({ outer: w, inner: h }, w, (x, y) => y * w + x, V);
  const seen = new Uint8Array(w * h), out = [];
  for (let s = 0; s < w * h; s++) {
    if (seen[s] || !(H[s] || V[s])) continue;
    const grp = { cells: [], k: cells[s].k, sp: 0 }, q = [s]; seen[s] = 1; let longH = 0, longV = 0, cross = -1;
    while (q.length) { const i = q.pop(), x = i % w; grp.cells.push(i); longH = Math.max(longH, H[i]); longV = Math.max(longV, V[i]); if (H[i] && V[i]) cross = i;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) if (j >= 0 && j < w * h && !seen[j] && (H[j] || V[j]) && cells[j].k === grp.k) { seen[j] = 1; q.push(j); } }
    grp.sp = Math.max(longH, longV) >= 5 ? STAR : cross >= 0 ? BURST : longH === 4 ? ROW : longV === 4 ? COL : 0;
    grp.at = cross >= 0 ? cross : grp.cells.slice().sort((a, b) => a - b)[grp.cells.length >> 1];
    out.push(grp);
  }
  return out;
}

/** Clear squares; any power-up among them goes off and clears more. `make` = Map(square → power-up to leave behind). */
function blast(g, start, make, steps, colour) {
  const { w, h, cells } = g, gone = new Set(), fired = [], q = [...start];
  const common = () => { const n = new Array(g.K).fill(0); cells.forEach((c) => c && c.k >= 0 && n[c.k]++); return n.indexOf(Math.max(...n)); };
  while (q.length) {
    const i = q.pop(), c = cells[i]; if (!c || c.k === BABY || gone.has(i)) continue;
    gone.add(i); if (!c.sp) continue;
    fired.push({ i, sp: c.sp }); const x = i % w, y = (i / w) | 0;
    if (c.sp === ROW) for (let a = 0; a < w; a++) q.push(y * w + a);
    else if (c.sp === COL) for (let a = 0; a < h; a++) q.push(a * w + x);
    else if (c.sp === BURST) { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (x + dx >= 0 && x + dx < w && y + dy >= 0 && y + dy < h) q.push((y + dy) * w + x + dx); }
    else { const k = colour ?? common(); colour = undefined; cells.forEach((d, j) => d && d.k === k && q.push(j)); }
  }
  const made = [];
  for (const i of gone) { const c = cells[i]; if (c.k >= 0) { g.got.pieces[c.k]++; } g.got.all++; if (g.tiles[i]) { g.tiles[i]--; g.got.tiles++; } cells[i] = null; }
  for (const [i, m] of make) { cells[i] = piece(g, m.sp === STAR ? RAINBOW : m.k, m.sp); made.push({ i, sp: m.sp, k: cells[i].k, id: cells[i].id }); g.got.specials++; }
  steps.push({ t: 'clear', cells: [...gone], fired, made });
}

/** Pieces fall, new ones drop in from the top, babies that reach the bottom go home. */
function fall(g, steps) {
  const { w, h, cells, level } = g;
  for (;;) {
    const moved = [], born = [];
    for (let x = 0; x < w; x++) {
      const col = []; for (let y = 0; y < h; y++) if (g.open[y * w + x]) col.push(y * w + x);
      const keep = col.map((i) => [i, cells[i]]).filter((p) => p[1]), gap = col.length - keep.length;
      keep.forEach(([from, c], n) => { const to = col[gap + n]; cells[to] = c; if (to !== from) moved.push({ id: c.id, from, to }); });
      for (let n = gap - 1; n >= 0; n--) { const goal = level.goal, wanted = goal.type === 'collect' && next(g) < (level.luck || 0) ? goal.kinds[pick(g, goal.kinds.length)] : pick(g, g.K);
        cells[col[n]] = piece(g, wanted); born.push({ id: cells[col[n]].id, to: col[n], k: wanted, from: n - gap }); }
    }
    if (moved.length || born.length) steps.push({ t: 'fall', moved, born });                 // every level: the screen needs it to drop pieces (was only sent on 'drop' levels)
    if (level.goal.type === 'drop') while (g.babies < Math.min(level.goal.count, g.got.babies + (level.goal.atOnce || 1))) { const baby = placeBaby(g); if (!baby) break; steps.push({ t: 'baby', ...baby }); }
    const home = []; for (let x = 0; x < w; x++) for (let y = h - 1; y >= 0; y--) { const i = y * w + x; if (!g.open[i]) continue; if (cells[i]?.k === BABY) { home.push({ i, id: cells[i].id }); cells[i] = null; g.got.babies++; } break; }
    if (!home.length) return; steps.push({ t: 'home', babies: home });
  }
}

function settle(g, steps, prefer) {                       // keep clearing until nothing lines up
  for (let chain = 1; ; chain++) {
    const found = groups(g); if (!found.length) return;
    const make = new Map(), start = [];
    for (const grp of found) { start.push(...grp.cells); if (grp.sp) make.set(prefer?.find((i) => grp.cells.includes(i)) ?? grp.at, { sp: grp.sp, k: grp.k }); }
    blast(g, start, make, steps); steps.at(-1).chain = chain; fall(g, steps); prefer = null;
  }
}

/** Every move available now: { a, b } swaps two neighbours, { tap } sets off a power-up. */
export function moves(g) {
  const { w, h, cells } = g, out = [];
  for (let i = 0; i < w * h; i++) {
    const c = cells[i]; if (!c) continue;
    if (c.sp) out.push({ tap: i });
    for (const j of [i % w < w - 1 ? i + 1 : -1, i + w < w * h ? i + w : -1]) {
      const d = j >= 0 && cells[j]; if (!d) continue;
      if (c.sp || d.sp) { if (c.k !== BABY && d.k !== BABY) out.push({ a: i, b: j }); continue; }
      cells[i] = d; cells[j] = c; const ok = groups(g).length > 0; cells[i] = c; cells[j] = d;
      if (ok) out.push({ a: i, b: j });
    }
  }
  return out;
}

export function remaining(g) {
  const goal = g.level.goal;
  if (goal.type === 'collect') return goal.kinds.reduce((s, k) => s + Math.max(0, goal.each - g.got.pieces[k]), 0);
  if (goal.type === 'pop') return Math.max(0, goal.count - g.got.all);
  if (goal.type === 'tiles') return g.tiles.reduce((s, v) => s + v, 0);
  if (goal.type === 'drop') return goal.count - g.got.babies;
  return Math.max(0, goal.count - g.got.specials);       // 'make'
}

/** Play one move. Returns the steps to animate, or null if the swap makes no match (the screen just wobbles the two pieces back). */
export function play(g, m) {
  const { cells } = g, steps = [];
  if (g.done) return null;
  if (m.tap !== undefined) { if (!cells[m.tap]?.sp) return null; blast(g, [m.tap], new Map(), steps); }
  else {
    const { a, b } = m, ca = cells[a], cb = cells[b], d = Math.abs(a - b);
    if (!ca || !cb || !(d === g.w || (d === 1 && ((a / g.w) | 0) === ((b / g.w) | 0)))) return null;
    cells[a] = cb; cells[b] = ca;
    if (ca.sp || cb.sp) {
      if (ca.k === BABY || cb.k === BABY) { cells[a] = ca; cells[b] = cb; return null; }
      steps.push({ t: 'swap', a, b });
      if (ca.sp === STAR && cb.sp === STAR) blast(g, cells.map((c, i) => (c ? i : -1)).filter((i) => i >= 0), new Map(), steps);
      else if (ca.sp === STAR || cb.sp === STAR) { const other = ca.sp === STAR ? cb : ca; blast(g, [ca.sp === STAR ? b : a], new Map(), steps, other.k >= 0 ? other.k : undefined); }
      else blast(g, [ca.sp ? b : -1, cb.sp ? a : -1].filter((i) => i >= 0), new Map(), steps);
    } else {
      if (!groups(g).length) { cells[a] = ca; cells[b] = cb; return null; }
      steps.push({ t: 'swap', a, b });
    }
  }
  fall(g, steps); settle(g, steps, m.tap === undefined ? [m.a, m.b] : null);
  g.moves++;
  if (remaining(g) > 0 && g.moves >= g.level.par && (g.moves - g.level.par) % 2 === 0) help(g, steps);
  for (let n = 0; remaining(g) > 0 && !moves(g).length; n++) shuffle(g, steps, n);
  if (remaining(g) === 0) { g.done = true; steps.push({ t: 'win', moves: g.moves }); }
  return steps;
}

/** The friend flies in and does a bit of the goal for the child. Guarantees every level ends. */
function help(g, steps) {
  const { cells, w, h, level: { goal } } = g; let hit = [];
  const some = (list, n) => { const out = []; while (list.length && out.length < n) out.push(list.splice(pick(g, list.length), 1)[0]); return out; };
  if (goal.type === 'collect') { const k = goal.kinds.slice().sort((p, q) => g.got.pieces[p] - g.got.pieces[q])[0]; hit = some(cells.map((c, i) => (c && c.k === k ? i : -1)).filter((i) => i >= 0), 4); }
  else if (goal.type === 'tiles') hit = some([...g.tiles].map((v, i) => (v && cells[i] && cells[i].k !== BABY ? i : -1)).filter((i) => i >= 0), 5);
  else if (goal.type === 'drop') { let low = -1; cells.forEach((c, i) => { if (c?.k === BABY && (low < 0 || i > low)) low = i; }); for (let i = low + w; low >= 0 && i < w * h; i += w) if (cells[i]) hit.push(i); }
  else if (goal.type === 'make') { const spot = some(normals(g), 1)[0]; if (spot !== undefined) { cells[spot].sp = 1 + pick(g, 3); g.got.specials++; steps.push({ t: 'gift', i: spot, sp: cells[spot].sp }); } g.helped++; return; }
  if (!hit.length) hit = some(normals(g), 4);
  g.helped++; steps.push({ t: 'helper', cells: hit }); blast(g, hit, new Map(), steps); fall(g, steps); settle(g, steps);
}

function shuffle(g, steps, tries) {
  const spots = normals(g), kinds = spots.map((i) => g.cells[i].k);
  for (let n = 0; n < 200; n++) {
    for (let i = kinds.length - 1; i > 0; i--) { const j = pick(g, i + 1); [kinds[i], kinds[j]] = [kinds[j], kinds[i]]; }
    if (tries > 3) kinds.forEach((_, i) => (kinds[i] = pick(g, g.K)));                 // truly stuck: deal fresh pieces
    spots.forEach((i, n2) => (g.cells[i].k = kinds[n2]));
    if (!groups(g).length && moves(g).length) break;
  }
  g.shuffles++; steps.push({ t: 'shuffle', cells: spots.map((i) => ({ i, id: g.cells[i].id, k: g.cells[i].k })) });
  settle(g, steps);
}

/** How far from finished, finer-grained than remaining(): on a 'drop' level a baby one row lower counts as progress. */
function distance(g) {
  let d = remaining(g) * 100;
  if (g.level.goal.type === 'drop') g.cells.forEach((c, i) => { if (c?.k === BABY) for (let j = i + g.w; j < g.w * g.h; j += g.w) if (g.open[j]) d += 10; });
  return d;
}
/** The move the hint hand should show: the one that gets closest to the goal (ties: the one that clears the most). */
export function bestMove(g) {
  let best = null;
  for (const m of moves(g)) { const c = clone(g); c.level = { ...g.level, par: 1e9 }; const before = distance(c), all = c.got.all, sp = c.got.specials; play(c, m);
    const score = (before - distance(c)) + (c.got.all - all) + (c.got.specials - sp) * 3; if (!best || score > best.score) best = { m, score }; }
  return best?.m;
}
export const clone = (g) => ({ ...g, cells: g.cells.map((c) => (c ? { ...c } : null)), tiles: g.tiles.slice(), got: { ...g.got, pieces: g.got.pieces.slice() } });
