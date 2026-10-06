// Math questions on the Illustrative Mathematics K progression (the basis of Amplify Desmos Math; IM K-5 is CC BY 4.0).
// Levels 0..6: 0 = U1 subitize 1-5 + count to 5, 1 = U2 count/compare to 10, 2 = U4 add within 5 with objects,
// 3 = U4 add/sub within 10 (objects + numerals), 4 = U5 make 10 / break apart, 5 = U6 teen numbers as "ten and some more",
// 6 = fluency within 5 (numerals only) mixed with the rest. Representations go concrete -> pictures/frames -> numerals.
import { choose, levelOf } from './profile.js';
const R = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
/** pick a number the child's memory says is due, by item id (prefix:n) */
const due = (who, prefix, nums, avoid) => +choose(who, nums.map((n) => `${prefix}:${n}`), avoid).split(':')[1];
/** three numeral choices: the answer, a typical mistake when it fits, and a near miss */
function numChoices(ans, lo, hi, errors = []) {
  const set = new Set([ans]);
  for (const e of errors) if (e >= lo && e <= hi && set.size < 3) set.add(e);
  for (let k = 0; set.size < 3 && k < 40; k++) { const d = ans + (Math.random() < .5 ? -1 : 1) * R(1, 2); if (d >= lo && d <= hi) set.add(d); }
  for (let d = lo; set.size < 3 && d <= hi; d++) set.add(d);
  return shuffle([...set]).map((n) => ({ text: String(n), voice: `n_${n}`, num: n, correct: n === ans }));
}

/** U1: subitizing — dots flash on a 5-frame for 1.2 s, then "How many?" */
function subitizeQ(who, avoid) {
  const n = due(who, 'subit', range(1, 5), avoid);
  return { id: `subit:${n}`, kind: 'subitize', show: { frame: 5, dots: n, flashMs: 1400 }, prompt: { voice: ['how_many'], say: 'How many?' }, choices: numChoices(n, 1, 5), answerVoice: [`n_${n}`], answerSay: String(n), scaffold: { kind: 'count', n } };
}
/** U1/U2: count a collection — each tap on an object says the next number, then pick the numeral. */
function countQ(who, avoid, max = 10) {
  const n = due(who, 'count', range(1, max), avoid);
  return { id: `count:${n}`, kind: 'count', show: { objects: n, scatter: n > 5 }, prompt: { voice: ['how_many_tap_each'], say: 'How many? Tap each one to count!' }, choices: numChoices(n, 1, max, [n - 1, n + 1]), answerVoice: [`n_${n}`], answerSay: String(n), scaffold: { kind: 'count', n }, tapToCount: true };
}
/** U2: compare — two groups: "Which has more?" (and "fewer" from level 2). */
function compareQ(who, avoid) {
  let a = R(1, 10), b = R(1, 10); while (a === b) b = R(1, 10);
  const more = Math.random() < .6 || levelOf(who, 'math') < 2, win = more ? (a > b ? 0 : 1) : (a < b ? 0 : 1);
  return { id: `cmp:${Math.abs(a - b) <= 2 ? 'close' : 'far'}`, kind: 'compare', show: { groups: [a, b] }, prompt: { voice: [more ? 'which_has_more' : 'which_has_fewer'], say: more ? 'Which has more?' : 'Which has fewer?' },
    choices: [{ group: 0, correct: win === 0 }, { group: 1, correct: win === 1 }], answerVoice: [`n_${win ? b : a}`, more ? 'is_more' : 'is_fewer'], answerSay: `${win ? b : a} is ${more ? 'more' : 'fewer'}!`, scaffold: { kind: 'count-groups' } };
}
/** U4: addition as a little story with objects: "Here are 3, and 2 more. How many now?" */
function addStoryQ(who, avoid, within = 10) {
  const sum = due(who, 'add', range(2, within), avoid), a = R(1, sum - 1), b = sum - a;
  return { id: `add:${sum}`, kind: 'add', a, b, show: { objects: [a, b] }, prompt: { voice: ['here_are', `n_${a}`, 'and', `n_${b}`, 'more', 'how_many_now'], say: `Here are ${a}, and ${b} more. How many now?` }, equation: `${a} + ${b} = ?`,
    choices: numChoices(sum, 1, within, [Math.max(a, b), sum - 1]), answerVoice: [`n_${a}`, 'plus', `n_${b}`, 'is', `n_${sum}`], answerSay: `${a} plus ${b} is ${sum}.`, scaffold: { kind: 'count-on', a, b } };
}
/** U4: subtraction as "take away" with objects that visibly leave. */
function subStoryQ(who, avoid, within = 10) {
  const a = R(2, within), b = R(1, a - 1), ans = a - b;
  return { id: `take:${a}`, kind: 'sub', a, b, show: { objects: [a], remove: b }, prompt: { voice: ['here_are', `n_${a}`, 'take_away', `n_${b}`, 'how_many_left'], say: `Here are ${a}, take away ${b}. How many are left?` }, equation: `${a} − ${b} = ?`,
    choices: numChoices(ans, 0, within, [a, b]), answerVoice: [`n_${a}`, 'take_away', `n_${b}`, 'is', `n_${ans}`], answerSay: `${a} take away ${b} is ${ans}.`, scaffold: { kind: 'count-left', a, b } };
}
/** U5: make 10 on a ten-frame — "7 and how many more make 10?" The empty cells ARE the answer. */
function make10Q(who, avoid) {
  const a = due(who, 'm10', range(1, 9), avoid);
  return { id: `m10:${a}`, kind: 'make10', a, show: { frame: 10, dots: a }, prompt: { voice: [`n_${a}`, 'and_how_many_more_make_ten'], say: `${a}, and how many more make ten?` }, choices: numChoices(10 - a, 1, 9, [a]), answerVoice: [`n_${a}`, 'and', `n_${10 - a}`, 'make', 'n_10'], answerSay: `${a} and ${10 - a} make ten.`, scaffold: { kind: 'count-empty', a } };
}
/** U5: break apart — "5 is 2 and how many?" shown as a number bond. */
function breakQ(who, avoid) {
  const n = due(who, 'brk', range(3, 10), avoid), a = R(1, n - 1);
  return { id: `brk:${n}`, kind: 'break', n, a, show: { bond: [n, a] }, prompt: { voice: [`n_${n}`, 'is', `n_${a}`, 'and_how_many'], say: `${n} is ${a}, and how many?` }, choices: numChoices(n - a, 1, 9, [n, a]), answerVoice: [`n_${n}`, 'is', `n_${a}`, 'and', `n_${n - a}`], answerSay: `${n} is ${a} and ${n - a}.`, scaffold: { kind: 'count-bond', n, a } };
}
/** U6: teen numbers as ten and some more — a full ten-frame plus loose ones. */
function teenQ(who, avoid) {
  const n = due(who, 'teen', range(11, 20), avoid);
  return { id: `teen:${n}`, kind: 'teen', show: { frame: 10, dots: 10, extra: n - 10 }, prompt: { voice: ['ten_and', `n_${n - 10}`, 'how_many'], say: `Ten and ${n - 10}. How many?` }, choices: numChoices(n, 11, 20, [n - 10, n + 1]), answerVoice: ['ten_and', `n_${n - 10}`, 'is', `n_${n}`], answerSay: `Ten and ${n - 10} is ${n}.`, scaffold: { kind: 'count-on-ten', n } };
}
/** fluency within 5: numerals only (what Princess Kitchen used to ask first; now the last step) */
function fluentQ(who, avoid) {
  const sum = R(2, 5), a = R(1, sum - 1), b = sum - a;
  return { id: `flu:${a}+${b}`, kind: 'fluent', a, b, equation: `${a} + ${b} = ?`, prompt: { voice: [`n_${a}`, 'plus', `n_${b}`], say: `${a} plus ${b}` }, choices: numChoices(sum, 1, 5), answerVoice: [`n_${a}`, 'plus', `n_${b}`, 'is', `n_${sum}`], answerSay: `${a} plus ${b} is ${sum}.`, scaffold: { kind: 'fingers', a, b } };
}

