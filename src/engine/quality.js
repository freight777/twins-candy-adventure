// Graphics quality tiers, shared by every game. Each game remembers its own choice (key = the page name), the automatic
// adjustment never writes anything down, and a game that stepped down for a slow moment can step back up later.
const TIERS = {
  high:   { pr: 1.5,  shadow: 2048, bloom: true,  post: true  },   // pixel ratio 1.5 looks the same as 2 on a 264-ppi iPad and costs far less
  medium: { pr: 1.25, shadow: 1024, bloom: true,  post: false },
  low:    { pr: 1,    shadow: 0,    bloom: false, post: false },
};
export const ORDER = ['high', 'medium', 'low'];
export const Q = { name: 'medium', ...TIERS.medium };
/** auto.on = false when a grown-up picked a tier by hand (then nothing changes it automatically) */
export const auto = { on: true };

const coarse = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
const isIPad = () => navigator.maxTouchPoints > 1 && /Mac|iPad/.test(navigator.platform);
const key = () => `tier:${location.pathname.split('/').pop() || 'hub'}`;   // per game, not shared
const deviceDefault = () => (isIPad() || coarse() ? 'medium' : 'high');

export function setTier(name, persist = false) {
  if (!TIERS[name]) return;
  Object.assign(Q, { name }, TIERS[name]);
  if (persist) try { localStorage.setItem(key(), name); } catch { /* private mode */ }
}
export function loadTier() {
  let t = null;
  try {
    ['candyTier', 'derbyTier', 'derbyGfx'].forEach((k) => localStorage.removeItem(k));   // the old shared keys could pin every game to "low" forever
    t = localStorage.getItem(key());
  } catch { /* ignore */ }
  auto.on = !TIERS[t];
  setTier(TIERS[t] ? t : deviceDefault());
}
/** the grown-ups menu is the only thing that remembers a choice; null = back to automatic */
export function chooseTier(name) {
  if (name && TIERS[name]) { setTier(name, true); auto.on = false; return; }
  try { localStorage.removeItem(key()); } catch { /* ignore */ }
  auto.on = true; setTier(deviceDefault());
}

// Automatic adjustment with hysteresis: step down when most of the last 150 frames were slow (at most twice per visit),
// step back up after ~15 s of steady 60 fps (at most once a minute) — but never above the device's own default, so an iPad never
// "probes" high and then hitches back down on the first heavy scene.
let frames = 0, slow = 0, fast = 0, lastChange = 0, lowered = 0;
export function applyAutoTier(dt) {
  if (!auto.on || dt > .5 || (typeof document !== 'undefined' && document.hidden)) return false;
  const now = performance.now(); frames++;
  if (dt > .034) { slow++; fast = 0; } else if (dt < .02) fast++; else fast = 0;
  if (frames >= 150) {
    const drop = slow > 80 && now - lastChange > 8000 && lowered < 2;
    frames = slow = 0;
    if (drop) { if (lowerTier()) { lastChange = now; lowered++; fast = 0; return true; } }
  }
  if (fast > 900 && now - lastChange > 60000 && ORDER.indexOf(Q.name) > ORDER.indexOf(deviceDefault()) && raiseTier()) { lastChange = now; fast = 0; return true; }
  return false;
}
export function lowerTier() { const i = ORDER.indexOf(Q.name); if (i < ORDER.length - 1) { setTier(ORDER[i + 1]); return true; } return false; }
export function raiseTier() { const i = ORDER.indexOf(Q.name); if (i > 0) { setTier(ORDER[i - 1]); return true; } return false; }
/** call when the page comes back into view so the hitch on resume isn't counted */
export function resetAutoTier() { frames = slow = fast = 0; lastChange = Math.max(lastChange, performance.now() - 6000); }
