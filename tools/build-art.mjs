// Puzzle Shelf's hidden-picture art (§6). For every object a theme lists (src/shelf/themes.js `ispy`), downloads OpenMoji's black
// line drawing and its colour version (same outline; CC BY-SA 4.0, github.com/hfg-gmuend/openmoji) and writes:
//   public/art/<theme>.svg          one sprite sheet of <symbol>s: l<HEX> (line, slightly bolder for the book look) and c<HEX> (colour)
//   src/shelf/ispy/art/<theme>.js   the words, each object's 32 × 32 silhouette mask (for hiding, proof and hit-testing) and its box
// Run from the repo root (needs: cd tools && npm install — uses sharp):   node tools/build-art.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { THEMES, ispyObjects } from '../src/shelf/themes.js';
const sharp = createRequire(import.meta.url)('sharp');

const ROOT = path.resolve(import.meta.dirname, '..'), CACHE = path.join(ROOT, 'tools/.cache/openmoji');
const RAW = 'https://raw.githubusercontent.com/hfg-gmuend/openmoji/master/', M = 32;
fs.mkdirSync(path.join(CACHE, 'black'), { recursive: true }); fs.mkdirSync(path.join(CACHE, 'color'), { recursive: true });
const index = path.join(CACHE, 'openmoji.json');
if (!fs.existsSync(index)) fs.writeFileSync(index, Buffer.from(await (await fetch(RAW + 'data/openmoji.json')).arrayBuffer()));
const META = new Map(JSON.parse(fs.readFileSync(index, 'utf8')).map((e) => [e.hexcode, e]));

async function svgOf(look, hex) {
  const file = path.join(CACHE, look, hex + '.svg');
  if (!fs.existsSync(file)) { const r = await fetch(`${RAW}${look}/svg/${hex}.svg`); if (!r.ok) throw new Error(`${look}/${hex}: HTTP ${r.status}`); fs.writeFileSync(file, await r.text()); }
  return fs.readFileSync(file, 'utf8');
}
/** the inside of an OpenMoji svg as a <symbol>: no ids (they would clash), shorter numbers, empty groups gone; line art a little bolder */
function symbol(svg, id, bold) {
  let inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/<!--[\s\S]*?-->/g, '').replace(/<title>[\s\S]*?<\/title>/g, '')
    .replace(/\s(id|stroke-miterlimit)="[^"]*"/g, '').replace(/(\d+\.\d{2})\d+/g, '$1').replace(/<g>\s*<\/g>|<g\/>|<g \/>/g, '').replace(/\s{2,}/g, ' ').replace(/>\s+</g, '><');
  if (bold) inner = inner.replace(/stroke-width="2"/g, 'stroke-width="2.6"');
  return `<symbol id="${id}" viewBox="0 0 72 72">${inner.trim()}</symbol>`;
}
/** 32 × 32 silhouette of the colour picture (alpha > 50 %) as rows of hex, and the box it fills (0..1) */
async function mask(svg) {
  const { data } = await sharp(Buffer.from(svg), { density: 216 }).resize(M, M, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const rows = []; let x0 = M, y0 = M, x1 = -1, y1 = -1;
  for (let y = 0; y < M; y++) { let bits = ''; for (let x = 0; x < M; x++) { const on = data[(y * M + x) * 4 + 3] > 127; bits += on ? '1' : '0'; if (on) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } } rows.push(parseInt(bits, 2).toString(16).padStart(8, '0')); }
  return { rows, box: [x0 / M, y0 / M, (x1 + 1) / M, (y1 + 1) / M].map((v) => +v.toFixed(3)) };
}

let total = 0;
for (const theme of Object.keys(THEMES)) {
  const objs = ispyObjects(theme), syms = [], words = {}, masks = {}, boxes = {};
  for (let i = 0; i < objs.length; i += 12) await Promise.all(objs.slice(i, i + 12).map(async ({ hex }) => { await svgOf('black', hex); await svgOf('color', hex); }));
  for (const { hex, word } of objs) {
    const meta = META.get(hex); if (!meta) throw new Error(`${theme}: ${hex} is not in OpenMoji`);
    const line = await svgOf('black', hex), colour = await svgOf('color', hex);
    syms.push(symbol(line, 'l' + hex, true), symbol(colour, 'c' + hex, false));
    const m = await mask(colour); masks[hex] = m.rows; boxes[hex] = m.box;
    words[hex] = word || meta.annotation;
  }
  const sheet = `<svg xmlns="http://www.w3.org/2000/svg"><defs>${syms.join('')}</defs></svg>`;
  fs.mkdirSync(path.join(ROOT, 'public/art'), { recursive: true }); fs.writeFileSync(path.join(ROOT, `public/art/${theme}.svg`), sheet);
  fs.mkdirSync(path.join(ROOT, 'src/shelf/ispy/art'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, `src/shelf/ispy/art/${theme}.js`), `// ${THEMES[theme].title} hidden-picture objects: words, 32 × 32 silhouette masks, boxes. Written by tools/build-art.mjs (OpenMoji, CC BY-SA 4.0).\nexport default ${JSON.stringify({ ids: objs.map((o) => o.hex), words, masks, boxes })};\n`);
  total += objs.length;
  console.log(`${theme.padEnd(10)} ${objs.length} objects, sprite ${Math.round(sheet.length / 1024)} KB`);
}
console.log(`${total} objects`);
