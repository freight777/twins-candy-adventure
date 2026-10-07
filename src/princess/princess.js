// Princess Esmae's Royal Kitchen: the math game. The princess orders a dish and the order IS a math question on the IM K
// progression (learn/math.js: subitize, count, compare, add and take away with objects, make ten, teen numbers), asked
// with the shared errorless quiz and drawn with the dishes themselves. The butler serves it and she eats. Every third dish
// is a kitchen station (cookie shapes, juice to compare, Tony's egg delivery). Ten dishes make a royal feast.
import '../engine/fonts.css';
import { FOODS, princessSVG, staffSVG, wallSVG, floorSVG, tableSVG } from './art.js';
import { unlock, sfx, sayAsync, stopSpeech } from '../audio.js';
import { homeGate } from '../engine/gate.js';
import { ask } from '../engine/quiz.js';
import { makeMathQuestion } from '../learn/math.js';
import { startSession } from '../learn/profile.js';
import { earn } from '../engine/sticker.js';
import { STATIONS } from './stations.js';
homeGate();

const $ = (s) => document.querySelector(s);
const WHO = 'esmae', GOAL = 10;
/** serving times (ms); the CSS walks use the same numbers (--walk) */
const T = { arrive: 1800, leave: 2600, gone: 3800, next: 4400, quick: 1500 };
const princess = $('#princess'), plate = $('#plate'), butler = $('#butler'), tony = $('#tony'), wish = $('#wish');

$('#wall').innerHTML = wallSVG();
$('#floor').innerHTML = floorSVG();
$('#tablesvg').innerHTML = tableSVG();
princess.innerHTML = princessSVG();
$('#butler .b-body').innerHTML = staffSVG('butler');
$('#tony .b-body').innerHTML = staffSVG('tony');
document.documentElement.style.setProperty('--walk', `${T.arrive - 100}ms`);

// staff wandering around the back of the hall with trays: [kind, feet height from bottom (%), height (vh), seconds to cross, start offset, direction]
[['maid', 17, 24, 34, -4, false], ['cook', 15, 27, 44, -22, true], ['footman', 19, 22, 38, -30, false], ['maid', 14, 30, 52, -12, true]].forEach(([kind, y, h, dur, delay, rev]) => {
  const w = document.createElement('div');
  w.className = 'walker' + (rev ? ' rev' : '');
  w.style.cssText = `bottom:${y}%;height:${h}vh;--dur:${dur}s;--delay:${delay}s`;
  w.innerHTML = `<div>${staffSVG(kind)}</div>`;
  $('#staff').appendChild(w);
});

// the chandelier flames flicker as tiny elements of their own over the wall (animating them inside the full-screen wall
// SVG made the browser repaint the whole wall every frame)
const FLAMES = [600, 1000].flatMap((cx) => [-64, -32, 0, 32, 64].map((dx) => [cx + dx, 90 + Math.abs(dx) * .28]));
const flameBox = document.createElement('div'); flameBox.id = 'flames'; $('#wall').appendChild(flameBox);
const flames = FLAMES.map((_, i) => { const f = document.createElement('i'); f.className = 'flame-x'; f.style.animationDelay = `${-i * .23}s`; flameBox.appendChild(f); return f; });
function placeFlames() {      // the wall SVG is 1600 x 640, "xMidYMax slice"
  const r = $('#wall').getBoundingClientRect(), s = Math.max(r.width / 1600, r.height / 640), ox = (r.width - 1600 * s) / 2, oy = r.height - 640 * s;
  flames.forEach((f, i) => { const [x, y] = FLAMES[i]; f.style.cssText += `;left:${ox + x * s}px;top:${oy + y * s}px;width:${10 * s}px;height:${18 * s}px`; });
}
addEventListener('resize', placeFlames); placeFlames();
// (an easter egg) the chandeliers can be tapped: they jingle and a friendly bat flies out
[0, 5].forEach((i) => { const b = document.createElement('button'); b.className = 'chandelier'; b.setAttribute('aria-label', 'chandelier'); b.dataset.i = i; flameBox.appendChild(b); });
function placeChandeliers() { document.querySelectorAll('.chandelier').forEach((b) => { const f = flames[+b.dataset.i + 2]; b.style.left = f.style.left; b.style.top = f.style.top; }); }
addEventListener('resize', placeChandeliers); placeChandeliers();
flameBox.addEventListener('pointerdown', (e) => {
  if (!e.target.classList.contains('chandelier')) return; e.stopPropagation();
  sfx.ting(); flames.forEach((f) => f.classList.add('jingle')); setTimeout(() => flames.forEach((f) => f.classList.remove('jingle')), 900);
  const bat = document.createElement('div'); bat.className = 'bat'; bat.textContent = '\u{1F987}'; bat.style.left = e.target.style.left; bat.style.top = e.target.style.top; document.body.appendChild(bat);
  setTimeout(() => bat.remove(), 2600); earn(WHO, 'egg-bat');
});

// the dishes counter: a ten-frame of stars (the counter itself teaches ten)
$('#stars .sf').innerHTML = '<i>⭐</i>'.repeat(GOAL);
const showStars = (n) => { let k = 0; document.querySelectorAll('#stars .sf i').forEach((c, i) => { const on = i < n; if (on && !c.classList.contains('on')) c.style.animationDelay = `${k++ * 90}ms`; c.classList.toggle('on', on); }); };

