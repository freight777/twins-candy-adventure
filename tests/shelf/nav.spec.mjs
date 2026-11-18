// Puzzle Shelf §1A test, in a real browser (Playwright), at phone and tablet sizes. Run: npm run test:nav
// For each of the thirteen canonical pages (four themes × maze, hidden pictures, stickers, and Score Spy), part-way through play:
//   tap Home → the shelf is showing within 300 ms → tap Keep going → the page is back with its progress intact;
//   rotate mid-page → Home and Book are still top-left, Home first;
// and on a finished page the finish screen shows exactly Next page and Home.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const ROOT = path.resolve(import.meta.dirname, '../..');
const req = createRequire(path.join(ROOT, 'tools/package.json'));
const { chromium } = req('playwright');
const { createServer } = await import('vite');

async function launch() {                                                    // Playwright's Chromium, or any installed one, or Edge
  const dir = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), '.cache'), 'ms-playwright'), tries = [{}];
  if (fs.existsSync(dir)) for (const d of fs.readdirSync(dir).sort().reverse()) for (const exe of ['chrome-headless-shell-win64/chrome-headless-shell.exe', 'chrome-win64/chrome.exe', 'chrome-linux/chrome'])
    if (/^chromium/.test(d) && fs.existsSync(path.join(dir, d, exe))) tries.push({ executablePath: path.join(dir, d, exe) });
  tries.push({ channel: 'msedge' }, { channel: 'chrome' });
  for (const t of tries) { try { return await chromium.launch(t); } catch { /* next */ } }
  throw new Error('no browser');
}
const server = await createServer({ root: ROOT, configFile: path.join(ROOT, 'vite.config.js'), server: { port: 5193, strictPort: false }, logLevel: 'error' });
await server.listen();
const base = server.resolvedUrls.local[0].replace(/\/$/, '');
const browser = await launch();
const SIZES = { phone: { width: 390, height: 844 }, tablet: { width: 1180, height: 820 } };
const THEMES = ['gameday', 'cars', 'dinosaurs', 'ocean'], TYPES = ['maze', 'ispy', 'sticker'];
const PAGES = [...THEMES.flatMap((theme) => TYPES.map((type) => [type, theme])), ['score', 'gameday']];
const ready = (t) => (t === 'maze' ? window.__maze : t === 'ispy' ? window.__ispy : t === 'score' ? window.__score && document.querySelector('.wall .board') : document.querySelector('.loose'));
const FINGERPRINT = () => JSON.stringify(Object.values(JSON.parse(localStorage.getItem('ps.v1')).pages).map((p) => [p.trail?.length, p.found?.length, p.placed?.length, p.got]));
let checks = 0;

