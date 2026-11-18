// Try the Worker's parser on yesterday's real scoreboards (public ESPN JSON; no keys, nothing sent but the date).
// Run: node workers/scores/test.mjs [YYYYMMDD]   — prints each league's finished games as the game would get them.
import { league, yesterday } from './worker.js';

const date = process.argv[2] || yesterday('America/New_York').compact;
const LEAGUES = ['basketball/nba', 'basketball/wnba', 'basketball/womens-college-basketball', 'football/nfl', 'hockey/nhl', 'baseball/mlb', 'soccer/usa.1'];
let all = 0;
for (const p of LEAGUES) {
  const games = await league(p, date).catch((e) => { console.log(p, 'failed:', e.message); return []; });
  all += games.length;
  console.log(`${p.padEnd(40)} ${games.length} finished`);
  for (const g of games.slice(0, 2)) console.log(`   ${g.away.place} ${g.away.nick} ${g.awayScore} at ${g.home.place} ${g.home.nick} ${g.homeScore}  ${g.home.colors.join(' ')}`);
  for (const g of games) for (const t of [g.home, g.away]) if (!t.nick || !/^#[0-9a-f]{6}$/.test(t.colors[0]) || /http|logo/i.test(JSON.stringify(t))) throw new Error(`odd team in ${p}: ${JSON.stringify(t)}`);
}
console.log(`${date}: ${all} games, all clean (names, colours, scores; no logos or links)`);
