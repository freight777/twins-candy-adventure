// After tools/build-stickers.mjs (the spec's builder, unchanged): every piece smaller than 1.2 % of the picture — a crumb the
// builder could not merge without making a neighbour bigger than 10 % — joins the neighbour it shares the most edge with (or, for
// a separate island, the nearest piece), so no sticker is too small to hold. Outlines are recomputed from the facets. Writes the
// game's files: public/stickers/<name>.json.  Run: node tools/stickers-finish.mjs [tools/.cache/stickers] [public/stickers]
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const [inDir = path.join(ROOT, 'tools/.cache/stickers'), outDir = path.join(ROOT, 'public/stickers')] = process.argv.slice(2);
const MIN = 0.012;
const key = (x, y) => `${x},${y}`;
const edgeKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
/** the boundary edges of a set of triangles: edges used by exactly one of them */
function boundary(facets) {
  const count = new Map();
  for (const f of facets) { const p = [key(f[0], f[1]), key(f[2], f[3]), key(f[4], f[5])]; for (let k = 0; k < 3; k++) { const e = edgeKey(p[k], p[(k + 1) % 3]); count.set(e, (count.get(e) || 0) + 1); } }
  return [...count].filter(([, n]) => n === 1).map(([e]) => e);
}
/** chain boundary edges into closed loops of points */
function loops(edges) {
  const adj = new Map(), used = new Set(), out = [];
  for (const e of edges) { const [a, b] = e.split('|'); (adj.get(a) || adj.set(a, []).get(a)).push(b); (adj.get(b) || adj.set(b, []).get(b)).push(a); }
  for (const e of edges) {
    if (used.has(e)) continue;
    const [start, second] = e.split('|'), loop = [start]; used.add(e); let prev = start, cur = second;
    while (cur !== start) {
      loop.push(cur);
      const nxt = (adj.get(cur) || []).find((n) => n !== prev && !used.has(edgeKey(cur, n))) ?? (adj.get(cur) || []).find((n) => !used.has(edgeKey(cur, n)));
      if (nxt === undefined) break;
      used.add(edgeKey(cur, nxt)); prev = cur; cur = nxt;
    }
    out.push(loop.flatMap((k) => k.split(',').map(Number)));
  }
  return out;
}
const len = (e) => { const [a, b] = e.split('|').map((k) => k.split(',').map(Number)); return Math.hypot(a[0] - b[0], a[1] - b[1]); };

fs.mkdirSync(outDir, { recursive: true });
let merged = 0, files = 0;
for (const f of fs.readdirSync(inDir).filter((n) => n.endsWith('.json'))) {
  const data = JSON.parse(fs.readFileSync(path.join(inDir, f), 'utf8'));
  let pieces = data.pieces.map((p) => ({ ...p, edges: new Set(boundary(p.facets)) }));
  for (;;) {
    const small = pieces.filter((p) => p.area < MIN).sort((a, b) => a.area - b.area)[0];
    if (!small || pieces.length < 2) break;
    let best = null, bestLen = 0;
    for (const p of pieces) if (p !== small) { let shared = 0; for (const e of small.edges) if (p.edges.has(e)) shared += len(e); if (shared > bestLen) { bestLen = shared; best = p; } }
    if (!best) best = pieces.filter((p) => p !== small).sort((a, b) => Math.hypot(a.label[0] - small.label[0], a.label[1] - small.label[1]) - Math.hypot(b.label[0] - small.label[0], b.label[1] - small.label[1]))[0];
    best.facets = [...best.facets, ...small.facets]; best.area = +(best.area + small.area).toFixed(4); best.edges = new Set(boundary(best.facets));
    pieces = pieces.filter((p) => p !== small); merged++;
  }
  pieces.sort((a, b) => b.area - a.area);
  const out = { id: data.id, size: data.size, pieces: pieces.map(({ area, label, facets, edges }) => ({ area, label, outline: loops([...edges]), facets })) };
  fs.writeFileSync(path.join(outDir, f), JSON.stringify(out)); files++;
}
console.log(`${files} sticker pages, ${merged} crumbs merged`);
