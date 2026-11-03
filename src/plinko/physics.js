// Sparkle Plinko's little physics world: balls (circles) bouncing off pegs and bumpers (circles), walls (thick line segments)
// and swimming/fluttering movers, with pass-through sensors for the pickups. Sub-stepped so a fast ball never tunnels through
// a thin peg. Pure maths, no drawing: the game listens through onHit / onSensor.
export function createWorld({ gravity = 1400 } = {}) {
  const W = {
    gravity, balls: [], circles: [], segments: [], sensors: [],
    onHit: null,           // (ball, shape, speed) after a bounce
    onSensor: null,        // (ball, sensor) the first moment a ball overlaps a sensor
  };
  let nextId = 1;

  W.addBall = (x, y, r, extra = {}) => { const b = { id: nextId++, x, y, vx: 0, vy: 0, r, still: 0, ...extra }; W.balls.push(b); return b; };
  W.removeBall = (b) => { const i = W.balls.indexOf(b); if (i >= 0) W.balls.splice(i, 1); };
  /** e: bounciness; kick: a bumper's minimum push-off speed; vx/vy on a moving circle make it bat the ball along */
  W.addCircle = (x, y, r, opts = {}) => { const c = { x, y, r, e: .5, kick: 0, vx: 0, vy: 0, kind: 'peg', ...opts }; W.circles.push(c); return c; };
  /** a wall from a to b, r thick; oneWay [nx, ny]: only solid for a ball on that side (the launch lane's gate) */
  W.addSegment = (ax, ay, bx, by, opts = {}) => { const s = { ax, ay, bx, by, r: 3, e: .45, kind: 'wall', ...opts }; W.segments.push(s); return s; };
  W.addSensor = (x, y, r, opts = {}) => { const s = { x, y, r, on: true, kind: 'gem', ...opts }; W.sensors.push(s); return s; };
  W.removeSensor = (s) => { const i = W.sensors.indexOf(s); if (i >= 0) W.sensors.splice(i, 1); };

  function bounce(b, nx, ny, pen, e, kick, svx, svy, shape) {
    b.x += nx * pen; b.y += ny * pen;
    const rvx = b.vx - svx, rvy = b.vy - svy, vn = rvx * nx + rvy * ny;
    if (vn >= 0) return;
    const speed = -vn;
    // reflect the normal part, keep most of the sliding part (a touch of friction so balls don't skate forever)
    let tx = rvx - vn * nx, ty = rvy - vn * ny; tx *= .985; ty *= .985;
    let out = speed * e;
    if (kick) out = Math.max(out, kick);
    b.vx = tx + nx * out + svx; b.vy = ty + ny * out + svy;
    if (W.onHit) W.onHit(b, shape, speed);
  }

  function collide(b) {
    for (const c of W.circles) {
      const dx = b.x - c.x, dy = b.y - c.y, rr = b.r + c.r, d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr) continue;
      const d = Math.sqrt(d2) || 1e-4;
      bounce(b, dx / d, dy / d, rr - d, c.e, c.kick, c.vx, c.vy, c);
    }
    for (const s of W.segments) {
      const ex = s.bx - s.ax, ey = s.by - s.ay, len2 = ex * ex + ey * ey;
      let t = ((b.x - s.ax) * ex + (b.y - s.ay) * ey) / len2; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const px = s.ax + ex * t, py = s.ay + ey * t, dx = b.x - px, dy = b.y - py, rr = b.r + s.r, d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr) continue;
      if (s.oneWay && (b.x - s.ax) * s.oneWay[0] + (b.y - s.ay) * s.oneWay[1] < b.r * .3) continue;
      const d = Math.sqrt(d2) || 1e-4;
      bounce(b, dx / d, dy / d, rr - d, s.e, s.kick || 0, 0, 0, s);
    }
  }
  /** two balls bump like marbles (multiball) */
  function ballPairs() {
    const B = W.balls;
    for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) {
      const a = B[i], b = B[j]; if (a.pinned || b.pinned || a.lift || b.lift) continue;
      const dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r, d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr || d2 === 0) continue;
      const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, pen = (rr - d) / 2;
      a.x -= nx * pen; a.y -= ny * pen; b.x += nx * pen; b.y += ny * pen;
      const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (vn < 0) { const j2 = -vn * .9; a.vx -= nx * j2; a.vy -= ny * j2; b.vx += nx * j2; b.vy += ny * j2; }
    }
  }
  function sense(b) {
    for (const s of W.sensors) {
      if (!s.on) continue;
      const dx = b.x - s.x, dy = b.y - s.y, rr = b.r + s.r;
      if (dx * dx + dy * dy < rr * rr && W.onSensor) W.onSensor(b, s);
    }
  }

  W.step = (dt) => {
    let vmax = 0;
    for (const b of W.balls) vmax = Math.max(vmax, Math.hypot(b.vx, b.vy));
    const n = Math.min(24, Math.max(4, Math.ceil((vmax * dt) / 4))), h = dt / n;
    for (let k = 0; k < n; k++) {
      for (const b of W.balls) {
        if (b.pinned || b.lift) continue;
        b.vy += W.gravity * h;
        const sp = Math.hypot(b.vx, b.vy); if (sp > 2400) { b.vx *= 2400 / sp; b.vy *= 2400 / sp; }
        b.x += b.vx * h; b.y += b.vy * h;
        collide(b);
      }
      ballPairs();
    }
    for (const b of W.balls) if (!b.pinned && !b.lift) { sense(b); b.still = Math.hypot(b.vx, b.vy) < 25 ? b.still + dt : 0; }
  };
  return W;
}
