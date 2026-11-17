// The board on screen: squares, sparkle tiles, one sprite per piece (created once, moved for life, keyed by the piece's id),
// and play(steps) — animates the engine's step list in order, each step waiting for the one before (§3).
import { Container, Graphics, Point } from 'pixi.js';
import gsap from 'gsap';
import { BABY, ROW, COL, BURST } from '../game/engine.js';
import { makePiece, restyle, U } from './piece.js';
import { mirrorOf, applyStep, compare } from './mirror.js';

const DEV = import.meta.env.DEV;
/** the next step may start once the timeline reaches `at` s; the rest (a pop shrinking away, a landing squash) finishes alongside it */
const until = (tl, at) => new Promise((res) => { tl.call(res, null, Math.max(0, at)); });

export class Board {
  constructor(app, theme) {
    this.app = app; this.theme = theme;
    this.root = new Container();
    this.squares = new Graphics(); this.tileLayer = new Graphics();
    this.pieces = new Container(); this.fx = new Container();
    this.pieces.sortableChildren = true;                 // a touched piece is drawn above its neighbours
    this.clip = new Graphics();
    this.root.addChild(this.squares, this.tileLayer, this.pieces, this.fx, this.clip);
    this.pieces.mask = this.clip;                         // new pieces fall in from above without showing over the goal bar
    app.stage.addChild(this.root);
    this.sprites = new Map();
  }

  /** start a new game on screen */
  load(g) {
    this.g = g; this.w = g.w; this.h = g.h;
    for (const s of this.sprites.values()) s.destroy({ children: true });
    this.sprites.clear(); this.fx.removeChildren();
    this.m = mirrorOf(g);
    const { w, h } = this, sq = this.squares;
    sq.clear();
    sq.roundRect(-14, -14, w * U + 28, h * U + 28, 34).fill({ color: 0xffffff, alpha: 0.32 });
    for (let i = 0; i < w * h; i++) if (g.open[i]) {
      const x = (i % w) * U, y = ((i / w) | 0) * U, odd = ((i % w) + ((i / w) | 0)) % 2;
      sq.roundRect(x + 3, y + 3, U - 6, U - 6, 18).fill({ color: this.theme.square, alpha: odd ? 0.5 : 0.32 });
    }
    this.clip.clear().rect(-14, -14, w * U + 28, h * U + 28).fill(0xffffff);
    this.drawTiles();
    this.m.cells.forEach((c, i) => c && this.spawn(c, i));
  }

  drawTiles(tiles = this.m.tiles) {
    const t = this.tileLayer; t.clear();
    tiles.forEach((v, i) => {
      if (!v) return; const x = (i % this.w) * U, y = ((i / this.w) | 0) * U;
      t.roundRect(x + 5, y + 5, U - 10, U - 10, 16).fill({ color: 0xffd23f, alpha: v > 1 ? 0.95 : 0.6 }).stroke({ width: 4, color: 0xfff3b0, alpha: 0.9 });
    });
  }

  pos(i) { return { x: (i % this.w) * U + U / 2, y: ((i / this.w) | 0) * U + U / 2 }; }
  spawn(c, i) {
    const s = makePiece(this.theme, c.k, c.sp), p = this.pos(i);
    s.position.set(p.x, p.y); this.pieces.addChild(s); this.sprites.set(c.id, s); return s;
  }
  spriteAt(i) { const c = this.m.cells[i]; return c ? this.sprites.get(c.id) : null; }

  /** fit the board into a rectangle of the screen (CSS px); square cells, centred */
  layout(r) {
    const k = Math.min(r.w / (this.w * U + 28), r.h / (this.h * U + 28));
    this.scale = k; this.root.scale.set(k);
    this.root.position.set(r.x + (r.w - this.w * U * k) / 2, r.y + (r.h - this.h * U * k) / 2);
  }
  /** the open, filled square under a screen point, or -1 */
  cellAt(x, y) {
    const p = this.root.toLocal(new Point(x, y)), cx = Math.floor(p.x / U), cy = Math.floor(p.y / U);
    if (cx < 0 || cy < 0 || cx >= this.w || cy >= this.h) return -1;
    const i = cy * this.w + cx; return this.g.open[i] && this.m.cells[i] ? i : -1;
  }

  /** a touched piece lifts 6 % and brightens, at once (no tween: within one frame) */
  lift(i, on) {
    const s = typeof i === 'number' ? this.spriteAt(i) : i; if (!s || s.destroyed) return null;
    gsap.killTweensOf(s.inner.scale); s.inner.scale.set(on ? 1.06 : 1); s.glow.alpha = on ? 0.22 : 0; s.zIndex = on ? 1 : 0;
    return s;
  }

