import './style.css';
import { loading } from './engine/loading.js';
import { holdGate, homeGate } from './engine/gate.js';
import * as THREE from 'three';
import { createPipeline } from './engine/pipeline.js';
import { Q, auto as autoTier, chooseTier } from './engine/quality.js';
import { skyEnv } from './env.js';
import { settings as learnSettings, saveSettings as saveLearn } from './learning.js';
import { preloadAssets, MODEL_LIST, onProgress } from './assets.js';
import { Party } from './party.js';
import { ui } from './ui.js';
import { unlock, playMusic, stopMusic, sfx, setMuted, isMuted, setMusicLevel, getMusicLevel, stopSpeech, setVoices, voicesEnabled } from './audio.js';
import { BeachScene } from './scenes/beach.js';
import { FallScene } from './scenes/fall.js';
import { CatRoomScene } from './scenes/catroom.js';
import { ChocolateScene } from './scenes/chocolate.js';
import { BoardScene } from './scenes/board.js';
import { CastleScene } from './scenes/castle.js';
import { WarpScene, WakeScene } from './scenes/ending.js';

const canvas = document.getElementById('c');
// one shared renderer + glow + colour grade (src/engine/pipeline.js); NeutralToneMapping keeps candy colours vivid without clipping
const gfx = createPipeline(canvas, { exposure: 0.8, bloom: { strength: 0.1, radius: 0.45, threshold: 1.05 }, grade: { sat: 1.12, con: 1.06 } });
const renderer = gfx.renderer;

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
        if (later && name !== 'beach' && name !== 'fall') await Promise.race([later, new Promise((r) => setTimeout(r, 8000))]);   // the rest of the models (normally long since loaded)
        if (game.current) { game.current.exit(); game.current.dispose(); }
        stopSpeech(); ui.hideFinale(); ui.hideBubble(); ui.hideHint(); ui.title(false); ui.eat(false); ui.roll(false); ui.progress(false);
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

const resize = () => gfx.resize();
gfx.onResize = (a, w, h) => game.current && game.current.resize(w, h);
game.renderer = renderer;
game.env = (key, opts) => skyEnv(renderer, key, opts);

function ndcOf(e) {
  const r = canvas.getBoundingClientRect();
  return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
}
canvas.addEventListener('pointerdown', (e) => { unlock(); game.current && !game.busy && game.current.onPointer(ndcOf(e)); });
canvas.addEventListener('pointermove', (e) => { game.current && game.current.onPointerMove(ndcOf(e), e.buttons > 0 || e.pointerType === 'touch'); });
['gesturestart', 'dblclick', 'contextmenu'].forEach((ev) => document.addEventListener(ev, (e) => e.preventDefault()));

// Developer shortcuts (keyboard, dev server only): 1 beach, 2 tunnel, 3 cat room, 4 candy room ...
if (import.meta.env.DEV) {
  window.addEventListener('keydown', (e) => {
    const map = { 1: 'beach', 2: 'fall', 3: 'cat', 4: 'chocolate', 5: 'board', 6: 'castle', 7: 'warp', 8: 'wake' };
    if (map[e.key]) { unlock(); game.started = true; game.goto(map[e.key]); }
  });
}

