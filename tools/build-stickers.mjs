// tools/build-stickers.mjs — turn any picture with a transparent background into a "sticker by letter" page.
// Run: node tools/build-stickers.mjs <srcDir> <outDir> [pieces=24]
// For each <name>.png: find its silhouette, scatter points (dense along edges, sparse in flat areas), triangulate,
// colour each triangle with the average colour under it, then merge neighbouring triangles of similar colour into
// about `pieces` sticker-sized shapes. Writes <name>.json (what the game loads) and <name>.preview.svg (for checking).
// (Copied unchanged from the Puzzle Shelf build spec §7, where it is marked TESTED. In this repo: the source pictures come from
//  tools/fetch-art.mjs into tools/.cache/sticker-src; run with outDir tools/.cache/stickers, then npm run stickers copies the
//  .json files into public/stickers — the previews stay out of the app.)
import sharp from 'sharp';
import Delaunator from 'delaunator';
import { readdir, mkdir, writeFile } from 'node:fs/promises';
import { join, basename } from 'node:path';

const [srcDir, outDir, piecesArg] = process.argv.slice(2);
const PIECES = +piecesArg || 24, S = 512;                       // work at 512 × 512
const DETAIL_GAP = 11, EDGE_GAP = 20, FILL_GAP = 44, RIM_GAP = 18;   // point spacing in px: on the sharpest edges (eyes, stripes), on other colour edges, in flat areas, along the outline
const MIN_PIECE = 0.012, MAX_PIECE = 0.10;                          // a sticker is never smaller than 1.2 % or larger than 10 % of the picture
const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const hex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

