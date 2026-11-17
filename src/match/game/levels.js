// src/game/levels.js — all 100 levels come from this one function, so tuning the whole game is editing a few lines.
const SIZE = [[5, 5], [5, 6], [6, 6], [6, 6], [6, 7], [6, 7], [7, 7], [7, 7], [7, 7], [7, 7]];           // board per world
const PLAN = [                                                                                             // goal per level-in-world; P = party
  'cccccccccP', 'tctcctctcP', 'mctmctcmtP', 'dctdmcdtcP', 'dtmcdtcmdP', 'ctdmtcdmtP', 'dmtcdtmcdP', 'tdcmdtcmdP', 'mdtcdmtdcP', 'dtmdctmdtP'];
const PATTERNS = ['center', 'rows', 'checker', 'border', 'all', 'deep'];
const SHAPE_AT = { 2: 'round', 6: 'gem', 4: 'castle', 8: 'heart' };                                         // from world 6 on, at these positions

export function makeLevel(n, par = PAR[n - 1]) {              // n = 1 … 100
  const world = Math.floor((n - 1) / 10), j = (n - 1) % 10, [w, h] = SIZE[world], kinds = world < 2 ? 4 : 5, type = PLAN[world][j];
  const L = { n, world, w, h, kinds, par, luck: 0.25, shape: world >= 6 && w === 7 && h === 7 && SHAPE_AT[j] ? SHAPE_AT[j] : 'full' };
  if (type === 'P') return { ...L, shape: 'full', gifts: 4 + Math.floor(world / 2), goal: { type: 'pop', count: 40 + world * 6 } };
  if (type === 'c') { const many = n <= 5 ? 1 : world < 4 ? 2 : 3, first = (n * 3) % kinds;
    L.goal = { type: 'collect', kinds: Array.from({ length: many }, (_, i) => (first + i) % kinds), each: n <= 5 ? 8 + n : world < 4 ? 10 + world * 2 + (j % 3) * 2 : 12 + world + (j % 3) * 2 }; }
  if (type === 't') L.goal = { type: 'tiles', pattern: PATTERNS[Math.min(PATTERNS.length - 1, Math.floor((world - 1) / 2) + (j % 3))] };
  if (type === 'm') L.goal = { type: 'make', count: n === 21 ? 1 : Math.min(8, 2 + Math.floor((world - 2) / 2) + (j % 3)) };
  if (type === 'd') L.goal = { type: 'drop', count: n === 31 ? 1 : Math.min(4, 2 + Math.floor((world - 3) / 3) + (j % 2)), atOnce: world >= 6 ? 2 : 1 };
  if (L.goal.type === 'tiles' || L.goal.type === 'drop') L.luck = 0;
  if (n === 21) L.preset = LESSON_21;                        // the power-up lesson: a 4-in-a-line one swipe away (swap row 2 and row 3 in the third column)
  return L;
}
const LESSON_21 = ['023402', '340234', '112140', '201323', '430412', '024031'];
// Calibrated by tools/calibrate.mjs — re-run it after changing anything above; do not edit by hand.
export const PAR = [8, 8, 8, 8, 8, 11, 9, 11, 9, 8, 9, 9, 13, 9, 9, 15, 9, 13, 9, 8, 8, 17, 22, 9, 15, 24, 15, 9, 26, 8, 13, 15, 20, 30, 13, 17, 30, 22, 18, 9, 20, 20, 13, 17, 30, 24, 17, 11, 24, 9, 20, 27, 26, 11, 27, 17, 29, 13, 22, 9, 29, 15, 29, 15, 30, 30, 15, 15, 30, 9, 26, 30, 20, 11, 24, 24, 20, 13, 27, 9, 13, 30, 27, 15, 27, 17, 29, 30, 22, 9, 30, 30, 15, 30, 20, 29, 17, 30, 30, 9];
