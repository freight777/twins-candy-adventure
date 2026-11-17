// The screen's bookkeeping: replaying every step of real games onto the mirror must end exactly at game.cells (§3: "After the
// last step the sprites must match game.cells exactly"). Covers every goal type, shaped boards and party levels.
import assert from 'node:assert/strict';
import { createGame, play, moves } from '../../src/match/game/engine.js';
import { makeLevel } from '../../src/match/game/levels.js';
import { mirrorOf, applyStep, compare } from '../../src/match/view/mirror.js';

let games = 0, steps = 0;
for (const n of [1, 10, 11, 21, 31, 34, 40, 63, 64, 67, 75, 89, 100]) {
  for (let seed = 1; seed <= 6; seed++) {
    const g = createGame(makeLevel(n), seed), m = mirrorOf(g); let r = seed * 99991;
    assert.equal(compare(m, g), '', `L${n} start`);
    while (!g.done && g.moves < 400) {
      const ms = moves(g); r = (r * 1664525 + 1013904223) >>> 0;
      const out = play(g, ms[r % ms.length]); assert.ok(out, `L${n} move refused`);
      for (const s of out) applyStep(m, s);
      steps += out.length;
      const diff = compare(m, g); assert.equal(diff, '', `L${n} seed ${seed} move ${g.moves}: ${diff}`);
    }
    assert.ok(g.done, `L${n} unfinished`); games++;
  }
}
console.log(`steps ok (${games} games, ${steps} steps replayed)`);
