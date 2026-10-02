// All sound is synthesized here (no audio files yet). Placeholder music + effects; real voice-over comes in v2.
let ctx = null, master = null, musicBus = null;

export function unlock() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.7; master.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.32; musicBus.connect(master);
  }
  if (ctx.state !== 'running') ctx.resume();
}

const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];

function tone(freq, dur = 0.3, { type = 'sine', vol = 0.25, slide = 0, delay = 0, attack = 0.01, out } = {}) {
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
  o.start(t0); o.stop(t0 + attack + dur + 0.05);
}

function noise(dur = 0.4, { vol = 0.3, from = 1500, to = 1500, q = 0.8, type = 'bandpass', delay = 0 } = {}) {
  if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(from, t0); f.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + dur * 0.2); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t0);
}

export const sfx = {
  pop: () => { tone(500, 0.12, { slide: 2.2, vol: 0.25 }); },
  ting: () => { tone(1568, 0.5, { vol: 0.15 }); tone(2093, 0.6, { vol: 0.08, delay: 0.05 }); },
  note: (i = 0) => { tone(PENTA[i % PENTA.length], 0.5, { type: 'triangle', vol: 0.3 }); tone(PENTA[i % PENTA.length] * 2, 0.4, { vol: 0.06 }); },
  sparkle: () => PENTA.forEach((f, i) => tone(f * 2, 0.35, { delay: i * 0.06, vol: 0.12 })),
  chime: () => { tone(880, 0.3, { vol: 0.2 }); tone(1318.5, 0.5, { vol: 0.2, delay: 0.08 }); },
  boing: () => tone(180, 0.35, { type: 'sine', slide: 3.2, vol: 0.35 }),
  bonk: () => { tone(220, 0.18, { slide: 0.4, vol: 0.4 }); noise(0.08, { vol: 0.15, from: 900, to: 300 }); },
  splash: () => { noise(0.6, { vol: 0.35, from: 3000, to: 600, q: 0.6 }); tone(300, 0.2, { slide: 0.5, vol: 0.1 }); },
  whoosh: (d = 1.2) => noise(d, { vol: 0.35, from: 300, to: 3000, q: 1.2 }),
  squeak: () => { tone(1500, 0.08, { slide: 0.7, vol: 0.2 }); tone(1900, 0.1, { slide: 0.6, vol: 0.2, delay: 0.1 }); },
  squawk: () => { tone(700, 0.18, { type: 'sawtooth', slide: 0.5, vol: 0.12 }); tone(800, 0.2, { type: 'sawtooth', slide: 0.45, vol: 0.12, delay: 0.2 }); },
  meow: () => { tone(520, 0.45, { type: 'triangle', slide: 1.0, vol: 0.25 }); tone(780, 0.3, { type: 'triangle', slide: 0.55, vol: 0.2, delay: 0.15 }); },
  giggle: () => { for (let i = 0; i < 6; i++) tone(700 + Math.random() * 350, 0.07, { vol: 0.14, delay: i * 0.085, slide: 1.3 }); },
  babble: (n = 6) => { for (let i = 0; i < n; i++) tone(320 + Math.random() * 360, 0.07, { type: 'triangle', vol: 0.16, delay: i * 0.1 }); },
  tada: () => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.5, { type: 'triangle', vol: 0.25, delay: i * 0.1 })),
  magic: () => { PENTA.concat(PENTA.map((f) => f * 2)).forEach((f, i) => tone(f, 0.4, { delay: i * 0.07, vol: 0.14, type: i % 2 ? 'sine' : 'triangle' })); },
  creak: () => tone(70, 1.6, { type: 'sawtooth', slide: 1.8, vol: 0.12 }),
  collect: (i = 0) => tone(784 * Math.pow(1.122, i % 6), 0.25, { vol: 0.22, type: 'triangle' }),
};

// ---------- simple generative background music ----------
const SONGS = {
  beach: { scale: [261.6, 293.7, 329.6, 392, 440, 523.3, 587.3, 659.3], bass: [130.8, 196, 174.6, 196], bpm: 104, type: 'triangle' },
  fall: { scale: [329.6, 392, 440, 493.9, 587.3, 659.3, 784], bass: [164.8, 196, 220, 196], bpm: 152, type: 'square' },
  cat: { scale: [392, 440, 493.9, 587.3, 659.3, 784, 880, 987.8], bass: [196, 246.9, 220, 293.7], bpm: 90, type: 'sine' },
  choc: { scale: [329.6, 392, 440, 523.3, 587.3, 659.3], bass: [164.8, 130.8, 174.6, 196], bpm: 84, type: 'triangle' },
};
let cur = null, timer = null, nextT = 0, step = 0, idx = 3;

export function playMusic(name) {
  stopMusic();
  if (!ctx || !SONGS[name]) return;
  cur = SONGS[name]; nextT = ctx.currentTime + 0.1; step = 0; idx = 3;
  timer = setInterval(schedule, 120);
}
export function stopMusic() { if (timer) clearInterval(timer); timer = null; cur = null; }

function schedule() {
  if (!ctx || !cur) return;
  const eighth = 60 / cur.bpm / 2;
  while (nextT < ctx.currentTime + 0.35) {
    const delay = Math.max(0, nextT - ctx.currentTime);
    if (step % 8 === 0) tone(cur.bass[(step / 8) % cur.bass.length], eighth * 6, { type: 'sine', vol: 0.5, delay, out: musicBus });
    if (step % 4 === 2) tone(cur.bass[(step / 8 | 0) % cur.bass.length] * 2, eighth * 1.5, { type: 'triangle', vol: 0.18, delay, out: musicBus });
    if (Math.random() < 0.7) {
      idx = Math.max(0, Math.min(cur.scale.length - 1, idx + Math.floor(Math.random() * 5) - 2));
      tone(cur.scale[idx], eighth * 1.8, { type: cur.type, vol: 0.22, delay, out: musicBus, attack: 0.005 });
    }
    nextT += eighth; step++;
  }
}
