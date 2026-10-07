// Grown-ups progress page: a read-out of the on-device learning profile (src/learn/profile.js) plus the learning settings.
import './engine/fonts.css';
import './progress.css';
import { allKids, settings, saveSettings, resetKid, MAX } from './learn/profile.js';
import { UNITS, unitLabel } from './learn/code.js';
import { holdGate } from './engine/gate.js';
import { voice, unlock, setVoices, voicesEnabled } from './audio.js';

const $ = (s) => document.querySelector(s);
const NAMES = { adalyn: 'Adalyn', esmae: 'Esmae', tony: 'Tony' };
const MATH = ['Unit 1: seeing and counting small groups (to 5)', 'Unit 2: counting and comparing to 10', 'Unit 4: adding within 5 with objects', 'Unit 4: adding and taking away within 10',
  'Unit 5: making 10 and breaking numbers apart', 'Unit 6: teen numbers as ten and some more', 'Fluency: adding within 5 by heart'];
/** item ids -> words a parent understands */
const LABEL = {
  snd: (x) => `first sound /${x}/`, blend: (x) => `blending "${x}"`, word: (x) => `finding the word "${x}"`, read: (x) => `reading "${x}"`, tricky: (x) => `Tricky Word "${x}"`, name: (x) => `letter name ${x}`,
  subit: (x) => `seeing ${x} at a glance`, count: (x) => `counting ${x}`, cmp: (x) => (x === 'close' ? 'comparing close amounts' : 'comparing amounts'), add: (x) => `adding to ${x}`, take: (x) => `taking away from ${x}`,
  m10: (x) => `${x} and how many make 10`, brk: (x) => `breaking ${x} apart`, teen: (x) => `${x} as ten and ${x - 10}`, flu: (x) => `${x} by heart`,
};
const label = (id) => { const [k, v] = id.split(':'); return (LABEL[k] || ((x) => id))(v); };
const ago = (t) => { if (!t) return 'not yet'; const m = Math.round((Date.now() - t) / 60000); return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`; };
const dots = (hist) => hist.map((h) => (h ? '●' : '○')).join(' ') || '–';

function kidCard(who, k) {
  const items = Object.entries(k.items);
  const working = items.filter(([, it]) => it.seen > 0 && it.box < 3).sort((a, b) => a[1].box - b[1].box || b[1].seen - a[1].seen).slice(0, 10);
  const mastered = items.filter(([, it]) => it.box >= 3).sort((a, b) => b[1].last - a[1].last).slice(0, 10);
  const list = (rows, empty) => (rows.length ? `<ul>${rows.map(([id, it]) => `<li>${label(id)} <span class="box b${it.box}" title="box ${it.box} of 4">${'★'.repeat(it.box)}${'☆'.repeat(4 - it.box)}</span></li>`).join('')}</ul>` : `<p class="note">${empty}</p>`);
  const el = document.createElement('article'); el.className = 'kid';
  el.innerHTML = `<h2>${NAMES[who] || who}</h2>
    <p class="meta">${k.sessions} games played &middot; last played ${ago(k.lastPlayed)} &middot; ${k.stickers.length} stickers</p>
    <div class="levels">
      <div><b>Reading</b> level ${k.reading.level} of ${MAX.reading}<br><span>${unitLabel(k.reading.level)}</span><br><small>last answers: ${dots(k.reading.hist)}</small></div>
      <div><b>Math</b> level ${k.math.level} of ${MAX.math}<br><span>${MATH[k.math.level]}</span><br><small>last answers: ${dots(k.math.hist)}</small></div>
    </div>
    <div class="cols"><div><h3>Working on</h3>${list(working, 'Nothing yet.')}</div><div><h3>Recently mastered</h3>${list(mastered, 'Keep playing!')}</div></div>
    <button class="reset" type="button">Hold to reset ${NAMES[who] || who}</button>`;
  holdGate(el.querySelector('.reset'), () => { resetKid(who); render(); });
  return el;
}

function render() {
  const box = $('#kids'); box.innerHTML = '';
  for (const [who, k] of allKids()) box.appendChild(kidCard(who, k));
}

/** a settings row: label + buttons that cycle through options */
function row(title, get, set, options) {
  const r = document.createElement('div'); r.className = 'row';
  const b = document.createElement('button'); b.type = 'button';
  const show = () => { const v = get(), o = options.find((x) => String(x[0]) === String(v)) || options[0]; b.textContent = o[1]; };
  b.onclick = () => { const i = options.findIndex((x) => String(x[0]) === String(get())); set(options[(i + 1) % options.length][0]); saveSettings(); show(); };
  r.append(Object.assign(document.createElement('span'), { textContent: title }), b); show();
  return r;
}
function settingsUI() {
  const s = $('#settings'), lv = [['auto', 'auto (follows her answers)'], ...[0, 1, 2, 3, 4, 5, 6].map((n) => [n, `pinned at level ${n}`])];
  s.append(
    row('Questions in the games', () => settings.on, (v) => (settings.on = v), [[true, 'on'], [false, 'off']]),
    row('Bedtime mode \u{1F319}', () => !!settings.bedtime, (v) => (settings.bedtime = v), [[false, 'off'], [true, 'on: softer, quieter, no questions']]),
    row('Ask a question', () => settings.every, (v) => (settings.every = v), [[1, 'every turn'], [2, 'every 2nd turn'], [3, 'every 3rd turn']]),
    row('Questions per game (most)', () => settings.maxPerSession, (v) => (settings.maxPerSession = v), [[6, '6'], [12, '12'], [20, '20']]),
    row('Reading level', () => settings.level, (v) => (settings.level = v), lv),
    row('Math level', () => settings.mathLevel, (v) => (settings.mathLevel = v), lv),
    row('Brand-new items', () => settings.scaffoldNew !== false, (v) => (settings.scaffoldNew = v), [[true, 'answer glows softly'], [false, 'no hint']]),
    row('Voices', () => voicesEnabled(), (v) => setVoices(v), [[true, 'on'], [false, 'off']]),
  );
}
function soundsUI() {
  const box = $('#sounds');
  for (const u of UNITS) for (const snd of u.sounds) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'readable'; b.textContent = snd.replace('_e', '-e');
    b.title = `Unit ${u.u}`; b.onclick = () => { unlock(); voice(`snd_${snd}`, { priority: 2 }); };
    box.appendChild(b);
  }
}
render(); settingsUI(); soundsUI();
