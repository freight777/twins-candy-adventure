// Builds Sparkle Plinko's sound sprite (public/assets/plinko/sfx.mp3 + its cue map src/plinko/sfx.json) from Kenney's CC0 sound packs — the same
// packs Wishwood uses (Interface Sounds, Impact Sounds, Casino Audio, Music Jingles). Run from the repo root:
//   node tools/plinko-sfx.mjs [path to the unzipped kenney_* folders]   (default: raw-assets/kenney-audio, in this repo)
// Needs ffmpeg (winget install Gyan.FFmpeg, or set FFMPEG). Swap a sound by changing its line in CUES.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve('.');
const KENNEY = path.resolve(process.argv[2] || path.join(ROOT, 'raw-assets/kenney-audio'));
const OUT = path.join(ROOT, 'public/assets/plinko'), TMP = path.join(ROOT, 'tools/.cache/plinko-sfx');
const RATE = 44100, GAP = 0.2;

/** cue -> [pack, file name without .ogg, loudness (LUFS)] */
const CUES = {
  peg0: ['impact-sounds', 'impactGlass_light_000', -22], peg1: ['impact-sounds', 'impactGlass_light_001', -22], peg2: ['impact-sounds', 'impactGlass_light_002', -22],
  bump0: ['impact-sounds', 'impactBell_heavy_000', -18], bump1: ['impact-sounds', 'impactBell_heavy_001', -18], bump2: ['impact-sounds', 'impactBell_heavy_002', -18],
  wall: ['impact-sounds', 'impactSoft_medium_001', -22],
  thunk: ['impact-sounds', 'impactPlate_light_002', -18],
  tick: ['interface-sounds', 'tick_002', -20],
  gem: ['interface-sounds', 'glass_002', -17], pop: ['interface-sounds', 'pluck_002', -16], drop: ['interface-sounds', 'drop_002', -17],
  power: ['interface-sounds', 'maximize_008', -16], bonus: ['interface-sounds', 'confirmation_004', -16],
  coins: ['casino-audio', 'chips-stack-3', -16], coin: ['casino-audio', 'chip-lay-1', -18], chips: ['casino-audio', 'chips-collide-2', -18],
  // jingles: pizzicato for the unicorns, steel drum for the lagoon
  jUniWin: ['music-jingles', 'jingles_PIZZI07', -16], jUniMulti: ['music-jingles', 'jingles_PIZZI03', -16], jUniEnd: ['music-jingles', 'jingles_PIZZI10', -16],
  jSeaWin: ['music-jingles', 'jingles_STEEL07', -16], jSeaMulti: ['music-jingles', 'jingles_STEEL03', -16], jSeaEnd: ['music-jingles', 'jingles_STEEL14', -16],
};

function ffmpeg() {
  if (process.env.FFMPEG && fs.existsSync(process.env.FFMPEG)) return process.env.FFMPEG;
  if (spawnSync('ffmpeg', ['-version']).status === 0) return 'ffmpeg';
  const pkgs = path.resolve(process.env.LOCALAPPDATA ?? '', 'Microsoft/WinGet/Packages');
  for (const d of fs.existsSync(pkgs) ? fs.readdirSync(pkgs).filter((n) => n.startsWith('Gyan.FFmpeg')) : []) {
    for (const v of fs.readdirSync(path.join(pkgs, d))) { const exe = path.join(pkgs, d, v, 'bin', 'ffmpeg.exe'); if (fs.existsSync(exe)) return exe; }
  }
  throw new Error('ffmpeg not found: winget install Gyan.FFmpeg (or set FFMPEG)');
}
function find(pack, name) {
  const stack = [path.join(KENNEY, `kenney_${pack}`)];
  while (stack.length) {
    const dir = stack.pop();
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) stack.push(path.join(dir, e.name)); else if (e.name === `${name}.ogg`) return path.join(dir, e.name);
    }
  }
  throw new Error(`no ${name}.ogg in ${pack}`);
}
const FF = ffmpeg();
const run = (args) => { const r = spawnSync(FF, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8' }); if (r.status !== 0) throw new Error(r.stderr); };

fs.rmSync(TMP, { recursive: true, force: true }); fs.mkdirSync(TMP, { recursive: true }); fs.mkdirSync(OUT, { recursive: true });
const pcm = [], map = {};
let t = 0;
for (const [cue, [pack, name, lufs]] of Object.entries(CUES)) {
  const raw = path.join(TMP, `${cue}.raw`);
  run(['-i', find(pack, name), '-af', `loudnorm=I=${lufs}:TP=-1.5:LRA=11`, '-ar', String(RATE), '-ac', '1', '-f', 's16le', raw]);
  const clip = fs.readFileSync(raw), dur = clip.length / 2 / RATE;
  map[cue] = [+t.toFixed(4), +dur.toFixed(4)];
  pcm.push(clip, Buffer.alloc(Math.round(GAP * RATE) * 2));
  t += dur + GAP;
  console.log(cue.padEnd(10), name.padEnd(24), dur.toFixed(2) + ' s');
}
const all = path.join(TMP, 'all.raw'); fs.writeFileSync(all, Buffer.concat(pcm));
run(['-f', 's16le', '-ar', String(RATE), '-ac', '1', '-i', all, '-c:a', 'libmp3lame', '-b:a', '96k', path.join(OUT, 'sfx.mp3')]);
fs.writeFileSync(path.join(ROOT, 'src/plinko/sfx.json'), JSON.stringify(map));
console.log(`sprite: ${t.toFixed(1)} s, ${(fs.statSync(path.join(OUT, 'sfx.mp3')).size / 1024).toFixed(0)} KB`);
