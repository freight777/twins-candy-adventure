// Drawing a hidden-picture scene as SVG (scene units 1200 × 900). Two looks from the same scene (§5): 'line' — black line art on
// white paper, things fill with colour when found and colour floods the scene at the end — and 'color' — every object in colour on a
// tinted backdrop. The OpenMoji sprite sheet of the theme is put in the page once; every thing is a <use> of its line or colour symbol.
import { SETS } from './sets.js';

const NS = 'http://www.w3.org/2000/svg';
export const el = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
const loaded = new Map();
/** the theme's sprite sheet, in the page once (resolves when it can be used) */
export function loadSprites(theme) {
  if (!loaded.has(theme)) loaded.set(theme, fetch(`${import.meta.env.BASE_URL}art/${theme}.svg`).then((r) => r.text()).then((text) => {
    const holder = document.createElement('div'); holder.setAttribute('aria-hidden', 'true');
    holder.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden'; holder.innerHTML = text; document.body.appendChild(holder);
  }));
  return loaded.get(theme);
}
export const useOf = (look, id, parent, attrs = {}) => el('use', { href: `#${look === 'line' ? 'l' : 'c'}${id}`, x: -36, y: -36, width: 72, height: 72, ...attrs }, parent);
export const placeOf = (it) => `translate(${it.x.toFixed(1)} ${it.y.toFixed(1)}) rotate(${it.r.toFixed(1)}) scale(${((it.f * it.s) / 72).toFixed(4)} ${(it.s / 72).toFixed(4)})`;

/** draw the scene; returns its layers */
export function renderScene(svg, scene, look, { mini = false } = {}) {
  svg.replaceChildren(); svg.setAttribute('viewBox', '0 0 1200 900'); svg.classList.add('scene'); svg.classList.toggle('color', look === 'color');
  const set = SETS[scene.set], view = el('g', { class: 'view' }, svg);
  el('rect', { width: 1200, height: 900, class: 'paper' }, view);
  const fills = el('g', { class: 'fills' }, view); fills.innerHTML = set.fills;
  const lines = el('g', { class: 'lines' }, view); lines.innerHTML = set.lines;
  const things = el('g', { class: 'things' }, view), nodes = [];
  scene.items.forEach((it, i) => { const g = el('g', { class: 'it', 'data-i': i, transform: placeOf(it) }, things); useOf(look, it.id, g); nodes.push(g); });
  if (mini) return { svg, view, nodes };
  const ink = el('g', { class: 'ink' }, view), fx = el('g', { class: 'fx' }, view), spot = el('g', { class: 'spot' }, view);
  return { svg, view, fills, things, nodes, ink, fx, spot };
}
