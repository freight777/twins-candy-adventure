// Sparkle Match — a match-3 a five-year-old can play alone and always win (see the build spec). Three screens:
//   match.html                         the two doors (Unicorn and Mermaid); hold the house for the games menu, the gear for grown-ups
//   match.html?door=mermaid            that door's map: ten lands of ten level stones, charms, friends
//   match.html?door=mermaid&level=34   a level (&seed=7 for a fixed board; the old ?theme= still works)
// Phases 1–3: real pieces, every animation of §6, sounds, hints; the goal bar, the friend's visits, the lessons, the win screen;
// doors, maps, charms, saving per door, the friends' recorded voices, a music loop per door, and the grown-up corner.
import './match.css';
import { Application, Sprite, Graphics, Container } from 'pixi.js';
import gsap from 'gsap';
import confetti from 'canvas-confetti';
import { holdGate } from '../engine/gate.js';
import { applyBedtime } from '../engine/bedtime.js';
import { unlock, voice, say, setMuted, playMusic, stopMusic, setMusicLevel } from '../audio.js';
import { sfxSprite } from '../engine/sfxsprite.js';
import { createGame, play, remaining, bestMove } from './game/engine.js';
import { makeLevel } from './game/levels.js';
import { THEMES, lessonOne } from './themes.js';
import { save, won, markWon, current, open } from './save.js';
import { showDoors, friendName, artSrc } from './screens/doors.js';
import { buildMap, showCharms } from './screens/map.js';
import { showGrownups } from './screens/grownups.js';
import { Board } from './view/board.js';
import { loadArt } from './view/piece.js';
import { attachInput } from './view/input.js';
import { createHint } from './view/hint.js';
import MAP from './sfx.json';

const $ = (s) => document.querySelector(s), BASE = import.meta.env.BASE_URL;
const q = new URLSearchParams(location.search);
const doorId = ['unicorn', 'mermaid'].includes(q.get('door') || q.get('theme')) ? q.get('door') || q.get('theme') : null;
const newSeed = () => (Math.random() * 1e6) | 0;
['gesturestart', 'dblclick', 'contextmenu'].forEach((ev) => document.addEventListener(ev, (e) => e.preventDefault()));
applyBedtime();
const sfx = sfxSprite(`${BASE}assets/match/sfx.mp3`, MAP);
const applySettings = () => { setMuted(!save.settings.sound); if (!save.settings.music) stopMusic(); };
applySettings();
let musicOn = false;
addEventListener('pointerdown', () => {
  unlock(); sfx.warm();
  if (doorId && save.settings.music && !musicOn) { musicOn = true; setMusicLevel(0.28); playMusic(THEMES[doorId].door.song, { fadeIn: 2 }); }
}, { capture: true });

if (!doorId) {
  // ---------------------------------------------------------------------------------------------- the doors
  document.body.dataset.screen = 'doors';
  holdGate($('#home'), () => { location.href = './'; }, { ms: 1200, onTap: () => voice('hold_to_go_home', { priority: 0 }) });
  const draw = () => showDoors($('#doors'), { onPick: (d) => { say(`${THEMES[d].door.title}!`, THEMES[d].voice); setTimeout(() => { location.href = `?door=${d}`; }, 650); } });
  draw();
  let nudge = 0, which = 0;
  const idleDoors = () => { clearTimeout(nudge); nudge = setTimeout(() => {
    const doors = [...document.querySelectorAll('.door')], d = doors[which++ % doors.length]; if (!d) return;
    d.classList.remove('nudge'); void d.offsetWidth; d.classList.add('nudge'); say(`${THEMES[d.dataset.door].door.title}!`, THEMES[d.dataset.door].voice); idleDoors();
  }, 8000); };
  addEventListener('pointerdown', idleDoors); idleDoors();
  holdGate($('#gear'), () => showGrownups(document.body, { onChange: () => { applySettings(); draw(); } }), { ms: 2000 });
} else {
  await startDoor(doorId);
}

