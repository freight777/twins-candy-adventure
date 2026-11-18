// Real scores (§9, Phase 6 — optional, off by default). A grown-up turns it on in the grown-up corner and pastes the address of
// the small scores Worker (workers/scores/). The game fetches once when it opens (never because the child tapped something),
// keeps last night's finals on this device, and Score Spy gets a "Last night" page made from them. Anything that goes wrong — no
// network, a slow answer, a changed feed — is silent: no page, no message, the house league as always.
// Real teams get a shield in their colours with their initials only: no logos, no mascots.
import { save } from '../engine/save.js';
import { cluesOf } from './scorespy.js';
import { rng } from '../maze/gen.js';

const KEY = 'ps.scores', SPORTS = ['basketball', 'football', 'hockey', 'soccer', 'baseball'];
const str = (v, n = 24) => (typeof v === 'string' ? v.replace(/[^\p{L}\p{N} .&'-]/gu, '').trim().slice(0, n) : '');
const colour = (v, d) => (/^#?[0-9a-f]{6}$/i.test(v || '') ? '#' + String(v).replace('#', '').toLowerCase() : d);
const score = (v) => { const n = Number(v); return Number.isInteger(n) && n >= 0 && n <= 199 ? n : null; };

/** keep only what the game needs, in the shape it expects; drop anything odd */
export function clean(feed) {
  const games = [];
  for (const g of Array.isArray(feed?.games) ? feed.games.slice(0, 60) : []) {
    const sport = SPORTS.includes(g?.sport) ? g.sport : null, hs = score(g?.homeScore), as = score(g?.awayScore);
    const team = (t, d) => ({ place: str(t?.place), nick: str(t?.nick || t?.name), colors: [colour(t?.colors?.[0], d), colour(t?.colors?.[1], '#ffffff')] });
    const home = team(g?.home, '#1f6fb2'), away = team(g?.away, '#c1272d');
    if (sport && hs !== null && as !== null && home.nick && away.nick && home.place + home.nick !== away.place + away.nick) games.push({ sport, home, away, homeScore: hs, awayScore: as });
  }
  return { date: str(feed?.date, 10), games };
}

/** on opening the game: fetch last night's finals if a grown-up turned it on; at most once an hour; silent on any failure */
export async function refreshScores() {
  const s = save.settings; if (!s.realScores || !/^https:\/\//.test(s.scoresURL || '')) return;
  try {
    const had = JSON.parse(localStorage.getItem(KEY) || 'null'); if (had && Date.now() - had.fetched < 36e5) return;
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 6000);
    const r = await fetch(s.scoresURL, { signal: ctl.signal, credentials: 'omit', cache: 'no-store' }); clearTimeout(timer);
    if (!r.ok) return;
    const feed = clean(await r.json());
    if (feed.games.length >= 3) localStorage.setItem(KEY, JSON.stringify({ fetched: Date.now(), ...feed }));
  } catch { /* quiet: the house league as always */ }
}
/** last night's games if real scores are on and the games are fresh (two days at most), else null */
export function lastNight() {
  if (!save.settings.realScores) return null;
  try { const had = JSON.parse(localStorage.getItem(KEY) || 'null'); return had && Date.now() - had.fetched < 2 * 864e5 && had.games.length >= 3 ? had : null; } catch { return null; }
}
export const forgetScores = () => { try { localStorage.removeItem(KEY); } catch { /* fine */ } };

// the clue kinds for his level, as on the house-league pages
const KINDS = (level) => (level <= 2 ? ['team'] : level <= 4 ? ['team', 'teamScored'] : level <= 6 ? ['beat', 'teamScored', 'tie'] : level <= 8 ? ['highest', 'beat', 'teamScored'] : ['wonBy', 'mostPoints', 'beat']);

/** a Score Spy page from real games: { level, wall, clues, teams } (teams say their own names with the device voice), or null */
export function makeLastNight(feed, level, seed = 1) {
  const r = rng(seed ^ 0x1a57), games = feed.games.slice();
  for (let i = games.length - 1; i > 0; i--) { const j = (r() * (i + 1)) | 0; [games[i], games[j]] = [games[j], games[i]]; }
  const teams = [], idOf = (t) => { let k = teams.findIndex((x) => x.nick === t.nick && x.place === t.place); if (k < 0) { teams.push({ id: `r${teams.length}`, ...t, mascot: null, house: false }); k = teams.length - 1; } return teams[k].id; };
  const wall0 = games.slice(0, Math.min(16, Math.max(6, 4 + level * 1.2 | 0))).map((g) => ({ sport: g.sport, teams: [idOf(g.away), idOf(g.home)], scores: [g.awayScore, g.homeScore] })), wall = wall0;
  const twice = teams.filter((t) => teams.some((u) => u !== t && u.nick === t.nick));                          // two Giants: say which, all of them
  for (const t of twice) { t.nick = (t.place + ' ' + t.nick).trim(); t.place = ''; }
  const want = Math.min(6, 3 + (level >> 2)), picked = [], used = new Set();
  const pools = KINDS(level).map((k) => cluesOf(k, wall, teams));
  for (let n = 0; picked.length < want && n < 200; n++) { const pool = pools[n % pools.length], c = pool.find((x) => !used.has(x.answer.g)); if (!c) continue; pool.splice(pool.indexOf(c), 1); used.add(c.answer.g); picked.push(c); }
  if (picked.length < 3) { for (const c of cluesOf('team', wall, teams)) if (picked.length < want && !used.has(c.answer.g)) { used.add(c.answer.g); picked.push(c); } }
  return picked.length >= 3 ? { level, wall, clues: picked, teams } : null;
}
