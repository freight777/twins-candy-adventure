// Score Spy (§9): 500 walls per level, with and without My Teams — every clue has exactly one right answer (checked here from
// scratch, not by the generator's own code), no two clues share a board, scores look real for their sport, and a page is the same
// page every time. Run: node tests/shelf/scorespy.test.js [walls per level = 500]
import assert from 'node:assert/strict';
import { makeScoreSpy, LEVELS } from '../../src/shelf/sports/scorespy.js';
import { allTeams } from '../../src/shelf/sports/teams.js';
import { clean, makeLastNight } from '../../src/shelf/sports/lastnight.js';
import { rng } from '../../src/shelf/maze/gen.js';

const N = +process.argv[2] || 500;
const MINE = [{ nick: 'Wildcats', place: 'Home Town', mascot: '1F408', colors: ['#552583', '#fdb927'] }, { nick: 'Rovers', mascot: '1F415', colors: ['#00338d', '#c60c30'] }];
/** every (board, side) the clue could mean, worked out independently */
function answers(c, wall, teams) {
  const nickOf = (id) => teams.find((t) => t.id === id).nick, cells = wall.flatMap((b, g) => [0, 1].map((side) => ({ g, side, b })));
  const sum = (b) => b.scores[0] + b.scores[1];
  switch (c.kind) {
    case 'team': return [...new Set(cells.filter((x) => nickOf(x.b.teams[x.side]) === c.words[1]).map((x) => x.g))].map((g) => ({ g }));
    case 'number': return [...new Set(cells.filter((x) => x.b.scores[x.side] === c.n).map((x) => x.g))].map((g) => ({ g }));
    case 'teamScored': return [...new Set(cells.filter((x) => nickOf(x.b.teams[x.side]) === c.words[1] && x.b.scores[x.side] === c.n).map((x) => x.g))].map((g) => ({ g }));
    case 'beat': return cells.filter((x) => nickOf(x.b.teams[1 - x.side]) === c.words[1] && x.b.scores[x.side] > x.b.scores[1 - x.side]).map(({ g, side }) => ({ g, side }));
    case 'tie': return wall.map((b, g) => ({ g, b })).filter((x) => x.b.scores[0] === x.b.scores[1]).map(({ g }) => ({ g }));
    case 'highest': { const m = Math.max(...cells.map((x) => x.b.scores[x.side])); return cells.filter((x) => x.b.scores[x.side] === m).map(({ g, side }) => ({ g, side })); }
    case 'lowest': { const m = Math.min(...cells.map((x) => x.b.scores[x.side])); return cells.filter((x) => x.b.scores[x.side] === m).map(({ g, side }) => ({ g, side })); }
    case 'wonBy': return cells.filter((x) => x.b.scores[x.side] - x.b.scores[1 - x.side] === c.d).map(({ g, side }) => ({ g, side }));
    case 'mostPoints': { const m = Math.max(...wall.map(sum)); return wall.map((b, g) => ({ g, b })).filter((x) => sum(x.b) === m).map(({ g }) => ({ g })); }
    default: throw new Error(c.kind);
  }
}
const real = { soccer: (s) => s >= 0 && s <= 9, hockey: (s) => s >= 0 && s <= 9, basketball: (s) => s >= 50 && s <= 120, football: (s) => { for (let a = 0; a * 7 <= s; a++) if ((s - a * 7) % 3 === 0) return true; return false; } };
let pages = 0, clues = 0;
for (const mine of [[], MINE]) {
  const teams = allTeams(mine);
  for (let level = 1; level <= 10; level++) for (let s = 1; s <= N; s++) {
    const seed = s * 7919 + level, p = makeScoreSpy({ level, seed }, teams), tag = `L${level} s${seed}${mine.length ? ' +mine' : ''}`;
    assert.equal(p.wall.length, LEVELS[level].boards, `${tag}: board count`);
    assert.equal(p.clues.length, LEVELS[level].clues, `${tag}: clue count`);
    for (const b of p.wall) { assert.notEqual(b.teams[0], b.teams[1], `${tag}: two different teams`); for (const s2 of b.scores) assert.ok(real[b.sport](s2), `${tag}: ${b.sport} score ${s2} looks real`); }
    assert.equal(new Set(p.clues.map((c) => c.answer.g)).size, p.clues.length, `${tag}: each clue on a different board`);
    for (const c of p.clues) {
      assert.ok(LEVELS[level].kinds.includes(c.kind), `${tag}: ${c.kind} belongs to this level`);
      const a = answers(c, p.wall, teams);
      assert.equal(a.length, 1, `${tag}: "${c.words.join(' ')}" has ${a.length} answers`);
      assert.equal(a[0].g, c.answer.g, `${tag}: the answer is the right board`);
      if (c.answer.side !== null) assert.equal(a[0].side, c.answer.side, `${tag}: the answer is the right team`);
      clues++;
    }
    pages++;
  }
}
assert.deepEqual(makeScoreSpy({ level: 6, seed: 42 }, allTeams()), makeScoreSpy({ level: 6, seed: 42 }, allTeams()), 'the same page every time');
// real scores (Phase 6): the feed is cleaned of anything odd, and a Last night page's clues have exactly one answer too — even with
// two teams called the Giants, a team that played twice, ties, blowouts and very few games
const PLACES = ['New York', 'San Francisco', 'Boston', 'Miami', 'Denver', 'Dallas', 'Seattle', 'Chicago'], NICKS = ['Giants', 'Kings', 'Hawks', 'Stars', 'Heat', 'Bears', 'Storm', 'Sky', 'Comets', 'Wings'];
let nights = 0, realClues = 0;
for (let s = 1; s <= N * 2; s++) {
  const r = rng(s), n = 3 + ((r() * 18) | 0), sport = ['basketball', 'football', 'hockey', 'soccer', 'baseball'][s % 5];
  const t = () => ({ place: PLACES[(r() * PLACES.length) | 0], nick: NICKS[(r() * NICKS.length) | 0], colors: ['#123456', 'zzz'] });
  const top = sport === 'basketball' ? 130 : 8;
  const feed = clean({ date: '2026-11-17', games: [...Array.from({ length: n }, () => ({ sport, home: t(), away: t(), homeScore: (r() * top) | 0, awayScore: (r() * top) | 0 })),
    { sport: 'cricket', home: t(), away: t(), homeScore: 1, awayScore: 2 }, { sport, home: t(), away: t(), homeScore: -3, awayScore: 2 },
    { sport, home: { nick: '<b>x</b>' }, away: t(), homeScore: '7', awayScore: 1.5 }, null] });
  for (const g of feed.games) {
    assert.ok(Number.isInteger(g.homeScore) && g.homeScore >= 0 && Number.isInteger(g.awayScore), 'scores are whole numbers');
    assert.match(g.home.colors[1], /^#[0-9a-f]{6}$/, 'colours are colours'); assert.ok(!/[<>]/.test(g.home.nick + g.away.nick), 'no markup in names');
  }
  assert.ok(feed.games.length <= n, 'odd games dropped');
  for (const level of [1, 3, 5, 7, 9]) {
    const p = makeLastNight(feed, level, s); if (!p) continue;
    assert.ok(p.clues.length >= 3, 'at least three clues');
    assert.equal(new Set(p.clues.map((c) => c.answer.g)).size, p.clues.length, 'each clue on a different board');
    for (const c of p.clues) {
      const a = answers(c, p.wall, p.teams);
      assert.equal(a.length, 1, `night ${s} L${level}: "${c.words.join(' ')}" has ${a.length} answers`);
      assert.equal(a[0].g, c.answer.g); if (c.answer.side !== null) assert.equal(a[0].side, c.answer.side);
      realClues++;
    }
    for (const tm of p.teams) assert.equal(tm.mascot, null, 'real teams have no mascot (and never a logo)');
    nights++;
  }
}
assert.ok(nights > N, `Last night pages get made (${nights})`);
assert.equal(clean({ games: 'nope' }).games.length, 0); assert.equal(clean(null).games.length, 0);
console.log(`scorespy ok (${pages} walls, ${clues} clues, ${nights} real-score pages with ${realClues} clues; every one with exactly one answer)`);
