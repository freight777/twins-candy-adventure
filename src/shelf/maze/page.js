// Everything a maze page is, decided from its id and the screen it is first opened on (§4): the size that fits (fitLevel), whether it
// is a plain rectangle drawn on a theme mat (a field, a road…) or cut to a shape, the maze itself, the stars and the decoration.
// The result's `gen` is saved with the page, so the page stays exactly the same every time it is opened on this device.
import { makeMaze, rng, LEVELS, flood } from './gen.js';
import SHAPES from '../shapes.js';
import { THEMES, slug } from '../themes.js';

export const MIN_CELL = 30;                                   // CSS px: a finger fits in every corridor
export const MARGIN = 1.1;                                    // cells of paper around the maze (arrow, flag, decoration)

/** §4 fitLevel: the biggest level whose grid fits the box at 30 px a cell (landscape swaps w and h); each level it had to drop
 *  lowers twist by 0.1 and widens the band, so the maze is harder in kind, not smaller in feel. */
export function fitLevel(level, box) {
  const landscape = box && box.w > box.h * 1.05;
  const dims = (k) => (landscape ? [LEVELS[k].h, LEVELS[k].w] : [LEVELS[k].w, LEVELS[k].h]);
  const maxW = box ? Math.floor(box.w / MIN_CELL - 2 * MARGIN) : 99, maxH = box ? Math.floor(box.h / MIN_CELL - 2 * MARGIN) : 99;
  let k = level; while (k > 1 && (dims(k)[0] > maxW || dims(k)[1] > maxH)) k--;
  return fitted(level, k, landscape);
}
export function fitted(level, k, landscape = false) {
  const F = LEVELS[k], drop = level - k, [w, h] = landscape ? [F.h, F.w] : [F.w, F.h];
  return { level, k, w, h, twist: +Math.max(0.35, F.twist - 0.1 * drop).toFixed(2), choices: [F.choices[0], Math.round(F.choices[1] * (1 + 0.35 * drop))], trap: Math.round(F.trap * (1 + 0.3 * drop)) };
}

/** a shape's silhouette as a w × h mask of the grid: a cell is in when over 60 % of it is covered; only the biggest connected part is kept */
export function shapeMask(name, w, h) {
  const S = SHAPES[slug(name)]; if (!S) return null;
  const bits = S.rows.map((r) => BigInt('0x' + r).toString(2).padStart(S.w, '0'));
  const inCell = (x, y) => {
    let on = 0, all = 0;
    const x0 = x * S.w / w, x1 = (x + 1) * S.w / w, y0 = y * S.h / h, y1 = (y + 1) * S.h / h;
    for (let by = Math.floor(y0); by < Math.ceil(y1); by++) for (let bx = Math.floor(x0); bx < Math.ceil(x1); bx++) {
      const wt = (Math.min(bx + 1, x1) - Math.max(bx, x0)) * (Math.min(by + 1, y1) - Math.max(by, y0)); all += wt; if (bits[by]?.[bx] === '1') on += wt;
    }
    return on / all > 0.6;
  };
  const cells = new Set(); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (inCell(x, y)) cells.add(y * w + x);
  let best = new Set();
  for (const c of cells) {                                       // keep the biggest 4-connected part (a mask with islands cannot be one maze)
    if ([...best].length && best.has(c)) continue;
    const part = new Set([c]), q = [c];
    while (q.length) { const a = q.pop(), x = a % w; for (const b of [x > 0 ? a - 1 : -1, x < w - 1 ? a + 1 : -1, a - w, a + w]) if (cells.has(b) && !part.has(b)) { part.add(b); q.push(b); } }
    if (part.size > best.size) best = part;
  }
  return { mask: (x, y) => best.has(y * w + x), count: best.size, aspect: S.w / S.h, box: S.box };
}

/** the grid for a shape: about as many cells as the fitted level's rectangle, in the shape's proportions, never bigger than the box allows */
export function shapeGrid(name, fit, maxW = 99, maxH = 99) {
  const S = SHAPES[slug(name)]; if (!S) return null;
  const fill = S.rows.map((r) => BigInt('0x' + r).toString(2).split('1').length - 1).reduce((a, b) => a + b, 0) / (S.w * S.h);
  const want = (fit.w * fit.h) / Math.max(0.35, fill), aspect = S.w / S.h;
  let w = Math.round(Math.sqrt(want * aspect)), h = Math.round(want / w);
  const k = Math.min(1, maxW / w, maxH / h); w = Math.max(4, Math.floor(w * k)); h = Math.max(4, Math.floor(h * k));
  const m = shapeMask(name, w, h);
  return m && { w, h, ...m };
}