/** make some progress on the page with real pointer input; returns a fingerprint of that progress */
async function progress(page, type, finish = false) {
  if (type === 'maze') {
    const pts = await page.evaluate((all) => { const { maze: m } = window.__maze, svg = document.querySelector('.art'), M = svg.getScreenCTM(), W = m.grid.w;
      const cells = all ? m.path : m.path.slice(0, Math.ceil(m.path.length / 2));
      return cells.map((c) => { const p = new DOMPoint((c % W) + 0.5, ((c / W) | 0) + 0.5).matrixTransform(M); return [p.x, p.y]; }); }, finish);
    await page.mouse.move(...pts[0]); await page.mouse.down(); for (const p of pts.slice(1)) await page.mouse.move(...p, { steps: 2 }); await page.mouse.up();
  } else if (type === 'ispy') {
    const pts = await page.evaluate(async (all) => {                       // tap each thing on its picture (the point of it nearest its middle), as a child would
      const { onItem } = await import('/src/shelf/ispy/compose.js'), { scene, layers, art } = window.__ispy, M = layers.svg.getScreenCTM();
      const onIt = (it) => { for (let r = 0; r < it.s / 2; r += 3) for (let a = 0; a < 16; a++) { const x = it.x + Math.cos(a * Math.PI / 8) * r, y = it.y + Math.sin(a * Math.PI / 8) * r; if (onItem(art, it, x, y)) return [x, y]; } return [it.x, it.y]; };
      return scene.items.filter((it) => it.target !== undefined).slice(0, all ? 99 : 1).map((it) => { const [x, y] = onIt(it), p = new DOMPoint(x, y).matrixTransform(M); return [p.x, p.y]; }); }, finish);
    for (const p of pts) { await page.mouse.click(...p); await page.waitForTimeout(40); }
  } else if (type === 'score') {                                        // tap the right row of the right scoreboard for each clue
    for (let k = 0; k < (finish ? 20 : 1); k++) {
      const p = await page.evaluate(() => { const S = window.__score; if (S.at >= S.page.clues.length) return null; const a = S.page.clues[S.at].answer, row = document.querySelector(`.row[data-g="${a.g}"][data-side="${a.side ?? 0}"]`);
        row.scrollIntoView({ block: 'nearest' }); const r = row.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
      if (!p) break;
      await page.mouse.click(...p); await page.waitForTimeout(1500);
    }
  } else {
    for (let k = 0; k < (finish ? 40 : 1); k++) {
      const d = await page.evaluate(() => { const b = document.querySelector('.loose:not(.away)'); if (!b) return null; const g = document.querySelector(`.gap[data-i="${b.dataset.i}"] .hole`).getBoundingClientRect(), r = b.querySelector('svg').getBoundingClientRect();
        b.scrollIntoView({ block: 'nearest', inline: 'nearest' }); const r2 = b.querySelector('svg').getBoundingClientRect(); return { from: [r2.left + r2.width / 2, r2.top + r2.height / 2], to: [g.left + g.width / 2, g.top + g.height / 2 + 36] }; });
      if (!d) break;
      await page.mouse.move(...d.from); await page.mouse.down(); await page.mouse.move(...d.to, { steps: 10 }); await page.mouse.up(); await page.waitForTimeout(250);
    }
  }
  await page.waitForTimeout(200);
  return page.evaluate(FINGERPRINT);
}
const buttonsTopLeft = (page) => page.evaluate(() => { const h = document.querySelector('#btnHome').getBoundingClientRect(), b = document.querySelector('#btnBook').getBoundingClientRect(); return { h: [h.left, h.top, h.width], b: [b.left, b.top], visible: h.width > 0 && b.width > 0 }; });

try {
  for (const [sz, size] of Object.entries(SIZES)) {
    for (const [type, theme] of PAGES) {
      const tag = `${sz} ${type}-${theme}`, ctx = await browser.newContext({ viewport: size, hasTouch: false }), page = await ctx.newPage(), errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(`${base}/shelf.html?book=${type}-${theme}&n=3`);
      await page.waitForFunction(ready, type, { timeout: 20000 });
      if (type === 'ispy') await page.evaluate(() => document.querySelector('.chooser')?.remove());
      await page.waitForTimeout(300);
      const before = await progress(page, type);
      // rotate mid-page: the two buttons stay top-left, Home first
      const a = await buttonsTopLeft(page);
      await page.setViewportSize({ width: size.height, height: size.width }); await page.waitForTimeout(250);
      const r = await buttonsTopLeft(page);
      await page.setViewportSize(size); await page.waitForTimeout(250);
      for (const q of [a, r]) { assert.ok(q.visible, `${tag}: buttons visible`); assert.ok(q.h[0] < 30 && q.h[1] < 30 && q.h[2] >= 64, `${tag}: Home top-left, 64 px (${q.h})`); assert.ok(q.b[0] > q.h[0] && q.b[1] === q.h[1], `${tag}: Book second from the left`); }
      // Home: the shelf within 300 ms
      const ms = await page.evaluate(() => new Promise((res) => { const t0 = performance.now(); document.querySelector('#btnHome').click(); const check = () => (document.body.dataset.screen === 'shelf' && document.querySelector('.shelf .keep') ? res(performance.now() - t0) : requestAnimationFrame(check)); check(); }));
      assert.ok(ms < 300, `${tag}: the shelf showed in ${ms.toFixed(0)} ms`);
      // Keep going: the page is back with its progress
      await page.evaluate(() => document.querySelector('.keep').click());
      await page.waitForFunction((t) => (t === 'maze' ? window.__maze && document.querySelector('.art') : t === 'ispy' ? window.__ispy && document.querySelector('.scene .it') : t === 'score' ? document.querySelector('.wall .board') : document.querySelector('.gap')), type, { timeout: 20000 });
      await page.waitForTimeout(300);
      const after = await page.evaluate(FINGERPRINT);
      assert.equal(after, before, `${tag}: progress intact after Home and Keep going`);
      const shown = await page.evaluate((t) => (t === 'maze' ? window.__maze.ctl.trail.length : t === 'ispy' ? window.__ispy.ctl.found.length : t === 'score' ? document.querySelectorAll('.board.found').length : document.querySelectorAll('.gap.filled').length), type);
      assert.ok(shown > (type === 'maze' ? 1 : 0), `${tag}: the progress is drawn again (${shown})`);
      assert.deepEqual(errors, [], `${tag}: no errors`);
      checks++;
      await ctx.close();
    }
    // the finish screen: exactly Next page and Home (one page of each kind)
    for (const type of [...TYPES, 'score']) {
      const tag = `${sz} ${type} finish`, ctx = await browser.newContext({ viewport: size }), page = await ctx.newPage();
      await page.goto(`${base}/shelf.html?book=${type}-${type === 'score' ? 'gameday' : 'ocean'}&n=1`);
      await page.waitForFunction(ready, type, { timeout: 20000 });
      if (type === 'ispy') await page.evaluate(() => document.querySelector('.chooser')?.remove());
      await page.waitForTimeout(300);
      await progress(page, type, true);
      await page.waitForSelector('.finish:not(.hidden)', { timeout: 8000 });
      const labels = await page.evaluate(() => [...document.querySelectorAll('.finish:not(.hidden) button')].map((b) => b.getAttribute('aria-label')));
      assert.deepEqual(labels, ['Next page', 'Home'], `${tag}: exactly Next page and Home`);
      assert.ok((await buttonsTopLeft(page)).visible, `${tag}: Home and Book still there`);
      checks++;
      await ctx.close();
    }
  }
  console.log(`nav ok (${checks} checks: 13 pages × 2 sizes, Home ≤ 300 ms, Keep going, rotation, finish screens)`);
} finally { await browser.close(); await server.close(); }