const say = (text, opts = {}) => sayAsync(text, 'princess', { priority: 2, ...opts });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let served = 0, queue = [], dishes = [], hurry = null, noodles = 0;

/** the next food, each one once before any repeats */
function nextFood() {
  if (!queue.length) queue = FOODS.slice();
  return queue.splice(Math.floor(Math.random() * queue.length), 1)[0];
}
function showWish(html) { wish.querySelector('.w-food').innerHTML = html; wish.classList.remove('hidden'); wish.style.animation = 'none'; void wish.offsetWidth; wish.style.animation = ''; }

async function round() {
  const st = served % 3 === 2 ? STATIONS[Math.floor(served / 3) % STATIONS.length] : null;
  if (st) return stationRound(st);
  const food = nextFood(), other = FOODS[(FOODS.indexOf(food) + 1) % FOODS.length];
  showWish(food.svg());
  await say(`I'd like ${food.a}, please!`);
  const r = await ask(makeMathQuestion(WHO), WHO, { icon: food.emoji, iconAlt: other.emoji });
  wish.classList.add('hidden');
  noodles += food.id === 'noodles' ? 1 : 0;
  if (noodles === 3) { butler.classList.add('dance'); setTimeout(() => butler.classList.remove('dance'), 5200); earn(WHO, 'egg-dance'); }   // (an easter egg: the dancing butler)
  await serve({ html: food.svg(), thanks: `Yummy ${food.name}! Thank you!` }, r.first && !r.helped);
  next();
}
/** a kitchen station: two quick questions, then its treat is served */
async function stationRound(st) {
  showWish(`<div class="dish-emoji">${st.emoji}</div>`);
  await say(st.intro);
  if (st.arrive) await st.arrive({ tony, say, sfx, wait });
  for (let i = 0; i < 2; i++) await ask(st.question(WHO), WHO, st.opts || {});
  wish.classList.add('hidden');
  await serve({ html: `<div class="dish-emoji">${st.emoji}</div>`, thanks: st.thanks }, true);
  next();
}
function next() {
  served++; showStars(served);
  if (served >= GOAL) feast(); else round();
}

/** The butler walks in with the dish, sets it on the table, bows and leaves; then she eats. A scaffolded answer gets a quick
 *  serve, and a tap anywhere hurries things along. */
function serve(dish, full) {
  dishes.push(dish.html);
  return new Promise((resolve) => {
    const timers = [], at = (ms, fn) => timers.push(setTimeout(fn, ms));
    let finished = false;
    const finish = () => { if (finished) return; finished = true; timers.forEach(clearTimeout); hurry = null; plate.className = ''; plate.innerHTML = ''; butler.className = ''; princess.classList.remove('cheer'); resolve(); };
    const eat = () => { princess.classList.add('cheer'); sfx.yum(); say(dish.thanks, { priority: 1 }); plate.classList.add('eat'); hearts(); };
    if (full) {
      butler.className = ''; butler.querySelector('.b-food').innerHTML = dish.html; void butler.offsetWidth;
      sfx.ting(); butler.classList.add('walking', 'in');
      at(T.arrive, () => { butler.classList.remove('walking'); butler.classList.add('set', 'bow'); plate.innerHTML = dish.html; plate.classList.add('in'); sfx.ting(); });
      at(T.leave, () => { butler.classList.remove('bow', 'in'); butler.classList.add('walking', 'out'); eat(); });
      at(T.gone, () => { princess.classList.remove('cheer'); plate.classList.add('gone'); });
      at(T.next, finish);
    } else {                                                            // quick serve: the dish just appears with a sparkle
      plate.innerHTML = dish.html; plate.classList.add('in'); sfx.ting(); at(300, eat); at(T.quick, finish);
    }
    hurry = () => { stopSpeech(); finish(); };
  });
}
$('#scene').addEventListener('pointerdown', (e) => { if (hurry && !e.target.closest('#home')) hurry(); });

function hearts(n = 8, area = [6, 18]) {
  const box = $('#hearts');
  for (let i = 0; i < n; i++) {
    const h = document.createElement('span'); h.className = 'heart'; h.textContent = ['❤️', '\u{1F496}', '✨', '\u{1F49B}'][i % 4];
    h.style.left = (area[0] + Math.random() * area[1]) + '%'; h.style.animationDelay = (i * 0.12) + 's';
    box.appendChild(h); setTimeout(() => h.remove(), 2400 + i * 120);
  }
}

/** ten dishes: every dish she was served comes back on the table at once */
async function feast() {
  const f = $('#feast'); f.innerHTML = dishes.slice(-GOAL).map((d, i) => `<div style="animation-delay:${i * 120}ms">${d}</div>`).join('');
  sfx.fanfare(); hearts(24, [5, 90]); princess.classList.add('cheer'); earn(WHO, 'royal-feast');
  await say('A royal feast! Ten dishes!'); await wait(600);
  princess.classList.remove('cheer'); $('#again').classList.remove('hidden'); say('Again?', { priority: 1 });
}
$('#again-yes').addEventListener('click', () => {
  $('#again').classList.add('hidden'); $('#feast').innerHTML = ''; served = 0; dishes = []; noodles = 0; showStars(0); round();
});

$('#go').addEventListener('click', () => {
  unlock(); startSession(WHO);
  $('#start').classList.add('hidden');
  round();
});
