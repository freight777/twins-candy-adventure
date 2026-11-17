// Where the page art goes (§2 layout rule, §1A.10 keep-out strip). The Home and book buttons sit top-left and never move; on a maze
// page the "?" sits top-right. The art takes the larger of two boxes — below the buttons, or between them — always 12 px clear.
export const BTN = 64, GAP = 12, EDGE = 12;

let probe = null;
/** the safe-area insets in CSS px (notch, home bar) */
export function safe() {
  if (!probe) { probe = document.createElement('div'); probe.style.cssText = 'position:fixed;inset:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)'; document.body.appendChild(probe); }
  const s = getComputedStyle(probe);
  return { t: parseFloat(s.paddingTop) || 0, r: parseFloat(s.paddingRight) || 0, b: parseFloat(s.paddingBottom) || 0, l: parseFloat(s.paddingLeft) || 0 };
}

/** the two places the art may go, as rectangles in CSS px */
export function regions(buttons = 2, right = 1) {
  const vw = innerWidth, vh = innerHeight, s = safe();
  const L = s.l + EDGE, T = s.t + EDGE, R = vw - s.r - EDGE, B = vh - s.b - EDGE;
  const btnR = s.l + EDGE + buttons * BTN + (buttons - 1) * GAP + GAP, btnB = s.t + EDGE + BTN + GAP, rightL = R - right * (BTN + GAP);
  return [{ x: L, y: btnB, w: R - L, h: B - btnB }, { x: btnR, y: T, w: rightL - btnR, h: B - T }].map((r) => ({ ...r, w: Math.max(0, r.w), h: Math.max(0, r.h) }));
}

/** the biggest box of the given aspect (w / h) that fits, clear of the buttons; { x, y, w, h } in CSS px */
export function artBox(aspect, buttons = 2, right = 1) {
  const fit = (r) => { const w = Math.min(r.w, r.h * aspect), h = w / aspect; return { x: r.x + (r.w - w) / 2, y: r.y + (r.h - h) / 2, w, h }; };
  const [below, beside] = regions(buttons, right).map(fit);
  return below.w >= beside.w ? below : beside;
}
