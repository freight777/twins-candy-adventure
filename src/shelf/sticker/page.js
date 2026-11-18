// A sticker-by-letter page (§7): a faceted picture on a coloured page with white lettered gaps; beside it a sheet of loose stickers,
// each exactly the size of its gap, on a white backing with its letter on a tab. Drag a sticker (it lifts and floats 36 px above the
// finger; its gap glows when it is close enough) or tap it and then its gap. A wrong gap cannot be committed — it just glides home.
// Picking a sticker up says its letter. When the last one lands the seams close, a gleam sweeps the picture, its name is spoken and
// it is filed in the Sticker Album. Placed stickers are saved on every placing.
import { rng } from '../maze/gen.js';
import { regions } from '../engine/layout.js';

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
export const COUNT = [0, 6, 8, 10, 12, 14, 16, 18, 20, Infinity, Infinity];          // stickers per level; the rest is printed
export const SNAP = (level) => (level <= 3 ? 70 : level <= 7 ? 50 : 36);               // CSS px
export const letter = (i) => String.fromCharCode(65 + (i % 26)).repeat(1 + Math.floor(i / 26));
const cache = new Map();
export const loadPicture = (name) => { if (!cache.has(name)) cache.set(name, fetch(`${import.meta.env.BASE_URL}stickers/${name}.json`).then((r) => r.json())); return cache.get(name); };
const pathOf = (p) => p.outline.map((l) => 'M' + l.join(' ') + 'Z').join('');
const colourOf = (p) => { const c = [0, 0, 0]; let w = 0; for (const f of p.facets) { const a = Math.abs((f[2] - f[0]) * (f[5] - f[1]) - (f[4] - f[0]) * (f[3] - f[1])); const h = parseInt(f[6].slice(1), 16); c[0] += (h >> 16) * a; c[1] += ((h >> 8) & 255) * a; c[2] += (h & 255) * a; w += a; } return `rgb(${c.map((v) => Math.round(v / w)).join(',')})`; };
const bbox = (p) => { const xs = p.outline.flatMap((l) => l.filter((_, i) => i % 2 === 0)), ys = p.outline.flatMap((l) => l.filter((_, i) => i % 2 === 1)); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; };
const inPiece = (p, x, y) => p.facets.some((f) => { const [ax, ay, bx, by, cx, cy] = f, d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy); const u = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / d, v = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / d; return u >= 0 && v >= 0 && u + v <= 1; });
export const drawFacets = (g, p) => p.facets.forEach((f) => el('polygon', { points: f.slice(0, 6).join(' '), fill: f[6], stroke: f[6], 'stroke-width': 1 }, g));

/** which pieces become stickers: the biggest first, but skip one that touches two already chosen, so the gaps spread out */
export function chooseStickers(pic, level) {
  const n = Math.min(COUNT[level] ?? 6, pic.pieces.length), edges = pic.pieces.map((p) => { const s = new Set(); for (const l of p.outline) for (let i = 0; i < l.length; i += 2) { const a = `${l[i]},${l[i + 1]}`, b = `${l[(i + 2) % l.length]},${l[(i + 3) % l.length]}`; s.add(a < b ? a + '|' + b : b + '|' + a); } return s; });
  const touch = (i, j) => { for (const e of edges[i]) if (edges[j].has(e)) return true; return false; };
  const chosen = [], skipped = [];
  for (let i = 0; i < pic.pieces.length && chosen.length < n; i++) (chosen.filter((j) => touch(i, j)).length >= 2 ? skipped : chosen).push(i);
  while (chosen.length < n && skipped.length) chosen.push(skipped.shift());
  return chosen;
}