// ---- hidden grown-ups menu: hold the top-right corner for 2 seconds ----
const SCENE_LIST = [['Beach', 'beach'], ['Tunnel fall', 'fall'], ['Cat room', 'cat'], ['Candy room', 'chocolate'], ['Board game', 'board'], ['Castle', 'castle'], ['Home again', 'wake']];
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
holdGate(document.getElementById('secret'), () => { gfxLabel(); parentEl.classList.remove('hidden'); });
homeGate();
document.getElementById('pclose').onclick = () => parentEl.classList.add('hidden');
const LEVELS = [[0, 'off'], [0.3, 'quiet'], [0.5, 'medium'], [0.8, 'loud']];
const pmute = document.getElementById('pmute'), pmusic = document.getElementById('pmusic');
// reading questions: on/off, level (auto follows each girl's answers), and whether brand-new items show their answer softly
const pquiz = document.getElementById('pquiz'), plevel = document.getElementById('plevel'), pretry = document.getElementById('pretry');
const LEVELS_R = ['auto', 0, 1, 2, 3, 4, 5, 6];         // reading level: auto follows each girl's answers (up and down); a number pins it
const showLearn = () => { pquiz.textContent = `Questions: ${learnSettings.on ? 'on' : 'off'}`; plevel.textContent = learnSettings.level === 'auto' ? 'Reading level: auto' : `Reading level: ${learnSettings.level}`; pretry.textContent = learnSettings.scaffoldNew !== false ? 'New words: answer glows' : 'New words: no hint'; };
pquiz.onclick = () => { learnSettings.on = !learnSettings.on; saveLearn(); showLearn(); };
plevel.onclick = () => { const i = LEVELS_R.findIndex((v) => String(v) === String(learnSettings.level)); learnSettings.level = LEVELS_R[(i + 1) % LEVELS_R.length]; saveLearn(); showLearn(); };
pretry.onclick = () => { learnSettings.scaffoldNew = learnSettings.scaffoldNew === false; saveLearn(); showLearn(); };   // errorless help for brand-new items
showLearn();
const pvoice = document.getElementById('pvoice'); pvoice.textContent = `Voices: ${voicesEnabled() ? 'on' : 'off'}`;
pvoice.onclick = () => { setVoices(!voicesEnabled()); pvoice.textContent = `Voices: ${voicesEnabled() ? 'on' : 'off'}`; };
// graphics: Auto (adjusts itself, the default) or a fixed tier picked here, which is remembered on this device
const pgfx = document.getElementById('pgfx');
const gfxLabel = () => { pgfx.textContent = `Graphics: ${autoTier.on ? `auto (${Q.name})` : Q.name}`; };
pgfx.onclick = () => { const o = [null, 'high', 'medium', 'low'], i = autoTier.on ? 0 : o.indexOf(Q.name); chooseTier(o[(i + 1) % o.length]); gfx.applyTier(); gfxLabel(); };
gfx.onTier = gfxLabel; gfx.applyTier();
pmute.onclick = () => { setMuted(!isMuted()); pmute.textContent = `Sound: ${isMuted() ? 'off' : 'on'}`; };
pmusic.onclick = () => {
  let i = LEVELS.findIndex(([v]) => v === getMusicLevel()); i = (i + 1) % LEVELS.length;
  setMusicLevel(LEVELS[i][0]); pmusic.textContent = `Music: ${LEVELS[i][1]}`;
};

// ---- main loop (the pipeline also steps the quality down/up if the iPad is struggling or has room to spare) ----
gfx.start((dt) => {
  const s = game.current;
  if (!s) return false;
  s.update(dt);
  gfx.setScene(s.scene, s.camera);
});

window.game = game; // handy for debugging in the browser console
// Load only what the beach needs before the title appears; the candy models and the other sky photos follow in the background.
const BEACH_MODELS = MODEL_LIST.filter((n) => n.startsWith('nature/'));
let later = null;
async function boot() {
  onProgress.cb = loading.set;
  await preloadAssets(renderer, BEACH_MODELS, { hdr: ['beach'] });   // if anything fails the game falls back to shapes built in code
  onProgress.cb = null;
  game.current = new BeachScene(game);
  game.current.name = 'beach';
  resize();
  game.current.enter();
  loading.done();
  later = preloadAssets(renderer, MODEL_LIST.filter((n) => !BEACH_MODELS.includes(n)), { hdr: ['candy', 'castle'] });
}
boot().catch((e) => { console.error(e); loading.fail(); });

// wire up the Play button (also unlocks audio, which iPads require)
ui.onPlay(() => { unlock(); game.current.startPlay && game.current.startPlay(); });
export { playMusic, stopMusic };
