// What Sparkle Match remembers on this device ('sm.v1'): per door, the levels won (each one is a charm; a won party level adds that
// land's friend to the map), and the grown-up settings. Written after every change.
const KEY = 'sm.v1';
const door = () => ({ won: {} });
const blank = () => ({ v: 1, doors: { unicorn: door(), mermaid: door() }, settings: { sound: true, music: true, skin: 'Default', hints: false } });

function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1) { const b = blank(); return { ...b, ...s, doors: { ...b.doors, ...s.doors }, settings: { ...b.settings, ...s.settings } }; } } catch { /* private mode or damaged */ }
  return blank();
}
export const save = load();
export function commit() { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* storage full or blocked: play on */ } }

export const won = (d, n) => !!save.doors[d].won[n];
export const wonCount = (d) => Object.keys(save.doors[d].won).length;
export function markWon(d, n) { const first = !won(d, n); save.doors[d].won[n] = true; commit(); return first; }
/** the stone the friend stands on: the first level not yet won (100 when all are) */
export function current(d) { for (let n = 1; n <= 100; n++) if (!won(d, n)) return n; return 100; }
/** a level can be played once it is won, or is the next one */
export const open = (d, n) => n <= current(d) || won(d, n);
export function resetDoor(d) { save.doors[d] = door(); commit(); }
export function setSetting(k, v) { save.settings[k] = v; commit(); }
