// Puzzle Shelf — endless activity books (see the build spec). Phase 0: the shelf → book → page router with deep links, the maze
// generator, one plain maze page with finger ink and a finish, and the one-tap Home button with save-on-every-change (§1A).
//   shelf.html                                   the shelf (every launch opens here, Keep going first)
//   shelf.html?book=maze-gameday                 a book's pages
//   shelf.html?book=maze-gameday&n=7             page 7 of that book (the same page every time)
//   shelf.html?page=maze:gameday:5:1234&debug=1  any page by its id; debug shows the maze's solution
import './shelf.css';
import { holdGate } from '../engine/gate.js';
import { applyBedtime } from '../engine/bedtime.js';
import { unlock } from '../audio.js';
import { BOOKS, THEMES, bookById } from './books.js';
import { pageId, parsePage, hash, baseLevel } from './engine/pageid.js';
import { save, pageState, setPage, bookDone, markDone, setLast } from './engine/save.js';
import { artBox } from './engine/layout.js';
import { makeMaze } from './maze/gen.js';
import { renderMaze, el, MARGIN } from './maze/render.js';
import { playMaze } from './maze/play.js';

const $ = (s) => document.querySelector(s), app = $('#app');
['gesturestart', 'dblclick', 'contextmenu'].forEach((ev) => document.addEventListener(ev, (e) => e.preventDefault()));
addEventListener('pointerdown', unlock, { once: true });
applyBedtime();
holdGate($('#leave'), () => { location.href = './'; }, { ms: 1500 });          // back to the A&E games menu (grown-ups: hold)

// ------------------------------------------------------------------------------------------------ routes
const params = new URLSearchParams(location.search), DEBUG = params.get('debug') === '1';
function routeFrom(q) {
  if (q.get('page')) return { screen: 'page', id: q.get('page') };
  const book = bookById(q.get('book'));
  if (book && +q.get('n') >= 1) return { screen: 'page', book: book.id, n: Math.min(book.pages, +q.get('n') | 0) };
  if (book) return { screen: 'book', book: book.id };
  return { screen: 'shelf' };
}
const urlOf = (r) => '?' + new URLSearchParams({ ...(r.screen === 'page' && r.id ? { page: r.id } : {}), ...(r.book ? { book: r.book } : {}), ...(r.n ? { n: r.n } : {}), ...(DEBUG ? { debug: 1 } : {}) });
/** a page route → what the page is: { type, theme, level, seed } */
function specOf(r) {
  if (r.id) return parsePage(r.id);
  const b = bookById(r.book); return b && { type: b.type, theme: b.theme, level: baseLevel(r.n), seed: hash(b.id, r.n) };
}

let current = null, cleanup = null;
function go(r) {
  if (cleanup) { cleanup(); cleanup = null; }
  current = r; document.body.dataset.screen = r.screen;
  history.replaceState(null, '', urlOf(r));
  if (r.screen === 'page') { setLast(r); cleanup = showPage(r); }
  else if (r.screen === 'book') cleanup = showBook(bookById(r.book));
  else cleanup = showShelf();
}
/** up one level: page → its book (or the shelf for a loose page), book → shelf */
const up = () => go(current.screen === 'page' && current.book ? { screen: 'book', book: current.book } : { screen: 'shelf' });

// One tap, and it goes (§1A.3). No hold, no "Are you sure?": leaving loses nothing.
$('#btnHome').addEventListener('click', () => go({ screen: 'shelf' }));
$('#btnBook').addEventListener('click', up);
// No navigation by gesture (§1A.8): if iOS's back-swipe fires, treat it as the book button and stay in the game
history.pushState({ guard: 1 }, '', location.href);
addEventListener('popstate', () => { history.pushState({ guard: 1 }, '', urlOf(current)); up(); });

