// Fetches the Fluent Emoji "3D" pictures (MIT, github.com/microsoft/fluentui-emoji) that Sparkle Match and Puzzle Shelf name in
// their theme files, and saves each as a 192 px WebP:  public/assets/match/<slug>.webp,  public/assets/shelf/<slug>.webp.
// For Puzzle Shelf's maze shapes it also writes src/shelf/shapes.js: each picture's silhouette (alpha > 50 %) cropped to its
// outline and stored as a small bitmap, so a maze of any size can be cut to that shape.
// Every name is checked against the repository's file list first; a missing one is reported, never guessed.
// Run from the repo root (needs: cd tools && npm install — uses sharp):   node tools/fetch-art.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { THEMES as MATCH, artNames, artFile, slug } from '../src/match/themes.js';
import { THEMES as SHELF } from '../src/shelf/themes.js';
const sharp = createRequire(import.meta.url)('sharp');

const ROOT = path.resolve(import.meta.dirname, '..'), CACHE = path.join(ROOT, 'tools/.cache/fluent-3d');
const RAW = 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/', SIZE = 192, BITS = 48;
fs.mkdirSync(CACHE, { recursive: true });

// 1. the repository's file list (cached for a day): folder name → its 3D png (the Default skin tone where there are several)
const treeFile = path.join(CACHE, 'tree.json');
let paths;
if (fs.existsSync(treeFile) && Date.now() - fs.statSync(treeFile).mtimeMs < 864e5) paths = JSON.parse(fs.readFileSync(treeFile, 'utf8'));
else { const t = await (await fetch('https://api.github.com/repos/microsoft/fluentui-emoji/git/trees/main?recursive=1')).json(); paths = t.tree.map((x) => x.path); fs.writeFileSync(treeFile, JSON.stringify(paths)); }
const pngOf = new Map();
for (const p of paths) {
  const m = /^assets\/([^/]+)\/(?:Default\/)?3D\/[^/]+\.png$/.exec(p);
  if (m && (!pngOf.has(m[1]) || p.includes('/Default/'))) pngOf.set(m[1], p);
}
const folder = (name) => [...pngOf.keys()].find((f) => f.toLowerCase() === name.toLowerCase());
/** 'Woman merpeople|Medium' → that skin tone's picture */
function pathOf(name) {
  const [base, tone] = name.split('|'), f = folder(base); if (!f) return null;
  if (!tone) return pngOf.get(f);
  return paths.find((p) => p.startsWith(`assets/${f}/${tone}/3D/`) && p.endsWith('.png')) || null;
}

async function source(name) {
  const p = pathOf(name); if (!p) return null;
  const file = path.join(CACHE, artFile(name) + '.png');
  if (!fs.existsSync(file)) {
    const r = await fetch(RAW + p.split('/').map(encodeURIComponent).join('/'));
    if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`);
    fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  }
  return file;
}
async function webp(name, outDir, size = SIZE) {
  const src = await source(name); if (!src) return false;
  fs.mkdirSync(outDir, { recursive: true });
  await sharp(src).resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 86, alphaQuality: 90 }).toFile(path.join(outDir, artFile(name) + '.webp'));
  return true;
}
/** the silhouette, cropped to its outline, as rows of hex (1 bit per cell, BITS on the long side) */
async function silhouette(name) {
  const src = await source(name); if (!src) return null;
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width, y0 = info.height, x1 = 0, y1 = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * 4 + 3] > 127) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1, w = bw >= bh ? BITS : Math.max(8, Math.round(BITS * bw / bh)), h = bh > bw ? BITS : Math.max(8, Math.round(BITS * bh / bw));
  const { data: a } = await sharp(src).extract({ left: x0, top: y0, width: bw, height: bh }).resize(w, h, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const rows = [];
  for (let y = 0; y < h; y++) { let bits = ''; for (let x = 0; x < w; x++) bits += a[(y * w + x) * 4 + 3] > 127 ? '1' : '0'; rows.push(BigInt('0b' + bits).toString(16).padStart(Math.ceil(w / 4), '0')); }
  return { w, h, rows, box: [x0 / info.width, y0 / info.height, bw / info.width, bh / info.height] };
}

const missing = [], made = [];
for (const t of Object.values(MATCH)) {                    // pieces and friends at 192 px; map charms and map friends at 128 px
  const big = new Set([...t.names, ...Object.values(t.art)]);
  for (const n of artNames(t)) (await webp(n, path.join(ROOT, 'public/assets/match'), big.has(n.split('|')[0]) ? SIZE : 128)) ? made.push(n) : missing.push(`match/${t.id}: ${n}`);
}
const shapes = {};
for (const t of Object.values(SHELF)) {
  for (const n of new Set([t.hero, t.goal, ...t.decor, ...t.shapes])) (await webp(n, path.join(ROOT, 'public/assets/shelf'))) ? made.push(n) : missing.push(`shelf/${t.id}: ${n}`);
  for (const n of t.shapes) { const s = await silhouette(n); if (s) shapes[slug(n)] = s; }
  // sticker-by-letter source pictures, for tools/build-stickers.mjs (node tools/build-stickers.mjs tools/.cache/sticker-src tools/.cache/stickers 24)
  fs.mkdirSync(path.join(ROOT, 'tools/.cache/sticker-src'), { recursive: true });
  for (const n of t.stickers || []) { const src = await source(n); if (src) fs.copyFileSync(src, path.join(ROOT, 'tools/.cache/sticker-src', slug(n) + '.png')); else missing.push(`shelf/${t.id} sticker: ${n}`); }
}
fs.writeFileSync(path.join(ROOT, 'src/shelf/shapes.js'), '// Maze shape silhouettes, written by tools/fetch-art.mjs from the Fluent Emoji 3D pictures (do not edit by hand).\nexport default ' + JSON.stringify(shapes) + ';\n');
console.log(`${new Set(made).size} pictures, ${Object.keys(shapes).length} maze shapes`);
if (missing.length) { console.log('NOT in Fluent Emoji (change the theme file):\n  ' + missing.join('\n  ')); process.exitCode = 1; }
