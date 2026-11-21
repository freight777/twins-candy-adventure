import { composeScene, visible, LEVELS } from '../../src/shelf/ispy/compose.js';
import { THEMES } from '../../src/shelf/themes.js';
const t0 = Date.now(); let n = 0, worst = 1, tops = 0, sum = 0;
for (const theme of Object.keys(THEMES)) {
  const art = (await import(`../../src/shelf/ispy/art/${theme}.js`)).default;
  for (let level = 1; level <= 10; level++) for (let seed = 1; seed <= 20; seed++) {
    const set = THEMES[theme].sets[seed % 2], sc = composeScene({ theme, level, seed: seed * 7919 + level }, art, set);
    sc.items.forEach((it, i) => { if (it.target !== undefined) { const v = visible(art, sc.items, i); worst = Math.min(worst, v - (1 - LEVELS[level].cover)); if (it.top) tops++; } });
    sum += sc.items.length; n++;
  }
}
console.log(n, 'scenes', ((Date.now() - t0) / n).toFixed(1), 'ms each; avg items', (sum / n).toFixed(0), '; worst visibility margin', worst.toFixed(3), '; targets brought to front', tops);
