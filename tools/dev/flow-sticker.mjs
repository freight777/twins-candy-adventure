import { chromium } from 'playwright';
import { createServer } from 'vite';
import path from 'node:path';
const ROOT = path.resolve(import.meta.dirname, '../..'), OUT = path.join(ROOT, 'shots');
const server = await createServer({ root: ROOT, configFile: path.join(ROOT, 'vite.config.js'), server: { port: 5194 }, logLevel: 'error' }); await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ executablePath: path.join(process.env.LOCALAPPDATA, 'ms-playwright/chromium_headless_shell-1254/chrome-headless-shell-win64/chrome-headless-shell.exe') });
const page = await browser.newPage({ viewport: { width: Number(process.argv[2] || 1180), height: Number(process.argv[3] || 820) } }), errors = [];
page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const shot = (n) => page.screenshot({ path: path.join(OUT, `sflow-${n}.png`) });
await page.goto(base + 'shelf.html'); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(800); await shot('1-shelf');
await page.goto(base + 'shelf.html?book=sticker-ocean&n=1'); await page.waitForSelector('.loose'); await page.waitForTimeout(500); await shot('2-start');
let placed = 0;
for (let k = 0; k < 30; k++) {
  const next = await page.evaluate(() => {
    const b = document.querySelector('.loose:not(.away)'); if (!b) return null;
    const i = b.dataset.i, gap = document.querySelector(`.gap[data-i="${i}"] .hole`).getBoundingClientRect(), r = b.querySelector('svg').getBoundingClientRect();
    return { from: [r.left + r.width / 2, r.top + r.height / 2], to: [gap.left + gap.width / 2, gap.top + gap.height / 2 + 36] };
  });
  if (!next) break;
  await page.mouse.move(...next.from); await page.mouse.down();
  for (let s = 1; s <= 12; s++) await page.mouse.move(next.from[0] + (next.to[0] - next.from[0]) * s / 12, next.from[1] + (next.to[1] - next.from[1]) * s / 12);
  await page.mouse.up(); await page.waitForTimeout(250); placed++;
  if (k === 2) await shot('3-mid');
}
await page.waitForTimeout(900); await shot('4-gleam'); await page.waitForTimeout(1500); await shot('5-done');
const st = await page.evaluate(() => ({ save: JSON.parse(localStorage.getItem('ps.v1')), finish: [...document.querySelectorAll('.finish:not(.hidden) button')].map((b) => b.getAttribute('aria-label')) }));
await page.goto(base + 'shelf.html?album=1'); await page.waitForTimeout(900); await shot('6-album');
console.log(JSON.stringify({ placed, finish: st.finish, album: st.save.album, page: Object.values(st.save.pages)[0], errors }));
await browser.close(); await server.close();