  /** a swap that matches nothing: out and back in 200 ms, no red, no shake */
  wobble(a, b) {
    const sa = this.spriteAt(a), sb = this.spriteAt(b); if (!sa || !sb) return Promise.resolve();
    const pa = this.pos(a), pb = this.pos(b), dx = (pb.x - pa.x) * 0.34, dy = (pb.y - pa.y) * 0.34, tl = gsap.timeline();
    tl.to(sa.inner, { x: dx, y: dy, duration: 0.1, ease: 'power2.out' }, 0).to(sb.inner, { x: -dx, y: -dy, duration: 0.1, ease: 'power2.out' }, 0)
      .to([sa.inner, sb.inner], { x: 0, y: 0, duration: 0.1, ease: 'power2.in' }, 0.1);
    return tl.then();
  }

  /** animate the steps of one move, in order */
  async play(steps) {
    for (const s of steps) { if (this[s.t]) await this[s.t](s); applyStep(this.m, s); }
    if (DEV) this.check();
  }
  check() {
    let diff = compare(this.m, this.g);
    if (!diff) for (const [id, s] of this.sprites) {
      const i = this.m.cells.findIndex((c) => c && c.id === id), p = i >= 0 && this.pos(i);
      if (!p) { diff = `sprite ${id} is not on the board`; break; }
      if (Math.abs(s.x - p.x) > 0.5 || Math.abs(s.y - p.y) > 0.5) { diff = `sprite ${id} sits at ${s.x},${s.y} not square ${i}`; break; }
    }
    if (diff) { console.error('[match] screen and game disagree:', diff); this.load(this.g); }   // never leave the child with a wrong board
    return diff;
  }

  // ------------------------------------------------------------------------------------------------ one handler per step
  swap({ a, b }) {
    const sa = this.spriteAt(a), sb = this.spriteAt(b), pa = this.pos(a), pb = this.pos(b), tl = gsap.timeline();
    const nx = (pb.y - pa.y) / U * 9, ny = (pb.x - pa.x) / U * 9;            // the two arc slightly past each other
    tl.to(sa, { x: pb.x, y: pb.y, duration: 0.14, ease: 'power2.out' }, 0).to(sb, { x: pa.x, y: pa.y, duration: 0.14, ease: 'power2.out' }, 0)
      .to(sa.inner, { x: nx, y: -ny, duration: 0.07, yoyo: true, repeat: 1, ease: 'sine.out' }, 0)
      .to(sb.inner, { x: -nx, y: ny, duration: 0.07, yoyo: true, repeat: 1, ease: 'sine.out' }, 0);
    this.lift(sa, false); this.lift(sb, false);
    return tl.then();
  }

  clear({ cells, fired, made }) {
    const tl = gsap.timeline();
    for (const f of fired) this.effect(f, tl);
    const t0 = fired.length ? 0.08 : 0;
    for (const i of cells) {
      const s = this.spriteAt(i); if (!s) continue;
      this.sprites.delete(this.m.cells[i].id);
      tl.to(s.inner.scale, { x: 1.2, y: 1.2, duration: 0.06, ease: 'power1.out', overwrite: 'auto' }, t0)
        .to(s.inner.scale, { x: 0, y: 0, duration: 0.12, ease: 'power2.in', onComplete: () => s.destroy({ children: true }) }, t0 + 0.06);
    }
    for (const p of made) {                                                      // the new power-up grows out of the pop
      const s = this.spawn(p, p.i); s.inner.scale.set(0);
      tl.to(s.inner.scale, { x: 1, y: 1, duration: 0.22, ease: 'back.out(2.2)' }, t0 + 0.1);
    }
    if (cells.some((i) => this.m.tiles[i])) tl.call(() => { const keep = this.m.tiles.slice(); cells.forEach((i) => keep[i] && keep[i]--); this.drawTiles(keep); }, null, t0 + 0.1);
    return until(tl, t0 + 0.13);
  }

  /** a power-up going off (Phase 0: a plain flash; Phase 1 brings the ribbon, ring and streaks) */
  effect({ i, sp }, tl) {
    const p = this.pos(i), g = new Graphics(), W = this.w * U, H = this.h * U;
    if (sp === ROW) g.roundRect(0, p.y - 34, W, 68, 34).fill({ color: 0xffffff, alpha: 0.85 });
    else if (sp === COL) g.roundRect(p.x - 34, 0, 68, H, 34).fill({ color: 0xffffff, alpha: 0.85 });
    else if (sp === BURST) g.circle(p.x, p.y, U * 1.5).stroke({ width: 18, color: 0xffffff, alpha: 0.9 });
    else g.circle(p.x, p.y, U * 0.7).fill({ color: 0xffffff, alpha: 0.9 });
    this.fx.addChild(g);
    tl.fromTo(g, { alpha: 1 }, { alpha: 0, duration: 0.25, ease: 'power1.in', onComplete: () => g.destroy() }, 0);
  }

