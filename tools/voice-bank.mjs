// Renders every line in src/engine/lines.js that has no clip yet into public/voice/<id>.mp3 with Kokoro-82M
// (Apache-2.0 code and weights; runs on this computer only). Run from the repo root:
//   node tools/voice-bank.mjs            render what's missing
//   node tools/voice-bank.mjs --only snd_ --force    re-render the ids starting with snd_
//   node tools/voice-bank.mjs --prune    also delete clips no line uses any more
// Needs: cd tools && npm install   (kokoro-js, ffmpeg-static). The ~90 MB model downloads once into the local cache.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { LINES, VOICES } from '../src/engine/lines.js';
const require = createRequire(import.meta.url);
const { KokoroTTS } = await import('kokoro-js');
const ffmpeg = require('ffmpeg-static');

const args = process.argv.slice(2), opt = (k) => { const i = args.indexOf(k); return i < 0 ? null : args[i + 1] ?? true; };
const OUT = path.resolve('public/voice'), TMP = path.resolve('tools/.cache'); fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(TMP, { recursive: true });
const only = opt('--only'), force = !!opt('--force'), prune = !!opt('--prune');
const todo = Object.entries(LINES).filter(([id]) => (!only || id.startsWith(only)) && (force || !fs.existsSync(path.join(OUT, `${id}.mp3`))));
if (prune) {
  for (const f of fs.readdirSync(OUT)) if (f.endsWith('.mp3') && !LINES[f.slice(0, -4)]) { fs.unlinkSync(path.join(OUT, f)); console.log('pruned', f); }
}
console.log(`${todo.length} of ${Object.keys(LINES).length} lines to render`);
if (!todo.length) process.exit(0);

const tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: 'q8', device: 'cpu' });
const SR = 24000;

/** cut leading/trailing silence (keeps a breath of air), optionally keep only the first maxMs of sound, then level the loudness */
function shape(x, maxMs) {
  let peak = 0; for (let i = 0; i < x.length; i++) peak = Math.max(peak, Math.abs(x[i]));
  if (peak < 1e-4) return x;
  const thr = Math.max(peak * 0.02, 0.003), win = Math.round(SR * 0.01);
  const loud = (i) => { let m = 0; for (let k = i; k < Math.min(x.length, i + win); k++) m = Math.max(m, Math.abs(x[k])); return m > thr; };
  let a = 0; while (a < x.length && !loud(a)) a += win;
  let b = x.length - win; while (b > a && !loud(b)) b -= win;
  a = Math.max(0, a - Math.round(SR * 0.03)); b = Math.min(x.length, b + win + Math.round(SR * 0.06));
  if (maxMs) b = Math.min(b, a + Math.round(SR * (maxMs / 1000 + 0.03)));
  const y = x.slice(a, b), fade = Math.min(y.length >> 2, Math.round(SR * (maxMs ? 0.05 : 0.02)));
  for (let i = 0; i < fade; i++) y[y.length - 1 - i] *= i / fade;                    // soft tail, no click
  for (let i = 0; i < Math.min(fade, 120); i++) y[i] *= i / 120;
  // loudness: bring the speech RMS to a common level, never past -1 dBFS peak
  let s2 = 0, n = 0; for (let i = 0; i < y.length; i++) if (Math.abs(y[i]) > thr) { s2 += y[i] * y[i]; n++; }
  const rms = Math.sqrt(s2 / Math.max(1, n)); let p2 = 0; for (let i = 0; i < y.length; i++) p2 = Math.max(p2, Math.abs(y[i]));
  const g = Math.min(0.12 / Math.max(rms, 1e-4), 0.89 / p2);
  for (let i = 0; i < y.length; i++) y[i] *= g;
  return y;
}
function wav(file, y) {
  const b = Buffer.alloc(44 + y.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + y.length * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(y.length * 2, 40);
  for (let i = 0; i < y.length; i++) b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(y[i] * 32767))), 44 + i * 2);
  fs.writeFileSync(file, b);
}

let done = 0, bytes = 0; const t0 = Date.now();
for (const [id, line] of todo) {
  const [voice, speed] = VOICES[line.voice || line.who] || VOICES.narrator;
  let audio;
  if (line.ipa) { const { input_ids } = tts.tokenizer(line.ipa, { truncation: true }); audio = await tts.generate_from_ids(input_ids, { voice, speed: line.speed ?? speed }); }
  else audio = await tts.generate(line.text.length < 6 ? `${line.text},` : line.text, { voice, speed: line.speed ?? speed });   // very short inputs get swallowed without a little pause after them
  const y = shape(Float32Array.from(audio.audio), line.maxMs);
  const tmp = path.join(TMP, 'clip.wav'), out = path.join(OUT, `${id}.mp3`);
  wav(tmp, y);
  execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', tmp, '-ac', '1', '-ar', String(SR), '-codec:a', 'libmp3lame', '-b:a', '40k', out]);
  done++; bytes += fs.statSync(out).size;
  if (done % 20 === 0 || done === todo.length) console.log(`${done}/${todo.length}  ${(bytes / 1024).toFixed(0)} KB  ${((Date.now() - t0) / 1000).toFixed(0)} s  (last: ${id} "${line.text}" ${(y.length / SR).toFixed(2)} s)`);
}
