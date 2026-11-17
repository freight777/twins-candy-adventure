// A sound sprite (one mp3 + a cue map, built by tools/game-sfx.mjs) played through the shared mix in src/audio.js.
// Fetched at load, decoded once the audio clock exists (the first tap). Every cue plays at one of three slightly different pitches,
// so repeats never sound mechanical.
import { audioCtx, playBuffer } from '../audio.js';

const VARY = [0.955, 1, 1.045];
export function sfxSprite(url, MAP) {
  let bytes = null, buf = null, decoding = null; const last = {};
  fetch(url).then((r) => r.arrayBuffer()).then((b) => { bytes = b; ready(); }).catch(() => {});
  function ready() {
    if (buf) return true;
    const ctx = audioCtx();
    if (ctx && bytes && !decoding) decoding = ctx.decodeAudioData(bytes.slice(0)).then((b) => { buf = b; }, () => {});
    return false;
  }
  /** play a cue; rate is multiplied by a random one of three pitches unless vary is false; minGap (s) stops machine-gunning */
  function play(cue, { rate = 1, vol = 1, pan = 0, wet = 0.1, minGap = 0, vary = true } = {}) {
    if (!ready() || !MAP[cue]) return;
    const now = performance.now() / 1000;
    if (minGap && last[cue] && now - last[cue] < minGap) return;
    last[cue] = now;
    const [start, dur] = MAP[cue];
    playBuffer(buf, start, dur, { rate: rate * (vary ? VARY[(Math.random() * 3) | 0] : 1), vol, pan, wet });
  }
  return { play, warm: ready };
}
/** a pentatonic scale (it always sounds good): the n-th note as a playback rate */
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
export const note = (n) => Math.pow(2, PENTA[Math.max(0, Math.min(PENTA.length - 1, n))] / 12);
