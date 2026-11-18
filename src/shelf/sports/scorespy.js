// Score Spy (§9): a wall of scoreboards, each with two badges, two names and two scores, and spoken clues to answer by tapping.
// Scores look real for their sport (football totals built from 7s and 3s, basketball in the 50–120s, soccer and hockey in goals).
// Every clue has exactly one right answer — the generator only offers clues it has checked, and the test checks them again.
//   level 1–2  "Find the Hawks." / "Find a 7."                       team names, digits
//   level 3–4  "Find the game where the Otters scored 24."           two-digit numbers
//   level 5–6  "Which team beat the Bears?" / "Find a tie."          comparing
//   level 7–8  "Find the highest score on the wall."                 three-digit numbers, greatest
//   level 9–10 "Who won by 3?" / "Find the game with the most points altogether."   difference, sum
import { rng } from '../maze/gen.js';

const weighted = (r, w) => { let t = r() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < w.length; i++) if ((t -= w[i]) < 0) return i; return w.length - 1; };
export const SPORTS = {
  soccer: (r) => [weighted(r, [22, 28, 22, 14, 8, 4, 2]), weighted(r, [22, 28, 22, 14, 8, 4, 2])],
  hockey: (r) => [weighted(r, [10, 18, 24, 20, 14, 8, 6]), weighted(r, [10, 18, 24, 20, 14, 8, 6])],
  football: (r) => [0, 0].map(() => 7 * weighted(r, [6, 14, 22, 24, 18, 10, 6]) + 3 * weighted(r, [30, 34, 24, 12])),
  basketball: (r) => { const a = 64 + ((r() * 48) | 0); let b = a + ((r() - 0.5) * 34) | 0; if (b === a) b += 2; return [a, Math.max(50, Math.min(120, b))]; },
};
export const LEVELS = [null,
  { boards: 8, sports: ['soccer', 'hockey'], kinds: ['team', 'number'], clues: 4 },
  { boards: 9, sports: ['soccer', 'hockey'], kinds: ['team', 'number'], clues: 4 },
  { boards: 10, sports: ['football'], kinds: ['teamScored', 'team'], clues: 5 },
  { boards: 11, sports: ['football', 'soccer'], kinds: ['teamScored', 'number'], clues: 5 },
  { boards: 12, sports: ['soccer', 'hockey', 'football'], kinds: ['beat', 'tie'], clues: 5 },
  { boards: 13, sports: ['soccer', 'hockey', 'football'], kinds: ['beat', 'tie', 'teamScored'], clues: 5 },
  { boards: 15, sports: ['basketball'], kinds: ['highest', 'number', 'teamScored', 'beat'], clues: 6 },
  { boards: 16, sports: ['basketball'], kinds: ['highest', 'lowest', 'number', 'teamScored', 'beat'], clues: 6 },
  { boards: 18, sports: ['basketball', 'football'], kinds: ['wonBy', 'mostPoints', 'beat'], clues: 6 },
  { boards: 20, sports: ['basketball', 'football'], kinds: ['wonBy', 'mostPoints', 'lowest', 'beat'], clues: 6 },
];

/** every board on the wall: { sport, teams: [teamId, teamId], scores: [a, b] } */
function makeWall(L, teams, r) {
  return Array.from({ length: L.boards }, () => {
    const sport = L.sports[(r() * L.sports.length) | 0], a = (r() * teams.length) | 0; let b = (r() * (teams.length - 1)) | 0; if (b >= a) b++;
    return { sport, teams: [teams[a].id, teams[b].id], scores: SPORTS[sport](r) };
  });
}

/** all the clues of a kind that have exactly one answer on this wall. A clue: { kind, words: [...], answer: { g, side|null } } —
 *  side null means tapping anywhere on that board is right; a side means that team's row */
