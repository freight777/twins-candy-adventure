// Where the page art goes (§2 layout rule, §1A.10 keep-out strip). The Home and book buttons sit top-left, never move; the art
// takes the larger of two boxes: below the buttons, or beside them, always 12 px clear of them.
export const BTN = 64, GAP = 12, EDGE = 12;

let probe = null;
/** the safe-area insets in CSS px (notch, home bar) */
export function safe() {
  if (!probe) { probe = document.createElement('div'); probe.style.cssText = 'position:fixed;inset:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)'; document.body.appendChild(probe); }
  const s = getComputedStyle(probe);
  return { t: parseFloat(s.paddingTop) || 0, r: parseFloat(s.paddingRight) || 0, b: parseFloat(s.paddingBottom) || 0, l: parseFloat(s.paddingLeft) || 0 };
}

/** the biggest box of the given aspect (w / h) that fits, clear of the buttons; { x, y, w, h } in CSS px */
export function artBox(aspect, buttons = 2) {
  const vw = innerWidth, vh = innerHeight, s = safe();
  const L = s.l + EDGE, T = s.t + EDGE, R = vw - s.r - EDGE, B = vh - s.b - EDGE;
  const btnR = s.l + EDGE + buttons * BTN + (buttons - 1) * GAP + GAP, btnB = s.t + EDGE + BTN + GAP;
  const fit = (x0, y0, x1, y1) => { const W = Math.max(0, x1 - x0), H = Math.max(0, y1 - y0), w = Math.min(W, H * aspect), h = w / aspect; return { x: x0 + (W - w) / 2, y: y0 + (H - h) / 2, w, h }; };
  const below = fit(L, btnB, R, B), beside = fit(btnR, T, R, B);
  return below.w >= beside.w ? below : beside;
}
