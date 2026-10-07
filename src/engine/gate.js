// Hold-to-open: grown-up things (the menu, leaving a game) open only after a steady hold. Kids mash; they don't hold still.
import './shell.css';
import { say } from '../audio.js';

// every game is landscape: held upright, the screen shows an iPad turning on its side (CSS shows it in portrait only)
if (typeof document !== 'undefined' && !document.querySelector('.turn')) {
  const t = document.createElement('div'); t.className = 'turn'; t.setAttribute('aria-hidden', 'true'); t.innerHTML = '<div class="turn-pad"><i></i></div><div class="turn-arrow">&#8635;</div>';
  (document.body || document.documentElement).appendChild(t);
}

/**
 * holdGate(el, onOpen, { ms, onTap }) — a ring fills around `el` while it is held; letting go early cancels
 * (and calls onTap, e.g. to say "Hold the house to go home!"). Moving the finger away cancels too.
 */
export function holdGate(el, onOpen, { ms = 2000, onTap = null } = {}) {
  if (!el) return;
  let t = 0, down = null;
  el.classList.add('gate'); el.style.setProperty('--gate-ms', `${ms}ms`);
  const stop = (tapped) => {
    if (!down) return;
    clearTimeout(t); el.classList.remove('holding');
    const quick = tapped && performance.now() - down.at < ms; down = null;
    if (quick && onTap) onTap();
  };
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation();
    try { el.setPointerCapture(e.pointerId); } catch { /* not supported */ }
    down = { x: e.clientX, y: e.clientY, at: performance.now() };
    el.classList.remove('holding'); void el.offsetWidth; el.classList.add('holding');
    clearTimeout(t); t = setTimeout(() => { down = null; el.classList.remove('holding'); onOpen(); }, ms);
  });
  el.addEventListener('pointermove', (e) => { if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 40) stop(false); });
  el.addEventListener('pointerup', () => stop(true));
  el.addEventListener('pointercancel', () => stop(false));
  el.addEventListener('lostpointercapture', () => stop(false));
  el.addEventListener('click', (e) => e.preventDefault());      // a plain click never navigates
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}

/** the 🏠 button in every game: hold it to go back to the games menu; a quick tap says how */
export function homeGate(id = 'home') {
  holdGate(document.getElementById(id), () => { location.href = './'; }, { ms: 1200, onTap: () => say('Hold the house to go home!', 'narrator', { priority: 0 }) });
}
