// Shrinks the shipped assets with no visible loss. Run from the repo root:  node tools/asset-diet.mjs
// (needs: cd tools && npm install). Safe to re-run: every step checks whether it has already been done.
//  1. Derby ground textures: colour maps 1024 px (mozjpeg q80), normal + roughness maps 512 px
//  2. Derby daytime sky photo (Poly Haven "Orlando Stadium", CC0): 2k -> 1k Radiance HDR (box-filtered, RLE)
//  3. Kenney GLB models: meshopt geometry compression + WebP textures (palette texture embedded)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
sharp.cache(false);                                   // libvips keeps files open on Windows otherwise
const write = (file, buf) => { for (let k = 0; ; k++) { try { fs.writeFileSync(file, buf); return; } catch (e) { if (k > 20) throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250); } } };
const ROOT = process.cwd(), kb = (n) => `${(n / 1024).toFixed(0)} KB`;

// ---------------------------------------------------------------- 1. textures
const TEX = path.join(ROOT, 'public/assets/derby/tex');
for (const f of fs.readdirSync(TEX).filter((f) => f.endsWith('.jpg'))) {
  const file = path.join(TEX, f), color = f.endsWith('_c.jpg'), input = fs.readFileSync(file), meta = await sharp(input).metadata();
  const size = color ? 1024 : 512;
  const before = input.length;
  if (meta.width <= size && before < (color ? 700e3 : 150e3)) continue;   // already done
  const buf = await sharp(input).resize(size, size, { kernel: 'lanczos3' }).jpeg({ quality: color ? 80 : f.endsWith('_n.jpg') ? 88 : 80, mozjpeg: true }).toBuffer();
  write(file, buf);
  console.log('texture', f, kb(before), '->', kb(buf.length));
}