// ------------------------------------------------------------------------------------------------ the shelf
function showShelf() {
  let last = save.last && specOf(save.last) ? save.last : null;
  if (last?.book && pageState(pageId(specOf(last)))?.done && last.n < bookById(last.book).pages) last = { screen: 'page', book: last.book, n: last.n + 1 };   // finished: keep going = the next page
  app.innerHTML = `<div class="shelf">
    <h1>Puzzle Shelf</h1>
    <div class="plank">
      ${last ? '<button class="keep" aria-label="Keep going"><svg class="mini"></svg><span class="go"><i></i></span></button>' : ''}
      ${BOOKS.map((b) => { const done = Object.keys(bookDone(b.id)).length, t = THEMES[b.theme];
        return `<button class="book" data-book="${b.id}" style="--c0:${t.cover[0]};--c1:${t.cover[1]}" aria-label="${b.title}">
          <span class="cover-pic">${b.cover}</span><span class="cover-title">${b.title}</span>
          <span class="ribbon">${done} / ${b.pages}</span></button>`; }).join('')}
    </div></div>`;
  if (last) {
    const spec = specOf(last), maze = makeMaze(spec.level, spec.seed), svg = app.querySelector('.mini');
    const layers = renderMaze(svg, maze, THEMES[spec.theme], { mini: true }), st = pageState(pageId(spec));
    if (st?.trail?.length > 1) el('polyline', { points: st.trail.map((c) => `${(c % maze.grid.w) + 0.5},${((c / maze.grid.w) | 0) + 0.5}`).join(' '), fill: 'none', stroke: '#2f6fff', 'stroke-width': 0.42, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, layers.trail);
    app.querySelector('.keep').addEventListener('click', () => go(last));
  }
  app.querySelectorAll('.book').forEach((b) => b.addEventListener('click', () => go({ screen: 'book', book: b.dataset.book })));
  return null;
}

// ------------------------------------------------------------------------------------------------ a book's pages
function showBook(book) {
  const t = THEMES[book.theme], done = bookDone(book.id);
  const started = (n) => { const s = pageState(pageId({ type: book.type, theme: book.theme, level: baseLevel(n), seed: hash(book.id, n) })); return s?.trail?.length > 1; };
  app.innerHTML = `<div class="bookpage" style="--c0:${t.cover[0]};--c1:${t.cover[1]}">
    <div class="book-head"><span class="cover-pic">${book.cover}</span><span class="cover-title">${book.title}</span></div>
    <div class="pages">${Array.from({ length: book.pages }, (_, i) => i + 1).map((n) => `<button class="pg${done[n] ? ' done' : started(n) ? ' started' : ''}" data-n="${n}" aria-label="Page ${n}"><b>${n}</b>${done[n] ? '<i class="stamp-mini"></i>' : ''}</button>`).join('')}</div>
  </div>`;
  app.querySelectorAll('.pg').forEach((b) => b.addEventListener('click', () => go({ screen: 'page', book: book.id, n: +b.dataset.n })));
  return null;
}

// ------------------------------------------------------------------------------------------------ a page
function showPage(r) {
  const spec = specOf(r);
  if (!spec || spec.type !== 'maze' || !THEMES[spec.theme]) { queueMicrotask(() => go({ screen: 'shelf' })); return null; }
  const id = pageId(spec), theme = THEMES[spec.theme], maze = makeMaze(spec.level, spec.seed);
  app.innerHTML = `<div class="page"><svg class="art" aria-label="Maze"></svg>
    <div class="finish hidden"><button class="big next" aria-label="Next page"><i></i></button><button class="big home" aria-label="Home">\u{1F3E0}</button></div></div>`;
  const svg = app.querySelector('.art'), finish = app.querySelector('.finish');
  const vb = { w: maze.grid.w + 2 * MARGIN, h: maze.grid.h + 2 * MARGIN };
  const place = () => { const b = artBox(vb.w / vb.h); Object.assign(svg.style, { left: b.x + 'px', top: b.y + 'px', width: b.w + 'px', height: b.h + 'px' }); };
  place(); addEventListener('resize', place);
  const layers = renderMaze(svg, maze, theme, { debug: DEBUG }), st = pageState(id);
  const showFinish = () => finish.classList.remove('hidden');
  const ctl = playMaze(layers, maze, {
    trail: st?.trail, pxPerCell: () => svg.getBoundingClientRect().width / vb.w,
    onChange: (trail) => setPage(id, { trail }),
    onFinish: (trail) => { setPage(id, { trail, done: true }); markDone(r.book, r.n); celebrate(layers, ctl).then(showFinish); },
  });
  window.__maze = { ctl, maze };                                                        // for tests and the screenshot tool
  if (ctl.finished) { layers.svg.classList.add('won'); addStamp(); showFinish(); }
  finish.querySelector('.home').addEventListener('click', () => go({ screen: 'shelf' }));
  finish.querySelector('.next').addEventListener('click', () => {
    if (r.book) { const b = bookById(r.book); return go(r.n < b.pages ? { screen: 'page', book: r.book, n: r.n + 1 } : { screen: 'book', book: r.book }); }
    go({ screen: 'page', id: pageId({ ...spec, seed: spec.seed + 1 }) });
  });
  return () => { ctl.destroy(); removeEventListener('resize', place); };
}

function addStamp() { const stamp = document.createElement('div'); stamp.className = 'stamp'; stamp.innerHTML = '<i></i>'; app.querySelector('.page').appendChild(stamp); }
/** the finish: a glow runs along the line from start to end, the goal bounces, a stamp lands */
function celebrate(layers, ctl) {
  const glow = ctl.ink.cloneNode(); glow.setAttribute('stroke', '#ffe14d'); glow.setAttribute('stroke-width', 0.3); glow.classList.add('glow');
  layers.trail.appendChild(glow);
  const len = glow.getTotalLength(); glow.style.strokeDasharray = `${len} ${len}`; glow.style.strokeDashoffset = len;
  glow.getBoundingClientRect(); glow.style.transition = 'stroke-dashoffset .9s ease-in-out'; glow.style.strokeDashoffset = 0;
  layers.svg.classList.add('won');
  addStamp();
  return new Promise((res) => setTimeout(res, 1300));
}

go(routeFrom(params));
window.shelf = { go, get route() { return current; }, save };                 // for tests and the screenshot tool
