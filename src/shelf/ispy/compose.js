// Building a hidden-picture scene (§5): fill the set's zones with clutter (evenly spaced, nearer = bigger, sorted so nearer things
// overlap farther ones, sizes ±15 %, mirrored at random), then hide the targets by the level's rules, then PROVE every target can be
// found: its 32 × 32 silhouette is checked against everything drawn above it, and it is moved (or finally brought to the front) until
// enough of it shows. The same masks do the hit-testing, so this runs the same in the browser and in tests. Scene units: 1200 × 900.
import { rng } from '../maze/gen.js';
import { SETS } from './sets.js';

export const W = 1200, H = 900, MIN_APART = 70;
/** per level: targets, smallest target (scene units ≈ CSS px at the usual 3/4 scale), turn, how much may be covered, clutter density, tricks */
export const LEVELS = [null,
  { k: 4, min: 90, turn: 0, cover: 0, density: 0.42 },
  { k: 5, min: 88, turn: 0, cover: 0, density: 0.5 },
  { k: 6, min: 76, turn: 20, cover: 0.15, density: 0.62 },
  { k: 6, min: 74, turn: 20, cover: 0.15, density: 0.68, count: true },
  { k: 8, min: 66, turn: 60, cover: 0.25, density: 0.78, count: true, similar: true },
  { k: 8, min: 64, turn: 60, cover: 0.25, density: 0.84, count: true, similar: true },
  { k: 10, min: 60, turn: 180, cover: 0.35, density: 0.92, count: true, odd: true, words: true },
  { k: 10, min: 60, turn: 180, cover: 0.35, density: 0.98, count: true, odd: true, words: true },
  { k: 12, min: 58, turn: 180, cover: 0.4, density: 1.04, count: true, decoys: 2, words: true },
  { k: 12, min: 58, turn: 180, cover: 0.4, density: 1.1, count: true, decoys: 2, words: true },
];
const sizeAt = (depth) => 72 + 58 * depth;                 // far things small, near things big

/** masks as 32 rows of bits, made once per art set */
const cache = new WeakMap();
function bits(art) {
  if (!cache.has(art)) { const m = {}; for (const id of art.ids) m[id] = Uint32Array.from(art.masks[id], (r) => parseInt(r, 16) >>> 0); cache.set(art, m); }
  return cache.get(art);
}
/** is scene point (x, y) on item's silhouette? */
export function onItem(art, it, x, y) {
  const dx = x - it.x, dy = y - it.y; if (dx * dx + dy * dy > it.s * it.s * 0.5) return false;
  const a = -it.r * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  let lx = dx * c - dy * s, ly = dx * s + dy * c; if (it.f < 0) lx = -lx;
  const u = Math.floor((lx / it.s + 0.5) * 32), v = Math.floor((ly / it.s + 0.5) * 32);
  if (u < 0 || v < 0 || u > 31 || v > 31) return false;
  return ((bits(art)[it.id][v] >>> (31 - u)) & 1) === 1;
}
/** the silhouette's cells in scene coordinates */
function cells(art, it) {
  const out = [], m = bits(art)[it.id], a = it.r * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  for (let v = 0; v < 32; v++) for (let u = 0; u < 32; u++) if ((m[v] >>> (31 - u)) & 1) {
    let lx = ((u + 0.5) / 32 - 0.5) * it.s; const ly = ((v + 0.5) / 32 - 0.5) * it.s; if (it.f < 0) lx = -lx;
    out.push([it.x + lx * c - ly * s, it.y + lx * s + ly * c]);
  }
  return out;
}
/** how much of item i shows, given everything drawn after it in `order` */
export function visible(art, order, i) {
  const it = order[i], pts = cells(art, it); if (!pts.length) return 1;
  const above = order.slice(i + 1).filter((o) => Math.hypot(o.x - it.x, o.y - it.y) < (o.s + it.s) * 0.72);
  let open = 0;
  for (const [x, y] of pts) if (x >= 0 && y >= 0 && x <= W && y <= H && !above.some((o) => onItem(art, o, x, y))) open++;
  return open / pts.length;
}
/** how alike two outlines are (0..1) */
function alike(art, a, b) { const A = bits(art)[a], B = bits(art)[b]; let and = 0, or = 0; for (let v = 0; v < 32; v++) { const x = A[v] & B[v], y = A[v] | B[v]; for (let n = x; n; n &= n - 1) and++; for (let n = y; n; n &= n - 1) or++; } return or ? and / or : 0; }

