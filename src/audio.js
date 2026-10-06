// All sound effects and music are synthesized here. Speech is recorded clips (public/voice, rendered by tools/voice-bank.mjs
// from src/engine/lines.js) played through the same chain, with the device's own voice as the fallback for anything not recorded.
import { LINES, storyId, cleanText } from './engine/lines.js';
let ctx = null, master = null, musicBus = null, reverbIn = null, voiceBus = null, analyser = null, muted = false, musicLevel = 0.5;

function createGraph() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4;
  master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(comp); comp.connect(ctx.destination);
  musicBus = ctx.createGain(); musicBus.gain.value = musicLevel; musicBus.connect(master);
  // small dreamy reverb so everything sounds less "beepy"
  const len = Math.floor(ctx.sampleRate * 1.8), buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4); }
  const conv = ctx.createConvolver(); conv.buffer = buf;
  reverbIn = ctx.createGain(); reverbIn.gain.value = 0.28; reverbIn.connect(conv); conv.connect(master);
  // voices: their own bus (a touch of the same room), metered so characters can move their mouths with the words
  voiceBus = ctx.createGain(); voiceBus.gain.value = 1; voiceBus.connect(master);
  const room = ctx.createGain(); room.gain.value = 0.1; voiceBus.connect(room); room.connect(reverbIn);
  analyser = ctx.createAnalyser(); analyser.fftSize = 256; analyser.connect(voiceBus);
}
function primeSpeech() {                    // iPads only allow speech after a tap: "prime" it with a silent word
  if (!hasTTS || primeSpeech.done) return;
  primeSpeech.done = true;
  const u = new SpeechSynthesisUtterance(' '); u.volume = 0; window.speechSynthesis.speak(u);
}
/** Start (or wake up) the sound. Safe to call any time; every tap anywhere calls it. */
export function unlock() {
  if (!ctx) { createGraph(); primeSpeech(); }
  if (ctx && (ctx.state === 'suspended' || ctx.state === 'interrupted')) ctx.resume().catch(() => {});   // iOS uses "interrupted" after Siri / a phone call
}
// any gesture anywhere (quiz buttons, the deck, the eat button...), not only the 3D canvas; iOS needs touchend for the mute-switch path
if (typeof window !== 'undefined') {
  addEventListener('pointerdown', unlock, { capture: true, passive: true });
  addEventListener('touchend', unlock, { capture: true, passive: true });
  // the iPad locked / the app went to the background: stop talking and pause the sound; wake it again on return
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { pauseSpeech(); if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {}); }
    else { unlock(); if (ctx) nextT = Math.max(nextT, ctx.currentTime + 0.1); resumeSpeech(); }
  });
  addEventListener('pagehide', () => stopSpeech());
}
// ================= talking: the device's own text-to-speech, one voice "profile" per character =================
// (Later we can swap any of these for your own recordings.)
let voicesOn = true;
try { voicesOn = localStorage.getItem('candyVoices') !== 'off'; } catch { /* ignore */ }
let voiceList = [];
const hasTTS = typeof window !== 'undefined' && 'speechSynthesis' in window;
if (hasTTS) { const load = () => { voiceList = window.speechSynthesis.getVoices() || []; }; load(); window.speechSynthesis.onvoiceschanged = load; }

const FEMALE = ['Samantha', 'Ava', 'Allison', 'Zoe', 'Karen', 'Moira', 'Tessa', 'Serena', 'Aria', 'Jenny', 'Zira', 'Google US English', 'Google UK English Female'];
const MALE = ['Daniel', 'Arthur', 'Fred', 'Alex', 'Aaron', 'Guy', 'David', 'Google UK English Male'];
const PROFILES = {
  narrator: { pitch: 1.12, rate: 0.95, prefer: FEMALE },
  cat:      { pitch: 1.75, rate: 1.05, prefer: FEMALE },
  queen:    { pitch: 1.3,  rate: 0.92, prefer: ['Moira', 'Tessa', 'Serena', ...FEMALE] },
  king:     { pitch: 0.55, rate: 0.82, prefer: MALE },
  counter:  { pitch: 1.35, rate: 1.1,  prefer: FEMALE },
  uni:      { pitch: 1.45, rate: 1.02, prefer: FEMALE },
  sparkle:  { pitch: 1.8,  rate: 1.1,  prefer: FEMALE },
  rainbow:  { pitch: 1.3,  rate: 1.0,  prefer: ['Samantha', 'Ava', ...FEMALE] },
  cloud:    { pitch: 1.05, rate: 0.82, prefer: ['Tessa', 'Moira', ...FEMALE] },
  rain:     { pitch: 0.95, rate: 0.92, prefer: ['Karen', 'Serena', ...FEMALE] },
  princess: { pitch: 1.3,  rate: 0.92, prefer: FEMALE },
  mom:      { pitch: 1.05, rate: 0.95, prefer: ['Karen', 'Moira', ...FEMALE] },
  dad:      { pitch: 0.85, rate: 0.95, prefer: MALE },
  announcer: { pitch: 0.95, rate: 1.0, prefer: MALE },
  hero:     { pitch: 1.45, rate: 1.02, prefer: FEMALE },
  lucy:     { pitch: 1.6,  rate: 1.06, prefer: ['Samantha', ...FEMALE] },
};
function pickVoice(prefer) {
  const en = voiceList.filter((v) => /^en/i.test(v.lang));
  for (const name of prefer) { const v = en.find((x) => x.name.includes(name)); if (v) return v; }
  return en.find((v) => v.default) || en[0] || null;
}
export function duck(on) { if (musicBus && ctx) musicBus.gain.setTargetAtTime(on ? musicLevel * 0.35 : musicLevel, ctx.currentTime, 0.15); }

