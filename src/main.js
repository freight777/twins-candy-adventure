import './style.css';
import * as THREE from 'three';
import { Party } from './party.js';
import { ui } from './ui.js';
import { unlock, playMusic, stopMusic, sfx, setMuted, isMuted, setMusicLevel, getMusicLevel } from './audio.js';
import { BeachScene } from './scenes/beach.js';
import { FallScene } from './scenes/fall.js';
import { CatRoomScene } from './scenes/catroom.js';
import { ChocolateScene } from './scenes/chocolate.js';
import { BoardScene } from './scenes/board.js';
import { CastleScene } from './scenes/castle.js';
import { WarpScene, WakeScene } from './scenes/ending.js';

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const SCENES = { beach: BeachScene, fall: FallScene, cat: CatRoomScene, chocolate: ChocolateScene, board: BoardScene, castle: CastleScene, warp: WarpScene, wake: WakeScene };

export const game = {
  party: new Party(),
  ui,
  current: null,
  started: false,
  stars: 0,
  setActive(who) {
    if (game.party.active === who) return;
    game.party.active = who;
    ui.setActive(who);
    sfx.pop();
  },
  /** Fade out, swap scenes, fade back in. */
  goto(name, { flash = '#fff' } = {}) {
    if (game.busy) return;
    game.busy = true;
    ui.fade(flash, async () => {
      try {
        if (game.current) { game.current.exit(); game.current.dispose(); }
        ui.hideBubble(); ui.hideHint(); ui.title(false); ui.eat(false); ui.roll(false); ui.progress(false);
        game.party.resetPose();
        game.current = new SCENES[name](game);
        game.current.name = name;
        resize();
        game.current.enter();
      } catch (err) {
        console.error('Scene change failed:', err);
      }
      game.busy = false;
    });
  },
};

ui.init();
ui.setActive('adalyn');
ui.onPick((who) => game.setActive(who));

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  game.current && game.current.resize(w, h);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));

function ndcOf(e) {
  const r = canvas.getBoundingClientRect();
  return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
}
canvas.addEventListener('pointerdown', (e) => { unlock(); game.current && !game.busy && game.current.onPointer(ndcOf(e)); });
canvas.addEventListener('pointermove', (e) => { game.current && game.current.onPointerMove(ndcOf(e), e.buttons > 0 || e.pointerType === 'touch'); });
['gesturestart', 'dblclick', 'contextmenu'].forEach((ev) => document.addEventListener(ev, (e) => e.preventDefault()));

// Developer shortcuts (keyboard only): 1 beach, 2 tunnel, 3 cat room, 4 chocolate room
window.addEventListener('keydown', (e) => {
  const map = { 1: 'beach', 2: 'fall', 3: 'cat', 4: 'chocolate', 5: 'board', 6: 'castle', 7: 'warp', 8: 'wake' };
  if (map[e.key]) { unlock(); game.started = true; game.goto(map[e.key]); }
});

// ---- hidden grown-ups menu: tap the top-right corner 3 times ----
const SCENE_LIST = [['Beach', 'beach'], ['Tunnel fall', 'fall'], ['Cat room', 'cat'], ['Chocolate room', 'chocolate'], ['Board game', 'board'], ['Castle', 'castle'], ['Home again', 'wake']];
const pscenes = document.getElementById('pscenes'), parentEl = document.getElementById('parent');
SCENE_LIST.forEach(([label, name]) => {
  const b = document.createElement('button'); b.textContent = label;
  b.onclick = () => {
    parentEl.classList.add('hidden'); unlock(); game.started = true;
    if (name === 'board' || name === 'castle' || name === 'warp' || name === 'wake') { game.party.adalyn.setForm('unicorn'); game.party.esmae.setForm('mermaid'); }
    if (name === 'chocolate') { game.party.adalyn.setForm('unicorn'); game.party.esmae.setForm('mermaid'); }
    game.goto(name);
  };
  pscenes.appendChild(b);
});
let taps = [];
document.getElementById('secret').addEventListener('pointerdown', () => {
  const now = performance.now(); taps = taps.filter((t) => now - t < 1800); taps.push(now);
  if (taps.length >= 3) { taps = []; parentEl.classList.remove('hidden'); }
});
document.getElementById('pclose').onclick = () => parentEl.classList.add('hidden');
const LEVELS = [[0, 'off'], [0.3, 'quiet'], [0.5, 'medium'], [0.8, 'loud']];
const pmute = document.getElementById('pmute'), pmusic = document.getElementById('pmusic');
pmute.onclick = () => { setMuted(!isMuted()); pmute.textContent = `Sound: ${isMuted() ? 'off' : 'on'}`; };
pmusic.onclick = () => {
  let i = LEVELS.findIndex(([v]) => v === getMusicLevel()); i = (i + 1) % LEVELS.length;
  setMusicLevel(LEVELS[i][0]); pmusic.textContent = `Music: ${LEVELS[i][1]}`;
};

// ---- main loop (also quietly lowers resolution if the iPad is struggling) ----
const clock = new THREE.Clock();
let slow = 0, frames = 0, pr = renderer.getPixelRatio();
renderer.setAnimationLoop(() => {
  const raw = clock.getDelta(), dt = Math.min(raw, 0.05);
  const s = game.current;
  if (!s) return;
  s.update(dt);
  renderer.render(s.scene, s.camera);
  if (raw > 0.032 && raw < 0.5) slow++;
  if (++frames === 120) { if (slow > 70 && pr > 1) { pr = Math.max(1, pr - 0.5); renderer.setPixelRatio(pr); resize(); } slow = 0; frames = 0; }
});

window.game = game; // handy for debugging in the browser console
if (import.meta.env.PROD && 'serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
game.current = new BeachScene(game);
game.current.name = 'beach';
resize();
game.current.enter();

// wire up the Play button (also unlocks audio, which iPads require)
ui.onPlay(() => { unlock(); game.current.startPlay && game.current.startPlay(); });
export { playMusic, stopMusic };
