// Reading questions for the board game. Everything the girls are asked comes from the lists below, so swapping in the exact
// words from their class (e.g. a CKLA unit's Tricky Words) is just editing these arrays.
// Progress lives in the shared per-child profile (src/learn/profile.js); this file only makes the questions.
import { settings, saveSettings, levelOf as profileLevel, recordItem, recordSkill, choose } from './learn/profile.js';
import { firstSoundQ, unitForLevel } from './learn/reading.js';
export { settings, saveSettings };

// Early sight / "tricky" words: [word, what the voice says]. The voice says an example for words that sound like letters.
export const SIGHT = [
  ['the', 'the'], ['a', 'a, as in a cat'], ['I', 'I, as in I like candy'], ['is', 'is'], ['to', 'to'], ['and', 'and'], ['we', 'we'], ['my', 'my'],
  ['me', 'me'], ['see', 'see'], ['like', 'like'], ['go', 'go'], ['can', 'can'], ['you', 'you'], ['up', 'up'], ['at', 'at'],
  ['in', 'in'], ['it', 'it'], ['on', 'on'], ['no', 'no'], ['he', 'he'], ['she', 'she'], ['are', 'are'], ['was', 'was'],
];

// Short 3-letter (consonant-vowel-consonant) words, each with a picture.
export const CVC = [
  ['cat', '\u{1F431}'], ['dog', '\u{1F436}'], ['sun', '☀️'], ['hat', '\u{1F3A9}'], ['pig', '\u{1F437}'], ['bus', '\u{1F68C}'], ['cup', '\u{1F964}'], ['pen', '\u{1F58A}️'],
  ['bed', '\u{1F6CF}️'], ['fox', '\u{1F98A}'], ['bug', '\u{1F41B}'], ['jet', '✈️'], ['web', '\u{1F578}️'], ['log', '\u{1FAB5}'],
  ['rat', '\u{1F400}'], ['bat', '\u{1F987}'], ['map', '\u{1F5FA}️'], ['cap', '\u{1F9E2}'], ['pin', '\u{1F4CC}'], ['tub', '\u{1F6C1}'], ['gem', '\u{1F48E}'], ['mom', '\u{1F469}'], ['dad', '\u{1F468}'], ['nut', '\u{1F95C}'], ['hut', '\u{1F6D6}'],
];

// How to say a letter so the voice reads its NAME ("em") instead of a word.
const LETTER_NAME = { a: 'ay', b: 'bee', c: 'see', d: 'dee', e: 'ee', f: 'eff', g: 'jee', h: 'aitch', i: 'eye', j: 'jay', k: 'kay', l: 'el', m: 'em', n: 'en', o: 'oh', p: 'pee', q: 'cue', r: 'ar', s: 'ess', t: 'tee', u: 'you', v: 'vee', w: 'double you', x: 'ex', y: 'why', z: 'zee' };


const shuffle = (a) => { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
const pick = (a) => a[Math.floor(Math.random() * a.length)];

/** reading level 0..6 (shared profile) -> this file's three question mixes */
function levelOf(who) { const l = profileLevel(who, 'reading'); return l <= 1 ? 0 : l <= 3 ? 1 : 2; }

/** remember how this question went: the item's spaced-repetition box and the child's reading level (up or down) */
export function record(who, q, correct, first) {
  if (q && q.id) recordItem(who, q.id, correct, first);
  recordSkill(who, 'reading', correct, first);
}
export const levelName = (who) => ['starter', 'medium', 'tricky'][levelOf(who)];
let lastId = null;
const pickItem = (who, list, key, idOf) => { const ids = list.map(idOf); const id = choose(who, ids, lastId); return list[ids.indexOf(id)]; };

// ----- the question types -----
function sightQ(lvl, who) {
  const pool = SIGHT.slice(0, [8, 16, 24][lvl]), t = pickItem(who, pool, 'sight', (p) => `sight:${p[0]}`);
  const others = shuffle(pool.filter((p) => p[0].toLowerCase() !== t[0].toLowerCase())).slice(0, 3);
  return { id: `sight:${t[0]}`, prompt: { say: `Find the word. ${t[1]}.`, big: '\u{1F50A}' }, choices: shuffle([t, ...others]).map((p) => ({ text: p[0], correct: p === t })), answerSay: `It says ${t[1]}.` };
}
function picWordQ(lvl, who) {
  const t = pickItem(who, CVC, 'word', (p) => `word:${p[0]}`);
  const near = shuffle(CVC.filter((p) => p !== t && (p[0][0] === t[0][0] || p[0][2] === t[0][2])));
  const others = near.slice(0, 2); while (others.length < 2) { const p = pick(CVC); if (p !== t && !others.includes(p)) others.push(p); }
  return { id: `word:${t[0]}`, prompt: { say: `Which word says ${t[0]}?`, big: t[1] }, choices: shuffle([t, ...others]).map((p) => ({ text: p[0], correct: p === t })), answerSay: `This word says ${t[0]}.` };
}
function decodeQ(lvl, who) {
  const t = pickItem(who, CVC, 'read', (p) => `read:${p[0]}`), others = shuffle(CVC.filter((p) => p !== t && p[0][0] !== t[0][0])).slice(0, 2);
  return { id: `read:${t[0]}`, prompt: { say: 'Read the word. Then tap the picture!', big: t[0] }, choices: shuffle([t, ...others]).map((p) => ({ emoji: p[1], correct: p === t })), answerSay: `The word says ${t[0]}.` };
}
/** CKLA teaches letter SOUNDS first (names arrive in Unit 6): "Which one starts with /m/?", only with sounds her unit has taught */
function soundQ(lvl, who) { return firstSoundQ(who, unitForLevel(profileLevel(who, 'reading')), lastId) || sightQ(lvl, who); }
function firstLetterQ(lvl, who) {
  const t = pickItem(who, CVC, 'first', (p) => `first:${p[0][0]}`), L = t[0][0];
  const others = shuffle(CVC.filter((p) => p[0][0] !== L)).slice(0, 2);
  return { id: `first:${L}`, prompt: { say: `Which one starts with the letter ${LETTER_NAME[L]}?`, big: `${L.toUpperCase()}${L}` }, choices: shuffle([t, ...others]).map((p) => ({ emoji: p[1], correct: p === t })), answerSay: `${t[0]} starts with the letter ${LETTER_NAME[L]}.` };
}

const MIX = [
  [[sightQ, 6], [soundQ, 4]],                                       // starter: sight words + first sounds
  [[sightQ, 3], [picWordQ, 3], [soundQ, 2], [decodeQ, 2]],          // medium: adds picture words and reading short words
  [[sightQ, 3], [picWordQ, 2], [decodeQ, 5]],                       // tricky: mostly reading short words
];

export function makeQuestion(who) {
  const lvl = levelOf(who), bag = [];
  MIX[lvl].forEach(([fn, n]) => { for (let i = 0; i < n; i++) bag.push(fn); });
  const fn = pick(bag);
  const q = fn(lvl, who); lastId = q.id;
  return q;
}
