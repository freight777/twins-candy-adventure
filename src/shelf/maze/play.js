// Playing a maze (§4 "Playing"): the trail is a list of cells and the ink is drawn through their centres. It will not go through
// walls; going back along the line rubs it out; lifting the finger is fine — touch the end of the line (within 1.5 cells) or
// anywhere on it to carry on. A fast swipe is walked in half-cell steps so it cannot skip a cell, and a corner cut diagonally
// still counts (a five-year-old's line rarely turns square). Every change is reported (onChange) so it can be saved at once.
import { el, centre } from './render.js';

const INK = '#2f6fff', EDGE = '#1d3f9a';

export function playMaze(layers, maze, { trail: saved, onChange, onFinish, pxPerCell }) {
  const { svg } = layers, { w } = maze.grid, live = new Set(maze.grid.cells);
  let trail = saved && saved.length && saved[0] === maze.start && valid(saved) ? saved.slice() : [maze.start];
  let finished = trail.at(-1) === maze.end, active = null;
  const edge = el('path', { fill: 'none', stroke: EDGE, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, layers.trail);
  const ink = el('path', { fill: 'none', stroke: INK, 'stroke-width': 0.42, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, layers.trail);
  const band = el('line', { stroke: INK, 'stroke-width': 0.08, 'stroke-dasharray': '0.05 0.18', 'stroke-linecap': 'round', opacity: 0 }, layers.trail);
  const heroEl = layers.marks.querySelector('.hero');

  function valid(t) { for (let i = 1; i < t.length; i++) if (!maze.links.get(t[i - 1])?.has(t[i])) return false; return true; }
  function draw() {
    const d = trail.map((c, i) => { const [x, y] = centre(maze, c); return `${i ? 'L' : 'M'}${x} ${y}`; }).join('');
    const one = trail.length === 1 ? `M${centre(maze, trail[0]).join(' ')}l0.001 0` : d;   // a dot when only the start is inked
    ink.setAttribute('d', one); edge.setAttribute('d', one);
    edge.setAttribute('stroke-width', 0.42 + 2 / (pxPerCell() || 40));                    // the slightly darker 1-px edge
    if (heroEl) { const [x, y] = centre(maze, trail.at(-1)), s = +heroEl.getAttribute('width') || 0.62; if (heroEl.tagName === 'image') { heroEl.setAttribute('x', x - s / 2); heroEl.setAttribute('y', y - s / 2); } else { heroEl.setAttribute('x', x); heroEl.setAttribute('y', y + 0.22); } }
  }
  draw();

  const toPage = (e) => { const m = svg.getScreenCTM(); if (!m) return null; const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse()); return [p.x, p.y]; };
  const cellAt = ([x, y]) => { const cx = Math.floor(x), cy = Math.floor(y); if (cx < 0 || cy < 0 || cx >= w || cy >= maze.grid.h) return -1; const c = cy * w + cx; return live.has(c) ? c : -1; };
  const near = (p, c, r) => { const [x, y] = centre(maze, c); return Math.hypot(p[0] - x, p[1] - y) <= r; };
  const linked = (a, b) => maze.links.get(a)?.has(b);

  /** one sample of the finger; true if the trail changed */
  function step(p) {
    const c = cellAt(p), head = trail.at(-1);
    if (c < 0 || c === head) return false;
    if (c === trail.at(-2)) { trail.pop(); return true; }                                   // back along the line rubs it out
    if (linked(head, c)) { trail.push(c); return true; }
    const dx = (c % w) - (head % w), dy = ((c / w) | 0) - ((head / w) | 0);
    if (Math.abs(dx) === 1 && Math.abs(dy) === 1) {                                         // a corner cut diagonally
      for (const mid of [head + dx, head + dy * w]) {
        if (mid === trail.at(-2) && trail.at(-3) === c) { trail.pop(); trail.pop(); return true; }
        if (linked(head, mid) && linked(mid, c)) { trail.push(mid, c); return true; }
      }
    }
    return false;
  }
  function follow(p) {
    let changed = false;
    const from = active.last, n = Math.max(1, Math.ceil(Math.hypot(p[0] - from[0], p[1] - from[1]) / 0.5));
    for (let i = 1; i <= n && !finished; i++) changed = step([from[0] + (p[0] - from[0]) * i / n, from[1] + (p[1] - from[1]) * i / n]) || changed;
    active.last = p;
    if (changed) { draw(); onChange(trail.slice()); if (trail.at(-1) === maze.end) { finished = true; showBand(null); onFinish(trail.slice()); return; } }
    showBand(near(p, trail.at(-1), 1.5) ? null : p);                                        // where the pen is waiting
  }
  function showBand(p) {
    if (!p) { band.setAttribute('opacity', 0); return; }
    const [x, y] = centre(maze, trail.at(-1));
    band.setAttribute('x1', x); band.setAttribute('y1', y); band.setAttribute('x2', p[0]); band.setAttribute('y2', p[1]); band.setAttribute('opacity', 0.7);
  }

  const down = (e) => {
    if (finished || !e.isPrimary) return;
    active = null;                                     // a new first finger means any earlier one has gone (even if its "up" was lost)
    const p = toPage(e); if (!p) return;
    const c = cellAt(p), at = trail.indexOf(c);
    if (!near(p, trail.at(-1), 1.5)) {
      if (at < 0) { showBand(p); return; }                                                  // not near the line: show where the pen is
      if (at < trail.length - 1) { trail = trail.slice(0, at + 1); draw(); onChange(trail.slice()); }   // touched the line: carry on from there
    }
    e.preventDefault();
    try { svg.setPointerCapture(e.pointerId); } catch { /* fine */ }
    active = { id: e.pointerId, last: p };
    follow(p);
  };
  const move = (e) => {
    if (!active || e.pointerId !== active.id) return;
    const list = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
    for (const ev of list.length ? list : [e]) { const p = toPage(ev); if (p) follow(p); if (finished) break; }
  };
  const up = (e) => { if (active && e.pointerId === active.id) { active = null; showBand(null); } };
  svg.addEventListener('pointerdown', down); svg.addEventListener('pointermove', move);
  svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up); svg.addEventListener('lostpointercapture', up);
  return {
    get trail() { return trail.slice(); }, get finished() { return finished; }, ink,
    destroy() { svg.removeEventListener('pointerdown', down); svg.removeEventListener('pointermove', move); svg.removeEventListener('pointerup', up); svg.removeEventListener('pointercancel', up); },
  };
}
