// One learning profile per child, shared by every game. Pure data in localStorage on this device only (no network).
// Items (e.g. 'snd:m', 'word:cat', 'count:7', 'add:5') sit in Leitner boxes 0..4; a strand's level moves up AND down
// on a rolling window of first-try results, so a lucky streak can't strand a child on work that is too hard.
const KEY = 'ae:learn:v2';
const blank = () => ({ reading: { level: 0, hist: [] }, math: { level: 0, hist: [] }, items: {}, stickers: [], sessions: 0, lastPlayed: 0 });
const DEFAULT_SETTINGS = { on: true, every: 1, voice: true, maxPerSession: 12, level: 'auto', mathLevel: 'auto', scaffoldNew: true, retry: true, bedtime: false };
let data = { adalyn: blank(), esmae: blank(), tony: blank(), settings: { ...DEFAULT_SETTINGS } };
try {
  const s = JSON.parse(localStorage.getItem(KEY));
  if (s) data = { ...data, ...s, settings: { ...DEFAULT_SETTINGS, ...s.settings } };
  else migrateV1();
} catch { /* first run, private mode */ }

/** Candy Adventure's old store ('candyLearn1': levels 0-2 that only went up) maps onto the new levels 0/2/4 */
function migrateV1() {
  const old = JSON.parse(localStorage.getItem('candyLearn1') || 'null'); if (!old) return;
  for (const who of ['adalyn', 'esmae']) { const lv = old.kids?.[who]?.level; if (lv != null) data[who].reading.level = [0, 2, 4][Math.max(0, Math.min(2, lv))]; }
  if (old.settings) { data.settings.on = old.settings.on !== false; data.settings.retry = old.settings.retry !== false; }
  save(); localStorage.removeItem('candyLearn1');
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* storage full / private mode */ } }

export const settings = data.settings;
/** questions are asked when a grown-up has them on, and never in bedtime mode */
export const questionsOn = () => settings.on && !settings.bedtime;
export const saveSettings = save;
export const kid = (who) => data[who] || (data[who] = blank());
export const MAX = { reading: 6, math: 6 };

/** Leitner gaps in minutes, not days: sessions are short and frequent */
const GAP = [0, 1, 3, 7, 30].map((m) => m * 60_000);
export function item(who, id) { const k = kid(who); return k.items[id] || (k.items[id] = { box: 0, seen: 0, right: 0, nextAt: 0, last: 0 }); }
export function recordItem(who, id, correct, first) {
  const it = item(who, id); it.seen++; it.last = Date.now();
  if (correct && first) { it.right++; it.box = Math.min(4, it.box + 1); } else if (!correct) it.box = Math.max(0, it.box - 1);   // right after help: stays put
  it.nextAt = Date.now() + GAP[it.box]; save();
}
/** weighted pick: never-seen items 3x, due items 3x, low boxes favoured, and never the same id twice in a row */
export function choose(who, ids, avoid) {
  const now = Date.now(), items = kid(who).items;
  const w = ids.map((id) => { if (id === avoid && ids.length > 1) return 0; const it = items[id]; if (!it) return 3; let x = 1 + (4 - it.box) * .5; if (it.nextAt <= now) x *= 3; return x; });
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < ids.length; i++) { r -= w[i]; if (r <= 0) return ids[i]; }
  return ids[ids.length - 1];
}
/** level up on 5 of the last 6 first-try right, down on 2 or fewer — encouraging but honest */
export function recordSkill(who, strand, correct, first) {
  const s = kid(who)[strand]; s.hist.push(correct && first ? 1 : 0); if (s.hist.length > 6) s.hist.shift();
  const sum = s.hist.reduce((a, b) => a + b, 0);
  if (s.hist.length === 6) { if (sum >= 5 && s.level < MAX[strand]) { s.level++; s.hist = []; } else if (sum <= 2 && s.level > 0) { s.level--; s.hist = []; } }
  save(); return s.level;
}
/** a grown-up can pin a level in the menu ('auto' = follow the child) */
export function levelOf(who, strand) {
  const pinned = strand === 'math' ? settings.mathLevel : settings.level;
  return pinned === 'auto' || pinned == null ? kid(who)[strand].level : Math.max(0, Math.min(MAX[strand], Number(pinned)));
}
/** keep one small fact about a child on this device (Derby: her best number of home runs) */
export function remember(who, key, value) { kid(who)[key] = value; save(); }
export function award(who, sticker) { const k = kid(who); if (k.stickers.includes(sticker)) return false; k.stickers.push(sticker); save(); return true; }
export function startSession(who) { const k = kid(who); k.sessions++; k.lastPlayed = Date.now(); save(); }
export function resetKid(who) { data[who] = blank(); save(); }
/** for the grown-ups progress page; stays on this device */
export const exportJSON = () => JSON.stringify(data, null, 2);
export const allKids = () => ['adalyn', 'esmae', 'tony'].map((who) => [who, kid(who)]);
