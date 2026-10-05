// Reading questions gated by the CKLA code (src/learn/code.js): a child is only ever asked about sounds and words her
// unit has taught. Every question has the shape ui.quiz() consumes:
// { id, prompt: { voice: [clip ids], say: text, big, bigClass }, choices: [{ text | emoji, voice, correct }], answerVoice, answerSay, scaffold }
import { SOUND_TEXT, taughtThrough, unitForLevel } from './code.js';
import { WORDS, PIC } from './words.js';
import { choose, levelOf } from './profile.js';

export const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = (a) => a[Math.floor(Math.random() * a.length)];
export const wordsThrough = (unit) => Object.entries(WORDS).filter(([u]) => +u <= unit).flatMap(([, w]) => w);
export const withPic = (ws) => ws.filter((w) => PIC[w]);
const DIGRAPHS = ['ch', 'sh', 'th', 'qu', 'ng', 'ff', 'll', 'ss', 'zz', 'ck', 'ee'];
export const onset = (w) => (['ch', 'sh', 'th', 'qu'].includes(w.slice(0, 2)) ? w.slice(0, 2) : w[0]);
export const rime = (w) => w.slice(onset(w).length);
/** spellings that make the same first sound (cat / kite): never offered as each other's wrong answer */
const SAME = { c: 'k', k: 'k', ck: 'k' };
export const sameSound = (a, b) => (SAME[a] || a) === (SAME[b] || b);
/** 'ship' -> ['sh','i','p'], 'duck' -> ['d','u','ck'] */
export function segments(w) {
  const out = []; let i = 0;
  while (i < w.length) { const two = w.slice(i, i + 2); if (DIGRAPHS.includes(two)) { out.push(two); i += 2; } else { out.push(w[i]); i++; } }
  return out;
}
/** what the speaking voice says for a sound until the recorded clip exists (stops get a tiny vowel so they aren't letter names) */
const STOP = { t: 'tuh', d: 'duh', c: 'kuh', k: 'kuh', g: 'guh', p: 'puh', b: 'buh', j: 'juh', ck: 'kuh', qu: 'kwuh', ch: 'chuh', x: 'ks', w: 'wuh', y: 'yuh', h: 'huh' };
export const soundSay = (s) => STOP[s] || SOUND_TEXT[s] || s;

/** Unit 3+: "Which one starts with /m/?" — pictures only; the sound comes from the voice bank. */
export function firstSoundQ(who, unit, avoid) {
  const pool = withPic(wordsThrough(unit));
  const snds = [...new Set(pool.map(onset))].filter((s) => taughtThrough(unit).includes(s));
  if (!snds.length) return null;
  const s = choose(who, snds.map((x) => `snd:${x}`), avoid).slice(4);
  const t = pick(pool.filter((w) => onset(w) === s)), others = shuffle(pool.filter((w) => !sameSound(onset(w), s))).slice(0, 2);
  if (!t || others.length < 2) return null;
  return {
    id: `snd:${s}`,
    prompt: { voice: ['which_starts_with', `snd_${s}`], say: `Which one starts with ${soundSay(s)}?`, big: s, bigClass: 'readable' },
    choices: shuffle([t, ...others]).map((w) => ({ emoji: PIC[w], voice: `w_${w}`, say: w, correct: w === t })),
    answerVoice: [`w_${t}`, 'starts_with', `snd_${s}`], answerSay: `${t} starts with ${soundSay(s)}.`,
    scaffold: { kind: 'stretch', word: t },
  };
}

export { unitForLevel, levelOf };