  fall({ moved, born }) {
    const tl = gsap.timeline(), top = (x) => { for (let y = 0; y < this.h; y++) if (this.g.open[y * this.w + x]) return y; return 0; };
    const land = (s, at) => tl.to(s.inner.scale, { x: 1.06, y: 0.92, duration: 0.045, ease: 'power1.out', overwrite: 'auto' }, at).to(s.inner.scale, { x: 1, y: 1, duration: 0.045, ease: 'power1.in' }, at + 0.045);
    let end = 0;
    const drop = (s, to, rows, beat) => {
      const p = this.pos(to), d = Math.max(0.07, rows * 0.07);
      tl.to(s, { x: p.x, y: p.y, duration: d, ease: 'power2.in' }, beat); land(s, beat + d); end = Math.max(end, beat + d);
    };
    const beatOf = new Map();                                               // pieces in the same column land a beat apart, lowest first
    const beat = (i) => { const x = i % this.w, n = beatOf.get(x) || 0; beatOf.set(x, n + 1); return n * 0.018; };
    for (const mv of [...moved].sort((a, b) => b.to - a.to)) {
      const s = this.sprites.get(mv.id); if (!s) continue;
      drop(s, mv.to, ((mv.to / this.w) | 0) - ((mv.from / this.w) | 0), beat(mv.to));
    }
    for (const b of [...born].sort((p, q) => q.to - p.to)) {
      const x = b.to % this.w, s = this.spawn({ id: b.id, k: b.k, sp: 0 }, b.to), y0 = (top(x) + b.from) * U + U / 2;
      s.y = y0; drop(s, b.to, ((b.to / this.w) | 0) - top(x) - b.from, beat(b.to));
    }
    return until(tl, end);
  }

  baby({ i, id }) {                                                         // the friend takes the place of the piece on that top square
    const tl = gsap.timeline(), old = this.spriteAt(i);
    if (old) { this.sprites.delete(this.m.cells[i].id); tl.to(old.inner.scale, { x: 0, y: 0, duration: 0.12, ease: 'power2.in', onComplete: () => old.destroy({ children: true }) }, 0); }
    const s = this.spawn({ id, k: BABY, sp: 0 }, i); s.inner.scale.set(0);
    tl.to(s.inner.scale, { x: 1, y: 1, duration: 0.25, ease: 'back.out(2)' }, old ? 0.08 : 0);
    return tl.then();
  }
  home({ babies }) {
    const tl = gsap.timeline();
    for (const b of babies) {
      const s = this.sprites.get(b.id); if (!s) continue; this.sprites.delete(b.id);
      tl.to(s, { y: s.y - U * 0.4, duration: 0.15, ease: 'power2.out' }, 0).to(s, { y: s.y + U * 1.6, alpha: 0, duration: 0.3, ease: 'power2.in', onComplete: () => s.destroy({ children: true }) }, 0.15);
    }
    return tl.then();
  }
  helper({ cells }) {                                                       // Phase 0: the squares the friend touches glow gold
    const tl = gsap.timeline();
    cells.forEach((i, n) => { const s = this.spriteAt(i); if (s) tl.to(s.glow, { alpha: 0.7, duration: 0.12, yoyo: true, repeat: 1 }, n * 0.05); });
    return tl.then();
  }
  gift({ i, sp }) {
    const s = this.spriteAt(i); if (!s) return;
    return gsap.timeline().to(s.inner.scale, { x: 0.2, y: 0.2, duration: 0.12, ease: 'power2.in', onComplete: () => restyle(s, this.theme, s.k, sp) })
      .to(s.inner.scale, { x: 1, y: 1, duration: 0.25, ease: 'back.out(2.4)' }).then();
  }
  shuffle({ cells }) {
    const tl = gsap.timeline();
    for (const c of cells) {
      const s = this.sprites.get(c.id); if (!s) continue;
      tl.to(s.inner, { rotation: Math.PI * 2, duration: 0.45, ease: 'power2.inOut', onComplete: () => { s.inner.rotation = 0; } }, 0)
        .call(() => restyle(s, this.theme, c.k, s.sp), null, 0.22);
    }
    return tl.then();
  }
  win() {                                                                   // the pieces left on the board pop in a wave
    const tl = gsap.timeline();
    for (const [, s] of this.sprites) tl.to(s.inner.scale, { x: 1.18, y: 1.18, duration: 0.12, yoyo: true, repeat: 1, ease: 'sine.inOut' }, (s.x + s.y) / U * 0.04);
    return tl.then();
  }
}
