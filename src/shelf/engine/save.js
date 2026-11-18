// Everything Puzzle Shelf remembers, as one JSON blob in localStorage ('ps.v1'), written after every change (§1A.4: a page left
// half-done is exactly as he left it). The child's name and age band are typed into the grown-up corner and stay on this device.
const KEY = 'ps.v1';
const SETTINGS = { name: '', age: '6', look: 'line', labels: 'upper', sound: true, voice: true, looks: {}, spoken: {}, intros: {} };
const blank = () => ({ v: 1, pages: {}, books: {}, last: null, skill: {}, settings: { ...SETTINGS }, album: {}, trophies: {} });

function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1) { const b = blank(); return { ...b, ...s, settings: { ...b.settings, ...s.settings } }; } } catch { /* private mode or damaged */ }
  return blank();
}
export const save = load();
export function commit() { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* storage full or blocked: play on */ } }

export const pageState = (id) => save.pages[id] || null;
export function setPage(id, patch) { save.pages[id] = { ...(save.pages[id] || {}), ...patch }; commit(); }
export function bookDone(book) { return (save.books[book] && save.books[book].done) || {}; }
/** a page is done; returns true when that finished the book's 24 pages (a new trophy) */
export function markDone(book, n) {
  if (!book) return false;
  const b = (save.books[book] ||= { done: {} }); b.done[n] = true;
  if (n > 24) b.endless = Math.max(b.endless || 0, n - 24);
  const full = Array.from({ length: 24 }, (_, i) => i + 1).every((k) => b.done[k]), fresh = full && !save.trophies[book];
  if (fresh) save.trophies[book] = true;
  commit(); return fresh;
}
export function setLast(route) { save.last = route; commit(); }
export function setSetting(k, v) { save.settings[k] = v; commit(); }

// ------------------------------------------------------------------------------------------------ levels and skill (§10)
// A book's page p (1–24) has base level 1 + floor((p − 1) × 9 / 23). A skill number per page type nudges it: finishing with no hints
// moves skill up 0.5; two or more hints move it down 0.5. The page served is the base level pulled halfway toward skill, decided the
// first time the page is opened (so page 7 stays the same page). Starting skill comes from the age band a grown-up sets.
export const START = { '4-5': 1, 6: 3, '7-8': 5 };
export const skillOf = (type) => save.skill[type] ?? START[save.settings.age] ?? 3;
export function nudgeSkill(type, hints) {
  let s = skillOf(type); if (hints === 0) s += 0.5; else if (hints >= 2) s -= 0.5;
  save.skill[type] = Math.max(1, Math.min(10, s)); commit();
}
export const servedLevel = (book, n) => save.books[book]?.served?.[n] ?? null;
export function serveLevel(book, n, level) { const b = (save.books[book] ||= { done: {} }); (b.served ||= {})[n] = level; commit(); }
export function setStartAge(age) { save.settings.age = age; save.skill = {}; commit(); }      // a new age band starts every type afresh
export function resetBook(book) {
  const b = save.books[book]; if (!b) return;
  for (const id of Object.keys(save.pages)) if (id.startsWith(book.split('-')[0] + ':' + book.split('-')[1] + ':')) delete save.pages[id];
  delete save.books[book]; delete save.trophies[book]; commit();
}

// Safari may clear storage for a site that is not installed; ask to keep it (the grown-up corner explains "Add to Home Screen")
try { navigator.storage?.persist?.(); } catch { /* not offered */ }
