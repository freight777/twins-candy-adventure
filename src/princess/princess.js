import { FOODS, princessSVG, castleSVG } from './art.js';

const $ = (s) => document.querySelector(s);
const princess = $('#princess'), plate = $('#plate'), wish = $('#wish'), quiz = $('#quiz');
const qPrompt = $('.q-prompt'), qObjects = $('.q-objects'), qChoices = $('.q-choices'), qMsg = $('.q-msg');

$('#castle').innerHTML = castleSVG;
princess.innerHTML = princessSVG('happy');

// ---------- sound: the device's own voice for words, tiny synth for dings ----------
const hasTTS = 'speechSynthesis' in window;
function say(text) {
  if (!hasTTS) return;
  const synth = window.speechSynthesis; synth.cancel();
  const u = new SpeechSynthesisUtterance(text); u.rate = 0.9; u.pitch = 1.25; u.lang = 'en-US';
  const v = synth.getVoices().find((x) => /^en/i.test(x.lang) && /female|samantha|zira|aria|jenny|google us/i.test(x.name));
  if (v) u.voice = v;
  synth.speak(u);
}
let actx = null;
function tone(freq, t0, dur, type = 'sine', vol = 0.18) {
  if (!actx) return;
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.value = freq; o.connect(g); g.connect(actx.destination);
  const t = actx.currentTime + t0;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.start(t); o.stop(t + dur + 0.05);
}
const sfx = {
  good: () => [660, 880, 1100, 1320].forEach((f, i) => tone(f, i * 0.09, 0.3)),
  bell: () => { tone(1568, 0, 0.9, 'triangle'); tone(2093, 0, 0.7, 'triangle', 0.1); },
  oops: () => { tone(300, 0, 0.25, 'triangle'); tone(240, 0.15, 0.3, 'triangle'); },
  tap: (n) => tone(440 + n * 55, 0, 0.18, 'triangle'),
  yum: () => [523, 659, 784].forEach((f, i) => tone(f, i * 0.12, 0.25, 'square', 0.07)),
};

// ---------- the questions ----------
const THINGS = ['⭐', '🌸', '🍎', '🦋', '💎', '👑', '🍓', '🐱', '🎈', '🐠'];
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (arr) => arr[rand(0, arr.length - 1)];
let lastThing = '';

// Level 1-2 count up to 5 then 10; level 3-4 add up to 5 then 10. After a few rounds the kinds get mixed so it stays fun.
function makeQuestion(round) {
  let thing; do { thing = pick(THINGS); } while (thing === lastThing); lastThing = thing;
  const stage = round < 2 ? 0 : round < 4 ? 1 : round < 6 ? 2 : round < 8 ? 3 : rand(0, 3);
  if (stage <= 1) {
    const n = stage === 0 ? rand(1, 5) : rand(4, 10);
    return { kind: 'count', thing, n, answer: n, spoken: 'How many do you see? Tap each one to count!', prompt: 'How many?' };
  }
  const max = stage === 2 ? 5 : 10;
  const a = rand(1, max - 1), b = rand(1, max - a);
  return { kind: 'add', thing, a, b, answer: a + b, spoken: `${WORDS[a]} plus ${WORDS[b]}. How many altogether?`, prompt: `${a} + ${b} = ?` };
}

function choicesFor(answer, min) {
  const set = new Set([answer]);
  while (set.size < 3) { const c = answer + pick([-2, -1, 1, 2]); if (c >= min && c <= 10) set.add(c); }
  return [...set].sort(() => Math.random() - 0.5);
}

// ---------- the game ----------
let round = 0, stars = 0, q = null, food = null, tapCount = 0, busy = true, foodIdx = 0;
const order = () => FOODS.slice().sort(() => Math.random() - 0.5);
let queue = [];

function objGroup(thing, n, solo) {
  const g = document.createElement('div'); g.className = 'group' + (solo ? ' solo' : '');
  for (let i = 0; i < n; i++) { const o = document.createElement('span'); o.className = 'obj'; o.textContent = thing; g.appendChild(o); }
  return g;
}
const sym = (t) => { const s = document.createElement('div'); s.className = 'sym'; s.textContent = t; return s; };

function startRound() {
  if (!queue.length) queue = order();
  food = queue.pop();
  q = makeQuestion(round);
  tapCount = 0; busy = false;
  plate.className = ''; plate.innerHTML = '';
  princess.innerHTML = princessSVG('happy');

  wish.querySelector('.w-food').innerHTML = food.svg;
  wish.querySelector('.w-text').textContent = `I want ${food.name}!`;

  qPrompt.textContent = q.prompt;
  qObjects.innerHTML = '';
  if (q.kind === 'count') qObjects.appendChild(objGroup(q.thing, q.n, true));
  else { qObjects.append(objGroup(q.thing, q.a), sym('+'), objGroup(q.thing, q.b), sym('=') , sym('?')); }
  qMsg.textContent = 'Get it right to order!';
  qChoices.innerHTML = '';
  choicesFor(q.answer, 1).forEach((c) => {
    const b = document.createElement('button'); b.className = 'choice'; b.textContent = c;
    b.addEventListener('click', () => answer(b, c));
    qChoices.appendChild(b);
  });
  quiz.classList.add('hidden'); void quiz.offsetWidth; quiz.classList.remove('hidden');
  say(`I'd like ${food.a}, please! ${q.spoken}`);
}

qObjects.addEventListener('click', (e) => {            // tap objects to count them out loud
  const o = e.target.closest('.obj'); if (!o || o.classList.contains('tapped') || busy) return;
  o.classList.add('tapped');
  tapCount++;
  const n = document.createElement('span'); n.className = 'n'; n.textContent = tapCount; o.appendChild(n);
  sfx.tap(tapCount); say(WORDS[tapCount]);
});
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
  setTimeout(serve, 1300);
}

function serve() {
  quiz.classList.add('hidden');
  plate.innerHTML = food.svg;
  setTimeout(() => { sfx.bell(); plate.classList.add('in'); }, 150);
  setTimeout(() => {
    princess.classList.add('cheer'); sfx.yum(); say(`Yummy ${food.name}! Thank you!`);
    plate.classList.add('eat'); hearts();
  }, 1300);
  setTimeout(() => { princess.classList.remove('cheer'); plate.classList.add('gone'); }, 3200);
  setTimeout(() => { plate.className = ''; startRound(); }, 4000);
}

function hearts() {
  const box = $('#hearts');
  for (let i = 0; i < 8; i++) {
    const h = document.createElement('span'); h.className = 'heart'; h.textContent = pick(['❤️', '💖', '✨', '💛']);
    h.style.left = (8 + Math.random() * 20) + '%'; h.style.animationDelay = (i * 0.12) + 's';
    box.appendChild(h); setTimeout(() => h.remove(), 2400);
  }
}

$('#go').addEventListener('click', () => {
  actx = new (window.AudioContext || window.webkitAudioContext)();
  if (hasTTS) { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; window.speechSynthesis.speak(u); }
  $('#start').classList.add('hidden');
  startRound();
});