async function startDoor(id) {
  const base = THEMES[id], theme = { ...base, art: { ...base.art, friend: friendName(base) } };   // the mermaid in the skin tone a grown-up chose
  document.body.dataset.theme = id;
  document.querySelector('meta[name="theme-color"]').content = theme.bg[0];

  const app = new Application();
  await app.init({ resizeTo: window, backgroundAlpha: 0, antialias: true, autoDensity: true, resolution: Math.min(2, devicePixelRatio || 1) });
  $('#stage').appendChild(app.canvas);
  const tex = await loadArt(theme);
  const board = new Board(app, theme, tex), flyLayer = new Container(); app.stage.addChild(flyLayer);
  const hint = await createHint(board);
  $('#friend').src = artSrc(theme.art.friend); $('#winFriend').src = artSrc(theme.art.friend);

  let g = null, level = 1, seed = 0, busy = false, pending = null, idle = 0, map = null;

  // -------------------------------------------------------------------------------------------- screens: the map and a level
  function openMap(hopFrom = null) {
    clearTimeout(idle); hint.hide(); $('#win').classList.add('hidden'); $('#friend').classList.remove('dance');
    document.body.dataset.screen = 'map'; app.ticker.stop();
    history.replaceState(null, '', `?door=${id}`);
    map = buildMap($('#map'), theme, id, theme.art.friend, {
      onPlay: (n) => { sfx.play('tick'); start(n, newSeed()); },
      onCharms: (li) => { say(`${theme.lands[li].name}!`, theme.voice); showCharms(document.body, theme, id, li, {}); },
    });
    requestAnimationFrame(() => map.standOn(current(id), hopFrom));
    const walker = $('#map .walker'), letsGo = () => { walker.classList.remove('hop'); void walker.offsetWidth; walker.classList.add('hop'); speak("Let's go!", true); };
    clearTimeout(mapIdle); mapIdle = setTimeout(() => { if (document.body.dataset.screen === 'map' && !document.querySelector('.charms')) letsGo(); }, 8000);
    $('#map .map-scroll').addEventListener('pointerdown', (e) => { clearTimeout(mapIdle); if (e.target.closest('.land-name')) say(`${theme.lands[+e.target.closest('.land').dataset.land].name}!`, theme.voice); });
    walker.style.pointerEvents = 'auto'; walker.addEventListener('click', letsGo);
  }
  let mapIdle = 0;
  $('#mapBack').addEventListener('click', () => { location.href = './match.html'; });
  $('#back').addEventListener('click', () => openMap());
  $('#bulb').addEventListener('click', () => { if (g && !g.done && !busy) { clearTimeout(idle); hint.show(bestMove(g)); } });

  function layout() {
    const r = $('#boardbox').getBoundingClientRect();
    board.layout({ x: r.left, y: r.top, w: r.width, h: r.height });
  }
  addEventListener('resize', () => requestAnimationFrame(layout));

  function start(n, s) {
    level = Math.min(100, Math.max(1, n | 0)); seed = s | 0;
    document.body.dataset.screen = 'play'; app.ticker.start();
    g = createGame(makeLevel(level), seed); pending = null; flying = 0;
    hint.hide(); board.load(g); drawGoal(); layout();
    $('#win').classList.add('hidden'); $('#friend').classList.remove('dance');
    history.replaceState(null, '', `?door=${id}&level=${level}&seed=${seed}`);
    lesson = LESSONS.includes(level) && !won(id, level);
    introGoal().then(() => { if (lesson && g.moves === 0) { speak(level === 1 ? lessonOne(theme, g.level.goal.kinds[0]) : theme.lines.lesson[level], true); hint.show(bestMove(g)); } });
    poke();
  }

  // -------------------------------------------------------------------------------------------- first-time lessons (§2)
  // Levels 1, 11, 21 and 31 introduce a goal: the hand demonstrates the first move at once and one sentence is spoken,
  // each time the level is opened until it has been won on this door.
  const LESSONS = [1, 11, 21, 31];
  let lesson = false;

  // -------------------------------------------------------------------------------------------- the friend's voice (praise at most once every 8 s)
  let saidAt = -1e9;
  function speak(line, always = false) { if (!always && performance.now() - saidAt < 8000) return; saidAt = performance.now(); say(line, theme.voice, { priority: 1 }); }
  const pickLine = (list) => list[(Math.random() * list.length) | 0];

  /** a new level: its goal appears big in the middle — picture and number — then flies into the goal bar */
  function introGoal() {
    const box = $('#intro'), chips = $('#chips');
    box.innerHTML = chips.innerHTML; box.className = 'show'; chips.style.visibility = 'hidden';
    return new Promise((res) => setTimeout(() => {
      const from = box.getBoundingClientRect(), to = chips.getBoundingClientRect();
      box.style.transform = `translate(${to.left + to.width / 2 - (from.left + from.width / 2)}px, ${to.top + to.height / 2 - (from.top + from.height / 2)}px) scale(${Math.min(1, to.width / from.width)})`;
      box.classList.add('fly');
      setTimeout(() => { box.className = ''; box.style.transform = ''; box.innerHTML = ''; chips.style.visibility = ''; res(); }, 450);
    }, 1300));
  }

  // -------------------------------------------------------------------------------------------- the goal bar: pictures and numerals only
  const shown = {};
  function goalItems() {
    const goal = g.level.goal, img = (n) => `<img src="${artSrc(n)}" alt="" draggable="false">`;
    if (goal.type === 'collect') return goal.kinds.map((k) => ({ key: 'k' + k, pic: `<div class="pic" style="--c:${theme.colors[k]}">${img(theme.names[k])}</div>`, n: Math.max(0, goal.each - g.got.pieces[k]) }));
    if (goal.type === 'tiles') return [{ key: 'tiles', pic: '<div class="pic tile"></div>', n: remaining(g) }];
    if (goal.type === 'make') return [{ key: 'make', pic: `<div class="pic power ${id}" style="--c:${theme.colors[1]}">${img(theme.names[1])}</div>`, n: remaining(g) }];
    if (goal.type === 'drop') return [{ key: 'drop', pic: `<div class="pic friend">${img(theme.art.home)}</div>`, n: remaining(g) }];
    return [{ key: 'pop', pic: `<div class="pic party">${img(theme.art.party)}</div>`, n: remaining(g) }];
  }
  function drawGoal() {
    const items = goalItems();
    $('#chips').innerHTML = items.map((it) => `<div class="chip" data-key="${it.key}">${it.pic}<span class="num"></span></div>`).join('');
    items.forEach((it) => setChip(it.key, it.n, false));
  }
  function setChip(key, n, juicy = true) {
    const chip = document.querySelector(`.chip[data-key="${key}"]`); if (!chip) return;
    const was = shown[key]; shown[key] = n;
    chip.querySelector('.num').textContent = n > 0 ? n : '';
    chip.classList.toggle('done', n <= 0);
    if (juicy && was !== n) { chip.classList.remove('bump'); void chip.offsetWidth; chip.classList.add('bump'); if (n <= 0 && was > 0) sfx.play('done'); }
  }
  /** a collected thing flies to its goal picture; the number ticks down when it lands */
  let flying = 0;
  function fly({ key, n, x, y, tex: t }) {
    const chip = document.querySelector(`.chip[data-key="${key}"] .pic`); if (!chip) return;
    const r = chip.getBoundingClientRect(), size = 100 * (board.scale || 0.5);
    let s;
    if (t) { s = new Sprite(t); s.anchor.set(0.5); s.width = s.height = size * 0.8; }
    else { s = new Graphics().roundRect(-40, -40, 80, 80, 16).fill(0xffd23f).stroke({ width: 6, color: 0xffffff }); s.scale.set(size / 100); }
    s.position.set(x, y); flyLayer.addChild(s); flying++;
    const k = (r.width * 0.9) / (t ? s.width / s.scale.x : 100), d = 0.5 + Math.random() * 0.12;
    gsap.to(s, { x: r.left + r.width / 2, duration: d, ease: 'power1.inOut' });
    gsap.to(s, { y: r.top + r.height / 2, duration: d, ease: 'back.in(1.6)' });
    gsap.to(s.scale, { x: k, y: k, duration: d, ease: 'power1.in', onComplete: () => {
      s.destroy(); flying--; sfx.play('tick', { vol: 0.7, minGap: 0.03 });
      setChip(key, Math.max(0, (shown[key] ?? 0) - n));
      if (!flying && !busy) settleGoal();
    } });
  }
  /** after the flights: the bar shows exactly what the engine says */
  function settleGoal() { for (const it of goalItems()) if (shown[it.key] !== it.n) setChip(it.key, it.n); }

  // -------------------------------------------------------------------------------------------- the friend beside the board
  let cheerAt = 0;
  function cheer() {
    const f = $('#friend'); f.classList.remove('cheer'); void f.offsetWidth; f.classList.add('cheer');
    if (performance.now() - cheerAt > 2500) { cheerAt = performance.now(); sfx.play(id === 'unicorn' ? 'jUniCheer' : 'jSeaCheer', { vary: false, vol: 0.8 }); }
    speak(pickLine(theme.lines.praise));
  }
  /** the friend leaves its place beside the board while it visits the board */
  function visit(on) { $('#friend').classList.toggle('away', on); if (on) speak(pickLine(theme.lines.help), true); }
  board.hooks = { sound: (c, o) => sfx.play(c, o), cheer, fly, visit };
  $('#chips').addEventListener('click', (e) => { const chip = e.target.closest('.chip'); if (!chip) return; const n = shown[chip.dataset.key] ?? 0;
    chip.classList.remove('bump'); void chip.offsetWidth; chip.classList.add('bump'); if (n > 0 && n <= 30) voice(`n_${n}`, { priority: 0 }); });
  $('#friend').addEventListener('click', () => { const f = $('#friend'); f.classList.remove('cheer'); void f.offsetWidth; f.classList.add('cheer'); sfx.play('gift', { vol: 0.6 }); });
  $('#win').addEventListener('click', (e) => { const t = e.target.closest('#winFriend, #prize img'); if (t) { t.classList.remove('hop'); void t.offsetWidth; t.classList.add('hop'); sfx.play('gift', { vol: 0.6 }); } });

  // -------------------------------------------------------------------------------------------- moves
  function poke() { clearTimeout(idle); hint.hide(); idle = setTimeout(offerHint, (lesson && g?.moves === 0) || save.settings.hints ? 2000 : 5000); }
  function offerHint() { if (document.body.dataset.screen !== 'play') return; if (busy || !g || g.done) return poke(); hint.show(bestMove(g)); }

  /** one move from the child; while the board is still busy, remember the latest one and play it when it settles */
  async function submit(m) {
    if (!g || g.done) return;
    if (busy) { pending = m; return; }
    busy = true; poke();
    let refused = false;
    try {
      const steps = play(g, m);
      if (!steps) { refused = m.a !== undefined; if (refused) await board.wobble(m.a, m.b); }
      else await board.play(steps);
    } finally { busy = false; }
    if (!flying) settleGoal();
    if (g.done) return celebrate();
    if (refused && !pending) { clearTimeout(idle); hint.show(bestMove(g)); return; }   // a swap that matched nothing: show the hint at once
    if (pending) { const p = pending; pending = null; submit(p); }
  }
  /** the win: pieces pop, confetti, the friend dances; the level's charm (and on a party level, the land's friend) is won; then one arrow */
  function celebrate() {
    clearTimeout(idle); hint.hide();
    const li = Math.floor((level - 1) / 10), j = (level - 1) % 10, first = markWon(id, level), land = theme.lands[li];
    lesson = false;
    speak(pickLine(theme.lines.win), true);
    sfx.play(id === 'unicorn' ? 'jUniWin' : 'jSeaWin', { vary: false });
    $('#friend').classList.add('dance');
    const colors = theme.colors.concat(['#ffffff']);
    confetti({ particleCount: 120, spread: 90, startVelocity: 42, origin: { x: 0.5, y: 0.65 }, colors, disableForReducedMotion: true, zIndex: 4 });
    setTimeout(() => confetti({ particleCount: 60, angle: 60, spread: 60, origin: { x: 0, y: 0.8 }, colors, disableForReducedMotion: true, zIndex: 4 }), 250);
    setTimeout(() => confetti({ particleCount: 60, angle: 120, spread: 60, origin: { x: 1, y: 0.8 }, colors, disableForReducedMotion: true, zIndex: 4 }), 400);
    $('#prize').innerHTML = `<img class="charm" src="${artSrc(land.charms[j])}" alt="">${j === 9 ? `<img class="newfriend" src="${artSrc(land.friend)}" alt="">` : ''}<span class="book"><img src="${artSrc(land.charms[0])}" alt=""></span>`;
    setTimeout(() => {
      $('#win').classList.remove('hidden');
      setTimeout(() => {                                             // the charm flies to its land's page
        if (first) say(j === 9 ? 'A new friend!' : 'A new charm!', theme.voice, { priority: 2 });
        $('#prize').classList.remove('flown'); void $('#prize').offsetWidth; $('#prize').classList.add('flown');
        if (j === 9 && first) setTimeout(() => say(`You finished ${land.name}!`, theme.voice, { priority: 2 }), 1600);
      }, 900);
    }, 1400);
  }
  attachInput(app.canvas, board, submit);
  app.canvas.addEventListener('pointerdown', poke);
  $('#next').addEventListener('click', () => openMap(level));       // back to the map: the friend hops on to the next stone

  window.match = { board, submit, start, openMap, app, gsap, hint, get game() { return g; }, get busy() { return busy; } };   // for tests and the screenshot tool
  if (import.meta.env.DEV) Promise.all([import('./dev/soak.js'), import('./game/engine.js')]).then(([d, E]) => { window.match.soak = d.installSoak(window.match, E); });

  const asked = +q.get('level');
  if (asked && (open(id, asked) || q.has('seed') || import.meta.env.DEV)) start(asked, q.has('seed') ? +q.get('seed') : newSeed());
  else openMap();
}
