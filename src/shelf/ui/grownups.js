// The grown-up corner (§10): press and hold the clock on the shelf for two seconds. Nothing a child can tap leads here.
// The child's name (spoken with the device voice when a page is finished) and age band stay on this device only.
import { save, setSetting, setStartAge, resetBook } from '../engine/save.js';
import { BOOKS } from '../books.js';
import { holdGate } from '../../engine/gate.js';

export function showGrownups(root, { onChange }) {
  const s = save.settings, el = document.createElement('div');
  el.className = 'grownups';
  const radio = (k, opts, cur) => opts.map(([v, label]) => `<label class="pill"><input type="radio" name="${k}" value="${v}" ${String(cur) === String(v) ? 'checked' : ''}> ${label}</label>`).join('');
  el.innerHTML = `<div class="gu-card"><h2>Grown-ups</h2>
    <label class="gu-field">Child's name (said when a page is finished; stays on this iPad)<input type="text" data-k="name" value="${(s.name || '').replace(/"/g, '&quot;')}" maxlength="24" autocomplete="off"></label>
    <div class="gu-row"><b>Age</b>${radio('age', [['4-5', '4–5'], ['6', '6'], ['7-8', '7–8']], s.age)}<small>sets where every book starts (resets the levels the game has learned)</small></div>
    <div class="gu-row"><b>Hidden pictures start in</b>${radio('look', [['line', 'black-and-white'], ['color', 'colour']], s.look)}</div>
    <div class="gu-row"><b>Sticker labels</b>${radio('labels', [['upper', 'A B C'], ['numbers', '1 2 3'], ['lower', 'a b c on A B C']], s.labels)}</div>
    <label class="gu-check"><input type="checkbox" data-k="sound" ${s.sound ? 'checked' : ''}> Sounds</label>
    <label class="gu-check"><input type="checkbox" data-k="voice" ${s.voice ? 'checked' : ''}> Voice</label>
    <div class="gu-row"><b>Reset a book</b><select class="gu-book">${BOOKS.map((b) => `<option value="${b.id}">${b.title}</option>`).join('')}</select><button class="gu-reset">Hold to reset</button></div>
    <p class="gu-note">Progress is kept on this device only. In Safari use Share → Add to Home Screen so it is kept.</p>
    <details class="gu-credits"><summary>Credits</summary>
      <p>Hidden-picture art: <b>OpenMoji</b> — the open-source emoji and icon project, CC BY-SA 4.0 (openmoji.org).<br>
      Pictures, stickers and shapes: <b>Fluent Emoji</b> by Microsoft, MIT.<br>
      Sounds: <b>Kenney</b> (kenney.nl), CC0. Voice: <b>Kokoro-82M</b>, Apache-2.0, made on the computer at build time.<br>
      Fonts: <b>Fredoka</b> and <b>Andika</b>, SIL Open Font License. Code libraries: delaunator (ISC), canvas-confetti (ISC), Vite (MIT), vite-plugin-pwa (MIT).<br>
      The maze generator follows Jamis Buck's Growing Tree write-up; mazes, scenes and sticker pages are all made by code.</p></details>
    <button class="gu-close">Done</button></div>`;
  root.appendChild(el);
  el.querySelector('[data-k=name]').addEventListener('input', (e) => setSetting('name', e.target.value.trim()));
  el.querySelectorAll('input[type=radio]').forEach((r) => r.addEventListener('change', () => { if (r.name === 'age') setStartAge(r.value); else setSetting(r.name, r.value); onChange?.(); }));
  el.querySelectorAll('input[type=checkbox]').forEach((c) => c.addEventListener('change', () => { setSetting(c.dataset.k, c.checked); onChange?.(); }));
  const btn = el.querySelector('.gu-reset');
  holdGate(btn, () => { resetBook(el.querySelector('.gu-book').value); btn.textContent = 'Reset ✓'; onChange?.(); }, { ms: 2000 });
  el.querySelector('.gu-close').addEventListener('click', () => { el.remove(); onChange?.(); });
}
