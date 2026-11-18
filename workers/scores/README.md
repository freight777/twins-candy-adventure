# Puzzle Shelf scores Worker (optional)

Puzzle Shelf's Score Spy book normally uses its own made-up house league. This small Cloudflare Worker lets it also show
**last night's real games** on a "Last night" page. It is off in the game until a grown-up turns it on.

What it does:

- Once the game opens (never when the child taps something), the game asks this Worker for yesterday's finals.
- The Worker reads the ESPN scoreboard for the leagues listed in `wrangler.toml`, keeps only finished games, and strips each
  one to the team's place, name, two colours and the scores. **No logos or pictures are passed through.**
- Answers are cached for 15 minutes. Only the game's own address may read them (CORS).
- If anything fails (no network, the feed changes, a slow answer), the game quietly uses the house league. The child never
  sees an error.

## Set it up

1. In this folder: `npx wrangler deploy` (signed in to your Cloudflare account).
2. Note the address it prints, e.g. `https://puzzle-shelf-scores.<you>.workers.dev`.
3. In the game, hold the clock on the shelf for two seconds to open the grown-up corner, tick **Real scores from last night**
   and paste that address.
4. Open Score Spy: a page with a moon on it appears before page 1 the next time the game opens.

## Settings (`wrangler.toml` → `[vars]`)

| Setting | What |
|---|---|
| `ALLOW_ORIGIN` | The game's address. Only this site can read the scores. |
| `TIME_ZONE` | Whose "yesterday" (an IANA zone like `America/Chicago`). |
| `LEAGUES` | `sport/league` paths on the ESPN scoreboard, comma-separated. Examples: `basketball/nba`, `basketball/wnba`, `basketball/mens-college-basketball`, `basketball/womens-college-basketball`, `football/nfl`, `football/college-football`, `hockey/nhl`, `baseball/mlb`, `soccer/usa.1`, `soccer/eng.1`. |

A small-college schedule (a division the ESPN board doesn't carry) can come from `henrygd/ncaa-api` (MIT, self-hostable), which
mirrors ncaa.com scoreboards for every college sport and division: add a second fetch in `worker.js` that maps its games to the
same `{ sport, home, away, homeScore, awayScore }` shape.

## Be careful with

- Both sources are **unofficial** and can change without notice. Check each one's terms and keep this to the family's private game.
- Never add logos, pictures or links to the answer.

The answer looks like:

```json
{ "date": "2026-11-17", "games": [
  { "sport": "basketball", "home": { "place": "Boston", "nick": "Celtics", "colors": ["#008348", "#ffffff"] },
    "away": { "place": "Miami", "nick": "Heat", "colors": ["#98002e", "#000000"] }, "homeScore": 112, "awayScore": 104 } ] }
```
