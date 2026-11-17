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
// [name, query, how much of the line to draw first (0..1), then the page is reopened so it shows as saved]
const SHELF = [
  ['01-shelf', 'page=maze:gameday:5:1234', 0.4, 'shelf'], ['02-book', 'book=maze-ocean'],
  ['03-gameday-l1', 'page=maze:gameday:1:11'], ['04-cars-l3', 'page=maze:cars:3:33'], ['05-dinosaurs-l5', 'page=maze:dinosaurs:5:55'],
  ['06-ocean-l5-debug', 'page=maze:ocean:5:1234&debug=1'], ['07-gameday-l5-part', 'page=maze:gameday:5:1234', 0.4],
  ['08-gameday-l5-done', 'page=maze:gameday:5:1234', 1], ['09-cars-l7', 'page=maze:cars:7:77'],
  ['10-dinosaurs-l8-debug', 'page=maze:dinosaurs:8:2&debug=1'], ['11-ocean-l10', 'page=maze:ocean:10:1010'], ['12-gameday-book-page-24', 'book=maze-gameday&n=24'],
];

const server = await createServer({ root: ROOT, configFile: path.join(ROOT, 'vite.config.js'), server: { port: 5199, strictPort: false }, logLevel: 'error' });
await server.listen();
const base = server.resolvedUrls.local[0].replace(/\/$/, '');
const browser = await launch();
let n = 0;
try {
  async function shoot(file, url, size, ready, draw = 0, then = null) {
    const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 1 });
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(url); await page.waitForFunction(ready, null, { timeout: 20000 });
    if (draw) {                                       // save part (or all) of the solution as the line drawn so far, then reopen
      await page.evaluate((f) => { const s = JSON.parse(localStorage.getItem('ps.v1')), m = window.__maze.maze, id = Object.keys(s.pages)[0];
        s.pages[id].trail = m.path.slice(0, Math.max(1, Math.round(m.path.length * f))); s.pages[id].done = f >= 1; localStorage.setItem('ps.v1', JSON.stringify(s)); }, draw);
      if (then === 'shelf') await page.evaluate(() => window.shelf.go({ screen: 'shelf' })); else await page.reload();
      await page.waitForFunction(ready, null, { timeout: 20000 });
    }
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(OUT, file) }); n++;
    if (errors.length) console.warn(`  ${file}: ${errors.join(' | ')}`);
    await ctx.close();
  }
  if (!only || only === 'match') for (const [name, q] of MATCH) for (const [sz, size] of Object.entries(MATCH_SIZES))
    await shoot(`match-${name}-${sz}.png`, `${base}/match.html?${q}`, size, () => !!window.match?.game);
  if (!only || only === 'shelf') for (const [name, q, draw, then] of SHELF) for (const [sz, size] of Object.entries(SHELF_SIZES))
    await shoot(`shelf-${name}-${sz}.png`, `${base}/shelf.html${q ? '?' + q : ''}`, size, () => !!window.shelf?.route, draw, then);
  console.log(`${n} screenshots in ${path.relative(process.cwd(), OUT) || OUT}`);
} finally { await browser.close(); await server.close(); }
