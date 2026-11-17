// Swipe and tap-tap (§2 "One move"). Drag a piece toward a neighbour — 18 px of movement picks the direction — or tap one piece
// and then its neighbour. Tapping a power-up sets it off. The touched piece lifts within one frame.
const PICK = 18;

export function attachInput(el, board, onMove) {
  let down = null, selected = -1;
  const neighbour = (a, b) => { const w = board.w; return (Math.abs(a - b) === w) || (Math.abs(a - b) === 1 && ((a / w) | 0) === ((b / w) | 0)); };
  const select = (i) => { if (selected >= 0) board.lift(selected, false); selected = i; if (i >= 0) board.lift(i, true); };

  el.addEventListener('pointerdown', (e) => {
    if (down || !e.isPrimary) return;
    const i = board.cellAt(e.clientX, e.clientY); if (i < 0) { select(-1); return; }
    try { el.setPointerCapture(e.pointerId); } catch { /* fine */ }
    down = { id: e.pointerId, x: e.clientX, y: e.clientY, i, sprite: board.lift(i, true), done: false };
  });
  el.addEventListener('pointermove', (e) => {
    if (!down || down.done || e.pointerId !== down.id) return;
    const dx = e.clientX - down.x, dy = e.clientY - down.y;
    if (Math.hypot(dx, dy) < PICK) return;
    down.done = true;
    const w = board.w, x = down.i % w, y = (down.i / w) | 0;
    let j = -1;
    if (Math.abs(dx) > Math.abs(dy)) { if (dx > 0 && x < w - 1) j = down.i + 1; else if (dx < 0 && x > 0) j = down.i - 1; }
    else if (dy > 0 && y < board.h - 1) j = down.i + w; else if (dy < 0 && y > 0) j = down.i - w;
    board.lift(down.sprite, false); select(-1);
    if (j >= 0 && board.g.open[j]) onMove({ a: down.i, b: j });
  });
  const up = (e) => {
    if (!down || e.pointerId !== down.id) return;
    const d = down; down = null;
    if (d.done) return;
    board.lift(d.sprite, false);
    if (e.type === 'pointercancel') return select(-1);
    const i = d.i, sp = board.spriteAt(i)?.sp;
    if (selected >= 0 && selected !== i && neighbour(selected, i)) { const a = selected; select(-1); return onMove({ a, b: i }); }
    if (selected === i) return select(-1);
    if (sp) { select(-1); return onMove({ tap: i }); }
    select(i);
  };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  return { clear: () => select(-1) };
}
