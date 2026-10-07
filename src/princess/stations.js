// The kitchen stations (every third dish), each one Illustrative Mathematics K activity, sized by her math level:
//   cookie cutters  (IM K Unit 3, shapes): "Which cookie is a triangle?", later "Find the shape with 3 sides"
//   juice           (IM K Unit 7, measurement): "Which glass has more juice?" / "less juice?"
//   egg delivery    (IM K Units 2, 5, 6): Tony brings a crate; count the eggs, make ten, or "ten and three, how many?"
// Questions use the shared quiz's shape (src/engine/quiz.js); pictures are inline SVG.
import { levelOf } from '../learn/profile.js';
import { MATH_KINDS } from '../learn/math.js';

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ---------------------------------------------------------------- cookie cutters
const SHAPES = {
  circle: '<circle cx="50" cy="50" r="40"/>',
  triangle: '<path d="M50 10 L92 86 H8Z" stroke-linejoin="round"/>',
  square: '<rect x="14" y="14" width="72" height="72" rx="6"/>',
  rectangle: '<rect x="4" y="26" width="92" height="48" rx="6"/>',
  hexagon: '<path d="M30 12 H70 L92 50 L70 88 H30 L8 50Z" stroke-linejoin="round"/>',
};
const SIDES = { triangle: 3, hexagon: 6 };
const cookie = (s) => `<svg viewBox="0 0 100 100" class="cookie"><g fill="#e8b46a" stroke="#b97a32" stroke-width="5">${SHAPES[s]}</g>
  <g fill="#6b3a1c"><circle cx="40" cy="44" r="4"/><circle cx="60" cy="56" r="4"/><circle cx="48" cy="64" r="3.4"/></g><g fill="#ff7ab8"><rect x="56" y="36" width="8" height="3" rx="1.5" transform="rotate(30 60 37)"/><rect x="34" y="58" width="8" height="3" rx="1.5" transform="rotate(-20 38 59)"/></g></svg>`;
function shapeQ(who) {
  const lvl = levelOf(who, 'math'), names = lvl <= 1 ? ['circle', 'triangle', 'square'] : Object.keys(SHAPES);
  const target = pick(names), byName = lvl < 4 || !SIDES[target];
  const others = shuffle(names.filter((s) => s !== target && !(target === 'square' && s === 'rectangle') && !(target === 'rectangle' && s === 'square'))).slice(0, 2);
  return {
    id: `shape:${target}`, strand: 'math', kind: 'shape',
    prompt: byName ? { voice: ['which_cookie_is', `shape_${target}`], say: `Which cookie is a ${target}?` } : { voice: ['find_shape_with', `n_${SIDES[target]}`, 'sides'], say: `Find the shape with ${SIDES[target]} sides.` },
    choices: shuffle([target, ...others]).map((s) => ({ html: cookie(s), voice: `shape_${s}`, say: s, correct: s === target })),
    answerVoice: [`shape_${target}`], answerSay: target,
  };
}

// ---------------------------------------------------------------- juice
const glass = (fill, color) => { const top = 88 - fill * 70; return `<svg viewBox="0 0 80 100" class="glass"><path d="M14 8 L22 92 H58 L66 8Z" fill="#eaf6ff" stroke="#9ccbe8" stroke-width="4" stroke-linejoin="round"/>
  <path d="M${14 + (top - 8) * .095} ${top} L22 92 H58 L${66 - (top - 8) * .095} ${top}Z" fill="${color}"/><path d="M${14 + (top - 8) * .095} ${top} H${66 - (top - 8) * .095}" stroke="#fff" stroke-opacity=".6" stroke-width="3"/>
  <path d="M20 14 L26 84" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".7"/></svg>`; };
function juiceQ(who) {
  const lvl = levelOf(who, 'math'), less = lvl >= 2 && Math.random() < .4;
  const [a, b] = shuffle(lvl <= 1 ? [.25, .85] : pick([[.3, .8], [.4, .75], [.5, .8], [.35, .6]])), color = pick(['#ff9a3a', '#ff5f8a', '#a64dff', '#3ddc6b']);
  const win = less ? (a < b ? 0 : 1) : (a > b ? 0 : 1);
  return {
    id: `juice:${less ? 'less' : 'more'}`, strand: 'math', kind: 'measure',
    prompt: { voice: [less ? 'which_less_juice' : 'which_more_juice'], say: less ? 'Which glass has less juice?' : 'Which glass has more juice?' },
    choices: [a, b].map((f, i) => ({ html: glass(f, color), say: 'this one', correct: i === win })),
    answerVoice: [less ? 'less_juice' : 'more_juice'], answerSay: less ? 'That one has less!' : 'That one has more!',
  };
}

// ---------------------------------------------------------------- the egg delivery: count, make ten, or teen numbers by level
function eggQ(who) {
  const lvl = levelOf(who, 'math');
  const q = lvl >= 5 ? MATH_KINDS.teenQ(who) : lvl >= 4 ? MATH_KINDS.make10Q(who) : MATH_KINDS.countQ(who, null, lvl <= 1 ? 6 : 10);
  q.strand = 'math'; delete q.equation;
  return q;
}
/** Tony (from the Home Run Derby, in his cap) rings the bell and carries the crate in */
async function tonyArrives({ tony, sfx, wait }) {
  sfx.ting(); await wait(250); sfx.ting();
  tony.className = ''; void tony.offsetWidth; tony.classList.add('walking', 'in');
  await wait(1900); tony.classList.remove('walking'); tony.classList.add('bow'); await wait(700);
  tony.classList.remove('bow', 'in'); tony.classList.add('walking', 'out');
  setTimeout(() => (tony.className = ''), 2000);
}

export const STATIONS = [
  { key: 'cookies', emoji: '\u{1F36A}', intro: "Cookie time! Let's cut some cookies!", thanks: 'Yummy cookies! Thank you!', question: shapeQ },
  { key: 'juice', emoji: '\u{1F9C3}', intro: 'Juice time! Which glass is for me?', thanks: 'Yummy juice! Thank you!', question: juiceQ },
  { key: 'eggs', emoji: '\u{1F382}', intro: 'Ding dong! Tony brought eggs for a cake!', thanks: 'Yummy cake! Thank you!', question: eggQ, arrive: tonyArrives, opts: { icon: '\u{1F95A}', iconAlt: '\u{1F95A}' } },
];
