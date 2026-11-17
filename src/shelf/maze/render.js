// Drawing a maze page as SVG (§4 "Drawing the maze"). Page units: one cell = 1. Walls are one <path> with round caps, 0.16 of a cell
// thick, #222. Under a plain maze, the theme's mat (a field, a court, a road…); under a shaped maze, its picture, faint. Openings at
// start and finish when they sit on the edge, with an arrow and a flag as in the book; the hero waits on the start, the goal sits
// on the finish; stars; six to ten theme pictures around the edge. ?debug=1 adds the solution as a dotted line.
import { artURL, MATS } from '../themes.js';
import { MARGIN } from './page.js';

const NS = 'http://www.w3.org/2000/svg';
export const el = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
export const centre = (maze, c) => [(c % maze.grid.w) + 0.5, ((c / maze.grid.w) | 0) + 0.5];
/** a theme picture (Fluent Emoji 3D), centred on (cx, cy) */
export const pic = (parent, name, cx, cy, size, cls = '') => el('image', { href: artURL(name), x: cx - size / 2, y: cy - size / 2, width: size, height: size, class: cls }, parent);

/** which outer side of a cell is open to the outside, if any: [dx, dy] */
function outside(maze, c) {
  const { w, h } = maze.grid, x = c % w, y = (c / w) | 0, live = new Set(maze.grid.cells);
  for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h || !live.has(ny * w + nx)) return [dx, dy]; }
  return null;
}

export function wallPath(maze, skip = []) {
  const { w, h } = maze.grid, live = new Set(maze.grid.cells), d = [];
  const isSkip = (c, dx, dy) => skip.some((s) => s.c === c && s.d[0] === dx && s.d[1] === dy);
  const seg = (x1, y1, x2, y2) => d.push(`M${x1} ${y1}L${x2} ${y2}`);
  for (const c of maze.grid.cells) {
    const x = c % w, y = (c / w) | 0, l = maze.links.get(c);
    const inside = (nx, ny) => nx >= 0 && ny >= 0 && nx < w && ny < h && live.has(ny * w + nx);
    const open = (nx, ny) => inside(nx, ny) && l.has(ny * w + nx);
    if (!open(x, y - 1) && !isSkip(c, 0, -1)) seg(x, y, x + 1, y);                         // top (shared walls drawn once: top and left,
    if (!open(x - 1, y) && !isSkip(c, -1, 0)) seg(x, y, x, y + 1);                         //  plus bottom and right on the outer edge)
    if (!inside(x, y + 1) && !isSkip(c, 0, 1)) seg(x, y + 1, x + 1, y + 1);
    if (!inside(x + 1, y) && !isSkip(c, 1, 0)) seg(x + 1, y, x + 1, y + 1);
  }
  return d.join('');
}

/** the ground under a plain maze, with its markings (faint, so the walls stay the clear thing to look at) */
function drawMat(g, mat, w, h) {
  const M = MATS[mat]; if (!M) return;
  el('rect', { x: -0.3, y: -0.3, width: w + 0.6, height: h + 0.6, rx: 0.45, fill: M.fill }, g);
  const s = { fill: 'none', stroke: M.mark, 'stroke-width': 0.09, opacity: 0.6, 'stroke-linecap': 'round' };
  if (M.lines === 'yards') for (let x = 1; x < w; x += 2) el('line', { ...s, x1: x, y1: -0.15, x2: x, y2: h + 0.15 }, g);
  else if (M.lines === 'halfway') { el('line', { ...s, x1: -0.15, y1: h / 2, x2: w + 0.15, y2: h / 2 }, g); el('circle', { ...s, cx: w / 2, cy: h / 2, r: Math.min(w, h) * 0.18 }, g); }
  else if (M.lines === 'key') { el('circle', { ...s, cx: w / 2, cy: h / 2, r: Math.min(w, h) * 0.16 }, g); el('rect', { ...s, x: w * 0.3, y: -0.15, width: w * 0.4, height: h * 0.2 }, g); el('rect', { ...s, x: w * 0.3, y: h * 0.8 + 0.15, width: w * 0.4, height: h * 0.2 }, g); }
  else if (M.lines === 'dashes') { el('rect', { ...s, x: -0.1, y: -0.1, width: w + 0.2, height: h + 0.2, rx: 0.3 }, g); el('line', { ...s, x1: w / 2, y1: 0.3, x2: w / 2, y2: h - 0.3, 'stroke-dasharray': '0.5 0.5', 'stroke-width': 0.14 }, g); }
  else if (M.lines === 'bays') for (let x = 1; x < w; x++) { el('line', { ...s, x1: x, y1: -0.2, x2: x, y2: 0.6 }, g); el('line', { ...s, x1: x, y1: h - 0.6, x2: x, y2: h + 0.2 }, g); }
  else if (M.lines === 'tracks') for (const f of [0.3, 0.7]) el('path', { ...s, d: `M-0.1 ${h * f} C${w * 0.3} ${h * f - 1} ${w * 0.6} ${h * f + 1} ${w + 0.1} ${h * f}`, 'stroke-dasharray': '0.12 0.3', 'stroke-width': 0.14 }, g);
  else if (M.lines === 'waves') for (let y = 1.5; y < h; y += 3) { let d = `M-0.1 ${y}`; for (let x = 0; x < w; x += 1) d += ` q0.5 -0.35 1 0`; el('path', { ...s, d }, g); }
}

