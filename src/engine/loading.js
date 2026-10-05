// The loading screen in every game page: <div id="loading" class="loading"> ... <div class="bar"><i></i></div></div>
import './shell.css';

const el = () => document.getElementById('loading');
export const loading = {
  /** fill the bar (0..1); it never moves backwards */
  set(p) {
    const i = el()?.querySelector('.bar i'); if (!i) return;
    const w = Math.max(parseFloat(i.style.width) || 3, Math.round(Math.min(1, p) * 100));
    i.style.width = `${w}%`;
  },
  /** count finished jobs out of a total: const tick = loading.counter(12); ... tick() */
  counter(total) { let n = 0; return () => loading.set(++n / Math.max(1, total)); },
  done() { const l = el(); if (!l) return; loading.set(1); l.classList.add('done'); setTimeout(() => l.remove(), 700); },
  fail() { const t = el()?.querySelector('.l-text'); if (t) t.textContent = 'Oops, something went wrong. Please reload!'; },
};
