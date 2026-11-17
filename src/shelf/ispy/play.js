// Finding things (§5 "Finding"). One finger taps or circles; two fingers pan and pinch (up to 3×).
//  · Tap: the topmost target whose silhouette, grown by an 18 px halo, holds the point.
//  · Circle: a stroke longer than 60 px whose bounding box is no bigger than three times a target and holds its centre; his own ink
//    stays as the circle when right, fades when not.
//  · Right: in line art the thing fills with colour and pops; in colour his circle stays and it hops. Tick in the tray, chime, the word.
//  · Not there: a small ripple. More than five empty taps in three seconds → a second of calm and "Look closely…". Nothing is taken away.
//  · Hints: 25 s without a find, or the "?" → the tray item pulses, then a soft spotlight over about a third of the scene, shrinking every 8 s.
import { onItem, W, H } from './compose.js';
import { el, useOf } from './render.js';

const HALO = 18, TAP = 12, CIRCLE = 60, IDLE = 25000, SHRINK = 8000;

export function playScene(layers, scene, art, look, { found: saved = [], onFind, onMiss, onCalm, onFinish, onHint }) {
  const { svg, view } = layers, items = scene.items, found = new Set(saved.filter((i) => items[i]?.target !== undefined));
  const targets = items.map((it, i) => (it.target !== undefined ? i : -1)).filter((i) => i >= 0);
  let zoom = { s: 1, x: 0, y: 0 }, stroke = null, pinch = null, idle = 0, spotT = 0, misses = [], calm = false;
  const pointers = new Map();
  found.forEach((i) => mark(i, false));

  // ---------------------------------------------------------------------------------------------- coordinates
  const rootPt = (e) => { const m = svg.getScreenCTM(); return m ? new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse()) : null; };
  const scenePt = (e) => { const p = rootPt(e); return p && { x: (p.x - zoom.x) / zoom.s, y: (p.y - zoom.y) / zoom.s }; };
  const pxPerUnit = () => (svg.getScreenCTM()?.a || 1) * zoom.s;                       // screen px per scene unit right now
  function applyZoom() {
    zoom.s = Math.max(1, Math.min(3, zoom.s));
    zoom.x = Math.min(0, Math.max(W - W * zoom.s, zoom.x)); zoom.y = Math.min(0, Math.max(H - H * zoom.s, zoom.y));
    view.setAttribute('transform', `matrix(${zoom.s} 0 0 ${zoom.s} ${zoom.x} ${zoom.y})`);
    layers.onZoom?.(zoom);
  }

  // ---------------------------------------------------------------------------------------------- finding
  function targetAt(p) {                                                                  // topmost unfound target under the point (with the halo)
    const h = HALO / pxPerUnit(), ring = [[0, 0], ...Array.from({ length: 8 }, (_, k) => [Math.cos(k * Math.PI / 4) * h, Math.sin(k * Math.PI / 4) * h])];
    for (let n = targets.length - 1; n >= 0; n--) { const i = targets[n]; if (!found.has(i) && ring.some(([dx, dy]) => onItem(art, items[i], p.x + dx, p.y + dy))) return i; }
    return -1;
  }
  function circled(pts) {
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const fits = targets.filter((i) => { const it = items[i]; return !found.has(i) && it.x >= x0 && it.x <= x1 && it.y >= y0 && it.y <= y1 && x1 - x0 <= it.s * 3 && y1 - y0 <= it.s * 3; });
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    return fits.sort((a, b) => Math.hypot(items[a].x - cx, items[a].y - cy) - Math.hypot(items[b].x - cx, items[b].y - cy))[0] ?? -1;
  }
  /** show a find: colour (line look) or a circle and a hop (colour look) */
  function mark(i, fresh, ownCircle = null) {
    const it = items[i], node = layers.nodes[i];
    node.classList.add('found');
    if (look === 'line') { const c = useOf('color', it.id, node, { class: 'paint' }); if (!fresh) c.style.opacity = 1; }
    if (ownCircle) ownCircle.classList.add('kept');
    else if (look === 'color') { const r = it.s * 0.62; el('ellipse', { cx: it.x, cy: it.y, rx: r * 1.08, ry: r, class: 'ring' + (fresh ? ' fresh' : ''), transform: `rotate(-8 ${it.x} ${it.y})` }, layers.ink); }
    if (fresh) { node.classList.remove('pop'); void node.getBoundingClientRect(); node.classList.add('pop'); }
  }
  function find(i, ownCircle) {
    found.add(i); mark(i, true, ownCircle); clearSpot(); restartIdle();
    const t = items[i].target, all = targets.filter((j) => items[j].target === t), done = all.every((j) => found.has(j));
    onFind(i, t, done, [...found]);
    if (targets.every((j) => found.has(j))) { clearTimeout(idle); onFinish([...found]); }
  }
  function miss(p) {
    const r = el('circle', { cx: p.x, cy: p.y, r: 10 / zoom.s, class: 'ripple' }, layers.fx); setTimeout(() => r.remove(), 700);
    const now = performance.now(); misses = misses.filter((t) => now - t < 3000); misses.push(now); onMiss();
    if (misses.length > 5) { misses = []; calm = true; svg.classList.add('calm'); onCalm(); setTimeout(() => { calm = false; svg.classList.remove('calm'); }, 1000); }
  }

  // ---------------------------------------------------------------------------------------------- hints
  function restartIdle() { clearTimeout(idle); idle = setTimeout(() => hint(), IDLE); }
  function clearSpot() { clearTimeout(spotT); layers.spot.replaceChildren(); }
  function hint() {
    const left = targets.filter((i) => !found.has(i)); if (!left.length) return;
    const i = left[0], it = items[i]; onHint(it.target);
    clearSpot(); restartIdle();
    let r = Math.sqrt((W * H) / 3 / Math.PI), off = r * 0.45, ang = Math.random() * Math.PI * 2;
    const id = 'spot' + Math.random().toString(36).slice(2, 7);
    const draw = () => {
      layers.spot.replaceChildren();
      const cx = it.x + Math.cos(ang) * off, cy = it.y + Math.sin(ang) * off, m = el('mask', { id }, layers.spot);
      el('rect', { x: -2000, y: -2000, width: W + 4000, height: H + 4000, fill: 'white' }, m); el('circle', { cx, cy, r, fill: 'black', class: 'hole' }, m);
      el('rect', { x: -2000, y: -2000, width: W + 4000, height: H + 4000, class: 'shade', mask: `url(#${id})` }, layers.spot);
      r = Math.max(it.s * 0.9, r * 0.72); off *= 0.5;
      spotT = setTimeout(draw, SHRINK);
    };
    spotT = setTimeout(draw, 1500);                                                         // the tray item pulses first
  }
  restartIdle();

  // ---------------------------------------------------------------------------------------------- pointers: one finger finds, two fingers zoom
  const down = (e) => {
    if (calm) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { svg.setPointerCapture(e.pointerId); } catch { /* fine */ }
    if (pointers.size === 2) {                                                              // a second finger: zoom, and any stroke is dropped
      if (stroke) { stroke.path.remove(); stroke = null; }
      const [a, b] = [...pointers.values()], m = rootPt({ clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 });
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: zoom.s, anchor: { x: (m.x - zoom.x) / zoom.s, y: (m.y - zoom.y) / zoom.s } };
      return;
    }
    if (pointers.size > 2) return;
    const p = scenePt(e); if (!p) return;
    stroke = { id: e.pointerId, pts: [p], len: 0, path: el('path', { class: 'stroke' }, layers.ink) };
    stroke.path.setAttribute('stroke-width', (9 / pxPerUnit()).toFixed(2));
    restartIdle();
  };
  const move = (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()], m = rootPt({ clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 });
      zoom.s = Math.max(1, Math.min(3, pinch.s * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d));
      zoom.x = m.x - pinch.anchor.x * zoom.s; zoom.y = m.y - pinch.anchor.y * zoom.s; applyZoom(); return;
    }
    if (!stroke || e.pointerId !== stroke.id) return;
    for (const ev of (e.getCoalescedEvents?.() || []).length ? e.getCoalescedEvents() : [e]) {
      const p = scenePt(ev), last = stroke.pts.at(-1); if (!p) continue;
      stroke.len += Math.hypot(p.x - last.x, p.y - last.y) * pxPerUnit(); stroke.pts.push(p);
    }
    stroke.path.setAttribute('d', 'M' + stroke.pts.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('L'));
  };
  const up = (e) => {
    pointers.delete(e.pointerId);
    if (pinch) { if (pointers.size < 2) pinch = null; return; }
    if (!stroke || e.pointerId !== stroke.id) return;
    const s = stroke; stroke = null;
    if (e.type === 'pointercancel') { s.path.remove(); return; }
    if (s.len < TAP) {                                                                       // a tap
      s.path.remove(); const p = s.pts[0], i = targetAt(p);
      return i >= 0 ? find(i, null) : miss(p);
    }
    const i = s.len > CIRCLE ? circled(s.pts) : -1;                                          // a circle
    if (i >= 0) return find(i, s.path);
    s.path.classList.add('fade'); setTimeout(() => s.path.remove(), 600);
    if (s.len <= CIRCLE) { const j = targetAt(s.pts[0]); if (j >= 0) return find(j, null); }  // a wobbly tap
    miss(s.pts.at(-1));
  };
  const evs = { pointerdown: down, pointermove: move, pointerup: up, pointercancel: up };
  for (const k in evs) svg.addEventListener(k, evs[k]);
  return {
    hint, get found() { return [...found]; }, get zoom() { return zoom; },
    setZoom(z) { Object.assign(zoom, z); applyZoom(); },
    destroy() { clearTimeout(idle); clearSpot(); for (const k in evs) svg.removeEventListener(k, evs[k]); },
  };
}
