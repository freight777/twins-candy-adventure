// Puzzle Shelf scores Worker (§9, Phase 6, optional). Fetches yesterday's finals for the sports you choose, strips each game to
// names, colours and scores — never logos — caches the answer for 15 minutes, and serves it to the game with CORS for the game's
// own address only. The game asks once when it opens and never shows an error, so if a source changes it simply goes quiet.
//
// Sources: the community-documented ESPN scoreboard JSON (unofficial; can change without notice). Keep this to the family's private
// game, check the source's terms, and never pass logos or images through. Setup and settings: README.md beside this file.
//
// GET /            → { date: 'YYYY-MM-DD', games: [{ sport, home: { place, nick, colors: [c1, c2] }, away: {…}, homeScore, awayScore }] }

const SPORT_OF = { basketball: 'basketball', football: 'football', hockey: 'hockey', soccer: 'soccer', baseball: 'baseball' };
const clean = (s, n = 24) => String(s ?? '').replace(/[^\p{L}\p{N} .&'-]/gu, '').trim().slice(0, n);
const hex = (c) => (/^[0-9a-f]{6}$/i.test(c || '') ? '#' + c.toLowerCase() : null);

/** yesterday in the family's time zone, as YYYYMMDD and YYYY-MM-DD */
function yesterday(tz) {
  const d = new Date(Date.now() - 864e5), p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d).map((x) => [x.type, x.value]));
  return { compact: `${p.year}${p.month}${p.day}`, iso: `${p.year}-${p.month}-${p.day}` };
}

/** one league's finished games from the ESPN scoreboard, e.g. path 'basketball/nba' */
async function league(path, date) {
  const sport = SPORT_OF[path.split('/')[0]]; if (!sport) return [];
  const r = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${path}/scoreboard?dates=${date}`, { cf: { cacheTtl: 900 } });
  if (!r.ok) return [];
  const data = await r.json(), out = [];
  for (const ev of data.events || []) {
    const comp = ev.competitions?.[0]; if (!comp?.status?.type?.completed) continue;
    const side = (where) => comp.competitors?.find((c) => c.homeAway === where);
    const team = (c) => ({ place: clean(c.team?.location), nick: clean(c.team?.name || c.team?.shortDisplayName), colors: [hex(c.team?.color) || '#1f6fb2', hex(c.team?.alternateColor) || '#ffffff'] });
    const h = side('home'), a = side('away'), hs = parseInt(h?.score, 10), as = parseInt(a?.score, 10);
    if (h && a && Number.isInteger(hs) && Number.isInteger(as)) out.push({ sport, home: team(h), away: team(a), homeScore: hs, awayScore: as });
  }
  return out;
}

export { league, yesterday };                                   // for tests (workers/scores/test.mjs)

export default {
  async fetch(request, env, ctx) {
    const origin = env.ALLOW_ORIGIN || 'https://freight777.github.io', cors = { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin' };
    if (request.method === 'OPTIONS') return new Response(null, { headers: { ...cors, 'Access-Control-Allow-Methods': 'GET' } });
    if (request.method !== 'GET') return new Response('', { status: 405, headers: cors });
    const cache = caches.default, key = new Request(new URL('/scores', request.url).toString());
    const hit = await cache.match(key); if (hit) { const r = new Response(hit.body, hit); Object.entries(cors).forEach(([k, v]) => r.headers.set(k, v)); return r; }
    const { compact, iso } = yesterday(env.TIME_ZONE || 'America/New_York');
    const leagues = (env.LEAGUES || 'basketball/nba,basketball/wnba,basketball/womens-college-basketball,football/nfl,hockey/nhl,baseball/mlb,soccer/usa.1').split(',').map((s) => s.trim()).filter(Boolean);
    const games = (await Promise.all(leagues.map((p) => league(p, compact).catch(() => [])))).flat().slice(0, 60);
    const res = new Response(JSON.stringify({ date: iso, games }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=900' } });
    ctx.waitUntil(cache.put(key, res.clone()));
    Object.entries(cors).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  },
};