await mkdir(outDir, { recursive: true });
for (const f of (await readdir(srcDir)).filter((n) => n.endsWith('.png')).sort()) {
  const name = basename(f, '.png'), rand = rng([...name].reduce((a, c) => a * 31 + c.charCodeAt(0), 7));
  const px = await sharp(join(srcDir, f)).resize(S - 32, S - 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({ top: 16, bottom: 16, left: 16, right: 16, background: { r: 0, g: 0, b: 0, alpha: 0 } }).ensureAlpha().raw().toBuffer();
  const A = (x, y) => (x < 0 || y < 0 || x >= S || y >= S ? 0 : px[(y * S + x) * 4 + 3]);
  const inside = (x, y) => A(x | 0, y | 0) > 127;
  const lum = (x, y) => { const i = (y * S + x) * 4; return 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]; };

  // 1. candidate points: outline pixels, then interior pixels ranked by how strong a colour edge they sit on
  const rim = [], inner = [];
  for (let y = 1; y < S - 1; y++) for (let x = 1; x < S - 1; x++) {
    if (!inside(x, y)) continue;
    if (!inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)) { rim.push([x, y, 0]); continue; }
    if (!inside(x - 3, y) || !inside(x + 3, y) || !inside(x, y - 3) || !inside(x, y + 3)) continue;        // keep interior points off the rim
    const gx = lum(x + 1, y) - lum(x - 1, y), gy = lum(x, y + 1) - lum(x, y - 1);
    inner.push([x, y, Math.hypot(gx, gy) + rand() * 0.5]);
  }
  // 2. accept points greedily with a minimum gap (a cheap Poisson-disc)
  const pts = [], cell = 8, grid = new Map();
  const near = (x, y, r) => { const R = Math.ceil(r / cell); for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) for (const p of grid.get(`${((x / cell) | 0) + i},${((y / cell) | 0) + j}`) || []) if (Math.hypot(p[0] - x, p[1] - y) < r) return true; return false; };
  const take = (list, gap) => { for (const [x, y] of list) if (!near(x, y, gap)) { const p = [x, y]; pts.push(p); const k = `${(x / cell) | 0},${(y / cell) | 0}`; grid.has(k) ? grid.get(k).push(p) : grid.set(k, [p]); } };
  take(rim.sort(() => rand() - 0.5), RIM_GAP);
  take(inner.filter((p) => p[2] > 70).sort((a, b) => b[2] - a[2]), DETAIL_GAP);
  take(inner.filter((p) => p[2] > 14).sort((a, b) => b[2] - a[2]), EDGE_GAP);
  take(inner.sort(() => rand() - 0.5), FILL_GAP);

  // 3. triangulate; keep triangles that are mostly inside the silhouette; colour = average of the pixels under each
  const d = Delaunator.from(pts), tris = [];
  for (let t = 0; t < d.triangles.length; t += 3) {
    const v = [d.triangles[t], d.triangles[t + 1], d.triangles[t + 2]], [a, b, c] = v.map((i) => pts[i]);
    const x0 = Math.min(a[0], b[0], c[0]), x1 = Math.max(a[0], b[0], c[0]), y0 = Math.min(a[1], b[1], c[1]), y1 = Math.max(a[1], b[1], c[1]);
    const den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
    const longest = Math.max(Math.hypot(a[0] - b[0], a[1] - b[1]), Math.hypot(b[0] - c[0], b[1] - c[1]), Math.hypot(c[0] - a[0], c[1] - a[1]));
    if (Math.abs(den) / 2 < 0.06 * longest * longest) continue;              // skip slivers (they bridge gaps in the outline)
    let n = 0, hit = 0; const sum = [0, 0, 0];
    for (let y = y0; y <= y1; y += 2) for (let x = x0; x <= x1; x += 2) {
      const u = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / den, w = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / den;
      if (u < 0 || w < 0 || u + w > 1) continue;
      n++; if (inside(x, y)) { hit++; const i = (y * S + x) * 4; sum[0] += px[i]; sum[1] += px[i + 1]; sum[2] += px[i + 2]; }
    }
    if (!n || hit / n < 0.55) continue;
    tris.push({ v, rgb: sum.map((s) => s / hit), area: Math.abs(den) / 2, piece: tris.length });
  }

  // 4. merge neighbouring triangles of similar colour until about PIECES pieces remain (sizes kept between MIN_PIECE and MAX_PIECE)
  const edgeOwner = new Map(), adj = tris.map(() => new Set());
  tris.forEach((t, i) => { for (let k = 0; k < 3; k++) { const a = t.v[k], b = t.v[(k + 1) % 3], key = a < b ? `${a},${b}` : `${b},${a}`; if (edgeOwner.has(key)) { adj[i].add(edgeOwner.get(key)); adj[edgeOwner.get(key)].add(i); } else edgeOwner.set(key, i); } });
  const total = tris.reduce((s, t) => s + t.area, 0), group = tris.map((t, i) => ({ ids: [i], rgb: t.rgb, area: t.area, nb: new Set(adj[i]) }));
  const alive = new Set(group.keys()), dist = (p, q) => Math.hypot(...p.rgb.map((v, k) => v - q.rgb[k]));
  const merge = (i, j) => { const g = group[i], h = group[j], ar = g.area + h.area;
    g.rgb = g.rgb.map((v, k) => (v * g.area + h.rgb[k] * h.area) / ar); g.area = ar; g.ids.push(...h.ids);
    for (const n of h.nb) if (n !== i) { g.nb.add(n); group[n].nb.delete(j); group[n].nb.add(i); }
    g.nb.delete(j); alive.delete(j); };
  for (;;) {
    const tooMany = alive.size > PIECES; let best = null;
    for (const i of alive) for (const j of group[i].nb) {
      const small = Math.min(group[i].area, group[j].area) / total, sum = (group[i].area + group[j].area) / total;
      if (sum > MAX_PIECE || (!tooMany && small >= MIN_PIECE)) continue;        // once the count is right, only crumbs still get absorbed
      const cost = dist(group[i], group[j]) + 600 * small;                       // similar colours first, and small pieces before big ones
      if (!best || cost < best[0]) best = [cost, Math.min(i, j), Math.max(i, j)];
    }
    if (!best) break;
    merge(best[1], best[2]);
  }

  // 5. write pieces: facets (triangles + colours), outline loops, a label spot, biggest first
  const pieces = [...alive].map((i) => group[i]).sort((a, b) => b.area - a.area).map((g) => {
    const out = new Map();                                              // directed boundary edges of this piece
    for (const id of g.ids) { const t = tris[id], [a, b, c] = t.v.map((i) => pts[i]), ccw = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) > 0, v = ccw ? t.v : [t.v[0], t.v[2], t.v[1]];
      for (let k = 0; k < 3; k++) { const p = v[k], q = v[(k + 1) % 3]; if (out.get(`${q},${p}`) !== undefined) out.delete(`${q},${p}`); else out.set(`${p},${q}`, [p, q]); } }
    const next = new Map(); for (const [p, q] of out.values()) next.has(p) ? next.get(p).push(q) : next.set(p, [q]);
    const loops = []; while (next.size) { const start = next.keys().next().value, loop = []; let p = start; do { loop.push(pts[p]); const qs = next.get(p), q = qs.pop(); if (!qs.length) next.delete(p); p = q; } while (p !== start && next.has(p)); loops.push(loop); }
    const big = g.ids.map((id) => tris[id]).sort((a, b) => b.area - a.area)[0], lab = big.v.map((i) => pts[i]);
    return { area: +(g.area / total).toFixed(4), label: [Math.round((lab[0][0] + lab[1][0] + lab[2][0]) / 3), Math.round((lab[0][1] + lab[1][1] + lab[2][1]) / 3)],
      outline: loops.map((l) => l.flat()), facets: g.ids.map((id) => [...tris[id].v.flatMap((i) => pts[i]), hex(tris[id].rgb)]) };
  });
  await writeFile(join(outDir, `${name}.json`), JSON.stringify({ id: name, size: S, pieces }));

  // preview: finished picture on the left, the puzzle (biggest 14 pieces lifted out and lettered) on the right
  const facet = (q) => `<polygon points="${q.slice(0, 6).join(' ')}" fill="${q[6]}" stroke="${q[6]}" stroke-width="1"/>`;
  const path = (p) => p.outline.map((l) => 'M' + l.join(' ') + 'Z').join('');
  const lifted = pieces.slice(0, 14);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S * 2} ${S}" width="${S * 2}" height="${S}"><rect width="${S * 2}" height="${S}" fill="#f2a58e"/>
<g>${pieces.map((p) => p.facets.map(facet).join('')).join('')}</g>
<g transform="translate(${S})">${pieces.map((p, i) => i < 14 ? `<path d="${path(p)}" fill="#fff" stroke="#333" stroke-width="1.5" fill-rule="evenodd"/><text x="${p.label[0]}" y="${p.label[1] + 6}" font-family="sans-serif" font-weight="700" font-size="17" text-anchor="middle">${String.fromCharCode(65 + i)}</text>` : p.facets.map(facet).join('')).join('')}</g></svg>`;
  await writeFile(join(outDir, `${name}.preview.svg`), svg);
  console.log(name.padEnd(20), `${pts.length} points`, `${tris.length} facets`, `${pieces.length} pieces`, `biggest ${(pieces[0].area * 100).toFixed(1)}%`, `smallest ${(pieces.at(-1).area * 100).toFixed(1)}%`, `${Math.round(JSON.stringify({ pieces }).length / 1024)} KB`);
}
