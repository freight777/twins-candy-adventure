// Puzzle Shelf — endless activity books (see the build spec). Phases 1–2: four maze books and four hidden-picture books (Game Day,
// Cars & Trucks, Dinosaurs, Ocean); the shelf → book → page router; the one-tap Home button with save-on-every-change (§1A).
//   shelf.html                                   the shelf (every launch opens here, Keep going first)
//   shelf.html?book=maze-ocean                   a book's pages
//   shelf.html?book=maze-ocean&n=7               page 7 of that book (the same page every time)
//   shelf.html?page=maze:gameday:5:1234&debug=1  any page by its id; debug shows the maze's solution
//   shelf.html?page=ispy:ocean:3:42&look=color   a hidden-picture page in colour (look=line: black-and-white)
import './shelf.css';
import { holdGate } from '../engine/gate.js';
import { applyBedtime } from '../engine/bedtime.js';
import { unlock, say, voice } from '../audio.js';
import { sfxSprite, note } from '../engine/sfxsprite.js';
import { BOOKS, KINDS, THEMES, bookById } from './books.js';
import { artURL, slug } from './themes.js';
import { pageId, parsePage, hash, baseLevel } from './engine/pageid.js';
import { save, commit, pageState, setPage, bookDone, markDone, setLast } from './engine/save.js';
import { artBox, regions } from './engine/layout.js';
import { buildPage, fitLevel, MARGIN } from './maze/page.js';
import { renderMaze, el } from './maze/render.js';
import { playMaze } from './maze/play.js';
import { showIspyPage, sceneFor } from './ispy/page.js';
import { renderScene, loadSprites } from './ispy/render.js';
import { showStickerPage, loadPicture, drawFacets, chooseStickers } from './sticker/page.js';
import MAP from './sfx.json';

// the badges at the start of each plank (defined before anything is drawn)
const MAZE_ICON = '<svg viewBox="0 0 40 40"><path d="M6 6h28v28H6zM6 14h14M26 6v14h-8M14 20v14M14 26h12M34 28h-8" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const SPY_ICON = '<svg viewBox="0 0 40 40"><circle cx="17" cy="17" r="10" fill="#fff6" stroke="#fff" stroke-width="4"/><path d="M25 25l9 9" stroke="#fff" stroke-width="5" stroke-linecap="round"/></svg>';
const STICK_ICON = '<svg viewBox="0 0 40 40"><path d="M7 7h26v16l-10 10H7z" fill="#fff6" stroke="#fff" stroke-width="4" stroke-linejoin="round"/><path d="M33 23H23v10" fill="none" stroke="#fff" stroke-width="4" stroke-linejoin="round"/></svg>';
const $ = (s) => document.querySelector(s), app = $('#app');
['gesturestart', 'dblclick', 'contextmenu'].forEach((ev) => document.addEventListener(ev, (e) => e.preventDefault()));
const sfx = sfxSprite(`${import.meta.env.BASE_URL}assets/shelf/sfx.mp3`, MAP);
addEventListener('pointerdown', () => { unlock(); sfx.warm(); }, { capture: true });
applyBedtime();
holdGate($('#leave'), () => { location.href = './'; }, { ms: 1500 });          // back to the A&E games menu (grown-ups: hold)

// ------------------------------------------------------------------------------------------------ routes
const params = new URLSearchParams(location.search), DEBUG = params.get('debug') === '1', LOOK = ['line', 'color'].includes(params.get('look')) ? params.get('look') : null;
/** black-and-white or colour: his choice per hidden-picture book (a deep link may say) */
const lookOf = (bookId) => LOOK || save.settings.looks?.[bookId] || 'line';
function setLook(bookId, look) { save.settings.looks = { ...(save.settings.looks || {}), [bookId]: look }; commit(); }
function routeFrom(q) {
  if (q.get('page')) return { screen: 'page', id: q.get('page') };
  if (q.get('album')) return { screen: 'album' };
  const book = bookById(q.get('book'));
  if (book && +q.get('n') >= 1) return { screen: 'page', book: book.id, n: Math.min(book.pages, +q.get('n') | 0) };
  if (book) return { screen: 'book', book: book.id };
  return { screen: 'shelf' };
}
const urlOf = (r) => '?' + new URLSearchParams({ ...(r.screen === 'album' ? { album: 1 } : {}), ...(r.screen === 'page' && r.id ? { page: r.id } : {}), ...(r.book ? { book: r.book } : {}), ...(r.n ? { n: r.n } : {}), ...(DEBUG ? { debug: 1 } : {}) });
/** a page route → what the page is: { type, theme, level, seed } */
function specOf(r) {
  if (r.id) { const s = parsePage(r.id); return s && THEMES[s.theme] ? s : null; }
  const b = bookById(r.book); return b && { type: b.type, theme: b.theme, level: baseLevel(r.n), seed: hash(b.id, r.n) };
}

