// Puzzle Shelf §5 acceptance: scenes per theme per level (both looks draw the same scene, so composing once covers both):
//  · every target shows at least as much as its level allows (the 32 × 32 silhouette checked against everything drawn above it);
//  · no two targets' hit centres within 44 px (scene units here: MIN_APART);
//  · no target also in the clutter (a counting clue's copies are all targets); decoys on levels 9–10 are look-alikes, not copies;
//  · the tray matches the level (number of things, a counting clue from level 4, words only from level 7), and words are unique;
//  · every target is inside the scene, and the same page id always makes the same scene.
// Run: node tests/shelf/ispy.test.js [scenes per theme per level = 500]
import assert from 'node:assert/strict';
import { composeScene, visible, LEVELS, MIN_APART, W, H } from '../../src/shelf/ispy/compose.js';
import { THEMES } from '../../src/shelf/themes.js';
import { SETS } from '../../src/shelf/ispy/sets.js';

const N = +process.argv[2] || 500, t0 = Date.now(); let n = 0, worst = 1, fronted = 0;
for (const theme of Object.keys(THEMES)) {
  const art = (await import(`../../src/shelf/ispy/art/${theme}.js`)).default;
  assert.ok(art.ids.length >= 60, `${theme}: at least 60 objects`);
  assert.equal(new Set(Object.values(art.words)).size, art.ids.length, `${theme}: every word different`);
  for (const set of THEMES[theme].sets) assert.ok(SETS[set], `${theme}: set ${set} exists`);
  for (let level = 1; level <= 10; level++) {
    const L = LEVELS[level];
    for (let s = 1; s <= N; s++) {
      const seed = s * 7919 + level * 31, set = THEMES[theme].sets[s % THEMES[theme].sets.length], sc = composeScene({ theme, level, seed }, art, set), tag = `${theme} L${level} s${seed}`;
      const targets = sc.items.filter((it) => it.target !== undefined), clutter = sc.items.filter((it) => it.target === undefined);
      assert.equal(sc.tray.length, L.k, `${tag}: ${L.k} things to find`);
      assert.equal(targets.length, sc.tray.reduce((a, e) => a + e.count, 0), `${tag}: every copy placed`);
      assert.equal(sc.tray.some((e) => e.count === 3), !!L.count, `${tag}: a counting clue from level 4`);
      assert.equal(sc.words, !!L.words, `${tag}: words only from level 7`);
      const ids = new Set(sc.tray.map((e) => e.id));
      for (const c of clutter) assert.ok(!ids.has(c.id), `${tag}: target ${c.id} is not also in the clutter`);
      sc.items.forEach((it, i) => {
        if (it.target === undefined) return;
        const v = visible(art, sc.items, i); worst = Math.min(worst, v - (1 - L.cover)); if (it.top) fronted++;
        assert.ok(v >= 1 - L.cover - 1e-9, `${tag}: target ${it.id} shows ${(v * 100).toFixed(0)}% (needs ${((1 - L.cover) * 100).toFixed(0)}%)`);
        assert.ok(it.x > 0 && it.y > 0 && it.x < W && it.y < H, `${tag}: inside the scene`);
        assert.ok(it.s >= L.min, `${tag}: big enough`);
      });
      for (let a = 0; a < targets.length; a++) for (let b = a + 1; b < targets.length; b++) assert.ok(Math.hypot(targets[a].x - targets[b].x, targets[a].y - targets[b].y) >= MIN_APART, `${tag}: hit centres apart`);
      n++;
    }
  }
  const again = composeScene({ theme, level: 5, seed: 99 }, art, THEMES[theme].sets[0]), once = composeScene({ theme, level: 5, seed: 99 }, art, THEMES[theme].sets[0]);
  assert.deepEqual(again, once, `${theme}: the same page is the same scene`);
}
console.log(`ispy ok (${n} scenes; tightest visibility margin ${(worst * 100).toFixed(1)}%; ${fronted} targets had to come to the front; ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
