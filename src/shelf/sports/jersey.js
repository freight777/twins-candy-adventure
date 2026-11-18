// The number jersey (§9): a sticker-by-letter page drawn by code rather than cut from a picture — a jersey in a team's colours
// with his chosen number. Same format as the built sticker pages (pieces with facets, outline, label, area), so the sticker page
// plays it unchanged. The number is printed on the body pieces in seven-segment strokes, split so no stroke crosses a seam.
const area = (p) => Math.abs(p.reduce((a, [x, y], i) => { const [u, v] = p[(i + 1) % p.length]; return a + x * v - u * y; }, 0)) / 2;
const centroid = (p) => { const a = p.reduce((s, q) => [s[0] + q[0], s[1] + q[1]], [0, 0]); return [Math.round(a[0] / p.length), Math.round(a[1] / p.length)]; };
const fan = (p, colour) => p.slice(1, -1).map((q, i) => [...p[0], ...q, ...p[i + 2], colour]);       // convex polygon → triangles
const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };

export function makeJersey(team, number) {
  const [c1, c2] = team.colors, num = String(Math.max(0, Math.min(99, number | 0)));
  const Y0 = 214, Y1 = 374, T = 22, W = 78, mid = (Y0 + Y1) / 2, split = mid + T / 2;              // the number's box; the seam under its middle bar
  const xs = num.length === 2 ? [203, 309] : [256];
  const strokes = [];                                                                              // [rect, row] — row 0 above the seam, 1 below
  num.split('').forEach((d, k) => {
    const x0 = xs[k] - W / 2, x1 = xs[k] + W / 2;
    for (const s of SEG[d]) {
      if (s === 'a') strokes.push([rect(x0, Y0, x1, Y0 + T), 0]);
      if (s === 'g') strokes.push([rect(x0, mid - T / 2, x1, split), 0]);
      if (s === 'd') strokes.push([rect(x0, Y1 - T, x1, Y1), 1]);
      if (s === 'f') strokes.push([rect(x0, Y0, x0 + T, split), 0]);
      if (s === 'b') strokes.push([rect(x1 - T, Y0, x1, split), 0]);
      if (s === 'e') strokes.push([rect(x0, split, x0 + T, Y1), 1]);
      if (s === 'c') strokes.push([rect(x1 - T, split, x1, Y1), 1]);
    }
  });
  // the body in columns that never cut through a digit: two halves for two digits, a middle column for one
  const cols = num.length === 2 ? [150, 256, 362] : [150, 210, 302, 362];
  const parts = [
    [[[206, 96], [306, 96], [256, 150]], c2],                                                       // collar
    [[[150, 112], [206, 96], [256, 150], [256, 200], [150, 200]], c1],                              // shoulders
    [[[306, 96], [362, 112], [362, 200], [256, 200], [256, 150]], c1],
    [[[150, 112], [86, 160], [110, 214], [150, 196]], c1], [[[86, 160], [66, 176], [92, 232], [110, 214]], c2],     // sleeves and cuffs
    [[[362, 112], [362, 196], [402, 214], [426, 160]], c1], [[[426, 160], [402, 214], [420, 232], [446, 176]], c2],
    [rect(150, 418, 256, 446), c2], [rect(256, 418, 362, 446), c2],                                 // the hem
  ];
  for (let i = 0; i + 1 < cols.length; i++) { parts.push([rect(cols[i], 200, cols[i + 1], split), c1, 0, cols[i], cols[i + 1]]); parts.push([rect(cols[i], split, cols[i + 1], 418), c1, 1, cols[i], cols[i + 1]]); }
  const total = parts.reduce((a, [p]) => a + area(p), 0);
  const pieces = parts.map(([poly, colour, row, xa, xb]) => {
    const facets = fan(poly, colour);
    if (row !== undefined) {                                                                       // number strokes inside this piece
      const mine = strokes.filter(([r, rr]) => { const cx = (r[0][0] + r[1][0]) / 2; return rr === row && cx >= xa && cx <= xb; }).map(([r]) => r);
      for (const r of mine) facets.push(...fan(r.map(([x, y], i) => [x + (i === 0 || i === 3 ? -3 : 3), y + (i < 2 ? -3 : 3)]), '#ffffff'));   // all the white edges first,
      for (const r of mine) facets.push(...fan(r, c2));                                                                                       // then the colour over them
    }
    return { area: +(area(poly) / total).toFixed(4), label: centroid(poly), outline: [poly.flat()], facets };
  }).sort((a, b) => b.area - a.area);
  return { id: `jersey-${team.id}-${num}`, size: 512, pieces };
}
