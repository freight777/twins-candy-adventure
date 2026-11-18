// One piece. Board units: a square is U = 100 across and a piece is centred on (0, 0). Structure: sprite (sits on its square)
// → inner (lift, squash, wobble, pop) → tile + picture + power-up marks + glow (brightens when touched).
// Each piece sits on a soft rounded tile tinted with its colour, so kinds are told apart by colour, shape and picture at once (§7).
// The pictures are Fluent Emoji 3D (tools/fetch-art.mjs); if they have not loaded, the tile alone still plays.
import { Container, Graphics, Sprite, Assets } from 'pixi.js';
import { BABY, RAINBOW, ROW, COL, BURST } from '../game/engine.js';
import { artFile } from '../themes.js';

export const U = 100;
const S = 44, R = 24;                                   // half-size and corner radius of a tile
const BASE = `${import.meta.env.BASE_URL}assets/match/`;

/** load every picture a door needs; resolves to a lookup by name (missing pictures are simply absent) */
export async function loadArt(theme) {
  const tex = {};
  await Promise.all([...theme.names, ...Object.values(theme.art).filter(Boolean)].map(async (n) => { try { tex[n] = await Assets.load(BASE + artFile(n) + '.webp'); } catch { /* play on with tiles */ } }));
  return tex;
}

const mix = (hex, t) => { const c = parseInt(hex.slice(1), 16), m = (v) => Math.round(v + (255 - v) * t); return (m(c >> 16) << 16) | (m((c >> 8) & 255) << 8) | m(c & 255); };
/** the picture for a piece, by name */
export const pictureName = (theme, k) => (k === BABY ? theme.art.home : k === RAINBOW ? theme.art.magic : theme.names[k]);

export function makePiece(theme, tex, k, sp) {
  const sprite = new Container(), inner = new Container(), tile = new Graphics(), marks = new Graphics(), pic = new Sprite(), extra = new Container(), glow = new Graphics();
  pic.anchor.set(0.5);
  glow.roundRect(-S, -S, S * 2, S * 2, R).fill({ color: 0xffffff, alpha: 1 }); glow.alpha = 0;
  inner.addChild(tile, marks, pic, extra, glow); sprite.addChild(inner);
  Object.assign(sprite, { inner, tile, marks, pic, extra, glow, tex });
  restyle(sprite, theme, k, sp);
  return sprite;
}

/** redraw a piece as kind k with power-up sp (pieces change on a gift or a shuffle) */
export function restyle(sprite, theme, k, sp) {
  sprite.k = k; sprite.sp = sp;
  const { tile: g, marks: m, pic, extra, tex } = sprite, name = pictureName(theme, k), t = tex[name];
  g.clear(); m.clear(); extra.removeChildren().forEach((c) => c.destroy());
  const col = k >= 0 ? theme.colors[k] : null;
  g.roundRect(-S, -S + 5, S * 2, S * 2, R).fill({ color: 0x000000, alpha: 0.14 });                     // soft shadow
  if (k === BABY) g.roundRect(-S, -S, S * 2, S * 2, R).fill(0xffffff).stroke({ width: 5, color: theme.baby.edge });
  else if (k === RAINBOW) {                                                                             // the magic piece: a glowing gold tile
    g.roundRect(-S, -S, S * 2, S * 2, R).fill(0xfff6c8).stroke({ width: 6, color: 0xffcf3a });
    g.circle(0, 0, S - 6).fill({ color: 0xffffff, alpha: 0.85 });
  } else {
    g.roundRect(-S, -S, S * 2, S * 2, R).fill(mix(col, 0.55)).stroke({ width: 4, color: mix(col, 0.15) });
    g.roundRect(-S + 8, -S + 5, S * 2 - 16, 24, 12).fill({ color: 0xffffff, alpha: 0.45 });          // gloss
  }
  if (sp === ROW || sp === COL) {                                                                       // Rainbow Line / Wave: a band, arrows show the way it clears
    const band = (a, w) => (sp === ROW ? m.rect(-S + 2, a, S * 2 - 4, w) : m.rect(a, -S + 2, w, S * 2 - 4));
    if (theme.id === 'unicorn') theme.rainbow.forEach((c, n) => band(-15 + n * 5, 5).fill(c));
    else { band(-15, 30).fill({ color: 0xffffff, alpha: 0.9 }); band(-15, 5).fill(0x7fdcff); band(10, 5).fill(0x7fdcff); }
    const arrow = (d) => (sp === ROW ? m.poly([d * 43, 0, d * 29, -14, d * 29, 14]) : m.poly([0, d * 43, -14, d * 29, 14, d * 29]));
    for (const d of [1, -1]) arrow(d).fill(0xffffff).stroke({ width: 3, color: col ? parseInt(col.slice(1), 16) : 0x666666, alpha: 0.9 });
    if (theme.art.band && tex[theme.art.band]) for (const d of [1, -1]) { const w = new Sprite(tex[theme.art.band]); w.anchor.set(0.5); w.width = w.height = 26; w.position.set(sp === ROW ? d * 30 : 0, sp === ROW ? 0 : d * 30); extra.addChild(w); }
  } else if (sp === BURST) {                                                                            // Sparkle Pop / Bubble Pop: a ring
    m.circle(0, 0, S - 3).stroke({ width: 6, color: 0xffffff, alpha: 0.95 });
    if (tex[theme.art.ring]) { const r = new Sprite(tex[theme.art.ring]); r.anchor.set(0.5); r.width = r.height = 40; r.position.set(26, -26); extra.addChild(r); }
  }
  if (t) { pic.texture = t; pic.visible = true; const size = k === RAINBOW ? 82 : sp ? 62 : 72; pic.width = pic.height = size; }
  else {                                                                                                // no picture: Phase 0's plain look
    pic.visible = false;
    if (k === BABY) { g.circle(-13, -4, 6).fill(0x3a2a40); g.circle(13, -4, 6).fill(0x3a2a40); g.circle(0, 10, 6).fill(theme.baby.nose); }
    else if (k === RAINBOW) theme.rainbow.forEach((c, n) => g.circle(0, 0, S - 8 - n * 6).fill(c));
    else g.roundRect(-S + 10, -S + 10, S * 2 - 20, S * 2 - 20, R - 8).fill(col);
  }
}
