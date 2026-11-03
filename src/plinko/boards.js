// The two Sparkle Plinko boards. They share one layout (the launch lane on the right, a dome over the top, a field of pegs
// with seven big bumpers, kickers on the sides, seven prize slots) and differ in everything you see and hear.
// World units: the board is 560 x 860; the game scales it to the screen.
export const W = 560, H = 860;
export const L = 14, LANE_X = 506, R = 546;            // play area 14..506, launch lane 506..546
export const DOME = { cx: 280, cy: 232, rx: 266, ry: 212 };
export const GATE_Y = 330, PLUNGER_Y = 800, BALL_R = 11;
export const SLOT_TOP = 742, FLOOR = 846;
export const MULTS = [1, 2, 3, 10, 3, 2, 1];
export const SLOT_W = (LANE_X - L) / MULTS.length;
export const MOVER_Y = 300;
/** bumper value climbs every few hits: 10, 20, 30, 50 */
export const BUMP_VALUES = [10, 20, 30, 50], HITS_PER_LEVEL = 5;

export const BUMPERS = [[180, 432], [340, 432], [100, 522], [260, 522], [420, 522], [180, 612], [340, 612]];

/** pegs in staggered rows, leaving room around the bumpers and the kickers */
export function pegLayout() {
  const pegs = [];
  for (let row = 0; row < 10; row++) {
    const y = 340 + row * 40, off = row % 2 ? 24.5 : 0;
    for (let x = 40 + off; x < LANE_X - 18; x += 49) {
      if (x < L + 40 || x > LANE_X - 40) continue;      // never closer to a wall than a ball is wide: it would wedge there
      if (y < 380 && x > LANE_X - 70) continue;          // keep the mouth of the launch lane clear
      if (BUMPERS.some(([bx, by]) => Math.hypot(bx - x, by - y) < 46)) continue;
      if (BIG_SPOTS.some(([bx, by]) => Math.hypot(bx - x, by - y) < 30)) continue;
      if ((x < L + 80 || x > LANE_X - 80) && KICKERS.some((k) => Math.abs(k.y - y) < 44)) continue;
      pegs.push([x, y]);
    }
  }
  return pegs;
}
/** where the big pickups appear (a multiball, the cloud / bubble, the crown): open spaces between the bumpers */
export const BIG_SPOTS = [[260, 444], [100, 436], [420, 436], [100, 612], [420, 612], [260, 692]];
/** where the gems / pearls can float: the gaps between the pegs, away from the bumpers and the big spots */
let gaps = null;
export function gapSpots() {
  if (gaps) return gaps;
  const pegs = pegLayout();
  gaps = [];
  for (let row = 0; row < 9; row++) for (let x = 52; x < LANE_X - 40; x += 24.5) {
    const y = 360 + row * 40;
    if (pegs.some(([px, py]) => Math.hypot(px - x, py - y) < 17)) continue;
    if (BUMPERS.some(([bx, by]) => Math.hypot(bx - x, by - y) < 44)) continue;
    if (BIG_SPOTS.some(([bx, by]) => Math.hypot(bx - x, by - y) < 40)) continue;
    gaps.push([x, y]);
  }
  return gaps;
}
/** little triangles on both side walls that throw the ball back into the field */
export const KICKERS = [{ side: -1, y: 470 }, { side: -1, y: 640 }, { side: 1, y: 470 }, { side: 1, y: 640 }];

/** put the board into a physics world (src/plinko/physics.js): walls, dome, lane and gate, slots, kickers, pegs, bumpers, mover */
export function build(w) {
  w.addSegment(L, FLOOR + 10, L, DOME.cy, { r: 2 });
  const N = 56;
  for (let i = 0; i < N; i++) {
    const a0 = Math.PI + (i / N) * Math.PI, a1 = Math.PI + ((i + 1) / N) * Math.PI;
    w.addSegment(DOME.cx + Math.cos(a0) * DOME.rx, DOME.cy + Math.sin(a0) * DOME.ry, DOME.cx + Math.cos(a1) * DOME.rx, DOME.cy + Math.sin(a1) * DOME.ry, { r: 2, e: .3 });
  }
  w.addSegment(R, DOME.cy, R, FLOOR + 10, { r: 2 });
  w.addSegment(LANE_X, GATE_Y, LANE_X, FLOOR + 10, { r: 4 });
  // the lane's gate: open to a ball coming up, a slide into the field for a ball coming down
  w.addSegment(LANE_X, GATE_Y, R, GATE_Y - 40, { r: 3, e: .3, oneWay: [-Math.SQRT1_2, -Math.SQRT1_2], kind: 'gate' });
  // the plunger's resting top: solid from above only, so a ball pulled down below it still flies up through it
  w.addSegment(LANE_X, PLUNGER_Y, R, PLUNGER_Y, { r: 2, e: .2, oneWay: [0, -1], kind: 'plunger' });
  w.addSegment(L, FLOOR, LANE_X, FLOOR, { r: 2, e: .25, kind: 'floor' });
  for (let i = 1; i < MULTS.length; i++) w.addSegment(L + i * SLOT_W, SLOT_TOP, L + i * SLOT_W, FLOOR, { r: 4, e: .3, kind: 'divider' });
  for (const k of KICKERS) {
    const x0 = k.side < 0 ? L : LANE_X, tip = x0 - k.side * 30;
    w.addSegment(x0, k.y - 28, tip, k.y, { r: 2, e: .9, kick: 380, kind: 'kicker' });
    w.addSegment(tip, k.y, x0, k.y + 28, { r: 2, e: .9, kick: 380, kind: 'kicker' });
  }
  return {
    pegs: pegLayout().map(([x, y]) => Object.assign(w.addCircle(x, y, 5, { e: .5, kind: 'peg' }), { lit: 0 })),
    bumpers: BUMPERS.map(([x, y]) => Object.assign(w.addCircle(x, y, 24, { e: .8, kick: 300, kind: 'bumper' }), { hits: 0, level: 0, value: BUMP_VALUES[0], pulse: 0 })),
    mover: Object.assign(w.addCircle(260, MOVER_Y, 22, { e: .9, kick: 420, kind: 'mover' }), { pulse: 0, phase: 0 }),
  };
}

