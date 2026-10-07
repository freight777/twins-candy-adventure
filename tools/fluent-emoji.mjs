// Fetches Microsoft's Fluent Emoji 3D pictures (MIT, github.com/microsoft/fluentui-emoji) for every emoji the games use and
// saves them as small WebP files in public/emoji/<codepoints>.webp, plus src/engine/fluent-list.json (which ones exist).
// The games then show the same picture on every iPad instead of whatever emoji font the system has. Run from the repo root:
//   node tools/fluent-emoji.mjs          (needs: cd tools && npm install  — uses sharp)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require('sharp');

const ROOT = path.resolve('.'), OUT = path.join(ROOT, 'public/emoji'), CACHE = path.join(ROOT, 'tools/.cache/fluent');
fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(CACHE, { recursive: true });
const RAW = 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/';
export const keyOf = (s) => [...s].map((c) => c.codePointAt(0)).filter((c) => c !== 0xfe0f).map((c) => c.toString(16)).join('-');

// 1. every emoji in the source (JS escapes and HTML entities decoded first)
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : /\.(js|html)$/.test(e.name) ? [path.join(d, e.name)] : []));
const files = [...walk(path.join(ROOT, 'src')), ...fs.readdirSync(ROOT).filter((f) => f.endsWith('.html')).map((f) => path.join(ROOT, f))];
const EMOJI = /\p{Extended_Pictographic}(️|‍\p{Extended_Pictographic}️?|[\u{1F3FB}-\u{1F3FF}])*|[♀♂]️?/gu;
const want = new Map();
for (const f of files) {
  let s = fs.readFileSync(f, 'utf8');
  s = s.replace(/\\u\{([0-9a-fA-F]+)\}/g, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)));
  for (const m of s.matchAll(EMOJI)) { const e = m[0]; if (/^[♀♂]/.test(e)) continue; want.set(keyOf(e), e); }
}
console.log(`${want.size} emoji used`);

// 2. which Fluent folder holds each one (the metadata's "unicode" field), cached
const tree = await (await fetch('https://api.github.com/repos/microsoft/fluentui-emoji/git/trees/main?recursive=1')).json();
const paths = tree.tree.map((t) => t.path);
const metaFile = path.join(CACHE, 'meta.json');
let meta = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile, 'utf8')) : {};
const folders = paths.filter((p) => /^assets\/[^/]+\/metadata\.json$/.test(p)).map((p) => p.split('/')[1]).filter((f) => !meta[f]);
for (let i = 0; i < folders.length; i += 24) {
  await Promise.all(folders.slice(i, i + 24).map(async (f) => {
    try { const m = await (await fetch(RAW + 'assets/' + encodeURIComponent(f) + '/metadata.json')).json(); meta[f] = (m.unicode || '').replace(/ /g, '-').replace(/-fe0f/g, ''); } catch { meta[f] = ''; }
  }));
  process.stdout.write(`\rmetadata ${Math.min(i + 24, folders.length)}/${folders.length}`);
}
fs.writeFileSync(metaFile, JSON.stringify(meta));
const byKey = new Map(Object.entries(meta).map(([f, u]) => [u, f]));

// 3. download the 3D picture (the Default skin tone where there are several), shrink to 160 px WebP
const have = [], missing = [];
for (const [k, e] of want) {
  const f = byKey.get(k); if (!f) { missing.push(e); continue; }
  const png = paths.find((p) => p.startsWith(`assets/${f}/3D/`) && p.endsWith('.png')) || paths.find((p) => p.startsWith(`assets/${f}/Default/3D/`) && p.endsWith('.png'));
  if (!png) { missing.push(e); continue; }
  const out = path.join(OUT, `${k}.webp`);
  if (!fs.existsSync(out)) {
    const buf = Buffer.from(await (await fetch(RAW + png.split('/').map(encodeURIComponent).join('/'))).arrayBuffer());
    await sharp(buf).resize(160, 160, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 82, alphaQuality: 90 }).toFile(out);
  }
  have.push(k);
}
fs.writeFileSync(path.join(ROOT, 'src/engine/fluent-list.json'), JSON.stringify(have.sort()));
console.log(`\n${have.length} pictures, ${missing.length} without a Fluent picture: ${missing.join(' ')}`);