export function cluesOf(kind, wall, teams) {
  const out = [], nick = (id) => teams.find((t) => t.id === id).nick;
  const where = (id) => { const at = []; wall.forEach((b, g) => b.teams.forEach((t, side) => t === id && at.push({ g, side }))); return at; };
  const allIds = [...new Set(wall.flatMap((b) => b.teams))];
  const scores = wall.flatMap((b, g) => b.scores.map((s, side) => ({ s, g, side })));
  if (kind === 'team') for (const id of allIds) { const at = where(id); if (at.length === 1) out.push({ kind, team: id, words: ['Find the', nick(id)], answer: { g: at[0].g, side: null } }); }
  if (kind === 'number') for (const s of new Set(scores.map((x) => x.s))) { const at = scores.filter((x) => x.s === s); if (at.length === 1) out.push({ kind, n: s, words: ['Find a', s], answer: { g: at[0].g, side: null } }); }
  if (kind === 'teamScored') for (const id of allIds) { const at = where(id); if (at.length === 1) out.push({ kind, team: id, n: wall[at[0].g].scores[at[0].side], words: ['Find the game where the', nick(id), 'scored', wall[at[0].g].scores[at[0].side]], answer: { g: at[0].g, side: null } }); }
  if (kind === 'beat') for (const id of allIds) {
    const at = where(id); if (at.length !== 1) continue; const b = wall[at[0].g], me = at[0].side, them = 1 - me;
    if (b.scores[them] > b.scores[me]) out.push({ kind, team: id, words: ['Which team beat the', nick(id)], answer: { g: at[0].g, side: them } });
  }
  if (kind === 'tie') { const ties = wall.map((b, g) => (b.scores[0] === b.scores[1] ? g : -1)).filter((g) => g >= 0); if (ties.length === 1) out.push({ kind, words: ['Find a tie!'], answer: { g: ties[0], side: null } }); }
  if (kind === 'highest' || kind === 'lowest') {
    const best = (kind === 'highest' ? Math.max : Math.min)(...scores.map((x) => x.s)), at = scores.filter((x) => x.s === best);
    if (at.length === 1) out.push({ kind, words: [kind === 'highest' ? 'Find the highest score on the wall!' : 'Find the lowest score on the wall!'], answer: { g: at[0].g, side: at[0].side } });
  }
  if (kind === 'wonBy') for (let d = 1; d <= 30; d++) {
    const at = wall.map((b, g) => (Math.abs(b.scores[0] - b.scores[1]) === d ? g : -1)).filter((g) => g >= 0);
    if (at.length === 1) { const b = wall[at[0]]; out.push({ kind, d, words: ['Who won by', d], answer: { g: at[0], side: b.scores[0] > b.scores[1] ? 0 : 1 } }); }
  }
  if (kind === 'mostPoints') { const tot = wall.map((b) => b.scores[0] + b.scores[1]), m = Math.max(...tot), at = tot.map((t, g) => (t === m ? g : -1)).filter((g) => g >= 0); if (at.length === 1) out.push({ kind, words: ['Find the game with the most points altogether!'], answer: { g: at[0], side: null } }); }
  return out;
}

/** a Score Spy page: the wall and its clues (every one with exactly one answer, each on a different board) */
export function makeScoreSpy({ level, seed }, teams) {
  const L = LEVELS[level], r = rng(seed ^ 0x5c0e5);
  for (let attempt = 0; attempt < 60; attempt++) {
    const wall = makeWall(L, teams, r), picked = [], used = new Set();
    const pools = L.kinds.map((k) => { const c = cluesOf(k, wall, teams); for (let i = c.length - 1; i > 0; i--) { const j = (r() * (i + 1)) | 0; [c[i], c[j]] = [c[j], c[i]]; } return c; });
    for (let n = 0; picked.length < L.clues && n < 200; n++) {                  // take the kinds in turn so a page mixes them
      const pool = pools[n % pools.length], c = pool.find((x) => !used.has(x.answer.g)); if (!c) continue;
      pool.splice(pool.indexOf(c), 1); used.add(c.answer.g); picked.push(c);
    }
    if (picked.length === L.clues) return { level, wall, clues: picked };
  }
  throw new Error(`no Score Spy wall for level ${level} seed ${seed}`);
}
