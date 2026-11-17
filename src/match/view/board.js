// The board on screen: squares, sparkle tiles, one sprite per piece (created once, moved for life, keyed by the piece's id),
// and play(steps) — animates the engine's step list in order, each step waiting for the one before (§3), with the feel of §6:
// pops with particles on their own beat (a line power-up's ribbon sweeps outwards, a pop power-up's ring bursts, a magic piece
// streaks to each piece in turn), chain reactions climbing a pentatonic scale, collected pieces flying to the goal bar.
// hooks (set by main.js): sound(cue, opts) · cheer() · fly({ key, n, x, y, tex, at }) — x, y in screen px.
import { Container, Graphics, Point } from 'pixi.js';
import gsap from 'gsap';
import { BABY, RAINBOW, ROW, COL, BURST, STAR } from '../game/engine.js';
import { makePiece, restyle, pictureName, U } from './piece.js';
import { mirrorOf, applyStep, compare } from './mirror.js';
import { Fx } from './fx.js';
import { note } from '../../engine/sfxsprite.js';

const DEV = import.meta.env.DEV;
/** the next step may start once the timeline reaches `at` s; the rest (a pop shrinking away, a landing squash) finishes alongside it */
const until = (tl, at) => new Promise((res) => { tl.call(res, null, Math.max(0, at)); });

export class Board {
  constructor(app, theme, tex) {
    this.app = app; this.theme = theme; this.tex = tex;
    this.root = new Container();
    this.squares = new Graphics(); this.tileLayer = new Graphics();
    this.pieces = new Container(); this.fxLayer = new Container(); this.top = new Container();
    this.pieces.sortableChildren = true;                 // a touched piece is drawn above its neighbours
    this.clip = new Graphics();
    this.root.addChild(this.squares, this.tileLayer, this.pieces, this.fxLayer, this.clip, this.top);
    this.pieces.mask = this.clip;                         // new pieces fall in from above without showing over the goal bar
    app.stage.addChild(this.root);
    this.sprites = new Map(); this.fx = new Fx(this.fxLayer, this);
    this.hooks = { sound() {}, cheer() {}, fly() {} };
  }