// ---------------------------------------------------------------- 2. HDR 2k -> 1k
function readHDR(buf) {
  let i = 0; const line = () => { let s = ''; while (buf[i] !== 0x0a) s += String.fromCharCode(buf[i++]); i++; return s; };
  if (!line().startsWith('#?')) throw new Error('not a Radiance file');
  for (let l = line(); l !== ''; l = line()) { /* header */ }
  const m = line().match(/-Y (\d+) \+X (\d+)/); if (!m) throw new Error('unsupported orientation');
  const H = +m[1], W = +m[2], rgbe = new Uint8Array(W * H * 4), scan = new Uint8Array(W * 4);
  for (let y = 0; y < H; y++) {
    if (buf[i] !== 2 || buf[i + 1] !== 2 || ((buf[i + 2] << 8) | buf[i + 3]) !== W) throw new Error('expected RLE scanlines');
    i += 4;
    for (let c = 0; c < 4; c++) {
      let x = 0;
      while (x < W) {
        let n = buf[i++];
        if (n > 128) { n -= 128; const v = buf[i++]; while (n--) scan[c * W + x++] = v; } else while (n--) scan[c * W + x++] = buf[i++];
      }
    }
    for (let x = 0; x < W; x++) for (let c = 0; c < 4; c++) rgbe[(y * W + x) * 4 + c] = scan[c * W + x];
  }
  const f = new Float32Array(W * H * 3);
  for (let p = 0; p < W * H; p++) { const e = rgbe[p * 4 + 3]; if (!e) continue; const s = Math.pow(2, e - 136); f[p * 3] = rgbe[p * 4] * s; f[p * 3 + 1] = rgbe[p * 4 + 1] * s; f[p * 3 + 2] = rgbe[p * 4 + 2] * s; }
  return { W, H, f };
}
function writeHDR({ W, H, f }) {
  const out = [Buffer.from(`#?RADIANCE\n# downscaled for A&E Games (tools/asset-diet.mjs)\nFORMAT=32-bit_rle_rgbe\n\n-Y ${H} +X ${W}\n`, 'latin1')];
  const scan = new Uint8Array(W * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = (y * W + x) * 3, r = f[p], g = f[p + 1], b = f[p + 2], v = Math.max(r, g, b);
      if (v < 1e-32) { scan[x] = scan[W + x] = scan[2 * W + x] = scan[3 * W + x] = 0; continue; }
      const e = Math.floor(Math.log2(v)) + 1, s = 256 / Math.pow(2, e);         // v = m * 2^e with m in [0.5, 1)
      scan[x] = Math.min(255, Math.floor(r * s)); scan[W + x] = Math.min(255, Math.floor(g * s)); scan[2 * W + x] = Math.min(255, Math.floor(b * s)); scan[3 * W + x] = e + 128;
    }
    const bytes = [2, 2, W >> 8, W & 255];
    for (let c = 0; c < 4; c++) {
      const d = scan.subarray(c * W, c * W + W); let x = 0;
      while (x < W) {
        let run = 1; while (x + run < W && run < 127 && d[x + run] === d[x]) run++;
        if (run >= 3) { bytes.push(128 + run, d[x]); x += run; continue; }
        let lit = 0; const start = x;
        while (x < W && lit < 128) { let r2 = 1; while (x + r2 < W && r2 < 3 && d[x + r2] === d[x]) r2++; if (r2 >= 3) break; x++; lit++; }
        bytes.push(lit, ...d.subarray(start, start + lit));
      }
    }
    out.push(Buffer.from(bytes));
  }
  return Buffer.concat(out);
}
const HDR_IN = path.join(ROOT, 'public/assets/derby/hdr/orlando_stadium_2k.hdr'), HDR_OUT = path.join(ROOT, 'public/assets/derby/hdr/orlando_stadium_1k.hdr');
if (fs.existsSync(HDR_IN)) {
  const src = readHDR(fs.readFileSync(HDR_IN)), W = src.W / 2, H = src.H / 2, f = new Float32Array(W * H * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (let c = 0; c < 3; c++) {
    const a = (yy, xx) => src.f[((y * 2 + yy) * src.W + x * 2 + xx) * 3 + c];
    f[(y * W + x) * 3 + c] = (a(0, 0) + a(0, 1) + a(1, 0) + a(1, 1)) / 4;
  }
  const buf = writeHDR({ W, H, f });
  const check = readHDR(buf); let err = 0;           // RGBE keeps ~8 bits relative to the brightest channel of each pixel
  for (let p = 0; p < W * H; p += 101) { const m = Math.max(1e-3, f[p * 3], f[p * 3 + 1], f[p * 3 + 2]); for (let c = 0; c < 3; c++) err = Math.max(err, Math.abs(check.f[p * 3 + c] - f[p * 3 + c]) / m); }
  if (err > .02) throw new Error('HDR round trip error ' + err);
  fs.writeFileSync(HDR_OUT, buf); fs.unlinkSync(HDR_IN);
  console.log('hdr', path.basename(HDR_IN), '->', path.basename(HDR_OUT), kb(buf.length), `(max round-trip error ${(err * 100).toFixed(2)}%)`);
}

// ---------------------------------------------------------------- 3. GLB models
const MODELS = path.join(ROOT, 'public/assets/models');
const cli = path.join(ROOT, 'tools/node_modules/@gltf-transform/cli/bin/cli.js');
for (const dir of ['food', 'nature']) {
  for (const f of fs.readdirSync(path.join(MODELS, dir)).filter((f) => f.endsWith('.glb'))) {
    const file = path.join(MODELS, dir, f), b = fs.readFileSync(file);
    const json = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString());
    if ((json.extensionsUsed || []).includes('EXT_meshopt_compression')) continue;
    const before = b.length, tmp = file + '.tmp.glb';
    execFileSync(process.execPath, [cli, 'optimize', file, tmp, '--compress', 'meshopt', '--texture-compress', 'webp', '--simplify', 'false', '--instance', 'false', '--palette', 'false', '--flatten', 'false', '--join', 'false'], { stdio: 'pipe' });
    fs.renameSync(tmp, file);
    console.log('model', `${dir}/${f}`, kb(before), '->', kb(fs.statSync(file).size));
  }
}
