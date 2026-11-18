// Puzzle Shelf §7 acceptance, for every sticker page in public/stickers: piece areas sum to 1; no piece under 1.2 %; every outline
// closes (each loop is a ring of at least three points whose edges are the piece's own boundary); the label point lies inside its piece;
// every theme's 16 pictures exist. Run: node tests/shelf/sticker.test.js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { THEMES, slug } from '../../src/shelf/themes.js';

const DIR = path.resolve(import.meta.dirname, '../../public/stickers');
const inTri = (x, y, f) => { const [ax, ay, bx, by, cx, cy] = f, d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy); const u = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / d, v = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / d; return u >= -1e-9 && v >= -1e-9 && u + v <= 1 + 1e-9; };
const ekey = (a, b) => { const p = `${a[0]},${a[1]}`, q = `${b[0]},${b[1]}`; return p < q ? `${p}|${q}` : `${q}|${p}`; };

let pages = 0, pieces = 0;
for (const f of fs.readdirSync(DIR).filter((n) => n.endsWith('.json'))) {
  const page = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')), tag = f;
  const sum = page.pieces.reduce((a, p) => a + p.area, 0);
  assert.ok(Math.abs(sum - 1) < 0.005, `${tag}: areas sum to ${sum.toFixed(4)}`);
  for (const [n, p] of page.pieces.entries()) {
    assert.ok(p.area >= 0.012, `${tag} piece ${n}: ${(p.area * 100).toFixed(1)} % is under 1.2 %`);
    // the piece's own boundary: edges used by exactly one of its triangles
    const count = new Map();
    for (const t of p.facets) { const v = [[t[0], t[1]], [t[2], t[3]], [t[4], t[5]]]; for (let k = 0; k < 3; k++) { const e = ekey(v[k], v[(k + 1) % 3]); count.set(e, (count.get(e) || 0) + 1); } }
    const edges = new Set([...count].filter(([, c]) => c === 1).map(([e]) => e)), seen = new Set();
    for (const loop of p.outline) {
      assert.ok(loop.length >= 6, `${tag} piece ${n}: an outline loop has at least three points`);
      for (let i = 0; i < loop.length; i += 2) { const a = [loop[i], loop[i + 1]], b = [loop[(i + 2) % loop.length], loop[(i + 3) % loop.length]], e = ekey(a, b); assert.ok(edges.has(e), `${tag} piece ${n}: outline edge ${e} is on the piece's edge (the loop closes)`); seen.add(e); }
    }
    assert.equal(seen.size, edges.size, `${tag} piece ${n}: the outline goes all the way round`);
    assert.ok(p.facets.some((t) => inTri(p.label[0], p.label[1], t)), `${tag} piece ${n}: label inside its piece`);
    pieces++;
  }
  pages++;
}
for (const t of Object.values(THEMES)) { assert.equal(t.stickers.length, 16, `${t.id}: 16 sticker pictures`); for (const n of t.stickers) assert.ok(fs.existsSync(path.join(DIR, slug(n) + '.json')), `${t.id}: ${n} has a sticker page`); }
console.log(`sticker ok (${pages} pages, ${pieces} pieces)`);
