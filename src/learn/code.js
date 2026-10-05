// The Amplify CKLA Kindergarten Skills code, in teaching order (Units 3-10). Only the ORDER is used (a public fact);
// no CKLA text or art. Checked against the curriculum map PDF in this repo (Units 1-2 are oral: environmental sounds,
// words in sentences, syllable and phoneme blending, beginning sounds). Lowercase only until Unit 9.
export const UNITS = [
  { u: 3,  sounds: ['m', 'a', 't', 'd', 'o', 'c', 'g', 'i'],      tricky: ['one', 'two', 'three'] },
  { u: 4,  sounds: ['n', 'h', 's', 'f', 'v', 'z', 'p', 'e'],      tricky: ['a', 'the'] },
  { u: 5,  sounds: ['b', 'l', 'r', 'u', 'w', 'j', 'y', 'x', 'k'], tricky: ['blue', 'yellow', 'look'] },
  { u: 6,  sounds: [], clusters: true, names: true,               tricky: ['I', 'are', 'little'] },          // consonant clusters, letter NAMES, 's' = /z/
  { u: 7,  sounds: ['ch', 'sh', 'th', 'qu', 'ng'],                tricky: ['down', 'out', 'of'] },            // digraphs
  { u: 8,  sounds: ['ff', 'll', 'ss', 'zz', 'ck'],                tricky: ['funny', 'all', 'from', 'was'] },  // double-letter spellings
  { u: 9,  sounds: [], uppercase: true,                           tricky: ['when', 'word', 'why', 'to', 'where', 'no', 'what', 'so', 'which', 'once', 'said', 'says', 'were', 'here', 'there'] },
  { u: 10, sounds: ['ee', 'a_e', 'i_e', 'o_e', 'u_e'],            tricky: ['he', 'she', 'we', 'be', 'me', 'they', 'their', 'my', 'by', 'you', 'your'] },
];
/** how the voice bank SAYS each sound (recorded as snd_<key>.mp3): continuants are stretched, stops kept short */
export const SOUND_TEXT = { m: 'mmm', a: 'a', t: 't', d: 'd', o: 'o', c: 'k', g: 'g', i: 'i', n: 'nnn', h: 'h', s: 'sss', f: 'fff', v: 'vvv', z: 'zzz', p: 'p', e: 'e', b: 'b', l: 'lll', r: 'rrr', u: 'u', w: 'w', j: 'j', y: 'y', x: 'ks', k: 'k', ch: 'ch', sh: 'shh', th: 'th', qu: 'kw', ng: 'ng', ff: 'fff', ll: 'lll', ss: 'sss', zz: 'zzz', ck: 'k', ee: 'ee', a_e: 'ay', i_e: 'eye', o_e: 'oh', u_e: 'you' };
export const taughtThrough = (unit) => UNITS.filter((x) => x.u <= unit).flatMap((x) => x.sounds);
export const trickyThrough = (unit) => UNITS.filter((x) => x.u <= unit).flatMap((x) => x.tricky);
/** reading level 0..6 -> CKLA unit: 0 and 1 -> Unit 3, 2 -> 4, 3 -> 5, 4 -> 7 (clusters + digraphs), 5 -> 8, 6 -> 10 */
export const unitForLevel = (lvl) => [3, 3, 4, 5, 7, 8, 10][Math.max(0, Math.min(6, lvl))];
/** a short, parent-readable description of a level, for the grown-ups progress page */
export const unitLabel = (lvl) => { const u = unitForLevel(lvl), x = UNITS.find((y) => y.u === u); return `Unit ${u}${x.sounds.length ? ` (${x.sounds.join(', ')})` : ''}`; };
