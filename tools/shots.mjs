// npm run shots — screenshots of the canonical screens of Sparkle Match and Puzzle Shelf at phone and tablet sizes, into shots/.
// Look at them after every change: they are the quickest way to see a layout break. Starts its own Vite dev server.
// Needs: cd tools && npm install (Playwright; uses an already-installed Chromium if Playwright's own build is missing).
//   node tools/shots.mjs            both games
//   node tools/shots.mjs match      only Sparkle Match (or: shelf)
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { makeMaze } from '../src/shelf/maze/gen.js';

const ROOT = path.resolve(import.meta.dirname, '..'), OUT = path.join(ROOT, 'shots'), only = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });

/** Playwright's own Chromium if it is there, else any installed Playwright Chromium or headless shell, else Edge or Chrome */
async function launch() {
  const dir = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), '.cache'), 'ms-playwright'), tries = [{}];
  if (fs.existsSync(dir)) for (const d of fs.readdirSync(dir).sort().reverse()) for (const exe of ['chrome-headless-shell-win64/chrome-headless-shell.exe', 'chrome-win64/chrome.exe', 'chrome-linux/chrome', 'chrome-headless-shell-linux64/chrome-headless-shell'])
    if (/^chromium/.test(d) && fs.existsSync(path.join(dir, d, exe))) tries.push({ executablePath: path.join(dir, d, exe) });
  tries.push({ channel: 'msedge' }, { channel: 'chrome' });
  for (const t of tries) { try { return await chromium.launch(t); } catch { /* try the next one */ } }
  throw new Error('No browser could start: run  cd tools && npx playwright install chromium');
}

const MATCH_SIZES = { ipad: { width: 1180, height: 820 }, iphone: { width: 390, height: 844 } };
const MATCH = [
  ['l01-unicorn-collect', 'level=1&theme=unicorn&seed=7'], ['l11-unicorn-tiles', 'level=11&theme=unicorn&seed=7'],
  ['l21-mermaid-make', 'level=21&theme=mermaid&seed=7'], ['l34-unicorn-bring-home', 'level=34&theme=unicorn&seed=7'],
  ['l63-mermaid-round', 'level=63&theme=mermaid&seed=7'], ['l100-mermaid-party', 'level=100&theme=mermaid&seed=7'],
];
const SHELF_SIZES = { 'phone-portrait': { width: 375, height: 667 }, 'phone-landscape': { width: 844, height: 390 }, 'tablet-portrait': { width: 820, height: 1180 }, 'tablet-landscape': { width: 1180, height: 820 } };
const id5 = 'maze:gameday:5:1234', m5 = makeMaze(5, 1234);
const saved = (trail, done = false) => JSON.stringify({ v: 1, pages: { [id5]: { trail, done } }, books: {}, last: { screen: 'page', id: id5 }, skill: {}, settings: {} });
const SHELF = [
  ['01-shelf', '', saved(m5.path.slice(0, 22))], ['02-book', 'book=maze-gameday'],
  ['03-maze-l1', 'page=maze:gameday:1:11'], ['04-maze-l3', 'page=maze:gameday:3:33'], ['05-maze-l5', `page=${id5}`],
  ['06-maze-l5-debug', `page=${id5}&debug=1`], ['07-maze-l5-part', `page=${id5}`, saved(m5.path.slice(0, 22))],
  ['08-maze-l5-done', `page=${id5}`, saved(m5.path, true)], ['09-maze-l7', 'page=maze:gameday:7:77'],
  ['10-maze-l8-debug', 'page=maze:gameday:8:88&debug=1'], ['11-maze-l10', 'page=maze:gameday:10:1010'], ['12-book-page-24', 'book=maze-gameday&n=24'],
];

const server = await createServer({ root: ROOT, configFile: path.join(ROOT, 'vite.config.js'), server: { port: 5199, strictPort: false }, logLevel: 'error' });
await server.listen();
const base = server.resolvedUrls.local[0].replace(/\/$/, '');
const browser = await launch();
let n = 0;
try {
  async function shoot(file, url, size, store, ready) {
    const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 1 });
    await ctx.addInitScript((s) => { try { localStorage.clear(); if (s) localStorage.setItem('ps.v1', s); } catch { /* fine */ } }, store || null);
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(url); await page.waitForFunction(ready, null, { timeout: 20000 }); await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(OUT, file) }); n++;
    if (errors.length) console.warn(`  ${file}: ${errors.join(' | ')}`);
    await ctx.close();
  }
  if (!only || only === 'match') for (const [name, q] of MATCH) for (const [sz, size] of Object.entries(MATCH_SIZES))
    await shoot(`match-${name}-${sz}.png`, `${base}/match.html?${q}`, size, null, () => !!window.match?.game);
  if (!only || only === 'shelf') for (const [name, q, store] of SHELF) for (const [sz, size] of Object.entries(SHELF_SIZES))
    await shoot(`shelf-${name}-${sz}.png`, `${base}/shelf.html${q ? '?' + q : ''}`, size, store, () => !!window.shelf?.route);
  console.log(`${n} screenshots in ${path.relative(process.cwd(), OUT) || OUT}`);
} finally { await browser.close(); await server.close(); }
