// One piece, drawn in code (Phase 0: plain coloured rounded squares; Phase 1 swaps in the theme's pictures).
// Board units: a square is U = 100 across and a piece is centred on (0, 0). Structure: sprite (sits on its square)
// → inner (lift, squash, wobble) → body graphics + glow (brightens when touched).
import { Container, Graphics } from 'pixi.js';
import { BABY, RAINBOW, ROW, COL, BURST } from '../game/engine.js';

export const U = 100;
const S = 43, R = 22;                                   // half-size and corner radius of a piece

export function makePiece(theme, k, sp) {
  const sprite = new Container(), inner = new Container(), body = new Graphics(), glow = new Graphics();
  glow.roundRect(-S, -S, S * 2, S * 2, R).fill({ color: 0xffffff, alpha: 1 }); glow.alpha = 0;
  inner.addChild(body, glow); sprite.addChild(inner);
  sprite.inner = inner; sprite.body = body; sprite.glow = glow;
  restyle(sprite, theme, k, sp);
  return sprite;
}

/** redraw a piece as kind k with power-up sp (pieces change on a gift or a shuffle) */
export function restyle(sprite, theme, k, sp) {
  sprite.k = k; sprite.sp = sp;
  const g = sprite.body; g.clear();
  g.roundRect(-S, -S + 5, S * 2, S * 2, R).fill({ color: 0x000000, alpha: 0.16 });              // soft shadow under it
  if (k === BABY) {
    const b = theme.baby;
    g.roundRect(-S, -S, S * 2, S * 2, R).fill(b.body).stroke({ width: 5, color: b.edge });
    g.ellipse(-17, -S + 2, 9, 16).fill(b.ear); g.ellipse(17, -S + 2, 9, 16).fill(b.ear);        // ears (bunny) / flippers (seal)
    g.circle(-13, -4, 6).fill(0x3a2a40); g.circle(13, -4, 6).fill(0x3a2a40); g.circle(0, 10, 6).fill(b.nose);
    return;
  }
  if (k === RAINBOW) {
    g.circle(0, 0, S).fill(0xffffff);
    theme.rainbow.forEach((c, n) => g.circle(0, 0, S - 5 - n * 6.5).fill(c));
    g.circle(0, 0, 9).fill(0xffffff);
    return;
  }
  const col = theme.colors[k];
  g.roundRect(-S, -S, S * 2, S * 2, R).fill(col);
  g.roundRect(-S + 8, -S + 6, S * 2 - 16, 26, 13).fill({ color: 0xffffff, alpha: 0.38 });          // gloss
  if (sp === ROW || sp === COL) {
    const along = (x, y, w, h) => (sp === ROW ? g.rect(x, y, w, h) : g.rect(y, x, h, w));
    along(-S, -11, S * 2, 22).fill({ color: 0xffffff, alpha: 0.92 });
    const arrow = (d) => (sp === ROW ? g.poly([d * 38, 0, d * 22, -15, d * 22, 15]) : g.poly([0, d * 38, -15, d * 22, 15, d * 22]));
    arrow(1).fill(col); arrow(-1).fill(col);
  } else if (sp === BURST) {
    g.circle(0, 0, 25).stroke({ width: 9, color: 0xffffff, alpha: 0.95 });
    g.circle(0, 0, 9).fill(0xffffff);
  }
}