// ================= the speech queue: one line at a time, never cut off =================
// priority 0 = ambient (a tap on a character): dropped if anything is already speaking
// priority 1 = normal: waits its turn (dropped if it waited more than 4 s, so the voice never lags far behind the picture)
// priority 2 = story: cuts lower lines and is never cut by them
// A job is { play(done, started) -> stop(), est (ms safety timeout), priority, minMs }. TTS lines and recorded clips (engine/voice.js) share it.
const queue = []; let current = null, speechPaused = false;
export function enqueueSpeech(job) {
  return new Promise((resolve) => {
    job.resolve = resolve; job.at = performance.now(); job.priority ??= 1;
    if (job.tag) {                                   // a newer line with the same tag replaces the old one (counting along fast taps)
      for (let i = queue.length - 1; i >= 0; i--) if (queue[i].tag === job.tag) queue.splice(i, 1)[0].resolve(false);
      if (current && current.tag === job.tag) endJob(current, false, true);
    }
    if (job.priority === 0 && (current || queue.length)) { resolve(false); return; }
    if (job.priority === 2) {
      for (let i = queue.length - 1; i >= 0; i--) if (queue[i].priority < 2) queue.splice(i, 1)[0].resolve(false);
      if (current && current.priority < 2) endJob(current, false, true);
    }
    queue.push(job); pump();
  });
}
function pump() {
  if (current || speechPaused || !queue.length) return;
  const job = queue.shift();
  if (job.priority < 2 && performance.now() - job.at > (job.maxWait ?? 4000)) { job.resolve(false); pump(); return; }
  current = job; job.t0 = performance.now(); job.ended = false;
  const token = job.token = {};                      // ignore late callbacks from an attempt that was stopped
  job.guard = setTimeout(() => { if (job.token === token) endJob(job, true); }, job.est ?? 8000);   // iOS sometimes never reports the end
  job.stop = job.play(() => { if (job.token === token) endJob(job, true); }, () => { if (job.token === token) duck(true); });
}
function endJob(job, ok, now = false) {
  if (job.ended) { if (now && job.finishTimer) { clearTimeout(job.finishTimer); job.finishTimer = 0; job.finish(); } return; }   // cut short while it was holding for minMs
  job.ended = true; clearTimeout(job.guard); job.token = null;
  if (!ok) try { job.stop?.(); } catch { /* already stopped */ }
  job.finish = () => { job.finishTimer = 0; if (current === job) current = null; job.resolve(ok); if (!current) duck(false); pump(); };
  const wait = now ? 0 : Math.max(0, (job.minMs || 0) - (performance.now() - job.t0));     // keeps a cutscene's rhythm even when a line is short or silent
  if (wait) job.finishTimer = setTimeout(job.finish, wait); else job.finish();
}
/** the iPad locked: stop the line that is playing and play it again from the start when we come back */
function pauseSpeech() {
  speechPaused = true;
  if (current && !current.ended) { const j = current; j.token = null; clearTimeout(j.guard); try { j.stop?.(); } catch { /* ignore */ } current = null; queue.unshift(j); duck(false); }
}
function resumeSpeech() { speechPaused = false; const now = performance.now(); queue.forEach((j) => (j.at = now)); pump(); }
/** stop everything (scene changes): waiting lines resolve false */
export function stopSpeech() {
  queue.splice(0).forEach((j) => j.resolve(false));
  if (current) endJob(current, false, true);
  if (hasTTS) window.speechSynthesis.cancel();
  duck(false);
}
export const isSpeaking = () => !!current;
/** the speaker of the line playing right now ('cat', 'king', ...), so only that character's mouth moves */
export const currentSpeaker = () => (current && !current.ended ? current.who : null);
/** for debugging in the console: what the sound system is doing */
export const audioState = () => ({ ctx: ctx && ctx.state, time: ctx && +ctx.currentTime.toFixed(2), playing, queued: queue.length, speaking: !!current });

