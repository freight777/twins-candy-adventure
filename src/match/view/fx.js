// The juice (§6 "Feel"): particles, the ribbon a line power-up sweeps, the ring of a pop power-up, the streaks of a magic piece,
// shakes and bumps, and the slight dim. All in board units (a square = 100) inside the board's fx layer, driven by GSAP.
import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import gsap from 'gsap';

let dot = null;
/** a soft round particle texture, made once */
function dotTexture() {
  if (dot) return dot;
  const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'), g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, '#fff'); g.addColorStop(0.55, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32);
  return (dot = Texture.from(c));
}
const toNum = (c) => (typeof c === 'number' ? c : parseInt(String(c).replace('#', ''), 16));

export class Fx {
  constructor(layer, board) { this.layer = layer; this.board = board; this.pool = []; }

  /** 8–12 particles in the piece's colour, flying out and falling */
  burst(x, y, color, n = 8 + ((Math.random() * 5) | 0), spread = 1) {
    const tex = dotTexture(), tint = toNum(color);
    for (let i = 0; i < n; i++) {
      const p = this.pool.pop() || new Sprite(tex); p.texture = tex; p.anchor.set(0.5); p.tint = i % 3 === 0 ? 0xffffff : tint; p.alpha = 1;
      const s = 0.5 + Math.random() * 0.6; p.scale.set(s); p.position.set(x, y); this.layer.addChild(p);
      const a = Math.random() * Math.PI * 2, d = (40 + Math.random() * 60) * spread;
      gsap.to(p, { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d + 30, alpha: 0, duration: 0.42 + Math.random() * 0.2, ease: 'power2.out', onComplete: () => { p.removeFromParent(); this.pool.push(p); } });
      gsap.to(p.scale, { x: s * 0.3, y: s * 0.3, duration: 0.55, ease: 'power1.in' });
    }
  }
  /** Rainbow Line / Wave: a ribbon of light sweeps the row or column in 250 ms, from the power-up outwards */
  ribbon(i, along, theme, at, tl) {
    const { w, h } = this.board, p = this.board.pos(i), g = new Graphics(), L = along === 'row' ? w * 100 : h * 100;
    const cols = theme.id === 'unicorn' ? theme.rainbow : [0xffffff, 0xbff4ff, 0x7fdcff, 0xbff4ff, 0xffffff];
    cols.forEach((c, n) => (along === 'row' ? g.rect(-L, -36 + n * (72 / cols.length), L * 2, 72 / cols.length) : g.rect(-36 + n * (72 / cols.length), -L, 72 / cols.length, L * 2)).fill({ color: c, alpha: 0.9 }));
    g.position.set(p.x, p.y); g.scale.set(along === 'row' ? 0 : 1, along === 'row' ? 1 : 0); g.alpha = 0.95; this.layer.addChild(g);
    tl.to(g.scale, { [along === 'row' ? 'x' : 'y']: 1, duration: 0.25, ease: 'power1.out' }, at).to(g, { alpha: 0, duration: 0.2, onComplete: () => g.destroy() }, at + 0.2);
    for (let n = 0; n < 6; n++) tl.call(() => this.burst(p.x + (along === 'row' ? (n - 2.5) * L / 6 : 0), p.y + (along === 'row' ? 0 : (n - 2.5) * L / 6), cols[n % cols.length], 4), null, at + n * 0.03);
  }
  /** Sparkle Pop / Bubble Pop: a ring expands over the 3 × 3 */
  ring(i, theme, at, tl) {
    const p = this.board.pos(i), g = new Graphics();
    g.circle(0, 0, 100).stroke({ width: 22, color: theme.id === 'unicorn' ? 0xfff07a : 0xbff4ff, alpha: 0.95 }); g.circle(0, 0, 100).stroke({ width: 8, color: 0xffffff });
    g.position.set(p.x, p.y); g.scale.set(0.2); this.layer.addChild(g);
    tl.to(g.scale, { x: 1.55, y: 1.55, duration: 0.25, ease: 'power2.out' }, at).to(g, { alpha: 0, duration: 0.18, onComplete: () => g.destroy() }, at + 0.14);
    tl.call(() => this.burst(p.x, p.y, theme.id === 'unicorn' ? 0xffe14d : 0x9ff3ff, 14, 1.6), null, at);
  }
  /** a magic piece: a streak flies from it to one piece */
  streak(from, to, color, at, tl) {
    const a = this.board.pos(from), b = this.board.pos(to), s = new Sprite(dotTexture()); s.anchor.set(0.5); s.tint = toNum(color); s.scale.set(1.3); s.position.set(a.x, a.y); s.alpha = 0;
    this.layer.addChild(s);
    tl.set(s, { alpha: 1 }, at).to(s, { x: b.x, y: b.y, duration: 0.16, ease: 'power1.in' }, at)
      .call(() => this.burst(b.x, b.y, color, 3, 0.5), null, at + 0.16).to(s, { alpha: 0, duration: 0.1, onComplete: () => s.destroy() }, at + 0.16);
  }
  /** shake the whole board: `px` screen pixels for `dur` seconds */
  shake(px, dur, at, tl) {
    const root = this.board.root, k = px / (this.board.scale || 1), steps = Math.max(2, Math.round(dur / 0.03));
    for (let n = 0; n < steps; n++) tl.to(root.pivot, { x: (Math.random() - 0.5) * 2 * k, y: (Math.random() - 0.5) * 2 * k, duration: 0.03, ease: 'none' }, at + n * 0.03);
    tl.to(root.pivot, { x: 0, y: 0, duration: 0.03 }, at + steps * 0.03);
  }
  /** a chain reaction's bump: the board drops 3 px and springs back */
  bump(at, tl) { const k = 3 / (this.board.scale || 1); tl.to(this.board.root.pivot, { y: -k, duration: 0.06, ease: 'power2.out' }, at).to(this.board.root.pivot, { y: 0, duration: 0.18, ease: 'back.out(3)' }, at + 0.06); }
  /** the screen dims slightly (behind the pieces) while a magic piece works */
  dim(on, at, tl) {
    if (!this.shade) { this.shade = new Graphics().rect(-5000, -5000, 10000, 10000).fill(0x1a0830); this.shade.alpha = 0; this.board.root.addChildAt(this.shade, 0); }
    tl.to(this.shade, { alpha: on ? 0.22 : 0, duration: 0.15 }, at);
  }
}
