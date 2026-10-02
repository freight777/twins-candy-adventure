// Graphics quality tiers. The game starts on the best one and quietly steps down if the iPad is struggling.
const TIERS = {
  high:   { pr: 2,   shadow: 2048, bloom: true },
  medium: { pr: 1.5, shadow: 1024, bloom: true },
  low:    { pr: 1,   shadow: 0,    bloom: false },
};
export const ORDER = ['high', 'medium', 'low'];
export const Q = { name: 'high', ...TIERS.high };

export function setTier(name) {
  if (!TIERS[name]) return;
  Object.assign(Q, { name }, TIERS[name]);
  try { localStorage.setItem('candyTier', name); } catch { /* private mode etc. */ }
}
export function loadTier() {
  try { const t = localStorage.getItem('candyTier'); if (TIERS[t]) setTier(t); } catch { /* ignore */ }
}
export function lowerTier() {
  const i = ORDER.indexOf(Q.name);
  if (i < ORDER.length - 1) { setTier(ORDER[i + 1]); return true; }
  return false;
}
