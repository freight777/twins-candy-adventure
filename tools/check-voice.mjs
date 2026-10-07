// Voice-bank coverage check (runs before every build: npm run build -> prebuild). Fails the build when
//   1. a line in src/engine/lines.js has no recording in public/voice/ (run: node tools/voice-bank.mjs), or
//   2. the code asks for a clip id that isn't a line at all: voice('typo') would quietly fall back to the device voice, or
//   3. say('Some sentence', 'who') is used with a sentence that isn't in the bank (add it as a line, or use voice()).
// Ids built at run time (voice(`n_${k}`)) can't be checked here; the line tables that make them are covered by rule 1.
import fs from 'node:fs';
import path from 'node:path';
import { LINES, storyId } from '../src/engine/lines.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const clips = new Set(fs.readdirSync(path.join(ROOT, 'public/voice')).filter((f) => f.endsWith('.mp3')).map((f) => f.slice(0, -4)));
const problems = [];
for (const id of Object.keys(LINES)) if (!clips.has(id)) problems.push(`no recording for line "${id}"`);

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.js') ? [path.join(d, e.name)] : []));
for (const f of walk(path.join(ROOT, 'src'))) {
  const src = fs.readFileSync(f, 'utf8'), rel = path.relative(ROOT, f);
  for (const m of src.matchAll(/\bvoice\(\s*(\[[^\]]*\]|'[^']*')/g)) {
    for (const [, id] of m[1].matchAll(/'([^']*)'/g)) if (/^[a-z0-9_]+$/.test(id) && !LINES[id]) problems.push(`${rel}: voice('${id}') is not a line`);
  }
  for (const m of src.matchAll(/\bsay(?:Async)?\(\s*'((?:[^'\\]|\\.)*)'\s*,\s*'([a-z]+)'/g)) {
    const text = m[1].replace(/\\'/g, "'"), id = storyId(m[2], text);
    if (!LINES[id]) problems.push(`${rel}: say('${text}', '${m[2]}') is not in the voice bank`);
  }
}
if (problems.length) { console.error(`voice check: ${problems.length} problem(s)\n  ` + problems.join('\n  ')); process.exit(1); }
console.log(`voice check: ${Object.keys(LINES).length} lines, all recorded and every literal id known`);
