// Builds the sound sprites for Sparkle Match and Puzzle Shelf from Kenney's CC0 packs (Interface Sounds, Impact Sounds, Casino Audio,
// Music Jingles, RPG Audio — the same packs as Sparkle Plinko): one mp3 per game plus its cue map.
//   node tools/game-sfx.mjs [path to the unzipped kenney_* folders]     (default: ../Wishwood/art/audio/kenney)
// Needs ffmpeg (winget install Gyan.FFmpeg, or set FFMPEG). Swap a sound by changing its line below. The games play each cue at
// three slightly different pitches, and Sparkle Match climbs a pentatonic scale on chain reactions, so tonal sounds work best.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const KENNEY = path.resolve(process.argv[2] || path.join(ROOT, '../Wishwood/art/audio/kenney'));
const RATE = 44100, GAP = 0.15;

/** game → { out: [mp3, json], cues: { cue: [pack, file, loudness LUFS] } } — soft and short: a parent in the next room is not annoyed */
const GAMES = {
  match: {
    out: ['public/assets/match/sfx.mp3', 'src/match/sfx.json'],
    cues: {
      pop: ['interface-sounds', 'pluck_002', -19], pop2: ['interface-sounds', 'pluck_001', -19],
      boop: ['impact-sounds', 'impactSoft_medium_001', -22], tick: ['interface-sounds', 'tick_002', -22],
      line: ['interface-sounds', 'maximize_008', -20], burst: ['impact-sounds', 'impactSoft_heavy_001', -19],
      magic: ['interface-sounds', 'glass_004', -19], streak: ['interface-sounds', 'glass_002', -24], made: ['interface-sounds', 'maximize_004', -20],
      shuffle: ['casino-audio', 'card-shuffle', -21], gift: ['interface-sounds', 'glass_006', -19], home: ['interface-sounds', 'confirmation_001', -19],
      done: ['interface-sounds', 'confirmation_004', -19], hint: ['interface-sounds', 'question_001', -24],
      jUniCheer: ['music-jingles', 'jingles_PIZZI03', -20], jUniWin: ['music-jingles', 'jingles_PIZZI07', -18], jUniHelp: ['music-jingles', 'jingles_PIZZI01', -20],
      jSeaCheer: ['music-jingles', 'jingles_STEEL03', -20], jSeaWin: ['music-jingles', 'jingles_STEEL07', -18], jSeaHelp: ['music-jingles', 'jingles_STEEL01', -20],
    },
  },
  shelf: {
    out: ['public/assets/shelf/sfx.mp3', 'src/shelf/sfx.json'],
    cues: {
      turn: ['rpg-audio', 'bookFlip2', -21], open: ['rpg-audio', 'bookOpen', -21], tap: ['interface-sounds', 'click_002', -24],
      star: ['interface-sounds', 'pluck_002', -19], stamp: ['rpg-audio', 'bookPlace2', -18], hint: ['interface-sounds', 'question_001', -23],
      wobble: ['impact-sounds', 'impactSoft_medium_001', -24], done: ['music-jingles', 'jingles_PIZZI07', -19],
    },
  },
};

function ffmpeg() {
  if (process.env.FFMPEG && fs.existsSync(process.env.FFMPEG)) return process.env.FFMPEG;
  if (spawnSync('ffmpeg', ['-version']).status === 0) return 'ffmpeg';
  const pkgs = path.resolve(process.env.LOCALAPPDATA ?? '', 'Microsoft/WinGet/Packages');
  for (const d of fs.existsSync(pkgs) ? fs.readdirSync(pkgs).filter((n) => n.startsWith('Gyan.FFmpeg')) : [])
    for (const v of fs.readdirSync(path.join(pkgs, d))) { const exe = path.join(pkgs, d, v, 'bin', 'ffmpeg.exe'); if (fs.existsSync(exe)) return exe; }
  throw new Error('ffmpeg not found: winget install Gyan.FFmpeg (or set FFMPEG)');
}
function find(pack, name) {
  const stack = [path.join(KENNEY, `kenney_${pack}`)];
  while (stack.length) {
    const dir = stack.pop();
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) { if (e.isDirectory()) stack.push(path.join(dir, e.name)); else if (e.name === `${name}.ogg`) return path.join(dir, e.name); }
  }
  throw new Error(`no ${name}.ogg in ${pack}`);
}
const FF = ffmpeg();
const run = (args) => { const r = spawnSync(FF, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8' }); if (r.status !== 0) throw new Error(r.stderr); };

for (const [game, { out: [mp3, json], cues }] of Object.entries(GAMES)) {
  const tmp = path.join(ROOT, 'tools/.cache/sfx-' + game);
  fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp, { recursive: true }); fs.mkdirSync(path.dirname(path.join(ROOT, mp3)), { recursive: true });
  const pcm = [], map = {}; let t = 0;
  for (const [cue, [pack, name, lufs]] of Object.entries(cues)) {
    const raw = path.join(tmp, `${cue}.raw`);
    run(['-i', find(pack, name), '-af', `loudnorm=I=${lufs}:TP=-1.5:LRA=11`, '-ar', String(RATE), '-ac', '1', '-f', 's16le', raw]);
    const clip = fs.readFileSync(raw), dur = clip.length / 2 / RATE;
    map[cue] = [+t.toFixed(4), +dur.toFixed(4)]; pcm.push(clip, Buffer.alloc(Math.round(GAP * RATE) * 2)); t += dur + GAP;
  }
  const all = path.join(tmp, 'all.raw'); fs.writeFileSync(all, Buffer.concat(pcm));
  run(['-f', 's16le', '-ar', String(RATE), '-ac', '1', '-i', all, '-codec:a', 'libmp3lame', '-b:a', '64k', path.join(ROOT, mp3)]);
  fs.writeFileSync(path.join(ROOT, json), JSON.stringify(map));
  console.log(`${game}: ${Object.keys(map).length} sounds, ${t.toFixed(1)} s, ${Math.round(fs.statSync(path.join(ROOT, mp3)).size / 1024)} KB`);
}
