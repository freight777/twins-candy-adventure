import './style.css';
import * as THREE from 'three';
import { Party } from './party.js';
import { ui } from './ui.js';
import { unlock, playMusic, stopMusic, sfx } from './audio.js';
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

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  const s = game.current;
  if (!s) return;
  s.update(dt);
  renderer.render(s.scene, s.camera);
});

window.game = game; // handy for debugging in the browser console
game.current = new BeachScene(game);
game.current.name = 'beach';
resize();
game.current.enter();

// wire up the Play button (also unlocks audio, which iPads require)
ui.onPlay(() => { unlock(); game.current.startPlay && game.current.startPlay(); });
export { playMusic, stopMusic };