  /** start a new game on screen */
  load(g) {
    this.g = g; this.w = g.w; this.h = g.h;
    for (const s of this.sprites.values()) s.destroy({ children: true });
    this.sprites.clear(); this.fxLayer.removeChildren();
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

  drawTiles(tiles = this.m.tiles) {                       // sparkle tiles: a glowing gold square under the piece (two layers = brighter)
    const t = this.tileLayer; t.clear();
    tiles.forEach((v, i) => {
      if (!v) return; const x = (i % this.w) * U, y = ((i / this.w) | 0) * U;
      t.roundRect(x + 2, y + 2, U - 4, U - 4, 20).fill({ color: 0xfff3b0, alpha: v > 1 ? 0.9 : 0.55 });
      t.roundRect(x + 7, y + 7, U - 14, U - 14, 16).fill({ color: 0xffd23f, alpha: v > 1 ? 1 : 0.7 }).stroke({ width: 3, color: 0xffffff, alpha: 0.8 });
    });
  }

  pos(i) { return { x: (i % this.w) * U + U / 2, y: ((i / this.w) | 0) * U + U / 2 }; }
  global(i) { const p = this.pos(i), q = this.root.toGlobal(new Point(p.x, p.y)); return { x: q.x, y: q.y }; }
  spawn(c, i) {
    const s = makePiece(this.theme, this.tex, c.k, c.sp), p = this.pos(i);
    s.position.set(p.x, p.y); this.pieces.addChild(s); this.sprites.set(c.id, s); return s;
  }
  spriteAt(i) { const c = this.m.cells[i]; return c ? this.sprites.get(c.id) : null; }
  colorOf(k) { return k >= 0 ? this.theme.colors[k] : k === RAINBOW ? 0xffe14d : 0xffffff; }

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

  /** a swap that matches nothing: out and back in 200 ms with a soft "boop"; no red, no shake */
  wobble(a, b) {
    const sa = this.spriteAt(a), sb = this.spriteAt(b); if (!sa || !sb) return Promise.resolve();
    this.hooks.sound('boop', { vol: 0.7 });
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

  /** when each square pops: matched squares at once; a power-up's squares as its effect reaches them (and it sets off others) */
  popTimes(cells, fired) {
    const gone = new Set(cells), t = new Map(), w = this.w;
    const reach = (i, at) => { if (gone.has(i) && (!t.has(i) || at < t.get(i))) t.set(i, at); };
    const effects = [];
    for (const f of fired) {
      const start = t.get(f.i) ?? 0, x = f.i % w, y = (f.i / w) | 0;
      if (f.sp === ROW) for (let a = 0; a < w; a++) reach(y * w + a, start + 0.04 + Math.abs(a - x) * 0.25 / w);
      else if (f.sp === COL) for (let a = 0; a < this.h; a++) reach(a * w + x, start + 0.04 + Math.abs(a - y) * 0.25 / this.h);
      else if (f.sp === BURST) { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (x + dx >= 0 && x + dx < w) reach((y + dy) * w + x + dx, start + 0.07); }
      else {                                                                // magic: a streak to each piece in turn, 40 ms apart, then they all pop together
        const targets = cells.filter((i) => i !== f.i && !t.has(i)), gap = Math.min(0.04, 0.6 / Math.max(1, targets.length)), end = start + 0.08 + targets.length * gap + 0.18;
        effects.push({ f, start, targets, gap }); targets.forEach((i) => reach(i, end)); reach(f.i, end);
        continue;
      }
      effects.push({ f, start });
    }
    cells.forEach((i) => reach(i, 0));
    return { t, effects };
  }

  clear({ cells, fired, made, chain = 1 }) {
    const tl = gsap.timeline(), { t, effects } = this.popTimes(cells, fired), goal = this.g.level.goal, tiles = this.m.tiles.slice();
    let last = 0;
    for (const { f, start, targets, gap } of effects) {
      if (f.sp === ROW || f.sp === COL) { this.fx.ribbon(f.i, f.sp === ROW ? 'row' : 'col', this.theme, start, tl); tl.call(() => this.hooks.sound('line'), null, start); }
      else if (f.sp === BURST) { this.fx.ring(f.i, this.theme, start, tl); this.fx.shake(6, 0.15, start, tl); tl.call(() => this.hooks.sound('burst'), null, start); }
      else {
        this.fx.dim(true, start, tl); tl.call(() => this.hooks.sound('magic'), null, start);
        targets.forEach((i, n) => { const at = start + 0.08 + n * gap; this.fx.streak(f.i, i, this.colorOf(this.m.cells[i]?.k), at, tl); if (n % 3 === 0) tl.call(() => this.hooks.sound('streak', { rate: note(Math.min(10, n / 3)), vol: 0.6 }), null, at); });
        this.fx.dim(false, start + 0.08 + targets.length * gap + 0.2, tl);
      }
    }
    const first = Math.min(...cells.map((i) => t.get(i) ?? 0));
    tl.call(() => this.hooks.sound(chain % 2 ? 'pop' : 'pop2', { rate: note(chain - 1), vary: false }), null, first);   // each link one note higher
    if (chain >= 3) { tl.call(() => this.hooks.cheer(), null, first); this.fx.bump(first, tl); }
    const flies = [];
    for (const i of [...cells].sort((a, b) => (t.get(a) ?? 0) - (t.get(b) ?? 0))) {          // in time order, so tile redraws stack up
      const s = this.spriteAt(i), c = this.m.cells[i], at = t.get(i) ?? 0; if (!s || !c) continue;
      this.sprites.delete(c.id); last = Math.max(last, at);
      const p = this.pos(i);
      tl.to(s.inner.scale, { x: 1.2, y: 1.2, duration: 0.06, ease: 'power1.out', overwrite: 'auto' }, at)
        .to(s.inner.scale, { x: 0, y: 0, duration: 0.12, ease: 'power2.in', onComplete: () => s.destroy({ children: true }) }, at + 0.06)
        .call(() => this.fx.burst(p.x, p.y, this.colorOf(c.k)), null, at + 0.08);
      if (tiles[i]) { tiles[i]--; const snap = tiles.slice(); tl.call(() => this.drawTiles(snap), null, at + 0.06); if (goal.type === 'tiles') flies.push({ key: 'tiles', n: 1, i, at, tex: null }); }
      if (goal.type === 'collect' && goal.kinds.includes(c.k)) flies.push({ key: 'k' + c.k, n: 1, i, at, tex: this.tex[pictureName(this.theme, c.k)] });
      if (goal.type === 'pop') flies.push({ key: 'pop', n: 1, i, at, tex: this.tex[pictureName(this.theme, c.k)] });
    }
    for (const p of made) {                                                      // the new power-up grows out of the pop
      const s = this.spawn(p, p.i), at = (t.get(p.i) ?? 0) + 0.08; s.inner.scale.set(0);
      tl.to(s.inner.scale, { x: 1, y: 1, duration: 0.24, ease: 'back.out(2.2)' }, at).call(() => this.hooks.sound('made'), null, at);
      if (goal.type === 'make') flies.push({ key: 'make', n: 1, i: p.i, at: at + 0.2, tex: this.tex[pictureName(this.theme, p.k)], keep: true });
    }
    this.send(flies, tl);
    return until(tl, last + 0.13);
  }

  /** tell main.js which goal things just happened, so they fly to the goal bar (a party level pops a lot: at most 6 fly, carrying the count) */
  send(flies, tl) {
    if (!flies.length) return;
    const byKey = new Map(); flies.forEach((f) => { if (!byKey.has(f.key)) byKey.set(f.key, []); byKey.get(f.key).push(f); });
    for (const list of byKey.values()) {
      const show = list.length > 6 ? list.filter((_, n) => n % Math.ceil(list.length / 6) === 0) : list, total = list.length;
      show.forEach((f, n) => tl.call(() => { const q = this.global(f.i); this.hooks.fly({ ...f, x: q.x, y: q.y, n: n === show.length - 1 ? total - (show.length - 1) : 1 }); }, null, f.at + 0.05));
    }
  }

  fall({ moved, born }) {
    const tl = gsap.timeline(), top = (x) => { for (let y = 0; y < this.h; y++) if (this.g.open[y * this.w + x]) return y; return 0; };
    const land = (s, at) => tl.to(s.inner.scale, { x: 1.08, y: 0.92, duration: 0.045, ease: 'power1.out', overwrite: 'auto' }, at).to(s.inner.scale, { x: 1, y: 1, duration: 0.045, ease: 'power1.in' }, at + 0.045);
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
  home({ babies }) {                                                        // the friend hops off the bottom into its home
    const tl = gsap.timeline(), flies = [];
    for (const b of babies) {
      const s = this.sprites.get(b.id); if (!s) continue; this.sprites.delete(b.id);
      tl.to(s, { y: s.y - U * 0.4, duration: 0.15, ease: 'power2.out' }, 0).to(s, { y: s.y + U * 1.6, alpha: 0, duration: 0.3, ease: 'power2.in', onComplete: () => s.destroy({ children: true }) }, 0.15);
      flies.push({ key: 'drop', n: 1, i: b.i, at: 0.1, tex: this.tex[this.theme.art.home] });
    }
    tl.call(() => this.hooks.sound('home'), null, 0.1);
    this.send(flies, tl);
    return tl.then();
  }
  helper({ cells }) {                                                       // Phase 2 stages the friend's visit; for now the squares glow gold
    const tl = gsap.timeline();
    tl.call(() => this.hooks.sound(this.theme.id === 'unicorn' ? 'jUniHelp' : 'jSeaHelp', { vary: false }), null, 0);
    cells.forEach((i, n) => { const s = this.spriteAt(i); if (s) tl.to(s.glow, { alpha: 0.7, duration: 0.12, yoyo: true, repeat: 1 }, n * 0.05); });
    return tl.then();
  }
  gift({ i, sp }) {
    const s = this.spriteAt(i); if (!s) return;
    this.hooks.sound('gift');
    const tl = gsap.timeline().to(s.inner.scale, { x: 0.2, y: 0.2, duration: 0.12, ease: 'power2.in', onComplete: () => restyle(s, this.theme, s.k, sp) })
      .to(s.inner.scale, { x: 1, y: 1, duration: 0.25, ease: 'back.out(2.4)' });
    if (this.g.level.goal.type === 'make') this.send([{ key: 'make', n: 1, i, at: 0.3, tex: this.tex[pictureName(this.theme, s.k)] }], tl);
    return tl.then();
  }
  shuffle({ cells }) {                                                      // a swirl; pieces take their new kinds
    const tl = gsap.timeline(), cx = this.w * U / 2, cy = this.h * U / 2;
    this.hooks.sound('shuffle');
    for (const c of cells) {
      const s = this.sprites.get(c.id); if (!s) continue; const p = this.pos(c.i);
      tl.to(s, { x: cx + (p.x - cx) * 0.4, y: cy + (p.y - cy) * 0.4, duration: 0.25, ease: 'power2.in' }, 0).to(s.inner, { rotation: Math.PI * 2, duration: 0.5, ease: 'power2.inOut', onComplete: () => { s.inner.rotation = 0; } }, 0)
        .call(() => restyle(s, this.theme, c.k, s.sp), null, 0.25).to(s, { x: p.x, y: p.y, duration: 0.25, ease: 'back.out(1.6)' }, 0.25);
    }
    return tl.then();
  }
  win() {                                                                   // the pieces left on the board pop in a wave
    const tl = gsap.timeline();
    for (const [, s] of this.sprites) {
      const at = (s.x + s.y) / U * 0.045;
      tl.to(s.inner.scale, { x: 1.25, y: 1.25, duration: 0.1, ease: 'power1.out' }, at).to(s.inner.scale, { x: 0, y: 0, duration: 0.14, ease: 'power2.in' }, at + 0.1)
        .call(() => this.fx.burst(s.x, s.y, this.colorOf(s.k), 8), null, at + 0.16);
    }
    return tl.then();
  }
}