/** the device's own text-to-speech as a queue player (used when there is no recorded clip) */
function ttsPlayer(clean, who) {
  const p = PROFILES[who] || PROFILES.narrator;
  return (done, started) => {
    if (!hasTTS || !clean) { done(); return null; }
    const synth = window.speechSynthesis, u = new SpeechSynthesisUtterance(clean);
    const v = pickVoice(p.prefer); if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-US';
    u.pitch = p.pitch; u.rate = p.rate; u.volume = 1;
    u.onstart = started; u.onend = done; u.onerror = done;
    synth.speak(u);
    return () => synth.cancel();
  };
}
/** Speak a line as one of the characters and resolve when it has finished. opts: { priority, minMs }.
 *  If the exact sentence is in the voice bank (src/engine/lines.js) the recorded clip plays instead of the device voice. */
export function sayAsync(text, who = 'narrator', { priority = 1, minMs = 0 } = {}) {
  const clean = cleanText(text), id = storyId(who, clean);
  if (clean && LINES[id]) return voice(id, { who, priority, minMs });
  const p = PROFILES[who] || PROFILES.narrator, silent = !hasTTS || !voicesOn || muted || !clean;
  return enqueueSpeech({ who, priority, minMs, est: silent ? 0 : 1500 + clean.length * 90 / p.rate, play: silent ? (done) => { done(); return null; } : ttsPlayer(clean, who) });
}

// ================= recorded voice clips (Kokoro-82M, rendered at build time) =================
const clips = new Map();
/** 0..1: how loud the voice is right now (talking mouths read this) */
export const level = { v: 0 };
function clipBuffer(id) {
  if (!clips.has(id)) {
    clips.set(id, (async () => {
      if (!ctx) createGraph();
      if (!ctx) return null;
      try {
        const r = await fetch(`${import.meta.env.BASE_URL}voice/${id}.mp3`);
        if (!r.ok || !/audio|mpeg|octet/.test(r.headers.get('content-type') || 'audio')) return null;     // (a dev server answers missing files with the HTML page)
        return await ctx.decodeAudioData(await r.arrayBuffer());
      } catch { return null; }
    })());
  }
  return clips.get(id);
}
/** fetch + decode ahead of time (e.g. a scene's story lines) so the first line starts instantly */
export const preloadVoice = (ids) => Promise.all(ids.map(clipBuffer));
let playing = 0;
function meter() {
  const data = new Uint8Array(analyser.frequencyBinCount);
  const tick = () => {
    if (!playing) { level.v = 0; return; }
    analyser.getByteTimeDomainData(data); let m = 0; for (let i = 0; i < data.length; i++) m = Math.max(m, Math.abs(data[i] - 128));
    level.v += (Math.min(1, m / 48) - level.v) * .5;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
/**
 * Play one clip or several back to back (['which_starts_with', 'snd_m']) as ONE line in the speech queue.
 * opts: { who, priority, minMs, gap (s between clips), fallback (text for the device voice if a clip is missing),
 *         tag (a newer line with the same tag cuts this one: counting along) }
 */
export function voice(ids, { who = null, priority = 1, minMs = 0, gap = 0.08, fallback = null, tag = null } = {}) {
  const list = (Array.isArray(ids) ? ids : [ids]).filter(Boolean);
  const speaker = who || LINES[list[0]]?.who || 'narrator';
  const text = cleanText(fallback ?? list.map((id) => LINES[id]?.text ?? id.replace(/_/g, ' ')).join(' '));
  if (!voicesOn || muted || !list.length) return enqueueSpeech({ who: speaker, priority, minMs, tag, est: 0, play: (done) => { done(); return null; } });
  return enqueueSpeech({
    who: speaker, priority, minMs, tag, est: 20000,
    play(done, started) {
      let stopped = false, stopTts = null, guard = 0; const srcs = [];
      Promise.all(list.map(clipBuffer)).then((bufs) => {
        if (stopped) return;
        if (!ctx || ctx.state !== 'running' || bufs.some((b) => !b)) { stopTts = ttsPlayer(text, speaker)(done, started); return; }
        let t = ctx.currentTime + 0.03;
        bufs.forEach((b, i) => { const s = ctx.createBufferSource(); s.buffer = b; s.connect(analyser); s.start(t); t += b.duration + (i < bufs.length - 1 ? gap : 0); srcs.push(s); });
        playing++;
        // if the audio clock ever stalls (an interrupted audio session), the line still ends on time by the wall clock
        guard = setTimeout(() => { if (stopped) return; srcs.forEach((x) => { try { x.stop(); } catch { /* ended */ } }); done(); }, (t - ctx.currentTime) * 1000 + 1200);
        srcs[srcs.length - 1].onended = () => { playing = Math.max(0, playing - 1); clearTimeout(guard); if (!stopped) done(); };
        started(); if (playing === 1) meter();
      });
      return () => { stopped = true; clearTimeout(guard); srcs.forEach((s) => { try { s.stop(); } catch { /* not started */ } }); if (stopTts) stopTts(); };
    },
  });
}
/** Fire-and-forget version of sayAsync (same queue). */
export const say = (text, who = 'narrator', opts) => { sayAsync(text, who, opts); };
export function setVoices(on) { voicesOn = on; try { localStorage.setItem('candyVoices', on ? 'on' : 'off'); } catch { /* ignore */ } if (!on) stopSpeech(); }
export function voicesEnabled() { return voicesOn; }

export function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.8; }
export function isMuted() { return muted; }
export function setMusicLevel(v) { musicLevel = v; if (musicBus) musicBus.gain.value = v; }
export function getMusicLevel() { return musicLevel; }

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];

