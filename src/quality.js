// Graphics quality tiers. The game starts on the best one and quietly steps down if the iPad is struggling.
const TIERS = {
  high:   { pr: 2,   shadow: 2048, bloom: true, post: true },
  medium: { pr: 1.5, shadow: 1024, bloom: true, post: false },
  low:    { pr: 1,   shadow: 0,    bloom: false, post: false },
};
export const ORDER = ['high', 'medium', 'low'];
export const Q = { name: 'high', ...TIERS.high };
const DEFAULT_KEY = 'candyTier';

/** `key` is where the choice is remembered on this device; pass null to switch tiers without remembering. */
export function setTier(name, key = DEFAULT_KEY) {
  if (!TIERS[name]) return;
  Object.assign(Q, { name }, TIERS[name]);
  if (key) { try { localStorage.setItem(key, name); } catch { /* private mode etc. */ } }
}
export function loadTier(key = DEFAULT_KEY) {
  try { const t = localStorage.getItem(key); if (TIERS[t]) setTier(t, key); } catch { /* ignore */ }
}
export function lowerTier(key = DEFAULT_KEY) {
  const i = ORDER.indexOf(Q.name);
  if (i < ORDER.length - 1) { setTier(ORDER[i + 1], key); return true; }
  return false;
}
/** step back up after a long smooth stretch (so one slow moment never leaves a game stuck on low) */
export function raiseTier(key = null) {
  const i = ORDER.indexOf(Q.name);
  if (i > 0) { setTier(ORDER[i - 1], key); return true; }
  return false;
}