let current = null, cleanup = null;
function go(r, sound = true) {
  if (cleanup) { cleanup(); cleanup = null; }
  current = r; document.body.dataset.screen = r.screen;
  history.replaceState(null, '', urlOf(r));
  if (sound) sfx.play(r.screen === 'page' ? 'turn' : r.screen === 'book' ? 'open' : 'tap', { vol: 0.8 });
  if (r.screen === 'page') { setLast(r); cleanup = showPage(r); }
  else if (r.screen === 'book') cleanup = showBook(bookById(r.book));
  else if (r.screen === 'album') cleanup = showAlbum();
  else cleanup = showShelf();
}
/** up one level: page → its book (or the shelf for a loose page), book → shelf */
const up = () => go(current.screen === 'page' && current.book ? { screen: 'book', book: current.book } : { screen: 'shelf' });   // (the album goes up to the shelf)

// One tap, and it goes (§1A.3). No hold, no "Are you sure?": leaving loses nothing.
$('#btnHome').addEventListener('click', () => go({ screen: 'shelf' }));
$('#btnBook').addEventListener('click', up);
// No navigation by gesture (§1A.8): if iOS's back-swipe fires, treat it as the book button and stay in the game
history.pushState({ guard: 1 }, '', location.href);
addEventListener('popstate', () => { history.pushState({ guard: 1 }, '', urlOf(current)); up(); });

/** a maze page as it is on this device: built once at the size that fits, then saved, so it never changes under the child */
function pageFor(spec) {
  const id = pageId(spec), st = pageState(id);
  if (st?.gen) return { id, page: buildPage(spec, st.gen) };
  const [a, b] = regions(2, 1).map((r) => ({ r, f: fitLevel(spec.level, r) }));
  const pick = b.f.k > a.f.k || (b.f.k === a.f.k && b.r.w * b.r.h > a.r.w * a.r.h) ? b : a;     // the region that holds the bigger maze
  const page = buildPage(spec, null, pick.r);
  setPage(id, { gen: page.gen });
  return { id, page };
}

