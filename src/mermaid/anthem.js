// An original, glowing "golden hour" anthem for the finale, written for computer sounds (it is NOT a copy of any real song).
// Chords: Em - C - G - D, twice, then a bright finish. MIDI note numbers, 8 eighth-notes per bar.
const MIN = [0, 3, 7], MAJ = [0, 4, 7];
const bar = (root, qual, mel) => ({ chord: [root, qual], mel });
import { wordsThrough, withPic, shuffle } from '../learn/reading.js';
/** the read-along: one word per bar that the child can already read (her CKLA unit), with a picture when there is one */
export function singWords(unit, bars = 16) {
  const pics = shuffle(withPic(wordsThrough(unit))), more = shuffle(wordsThrough(unit).filter((w) => !pics.includes(w)));
  const pool = pics.length >= 6 ? pics : pics.concat(more.slice(0, 8 - pics.length));
  return Array.from({ length: bars }, (_, i) => pool[i % pool.length]);
}
export const ANTHEM = {
  bpm: 92,
  bars: [
    bar(52, MIN, [83, null, 83, 81, 79, null, 76, null]),
    bar(48, MAJ, [79, null, 79, 81, 83, null, 79, null]),
    bar(55, MAJ, [86, null, 83, 81, 79, null, 83, null]),
    bar(50, MAJ, [81, null, 79, 78, 79, 81, null, null]),
    bar(52, MIN, [88, null, 86, 83, null, 83, 86, null]),
    bar(48, MAJ, [84, null, 83, 79, null, 79, 83, null]),
    bar(55, MAJ, [86, null, 83, 79, null, 74, 79, null]),
    bar(50, MAJ, [78, 79, 81, 83, 86, null, null, null]),
    bar(52, MIN, [91, null, 91, 88, 86, null, 83, null]),
    bar(48, MAJ, [88, null, 88, 86, 84, null, 88, null]),
    bar(55, MAJ, [91, null, 88, 86, 83, null, 86, null]),
    bar(50, MAJ, [90, null, 88, 86, 88, 90, null, null]),
    bar(52, MIN, [91, 93, 91, 88, null, 88, 91, null]),
    bar(48, MAJ, [88, null, 86, 84, null, 84, 88, null]),
    bar(55, MAJ, [86, 88, 91, 86, 83, null, 79, null]),
    bar(52, MIN, [88, null, null, null, 83, null, null, null]),
  ],
};
