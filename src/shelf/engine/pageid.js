// A page is fully described by type : theme : level : seed (§3). Book page n always uses seed = hash(bookId, n), so page 7 is the
// same page every time it is opened. Never Math.random() in anything that builds a page.
export const pageId = ({ type, theme, level, seed }) => `${type}:${theme}:${level}:${seed}`;
export function parsePage(s) {
  const [type, theme, level, seed] = String(s || '').split(':');
  if (!type || !theme || !(+level >= 1) || !Number.isFinite(+seed)) return null;
  return { type, theme, level: Math.min(10, Math.max(1, +level | 0)), seed: +seed | 0 };
}
/** FNV-1a over the parts joined with '|' → a positive 31-bit seed */
export function hash(...parts) {
  let h = 0x811c9dc5; for (const ch of parts.join('|')) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193); }
  return (h >>> 1) || 1;
}
/** a book's page p (1 … 24) climbs from level 1 to 10 (§10; the skill nudge comes in Phase 4) */
export const baseLevel = (p) => 1 + Math.floor(((p - 1) * 9) / 23);
