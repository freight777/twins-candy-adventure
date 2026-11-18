// A Score Spy page (§9): a wall of scoreboards and one clue at a time, spoken and shown (the team's badge, the words, the number big).
// Tap the scoreboard — or, for "which team…" clues, the team's row on it. Right: the board glows, a chime, "You found it!", the next
// clue. Wrong: a soft wobble; nothing is taken away. Hints after 25 s or with the "?": the right board pulses. Saved after every clue.
import { makeScoreSpy } from './scorespy.js';
import { badgeSVG } from './badge.js';
import { fullName } from './teams.js';
import { loadSprites } from '../ispy/render.js';
import { artURL } from '../themes.js';

const SPORT_PIC = { soccer: 'Soccer ball', hockey: 'Ice hockey', football: 'American football', basketball: 'Basketball' };
const IDLE = 25000;

export function showScorePage(app, { spec, teams, page: ready, saved, sfx, sayClue, talk, onSave, onHintUsed, onDone, finishCard }) {
  const page = ready || makeScoreSpy(spec, teams), team = (id) => teams.find((t) => t.id === id);
  let at = Math.min(saved || 0, page.clues.length), idle = 0, alive = true;
  app.innerHTML = `<div class="page score-page"><div class="clue"><div class="clue-pic"></div><div class="clue-words readable"></div><button class="again" aria-label="Say it again"><i></i></button><span class="clue-dots">${page.clues.map(() => '<i></i>').join('')}</span></div>
    <div class="wall">${page.wall.map((b, g) => `<div class="board" data-g="${g}"><img class="sport" src="${artURL(SPORT_PIC[b.sport])}" alt="">
      ${b.teams.map((id, side) => { const t = team(id); return `<button class="row" data-g="${g}" data-side="${side}" aria-label="${fullName(t)} ${b.scores[side]}">${badgeSVG(t)}<span class="name readable"><b>${t.nick}</b><small>${t.place}</small></span><span class="score">${b.scores[side]}</span></button>`; }).join('')}</div>`).join('')}</div>
    <button class="hint-btn" aria-label="Help">?</button>${finishCard}</div>`;
  loadSprites('mascots');
  const clueEl = app.querySelector('.clue'), dots = [...app.querySelectorAll('.clue-dots i')];
  function showClue(speak = true) {
    dots.forEach((d, i) => d.classList.toggle('on', i < at));
    if (at >= page.clues.length) return;
    const c = page.clues[at], t = c.team && team(c.team);
    clueEl.querySelector('.clue-pic').innerHTML = t ? badgeSVG(t) : c.kind === 'tie' ? '<b class="tie">=</b>' : c.kind === 'highest' ? '<b>&#9650;</b>' : c.kind === 'lowest' ? '<b>&#9660;</b>' : c.kind === 'mostPoints' ? '<b>+</b>' : `<b>${c.n ?? c.d ?? ''}</b>`;
    const tail = c.kind === 'beat' || c.kind === 'wonBy' ? '?' : c.words.at(-1).toString().endsWith('!') ? '' : '.';
    clueEl.querySelector('.clue-words').innerHTML = c.words.map((w) => (typeof w === 'number' ? `<span class="num">${w}</span>` : w === (t && t.nick) ? `<span class="team">${w}</span>` : w)).join(' ') + tail;
    clueEl.classList.remove('new'); void clueEl.offsetWidth; clueEl.classList.add('new');
    if (speak) sayClue(c, t);
    restart();
  }
  function restart() { clearTimeout(idle); idle = setTimeout(() => hint(), IDLE); }
  function hint() {
    if (at >= page.clues.length) return; onHintUsed(); sfx.play('hint');
    const b = app.querySelector(`.board[data-g="${page.clues[at].answer.g}"]`); b.classList.remove('pulse'); void b.offsetWidth; b.classList.add('pulse'); b.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    restart();
  }
  app.querySelector('.wall').addEventListener('click', (e) => {
    const row = e.target.closest('.row'); if (!row || at >= page.clues.length) return;
    const c = page.clues[at], g = +row.dataset.g, side = +row.dataset.side, board = row.closest('.board');
    if (g === c.answer.g && (c.answer.side === null || c.answer.side === side)) {
      board.classList.add('found'); (c.answer.side !== null ? row : board).classList.add('right');
      sfx.play('star', { rate: 1 + at * 0.12, vary: false }); talk('You found it!');
      at++; onSave(at); dots.forEach((d, i) => d.classList.toggle('on', i < at));
      if (at >= page.clues.length) { clearTimeout(idle); setTimeout(() => alive && onDone(true), 700); }
      else setTimeout(() => alive && showClue(), 1300);
    } else {
      const el = g === c.answer.g ? row : board; el.classList.remove('nope'); void el.offsetWidth; el.classList.add('nope'); sfx.play('wobble', { vol: 0.6 });
      if (g === c.answer.g) talk('Look closely');                                   // the right game, the other team
      restart();
    }
  });
  clueEl.querySelector('.again').addEventListener('click', () => { if (at < page.clues.length) sayClue(page.clues[at], page.clues[at].team && team(page.clues[at].team)); });
  app.querySelector('.hint-btn').addEventListener('click', hint);
  page.clues.slice(0, at).forEach((c) => app.querySelector(`.board[data-g="${c.answer.g}"]`).classList.add('found'));
  if (at >= page.clues.length) onDone(false); else showClue();
  window.__score = { page, get at() { return at; } };                                   // for tests and the screenshot tool
  return () => { alive = false; clearTimeout(idle); };
}
