// Reading questions for the board game. Everything the girls are asked comes from the lists below, so swapping in the exact
// words from their class (e.g. a CKLA unit's Tricky Words) is just editing these arrays.

// Early sight / "tricky" words: [word, what the voice says]. The voice says an example for words that sound like letters.
export const SIGHT = [
  ['the', 'the'], ['a', 'a, as in a cat'], ['I', 'I, as in I like candy'], ['is', 'is'], ['to', 'to'], ['and', 'and'], ['we', 'we'], ['my', 'my'],
  ['me', 'me'], ['see', 'see'], ['like', 'like'], ['go', 'go'], ['can', 'can'], ['you', 'you'], ['up', 'up'], ['at', 'at'],
  ['in', 'in'], ['it', 'it'], ['on', 'on'], ['no', 'no'], ['he', 'he'], ['she', 'she'], ['are', 'are'], ['was', 'was'],
];

// Short 3-letter (consonant-vowel-consonant) words, each with a picture.
export const CVC = [
  ['cat', '\u{1F431}'], ['dog', '\u{1F436}'], ['sun', '☀️'], ['hat', '\u{1F3A9}'], ['pig', '\u{1F437}'], ['bus', '\u{1F68C}'], ['cup', '\u{1F964}'], ['pen', '\u{1F58A}️'],
  ['bed', '\u{1F6CF}️'], ['fox', '\u{1F98A}'], ['bug', '\u{1F41B}'], ['hen', '\u{1F414}'], ['van', '\u{1F690}'], ['jet', '✈️'], ['web', '\u{1F578}️'], ['log', '\u{1FAB5}'],
  ['mop', '\u{1F9F9}'], ['net', '\u{1F945}'], ['rat', '\u{1F400}'], ['pot', '\u{1F372}'], ['bat', '\u{1F987}'], ['map', '\u{1F5FA}️'], ['ram', '\u{1F40F}'], ['sit', '\u{1FA91}'],
];

// How to say a letter so the voice reads its NAME ("em") instead of a word.
const LETTER_NAME = { a: 'ay', b: 'bee', c: 'see', d: 'dee', e: 'ee', f: 'eff', g: 'jee', h: 'aitch', i: 'eye', j: 'jay', k: 'kay', l: 'el', m: 'em', n: 'en', o: 'oh', p: 'pee', q: 'cue', r: 'ar', s: 'ess', t: 'tee', u: 'you', v: 'vee', w: 'double you', x: 'ex', y: 'why', z: 'zee' };

const KEY = 'candyLearn1';
const defaults = { settings: { on: true, level: 'auto', retry: true }, kids: { adalyn: { level: 0, streak: 0 }, esmae: { level: 0, streak: 0 } } };
let data = JSON.parse(JSON.stringify(defaults));
try { const s = JSON.parse(localStorage.getItem(KEY)); if (s) data = { settings: { ...defaults.settings, ...s.settings }, kids: { ...defaults.kids, ...s.kids } }; } catch { /* first run */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* ignore */ } };

export const settings = data.settings;
export const saveSettings = save;

const shuffle = (a) => { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
const pick = (a) => a[Math.floor(Math.random() * a.length)];

function levelOf(who) { return settings.level === 'auto' ? data.kids[who].level : Math.min(2, Math.max(0, Number(settings.level) - 1)); }

/** Her answers decide the level: three right in a row moves her up; she never drops down, so it stays encouraging. */
export function record(who, correct, first) {
  const k = data.kids[who];
  if (correct && first) { k.streak++; if (k.streak >= 3 && k.level < 2) { k.level++; k.streak = 0; } } else if (!correct) k.streak = 0;
  save();
}
export const levelName = (who) => ['starter', 'medium', 'tricky'][levelOf(who)];

// ----- the question types -----
function sightQ(lvl) {
  const pool = SIGHT.slice(0, [8, 16, 24][lvl]), t = pick(pool);
  const others = shuffle(pool.filter((p) => p[0].toLowerCase() !== t[0].toLowerCase())).slice(0, 3);
  return { prompt: { say: `Find the word. ${t[1]}.`, big: '\u{1F50A}' }, choices: shuffle([t, ...others]).map((p) => ({ text: p[0], correct: p === t })), answerSay: `It says ${t[1]}.` };
}
function picWordQ() {
  const t = pick(CVC);
  const near = shuffle(CVC.filter((p) => p !== t && (p[0][0] === t[0][0] || p[0][2] === t[0][2])));
  const others = near.slice(0, 2); while (others.length < 2) { const p = pick(CVC); if (p !== t && !others.includes(p)) others.push(p); }
  return { prompt: { say: `Which word says ${t[0]}?`, big: t[1] }, choices: shuffle([t, ...others]).map((p) => ({ text: p[0], correct: p === t })), answerSay: `This word says ${t[0]}.` };
}
function decodeQ() {
  const t = pick(CVC), others = shuffle(CVC.filter((p) => p !== t && p[0][0] !== t[0][0])).slice(0, 2);
  return { prompt: { say: 'Read the word. Then tap the picture!', big: t[0] }, choices: shuffle([t, ...others]).map((p) => ({ emoji: p[1], correct: p === t })), answerSay: `The word says ${t[0]}.` };
}
function firstLetterQ() {
  const t = pick(CVC), L = t[0][0];
  const others = shuffle(CVC.filter((p) => p[0][0] !== L)).slice(0, 2);
  return { prompt: { say: `Which one starts with the letter ${LETTER_NAME[L]}?`, big: `${L.toUpperCase()}${L}` }, choices: shuffle([t, ...others]).map((p) => ({ emoji: p[1], correct: p === t })), answerSay: `${t[0]} starts with the letter ${LETTER_NAME[L]}.` };
}

const MIX = [
  [[sightQ, 6], [firstLetterQ, 4]],                                 // starter: sight words + first letters
  [[sightQ, 3], [picWordQ, 3], [firstLetterQ, 2], [decodeQ, 2]],    // medium: adds picture words and reading short words
  [[sightQ, 3], [picWordQ, 2], [decodeQ, 5]],                       // tricky: mostly reading short words
];

export function makeQuestion(who) {
  const lvl = levelOf(who), bag = [];
  MIX[lvl].forEach(([fn, n]) => { for (let i = 0; i < n; i++) bag.push(fn); });
  const fn = pick(bag);
  return fn(lvl);
}
