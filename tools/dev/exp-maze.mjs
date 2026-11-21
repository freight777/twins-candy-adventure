// Spread of the levelling numbers for fitted sizes and shapes (no band): sets fitted bands from data.
import { squareGrid, carve, measure, rng, LEVELS } from '../../src/shelf/maze/gen.js';
import { fitted, shapeMask } from '../../src/shelf/maze/page.js';
import SHAPES from '../../src/shelf/shapes.js';
const q = (a, p) => a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))];
function stats(w, h, twist, mask, n = 200) {
  const ch = [], tr = []; let islands = 0;
  for (let s = 1; s <= n; s++) { const links = carve(squareGrid(w, h, mask), rng(s * 7907), twist); if (!links) { islands++; continue; } const m = measure(links); ch.push(m.choices); tr.push(m.longestTrap); }
  return { c5: q(ch, 0.05), c50: q(ch, 0.5), c95: q(ch, 0.95), t95: q(tr, 0.95), islands };
}
const mode = process.argv[2] || 'fit';
if (mode === 'fit') for (let L = 2; L <= 10; L++) for (let k = Math.max(1, L - 6); k < L; k++) {
  const f = fitted(L, k), s = stats(f.w, f.h, f.twist);
  console.log(`L${L}->k${k} ${f.w}x${f.h} twist ${f.twist} | choices 5%=${s.c5} 50%=${s.c50} 95%=${s.c95} trap95=${s.t95} | band now ${f.choices} trap ${f.trap}`);
}
if (mode === 'shape') for (const name of Object.keys(SHAPES)) {
  const row = [];
  for (const L of [3, 5, 7, 10]) {
    const F = LEVELS[L], S = SHAPES[name], aspect = S.w / S.h, want = F.w * F.h / 0.7;
    const w = Math.round(Math.sqrt(want * aspect)), h = Math.round(want / w), m = shapeMask(name.replace(/-/g, ' '), w, h);
    if (!m) { row.push(`L${L}:nomask`); continue; }
    const s = stats(w, h, F.twist, m.mask, 60);
    row.push(`L${L} ${w}x${h} cells ${m.count}/${w * h} ch ${s.c5}-${s.c95} isl ${s.islands}`);
  }
  console.log(name.padEnd(18), row.join(' | '));
}
