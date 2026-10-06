// Thin wrapper around the HTML overlay (title screen, who-is-playing buttons, speech bubbles, hints).
import { say, sayAsync, sfx } from './audio.js';
const $ = (s) => document.querySelector(s);

function portraitSVG(who) {
  const bow = who === 'adalyn' ? '#ff8a1f' : '#ff5fa8';
  const bg = who === 'adalyn' ? '#ffe2bd' : '#ffd3e8';
  return `<svg viewBox="0 0 100 100"><rect width="100" height="100" fill="${bg}"/>
    <circle cx="50" cy="50" r="34" fill="#5b3a24"/>
    <ellipse cx="17" cy="64" rx="11" ry="17" fill="#5b3a24"/><ellipse cx="83" cy="64" rx="11" ry="17" fill="#5b3a24"/>
    <ellipse cx="50" cy="56" rx="29" ry="30" fill="#f3c8a2"/>
    <path d="M19 52 Q50 4 81 52 Q66 30 50 36 Q34 30 19 52Z" fill="#5b3a24"/>
    <ellipse cx="38" cy="58" rx="4.5" ry="6" fill="#3a2315"/><ellipse cx="62" cy="58" rx="4.5" ry="6" fill="#3a2315"/>
    <circle cx="39.5" cy="56" r="1.6" fill="#fff"/><circle cx="63.5" cy="56" r="1.6" fill="#fff"/>
    <ellipse cx="29" cy="68" rx="6" ry="3.6" fill="#ff9a9a" opacity=".7"/><ellipse cx="71" cy="68" rx="6" ry="3.6" fill="#ff9a9a" opacity=".7"/>
    <path d="M40 72 Q50 82 60 72" stroke="#c0504d" stroke-width="3" fill="none" stroke-linecap="round"/>
    <circle cx="21" cy="46" r="8" fill="${bow}"/><circle cx="79" cy="46" r="8" fill="${bow}"/>
    <circle cx="21" cy="46" r="3" fill="#fff" opacity=".6"/><circle cx="79" cy="46" r="3" fill="#fff" opacity=".6"/></svg>`;
}

export const ui = {
  init() {
    document.querySelectorAll('.portrait').forEach((b) => (b.innerHTML = portraitSVG(b.dataset.who)));
  },
  onPick(fn) { document.querySelectorAll('.pick, .swap').forEach((b) => b.addEventListener('click', () => fn(b.dataset.who))); },
  onPlay(fn) { $('#play').addEventListener('click', fn); },
  setActive(who) { document.querySelectorAll('.portrait').forEach((b) => b.classList.toggle('active', b.dataset.who === who)); },
  title(show) { $('#title').classList.toggle('hidden', !show); },
  progress(show) { $('#progress').classList.toggle('hidden', !show); },
  progressSet([a, e]) {
    $('#progress .dot.a').style.bottom = `${a * 100}%`; $('#progress .dot.e').style.bottom = `${e * 100}%`;
  },
  hud(show, { swap = true, stars = false, icon = '⭐', lockSwap = false } = {}) {
    $('#hud').classList.toggle('hidden', !show);
    document.querySelectorAll('.swap').forEach((b) => (b.style.pointerEvents = lockSwap ? 'none' : 'auto'));
    $('#swap').style.display = swap ? 'flex' : 'none';
    $('#stars').classList.toggle('hidden', !stars);
    $('#staricon').textContent = icon;
  },
  eat(show, item = '', fn) {
    const b = $('#eat'); b.classList.toggle('hidden', !show);
    if (show) { b.querySelector('.eat-item').textContent = item; b.onclick = fn; }
  },
  roll(show, fn) { const b = $('#roll'); b.classList.toggle('hidden', !show); if (show) b.onclick = fn; },
  setStars(n) { $('#starcount').textContent = n; },

  /** Show a speech bubble (emoji + short caption). The caption is also spoken aloud, in the voice of `who`; resolves when it has been said. */
  bubble(emoji, caption = '', who = 'narrator', speak = true, opts = {}) {
    const said = caption && speak ? sayAsync(caption, who, opts) : Promise.resolve(true);
    const b = $('#bubble');
    b.classList.remove('hidden');
    b.firstElementChild.textContent = emoji;
    b.lastElementChild.textContent = caption;
    b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
    return said;
  },
  hideBubble() { $('#bubble').classList.add('hidden'); },

  hint(emoji) { const h = $('#hint'); h.textContent = emoji; h.classList.remove('hidden'); },
  hintAt(x, y) { const h = $('#hint'); h.style.left = x + 'px'; h.style.top = y + 'px'; },
  hideHint() { $('#hint').classList.add('hidden'); },

  say,
  /** The final picture: a big banner across the top and a small button off to the side. */
  finale(text, button, onClick) {
    $('#banner .b-text').textContent = text;
    $('#banner').classList.remove('hidden');
    const b = $('#again'); b.classList.remove('hidden'); b.lastChild.textContent = ' ' + button; b.onclick = onClick;
  },
  hideFinale() { $('#banner').classList.add('hidden'); $('#again').classList.add('hidden'); },
  message(emoji, text, button, onClick, cancel, onCancel) {
    say(text);
    $('#msg').classList.remove('hidden');
    $('.msg-emoji').textContent = emoji; $('.msg-text').textContent = text;
    const b = $('#msg-btn'); b.textContent = button; b.onclick = () => { $('#msg').classList.add('hidden'); onClick && onClick(); };
    const c = $('#msg-cancel'); c.classList.toggle('hidden', !cancel);
    if (cancel) { c.textContent = cancel; c.onclick = () => { $('#msg').classList.add('hidden'); onCancel && onCancel(); }; }
  },

  async fade(color = '#fff', fn) {
    const f = $('#fade');
    f.style.background = color; f.style.opacity = 1;
    await new Promise((r) => setTimeout(r, 550));
    await fn();
    await new Promise((r) => setTimeout(r, 120));
    f.style.opacity = 0;
  },
};