function tone(freq, dur = 0.3, { type = 'sine', vol = 0.25, slide = 0, delay = 0, attack = 0.01, out, wet = 0.18 } = {}) {
  if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + dur);
  o.connect(g); g.connect(out || master);
  if (wet && reverbIn) { const w = ctx.createGain(); w.gain.value = wet; g.connect(w); w.connect(reverbIn); }
  o.start(t0); o.stop(t0 + attack + dur + 0.05);
}

/** two seconds of white noise, made once; every drum hit plays a random slice of it */
let noiseBuf = null;
function noise(dur = 0.4, { vol = 0.3, from = 1500, to = 1500, q = 0.8, type = 'bandpass', delay = 0, out } = {}) {
  if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  if (!noiseBuf) { noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const src = ctx.createBufferSource(); src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(from, t0); f.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + dur * 0.2); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f); f.connect(g); g.connect(out || master);
  src.start(t0, Math.random() * Math.max(0, 2 - dur), Math.min(dur, 2));
}

export const sfx = {
  pop: () => { tone(500, 0.12, { slide: 2.2, vol: 0.25 }); },
  soft: () => { tone(392, 0.16, { type: 'triangle', slide: 0.85, vol: 0.16, wet: .25 }); tone(330, 0.2, { type: 'sine', slide: 0.85, vol: 0.12, delay: .12, wet: .25 }); },
  good: () => [659.25, 880, 1108.73, 1318.51].forEach((f, i) => tone(f, 0.32, { type: 'triangle', vol: 0.18, delay: i * 0.09, wet: .3 })),
  ting: () => { tone(1568, 0.6, { vol: 0.15, wet: .4 }); tone(2093, 0.7, { vol: 0.08, delay: 0.05, wet: .4 }); },
  note: (i = 0) => { const f = PENTA[i % PENTA.length]; tone(f, 0.6, { type: 'triangle', vol: 0.3, wet: .35 }); tone(f * 2.005, 0.5, { vol: 0.07, wet: .4 }); },
  sparkle: () => PENTA.forEach((f, i) => tone(f * 2, 0.45, { delay: i * 0.06, vol: 0.12, wet: .4 })),
  chime: () => { tone(880, 0.35, { vol: 0.2, wet: .35 }); tone(1318.5, 0.6, { vol: 0.2, delay: 0.08, wet: .4 }); },
  boing: () => { tone(180, 0.35, { type: 'sine', slide: 3.2, vol: 0.35 }); tone(360, 0.3, { slide: 2.2, vol: 0.1, delay: .02 }); },
  bonk: () => { tone(220, 0.18, { slide: 0.4, vol: 0.4 }); noise(0.08, { vol: 0.15, from: 900, to: 300 }); },
  splash: () => { noise(0.7, { vol: 0.35, from: 3000, to: 600, q: 0.6 }); tone(300, 0.2, { slide: 0.5, vol: 0.1 }); },
  honk: () => { for (const d of [0, 0.38]) { tone(233, 0.3, { type: 'sawtooth', vol: 0.16, delay: d }); tone(311, 0.3, { type: 'sawtooth', vol: 0.13, delay: d }); } },
  wave: () => { noise(3.2, { vol: 0.07, from: 350, to: 1600, q: 0.35, type: 'bandpass' }); },
  whoosh: (d = 1.2) => noise(d, { vol: 0.35, from: 300, to: 3000, q: 1.2 }),
  squeak: () => { tone(1500, 0.08, { slide: 0.7, vol: 0.2 }); tone(1900, 0.1, { slide: 0.6, vol: 0.2, delay: 0.1 }); },
  squawk: () => { tone(700, 0.18, { type: 'sawtooth', slide: 0.5, vol: 0.12 }); tone(800, 0.2, { type: 'sawtooth', slide: 0.45, vol: 0.12, delay: 0.2 }); },
  meow: () => { tone(520, 0.45, { type: 'triangle', slide: 1.0, vol: 0.25 }); tone(780, 0.3, { type: 'triangle', slide: 0.55, vol: 0.2, delay: 0.15 }); },
  giggle: () => { for (let i = 0; i < 6; i++) tone(700 + Math.random() * 350, 0.07, { vol: 0.14, delay: i * 0.085, slide: 1.3 }); },
  babble: (n = 6) => { for (let i = 0; i < n; i++) tone(320 + Math.random() * 360, 0.07, { type: 'triangle', vol: 0.16, delay: i * 0.1 }); },
  tada: () => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.6, { type: 'triangle', vol: 0.25, delay: i * 0.1, wet: .3 })),
  fanfare: () => { [[523.25, 0], [523.25, .15], [523.25, .3], [698.46, .45], [880, .8], [783.99, 1.05], [1046.5, 1.3]].forEach(([f, d]) => { tone(f, .45, { type: 'sawtooth', vol: .1, delay: d, wet: .3 }); tone(f / 2, .45, { type: 'triangle', vol: .12, delay: d }); }); },
  magic: () => { PENTA.concat(PENTA.map((f) => f * 2)).forEach((f, i) => tone(f, 0.5, { delay: i * 0.07, vol: 0.14, type: i % 2 ? 'sine' : 'triangle', wet: .4 })); },
  crunch: () => { noise(0.09, { vol: 0.5, from: 2500, to: 700, q: 0.7 }); noise(0.08, { vol: 0.4, from: 3000, to: 900, q: 0.7, delay: 0.11 }); noise(0.07, { vol: 0.3, from: 2000, to: 600, q: 0.7, delay: 0.21 }); },
  yum: () => { tone(523.25, 0.14, { type: 'triangle', vol: 0.25, delay: 0.3 }); tone(784, 0.35, { type: 'triangle', vol: 0.25, delay: 0.42, wet: .3 }); },
  dice: () => { for (let i = 0; i < 6; i++) tone(300 + Math.random() * 500, 0.05, { type: 'square', vol: 0.1, delay: i * 0.07 }); },
  hop: () => tone(330, 0.12, { slide: 2, vol: 0.25, type: 'triangle' }),
  womp: () => { tone(300, 0.25, { type: 'sawtooth', slide: 0.5, vol: 0.18 }); tone(220, 0.4, { type: 'sawtooth', slide: 0.5, vol: 0.18, delay: 0.25 }); },
  creak: () => tone(70, 1.6, { type: 'sawtooth', slide: 1.8, vol: 0.12 }),
  crack: () => { noise(.06, { vol: .7, from: 5000, to: 1500, q: .5, type: 'highpass' }); tone(190, .14, { type: 'square', slide: .4, vol: .35 }); tone(900, .08, { type: 'triangle', slide: .5, vol: .2 }); },
  cheer: () => { noise(3.4, { vol: .42, from: 450, to: 1700, q: .35 }); noise(3.0, { vol: .3, from: 900, to: 1500, q: .3, delay: .25 }); noise(2.6, { vol: .18, from: 2200, to: 2800, q: .5, delay: .5 }); },
  groan: () => { noise(1.1, { vol: .22, from: 900, to: 280, q: .5 }); noise(.9, { vol: .12, from: 600, to: 220, q: .5, delay: .12 }); },
  charge: () => { [[523.25, 0], [659.25, .14], [783.99, .28], [1046.5, .42], [783.99, .62], [1046.5, .76]].forEach(([f, d]) => tone(f, .22, { type: 'square', vol: .12, delay: d, wet: .2 })); },
  strike: () => { tone(220, .22, { type: 'sawtooth', slide: .6, vol: .2 }); noise(.12, { vol: .3, from: 1500, to: 500 }); },
  swoosh: () => noise(.18, { vol: .3, from: 600, to: 3500, q: .8 }),
  collect: (i = 0) => tone(784 * Math.pow(1.122, i % 6), 0.3, { vol: 0.22, type: 'triangle', wet: .3 }),
};