// ------------------------------------------------------------------------------------------------ the shelf
function showShelf() {
  let last = save.last && specOf(save.last) ? save.last : null;
  if (last?.book && pageState(pageId(specOf(last)))?.done && last.n < bookById(last.book).pages) last = { screen: 'page', book: last.book, n: last.n + 1 };   // finished: keep going = the next page
  app.innerHTML = `<div class="shelf">
    <h1>Puzzle Shelf</h1>
    ${KINDS.map((k, n) => `<div class="plank" data-kind="${k.type}"><span class="kind-tag" aria-label="${k.title}">${k.type === 'maze' ? MAZE_ICON : k.type === 'ispy' ? SPY_ICON : STICK_ICON}</span>
      ${n === 0 && last ? '<button class="keep" aria-label="Keep going"><svg class="mini"></svg><span class="go"><i></i></span></button>' : ''}
      ${BOOKS.filter((b) => b.type === k.type).map((b) => { const done = Object.keys(bookDone(b.id)).length, t = THEMES[b.theme];
        return `<button class="book" data-book="${b.id}" style="--c0:${t.cover[0]};--c1:${t.cover[1]}" aria-label="${b.title}">
          <img class="cover-pic" src="${artURL(b.cover)}" alt="" draggable="false"><span class="cover-title">${t.title}</span>
          <span class="ribbon">${done} / ${b.pages}</span>${done >= b.pages ? '<i class="seal"></i>' : ''}${b.type === 'ispy' ? '<i class="lens"></i>' : ''}${b.type === 'sticker' ? '<i class="spiral"></i>' : ''}</button>`; }).join('')}
      ${k.type === 'sticker' ? `<button class="book album" aria-label="Sticker Album" style="--c0:#ff9fd0;--c1:#ffd6ec"><span class="album-grid">${Object.keys(save.album || {}).slice(0, 4).map(() => '<i></i>').join('')}</span><span class="cover-title">Album</span><span class="ribbon">${Object.keys(save.album || {}).length}</span></button>` : ''}
    </div>`).join('')}</div>`;
  if (last && specOf(last).type === 'sticker') {
    const spec = specOf(last), svg = app.querySelector('.mini'), name = stickerName(last, spec), st = pageState(pageId(spec)); svg.setAttribute('viewBox', '0 0 512 512');
    loadPicture(name).then((pic) => { const loose = new Set(chooseStickers(pic, spec.level)), on = new Set(st?.placed || []); pic.pieces.forEach((p, i) => { if (!loose.has(i) || on.has(i)) drawFacets(svg, p); }); });
    app.querySelector('.keep').addEventListener('click', () => go(last));
  } else if (last && specOf(last).type === 'ispy') {                                    // a hidden-picture page: its scene, small, in his look
    const spec = specOf(last), svg = app.querySelector('.mini'); svg.setAttribute('viewBox', '0 0 1200 900');
    Promise.all([sceneFor(spec), loadSprites(spec.theme)]).then(([{ scene }]) => { if (svg.isConnected) renderScene(svg, scene, lookOf(last.book), { mini: true }); });
    app.querySelector('.keep').addEventListener('click', () => go(last));
  } else if (last) {
    const { id, page } = pageFor(specOf(last)), layers = renderMaze(app.querySelector('.mini'), page, { mini: true }), st = pageState(id), w = page.maze.grid.w;
    if (st?.trail?.length > 1) el('polyline', { points: st.trail.map((c) => `${(c % w) + 0.5},${((c / w) | 0) + 0.5}`).join(' '), fill: 'none', stroke: '#2f6fff', 'stroke-width': 0.42, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, layers.trail);
    app.querySelector('.keep').addEventListener('click', () => go(last));
  }
  app.querySelectorAll('.book:not(.album)').forEach((b) => b.addEventListener('click', () => go({ screen: 'book', book: b.dataset.book })));
  app.querySelector('.album')?.addEventListener('click', () => go({ screen: 'album' }));
  return null;
}

// ------------------------------------------------------------------------------------------------ a book's pages
function showBook(book) {
  const t = THEMES[book.theme], done = bookDone(book.id);
  const started = (n) => pageState(pageId({ type: book.type, theme: book.theme, level: baseLevel(n), seed: hash(book.id, n) }))?.trail?.length > 1;
  app.innerHTML = `<div class="bookpage" style="--c0:${t.cover[0]};--c1:${t.cover[1]}">
    <div class="book-head"><img class="cover-pic" src="${artURL(book.cover)}" alt="" draggable="false"><span class="cover-title">${book.title}</span></div>
    <div class="pages">${Array.from({ length: book.pages }, (_, i) => i + 1).map((n) => `<button class="pg${done[n] ? ' done' : started(n) ? ' started' : ''}" data-n="${n}" aria-label="Page ${n}"><b>${n}</b>${done[n] ? '<i class="stamp-mini"></i>' : ''}</button>`).join('')}</div>
  </div>`;
  app.querySelectorAll('.pg').forEach((b) => b.addEventListener('click', () => go({ screen: 'page', book: book.id, n: +b.dataset.n })));
  if (book.type === 'ispy') lookChooser(book);
  return null;
}
/** Black-and-white or colour (§5 "Two looks, and he chooses"): the same small scene twice as two big buttons, the first time a
 *  hidden-picture book is opened; afterwards a two-picture switch on the book's page list changes it any time. */
function lookChooser(book) {
  const spec = { type: 'ispy', theme: book.theme, level: 1, seed: hash(book.id, 1) }, chosen = save.settings.looks?.[book.id];
  const head = app.querySelector('.book-head');
  head.insertAdjacentHTML('afterend', `<div class="look-switch" role="group" aria-label="Look">${['line', 'color'].map((l) => `<button data-look="${l}" aria-label="${l === 'line' ? 'Black and white' : 'Colour'}" class="${lookOf(book.id) === l ? 'on' : ''}"><svg></svg></button>`).join('')}</div>`);
  if (!chosen) app.querySelector('.bookpage').insertAdjacentHTML('beforeend', `<div class="chooser">${['line', 'color'].map((l) => `<button data-look="${l}" aria-label="${l === 'line' ? 'Black and white' : 'Colour'}"><svg></svg></button>`).join('')}</div>`);
  Promise.all([sceneFor(spec), loadSprites(book.theme)]).then(([{ scene }]) => app.querySelectorAll('[data-look] svg').forEach((svg) => svg.isConnected && renderScene(svg, scene, svg.parentElement.dataset.look, { mini: true })));
  app.querySelectorAll('[data-look]').forEach((b) => b.addEventListener('click', () => {
    setLook(book.id, b.dataset.look); sfx.play('tap');
    app.querySelector('.chooser')?.remove();
    app.querySelectorAll('.look-switch button').forEach((x) => x.classList.toggle('on', x.dataset.look === b.dataset.look));
  }));
}

// ------------------------------------------------------------------------------------------------ a page
function showPage(r) {
  const spec = specOf(r);
  if (spec?.type === 'ispy') return showIspy(r, spec);
  if (spec?.type === 'sticker') return showSticker(r, spec);
  if (!spec || spec.type !== 'maze') { queueMicrotask(() => go({ screen: 'shelf' }, false)); return null; }
  const { id, page } = pageFor(spec), { maze } = page;
  app.innerHTML = `<div class="page"><svg class="art" aria-label="Maze"></svg>
    <button class="hint-btn" aria-label="Help">?</button>
    <div class="finish hidden"><button class="big next" aria-label="Next page"><i></i></button><button class="big home" aria-label="Home"><img src="${import.meta.env.BASE_URL}emoji/1f3e0.webp" alt=""></button></div></div>`;
  const svg = app.querySelector('.art'), finish = app.querySelector('.finish');
  const vb = { w: maze.grid.w + 2 * MARGIN, h: maze.grid.h + 2 * MARGIN };
  const place = () => { const b = artBox(vb.w / vb.h); Object.assign(svg.style, { left: b.x + 'px', top: b.y + 'px', width: b.w + 'px', height: b.h + 'px' }); };
  place(); addEventListener('resize', place);
  const layers = renderMaze(svg, page, { debug: DEBUG }), st = pageState(id);
  const showFinish = () => { finish.classList.remove('hidden'); app.querySelector('.hint-btn').classList.add('hidden'); };
  const ctl = playMaze(layers, page, {
    trail: st?.trail, got: st?.stars || [], pxPerCell: () => svg.getBoundingClientRect().width / vb.w,
    onChange: (trail, stars) => setPage(id, { trail, stars }),
    onStar: (c, n, bonus) => { sfx.play('star', { rate: note(n + (bonus ? 3 : 0)), vary: false }); },         // a rising note per star
    onHint: (kind) => sfx.play('hint', { vol: kind === 'pulse' ? 0.5 : 0.8 }),
    onFinish: (trail, stars) => { setPage(id, { trail, stars, done: true }); markDone(r.book, r.n); celebrate(layers, ctl).then(showFinish); },
  });
  app.querySelector('.hint-btn').addEventListener('click', () => ctl.hint());
  window.__maze = { ctl, maze, page };                                                       // for tests and the screenshot tool
  if (ctl.finished) { layers.svg.classList.add('won'); addStamp(); showFinish(); }
  finish.querySelector('.home').addEventListener('click', () => go({ screen: 'shelf' }));
  finish.querySelector('.next').addEventListener('click', () => {
    if (r.book) { const b = bookById(r.book); return go(r.n < b.pages ? { screen: 'page', book: r.book, n: r.n + 1 } : { screen: 'book', book: r.book }); }
    go({ screen: 'page', id: pageId({ ...spec, seed: spec.seed + 1 }) });
  });
  return () => { ctl.destroy(); removeEventListener('resize', place); };
}

const FINISH = `<div class="finish hidden"><button class="big next" aria-label="Next page"><i></i></button><button class="big home" aria-label="Home"><img src="${import.meta.env.BASE_URL}emoji/1f3e0.webp" alt=""></button></div>`;
function showIspy(r, spec) {
  const id = pageId(spec), st = pageState(id), look = lookOf(r.book);
  const cleanup = showIspyPage(app, {
    r, spec, id, saved: st?.found || [], look, sfx, note, say: (w) => say(w), finishCard: FINISH,
    onSave: (patch) => { setPage(id, patch); if (patch.done) markDone(r.book, r.n); },
    onDone: (fresh) => {
      if (fresh) { sfx.play('done', { vary: false }); setTimeout(() => sfx.play('stamp'), 1000); }
      addStamp(); setTimeout(() => app.querySelector('.finish')?.classList.remove('hidden'), fresh ? 1400 : 0);
    },
  });
  wireFinish(r, spec);
  return cleanup;
}

/** a sticker book's page n is picture n (of 16; pages 17–24 come round again at a higher level); a loose page id picks by its seed */
const stickerName = (r, spec) => { const list = THEMES[spec.theme].stickers; return slug(list[r.n ? (r.n - 1) % list.length : Math.abs(spec.seed) % list.length]); };
function wireFinish(r, spec) {
  const finish = app.querySelector('.finish');
  finish.querySelector('.home').addEventListener('click', () => go({ screen: 'shelf' }));
  finish.querySelector('.next').addEventListener('click', () => {
    if (r.book) { const b = bookById(r.book); return go(r.n < b.pages ? { screen: 'page', book: r.book, n: r.n + 1 } : { screen: 'book', book: r.book }); }
    go({ screen: 'page', id: pageId({ ...spec, seed: spec.seed + 1 }) });
  });
}
function showSticker(r, spec) {
  const id = pageId(spec), st = pageState(id), t = THEMES[spec.theme], name = stickerName(r, spec), word = name.replace(/-/g, ' ');
  const cleanup = showStickerPage(app, {
    spec, picName: name, word, saved: st?.placed || [], sfx, voice, say: (w) => say(w), themeCover: t.cover, finishCard: FINISH,
    onSave: (placed) => setPage(id, { placed }),
    onDone: (fresh) => {
      if (fresh) { setPage(id, { done: true }); markDone(r.book, r.n); save.album = { ...(save.album || {}), [name]: true }; commit(); sfx.play('done', { vary: false }); setTimeout(() => sfx.play('stamp'), 1200); }
      addStamp(); setTimeout(() => app.querySelector('.finish')?.classList.remove('hidden'), fresh ? 1800 : 0);
    },
  });
  wireFinish(r, spec);
  return cleanup;
}
/** the Sticker Album: every finished picture, by theme; a tap says its name */
function showAlbum() {
  const done = save.album || {};
  app.innerHTML = `<div class="bookpage album-page"><div class="book-head" style="--c0:#ff9fd0;--c1:#ffd6ec"><span class="cover-title">Sticker Album</span></div>
    ${Object.values(THEMES).map((t) => `<div class="album-row">${t.stickers.map((n) => `<button class="album-pic${done[slug(n)] ? ' got' : ''}" data-name="${slug(n)}" aria-label="${n}"><svg viewBox="0 0 512 512"></svg></button>`).join('')}</div>`).join('')}</div>`;
  app.querySelectorAll('.album-pic').forEach((b) => {
    if (!b.classList.contains('got')) return;
    loadPicture(b.dataset.name).then((pic) => pic.pieces.forEach((p) => drawFacets(b.querySelector('svg'), p)));
    b.addEventListener('click', () => { say(b.dataset.name.replace(/-/g, ' ')); b.classList.remove('hop'); void b.offsetWidth; b.classList.add('hop'); });
  });
  return null;
}

function addStamp() { const stamp = document.createElement('div'); stamp.className = 'stamp'; stamp.innerHTML = '<i></i>'; app.querySelector('.page').appendChild(stamp); }
/** the finish: a glow runs along the line from start to end, the goal bounces, a stamp lands */
function celebrate(layers, ctl) {
  const glow = ctl.ink.cloneNode(); glow.setAttribute('stroke', '#ffe14d'); glow.setAttribute('stroke-width', 0.3); glow.classList.add('glow');
  layers.trail.appendChild(glow);
  const len = glow.getTotalLength(); glow.style.strokeDasharray = `${len} ${len}`; glow.style.strokeDashoffset = len;
  glow.getBoundingClientRect(); glow.style.transition = 'stroke-dashoffset .9s ease-in-out'; glow.style.strokeDashoffset = 0;
  layers.svg.classList.add('won');
  sfx.play('done', { vary: false });
  setTimeout(() => sfx.play('stamp'), 1000);
  addStamp();
  return new Promise((res) => setTimeout(res, 1300));
}

go(routeFrom(params), false);
window.shelf = { go, get route() { return current; }, save };                 // for tests and the screenshot tool

