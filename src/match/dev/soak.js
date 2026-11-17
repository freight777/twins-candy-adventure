// Development only (loaded by main.js when import.meta.env.DEV): plays whole levels with random moves through the real board,
// on a virtual clock that sometimes jumps (like a tab coming back from the background), and stops at the first time the
// screen and the game disagree. In the browser console:  await match.soak([1, 34, 64], 3)
export function installSoak(match, E) {
  const { gsap, board } = match;
  let clock = null;
  const startClock = () => {
    if (clock) return; gsap.ticker.remove(gsap.updateRoot);
    let t = gsap.ticker.time, k = 0; const mc = new MessageChannel(); clock = { stop: false };
    const c = clock; mc.port1.onmessage = () => { if (c.stop) return; k++; t += k % 7 === 0 ? 0.4 : 1 / 60; try { gsap.updateRoot(t); } finally { mc.port2.postMessage(0); } };
    mc.port2.postMessage(0);
  };
  const stopClock = () => { if (!clock) return; clock.stop = true; clock = null; gsap.ticker.add(gsap.updateRoot); };
  return async function soak(levels, seed = 1, budgetMs = 30000) {
    let problem = null; const t0 = performance.now(), out = [];
    const oe = console.error; console.error = (...a) => { problem ??= a.join(' '); oe(...a); };
    const onErr = (e) => { problem ??= e.message; }; addEventListener('error', onErr);
    startClock();
    try {
      for (const L of levels) {
        match.start(L, seed); let n = 0, r = seed * 7 + 1;
        while (!match.game.done && n < 150) {
          if (performance.now() - t0 > budgetMs) return { ok: !problem, out, stoppedAt: L, problem };
          const ms = E.moves(match.game); r = (r * 1103515245 + 12345) >>> 0;
          await Promise.race([match.submit(ms[r % ms.length]), new Promise((res) => setTimeout(res, 5000))]); n++;
          if (match.busy) problem ??= `stuck animating on level ${L}`;
          if (problem) return { ok: false, level: L, move: n, problem, out };
        }
        out.push(`${L}:${n}`);
      }
      return { ok: !problem, out, problem, sprites: board.sprites.size };
    } finally { stopClock(); console.error = oe; removeEventListener('error', onErr); }
  };
}