/** a steady murmur of a big crowd under the game (pass false to fade it out) */
let ambience = null;
export function crowdBed(on) {
  if (!ctx) return;
  if (!on) { if (ambience) { const a = ambience; ambience = null; a.g.gain.setTargetAtTime(0, ctx.currentTime, 0.5); setTimeout(() => { try { a.src.stop(); a.lfo.stop(); } catch { /* already stopped */ } }, 2500); } return; }
  if (ambience) return;
  const len = Math.floor(ctx.sampleRate * 5), buf = ctx.createBuffer(2, len, ctx.sampleRate), fade = Math.floor(ctx.sampleRate * 0.15);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c); let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.11 * Math.min(1, i / fade, (len - i) / fade); }
  }
  const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 620; bp.Q.value = 0.45;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2000;
  const g = ctx.createGain(); g.gain.value = 0;
  const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.12; lg.gain.value = 0.02; lfo.connect(lg); lg.connect(g.gain);
  src.connect(bp); bp.connect(lp); lp.connect(g); g.connect(master);
  g.gain.setTargetAtTime(0.085, ctx.currentTime, 1.2); src.start(); lfo.start(); ambience = { src, g, lfo };
}

// ================= music: a tiny band that plays chord progressions with phrases =================
// chords: root midi note + chord quality; scale: melody notes (midi); drums: 0 none, 1 soft
const MAJ = [0, 4, 7], MIN = [0, 3, 7], MAJ7 = [0, 4, 7, 11], MIN7 = [0, 3, 7, 10], DOM7 = [0, 4, 7, 10];
const PENT = (root) => [0, 2, 4, 7, 9, 12, 14, 16, 19].map((n) => root + n);
const SONGS = {
  beach:  { bpm: 100, swing: .06, chords: [[48, MAJ], [45, MIN], [41, MAJ], [43, MAJ]], scale: PENT(60), lead: 'pluck', drums: 1, pad: .07 },
  board:  { bpm: 116, swing: .08, chords: [[48, MAJ], [43, MAJ], [45, MIN], [41, MAJ]], scale: PENT(67), lead: 'bell', drums: 1, pad: .06 },
  choc:   { bpm: 90,  swing: .12, chords: [[48, MAJ7], [45, MIN7], [50, MIN7], [43, DOM7]], scale: PENT(64), lead: 'bell', drums: 1, pad: .08 },
  fall:   { bpm: 150, swing: 0,   chords: [[45, MIN], [41, MAJ], [48, MAJ], [43, MAJ]], scale: PENT(69), lead: 'pluck', drums: 1, pad: .05, arp: true },
  cat:    { bpm: 84,  swing: 0,   chords: [[48, MAJ], [43, MAJ], [45, MIN], [40, MIN], [41, MAJ], [48, MAJ], [41, MAJ], [43, MAJ]], scale: PENT(72), lead: 'bell', drums: 0, pad: .08 },
  forest: { bpm: 108, swing: .06, chords: [[52, MAJ], [48, MAJ], [45, MIN], [50, MAJ], [52, MAJ], [43, MAJ], [45, MIN], [48, MAJ]], scale: PENT(76), lead: 'bell', drums: 1, pad: .08 },
  ocean: { bpm: 86, swing: .04, chords: [[50, MAJ7], [47, MIN7], [43, MAJ7], [45, DOM7], [50, MAJ7], [47, MIN7], [52, MIN7], [45, DOM7]], scale: PENT(74), lead: 'bell', drums: 0, pad: .1 },
  park: { bpm: 112, swing: .05, chords: [[48, MAJ], [53, MAJ], [55, MAJ], [48, MAJ]], scale: PENT(72), lead: 'pluck', drums: 1, pad: .05 },
  castle: { bpm: 100, swing: 0,   chords: [[48, MAJ], [41, MAJ], [43, MAJ], [48, MAJ]], scale: PENT(60), lead: 'bell', drums: 0, pad: .1 },
};
let cur = null, timer = null, nextT = 0, step = 0, phrase = [], phraseOld = [], lastIdx = 3;