const MIX = {
  0: [[subitizeQ, 5], [(w, a) => countQ(w, a, 5), 5]],
  1: [[subitizeQ, 2], [countQ, 5], [compareQ, 3]],
  2: [[countQ, 2], [compareQ, 2], [(w, a) => addStoryQ(w, a, 5), 6]],
  3: [[addStoryQ, 4], [subStoryQ, 4], [compareQ, 2]],
  4: [[addStoryQ, 2], [subStoryQ, 2], [make10Q, 4], [breakQ, 2]],
  5: [[make10Q, 2], [breakQ, 2], [teenQ, 4], [addStoryQ, 2]],
  6: [[fluentQ, 4], [addStoryQ, 2], [subStoryQ, 2], [teenQ, 2]],
};
let lastId = null;
/** the next math question for this child; equations only appear from level 2 up (concrete first) */
export function makeMathQuestion(who, { kinds = null } = {}) {
  const lvl = levelOf(who, 'math');
  let bag = MIX[lvl].flatMap(([fn, n]) => Array(n).fill(fn));
  if (kinds) { const only = bag.filter((fn) => kinds.some((k) => fn.name.startsWith(k))); if (only.length) bag = only; }
  const q = pick(bag)(who, lastId); lastId = q.id; q.strand = 'math';
  if (lvl < 2) delete q.equation;
  return q;
}
/** an addition question about two amounts the child just collected (used after the meadow's two missions) */
export function storyAdd(a, b, { icon, iconAlt } = {}) {
  const sum = a + b, within = Math.max(10, sum);
  return { id: `add:${sum}`, strand: 'math', kind: 'add', a, b, show: { objects: [a, b] }, prompt: { voice: ['here_are', `n_${a}`, 'and', `n_${b}`, 'more', 'how_many_now'], say: `Here are ${a}, and ${b} more. How many now?` },
    equation: `${a} + ${b} = ?`, choices: numChoices(sum, 1, within, [Math.max(a, b), sum - 1]), answerVoice: [`n_${a}`, 'plus', `n_${b}`, 'is', `n_${sum}`], answerSay: `${a} plus ${b} is ${sum}.`, scaffold: { kind: 'count-on', a, b }, icon, iconAlt };
}
export const MATH_KINDS = { subitizeQ, countQ, compareQ, addStoryQ, subStoryQ, make10Q, breakQ, teenQ, fluentQ };
