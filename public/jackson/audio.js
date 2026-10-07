/* Sound engine: real recordings (mp3) where we have them, WebAudio synthesis for the rest.
   Optional: drop your own recordings in sounds/ named voice-<vehicle>.mp3 (e.g. voice-bus.mp3 = "Beep beep!")
   and they play right after the vehicle's own sound. */

const Sound = (() => {
  let ctx = null, master = null, noiseBuf = null;
  const buffers = {}, playing = {};
  const FILES = ['trainhorn', 'siren', 'helicopter', 'chug'];
  const VOICES = ['dump', 'fire', 'bus', 'train', 'heli', 'plane', 'garbage', 'tractor', 'jackson'];

  function unlock() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // iOS needs a sound started inside the first tap
    const o = ctx.createOscillator(), g = ctx.createGain(); g.gain.value = 0.0001;
    o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.05);
    FILES.forEach(n => load(n, `sounds/${n}.mp3?v=2`));
    VOICES.forEach(n => load('voice-' + n, `sounds/voice-${n}.mp3?v=2`, true));
  }

  function load(name, url, quiet) {
    fetch(url).then(r => r.ok ? r.arrayBuffer() : Promise.reject())
      .then(ab => new Promise((res, rej) => ctx.decodeAudioData(ab, res, rej)))
      .then(b => { buffers[name] = b; })
      .catch(() => { if (!quiet) console.warn('missing sound', name); });
  }

  const now = () => ctx.currentTime;

  // play a recording; replaces any earlier play of the same group
  function sample(name, { gain = 1, rate = 1, offset = 0, dur = 0, when = 0, group = name } = {}) {
    if (!ctx || !buffers[name]) return false;
    stopGroup(group);
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = buffers[name]; src.playbackRate.value = rate;
    g.gain.value = gain;
    src.connect(g); g.connect(master);
    const t = now() + when;
    src.start(t, offset, dur || undefined);
    playing[group] = { src, g };
    src.onended = () => { if (playing[group] && playing[group].src === src) delete playing[group]; };
    return true;
  }
  function stopGroup(group) {
    const p = playing[group]; if (!p) return;
    try { p.g.gain.setTargetAtTime(0, now(), 0.03); p.src.stop(now() + 0.15); } catch (e) {}
    delete playing[group];
  }
  function stopAll() { Object.keys(playing).forEach(stopGroup); }

  // ---- synth building blocks ----
  function tone({ f = 440, f2 = null, type = 'sine', t = 0, dur = 0.2, gain = 0.3, lp = 0, a = 0.015, r = 0.06, vib = 0 }) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; const t0 = now() + t;
    o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    if (vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = vib; lg.gain.value = f * 0.02; l.connect(lg); lg.connect(o.frequency); l.start(t0); l.stop(t0 + dur + r); }
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + a);
    g.gain.setValueAtTime(gain, t0 + Math.max(a, dur - r));
    g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    let out = o;
    if (lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; o.connect(f); out = f; }
    out.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function noise({ t = 0, dur = 0.5, gain = 0.3, type = 'bandpass', f = 1000, f2 = null, q = 1, a = 0.05, r = 0.2 }) {
    const s = ctx.createBufferSource(), flt = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; s.loop = true;
    flt.type = type; flt.Q.value = q;
    const t0 = now() + t;
    flt.frequency.setValueAtTime(f, t0);
    if (f2) flt.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + a);
    g.gain.setValueAtTime(gain, t0 + Math.max(a, dur - r));
    g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    s.connect(flt); flt.connect(g); g.connect(master);
    s.start(t0); s.stop(t0 + dur + 0.05);
  }
  const honk = (freqs, t, dur, gain = 0.16, lp = 1400) => freqs.forEach(f => tone({ f, type: 'sawtooth', t, dur, gain, lp, a: 0.02, r: 0.05 }));

  // ---- the sounds ----
  const synth = {
    // beep-beep-beep-beep backing up, then a rumble
    dump() {
      for (let i = 0; i < 4; i++) tone({ f: 1000, type: 'square', t: i * 0.26, dur: 0.14, gain: 0.07, lp: 2400, a: 0.005, r: 0.01 });
      tone({ f: 48, f2: 78, type: 'sawtooth', t: 0, dur: 1.3, gain: 0.22, lp: 180, vib: 14 });
    },
    // classic bus horn: beep beep!
    bus() {
      honk([392, 494], 0, 0.22); honk([392, 494], 0.3, 0.38);
    },
    // deep honk, hydraulic hiss, clunk
    garbage() {
      honk([110, 139], 0, 0.55, 0.22, 700);
      noise({ t: 0.6, dur: 0.6, gain: 0.16, type: 'highpass', f: 3500, q: 0.7, a: 0.03, r: 0.4 });
      tone({ f: 130, f2: 45, type: 'sine', t: 1.25, dur: 0.22, gain: 0.5, a: 0.004, r: 0.12 });
    },
    // putt-putt-putt, then toot toot
    tractor() {
      for (let i = 0; i < 9; i++) tone({ f: 82 - (i % 2) * 8, type: 'square', t: i * 0.115, dur: 0.07, gain: 0.2, lp: 320, a: 0.004, r: 0.04 });
      honk([330, 415], 1.1, 0.16, 0.13, 1100); honk([330, 415], 1.35, 0.3, 0.13, 1100);
    },
    // zoooom
    plane() {
      noise({ t: 0, dur: 2.2, gain: 0.34, type: 'bandpass', f: 250, f2: 2200, q: 0.9, a: 0.5, r: 1.0 });
      tone({ f: 85, f2: 130, type: 'sawtooth', t: 0, dur: 2.0, gain: 0.1, lp: 400, vib: 38 });
    },
    // quick friendly "pop"
    pop() { tone({ f: 700, f2: 220, t: 0, dur: 0.13, gain: 0.3, a: 0.003, r: 0.08 }); },
    // happy giggle-ish chime for Jackson's photo
    giggle() { [660, 784, 988, 1175, 1319].forEach((f, i) => tone({ f, type: 'triangle', t: i * 0.075, dur: 0.16, gain: 0.22 })); },
    whoosh() { noise({ t: 0, dur: 0.4, gain: 0.18, type: 'bandpass', f: 400, f2: 3000, q: 1.2, a: 0.1, r: 0.2 }); },
    fanfare() { [523, 659, 784, 1047].forEach((f, i) => tone({ f, type: 'triangle', t: i * 0.13, dur: 0.3, gain: 0.24 })); tone({ f: 1047, type: 'triangle', t: 0.52, dur: 0.7, gain: 0.24 }); },
  };

  // what each vehicle does when poked
  const vehicle = {
    dump: () => synth.dump(),
    bus: () => synth.bus(),
    garbage: () => synth.garbage(),
    tractor: () => synth.tractor(),
    plane: () => synth.plane(),
    fire: () => sample('siren', { gain: 0.75, rate: 1 + (Math.random() - .5) * 0.04 }),
    heli: () => sample('helicopter', { gain: 0.9 }),
    train: () => sample('trainhorn', { gain: 0.8, rate: 1 + (Math.random() - .5) * 0.03 }),
  };
  // fallbacks if a recording fails to load
  const fallback = {
    fire() { for (let i = 0; i < 3; i++) { tone({ f: 700, f2: 1000, type: 'sawtooth', t: i * 0.9, dur: 0.45, gain: 0.1, lp: 1800 }); tone({ f: 1000, f2: 700, type: 'sawtooth', t: i * 0.9 + 0.45, dur: 0.45, gain: 0.1, lp: 1800 }); } },
    heli() { for (let i = 0; i < 30; i++) noise({ t: i * 0.085, dur: 0.07, gain: 0.35, type: 'lowpass', f: 300, a: 0.01, r: 0.04 }); },
    train() { honk([196, 247, 294], 0, 0.9, 0.12, 900); },
  };

  function poke(id) {
    if (!ctx) return;
    if (vehicle[id]) {
      const ok = vehicle[id]();
      if (ok === false && fallback[id]) fallback[id]();
    }
  }
  function enter(id) {
    poke(id);
    if (id === 'train') sample('chug', { gain: 0.45, when: 1.2, group: 'chug' });
    sample('voice-' + id, { gain: 1, when: id === 'train' ? 0.1 : 0.7, group: 'voice' });
  }
  function fx(name) { if (ctx && synth[name]) synth[name](); }
  function voice(id) { return sample('voice-' + id, { gain: 1, group: 'voice' }); }

  return { unlock, poke, enter, fx, voice, stopAll };
})();
