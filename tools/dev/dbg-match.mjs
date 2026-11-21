import { chromium } from 'playwright';
import { createServer } from 'vite';
import path from 'node:path';
const ROOT = path.resolve(import.meta.dirname, '../..');
const server = await createServer({ root: ROOT, configFile: path.join(ROOT, 'vite.config.js'), server: { port: 5195 }, logLevel: 'error' }); await server.listen();
const browser = await chromium.launch({ executablePath: path.join(process.env.LOCALAPPDATA, 'ms-playwright/chromium_headless_shell-1254/chrome-headless-shell-win64/chrome-headless-shell.exe') });
const page = await browser.newPage({ viewport: { width: 1024, height: 768 } }), errors = [];
page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => errors.push(m.type() + ': ' + m.text()));
await page.goto(server.resolvedUrls.local[0] + 'match.html?door=unicorn&level=1&seed=1'); await page.waitForFunction(() => window.match?.soak, null, { timeout: 30000 });
const r = await page.evaluate(async () => {
  const E = await import('/src/match/game/engine.js'), m = window.match, out = {};
  out.screen = document.body.dataset.screen; out.level = m.game?.level.n;
  const p = m.submit(E.moves(m.game).find((x) => x.a !== undefined));
  await new Promise((res) => setTimeout(res, 3000)); out.busyAfter3s = m.busy; out.moves = m.game.moves; out.gsapTime = m.gsap.globalTimeline.time();
  return out;
});
console.log(JSON.stringify({ r, errors: errors.filter((e) => !e.includes('[vite]')).slice(0, 8) }));
await browser.close(); await server.close();
