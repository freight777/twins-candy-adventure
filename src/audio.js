// All sound is synthesized here (no audio files). Effects + a small generative band per scene.
// Real voice-over (v2) will be recordings played through the same unlock/master chain.
let ctx = null, master = null, musicBus = null, reverbIn = null, muted = false, musicLevel = 0.5;

export function unlock() {
  if (!ctx) {
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
  }
  if (ctx.state !== 'running') ctx.resume();
}
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

function noise(dur = 0.4, { vol = 0.3, from = 1500, to = 1500, q = 0.8, type = 'bandpass', delay = 0, out } = {}) {
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
  src.connect(f); f.connect(g); g.connect(out || master);
  src.start(t0);
}

export const sfx = {
  pop: () => { tone(500, 0.12, { slide: 2.2, vol: 0.25 }); },
  ting: () => { tone(1568, 0.6, { vol: 0.15, wet: .4 }); tone(2093, 0.7, { vol: 0.08, delay: 0.05, wet: .4 }); },
  note: (i = 0) => { const f = PENTA[i % PENTA.length]; tone(f, 0.6, { type: 'triangle', vol: 0.3, wet: .35 }); tone(f * 2.005, 0.5, { vol: 0.07, wet: .4 }); },
  sparkle: () => PENTA.forEach((f, i) => tone(f * 2, 0.45, { delay: i * 0.06, vol: 0.12, wet: .4 })),
  chime: () => { tone(880, 0.35, { vol: 0.2, wet: .35 }); tone(1318.5, 0.6, { vol: 0.2, delay: 0.08, wet: .4 }); },
  boing: () => { tone(180, 0.35, { type: 'sine', slide: 3.2, vol: 0.35 }); tone(360, 0.3, { slide: 2.2, vol: 0.1, delay: .02 }); },
  bonk: () => { tone(220, 0.18, { slide: 0.4, vol: 0.4 }); noise(0.08, { vol: 0.15, from: 900, to: 300 }); },
  splash: () => { noise(0.7, { vol: 0.35, from: 3000, to: 600, q: 0.6 }); tone(300, 0.2, { slide: 0.5, vol: 0.1 }); },
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
  collect: (i = 0) => tone(784 * Math.pow(1.122, i % 6), 0.3, { vol: 0.22, type: 'triangle', wet: .3 }),
};

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
  castle: { bpm: 100, swing: 0,   chords: [[48, MAJ], [41, MAJ], [43, MAJ], [48, MAJ]], scale: PENT(60), lead: 'bell', drums: 0, pad: .1 },
};
let cur = null, timer = null, nextT = 0, step = 0, phrase = [], phraseOld = [], lastIdx = 3;

export function playMusic(name) {
  stopMusic();
  if (!ctx || !SONGS[name]) return;
  cur = SONGS[name]; nextT = ctx.currentTime + 0.15; step = 0; lastIdx = 3; phrase = []; phraseOld = [];
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