/** opts.fadeIn: seconds to bring the music up from silence (a cross-fade out of the anthem) */
export function playMusic(name, { fadeIn = 0 } = {}) {
  stopMusic();
  if (!ctx || !SONGS[name]) return;
  cur = SONGS[name]; nextT = ctx.currentTime + 0.15; step = 0; lastIdx = 3; phrase = []; phraseOld = [];
  if (fadeIn && musicBus) { const g = musicBus.gain; g.cancelScheduledValues(ctx.currentTime); g.setValueAtTime(0.0001, ctx.currentTime); g.linearRampToValueAtTime(musicLevel, ctx.currentTime + fadeIn); }
  timer = setInterval(schedule, 100);
}
export function stopMusic() { if (timer) clearInterval(timer); timer = null; cur = null; }

function newPhrase(song) {
  const p = []; let idx = lastIdx;
  for (let i = 0; i < 8; i++) {
    if (i === 0 || Math.random() < 0.62) { idx = Math.max(0, Math.min(song.scale.length - 1, idx + Math.floor(Math.random() * 5) - 2)); p.push(idx); } else p.push(null);
  }
  lastIdx = idx; return p;
}

function lead(kind, midi, dur, delay, vol = 0.2) {
  const f = mtof(midi);
  if (kind === 'bell') { tone(f, dur * 1.8, { type: 'sine', vol, delay, out: musicBus, wet: .45, attack: .004 }); tone(f * 2.76, dur * .7, { type: 'sine', vol: vol * .25, delay, out: musicBus, wet: .45, attack: .004 }); tone(f * 5.4, dur * .3, { type: 'sine', vol: vol * .1, delay, out: musicBus, wet: .45, attack: .004 }); }
  else { tone(f, dur * 1.1, { type: 'triangle', vol, delay, out: musicBus, wet: .25, attack: .004 }); tone(f * 2, dur * .5, { type: 'sine', vol: vol * .3, delay, out: musicBus, wet: .25, attack: .004 }); }
}