export const THEMES = {
  uni: {
    id: 'uni', name: 'Rainbow Plinko', hero: '\u{1F984}', voice: 'uni', music: 'plinkoUni',
    friends: ['\u{1F984}', '\u{1F308}', '⭐', '\u{1F98B}', '\u{1F496}', '\u{1F9C1}'],
    bumper: '⭐', mover: '\u{1F98B}', multi: '\u{1F308}', lift: '☁️', crown: '\u{1F451}', gem: '\u{1F48E}',
    jingles: { win: 'jUniWin', multi: 'jUniMulti', end: 'jUniEnd' },
    lines: {
      pull: 'Pull it down and let go!', jackpot: 'Jackpot! Times ten!', multi: 'Rainbow magic! Three balls!', bonus: 'Bonus ball!', last: 'Last ball!',
      double: 'Double points!', lift: 'Up, up in the cloud!', end: 'Great game!', best: 'A new high score!',
    },
    sky: ['#8fd3ff', '#c9b6ff', '#ffc4e8'],
    glass: ['rgba(255,255,255,.34)', 'rgba(255,236,250,.22)'], glassEdge: 'rgba(255,255,255,.65)',
    frame: ['#fff6c2', '#ffc94a', '#e88a1c'], frameAccent: '#ff7ac8', gemColors: ['#ff6fb5', '#7fd6ff', '#b58cff', '#7debb0'],
    peg: ['#ffffff', '#ffd6f1', '#d48ad8'], pegLit: '#fff36b',
    bumperRing: [['#ffffff', '#ffd1ef', '#ff6fb5'], ['#ffffff', '#c7e9ff', '#3fa8ff'], ['#ffffff', '#e2d1ff', '#9a5cff'], ['#fffbe0', '#ffe26b', '#ff9e1c']],
    ball: ['#ffffff', '#ff8fd0', '#c2188f'], trail: 'rainbow',
    slot: ['#ff7ac8', '#ffa94d', '#ffe14d', '#b06cff', '#ffe14d', '#ffa94d', '#ff7ac8'],
    plunger: ['#ffb3e0', '#ff5fb3', '#c21f7f'], spring: '#ffd34d', text: '#7b2fa0',
  },
  sea: {
    id: 'sea', name: 'Mermaid Plinko', hero: '\u{1F9DC}‍♀️', voice: 'hero', music: 'plinkoSea',
    friends: ['\u{1F9DC}‍♀️', '\u{1F420}', '\u{1F41A}', '\u{1F42C}', '\u{1F980}', '\u{1F496}'],
    bumper: '\u{1F41A}', mover: '\u{1F42C}', multi: '\u{1F531}', lift: 'bubble', crown: '\u{1F451}', gem: 'pearl',
    jingles: { win: 'jSeaWin', multi: 'jSeaMulti', end: 'jSeaEnd' },
    lines: {
      pull: 'Pull it down and let go!', jackpot: 'Jackpot! Times ten!', multi: 'Trident magic! Three balls!', bonus: 'Bonus ball!', last: 'Last ball!',
      double: 'Double points!', lift: 'Up, up in the bubble!', end: 'Great game!', best: 'A new high score!',
    },
    sky: ['#38c9e8', '#1a86c8', '#0c3f86'],
    glass: ['rgba(140,240,255,.22)', 'rgba(20,90,170,.28)'], glassEdge: 'rgba(190,250,255,.6)',
    frame: ['#f4fffd', '#8fe8e0', '#2a9d9a'], frameAccent: '#ffb3d9', gemColors: ['#ffe3f1', '#bff7ff', '#fff1b8', '#d9c9ff'],
    peg: ['#ffffff', '#c9fbff', '#5fc6d8'], pegLit: '#fff8c2',
    bumperRing: [['#ffffff', '#ffd6e8', '#ff7aa8'], ['#ffffff', '#bdfcf2', '#22c5a8'], ['#ffffff', '#e0d4ff', '#8a63ff'], ['#fffbe0', '#ffe26b', '#ff9e1c']],
    ball: ['#ffffff', '#ffd1ea', '#d0408a'], trail: 'bubbles',
    slot: ['#22c5a8', '#38b6ff', '#8a63ff', '#ff6fa8', '#8a63ff', '#38b6ff', '#22c5a8'],
    plunger: ['#b9fff4', '#22c5a8', '#0f7a6c'], spring: '#ffd34d', text: '#0d4f7a',
  },
};
/** everyone who can be on the leaderboard (no typing: tap your face) */
export const PLAYERS = {
  adalyn: { emoji: '\u{1F984}', name: 'Addie' }, esmae: { emoji: '\u{1F9DC}‍♀️', name: 'Esmae' }, tony: { emoji: '⚾', name: 'Tony' },
  jackson: { emoji: '\u{1F69A}', name: 'Jackson' }, mom: { emoji: '\u{1F469}', name: 'Mommy' }, dad: { emoji: '\u{1F468}', name: 'Daddy' },
};
