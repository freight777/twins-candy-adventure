// Earning a sticker (#47): it is saved in the child's profile and, the first time, it pops up big in the middle of the
// screen with a fanfare and its spoken name, then flies off to the corner (where the sticker book lives on the menu).
import { sfx, voice } from '../audio.js';
import { award } from '../learn/profile.js';
import { sticker } from '../learn/stickers.js';

const queue = [];
let showing = false;
/** award a sticker; returns true if it is new (and shows it) */
export function earn(who, id) {
  if (!who || !sticker(id) || !award(who, id)) return false;
  queue.push(id); if (!showing) next();
  return true;
}
function next() {
  const id = queue.shift(); if (!id) { showing = false; return; }
  showing = true;
  const s = sticker(id), el = document.createElement('div'); el.className = 'stk-toast'; el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `<div class="stk-card"><span>${s.emoji}</span></div>`;
  document.body.appendChild(el); sfx.fanfare();
  voice(['new_sticker', `stk_${id}`], { priority: 1, fallback: `A new sticker! ${s.name}!` });
  setTimeout(() => el.classList.add('fly'), 1900);
  setTimeout(() => { el.remove(); next(); }, 2700);
}
