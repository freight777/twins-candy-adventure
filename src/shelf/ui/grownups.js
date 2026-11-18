// The grown-up corner (§10): press and hold the clock on the shelf for two seconds. Nothing a child can tap leads here.
// The child's name (spoken with the device voice when a page is finished), age band and My Teams stay on this device only.
import { save, commit, setSetting, setStartAge, resetBook } from '../engine/save.js';
import { BOOKS } from '../books.js';
import { holdGate } from '../../engine/gate.js';
import { MASCOTS, allTeams } from '../sports/teams.js';
import { badgeSVG } from '../sports/badge.js';
import { loadSprites } from '../ispy/render.js';
import { refreshScores, forgetScores } from '../sports/lastnight.js';

const PALETTE = ['#c8102e', '#ff7f00', '#ffcd00', '#2e7d32', '#00a6a6', '#1f6fb2', '#0d2c6c', '#552583', '#e05297', '#6d4c41', '#8d99ae', '#111111', '#ffffff', '#fdb927', '#a7c957', '#5bc0eb'];
const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function showGrownups(root, { onChange, onPrintLast, onPrintBook }) {
  loadSprites('mascots');
  save.myTeams ||= [];
  const s = save.settings, el = document.createElement('div');
  el.className = 'grownups';
  const radio = (k, opts, cur) => opts.map(([v, label]) => `<label class="pill"><input type="radio" name="${k}" value="${v}" ${String(cur) === String(v) ? 'checked' : ''}> ${label}</label>`).join('');
  const swatches = (which) => `<div class="swatches" data-which="${which}">${PALETTE.map((c) => `<button class="sw" data-c="${c}" style="background:${c}" aria-label="${c}"></button>`).join('')}</div>`;
  el.innerHTML = `<div class="gu-card"><h2>Grown-ups</h2>
    <label class="gu-field">Child's name (said when a page is finished; stays on this iPad)<input type="text" data-k="name" value="${esc(s.name)}" maxlength="24" autocomplete="off"></label>
    <div class="gu-row"><b>Age</b>${radio('age', [['4-5', '4–5'], ['6', '6'], ['7-8', '7–8']], s.age)}<small>sets where every book starts (resets the levels the game has learned)</small></div>
    <div class="gu-row"><b>Hidden pictures start in</b>${radio('look', [['line', 'black-and-white'], ['color', 'colour']], s.look)}</div>
    <div class="gu-row"><b>Sticker labels</b>${radio('labels', [['upper', 'A B C'], ['numbers', '1 2 3'], ['lower', 'a b c on A B C']], s.labels)}</div>
    <div class="gu-teams"><b>My Teams</b> <small>his real favourites: a name, two colours and a mascot animal (never a logo). They join the house league on the scoreboards and the jerseys; their names are said by the device voice.</small>
      <div class="my-teams"></div>
      <div class="team-form"><div class="gu-row"><input class="t-place" placeholder="Place (e.g. Home Town)" maxlength="20"><input class="t-nick" placeholder="Team name (e.g. Wildcats)" maxlength="16"></div>
        <small>First colour</small>${swatches(0)}<small>Second colour</small>${swatches(1)}
        <small>Mascot</small><div class="mascots">${Object.entries(MASCOTS).map(([hex, n]) => `<button class="ms" data-m="${hex}" aria-label="${n}"><svg viewBox="0 0 72 72"><use href="#m${hex}"/></svg></button>`).join('')}</div>
        <div class="gu-row"><span class="t-preview"></span><button class="t-add">Add team</button></div></div></div>
    <label class="gu-field">Jersey number (on the number-jersey sticker pages)<input type="number" data-k="jersey" min="0" max="99" value="${esc(s.jersey ?? 7)}"></label>
    <div class="gu-row gu-scores"><label class="gu-check"><input type="checkbox" data-k="realScores" ${s.realScores ? 'checked' : ''}> Real scores from last night <small>(optional, off)</small></label>
      <input class="gu-url" type="url" placeholder="https://…  your scores Worker's address" value="${esc(s.scoresURL)}" autocomplete="off">
      <small>Needs the small scores Worker in the project's workers/scores folder (its README says how to set it up). The game asks it once when it opens — nothing the child taps uses the network — and a "Last night" page appears in Score Spy. Real teams show their colours and initials only, never logos. If anything goes wrong it quietly uses the house league.</small></div>
    <div class="gu-row"><b>Print</b><button class="gu-print-last">This page</button><select class="gu-print-book">${BOOKS.filter((b) => b.type === 'maze' || b.type === 'ispy').map((b) => `<option value="${b.id}">${b.title}</option>`).join('')}</select><button class="gu-print-book-go">A 10-page book</button>
      <small>mazes and hidden pictures print as black line art, one per sheet; sticker pages do not print</small></div>
    <label class="gu-check"><input type="checkbox" data-k="sound" ${s.sound ? 'checked' : ''}> Sounds</label>
    <label class="gu-check"><input type="checkbox" data-k="voice" ${s.voice ? 'checked' : ''}> Voice</label>
    <div class="gu-row"><b>Reset a book</b><select class="gu-book">${BOOKS.map((b) => `<option value="${b.id}">${b.title}</option>`).join('')}</select><button class="gu-reset">Hold to reset</button></div>
    <p class="gu-note">Progress is kept on this device only. In Safari use Share → Add to Home Screen so it is kept.</p>
    <details class="gu-credits"><summary>Credits</summary>
      <p>Hidden-picture art and mascots: <b>OpenMoji</b> — the open-source emoji and icon project, CC BY-SA 4.0 (openmoji.org).<br>
      Pictures, stickers and shapes: <b>Fluent Emoji</b> by Microsoft, MIT.<br>
      Sounds: <b>Kenney</b> (kenney.nl), CC0. Voice: <b>Kokoro-82M</b>, Apache-2.0, made on the computer at build time.<br>
      Fonts: <b>Fredoka</b> and <b>Andika</b>, SIL Open Font License. Code libraries: delaunator (ISC), canvas-confetti (ISC), Vite (MIT), vite-plugin-pwa (MIT).<br>
      The maze generator follows Jamis Buck's Growing Tree write-up; mazes, scenes, scoreboards and sticker pages are all made by code. The teams are invented; no league or team logos are used.</p></details>
    <button class="gu-close">Done</button></div>`;
  root.appendChild(el);
  el.querySelector('[data-k=name]').addEventListener('input', (e) => setSetting('name', e.target.value.trim()));
  el.querySelector('[data-k=jersey]').addEventListener('input', (e) => setSetting('jersey', Math.max(0, Math.min(99, e.target.value | 0))));
  el.querySelectorAll('input[type=radio]').forEach((r) => r.addEventListener('change', () => { if (r.name === 'age') setStartAge(r.value); else setSetting(r.name, r.value); onChange?.(); }));
  el.querySelectorAll('input[type=checkbox]').forEach((c) => c.addEventListener('change', () => { setSetting(c.dataset.k, c.checked); onChange?.(); }));
  const rescore = () => { forgetScores(); refreshScores().then(() => onChange?.()); };
  el.querySelector('[data-k=realScores]').addEventListener('change', rescore);
  el.querySelector('.gu-url').addEventListener('change', (e) => { setSetting('scoresURL', e.target.value.trim()); rescore(); });
  // My Teams
  const draft = { colors: ['#1f6fb2', '#ffffff'], mascot: '1F985' }, nickEl = el.querySelector('.t-nick'), placeEl = el.querySelector('.t-place');
  const drawTeams = () => {
    el.querySelector('.my-teams').innerHTML = save.myTeams.map((t, i) => `<span class="my-team">${badgeSVG(allTeams([t])[0])}<b>${esc((t.place ? t.place + ' ' : '') + t.nick)}</b><button data-rm="${i}" aria-label="Remove">✕</button></span>`).join('') || '<small>none yet</small>';
    el.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', () => { save.myTeams.splice(+b.dataset.rm, 1); commit(); drawTeams(); onChange?.(); }));
    el.querySelectorAll('.swatches').forEach((sw) => sw.querySelectorAll('.sw').forEach((x) => x.classList.toggle('on', x.dataset.c === draft.colors[+sw.dataset.which])));
    el.querySelectorAll('.ms').forEach((x) => x.classList.toggle('on', x.dataset.m === draft.mascot));
    el.querySelector('.t-preview').innerHTML = badgeSVG(allTeams([{ nick: nickEl.value || 'Team', place: placeEl.value, ...draft }])[0]);
  };
  el.querySelectorAll('.swatches').forEach((sw) => sw.addEventListener('click', (e) => { const b = e.target.closest('.sw'); if (b) { draft.colors[+sw.dataset.which] = b.dataset.c; drawTeams(); } }));
  el.querySelector('.mascots').addEventListener('click', (e) => { const b = e.target.closest('.ms'); if (b) { draft.mascot = b.dataset.m; drawTeams(); } });
  [nickEl, placeEl].forEach((i) => i.addEventListener('input', drawTeams));
  el.querySelector('.t-add').addEventListener('click', () => {
    const nick = nickEl.value.trim(); if (!nick) return nickEl.focus();
    save.myTeams.push({ nick, place: placeEl.value.trim(), colors: [...draft.colors], mascot: draft.mascot }); commit();
    nickEl.value = ''; placeEl.value = ''; drawTeams(); onChange?.();
  });
  drawTeams();
  el.querySelector('.gu-print-last').addEventListener('click', async (e) => { if (!(await onPrintLast?.())) e.target.textContent = 'Open a maze or hidden picture first'; });
  el.querySelector('.gu-print-book-go').addEventListener('click', () => onPrintBook?.(el.querySelector('.gu-print-book').value));
  const btn = el.querySelector('.gu-reset');
  holdGate(btn, () => { resetBook(el.querySelector('.gu-book').value); btn.textContent = 'Reset ✓'; onChange?.(); }, { ms: 2000 });
  el.querySelector('.gu-close').addEventListener('click', () => { el.remove(); onChange?.(); });
}
