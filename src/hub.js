// The games menu. Offline support (the service worker) is added to every page by vite-plugin-pwa at build time.
import './engine/fonts.css';
import { holdGate } from './engine/gate.js';
import { allKids } from './learn/profile.js';
import { STICKERS } from './learn/stickers.js';

// each game card wears a gold dot for every sticker found in that game (by any of the children)
const got = new Set(allKids().flatMap(([, k]) => k.stickers.map((id) => id)));
['candy', 'uni', 'mermaid', 'derby', 'princess'].forEach((g) => {
  const n = STICKERS.filter((s) => s.game === g && got.has(s.id)).length, card = document.querySelector(`.game.${g}`);
  if (n && card) card.insertAdjacentHTML('beforeend', `<span class="badge" aria-label="${n} stickers">${'<i></i>'.repeat(n)}</span>`);
});
// the grown-ups progress page: hold the gear for 2 seconds (kids mash; they don't hold still)
holdGate(document.getElementById('grownups'), () => { location.href = './progress.html'; });
