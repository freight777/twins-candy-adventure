import { FOODS, princessSVG, staffSVG, wallSVG, floorSVG, tableSVG } from './art.js';
import { unlock, say as speak, sfx as fx } from '../audio.js';

const $ = (s) => document.querySelector(s);
const princess = $('#princess'), plate = $('#plate'), quiz = $('#quiz'), butler = $('#butler');
const qPrompt = $('.q-prompt'), qChoices = $('.q-choices'), qMsg = $('.q-msg'), wish = $('#wish');

$('#wall').innerHTML = wallSVG();
$('#floor').innerHTML = floorSVG();
$('#tablesvg').innerHTML = tableSVG();
princess.innerHTML = princessSVG();
$('#butler .b-body').innerHTML = staffSVG('butler');

// staff wandering around the back of the hall with trays: [kind, feet height from bottom (%), height (vh), seconds to cross, start offset, direction]
[['maid', 17, 24, 34, -4, false], ['cook', 15, 27, 44, -22, true], ['footman', 19, 22, 38, -30, false], ['maid', 14, 30, 52, -12, true]].forEach(([kind, y, h, dur, delay, rev]) => {
  const w = document.createElement('div');
  w.className = 'walker' + (rev ? ' rev' : '');
  w.style.cssText = `bottom:${y}%;height:${h}vh;--dur:${dur}s;--delay:${delay}s`;
  w.innerHTML = `<div>${staffSVG(kind)}</div>`;
  $('#staff').appendChild(w);
});

// ---------- sound: the shared audio (src/audio.js) — same voices, reverb and lock/unlock handling as the other games ----------
const say = (text) => speak(text, 'princess');
const sfx = { good: fx.good, bell: fx.ting, oops: fx.soft, yum: fx.yum };

// ---------- the questions: just numbers, like 3 + 2 = ? ----------
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (arr) => arr[rand(0, arr.length - 1)];

// First rounds add up to 5, then up to 10 (one small number to start), then anything up to 10.
function makeQuestion(round) {
  const max = round < 4 ? 5 : 10;
  let a = rand(1, max - 1), b = rand(1, max - a);
  if (round >= 4 && round < 8 && a > 5 && b > 5) b = 1;
  if (Math.random() < 0.5) [a, b] = [b, a];
  return { a, b, answer: a + b, spoken: `${WORDS[a]} plus ${WORDS[b]}. What is the answer?`, prompt: `${a} + ${b} = ?` };
}

function choicesFor(answer) {
  const set = new Set([answer]);
  while (set.size < 3) { const c = answer + pick([-2, -1, 1, 2]); if (c >= 2 && c <= 10) set.add(c); }
  return [...set].sort(() => Math.random() - 0.5);
}

// ---------- the game ----------
let round = 0, stars = 0, q = null, food = null, busy = true, queue = [];

function startRound() {
  if (!queue.length) queue = FOODS.slice().sort(() => Math.random() - 0.5);
  food = queue.pop();
  q = makeQuestion(round);
  busy = false;
  plate.className = ''; plate.innerHTML = '';

  wish.querySelector('.w-food').innerHTML = food.svg();
  wish.querySelector('.w-text').textContent = `I want ${food.name}!`;
  qPrompt.textContent = q.prompt;
  qMsg.textContent = 'Get it right to order!';
  qChoices.innerHTML = '';
  choicesFor(q.answer).forEach((c) => {
    const b = document.createElement('button'); b.className = 'choice'; b.textContent = c;
    b.addEventListener('click', () => answer(b, c));
    qChoices.appendChild(b);
  });
  quiz.classList.add('hidden'); void quiz.offsetWidth; quiz.classList.remove('hidden');
  say(`I'd like ${food.a}, please! ${q.spoken}`);
}

$('#say').addEventListener('click', () => say(q ? q.spoken : ''));

function answer(btn, value) {
  if (busy) return;
  if (value !== q.answer) {                             // wrong: gentle, try again, same question
    btn.classList.remove('wrong'); void btn.offsetWidth; btn.classList.add('wrong');
    sfx.oops(); qMsg.textContent = 'Try again!'; say('Try again!');
    princess.classList.remove('sad'); void princess.offsetWidth; princess.classList.add('sad');
    return;
  }
  busy = true;
  sfx.good(); say(`Yes! ${WORDS[q.answer]}!`);
  qMsg.textContent = '🎉 Yes! ' + q.answer + '!';
  stars++; $('#starcount').textContent = stars; round++;
  setTimeout(serve, 1400);
}

// The butler walks in from the right with the food, sets it on the table, bows and leaves; then she eats.
function serve() {
  quiz.classList.add('hidden');
  butler.className = ''; butler.querySelector('.b-food').innerHTML = food.svg();
  void butler.offsetWidth;
  sfx.bell();
  butler.classList.add('walking', 'in');
  setTimeout(() => {                                    // arrived: put the plate on the table and bow
    butler.classList.remove('walking'); butler.classList.add('set', 'bow');
    plate.innerHTML = food.svg(); plate.classList.add('in'); sfx.bell();
  }, 2700);
  setTimeout(() => {                                    // butler leaves, princess digs in
    butler.classList.remove('bow', 'in'); butler.classList.add('walking', 'out');
    princess.classList.add('cheer'); sfx.yum(); say(`Yummy ${food.name}! Thank you!`);
    plate.classList.add('eat'); hearts();
  }, 3800);
  setTimeout(() => { princess.classList.remove('cheer'); plate.classList.add('gone'); }, 5600);
  setTimeout(() => { plate.className = ''; butler.className = ''; startRound(); }, 6400);
}

function hearts() {
  const box = $('#hearts');
  for (let i = 0; i < 8; i++) {
    const h = document.createElement('span'); h.className = 'heart'; h.textContent = pick(['❤️', '💖', '✨', '💛']);
    h.style.left = (6 + Math.random() * 18) + '%'; h.style.animationDelay = (i * 0.12) + 's';
    box.appendChild(h); setTimeout(() => h.remove(), 2400);
  }
}

$('#go').addEventListener('click', () => {
  unlock();
  $('#start').classList.add('hidden');
  startRound();
});
