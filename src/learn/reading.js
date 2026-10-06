// Reading questions gated by the CKLA code (src/learn/code.js): a child is only ever asked about sounds and words her
// unit has taught. Every question has the shape the shared quiz (src/engine/quiz.js) consumes:
// { id, prompt: { voice: [clip ids], say: text, big, bigClass }, choices: [{ text | emoji, voice, correct }], answerVoice, answerSay, scaffold }
import { SOUND_TEXT, taughtThrough, trickyThrough, unitForLevel } from './code.js';
import { WORDS, PIC } from './words.js';
import { choose, levelOf } from './profile.js';

export const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = (a) => a[Math.floor(Math.random() * a.length)];
export const wordsThrough = (unit) => Object.entries(WORDS).filter(([u]) => +u <= unit).flatMap(([, w]) => w);
export const withPic = (ws) => ws.filter((w) => PIC[w]);
const DIGRAPHS = ['ch', 'sh', 'th', 'qu', 'ng', 'ff', 'll', 'ss', 'zz', 'ck', 'ee'];
const VOWEL = /[aeiou]/;
export const onset = (w) => (['ch', 'sh', 'th', 'qu'].includes(w.slice(0, 2)) ? w.slice(0, 2) : w[0]);
export const rime = (w) => w.slice(onset(w).length);
/** spellings that make the same first sound (cat / kite): never offered as each other's wrong answer */
const SAME = { c: 'k', k: 'k', ck: 'k' };
export const sameSound = (a, b) => (SAME[a] || a) === (SAME[b] || b);
/** 'ship' -> ['sh','i','p'], 'duck' -> ['d','u','ck'], 'cake' -> ['c','a_e','k'] (magic e: the vowel says its name, the e is silent) */
export function segments(w) {
  const out = []; let i = 0;
  const magic = w.length >= 4 && w.endsWith('e') && !w.endsWith('ee') && VOWEL.test(w[w.length - 3]) && !VOWEL.test(w[w.length - 2]);
  const end = magic ? w.length - 1 : w.length;
  while (i < end) {
    const two = w.slice(i, i + 2);
    if (DIGRAPHS.includes(two) && i + 2 <= end) { out.push(two); i += 2; continue; }
    if (magic && i === w.length - 3) { out.push(`${w[i]}_e`); i++; continue; }
    out.push(w[i]); i++;
  }
  return out;
}
/** what the device voice says for a sound until the recorded clip exists (stops get a tiny vowel so they aren't letter names) */
const STOP = { t: 'tuh', d: 'duh', c: 'kuh', k: 'kuh', g: 'guh', p: 'puh', b: 'buh', j: 'juh', ck: 'kuh', qu: 'kwuh', ch: 'chuh', x: 'ks', w: 'wuh', y: 'yuh', h: 'huh' };
export const soundSay = (s) => STOP[s] || SOUND_TEXT[s] || s;
const sndIds = (w) => segments(w).map((s) => `snd_${s}`);
const pics = (ws, t) => ws.map((w) => ({ emoji: PIC[w], voice: `w_${w}`, say: w, correct: w === t }));
const texts = (ws, t) => ws.map((w) => ({ text: w, voice: `w_${w}`, say: w, correct: w === t }));
/** two distractors that share a first sound or an ending with the target (the near misses that teach), topped up at random */
function near(pool, t, test) {
  const out = shuffle(pool.filter((w) => w !== t && test(w))).slice(0, 2);
  for (let k = 0; out.length < 2 && k < 50; k++) { const w = pick(pool); if (w !== t && !out.includes(w)) out.push(w); }
  return out;
}

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
    choices: shuffle(pics([t, ...others], t)),
    answerVoice: [`w_${t}`, 'starts_with', `snd_${s}`], answerSay: `${t} starts with ${soundSay(s)}.`,
    scaffold: { kind: 'stretch', word: t },
  };
}
/** Unit 3+: blending — the voice says the sounds slowly, /c/ /a/ /t/, and the child taps the picture. */
export function blendQ(who, unit, avoid) {
  const pool = withPic(wordsThrough(unit)).filter((w) => w.length <= 3 || unit >= 6);
  if (pool.length < 3) return null;
  const t = choose(who, pool.map((w) => `blend:${w}`), avoid).slice(6);
  const others = near(pool, t, (w) => rime(w) === rime(t) || onset(w) === onset(t));
  return {
    id: `blend:${t}`,
    prompt: { voice: ['listen', ...sndIds(t)], say: `Listen. ${segments(t).map(soundSay).join(', ')}.`, big: '\u{1F442}' },
    choices: shuffle(pics([t, ...others], t)),
    answerVoice: [...sndIds(t), `w_${t}`], answerSay: `${segments(t).map(soundSay).join(', ')}. ${t}!`,
    scaffold: { kind: 'blend', word: t },
  };
}
/** Unit 4+: picture -> word: "Which word says cat?" */
export function picWordQ(who, unit, avoid) {
  const pool = withPic(wordsThrough(unit)); if (pool.length < 3) return null;
  const t = choose(who, pool.map((w) => `word:${w}`), avoid).slice(5);
  const others = near(pool, t, (w) => onset(w) === onset(t) || rime(w) === rime(t));
  return {
    id: `word:${t}`, prompt: { voice: ['which_word_says', `w_${t}`], say: `Which word says ${t}?`, big: PIC[t] },
    choices: shuffle(texts([t, ...others], t)), answerVoice: ['this_word_says', `w_${t}`], answerSay: `This word says ${t}.`, scaffold: { kind: 'segment', word: t },
  };
}
/** Unit 5+: decode — the word is shown, the child taps its picture (reading, not matching). */
export function decodeQ(who, unit, avoid) {
  const pool = withPic(wordsThrough(unit)); if (pool.length < 3) return null;
  const t = choose(who, pool.map((w) => `read:${w}`), avoid).slice(5);
  const others = shuffle(pool.filter((w) => w !== t && onset(w) !== onset(t))).slice(0, 2);
  if (others.length < 2) return null;
  return {
    id: `read:${t}`, prompt: { voice: ['read_the_word_tap_picture'], say: 'Read the word. Then tap the picture!', big: t, bigClass: 'readable' },
    choices: shuffle(pics([t, ...others], t)), answerVoice: ['the_word_says', `w_${t}`], answerSay: `The word says ${t}.`, scaffold: { kind: 'segment', word: t },
  };
}
/** Unit 3+: Tricky Words — whole-word recognition from the voice. */
export function trickyQ(who, unit, avoid) {
  const pool = trickyThrough(unit); if (pool.length < 3) return null;
  const t = choose(who, pool.map((w) => `tricky:${w}`), avoid).slice(7);
  const others = shuffle(pool.filter((w) => w !== t)).slice(0, 2);
  return {
    id: `tricky:${t}`, prompt: { voice: ['find_the_word', `w_${t}`], say: `Find the word. ${t}.`, big: '\u{1F50A}' },
    choices: shuffle(texts([t, ...others], t)), answerVoice: ['it_says', `w_${t}`], answerSay: `It says ${t}.`, scaffold: { kind: 'show', word: t },
  };
}
/** Unit 6+: letter NAMES, only after CKLA introduces them. */
export function letterNameQ(who, unit, avoid) {
  const L = taughtThrough(unit).filter((s) => s.length === 1); if (L.length < 3) return null;
  const t = choose(who, L.map((x) => `name:${x}`), avoid).slice(5);
  const others = shuffle(L.filter((x) => x !== t)).slice(0, 2), upper = unit >= 9 && Math.random() < .5;
  return {
    id: `name:${t}`, prompt: { voice: ['find_the_letter', `name_${t}`], say: `Find the letter ${t}.`, big: '\u{1F524}' },
    choices: shuffle([t, ...others]).map((x) => ({ text: upper ? x.toUpperCase() : x, voice: `name_${x}`, correct: x === t })),
    answerVoice: ['this_is', `name_${t}`], answerSay: `This is ${t}.`,
  };
}
/** question mix per reading level 0..6 (weights) */
const MIX = {
  0: [[firstSoundQ, 6], [blendQ, 4]],
  1: [[firstSoundQ, 4], [blendQ, 4], [trickyQ, 2]],
  2: [[firstSoundQ, 2], [blendQ, 3], [picWordQ, 3], [trickyQ, 2]],
  3: [[blendQ, 2], [picWordQ, 3], [decodeQ, 3], [trickyQ, 2]],
  4: [[picWordQ, 2], [decodeQ, 4], [trickyQ, 2], [letterNameQ, 2]],
  5: [[decodeQ, 5], [trickyQ, 3], [letterNameQ, 2]],
  6: [[decodeQ, 6], [trickyQ, 4]],
};
let lastId = null;
/** the next reading question for this child (never the same item twice in a row) */
export function makeReadingQuestion(who) {
  const lvl = levelOf(who, 'reading'), unit = unitForLevel(lvl);
  const bag = MIX[lvl].flatMap(([fn, n]) => Array(n).fill(fn));
  for (let tries = 0; tries < 10; tries++) { const q = pick(bag)(who, unit, lastId); if (q) { lastId = q.id; q.strand = 'reading'; return q; } }
  const q = firstSoundQ(who, unit, lastId) || blendQ(who, unit, lastId); lastId = q.id; q.strand = 'reading'; return q;
}
export { unitForLevel, levelOf };
