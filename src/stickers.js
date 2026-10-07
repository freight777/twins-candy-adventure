// The sticker book (#47): one page per child (tap the unicorn, the mermaid or the baseball), a grid of stickers. Earned ones
// are bright and say their name when tapped; the rest are soft grey shapes to look forward to; secret ones are a "?".
// Nothing to read; it is where a child sees what she has learned without ever seeing a score.
import './engine/fonts.css';
import './stickers.css';
import './engine/shell.css';
import { fluentPage } from './engine/fluent.js';
fluentPage();
import { kid } from './learn/profile.js';
import { stickersFor } from './learn/stickers.js';
import { unlock, voice, sfx } from './audio.js';

const $ = (s) => document.querySelector(s);
let who = 'adalyn';
try { who = localStorage.getItem('ae:stickerKid') || 'adalyn'; } catch { /* private mode */ }

function render() {
  document.querySelectorAll('#kids button').forEach((b) => b.classList.toggle('on', b.dataset.who === who));
  const have = new Set(kid(who).stickers), list = stickersFor(who);
  $('#book').innerHTML = list.map((s) => {
    const got = have.has(s.id);
    return `<button class="stk ${got ? 'got' : 'todo'}${s.secret && !got ? ' secret' : ''}" data-id="${s.id}" aria-label="${got ? s.name : 'not yet'}" title="${got ? s.name : s.secret ? '?' : s.how}">
      <span>${got || !s.secret ? s.emoji : '?'}</span></button>`;
  }).join('');
  const n = list.filter((s) => have.has(s.id)).length;
  $('#book').insertAdjacentHTML('afterbegin', `<div class="count" aria-label="${n} stickers">${'<i></i>'.repeat(n)}</div>`);
}
$('#kids').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  unlock(); who = b.dataset.who; try { localStorage.setItem('ae:stickerKid', who); } catch { /* ignore */ }
  sfx.pop(); render();
});
$('#book').addEventListener('click', (e) => {
  const b = e.target.closest('.stk'); if (!b) return;
  unlock(); b.classList.remove('bounce'); void b.offsetWidth; b.classList.add('bounce');
  if (b.classList.contains('got')) { sfx.sparkle(); voice(`stk_${b.dataset.id}`, { priority: 2, fallback: b.getAttribute('aria-label') }); } else sfx.soft();
});
render();