/** draw the whole page into an <svg>; returns the layers play.js draws into */
export function renderMaze(svg, page, { debug = false, mini = false } = {}) {
  svg.replaceChildren();
  const { maze, gen, shape, theme } = page, { w, h } = maze.grid, M = mini ? 0.3 : MARGIN;
  svg.setAttribute('viewBox', `${-M} ${-M} ${w + 2 * M} ${h + 2 * M}`);
  const inS = outside(maze, maze.start), outE = outside(maze, maze.end);
  const skip = [inS && { c: maze.start, d: inS }, outE && { c: maze.end, d: outE }].filter(Boolean);
  el('rect', { x: -M, y: -M, width: w + 2 * M, height: h + 2 * M, fill: 'transparent' }, svg);
  const ground = el('g', { class: 'ground' }, svg), decor = el('g', { class: 'decor' }, svg), solution = el('g', { class: 'solution' }, svg);
  const trail = el('g', { class: 'trail' }, svg), walls = el('g', {}, svg), stars = el('g', { class: 'stars' }, svg), marks = el('g', {}, svg), hints = el('g', { class: 'hints' }, svg), fx = el('g', {}, svg);
  if (shape && gen.shape) {                                       // the shape's own picture, faint, exactly behind its outline
    const [x0, y0, bw, bh] = shape.box, iw = w / bw, ih = h / bh;
    el('image', { href: artURL(gen.shape), x: -x0 * iw, y: -y0 * ih, width: iw, height: ih, preserveAspectRatio: 'none', opacity: mini ? 0.25 : 0.3 }, ground);
  } else drawMat(ground, gen.mat, w, h);
  el('path', { d: wallPath(maze, skip), fill: 'none', stroke: '#222', 'stroke-width': 0.16, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, walls);
  if (debug) el('polyline', { points: maze.path.map((c) => centre(maze, c).join(',')).join(' '), fill: 'none', stroke: '#e0245e', 'stroke-width': 0.08, 'stroke-dasharray': '0.12 0.14', 'stroke-linecap': 'round' }, solution);
  if (mini) return { svg, trail, fx, marks, solution, stars, hints };
  for (const d of page.decor) pic(decor, d.name, d.x, d.y, d.size).setAttribute('transform', `rotate(${d.turn} ${d.x} ${d.y})`);
  [...page.stars.map((c) => [c, false]), ...page.bonus.map((c) => [c, true])].forEach(([c, bonus]) => {
    const [x, y] = centre(maze, c), g = el('g', { class: 'star' + (bonus ? ' bonus' : ''), 'data-cell': c, transform: `translate(${x} ${y})` }, stars);
    el('path', { d: starPath(0.32, 0.14), fill: bonus ? '#c58bff' : '#ffd23f', stroke: '#222', 'stroke-width': 0.05, 'stroke-linejoin': 'round' }, g);
  });
  const [sx, sy] = centre(maze, maze.start), [ex, ey] = centre(maze, maze.end);
  if (inS) {                                                      // an arrow outside the opening, pointing in
    const ax = sx + inS[0] * 0.95, ay = sy + inS[1] * 0.95, ang = Math.atan2(-inS[1], -inS[0]) * 180 / Math.PI;
    el('path', { d: 'M-0.32 -0.2 L0.08 -0.2 L0.08 -0.36 L0.36 0 L0.08 0.36 L0.08 0.2 L-0.32 0.2 Z', fill: '#2dbb5a', stroke: '#1b6f37', 'stroke-width': 0.05, 'stroke-linejoin': 'round', transform: `translate(${ax} ${ay}) rotate(${ang})` }, marks);
  }
  if (outE) pic(marks, 'Chequered flag', ex + outE[0] * 0.95, ey + outE[1] * 0.95, 0.8);       // the chequered flag outside the finish
  pic(marks, theme.goal, ex, ey, 0.85, 'goal');
  pic(marks, theme.hero, sx, sy, 0.7, 'hero');
  return { svg, trail, fx, marks, solution, stars, hints };
}
export function starPath(R, r) {
  let d = ''; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r : R; d += `${i ? 'L' : 'M'}${(Math.cos(a) * q).toFixed(3)} ${(Math.sin(a) * q).toFixed(3)}`; }
  return d + 'Z';
}
