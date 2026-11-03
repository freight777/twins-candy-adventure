// Sparkle Plinko's sound sprite (Kenney CC0 sounds, built by tools/plinko-sfx.mjs) played through the shared mix in src/audio.js.
// The file is fetched at load; it is decoded once the audio clock exists (the first tap). Pegs ring up a pentatonic scale.
import { audioCtx, playBuffer } from '../audio.js';
import MAP from './sfx.json';

let bytes = null, buf = null, decoding = null;
const last = {};
export function loadSfx() {
  return fetch(`${import.meta.env.BASE_URL}assets/plinko/sfx.mp3`).then((r) => r.arrayBuffer()).then((b) => { bytes = b; }).catch(() => {});
}
function ready() {
  if (buf) return true;
  const ctx = audioCtx();
  if (ctx && bytes && !decoding) decoding = ctx.decodeAudioData(bytes.slice(0)).then((b) => { buf = b; }, () => {});
  return false;
}
/** play a cue; minGap (s) stops a cue machine-gunning when many balls hit at once */
export function play(cue, { rate = 1, vol = 1, pan = 0, wet = .12, minGap = 0 } = {}) {
  if (!ready() || !MAP[cue]) return;
  const now = performance.now() / 1000;
  if (minGap && last[cue] && now - last[cue] < minGap) return;
  last[cue] = now;
  const [start, dur] = MAP[cue];
  playBuffer(buf, start, dur, { rate, vol, pan, wet });
}
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
/** the n-th note of the peg scale (a ball's chain of peg hits climbs it) */
export const scaleRate = (n) => Math.pow(2, SCALE[n % SCALE.length] / 12);
/** something to call from the first tap so the sprite is ready by the first bounce */
export const warm = () => ready();
