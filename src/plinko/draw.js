// Sparkle Plinko's pictures, on a plain 2D canvas: a living background (drifting clouds and a rainbow, or sun rays, bubbles and
// fish), the board drawn once into its own canvas whenever the screen size changes, and every frame the pegs lighting up, the
// bumpers pulsing, the pickups bobbing, the balls with their trails, and the particles. Fluent Emoji 3D pictures are the art.
import { fluentURL } from '../engine/fluent.js';
import { W, H, L, LANE_X, R, DOME, GATE_Y, PLUNGER_Y, SLOT_TOP, FLOOR, MULTS, SLOT_W, KICKERS, BALL_R } from './boards.js';

const TAU = Math.PI * 2;
const FONT = (px, w = 700) => `${w} ${px}px Fredoka, system-ui, sans-serif`;
const rnd = (a, b) => a + Math.random() * (b - a);

// ---------------------------------------------------------------- pictures
const imgs = new Map();
/** the Fluent picture of an emoji (loaded once); null until it has loaded */
export function emojiImg(e) {
  let im = imgs.get(e);
  if (!im) {
    im = new Image(); im.decoding = 'async'; const url = fluentURL(e); if (url) im.src = url; imgs.set(e, im);
  }
  return im.complete && im.naturalWidth ? im : null;
}
export const preloadEmoji = (list) => Promise.all(list.map((e) => new Promise((res) => {
  emojiImg(e); const im = imgs.get(e); if (!im.src || (im.complete && im.naturalWidth)) return res();
  im.onload = im.onerror = () => res();
})));
function drawEmoji(g, e, x, y, size, rot = 0, flip = 1) {
  const im = emojiImg(e);
  g.save(); g.translate(x, y); if (rot) g.rotate(rot); if (flip !== 1) g.scale(flip, 1);
  if (im) g.drawImage(im, -size / 2, -size / 2, size, size);
  else { g.font = FONT(size * .8, 400); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(e, 0, size * .05); }
  g.restore();
}
function canvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
/** a square sprite `size` world units across, rendered at k pixels per unit */
function sprite(size, k, paint) { const c = canvas(size * k, size * k), g = c.getContext('2d'); g.scale(k, k); paint(g, size / 2); return c; }
function shade(g, r, [hi, mid, lo], ox = -.35, oy = -.4) {
  const gr = g.createRadialGradient(r + r * ox, r + r * oy, r * .08, r, r, r);
  gr.addColorStop(0, hi); gr.addColorStop(.45, mid); gr.addColorStop(1, lo); return gr;
}

