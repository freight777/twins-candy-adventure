// Drawing a maze page as SVG (§4 "Drawing the maze"). Page units: one cell = 1. Walls are one <path> with round caps,
// 0.16 of a cell thick, #222. Openings at start and finish when they sit on the edge, with an arrow and a flag as in the book;
// the ball waits on the start and the goal sits on the finish. ?debug=1 adds the solution as a dotted line.
import { fluentURL } from '../../engine/fluent.js';

const NS = 'http://www.w3.org/2000/svg';
export const MARGIN = 1.1;                                    // room around the maze for the arrow, the flag and (later) decoration
export const el = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
export const centre = (maze, c) => [(c % maze.grid.w) + 0.5, ((c / maze.grid.w) | 0) + 0.5];
/** an emoji as a Fluent 3D picture when we have it, else as text */
export function pic(parent, emoji, cx, cy, size, cls = '') {
  const url = fluentURL(emoji);
  if (url) return el('image', { href: url, x: cx - size / 2, y: cy - size / 2, width: size, height: size, class: cls }, parent);
  const t = el('text', { x: cx, y: cy + size * 0.36, 'font-size': size, 'text-anchor': 'middle', class: cls }, parent); t.textContent = emoji; return t;
}

/** which outer side of a cell is open to the outside, if any: [dx, dy] */
function outside(maze, c) {
  const { w, h } = maze.grid, x = c % w, y = (c / w) | 0, live = new Set(maze.grid.cells);
  const sides = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  for (const [dx, dy] of sides) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h || !live.has(ny * w + nx)) return [dx, dy]; }
  return null;
}

export function wallPath(maze, skip = []) {
  const { w, h } = maze.grid, live = new Set(maze.grid.cells), d = [];
  const isSkip = (c, dx, dy) => skip.some((s) => s.c === c && s.d[0] === dx && s.d[1] === dy);
  const seg = (x1, y1, x2, y2) => d.push(`M${x1} ${y1}L${x2} ${y2}`);
  for (const c of maze.grid.cells) {
    const x = c % w, y = (c / w) | 0, l = maze.links.get(c);
    const open = (nx, ny) => nx >= 0 && ny >= 0 && nx < w && ny < h && live.has(ny * w + nx) && l.has(ny * w + nx);
    const inside = (nx, ny) => nx >= 0 && ny >= 0 && nx < w && ny < h && live.has(ny * w + nx);
    if (!open(x, y - 1) && !isSkip(c, 0, -1)) seg(x, y, x + 1, y);                         // top (shared walls drawn once: top and left,
    if (!open(x - 1, y) && !isSkip(c, -1, 0)) seg(x, y, x, y + 1);                         //  plus bottom and right on the outer edge)
    if (!inside(x, y + 1) && !isSkip(c, 0, 1)) seg(x, y + 1, x + 1, y + 1);
    if (!inside(x + 1, y) && !isSkip(c, 1, 0)) seg(x + 1, y, x + 1, y + 1);
  }
  return d.join('');
}

/** draw the whole page into an <svg>; returns the layers play.js draws into */
export function renderMaze(svg, maze, theme, { debug = false, mini = false } = {}) {
  svg.replaceChildren();
  const { w, h } = maze.grid, M = mini ? 0.3 : MARGIN;
  svg.setAttribute('viewBox', `${-M} ${-M} ${w + 2 * M} ${h + 2 * M}`);
  const inS = outside(maze, maze.start), outE = outside(maze, maze.end);
  const skip = [inS && { c: maze.start, d: inS }, outE && { c: maze.end, d: outE }].filter(Boolean);
  el('rect', { x: -M, y: -M, width: w + 2 * M, height: h + 2 * M, fill: 'transparent' }, svg);
  const solution = el('g', { class: 'solution' }, svg), trail = el('g', { class: 'trail' }, svg), walls = el('g', {}, svg), marks = el('g', {}, svg), fx = el('g', {}, svg);
  el('path', { d: wallPath(maze, skip), fill: 'none', stroke: '#222', 'stroke-width': 0.16, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, walls);
  if (debug) el('polyline', { points: maze.path.map((c) => centre(maze, c).join(',')).join(' '), fill: 'none', stroke: '#e0245e', 'stroke-width': 0.08, 'stroke-dasharray': '0.12 0.14', 'stroke-linecap': 'round' }, solution);
  if (!mini) {
    const [sx, sy] = centre(maze, maze.start), [ex, ey] = centre(maze, maze.end);
    if (inS) {                                                    // an arrow outside the opening, pointing in
      const ax = sx + inS[0] * 0.95, ay = sy + inS[1] * 0.95, ang = Math.atan2(-inS[1], -inS[0]) * 180 / Math.PI;
      el('path', { d: 'M-0.32 -0.2 L0.08 -0.2 L0.08 -0.36 L0.36 0 L0.08 0.36 L0.08 0.2 L-0.32 0.2 Z', fill: '#2dbb5a', stroke: '#1b6f37', 'stroke-width': 0.05, 'stroke-linejoin': 'round', transform: `translate(${ax} ${ay}) rotate(${ang})` }, marks);
    }
    if (outE) pic(marks, '\u{1F3C1}', ex + outE[0] * 0.95, ey + outE[1] * 0.95, 0.75);                // the chequered flag outside the finish
    pic(marks, theme.goal, ex, ey, 0.8, 'goal');
    pic(marks, theme.hero, sx, sy, 0.62, 'hero');
  }
  return { svg, trail, fx, marks, solution };
}
