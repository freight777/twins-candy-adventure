// The backdrops of the hidden-picture pages (§5 "Building a scene", step 1): small hand-written SVG in the book's line style, two per
// theme for now. Scene units: 1200 × 900. Each set has the line art (`lines`), the colour it gets in the colour look and when the page
// is finished (`fills`), and its zones — where things go:
//   ground: { poly, depth: [far, near] }   things stand upright on a baseline; lower = nearer = bigger
//   shelf:  { y, x0, x1, depth }           things sit on a line (stands, shelves, a sidewalk)
//   float:  { poly, depth }                any angle (water, sky, a pegboard, tree tops)
// `density` scales how many things a zone holds.
const L = (d, w = 5) => `<path d="${d}" fill="none" stroke="#222" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const F = (d, fill) => `<path d="${d}" fill="${fill}"/>`;
const rect = (x, y, w, h) => `M${x} ${y}h${w}v${h}h${-w}Z`;
const box = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const rows = (ys, x0, x1, w = 4) => ys.map((y) => L(`M${x0} ${y}H${x1}`, w)).join('');

export const SETS = {
  stadium: {
    fills: F(rect(0, 0, 1200, 120), '#bfe6ff') + F(rect(0, 120, 1200, 210), '#dcdce8') + F(rect(0, 330, 1200, 570), '#93d67f') + F('M600 560m-210 0a210 80 0 1 0 420 0a210 80 0 1 0-420 0', '#a6e090'),
    lines: L('M0 120H1200M0 330H1200') + rows([180, 240, 300], 30, 1170) + [300, 600, 900].map((x) => L(`M${x} 120V330`, 4)).join('') +
      L('M60 120V20M40 20h40v-14h-40zM1140 120V20M1120 20h40v-14h-40z', 4) + L('M600 330V880', 4) + L('M600 560m-210 0a210 80 0 1 0 420 0a210 80 0 1 0-420 0', 4) +
      L('M60 880L180 360M1140 880L1020 360', 4) + L('M480 880v-80h240v80', 4),
    zones: [{ kind: 'shelf', y: 180, x0: 50, x1: 1150, depth: 0.15 }, { kind: 'shelf', y: 240, x0: 50, x1: 1150, depth: 0.2 }, { kind: 'shelf', y: 300, x0: 50, x1: 1150, depth: 0.25 },
      { kind: 'ground', poly: box(40, 400, 1160, 880), depth: [0.4, 1] }],
  },
  gym: {
    fills: F(rect(0, 0, 1200, 520), '#f8ecd2') + F(rect(0, 520, 1200, 380), '#eabb7c') + F(rect(520, 80, 160, 110), '#ffffff') + F(rect(800, 30, 270, 110), '#3b3b4f'),
    lines: L('M0 520H1200') + L(rect(520, 80, 160, 110)) + L(rect(565, 120, 70, 50), 4) + L('M560 215h80', 6) + L('M565 218l12 50h46l12-50M580 218l8 50M600 218v50M620 218l-8 50', 3) +
      L(rect(800, 30, 270, 110)) + L('M30 300H420M30 380H420M30 460H420M420 300V520M30 300V520', 4) + L(rect(950, 260, 150, 260)) + L('M1080 390h-14', 5) +
      L('M600 700m-260 0a260 110 0 1 0 520 0a260 110 0 1 0-520 0', 4) + L('M600 520V900', 4),
    zones: [{ kind: 'shelf', y: 300, x0: 40, x1: 410, depth: 0.2 }, { kind: 'shelf', y: 380, x0: 40, x1: 410, depth: 0.25 }, { kind: 'shelf', y: 460, x0: 40, x1: 410, depth: 0.3 },
      { kind: 'ground', poly: box(40, 570, 1160, 880), depth: [0.5, 1] }],
  },
  street: {
    fills: F(rect(0, 0, 1200, 400), '#cfeaff') + F(rect(40, 150, 220, 250), '#f1d9c0') + F(rect(300, 90, 200, 310), '#d7e3f0') + F(rect(540, 190, 240, 210), '#f6e3a8') + F(rect(820, 120, 330, 280), '#e8d2e8') +
      F(rect(0, 400, 1200, 50), '#e2e2e2') + F(rect(0, 450, 1200, 450), '#babfc8'),
    lines: [[40, 150, 220, 250], [300, 90, 200, 310], [540, 190, 240, 210], [820, 120, 330, 280]].map(([x, y, w, h]) => L(rect(x, y, w, h)) +
      Array.from({ length: Math.floor((h - 40) / 70) }, (_, r) => Array.from({ length: Math.floor((w - 20) / 70) }, (_, c) => L(rect(x + 25 + c * 70, y + 25 + r * 70, 40, 40), 3)).join('')).join('')).join('') +
      L('M0 400H1200M0 450H1200') + L('M40 670h120M260 670h120M480 670h120M700 670h120M920 670h120', 8) + [0, 1, 2, 3, 4].map((i) => L(`M${1000 + i * 36} 470l-40 400`, 4)).join(''),
    zones: [{ kind: 'shelf', y: 400, x0: 30, x1: 1170, depth: 0.25 }, { kind: 'ground', poly: box(40, 500, 1160, 880), depth: [0.45, 1] },
      { kind: 'float', poly: box(40, 20, 1160, 80), depth: 0.2, density: 0.35 }],
  },
  garage: {
    fills: F(rect(0, 0, 1200, 560), '#e6ebef') + F(rect(0, 560, 1200, 340), '#c6cad1') + F(rect(700, 80, 440, 300), '#e9cf9c') + F('M820 760a160 40 0 1 0 320 0a160 40 0 1 0-320 0', '#9aa0aa'),
    lines: L('M60 200H520M60 360H520', 6) + L('M90 200v30l30-30M490 200v30l-30-30M90 360v30l30-30M490 360v30l-30-30', 4) + L(rect(700, 80, 440, 300)) +
      Array.from({ length: 6 }, (_, r) => Array.from({ length: 10 }, (_, c) => `<circle cx="${730 + c * 42}" cy="${110 + r * 48}" r="3.5" fill="#222"/>`).join('')).join('') +
      L('M0 560H1200') + L('M580 560V90h70v470', 4) + L('M820 760a160 40 0 1 0 320 0a160 40 0 1 0-320 0', 3),
    zones: [{ kind: 'shelf', y: 200, x0: 70, x1: 510, depth: 0.25 }, { kind: 'shelf', y: 360, x0: 70, x1: 510, depth: 0.3 },
      { kind: 'float', poly: box(720, 100, 1120, 360), depth: 0.2, density: 0.6 }, { kind: 'ground', poly: box(40, 610, 1160, 880), depth: [0.5, 1] }],
  },
  jungle: {
    fills: F(rect(0, 0, 1200, 900), '#dff4d0') + F('M0 420Q200 300 420 380T820 360T1200 400V900H0Z', '#bfe6a0') + F('M0 560H1200V900H0Z', '#a8d987') +
      F('M70 560V250h50v310ZM1080 560V250h50v310Z', '#b07a4a') + F('M20 260a120 100 0 1 1 240 0a120 100 0 0 1-240 0ZM940 260a120 100 0 1 1 240 0a120 100 0 0 1-240 0Z', '#7cc35a'),
    lines: L('M0 420Q200 300 420 380T820 360T1200 400') + L('M0 560H1200', 4) + L('M70 560V330M120 560V330M1080 560V330M1130 560V330') +
      L('M20 260a120 100 0 1 1 240 0a120 100 0 0 1-240 0ZM940 260a120 100 0 1 1 240 0a120 100 0 0 1-240 0Z') +
      L('M300 880q20-90 60-120M330 880q-10-70-50-110M860 880q20-90 60-120M890 880q-10-70-50-110', 4),
    zones: [{ kind: 'ground', poly: box(200, 430, 1000, 550), depth: [0.25, 0.45] }, { kind: 'ground', poly: box(40, 610, 1160, 880), depth: [0.55, 1] },
      { kind: 'float', poly: box(40, 170, 240, 330), depth: 0.25, density: 0.5 }, { kind: 'float', poly: box(960, 170, 1160, 330), depth: 0.25, density: 0.5 }],
  },
  volcano: {
    fills: F(rect(0, 0, 1200, 440), '#ffe6c9') + F('M330 440L510 150h180l180 290Z', '#b98d6b') + F('M510 150h180l-30 50h-120Z', '#ff8040') + F(rect(0, 440, 1200, 460), '#ecd097') +
      F('M560 110a40 34 0 1 1 80 0a50 40 0 1 1 30 70h-130a45 40 0 0 1 20-70Z', '#ffffff'),
    lines: L('M330 440L510 150h180l180 290M510 150l30 50h120l30-50') + L('M560 110a40 34 0 1 1 80 0a50 40 0 1 1 30 70h-130a45 40 0 0 1 20-70Z', 4) + L('M0 440H1200') +
      L('M80 760q40-60 100-20q40-40 80 10M940 800q40-60 100-20q40-40 80 10', 4) + L('M420 360l40 20M760 330l-40 30', 4),
    zones: [{ kind: 'ground', poly: box(40, 480, 1160, 880), depth: [0.4, 1] }, { kind: 'float', poly: box(40, 40, 300, 330), depth: 0.25, density: 0.4 }, { kind: 'float', poly: box(900, 40, 1160, 330), depth: 0.25, density: 0.4 }],
  },
  reef: {
    fills: F(rect(0, 0, 1200, 360), '#a8e6ff') + F(rect(0, 360, 1200, 340), '#7ccbef') + F('M0 700Q300 660 600 700T1200 690V900H0Z', '#f3dfa8') +
      F('M60 700V560q-40-40-10-90M60 600q40-30 30-80M1130 700V540q40-40 10-90M1130 590q-40-30-30-80', 'none'),
    lines: L('M0 700Q300 660 600 700T1200 690') + L('M60 700V560q-40-40-10-90M60 600q40-30 30-80M110 700q-20-90 20-150M1130 700V540q40-40 10-90M1130 590q-40-30-30-80M1080 700q20-90-20-150', 6) +
      L('M330 700q-30-60 0-120q30-60 0-120M870 700q30-60 0-120q30-60 0-120', 4) + [[200, 120], [240, 80], [980, 160], [1010, 110]].map(([x, y]) => L(`M${x} ${y}m-12 0a12 12 0 1 0 24 0a12 12 0 1 0-24 0`, 3)).join(''),
    zones: [{ kind: 'float', poly: box(150, 40, 1050, 620), depth: [0.35, 0.8], density: 0.75 }, { kind: 'ground', poly: box(40, 730, 1160, 880), depth: [0.7, 1] }],
  },
  shipwreck: {
    fills: F(rect(0, 0, 1200, 660), '#92d6f2') + F(rect(0, 660, 1200, 240), '#ead19a') + F('M330 420L870 380L820 640L380 660Z', '#b98d5f'),
    lines: L('M330 420L870 380L820 640L380 660Z') + L('M600 400L560 120M560 120l120 40', 6) + [[460, 520], [580, 512], [700, 504]].map(([x, y]) => L(`M${x} ${y}m-22 0a22 22 0 1 0 44 0a22 22 0 1 0-44 0`, 4)).join('') +
      L('M0 660H1200') + L('M120 660q-20-90 20-160M1080 660q20-90-20-160', 5),
    zones: [{ kind: 'float', poly: box(40, 40, 1160, 330), depth: [0.3, 0.55], density: 0.6 }, { kind: 'shelf', y: 405, x0: 380, x1: 840, depth: 0.4 },
      { kind: 'ground', poly: box(40, 700, 1160, 880), depth: [0.6, 1] }, { kind: 'float', poly: box(40, 360, 300, 620), depth: 0.45, density: 0.5 }, { kind: 'float', poly: box(900, 340, 1160, 620), depth: 0.45, density: 0.5 }],
  },
  moonbase: {                                                   // the moon's surface: a starry sky, the Earth, a dome base, craters
    fills: F(rect(0, 0, 1200, 900), '#c9c6f5') + F('M0 520Q300 470 620 510T1200 500V900H0Z', '#e2e2ea') + F('M1040 140m-70 0a70 70 0 1 0 140 0a70 70 0 1 0-140 0', '#8fd0ff') +
      F('M1010 110q30-20 40 10q20 30-10 40q-30 0-30-50ZM1060 170q20 0 20 20q-20 10-30-10Z', '#7cc576') + F('M70 520a150 130 0 0 1 300 0Z', '#ffffff'),
    lines: L('M0 520Q300 470 620 510T1200 500') + L('M1040 140m-70 0a70 70 0 1 0 140 0a70 70 0 1 0-140 0') + L('M1010 110q30-20 40 10q20 30-10 40q-30 0-30-50ZM1060 170q20 0 20 20q-20 10-30-10Z', 3) +
      L('M70 520a150 130 0 0 1 300 0') + L('M190 520v-60a30 30 0 0 1 60 0v60', 4) + L('M120 440a100 80 0 0 1 60-40', 3) +
      [[520, 640, 70], [860, 600, 50], [700, 790, 90], [260, 780, 60], [1080, 770, 55]].map(([x, y, r]) => L(`M${x - r} ${y}a${r} ${r * 0.35} 0 1 0 ${2 * r} 0a${r} ${r * 0.35} 0 1 0 ${-2 * r} 0`, 4)).join('') +
      [[120, 90], [330, 60], [560, 120], [760, 70], [440, 260], [880, 300], [180, 300]].map(([x, y]) => L(`M${x} ${y - 12}v24M${x - 12} ${y}h24`, 3)).join(''),
    zones: [{ kind: 'float', poly: box(40, 40, 900, 420), depth: [0.3, 0.55], density: 0.65 }, { kind: 'ground', poly: box(420, 560, 1160, 880), depth: [0.45, 1] },
      { kind: 'ground', poly: box(40, 620, 420, 880), depth: [0.6, 1] }],
  },
  spaceship: {                                                  // inside a spaceship: a round window on the stars, shelves, the control desk
    fills: F(rect(0, 0, 1200, 900), '#e4e8f2') + F(rect(0, 690, 1200, 210), '#bfc6d6') + F('M700 250m-200 0a200 200 0 1 0 400 0a200 200 0 1 0-400 0', '#3d348b') +
      F('M440 560h720v130H440Z', '#9aa6c0'),
    lines: L('M700 250m-200 0a200 200 0 1 0 400 0a200 200 0 1 0-400 0') + L('M700 250m-222 0a222 222 0 1 0 444 0a222 222 0 1 0-444 0', 4) +
      L('M0 690H1200') + L('M440 560h720M440 560v130M1160 560v130', 5) + L('M60 260H380M60 400H380', 6) + L('M80 260v24l24-24M360 260v24l-24-24M80 400v24l24-24M360 400v24l-24-24', 4) +
      [480, 560, 640, 720, 800].map((x, i) => `<circle cx="${x + 20}" cy="620" r="13" fill="${['#ff5c5c', '#ffd23f', '#2dbb5a', '#3a86ff', '#ff8a3d'][i]}" stroke="#222" stroke-width="4"/>`).join('') +
      L('M900 600h200v60H900Z', 4) + L('M920 640l30-20l30 25l30-30l30 20l30-10', 3) + L('M0 120h40v460H0', 4),
    zones: [{ kind: 'float', poly: box(590, 120, 810, 380), depth: 0.22, density: 0.5 }, { kind: 'shelf', y: 260, x0: 70, x1: 370, depth: 0.25 }, { kind: 'shelf', y: 400, x0: 70, x1: 370, depth: 0.3 },
      { kind: 'shelf', y: 560, x0: 450, x1: 1150, depth: 0.35 }, { kind: 'ground', poly: box(40, 720, 1160, 880), depth: [0.6, 1] }],
  },
};
