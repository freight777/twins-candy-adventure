// Everything Puzzle Shelf remembers, as one JSON blob in localStorage ('ps.v1'), written after every change (§1A.4: a page left
// half-done is exactly as he left it). Nothing about the child is stored here in Phase 0; a grown-up types that in later.
const KEY = 'ps.v1';
const blank = () => ({ v: 1, pages: {}, books: {}, last: null, skill: {}, settings: {} });

function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1) return { ...blank(), ...s }; } catch { /* private mode or damaged */ }
  return blank();
}
export const save = load();
export function commit() { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* storage full or blocked: play on */ } }

export const pageState = (id) => save.pages[id] || null;
export function setPage(id, patch) { save.pages[id] = { ...(save.pages[id] || {}), ...patch }; commit(); }
export function bookDone(book) { return (save.books[book] && save.books[book].done) || {}; }
export function markDone(book, n) { if (!book) return; const b = (save.books[book] ||= { done: {} }); b.done[n] = true; commit(); }
export function setLast(route) { save.last = route; commit(); }

// Safari may clear storage for a site that is not installed; ask to keep it (the grown-up corner explains "Add to Home Screen")
try { navigator.storage?.persist?.(); } catch { /* not offered */ }