export function createRenderer(cv) {
  const g = cv.getContext('2d');
  const V = { dpr: 1, cw: 0, ch: 0, s: 1, ox: 0, oy: 0, panelW: 280, zoom: 1, fx: W / 2, fy: H / 2, shake: 0, flash: 0, flashColor: '#fff' };
  let theme = null, bg = null, board = null, spr = {}, glowCache = new Map();
  const parts = [], screenParts = [], ambient = [];

  // ------------------------------------------------------------ layout
  function resize() {
    V.dpr = Math.min(2, devicePixelRatio || 1); V.cw = innerWidth; V.ch = innerHeight;
    cv.width = Math.round(V.cw * V.dpr); cv.height = Math.round(V.ch * V.dpr); cv.style.width = V.cw + 'px'; cv.style.height = V.ch + 'px';
    const m = Math.max(8, Math.min(16, V.ch * .02)), minPanel = Math.min(300, V.cw * .3);
    V.s = Math.min((V.ch - 2 * m) / H, (V.cw - minPanel - 3 * m) / W);
    const bw = W * V.s;
    V.panelW = Math.min(440, V.cw - bw - 3 * m);
    const left = V.panelW + 2 * m, right = V.cw - m;
    V.ox = Math.max(left, (left + right) / 2 - bw / 2 - (right - left - bw) * .2); V.oy = (V.ch - H * V.s) / 2;
    if (theme) rebuild();
    return V;
  }
  const K = () => V.s * V.dpr * 1.05;      // sprite pixels per world unit
  function rebuild() { bg = paintBackground(); board = paintBoard(); spr = makeSprites(); glowCache.clear(); seedAmbient(); }
  function setTheme(t) { theme = t; parts.length = 0; screenParts.length = 0; rebuild(); }

  // ------------------------------------------------------------ the background, behind everything (screen space)
  function paintBackground() {
    const c = canvas(V.cw * V.dpr, V.ch * V.dpr), b = c.getContext('2d'); b.scale(V.dpr, V.dpr);
    const [a, m, z] = theme.sky, gr = b.createLinearGradient(0, 0, 0, V.ch);
    gr.addColorStop(0, a); gr.addColorStop(.55, m); gr.addColorStop(1, z); b.fillStyle = gr; b.fillRect(0, 0, V.cw, V.ch);
    if (theme.id === 'uni') {
      // a big soft rainbow behind the board, rolling hills, a sprinkle of stars
      const cx = V.cw * .55, cy = V.ch * 1.05, R0 = Math.max(V.cw, V.ch) * .62;
      ['#ff6b8a', '#ffa94d', '#ffe14d', '#7debb0', '#5bc0ff', '#b58cff'].forEach((col, i) => {
        b.beginPath(); b.arc(cx, cy, R0 - i * R0 * .055, Math.PI, TAU); b.lineWidth = R0 * .056; b.strokeStyle = col; b.globalAlpha = .38; b.stroke();
      });
      b.globalAlpha = 1;
      [[.0, .86, '#9be59b'], [.5, .9, '#86d98a'], [.85, .84, '#a6ecb0']].forEach(([x, y, col]) => {
        b.fillStyle = col; b.beginPath(); b.ellipse(V.cw * x + V.cw * .2, V.ch * y + V.ch * .25, V.cw * .45, V.ch * .3, 0, 0, TAU); b.fill();
      });
      for (let i = 0; i < 40; i++) { b.fillStyle = `rgba(255,255,255,${rnd(.4, .9)})`; star(b, rnd(0, V.cw), rnd(0, V.ch * .6), rnd(2, 5)); }
    } else {
      // sand, a few rocks and shells at the bottom; the rays, bubbles and fish move (ambient)
      b.fillStyle = '#f2d59a'; b.beginPath(); b.moveTo(0, V.ch * .9);
      for (let x = 0; x <= V.cw; x += V.cw / 8) b.quadraticCurveTo(x + V.cw / 16, V.ch * (.86 + Math.random() * .04), x + V.cw / 8, V.ch * .9);
      b.lineTo(V.cw, V.ch); b.lineTo(0, V.ch); b.fill();
      b.fillStyle = 'rgba(255,255,255,.12)';
      for (let i = 0; i < 70; i++) { b.beginPath(); b.arc(rnd(0, V.cw), rnd(0, V.ch * .85), rnd(1, 3), 0, TAU); b.fill(); }
      const sh = Math.min(V.ch * .08, 60);
      drawEmoji(b, '\u{1F41A}', V.cw * .06, V.ch * .94, sh); drawEmoji(b, '\u{1F980}', V.panelW * .82, V.ch * .95, sh * .9);
    }
    return c;
  }
  function star(b, x, y, r) { b.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? r * .45 : r; b.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } b.closePath(); b.fill(); }
  function seedAmbient() {
    ambient.length = 0;
    if (theme.id === 'uni') {
      for (let i = 0; i < 6; i++) ambient.push({ k: 'cloud', x: rnd(0, V.cw), y: rnd(V.ch * .05, V.ch * .55), s: rnd(.6, 1.3), v: rnd(6, 16) });
      for (let i = 0; i < 26; i++) ambient.push({ k: 'twinkle', x: rnd(0, V.cw), y: rnd(0, V.ch), p: rnd(0, TAU), v: rnd(1, 3), r: rnd(3, 7) });
      ambient.push({ k: 'flyer', e: '\u{1F98B}', x: -60, y: V.ch * .3, v: 40, t: rnd(0, 9) });
    } else {
      for (let i = 0; i < 5; i++) ambient.push({ k: 'ray', x: rnd(0, V.cw), w: rnd(40, 120), p: rnd(0, TAU), v: rnd(.2, .5) });
      for (let i = 0; i < 30; i++) ambient.push({ k: 'bubble', x: rnd(0, V.cw), y: rnd(0, V.ch), r: rnd(3, 10), v: rnd(20, 60), p: rnd(0, TAU) });
      ['\u{1F420}', '\u{1F41F}', '\u{1F420}'].forEach((e, i) => ambient.push({ k: 'flyer', e, x: rnd(0, V.cw), y: V.ch * (.15 + i * .25), v: rnd(30, 60) * (i % 2 ? -1 : 1), t: rnd(0, 9) }));
      for (let i = 0; i < 7; i++) ambient.push({ k: 'weed', x: (i / 6) * V.cw * .3 + (i > 3 ? V.cw * .6 : 0) + rnd(-10, 10), h: rnd(.12, .25) * V.ch, p: rnd(0, TAU), c: ['#2fbf71', '#1e9e5a', '#53d68f'][i % 3] });
    }
  }
  function drawAmbient(t, dt) {
    for (const a of ambient) {
      if (a.k === 'cloud') {
        a.x += a.v * dt; if (a.x > V.cw + 120) a.x = -160;
        g.fillStyle = 'rgba(255,255,255,.78)'; const s = 30 * a.s;
        g.beginPath(); g.arc(a.x, a.y, s, 0, TAU); g.arc(a.x + s, a.y - s * .4, s * 1.2, 0, TAU); g.arc(a.x + s * 2.2, a.y, s * .9, 0, TAU); g.rect(a.x, a.y - s * .2, s * 2.2, s * 1.1); g.fill();
      } else if (a.k === 'twinkle') {
        const k = .5 + .5 * Math.sin(t * a.v + a.p); g.fillStyle = `rgba(255,255,255,${k * .9})`; star(g, a.x, a.y, a.r * (.6 + k * .5));
      } else if (a.k === 'flyer') {
        a.t += dt; a.x += a.v * dt;
        if (a.v > 0 && a.x > V.cw + 80) { a.x = -80; a.y = rnd(.1, .7) * V.ch; } if (a.v < 0 && a.x < -80) { a.x = V.cw + 80; a.y = rnd(.1, .7) * V.ch; }
        drawEmoji(g, a.e, a.x, a.y + Math.sin(a.t * 2.4) * 14, Math.min(64, V.ch * .07), Math.sin(a.t * 3) * .1, a.v > 0 ? -1 : 1);
      } else if (a.k === 'ray') {
        const k = .5 + .5 * Math.sin(t * a.v + a.p), x = a.x + Math.sin(t * .1 + a.p) * 40;
        const gr = g.createLinearGradient(0, 0, 0, V.ch); gr.addColorStop(0, `rgba(255,255,255,${.16 * k + .04})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + a.w, 0); g.lineTo(x + a.w * 2.2 - 160, V.ch); g.lineTo(x - 160, V.ch); g.fill();
      } else if (a.k === 'bubble') {
        a.y -= a.v * dt; if (a.y < -20) { a.y = V.ch + 20; a.x = rnd(0, V.cw); }
        const x = a.x + Math.sin(t * 2 + a.p) * 6; g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1.5; g.beginPath(); g.arc(x, a.y, a.r, 0, TAU); g.stroke();
        g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.arc(x - a.r * .35, a.y - a.r * .35, a.r * .25, 0, TAU); g.fill();
      } else if (a.k === 'weed') {
        g.strokeStyle = a.c; g.lineWidth = 10; g.lineCap = 'round'; g.beginPath(); g.moveTo(a.x, V.ch);
        for (let i = 1; i <= 5; i++) g.lineTo(a.x + Math.sin(t * 1.3 + a.p + i * .7) * i * 4, V.ch - a.h * i / 5);
        g.stroke();
      }
    }
  }

  // ------------------------------------------------------------ the board, drawn once per size (world units)
  function boardPath(b, inset = 0) {
    b.beginPath(); b.moveTo(L - inset, FLOOR + inset); b.lineTo(L - inset, DOME.cy);
    b.ellipse(DOME.cx, DOME.cy, DOME.rx + inset, DOME.ry + inset, 0, Math.PI, TAU);
    b.lineTo(R + inset, FLOOR + inset); b.closePath();
  }
  function paintBoard() {
    const k = K(), pad = 30, c = canvas((W + pad * 2) * k, (H + pad * 2) * k), b = c.getContext('2d');
    b.scale(k, k); b.translate(pad, pad);
    // drop shadow, then the frame (thick, shiny, studded with gems), then the glass
    b.save(); b.shadowColor = 'rgba(40,0,60,.35)'; b.shadowBlur = 24; b.shadowOffsetY = 10; boardPath(b, 16); b.fillStyle = theme.frame[2]; b.fill(); b.restore();
    const fg = b.createLinearGradient(0, 0, W, H); fg.addColorStop(0, theme.frame[0]); fg.addColorStop(.35, theme.frame[1]); fg.addColorStop(1, theme.frame[2]);
    boardPath(b, 16); b.fillStyle = fg; b.fill();
    boardPath(b, 10); b.strokeStyle = 'rgba(255,255,255,.55)'; b.lineWidth = 2.5; b.stroke();
    boardPath(b, 3); b.fillStyle = theme.frame[2]; b.fill();
    const gl = b.createLinearGradient(0, 0, 0, H); gl.addColorStop(0, theme.glass[0]); gl.addColorStop(1, theme.glass[1]);
    boardPath(b, 0); b.save(); b.clip();
    b.fillStyle = theme.id === 'uni' ? '#fdf2ff' : '#0f5e9c'; b.fillRect(0, 0, W, H);
    b.fillStyle = gl; b.fillRect(0, 0, W, H);
    // a faint pattern in the glass: hearts and stars, or ripples
    b.globalAlpha = theme.id === 'uni' ? .07 : .09;
    if (theme.id === 'uni') { b.fillStyle = '#b05cd8'; for (let y = 60; y < H; y += 56) for (let x = (y / 56) % 2 ? 30 : 58; x < W; x += 56) star(b, x, y, 7); }
    else { b.strokeStyle = '#ffffff'; b.lineWidth = 2; for (let y = 50; y < H; y += 38) { b.beginPath(); for (let x = 0; x <= W; x += 10) b.lineTo(x, y + Math.sin(x / 26 + y) * 5); b.stroke(); } }
    b.globalAlpha = 1;
    // under the dome: a rainbow (unicorns) or sunbeams fanning down through the water (lagoon), and the hero watching
    if (theme.id === 'uni') {
      ['#ff6b8a', '#ffa94d', '#ffe14d', '#7debb0', '#5bc0ff', '#b58cff'].forEach((col, i) => {
        b.beginPath(); b.arc(DOME.cx, 300, 200 - i * 13, Math.PI * 1.04, Math.PI * 1.96); b.lineWidth = 13; b.strokeStyle = col; b.globalAlpha = .3; b.stroke();
      });
    } else {
      for (let i = -4; i <= 4; i++) {
        const a = Math.PI / 2 + i * .17, gr = b.createLinearGradient(DOME.cx, 0, DOME.cx, 330); gr.addColorStop(0, 'rgba(255,255,255,.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        b.fillStyle = gr; b.beginPath(); b.moveTo(DOME.cx, -20); b.lineTo(DOME.cx + Math.cos(a - .05) * 400, -20 + Math.sin(a - .05) * 400); b.lineTo(DOME.cx + Math.cos(a + .05) * 400, -20 + Math.sin(a + .05) * 400); b.fill();
      }
    }
    b.globalAlpha = .22; drawEmoji(b, theme.hero, DOME.cx, 180, 120); b.globalAlpha = 1;
    // a glassy highlight down the left
    const hl = b.createLinearGradient(0, 0, W, 0); hl.addColorStop(0, 'rgba(255,255,255,.28)'); hl.addColorStop(.18, 'rgba(255,255,255,0)'); b.fillStyle = hl; b.fillRect(0, 0, W, H);
    // the launch lane: a darker channel
    const lg = b.createLinearGradient(LANE_X, 0, R, 0); lg.addColorStop(0, 'rgba(0,0,0,.28)'); lg.addColorStop(.5, 'rgba(0,0,0,.14)'); lg.addColorStop(1, 'rgba(0,0,0,.3)');
    b.fillStyle = lg; b.fillRect(LANE_X, GATE_Y - 40, R - LANE_X, FLOOR - GATE_Y + 40);
    // the prize slots
    MULTS.forEach((m, i) => {
      const x = L + i * SLOT_W, sg = b.createLinearGradient(0, SLOT_TOP, 0, FLOOR);
      sg.addColorStop(0, hexA(theme.slot[i], .15)); sg.addColorStop(1, hexA(theme.slot[i], .75));
      b.fillStyle = sg; b.fillRect(x, SLOT_TOP, SLOT_W, FLOOR - SLOT_TOP);
      b.font = FONT(m === 10 ? 25 : 22); b.textAlign = 'center'; b.textBaseline = 'middle';
      b.lineWidth = 5; b.strokeStyle = 'rgba(0,0,0,.25)'; b.strokeText(`×${m}`, x + SLOT_W / 2, FLOOR - 26);
      b.fillStyle = '#fff'; b.fillText(`×${m}`, x + SLOT_W / 2, FLOOR - 26);
    });
    b.restore();
    // kickers: candy triangles on the side walls
    for (const kk of KICKERS) {
      const x0 = kk.side < 0 ? L : LANE_X, tip = x0 - kk.side * 30;
      b.beginPath(); b.moveTo(x0, kk.y - 28); b.lineTo(tip, kk.y); b.lineTo(x0, kk.y + 28); b.closePath();
      const kg = b.createLinearGradient(x0, 0, tip, 0); kg.addColorStop(0, theme.frame[2]); kg.addColorStop(1, theme.frame[1]);
      b.fillStyle = kg; b.fill(); b.strokeStyle = 'rgba(255,255,255,.8)'; b.lineWidth = 2.5; b.stroke();
    }
    // the walls the ball meets: the lane divider and the slot dividers, shiny posts
    post(b, LANE_X, GATE_Y, LANE_X, FLOOR, 4);
    for (let i = 1; i < MULTS.length; i++) post(b, L + i * SLOT_W, SLOT_TOP, L + i * SLOT_W, FLOOR, 4);
    // the gate at the top of the lane
    post(b, LANE_X, GATE_Y, R, GATE_Y - 40, 3);
    // gems set into the frame
    for (let i = 0; i <= 12; i++) {
      const a = Math.PI + (i / 12) * Math.PI, x = DOME.cx + Math.cos(a) * (DOME.rx + 9), y = DOME.cy + Math.sin(a) * (DOME.ry + 9);
      gemDot(b, x, y, 4.2, theme.gemColors[i % theme.gemColors.length]);
    }
    for (let y = DOME.cy + 40; y < FLOOR; y += 64) { gemDot(b, L - 9, y, 4.2, theme.gemColors[(y / 64 | 0) % 4]); gemDot(b, R + 9, y, 4.2, theme.gemColors[(y / 64 + 2 | 0) % 4]); }
    return { c, pad };
  }
  function post(b, ax, ay, bx, by, r) {
    b.lineCap = 'round'; b.strokeStyle = theme.frame[2]; b.lineWidth = r * 2 + 2; b.beginPath(); b.moveTo(ax, ay); b.lineTo(bx, by); b.stroke();
    b.strokeStyle = theme.frame[0]; b.lineWidth = r * 1.1; b.beginPath(); b.moveTo(ax - .8, ay); b.lineTo(bx - .8, by); b.stroke();
  }
  function gemDot(b, x, y, r, col) {
    b.fillStyle = col; b.beginPath(); b.arc(x, y, r, 0, TAU); b.fill();
    b.fillStyle = 'rgba(255,255,255,.85)'; b.beginPath(); b.arc(x - r * .35, y - r * .35, r * .35, 0, TAU); b.fill();
  }
  function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }

  // ------------------------------------------------------------ sprites (re-made when the size changes)
  function makeSprites() {
    const k = K(), t = theme;
    const S = {
      peg: sprite(14, k, (b, r) => { b.fillStyle = 'rgba(0,0,0,.18)'; b.beginPath(); b.arc(r + .8, r + 1.4, 5.4, 0, TAU); b.fill(); b.translate(r - 6, r - 6); b.fillStyle = shade(b, 6, t.peg); b.beginPath(); b.arc(6, 6, 5.4, 0, TAU); b.fill(); }),
      pegLit: sprite(14, k, (b, r) => { b.translate(r - 6, r - 6); b.fillStyle = shade(b, 6, ['#ffffff', t.pegLit, '#ffb31a']); b.beginPath(); b.arc(6, 6, 5.6, 0, TAU); b.fill(); }),
      ball: sprite(BALL_R * 2 + 4, k, (b, r) => {
        b.fillStyle = 'rgba(0,0,0,.2)'; b.beginPath(); b.arc(r + 1.5, r + 2.5, BALL_R, 0, TAU); b.fill();
        b.translate(r - BALL_R, r - BALL_R); b.fillStyle = shade(b, BALL_R, t.ball); b.beginPath(); b.arc(BALL_R, BALL_R, BALL_R, 0, TAU); b.fill();
        b.fillStyle = 'rgba(255,255,255,.9)'; b.beginPath(); b.ellipse(BALL_R * .62, BALL_R * .55, BALL_R * .32, BALL_R * .2, -.6, 0, TAU); b.fill();
      }),
      bumpers: t.bumperRing.map((ring) => sprite(56, k, (b, r) => {
        b.fillStyle = 'rgba(0,0,0,.2)'; b.beginPath(); b.arc(r + 2, r + 3, 24, 0, TAU); b.fill();
        b.translate(r - 24, r - 24); b.fillStyle = shade(b, 24, [ring[0], ring[1], ring[2]], -.3, -.35); b.beginPath(); b.arc(24, 24, 24, 0, TAU); b.fill();
        b.strokeStyle = 'rgba(255,255,255,.9)'; b.lineWidth = 2.5; b.beginPath(); b.arc(24, 24, 20.5, 0, TAU); b.stroke();
        b.fillStyle = 'rgba(255,255,255,.5)'; b.beginPath(); b.arc(24, 24, 15, 0, TAU); b.fill();
      })),
      pearl: sprite(24, k, (b, r) => { b.fillStyle = shade(b, r * .8, ['#ffffff', '#fff0f8', '#d9b8d0']); b.translate(r * .2, r * .2); b.beginPath(); b.arc(r * .8, r * .8, r * .8, 0, TAU); b.fill(); }),
      bubble: sprite(60, k, (b, r) => {
        const gr = b.createRadialGradient(r, r, r * .6, r, r, r); gr.addColorStop(0, 'rgba(180,240,255,.08)'); gr.addColorStop(.85, 'rgba(200,250,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,.85)');
        b.fillStyle = gr; b.beginPath(); b.arc(r, r, r - 1, 0, TAU); b.fill();
        b.fillStyle = 'rgba(255,255,255,.8)'; b.beginPath(); b.ellipse(r * .62, r * .55, r * .22, r * .12, -.7, 0, TAU); b.fill();
      }),
    };
    return S;
  }
  /** a soft round glow in a colour, made once per colour */
  function glow(col) {
    let c = glowCache.get(col); if (c) return c;
    c = sprite(64, Math.min(2, K()), (b, r) => { const gr = b.createRadialGradient(r, r, 0, r, r, r); gr.addColorStop(0, col); gr.addColorStop(.35, hexA(col, .45)); gr.addColorStop(1, hexA(col, 0)); b.fillStyle = gr; b.fillRect(0, 0, r * 2, r * 2); });
    glowCache.set(col, c); return c;
  }

  // ------------------------------------------------------------ particles
  const P = {
    spark(x, y, n = 8, col = '#fff36b', speed = 220) { for (let i = 0; i < n; i++) { const a = rnd(0, TAU), v = rnd(.3, 1) * speed; parts.push({ t: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: rnd(.35, .7), size: rnd(10, 20), col, g: 200 }); } },
    ring(x, y, col = '#fff', r0 = 20, r1 = 70, max = .45) { parts.push({ t: 'ring', x, y, life: 0, max, r0, r1, col }); },
    text(x, y, s, { col = '#fff', size = 26, stroke = theme.text, max = 1.1, vy = -70 } = {}) { parts.push({ t: 'text', x, y, s, col, size, stroke, life: 0, max, vy }); },
    coins(x, y, n = 12) { for (let i = 0; i < n; i++) parts.push({ t: 'coin', x: x + rnd(-20, 20), y, vx: rnd(-160, 160), vy: rnd(-620, -320), life: 0, max: rnd(1, 1.5), rot: rnd(0, TAU), vr: rnd(8, 16), g: 1300 }); },
    emoji(x, y, e, n = 6, speed = 380) { for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + rnd(-1.1, 1.1), v = rnd(.5, 1) * speed; parts.push({ t: 'img', x, y, e, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: rnd(1, 1.6), rot: rnd(-.5, .5), vr: rnd(-4, 4), size: rnd(22, 34), g: 700 }); } },
    bubbles(x, y, n = 3) { for (let i = 0; i < n; i++) parts.push({ t: 'bubble', x: x + rnd(-6, 6), y: y + rnd(-6, 6), vx: rnd(-20, 20), vy: rnd(-90, -40), life: 0, max: rnd(.6, 1.1), size: rnd(2.5, 6), g: -60 }); },
    confetti(x, y, n = 30) { const cols = ['#ff5a8a', '#ffd84d', '#5be3a0', '#5bc0ff', '#b07cff', '#ff9f4d']; for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + rnd(-1.2, 1.2), v = rnd(250, 650); parts.push({ t: 'conf', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: rnd(1.4, 2.2), rot: rnd(0, TAU), vr: rnd(-12, 12), col: cols[i % cols.length], g: 900, size: rnd(6, 10) }); } },
    /** pictures raining down the whole screen (a jackpot, the end of a round) */
    rain(list, n = 26) { for (let i = 0; i < n; i++) screenParts.push({ t: 'img', e: list[i % list.length], x: rnd(0, V.cw), y: rnd(-V.ch * .6, -40), vx: rnd(-30, 30), vy: rnd(160, 320), life: 0, max: 4.5, rot: rnd(-.5, .5), vr: rnd(-2, 2), size: rnd(40, 76), g: 120 }); },
  };
  function stepParts(list, dt) {
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i]; p.life += dt; if (p.life >= p.max) { list.splice(i, 1); continue; }
      if (p.vx != null) { p.vy += (p.g || 0) * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.t === 'spark') { p.vx *= .96; p.vy *= .96; } }
      if (p.t === 'text') p.y += p.vy * dt * (1 - p.life / p.max);
      if (p.vr) p.rot += p.vr * dt;
    }
  }
  function drawParts(list) {
    for (const p of list) {
      const k = p.life / p.max, fade = k > .7 ? 1 - (k - .7) / .3 : 1;
      if (p.t === 'spark') { g.globalCompositeOperation = 'lighter'; g.globalAlpha = 1 - k; const s = p.size * (1 - k * .5); g.drawImage(glow(p.col), p.x - s, p.y - s, s * 2, s * 2); g.globalCompositeOperation = 'source-over'; }
      else if (p.t === 'ring') { const e = 1 - (1 - k) ** 3; g.globalAlpha = 1 - k; g.strokeStyle = p.col; g.lineWidth = 5 * (1 - k) + 1; g.beginPath(); g.arc(p.x, p.y, p.r0 + (p.r1 - p.r0) * e, 0, TAU); g.stroke(); }
      else if (p.t === 'text') {
        const pop = k < .15 ? .6 + k / .15 * .55 : k < .25 ? 1.15 - (k - .15) / .1 * .15 : 1; g.globalAlpha = fade;
        g.font = FONT(p.size * pop); g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
        g.lineWidth = p.size * .22; g.strokeStyle = p.stroke; g.strokeText(p.s, p.x, p.y); g.fillStyle = p.col; g.fillText(p.s, p.x, p.y);
      } else if (p.t === 'coin') {
        g.globalAlpha = fade; const sx = Math.abs(Math.cos(p.rot)) * 9 + 1;
        g.fillStyle = '#e09a10'; g.beginPath(); g.ellipse(p.x, p.y, sx, 10, 0, 0, TAU); g.fill();
        g.fillStyle = '#ffd84d'; g.beginPath(); g.ellipse(p.x, p.y, sx * .8, 8, 0, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.ellipse(p.x - sx * .25, p.y - 3, sx * .25, 2.5, 0, 0, TAU); g.fill();
      } else if (p.t === 'img') { g.globalAlpha = fade; drawEmoji(g, p.e, p.x, p.y, p.size, p.rot); }
      else if (p.t === 'bubble') { g.globalAlpha = 1 - k; g.strokeStyle = '#fff'; g.lineWidth = 1.4; g.beginPath(); g.arc(p.x, p.y, p.size, 0, TAU); g.stroke(); }
      else if (p.t === 'conf') { g.globalAlpha = fade; g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.fillStyle = p.col; g.fillRect(-p.size / 2, -p.size * .3, p.size, p.size * .6 * Math.abs(Math.cos(p.rot * 1.3)) + 1); g.restore(); }
    }
    g.globalAlpha = 1;
  }

  // ------------------------------------------------------------ one frame
  /** S: the game's state (pegs, bumpers, mover, sensors, balls, slot flashes, plunger pull, lane glow) */
  function frame(S, t, dt) {
    const { dpr } = V;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (bg) g.drawImage(bg, 0, 0, V.cw, V.ch); else { g.fillStyle = '#9fe0ff'; g.fillRect(0, 0, V.cw, V.ch); }
    drawAmbient(t, dt);
    // the board, with the camera's gentle zoom and shake
    const sx = V.shake ? rnd(-1, 1) * V.shake : 0, sy = V.shake ? rnd(-1, 1) * V.shake : 0;
    g.setTransform(dpr * V.s, 0, 0, dpr * V.s, dpr * (V.ox + sx), dpr * (V.oy + sy));
    if (V.zoom !== 1) { g.translate(V.fx, V.fy); g.scale(V.zoom, V.zoom); g.translate(-V.fx, -V.fy); }
    if (board) g.drawImage(board.c, -board.pad, -board.pad, W + board.pad * 2, H + board.pad * 2);
    drawSlotsLive(S, t);
    drawLane(S, t);
    for (const p of S.pegs) {
      g.drawImage(spr.peg, p.x - 7, p.y - 7, 14, 14);
      if (p.lit > 0) { g.globalAlpha = p.lit; g.drawImage(spr.pegLit, p.x - 7, p.y - 7, 14, 14); g.globalCompositeOperation = 'lighter'; const s = 16 * p.lit; g.drawImage(glow(theme.pegLit), p.x - s, p.y - s, s * 2, s * 2); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; }
    }
    for (const bp of S.bumpers) drawBumper(bp, t);
    for (const s of S.world.sensors) drawSensor(s, t);
    if (S.mover) drawMover(S.mover, t);
    for (const b of S.world.balls) drawBall(b, t);
    drawParts(parts);
    // screen-space layers: the picture rain and a white flash
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawParts(screenParts);
    if (V.flash > 0) { g.globalAlpha = Math.min(1, V.flash) * .55; g.fillStyle = V.flashColor; g.fillRect(0, 0, V.cw, V.ch); g.globalAlpha = 1; }
  }
  function update(dt) {
    stepParts(parts, dt); stepParts(screenParts, dt);
    V.shake = Math.max(0, V.shake - dt * 30); V.flash = Math.max(0, V.flash - dt * 2.2);
  }

  function drawSlotsLive(S, t) {
    MULTS.forEach((m, i) => {
      const x = L + i * SLOT_W, f = S.slotFlash[i];
      if (m === 10) {           // the jackpot slot shimmers all the time
        const k = .5 + .5 * Math.sin(t * 4);
        g.globalCompositeOperation = 'lighter'; g.globalAlpha = .25 + .2 * k;
        g.drawImage(glow(theme.slot[i]), x - 10, SLOT_TOP - 20, SLOT_W + 20, FLOOR - SLOT_TOP + 30);
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
        for (let j = 0; j < 3; j++) { const a = t * 1.7 + j * 2.1; g.fillStyle = `rgba(255,255,255,${.5 + .5 * Math.sin(a * 2)})`; star(g, x + SLOT_W / 2 + Math.cos(a) * 22, SLOT_TOP + 34 + Math.sin(a) * 12, 4); }
      }
      if (f > 0) {
        g.globalAlpha = Math.min(1, f); g.fillStyle = '#ffffff'; g.fillRect(x + 4, SLOT_TOP, SLOT_W - 8, FLOOR - SLOT_TOP);
        g.globalCompositeOperation = 'lighter'; g.drawImage(glow(theme.slot[i]), x - 30, SLOT_TOP - 60, SLOT_W + 60, 200); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      }
    });
  }
  function drawLane(S, t) {
    // chevrons up the lane: they chase upward while a ball waits, and fill with the pull
    const n = 6, cx = (LANE_X + R) / 2;
    for (let i = 0; i < n; i++) {
      const y = PLUNGER_Y - 70 - i * 58, on = S.ready ? (i < S.pull * n + .01 ? 1 : (.5 + .5 * Math.sin(t * 6 - i * .9)) * .55) : .18;
      const lit = S.pull > 0 && i < S.pull * n;
      if (lit) { g.globalCompositeOperation = 'lighter'; g.drawImage(glow('#fff36b'), cx - 22, y - 22, 44, 44); g.globalCompositeOperation = 'source-over'; }
      g.strokeStyle = lit ? '#fff36b' : `rgba(255,255,255,${on})`; g.lineWidth = 5; g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(cx - 10, y + 7); g.lineTo(cx, y - 4); g.lineTo(cx + 10, y + 7); g.stroke();
    }
    // the plunger: a candy knob on a spring, pulled down by the finger
    const top = PLUNGER_Y + S.pull * 40 + S.kick, w = R - LANE_X - 8;
    const coil = Math.max(6, FLOOR + 10 - (top + 18));
    g.strokeStyle = theme.spring; g.lineWidth = 3;
    g.beginPath(); for (let i = 0; i <= 8; i++) { const y = top + 18 + (coil * i) / 8; g.lineTo(i % 2 ? R - 7 : LANE_X + 7, y); } g.stroke();
    const pg = g.createLinearGradient(LANE_X, 0, R, 0); pg.addColorStop(0, theme.plunger[0]); pg.addColorStop(.5, theme.plunger[1]); pg.addColorStop(1, theme.plunger[2]);
    g.fillStyle = pg; g.beginPath(); g.roundRect(LANE_X + 4, top, w, 18, 6); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(LANE_X + 10, top + 5 + i * 4); g.lineTo(R - 10, top + 5 + i * 4); g.stroke(); }
  }
  function drawBumper(bp, t) {
    const s = 1 + bp.pulse * .28, r = 28 * s, lvl = Math.min(spr.bumpers.length - 1, bp.level);
    if (bp.pulse > 0) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = bp.pulse; g.drawImage(glow(theme.bumperRing[lvl][2]), bp.x - 60, bp.y - 60, 120, 120); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; }
    g.drawImage(spr.bumpers[lvl], bp.x - r, bp.y - r, r * 2, r * 2);
    drawEmoji(g, theme.bumper, bp.x, bp.y - 3 * s, 30 * s, Math.sin(t * 2 + bp.x) * .08);
    // its value on a little pill
    const v = String(bp.value); g.font = FONT(12); g.textAlign = 'center'; g.textBaseline = 'middle';
    const pw = 10 + v.length * 7; g.fillStyle = theme.text; g.beginPath(); g.roundRect(bp.x - pw / 2, bp.y + 12 * s, pw, 15, 7); g.fill();
    g.fillStyle = '#fff'; g.fillText(v, bp.x, bp.y + 12 * s + 8);
  }
  function drawSensor(s, t) {
    const bob = Math.sin(t * 3 + s.x * .1) * 3, born = Math.min(1, (s.age || 0) * 3), sc = born < 1 ? born * (1.3 - .3 * born) : 1;
    if (s.kind === 'gem') {
      g.globalCompositeOperation = 'lighter'; g.globalAlpha = .45 + .25 * Math.sin(t * 5 + s.x); g.drawImage(glow('#ffffff'), s.x - 18, s.y - 18 + bob, 36, 36); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      if (theme.gem === 'pearl') g.drawImage(spr.pearl, s.x - 10 * sc, s.y - 10 * sc + bob, 20 * sc, 20 * sc); else drawEmoji(g, theme.gem, s.x, s.y + bob, 24 * sc);
    } else if (s.kind === 'multi' || s.kind === 'crown') {
      const col = s.kind === 'multi' ? '#ffffff' : '#ffe14d';
      g.save(); g.translate(s.x, s.y + bob); g.rotate(t * .8); g.globalAlpha = .55;
      g.fillStyle = col; for (let i = 0; i < 8; i++) { g.rotate(Math.PI / 4); g.beginPath(); g.moveTo(-3, 0); g.lineTo(3, 0); g.lineTo(0, -40 * sc); g.fill(); }
      g.restore(); g.globalAlpha = 1;
      g.globalCompositeOperation = 'lighter'; g.drawImage(glow(s.kind === 'multi' ? '#ff9ff3' : '#ffd84d'), s.x - 38, s.y - 38 + bob, 76, 76); g.globalCompositeOperation = 'source-over';
      drawEmoji(g, s.kind === 'multi' ? theme.multi : theme.crown, s.x, s.y + bob, 40 * sc * (1 + .06 * Math.sin(t * 6)));
    } else if (s.kind === 'lift') {
      if (theme.lift === 'bubble') g.drawImage(spr.bubble, s.x - 26 * sc, s.y - 26 * sc + bob, 52 * sc, 52 * sc);
      else drawEmoji(g, theme.lift, s.x, s.y + bob, 54 * sc);
    }
  }
  function drawMover(m, t) {
    const flip = m.vx > 0 ? -1 : 1, sq = 1 + m.pulse * .3;
    g.save(); g.translate(m.x, m.y + Math.sin(t * 3) * 3); g.scale(sq, 1 / sq);
    drawEmoji(g, theme.mover, 0, 0, 54, Math.sin(t * 4) * .12, flip); g.restore();
  }
  function drawBall(b, t) {
    // the trail: a rainbow ribbon, or a stream of little bubbles
    const tr = b.trail;
    if (tr && tr.length > 2 && theme.trail === 'rainbow') {
      g.lineCap = 'round';
      for (let i = 1; i < tr.length; i++) {
        const k = i / tr.length; g.strokeStyle = `hsla(${(t * 240 + i * 22) % 360},95%,65%,${k * .8})`; g.lineWidth = BALL_R * 1.5 * k;
        g.beginPath(); g.moveTo(tr[i - 1][0], tr[i - 1][1]); g.lineTo(tr[i][0], tr[i][1]); g.stroke();
      }
    }
    if (b.lift) {
      if (theme.lift === 'bubble') g.drawImage(spr.bubble, b.x - 26, b.y - 26, 52, 52);
      else drawEmoji(g, theme.lift, b.x, b.y + 6, 62);
    }
    if (b.crown) drawEmoji(g, theme.crown, b.x, b.y - 18, 18, Math.sin(t * 8) * .2);
    g.drawImage(spr.ball, b.x - BALL_R - 2, b.y - BALL_R - 2, BALL_R * 2 + 4, BALL_R * 2 + 4);
    // its points so far, riding along above it
    if (b.pts > 0 && !b.pinned) {
      g.font = FONT(15); g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 4; g.lineJoin = 'round';
      g.strokeStyle = theme.text; g.strokeText(b.pts, b.x, b.y - (b.crown ? 34 : 22)); g.fillStyle = '#fff'; g.fillText(b.pts, b.x, b.y - (b.crown ? 34 : 22));
    }
  }

  /** a screen point (CSS px) -> board units */
  const toWorld = (x, y) => [(x - V.ox) / V.s, (y - V.oy) / V.s];
  /** board units -> a screen point (CSS px) */
  const toScreen = (x, y) => [V.ox + x * V.s, V.oy + y * V.s];
  return { V, resize, setTheme, frame, update, P, toWorld, toScreen };
}
