// ad-hoc: capture frames of an animation in a real headless browser
import { chromium } from 'playwright';
import { createServer } from 'vite';
import path from 'node:path';
const ROOT = path.resolve(import.meta.dirname, '../..'), OUT = path.join(ROOT, 'shots');
const server = await createServer({ root: ROOT, configFile: path.join(ROOT, 'vite.config.js'), server: { port: 5198 }, logLevel: 'error' }); await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ executablePath: path.join(process.env.LOCALAPPDATA, 'ms-playwright/chromium_headless_shell-1254/chrome-headless-shell-win64/chrome-headless-shell.exe') });
const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
const [, , what = 'help'] = process.argv;
if (what === 'help' || what === 'gift') {
  await page.goto(base + (what === 'help' ? 'match.html?level=6&theme=unicorn&seed=4' : 'match.html?level=21&theme=mermaid&seed=4'));
  await page.waitForFunction(() => window.match?.game); await page.waitForTimeout(2000);
  await page.evaluate(async () => { const E = await import('/src/match/game/engine.js'); window.match.game.level = { ...window.match.game.level, par: 1 }; window.match.gsap.globalTimeline.timeScale(0.5);
    if (window.match.game.level.preset) window.match.game.level = { ...window.match.game.level, goal: { type: 'make', count: 5 } };
    window.match.submit(E.moves(window.match.game).find((m) => m.a !== undefined)); });
  for (let i = 0; i < 16; i++) { await page.waitForTimeout(200); await page.screenshot({ path: path.join(OUT, `cap-${what}-${i}.png`) }); }
}
await browser.close(); await server.close(); console.log('captured');
