// Phase 6 grids (§4 "Later"): a honeycomb maze cut to a circle (a soccer ball) and a round maze of rings and spokes (a basketball).
// carve, flood and measure work on any { cells, neighbours } graph, so each grid here is only geometry: where a cell's centre is
// (`centre`), which cell a point is in (`cellAt`), its walls as one SVG path (`walls`), which way its edge opens to the outside
// (`outside`) and how big the drawing is (`size`). Units: one corridor ≈ 1, like the square grid, so the 30-px finger rule holds.
// Geometry follows Jamis Buck's polar grid (Mazes for Programmers) and Red Blob Games' hexagon notes (odd-r offset rows).

const TAU = Math.PI * 2, f3 = (v) => +v.toFixed(3);

// ---------------------------------------------------------------------------------------------- honeycomb
const S = 1 / Math.sqrt(3), DY = 1.5 * S;                     // pointy-top hexagons, centres 1 apart across a row, 0.866 between rows
// neighbour offsets by direction 0..5 (east, south-east, south-west, west, north-west, north-east), for even and odd rows
const HEX_DIRS = [[[1, 0], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1]], [[1, 0], [1, 1], [0, 1], [-1, 0], [0, -1], [1, -1]]];

/** cols × rows hexagons; keep(x, y) → false removes a cell. `circle` makes the soccer-ball mask. */
export function hexGrid(cols, rows, keep = () => true) {
  const id = (x, y) => y * cols + x, cells = [];
  const centre = (c) => { const x = c % cols, y = (c / cols) | 0; return [x + 0.5 + (y & 1) * 0.5, S + y * DY]; };
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (keep(x, y, centre(id(x, y)))) cells.push(id(x, y));
  const live = new Set(cells);
  const toward = (c, k) => { const x = c % cols, y = (c / cols) | 0, [dx, dy] = HEX_DIRS[y & 1][k], nx = x + dx, ny = y + dy;
    return nx >= 0 && ny >= 0 && nx < cols && ny < rows && live.has(id(nx, ny)) ? id(nx, ny) : -1; };
  const neighbours = (c) => [0, 1, 2, 3, 4, 5].map((k) => toward(c, k)).filter((n) => n >= 0);
  const corner = (c, k) => { const [x, y] = centre(c), a = (60 * k - 30) * Math.PI / 180; return [f3(x + S * Math.cos(a)), f3(y + S * Math.sin(a))]; };
  return {
    kind: 'hex', w: cols, h: rows, cells, neighbours, centre, size: [cols + 0.5, 2 * S + (rows - 1) * DY],
    cellAt(px, py) {                                             // the nearest centre, if the point is inside its hexagon (roughly)
      const y0 = Math.round((py - S) / DY); let best = -1, bd = 0.62;
      for (let y = y0 - 1; y <= y0 + 1; y++) for (let x = Math.floor(px - 1.5); x <= Math.ceil(px + 0.5); x++) {
        if (x < 0 || y < 0 || x >= cols || y >= rows || !live.has(id(x, y))) continue;
        const [cx, cy] = centre(id(x, y)), d = Math.hypot(px - cx, py - cy); if (d < bd) { bd = d; best = id(x, y); }
      }
      return best;
    },
    walls(links, skip = []) {                                    // each shared edge once; the outer edge except the openings
      const d = [];
      for (const c of cells) for (let k = 0; k < 6; k++) {
        const n = toward(c, k);
        if (n >= 0 ? (n < c || links.get(c).has(n)) : skip.some((s) => s.c === c && s.k === k)) continue;
        const a = corner(c, k), b = corner(c, (k + 1) % 6); d.push(`M${a[0]} ${a[1]}L${b[0]} ${b[1]}`);
      }
      return d.join('');
    },
    outside(c) {                                                 // the open side that faces furthest from the middle
      const [x, y] = centre(c), [mx, my] = [cols / 2 + 0.25, (2 * S + (rows - 1) * DY) / 2]; let best = null, bd = -Infinity;
      for (let k = 0; k < 6; k++) if (toward(c, k) < 0) { const a = k * Math.PI / 3, v = [Math.cos(a), Math.sin(a)], s = (x - mx) * v[0] + (y - my) * v[1]; if (s > bd) { bd = s; best = { k, d: v }; } }
      return best;
    },
  };
}
/** a honeycomb cut to a circle of radius r */
export function hexCircle(cols, rows, r) {
  const mx = (cols + 0.5) / 2, my = (2 * S + (rows - 1) * DY) / 2;
  return hexGrid(cols, rows, (x, y, [cx, cy]) => Math.hypot(cx - mx, cy - my) <= r - 0.35);
}
/** a honeycomb in a circle about `want` cells big, no wider or taller than the box allows (in corridors) */
export function soccerGrid(want, maxW = 99, maxH = 99) {
  let r = Math.sqrt(want * 0.866 / Math.PI); r = f3(Math.max(2.2, Math.min(r, (maxW - 0.6) / 2, (maxH - 0.6) / 2)));
  const cols = Math.ceil(2 * r) + 1, rows = Math.ceil(2 * r / DY) + 1;
  return { cols, rows, r, grid: hexCircle(cols, rows, r) };
}
/** the grid a page's saved numbers describe: { grid: 'hex', w: cols, h: rows, r } or { grid: 'round', rings } */
export function gridOf(L) { return L.grid === 'hex' ? hexCircle(L.w, L.h, L.r) : L.grid === 'round' ? roundGrid(L.rings) : null; }