/** build a page. `saved` = the gen saved the first time (or null); `box` = the CSS-px area the art may use */
export function buildPage(spec, saved, box) {
  const theme = THEMES[spec.theme], rand = rng(spec.seed ^ 0x2c1b3c6d);
  let gen = saved;
  if (!gen) {
    const fit = fitLevel(spec.level, box), maxW = box ? Math.floor(box.w / MIN_CELL - 2 * MARGIN) : 99, maxH = box ? Math.floor(box.h / MIN_CELL - 2 * MARGIN) : 99;
    gen = { ...fit, mat: theme.mats[(rand() * theme.mats.length) | 0], shape: null };
    if (spec.level >= 3 && rand() < 0.5) {                        // a shape, if one suits this screen: it must keep three quarters of the level's cells
      const order = theme.shapes.slice(), first = (rand() * order.length) | 0; order.push(...order.splice(0, first));
      for (const name of order) { const s = shapeGrid(name, fit, maxW, maxH); if (s && s.count >= 0.75 * fit.w * fit.h) { Object.assign(gen, { shape: name, w: s.w, h: s.h, choices: scaleBand(fit, s.count) }); break; } }
    }
  } else rand();                                                   // keep the random stream in step with a fresh build
  let maze = null, shape = null;
  if (gen.shape) {
    shape = shapeMask(gen.shape, gen.w, gen.h);
    try { maze = makeMaze(gen.level, spec.seed, shape.mask, gen); } catch { maze = null; }
    if (!maze) { const f = fitted(gen.level, gen.k, gen.w < gen.h ? false : gen.w > gen.h); gen = { ...gen, ...f, shape: null }; shape = null; }   // never a dead page: plain instead
  }
  if (!maze) maze = makeMaze(gen.level, spec.seed, undefined, gen);
  return { gen, maze, shape, theme, ...extras(maze, spec, gen) };
}
/** a shaped maze has fewer cells than its rectangle: scale the band of wrong turns with it */
export function scaleBand(fit, count) { const r = count / (fit.w * fit.h); return [Math.max(1, Math.floor(fit.choices[0] * r * 0.8)), Math.max(3, Math.ceil(fit.choices[1] * r * 1.1))]; }

/** stars (three on the solution, one or two in dead ends as bonuses) and where the decoration goes */
function extras(maze, spec, gen) {
  const rand = rng(spec.seed ^ 0x51ed27), path = maze.path, onPath = new Set(path);
  const stars = [0.3, 0.55, 0.8].map((f) => path[Math.round(f * (path.length - 1))]);
  const fromPath = flood(maze.links, maze.start), ends = [];
  for (const [c, l] of maze.links) if (l.size === 1 && !onPath.has(c)) ends.push(c);
  ends.sort((a, b) => fromPath.get(b) - fromPath.get(a) || a - b);
  const bonus = ends.slice(0, Math.min(ends.length, spec.level >= 5 ? 2 : 1));
  const decor = [], n = 6 + ((rand() * 5) | 0), names = THEMES[spec.theme].decor.slice();
  for (let i = names.length - 1; i > 0; i--) { const j = (rand() * (i + 1)) | 0; [names[i], names[j]] = [names[j], names[i]]; }
  const W = gen.w, gates = [maze.start, maze.end].map((c) => [(c % W) + 0.5, ((c / W) | 0) + 0.5]), slots = n + 8;
  for (let i = 0; i < slots && decor.length < n; i++) {        // around the edge of the page, spaced out, never near the start or the finish
    const t = (i + 0.5 + (rand() - 0.5) * 0.5) / slots, per = 2 * (gen.w + gen.h); let d = t * per, x, y;
    if (d < gen.w) { x = d; y = -0.6; } else if ((d -= gen.w) < gen.h) { x = gen.w + 0.6; y = d; } else if ((d -= gen.h) < gen.w) { x = gen.w - d; y = gen.h + 0.6; } else { x = -0.6; y = gen.h - (d - gen.w); }
    const size = 0.8 + rand() * 0.25, turn = (rand() - 0.5) * 30;
    if (gates.some(([ex, ey]) => Math.hypot(ex - x, ey - y) < 1.5)) continue;
    decor.push({ name: names[decor.length % names.length], x, y, size, turn });
  }
  return { stars, bonus, decor };
}