export function showStickerPage(app, { spec, picName, word, saved, sfx, voice, say, onSave, onDone, finishCard, themeCover, labels = 'upper' }) {
  let alive = true, cleanupResize = null;
  app.innerHTML = `<div class="page sticker-page"><div class="spage"><svg class="spic" viewBox="0 0 512 512"></svg></div><div class="sheet"></div>${finishCard}</div>`;
  const pageEl = app.querySelector('.spage'), svg = app.querySelector('.spic'), sheet = app.querySelector('.sheet');
  pageEl.style.background = `linear-gradient(160deg, ${themeCover[1]}, ${themeCover[0]})`;
  loadPicture(picName).then((pic) => {
    if (!alive) return;
    const level = spec.level, chosen = chooseStickers(pic, level), isSticker = new Set(chosen), placed = new Set((saved || []).filter((i) => isSticker.has(i)));
    // labels (a grown-up setting): A B C, or 1 2 3, or lower-case stickers onto capital gaps
    const letters = new Map(chosen.map((i, k) => [i, labels === 'numbers' ? String(k + 1) : letter(k)])), tabOf = (i) => (labels === 'lower' ? letters.get(i).toLowerCase() : letters.get(i));
    const printed = el('g', { class: 'printed' }, svg), gaps = el('g', { class: 'gaps' }, svg), stuck = el('g', { class: 'stuck' }, svg), fx = el('g', {}, svg);
    pic.pieces.forEach((p, i) => { if (!isSticker.has(i)) drawFacets(printed, p); });
    const gapEls = new Map(), stuckEls = new Map();
    for (const i of chosen) {
      const p = pic.pieces[i], g = el('g', { class: 'gap', 'data-i': i }, gaps);
      el('path', { d: pathOf(p), 'fill-rule': 'evenodd', class: 'hole', style: level <= 2 ? `fill: color-mix(in srgb, ${colourOf(p)} 28%, white)` : '' }, g);
      const fs = Math.max(13, Math.min(34, Math.sqrt(p.area) * 150));
      const t = el('text', { x: p.label[0], y: p.label[1] + fs * 0.36, 'font-size': fs, class: 'gap-letter readable' }, g); t.textContent = letters.get(i);
      gapEls.set(i, g);
    }
    const stick = (i, fresh) => { const g = el('g', { class: 'sticker-on' + (fresh ? ' fresh' : '') }, stuck); drawFacets(g, pic.pieces[i]); stuckEls.set(i, g); gapEls.get(i).classList.add('filled'); };
    placed.forEach((i) => stick(i, false));

    // the sheet: shuffled, each sticker at the size of its gap
    const order = chosen.filter((i) => !placed.has(i)), rand = rng(spec.seed ^ 0x51f15e);
    for (let k = order.length - 1; k > 0; k--) { const j = (rand() * (k + 1)) | 0; [order[k], order[j]] = [order[j], order[k]]; }
    sheet.innerHTML = order.map((i) => `<button class="loose" data-i="${i}" aria-label="${letters.get(i)}"><svg></svg><span class="tab readable">${tabOf(i)}</span></button>`).join('');
    const drawLoose = (svgEl, i) => {
      const p = pic.pieces[i], [x0, y0, x1, y1] = bbox(p), pad = 6; svgEl.setAttribute('viewBox', `${x0 - pad} ${y0 - pad} ${x1 - x0 + 2 * pad} ${y1 - y0 + 2 * pad}`);
      el('path', { d: pathOf(p), fill: '#fff', stroke: '#fff', 'stroke-width': 9, 'stroke-linejoin': 'round', 'fill-rule': 'evenodd' }, svgEl);
      drawFacets(el('g', {}, svgEl), p);
      return [x1 - x0 + 2 * pad, y1 - y0 + 2 * pad];
    };
    sheet.querySelectorAll('.loose').forEach((b) => { b.dims = drawLoose(b.querySelector('svg'), +b.dataset.i); });
    const scale = () => svg.getBoundingClientRect().width / 512;                            // CSS px per picture unit
    const sizeSheet = () => sheet.querySelectorAll('.loose').forEach((b) => { const s = scale(); Object.assign(b.querySelector('svg').style, { width: b.dims[0] * s + 'px', height: b.dims[1] * s + 'px' }); });
    const widest = Math.max(80, ...[...sheet.querySelectorAll('.loose')].map((b) => b.dims[0])), tallest = Math.max(80, ...[...sheet.querySelectorAll('.loose')].map((b) => b.dims[1]));
    const place = () => {
      const right = innerWidth > innerHeight;
      app.querySelector('.sticker-page').classList.toggle('sheet-right', right);
      // the sheet must hold the biggest sticker at the page's scale (stickers are exactly the size of their gaps): find the page size that leaves room
      let R = right ? 230 : 0, T = right ? 0 : 170, box;
      for (let k = 0; k < 3; k++) {
        const fit = (r) => { const w = Math.min(r.w - R, r.h - T); return { x: r.x + (r.w - R - w) / 2, y: r.y + (r.h - T - w) / 2, w }; };
        const [a, b] = regions(2, 0).map(fit); box = a.w >= b.w ? a : b;
        const k2 = box.w / 512; if (right) R = Math.max(230, widest * k2 + 52); else T = Math.max(170, tallest * k2 + 60);
      }
      if (right) sheet.style.width = R - 16 + 'px'; else sheet.style.height = T - 14 + 'px';
      Object.assign(pageEl.style, { left: box.x + 'px', top: box.y + 'px', width: box.w + 'px', height: box.w + 'px' });
      sizeSheet();
    };
    place(); addEventListener('resize', place); cleanupResize = () => removeEventListener('resize', place);
    if (placed.size === chosen.length) finish(false);

    // ------------------------------------------------------------------------------------------ dragging and tap-tap
    const centreOf = (i) => { const [x0, y0, x1, y1] = bbox(pic.pieces[i]), r = svg.getBoundingClientRect(), s = scale(); return { x: r.left + ((x0 + x1) / 2) * s, y: r.top + ((y0 + y1) / 2) * s }; };
    const toPic = (cx, cy) => { const r = svg.getBoundingClientRect(), s = scale(); return [(cx - r.left) / s, (cy - r.top) / s]; };
    let drag = null, selected = null;
    function sayLetter(i) { const L = letters.get(i).toLowerCase(); voice(/^d+$/.test(L) ? [`n_${Math.min(30, +L)}`] : [...L].map((c) => `name_${c}`), { priority: 0 }); }
    function lift(btn, x, y) {
      const i = +btn.dataset.i, float = btn.querySelector('svg').cloneNode(true), r = btn.querySelector('svg').getBoundingClientRect();
      float.classList.add('floating'); Object.assign(float.style, { width: r.width + 'px', height: r.height + 'px' }); document.body.appendChild(float);
      btn.classList.add('away'); sayLetter(i); sfx.play('tap');
      return { i, btn, float, w: r.width, h: r.height, home: { x: r.left + r.width / 2, y: r.top + r.height / 2 }, x, y };
    }
    function moveTo(d, x, y) {                                                                 // the sticker floats 36 px above the finger
      d.cx = x; d.cy = y - 36; Object.assign(d.float.style, { left: d.cx - d.w / 2 + 'px', top: d.cy - d.h / 2 + 'px' });
      const c = centreOf(d.i), near = Math.hypot(c.x - d.cx, c.y - d.cy) < SNAP(level);
      gapEls.get(d.i).classList.toggle('near', near); d.near = near;
    }
    function settle(d, ok) {
      gapEls.get(d.i).classList.remove('near');
      const to = ok ? centreOf(d.i) : d.home;
      d.float.classList.add('gliding'); Object.assign(d.float.style, { left: to.x - d.w / 2 + 'px', top: to.y - d.h / 2 + 'px' });
      setTimeout(() => {
        d.float.remove();
        if (!ok) { d.btn.classList.remove('away'); return; }
        d.btn.remove(); placed.add(d.i); stick(d.i, true); sfx.play('stamp');
        onSave([...placed]);
        if (placed.size === chosen.length) finish(true);
      }, ok ? 140 : 260);
    }
    sheet.addEventListener('pointerdown', (e) => {
      const btn = e.target.closest('.loose'); if (!btn || drag) return;
      e.preventDefault(); try { sheet.setPointerCapture(e.pointerId); } catch { /* fine */ }
      drag = { start: { x: e.clientX, y: e.clientY }, btn, id: e.pointerId, lifted: null };
    });
    sheet.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      if (!drag.lifted && Math.hypot(e.clientX - drag.start.x, e.clientY - drag.start.y) > 8) { if (selected) unselect(); drag.lifted = lift(drag.btn, e.clientX, e.clientY); }
      if (drag.lifted) moveTo(drag.lifted, e.clientX, e.clientY);
    });
    const endDrag = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag; drag = null;
      if (d.lifted) return settle(d.lifted, e.type !== 'pointercancel' && d.lifted.near);
      if (e.type === 'pointercancel') return;
      if (selected?.btn === d.btn) return unselect();                                        // a tap: select (tap-tap)
      if (selected) unselect();
      selected = { btn: d.btn, i: +d.btn.dataset.i }; d.btn.classList.add('chosen'); sayLetter(selected.i); sfx.play('tap');
    };
    sheet.addEventListener('pointerup', endDrag); sheet.addEventListener('pointercancel', endDrag);
    function unselect() { selected?.btn.classList.remove('chosen'); selected = null; }
    svg.addEventListener('click', (e) => {
      if (!selected) return;
      const [x, y] = toPic(e.clientX, e.clientY), i = selected.i, p = pic.pieces[i], [x0, y0, x1, y1] = bbox(p), m = 14;
      if (inPiece(p, x, y) || (x > x0 - m && x < x1 + m && y > y0 - m && y < y1 + m)) {
        const b = selected.btn; unselect(); const d = lift(b, 0, 0); const r = b.getBoundingClientRect(); moveTo(d, r.left + r.width / 2, r.top + r.height / 2 + 36); requestAnimationFrame(() => settle(d, true));
      } else { const b = selected.btn; b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope'); }   // not here
    });

    // ------------------------------------------------------------------------------------------ the finish: seams close, a gleam, the name
    function finish(fresh) {
      svg.classList.add('done');
      if (fresh) {
        const clip = el('clipPath', { id: 'pic-' + picName }, fx); pic.pieces.forEach((p) => el('path', { d: pathOf(p), 'fill-rule': 'evenodd' }, clip));
        const defs = el('defs', {}, fx), grad = el('linearGradient', { id: 'gleam-' + picName, x1: 0, y1: 0, x2: 1, y2: 1 }, defs);
        [[0, 0], [0.45, 0], [0.5, 0.85], [0.55, 0], [1, 0]].forEach(([o, a]) => el('stop', { offset: o, 'stop-color': '#fff', 'stop-opacity': a }, grad));
        el('rect', { x: -512, y: -512, width: 1024, height: 1024, fill: `url(#gleam-${picName})`, class: 'gleam' }, el('g', { 'clip-path': `url(#pic-${picName})` }, fx));   // the clip stays put, the gleam moves through it
        setTimeout(() => say(word), 700);
      }
      onDone(fresh);
    }
  });
  return () => { alive = false; cleanupResize?.(); document.querySelectorAll('.floating').forEach((f) => f.remove()); };
}