// ---------------------------------------------------------------------------------------------- round (rings and spokes)
/** `rings` rings around one middle cell; a ring splits its cells in two whenever they would get wider than two corridors */
export function roundGrid(rings) {
  const count = [1], start = [0];
  for (let i = 1; i < rings; i++) { const prev = count[i - 1], ratio = Math.max(1, Math.round((TAU * i / prev) / 1)); count.push(prev * ratio); start.push(start[i - 1] + prev); }
  const total = start[rings - 1] + count[rings - 1], cells = Array.from({ length: total }, (_, c) => c);
  const ringOf = (c) => { let i = rings - 1; while (start[i] > c) i--; return i; };
  const at = (i, j) => start[i] + (((j % count[i]) + count[i]) % count[i]);
  const parent = (c) => { const i = ringOf(c); return i === 0 ? -1 : at(i - 1, Math.floor((c - start[i]) * count[i - 1] / count[i])); };
  const children = (c) => { const i = ringOf(c); if (i === rings - 1) return []; const k = count[i + 1] / count[i], j = c - start[i]; return Array.from({ length: k }, (_, n) => at(i + 1, j * k + n)); };
  const neighbours = (c) => { const i = ringOf(c), j = c - start[i], out = i ? [parent(c)] : [];
    if (i && count[i] > 1) { out.push(at(i, j + 1)); if (count[i] > 2) out.push(at(i, j - 1)); }
    return out.concat(children(c)); };
  const R = rings, pt = (r, a) => [f3(R + r * Math.cos(a)), f3(R + r * Math.sin(a))];
  const span = (c) => { const i = ringOf(c), j = c - start[i], da = TAU / count[i]; return [i, j * da - Math.PI / 2, (j + 1) * da - Math.PI / 2]; };   // 12 o'clock first
  const arc = (r, a0, a1) => { const p = pt(r, a0), q = pt(r, a1); return `M${p[0]} ${p[1]}A${r} ${r} 0 0 1 ${q[0]} ${q[1]}`; };
  return {
    kind: 'round', w: 2 * R, h: 2 * R, rings, cells, neighbours, ringOf, size: [2 * R, 2 * R],
    centre(c) { if (c === 0) return [R, R]; const [i, a0, a1] = span(c); return pt(i + 0.5, (a0 + a1) / 2); },
    cellAt(px, py) {
      const dx = px - R, dy = py - R, r = Math.hypot(dx, dy), i = Math.floor(r); if (i >= rings) return -1; if (i === 0) return 0;
      const a = (Math.atan2(dy, dx) + Math.PI / 2 + TAU) % TAU; return at(i, Math.floor(a / (TAU / count[i])));
    },
    walls(links, skip = []) {
      const d = [];
      for (const c of cells) {
        if (c === 0) continue;
        const [i, a0, a1] = span(c), l = links.get(c);
        if (!l.has(parent(c))) d.push(arc(i, a0, a1));                                                   // the inner side
        const cw = at(i, c - start[i] + 1); if (!l.has(cw) || count[i] === 1) { const p = pt(i, a1), q = pt(i + 1, a1); d.push(`M${p[0]} ${p[1]}L${q[0]} ${q[1]}`); }   // the clockwise side
        if (i === rings - 1 && !skip.some((s) => s.c === c)) d.push(arc(i + 1, a0, a1));                // the rim
      }
      return d.join('');
    },
    outside(c) { if (ringOf(c) !== rings - 1) return null; const [, a0, a1] = span(c), a = (a0 + a1) / 2; return { k: 0, d: [Math.cos(a), Math.sin(a)] }; },
  };
}
/** a round maze about `want` cells big that fits the box */
export function basketballGrid(want, maxW = 99, maxH = 99) {
  const rings = Math.max(3, Math.min(Math.round(Math.sqrt(want / Math.PI)) + 1, Math.floor(Math.min(maxW, maxH) / 2)));
  return { rings, grid: roundGrid(rings) };
}