const inPoly = (poly, x, y) => { let inside = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside; } return inside; };
const bounds = (poly) => [Math.min(...poly.map((p) => p[0])), Math.min(...poly.map((p) => p[1])), Math.max(...poly.map((p) => p[0])), Math.max(...poly.map((p) => p[1]))];
const depthOf = (z, y) => (Array.isArray(z.depth) ? (() => { const [, y0, , y1] = bounds(z.poly); return z.depth[0] + (z.depth[1] - z.depth[0]) * Math.max(0, Math.min(1, (y - y0) / (y1 - y0))); })() : z.depth);

/** a random spot in a zone: { x, base (where it stands), depth, kind } */
function spot(z, rand) {
  if (z.kind === 'shelf') return { x: z.x0 + rand() * (z.x1 - z.x0), base: z.y, depth: z.depth, kind: 'shelf' };
  const [x0, y0, x1, y1] = bounds(z.poly);
  for (let n = 0; n < 50; n++) { const x = x0 + rand() * (x1 - x0), y = y0 + rand() * (y1 - y0); if (inPoly(z.poly, x, y)) return { x, base: y, depth: depthOf(z, y), kind: z.kind }; }
  return { x: (x0 + x1) / 2, base: (y0 + y1) / 2, depth: depthOf(z, (y0 + y1) / 2), kind: z.kind };
}
/** an item standing at a spot: ground and shelf things rest their silhouette's bottom on the baseline */
function place(art, id, sp, s, r, f) {
  const b = art.boxes[id] || [0, 0, 1, 1], y = sp.kind === 'float' ? sp.base : sp.base - (b[3] - 0.5) * s;
  return { id, x: Math.max(s * 0.4, Math.min(W - s * 0.4, sp.x)), y: Math.max(s * 0.4, Math.min(H - s * 0.4, y)), s, r, f, base: sp.kind === 'float' ? sp.base + s * 0.3 : sp.base };
}
const zoneArea = (z) => (z.kind === 'shelf' ? (z.x1 - z.x0) * 90 : (() => { const [x0, y0, x1, y1] = bounds(z.poly); return (x1 - x0) * (y1 - y0); })());

