// A hidden-picture page (§5): the scene in his chosen look, the tray of things to find (picture and word; word only from level 7;
// "find 3" counting clues from level 4), finding by tap or circle, hints, pinch-zoom on a phone, and the finish — colour floods
// the black-and-white scene, or every thing bounces in a wave with confetti. Found things are saved on every find.
import confetti from 'canvas-confetti';
import { THEMES } from '../themes.js';
import { composeScene } from './compose.js';
import { renderScene, loadSprites, useOf } from './render.js';
import { playScene } from './play.js';
import { regions } from '../engine/layout.js';

const ART = import.meta.glob('./art/*.js', { import: 'default' });
export const loadArt = (theme) => ART[`./art/${theme}.js`]();
export const setFor = (spec) => { const s = THEMES[spec.theme].sets; return s[Math.abs(spec.seed) % s.length]; };
/** the scene for a page id: the same scene in either look */
export async function sceneFor(spec) { const art = await loadArt(spec.theme); return { art, scene: composeScene(spec, art, setFor(spec)) }; }

/** where the scene goes: 4 : 3, clear of the buttons, with the tray below (portrait) or beside it (landscape) */
function layout(trayRight) {
  const T = trayRight ? 0 : 132, R = trayRight ? 196 : 0;
  const fit = (r) => { const w = Math.min(r.w, r.h * 4 / 3), h = w * 3 / 4; return { x: r.x + (r.w - w) / 2, y: r.y + (r.h - h) / 2, w, h }; };
  const [a, b] = regions(2, 1).map((r) => fit({ x: r.x, y: r.y, w: r.w - R + (r.x > 100 && trayRight ? 64 + 12 : 0), h: r.h - T }));
  return a.w >= b.w ? a : b;
}

export function showIspyPage(app, { r, spec, id, saved, look, sfx, note, say, onSave, onDone, onHintUsed, finishCard }) {
  let alive = true, ctl = null, onResize = null;
  app.innerHTML = `<div class="page ispy-page"><svg class="scene" aria-label="Hidden pictures"></svg><div class="tray"></div><div class="minimap hidden"><i></i></div>
    <button class="hint-btn" aria-label="Help">?</button>${finishCard}</div>`;
  const svg = app.querySelector('.scene'), trayEl = app.querySelector('.tray'), mini = app.querySelector('.minimap');
  Promise.all([sceneFor(spec), loadSprites(spec.theme)]).then(([{ art, scene }]) => {
    if (!alive) return;
    const layers = renderScene(svg, scene, look);
    // the tray: one item per thing to find (a counting clue shows ×3 and fills its dots)
    trayEl.innerHTML = scene.tray.map((e) => `<button class="ti" data-t="${e.t}" aria-label="${e.word}">${scene.words ? '' : `<svg viewBox="0 0 72 72"><use href="#${look === 'line' ? 'l' : 'c'}${e.id}"/></svg>`}
      <span class="word readable">${e.word}</span>${e.count > 1 ? `<span class="count">×${e.count}</span><span class="dots">${'<i></i>'.repeat(e.count)}</span>` : ''}</button>`).join('');
    const tick = (t) => {
      const btn = trayEl.querySelector(`[data-t="${t}"]`), copies = scene.items.map((it, i) => (it.target === t ? i : -1)).filter((i) => i >= 0), got = copies.filter((i) => ctl ? ctl.found.includes(i) : saved.includes(i)).length;
      btn.querySelectorAll('.dots i').forEach((d, n) => d.classList.toggle('on', n < got));
      btn.classList.toggle('done', got === copies.length);
    };
    const place = () => {
      const right = innerWidth > innerHeight; app.querySelector('.ispy-page').classList.toggle('tray-right', right);
      const b = layout(right); Object.assign(svg.style, { left: b.x + 'px', top: b.y + 'px', width: b.w + 'px', height: b.h + 'px' });
      Object.assign(mini.style, { left: b.x + 8 + 'px', top: b.y + b.h - 68 + 'px' });
    };
    onResize = place; addEventListener('resize', place); place();
    layers.onZoom = (z) => { mini.classList.toggle('hidden', z.s <= 1.01); const i = mini.querySelector('i'); Object.assign(i.style, { width: 100 / z.s + '%', height: 100 / z.s + '%', left: (-z.x / (1200 * z.s)) * 100 + '%', top: (-z.y / (900 * z.s)) * 100 + '%' }); };
    let finds = saved.length;
    ctl = playScene(layers, scene, art, look, {
      found: saved,
      onFind: (i, t, done, all) => { finds++; sfx.play('star', { rate: note(Math.min(10, finds)), vary: false }); say(scene.tray[t].word); tick(t); onSave({ found: all }); if (done) trayEl.querySelector(`[data-t="${t}"]`).classList.add('just'); },
      onMiss: () => sfx.play('wobble', { vol: 0.6 }),
      onCalm: () => say('Look closely…'),
      onHint: (t) => { onHintUsed?.(); sfx.play('hint'); const b = trayEl.querySelector(`[data-t="${t}"]`); b.classList.remove('pulse'); void b.offsetWidth; b.classList.add('pulse'); b.scrollIntoView({ block: 'nearest', inline: 'nearest' }); },
      onFinish: (all) => { onSave({ found: all, done: true }); finish(layers, scene, true); },
    });
    scene.tray.forEach((e) => tick(e.t));
    trayEl.querySelectorAll('.ti').forEach((b) => b.addEventListener('click', () => { const e = scene.tray[+b.dataset.t]; say(e.word); b.classList.remove('wiggle'); void b.offsetWidth; b.classList.add('wiggle'); }));
    app.querySelector('.hint-btn').addEventListener('click', () => ctl.hint());
    window.__ispy = { ctl, scene, art, layers };                                               // for tests and the screenshot tool
    if (scene.items.every((it, i) => it.target === undefined || saved.includes(i))) finish(layers, scene, false);
  });
  function finish(layers, scene, fresh) {
    app.querySelector('.hint-btn').classList.add('hidden');
    if (look === 'line') {                                                                     // colour floods the whole scene
      layers.svg.classList.add('flooded');
      layers.nodes.forEach((g, i) => { if (!g.querySelector('.paint')) { const c = useOf('color', scene.items[i].id, g, { class: 'paint flood' }); c.style.animationDelay = (scene.items[i].x / 1200) * 0.8 + 's'; } });
    } else {                                                                                   // every thing bounces in a wave, with confetti
      layers.nodes.forEach((g, i) => { g.classList.add('wave'); g.style.animationDelay = (scene.items[i].x / 1200) * 0.8 + 's'; });
      if (fresh) confetti({ particleCount: 120, spread: 90, origin: { y: 0.6 }, disableForReducedMotion: true });
    }
    onDone(fresh);
  }
  return () => { alive = false; ctl?.destroy(); if (onResize) removeEventListener('resize', onResize); };
}