function schedule() {
  if (!ctx || !cur) return;
  if (nextT < ctx.currentTime - 0.3) nextT = ctx.currentTime + 0.1;   // back from the background: don't fire every missed note at once
  const eighth = 60 / cur.bpm / 2;
  while (nextT < ctx.currentTime + 0.4) {
    const s = step % 8, bar = Math.floor(step / 8);
    const [root, qual] = cur.chords[bar % cur.chords.length];
    const base = Math.max(0, nextT - ctx.currentTime) + (s % 2 ? eighth * cur.swing : 0);
    if (s === 0) {                                              // new bar: pad chord + phrase management
      qual.forEach((n, i) => { tone(mtof(root + 12 + n), eighth * 8.5, { type: 'triangle', vol: cur.pad, attack: .35, delay: base, out: musicBus, wet: .5 }); tone(mtof(root + 12 + n) * 1.004, eighth * 8.5, { type: 'sine', vol: cur.pad * .7, attack: .5, delay: base, out: musicBus, wet: .5 }); });
      if (bar % 2 === 0) { phraseOld = phrase; phrase = newPhrase(cur); } else if (Math.random() < .35) phrase = phraseOld.length ? phraseOld : phrase;
    }
    if (s === 0 || s === 4) tone(mtof(root), eighth * 3.2, { type: 'sine', vol: .45, delay: base, out: musicBus, wet: .05, attack: .01 });   // bass
    if (s === 6) tone(mtof(root + qual[2]), eighth * 1.5, { type: 'sine', vol: .25, delay: base, out: musicBus, wet: .05 });
    if (cur.arp) { const n = qual[s % qual.length] + root + 24 + (s > 3 ? 12 : 0); lead('pluck', n, eighth * .9, base, .1); }
    else if (cur.lead === 'pluck' && (s === 2 || s === 5)) qual.forEach((n, i) => tone(mtof(root + 24 + n), eighth * 1.2, { type: 'triangle', vol: .06, delay: base + i * .012, out: musicBus, wet: .2 }));   // strum
    const p = phrase[s]; if (p != null) lead(cur.lead, cur.scale[p], eighth * 1.6, base, cur.arp ? .12 : .2);
    if (cur.drums) {
      if (s === 0 || s === 4) { tone(130, .16, { slide: .3, vol: .5, delay: base, out: musicBus, wet: 0 }); }
      if (s % 2) noise(.05, { vol: .08, from: 7000, to: 9000, type: 'highpass', q: .5, delay: base, out: musicBus });
      if (s === 2 || s === 6) noise(.1, { vol: .1, from: 2200, to: 1800, q: .6, delay: base, out: musicBus });
    }
    nextT += eighth; step++;
  }
}

