// The hint hand (§2 "Help that never feels like failing"): the two pieces of the best move wiggle and a hand shows the swipe
// (or taps the power-up). bestMove() in the engine picks a move that actually advances the goal.
import { Sprite, Assets } from 'pixi.js';
import gsap from 'gsap';

export async function createHint(board) {
  let hand = null, tl = null, wiggled = [];
  try { hand = new Sprite(await Assets.load(`${import.meta.env.BASE_URL}emoji/1f446.webp`)); hand.anchor.set(0.35, 0.05); hand.width = hand.height = 78; hand.visible = false; board.top.addChild(hand); } catch { /* the wiggle alone */ }
  function hide() {
    if (tl) { tl.kill(); tl = null; }
    wiggled.forEach((s) => { if (!s.destroyed) s.inner.rotation = 0; }); wiggled = [];
    if (hand) hand.visible = false;
  }
  function show(move) {
    hide(); if (!move) return;
    const cells = move.tap !== undefined ? [move.tap] : [move.a, move.b];
    wiggled = cells.map((i) => board.spriteAt(i)).filter(Boolean);
    tl = gsap.timeline({ repeat: -1, repeatDelay: 0.5 });
    wiggled.forEach((s) => tl.to(s.inner, { rotation: 0.14, duration: 0.08, yoyo: true, repeat: 5, ease: 'sine.inOut' }, 0));
    if (hand) {
      const a = board.pos(cells[0]), b = board.pos(cells[1] ?? cells[0]);
      hand.visible = true; hand.alpha = 0; hand.position.set(a.x, a.y);
      if (move.tap !== undefined) tl.to(hand, { alpha: 1, duration: 0.15 }, 0).to(hand.scale, { x: hand.scale.x * 0.85, y: hand.scale.y * 0.85, duration: 0.15, yoyo: true, repeat: 3 }, 0.2).to(hand, { alpha: 0, duration: 0.2 }, 1.2);
      else tl.to(hand, { alpha: 1, duration: 0.15 }, 0).to(hand, { x: b.x, y: b.y, duration: 0.55, ease: 'power2.inOut' }, 0.3).to(hand, { alpha: 0, duration: 0.2 }, 1.0).set(hand, { x: a.x, y: a.y }, 1.25);
    }
    board.hooks.sound('hint', { vol: 0.6 });
  }
  return { show, hide, get on() { return !!tl; } };
}