export function composeScene({ theme, level, seed }, art, setName) {
  const L = LEVELS[level], rand = rng(seed ^ 0x6a09e667), set = SETS[setName], zones = set.zones;
  const pickZone = (filter = () => true) => { const zs = zones.filter(filter); if (!zs.length) return pickZone(); let t = rand() * zs.reduce((a, z) => a + zoneArea(z) * (z.density ?? 1), 0); for (const z of zs) if ((t -= zoneArea(z) * (z.density ?? 1)) <= 0) return z; return zs.at(-1); };
  const ids = art.ids.slice(); for (let i = ids.length - 1; i > 0; i--) { const j = (rand() * (i + 1)) | 0; [ids[i], ids[j]] = [ids[j], ids[i]]; }

  // 1. the targets (things that appear nowhere in the clutter), and one counting clue from level 4
  const targetIds = ids.slice(0, L.k), counted = L.count ? targetIds[L.k - 1] : null;
  let pool = ids.slice(L.k);
  // decoys (levels 9–10): for each target, the two most alike outlines in the pool are kept for the clutter
  const decoys = [];
  if (L.decoys) for (const t of targetIds) { pool.slice().sort((a, b) => alike(art, t, b) - alike(art, t, a)).slice(0, L.decoys).forEach((d) => decoys.push(d)); }

  // 2. the clutter: evenly spaced (a cheap Poisson disc) through every zone
  const items = [];
  for (const z of zones) {
    const dens = L.density * (z.density ?? 1), area = zoneArea(z), avg = sizeAt(Array.isArray(z.depth) ? (z.depth[0] + z.depth[1]) / 2 : z.depth);
    const want = Math.round((area / (avg * avg)) * dens * 1.15), gap = avg * 0.62 / Math.sqrt(dens);
    const mine = [];
    for (let n = 0; n < want * 12 && mine.length < want; n++) {
      const sp = spot(z, rand), s = sizeAt(sp.depth) * (0.85 + rand() * 0.3);
      if (mine.some((m) => Math.hypot(m.x - sp.x, m.base - sp.base) < gap)) continue;
      const id = pool[(rand() * pool.length) | 0], r = z.kind === 'float' ? (rand() - 0.5) * 70 : (rand() - 0.5) * 12;
      mine.push(place(art, id, sp, s, r, rand() < 0.5 ? -1 : 1));
    }
    items.push(...mine);
  }
  for (const d of decoys) { const sp = spot(pickZone(), rand); items.push(place(art, d, sp, sizeAt(sp.depth), (rand() - 0.5) * 2 * Math.min(L.turn, 60), rand() < 0.5 ? -1 : 1)); }

  // 3. the targets, hidden by the level's rules
  const tray = targetIds.map((id) => ({ id, word: art.words[id], count: id === counted ? 3 : 1, items: [] })), targets = [];
  const turn = () => (L.turn >= 180 ? rand() * 360 : (rand() - 0.5) * 2 * L.turn);
  const ordered = () => { const all = [...items, ...targets].sort((a, b) => a.base - b.base || a.y - b.y); return [...all.filter((o) => !o.top), ...all.filter((o) => o.top).sort((a, b) => a.top - b.top)]; };   // anything brought to the front is drawn last
  function tryPlace(t, id) {
    for (let n = 0; n < 30; n++) {
      let sp, z;
      if (L.similar && n < 15) {                               // beside clutter of a similar outline
        const near = items.filter((o) => !o.target).sort((a, b) => alike(art, id, b.id) - alike(art, id, a.id))[(rand() * 3) | 0];
        if (near) sp = { x: near.x + (rand() < 0.5 ? -1 : 1) * near.s * 0.8, base: near.base, depth: 0.5, kind: 'ground' };
      }
      if (!sp) { z = L.odd && rand() < 0.5 ? pickZone((zz) => zz.kind !== 'ground') : pickZone(); sp = spot(z, rand); }
      const s = Math.max(L.min, sizeAt(sp.depth) * (0.85 + rand() * 0.3)), it = { ...place(art, id, sp, s, turn(), rand() < 0.5 ? -1 : 1), target: t };
      if (targets.some((o) => Math.hypot(o.x - it.x, o.y - it.y) < MIN_APART + (o.s + it.s) * 0.25)) continue;
      targets.push(it);
      const order = ordered(), i = order.indexOf(it);
      if (visible(art, order, i) >= 1 - L.cover) return it;
      targets.pop();
    }
    // the clearest open spot: try forty, keep the most visible, and if even that is too covered it goes on top
    let best = null;
    for (let n = 0; n < 40; n++) {
      const sp = spot(pickZone(), rand), s = Math.max(L.min, sizeAt(sp.depth)), it = { ...place(art, id, sp, s, turn(), 1), target: t };
      if (targets.some((o) => Math.hypot(o.x - it.x, o.y - it.y) < MIN_APART + (o.s + it.s) * 0.25)) continue;
      targets.push(it); const order = ordered(), v = visible(art, order, order.indexOf(it)); targets.pop();
      if (!best || v > best.v) best = { it, v };
    }
    const it = best ? best.it : { ...place(art, id, { x: 120 + targets.length * 90, base: 860, depth: 1, kind: 'ground' }, L.min, 0, 1), target: t };
    if (!best || best.v < 1 - L.cover) it.top = true;
    targets.push(it); return it;
  }
  tray.forEach((entry, t) => { for (let c = 0; c < entry.count; c++) entry.items.push(tryPlace(t, entry.id)); });

  // 4. proof over the finished scene (a later target can cover an earlier one): anything too hidden comes to the front
  let order = ordered();
  for (let pass = 0; pass < 3; pass++) {
    const bad = order.filter((it, i) => it.target !== undefined && visible(art, order, i) < 1 - L.cover);
    if (!bad.length) break; bad.forEach((it) => { it.top = (it.top || 0) + 1 + pass; });          // to the front (and a covered front one goes in front of that)
    order = ordered();
  }
  return { set: setName, level, tray: tray.map(({ id, word, count }, t) => ({ id, word, count, t })), items: order, words: !!L.words, cover: L.cover };
}