// ================= a fixed score (the mermaid finale anthem), scheduled up front through its own volume bus =================
let scoreBus = null;
export function stopScore() { if (scoreBus && ctx) { scoreBus.gain.setTargetAtTime(0, ctx.currentTime, 0.25); } scoreBus = null; }
/** one bar of a score, starting at absolute audio time t */
function scoreBar({ chord: [root, qual], mel }, b, t, eighth, out) {
  const t0 = t - ctx.currentTime;
  qual.forEach((n) => { tone(mtof(root + 12 + n), eighth * 8.6, { type: 'triangle', vol: .075, attack: .3, delay: t0, out, wet: .5 }); tone(mtof(root + 12 + n) * 1.004, eighth * 8.6, { type: 'sine', vol: .05, attack: .4, delay: t0, out, wet: .5 }); });
  for (let s = 0; s < 8; s++) {
    const d = t0 + s * eighth;
    if (s === 0 || s === 4) tone(mtof(root), eighth * 3.4, { type: 'sine', vol: .5, delay: d, out, wet: .05 });
    if (s === 0 || s === 4) tone(130, .16, { slide: .3, vol: .5, delay: d, out, wet: 0 });
    if (s === 2 || s === 6) noise(.12, { vol: .12, from: 2400, to: 1800, q: .6, delay: d, out });
    if (s % 2) noise(.05, { vol: .06, from: 7000, to: 9000, type: 'highpass', q: .5, delay: d, out });
    const m = mel[s];
    if (m != null) { lead('bell', m, eighth * 1.7, d, .24); tone(mtof(m - 12), eighth * 1.2, { type: 'triangle', vol: .08, delay: d, out, wet: .3 }); }
    if (b >= 4 && s % 2 === 0) tone(mtof(root + 36 + qual[(s / 2) % qual.length]), eighth * .8, { type: 'sine', vol: .06, delay: d, out, wet: .5 });   // sparkly arpeggio in the second half
  }
}
/**
 * score = { bpm, bars: [{ chord: [rootMidi, quality], mel: [8 midi notes or null] }] }, played a bar at a time from a
 * 100 ms tick. opts: { loop, onBar(index, audioTime) (called as each bar starts), onEnd() }. Returns { stop(), length }.
 */
export function playScore(score, { loop = false, onBar = null, onEnd = null } = {}) {
  stopMusic(); stopScore();
  if (!ctx) { if (onEnd) setTimeout(onEnd, 0); return { stop() {}, length: 0 }; }
  const bus = scoreBus = ctx.createGain(); bus.gain.value = Math.max(0.5, musicLevel * 1.5); bus.connect(master);
  const eighth = 60 / score.bpm / 2, barLen = eighth * 8, live = () => scoreBus === bus;
  let b = 0, at = ctx.currentTime + 0.15, iv = 0;
  const tick = () => {
    if (!live()) { clearInterval(iv); return; }
    if (at < ctx.currentTime - 0.3) at = ctx.currentTime + 0.1;          // back from the background: skip ahead, don't burst
    while (at < ctx.currentTime + 0.5) {
      if (b >= score.bars.length) {
        if (!loop) { clearInterval(iv); setTimeout(() => live() && onEnd && onEnd(), Math.max(0, (at - ctx.currentTime) * 1000)); return; }
        b = 0;
      }
      scoreBar(score.bars[b], b, at, eighth, bus);
      if (onBar) { const i = b, when = at; setTimeout(() => live() && onBar(i, when), Math.max(0, (when - ctx.currentTime) * 1000)); }
      at += barLen; b++;
    }
  };
  iv = setInterval(tick, 100); tick();
  return { length: score.bars.length * barLen, stop() { clearInterval(iv); if (live()) stopScore(); } };
}
/** play a recorded voice clip at an exact audio time (a word landing on the beat); missing clips are skipped */
export function clipAt(id, when) {
  if (!ctx || !voicesOn || muted) return;
  clipBuffer(id).then((buf) => {
    if (!buf || !ctx) return;
    const s = ctx.createBufferSource(); s.buffer = buf; s.connect(analyser); s.start(Math.max(ctx.currentTime, when));
  });
}
