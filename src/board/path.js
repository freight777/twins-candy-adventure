// The board both board games are built on (Uni's forest, Esmae's sea): the six card colours, the winding 50-square path,
// the squares themselves, where the shortcuts go, and the small builders both worlds use for their scenery.
import * as THREE from 'three';
import { toon, clamp, rand, glowSprite } from '../util.js';

/** standard Candy Land colours, in the board's repeating order */
export const COLORS = [
  { name: 'red', hex: 0xff3b4e, css: '#ff3b4e' }, { name: 'purple', hex: 0xa64dff, css: '#a64dff' }, { name: 'yellow', hex: 0xffd83d, css: '#ffd83d' },
  { name: 'blue', hex: 0x3da5ff, css: '#3da5ff' }, { name: 'orange', hex: 0xff8a2a, css: '#ff8a2a' }, { name: 'green', hex: 0x3ddc6b, css: '#3ddc6b' },
];
export const N = 50;
const SC = 0.62;
const CP = [[-70, 40], [-50, 46], [-28, 40], [-8, 44], [14, 36], [34, 24], [44, 6], [34, -10], [14, -16], [-6, -12], [-26, -18], [-42, -32], [-38, -50], [-18, -60], [4, -54], [24, -60], [42, -74], [58, -90]];
/** the path's control points; each world gives its own heights (ys[i]), or none for a flat path it lifts itself */
export const controlPoints = (ys) => CP.map(([x, z], i) => new THREE.Vector3(x * SC, ys ? ys[i] : 0, z * SC));

export function roundedGeo(w, depth, rad, bevel = .1) {
  const h = w / 2 - bevel, sh = new THREE.Shape();
  sh.moveTo(-h + rad, -h); sh.lineTo(h - rad, -h); sh.quadraticCurveTo(h, -h, h, -h + rad); sh.lineTo(h, h - rad); sh.quadraticCurveTo(h, h, h - rad, h);
  sh.lineTo(-h + rad, h); sh.quadraticCurveTo(-h, h, -h, h - rad); sh.lineTo(-h, -h + rad); sh.quadraticCurveTo(-h, -h, -h + rad, -h);
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 10 });
  g.rotateX(-Math.PI / 2); return g;
}
export function starGeo(R = 1, r = .48, depth = .35) {
  const sh = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 + Math.PI / 2, rad = i % 2 ? r : R; sh[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rad, Math.sin(a) * rad); }
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: .1, bevelSize: .1, bevelSegments: 3 });
  g.translate(0, 0, -depth / 2); return g;
}

/** The squares: a white START, the six colours in order, a gold FINISH; each a glossy rounded tile on a white base.
 *  opts: base (base colour), lift (raise the squares above the path line), glow ([size, opacity] of the soft halo). */
export function buildTiles(scene, curve, { base = 0xfff6fb, lift = 0, glow = [5.5, .13] } = {}) {
  const tileGeo = roundedGeo(3.7, .34, .8), innerGeo = roundedGeo(2.5, .12, .55, .06), baseGeo = roundedGeo(4.15, .28, .9, .08), baseMat = toon(base);
  const white = new THREE.Color(0xffffff), tiles = [];
  for (let i = 0; i < N; i++) {
    const u = i / (N - 1), p = curve.getPointAt(u), tan = curve.getTangentAt(u);
    const colr = i === 0 ? { hex: 0xffffff } : i === N - 1 ? { hex: 0xffd84d } : COLORS[(i - 1) % 6], g = new THREE.Group();
    g.position.copy(p); g.position.y += lift;
    g.rotation.order = 'YXZ'; g.rotation.y = Math.atan2(tan.x, tan.z); g.rotation.x = -Math.asin(clamp(tan.y, -.6, .6));
    const b = new THREE.Mesh(baseGeo, baseMat); b.position.y = -.1; g.add(b);
    const tile = new THREE.Mesh(tileGeo, toon(colr.hex, { clearcoat: 1, clearcoatRoughness: .08 })); tile.position.y = .1; tile.receiveShadow = b.receiveShadow = true; g.add(tile);
    const shine = new THREE.Mesh(innerGeo, toon(new THREE.Color(colr.hex).lerp(white, .45), { clearcoat: 1 })); shine.position.y = .5; g.add(shine);
    const gl = glowSprite(colr.hex, glow[0], glow[1]); gl.position.y = .5; g.add(gl);
    scene.add(g);
    tiles.push({ i, pos: p.clone().add(new THREE.Vector3(0, .5, 0)), tan, u, color: i === 0 || i === N - 1 ? null : colr, group: g, y0: g.position.y, bob: rand(0, 6) });
  }
  return tiles;
}

/** Up to two shortcuts where the path bends back on itself (a short hop in space that skips 8-15 squares), never starting or
 *  ending on a reserved square. Returns [{ from, to }]; each world draws its own arc (rainbow slide, dolphin ride). */
export function findShortcuts(tiles, reserved) {
  const used = new Set([0, N - 1, ...reserved]), out = [];
  for (let k = 0; k < 2; k++) {
    let best = null;
    for (let a = 4; a < N - 14; a++) {
      if (used.has(a) || out.some((s) => Math.abs(s.from - a) < 12)) continue;
      for (let b = a + 8; b <= Math.min(N - 3, a + 15); b++) {
        if (used.has(b)) continue;
        const d = tiles[a].pos.distanceTo(tiles[b].pos), score = d / (b - a);
        if (d < 40 && (!best || score < best.score)) best = { from: a, to: b, score };
      }
    }
    if (best) { out.push(best); used.add(best.from); used.add(best.to); }
  }
  return out;
}
/** the squares that carry a collectable: every third one, skipping special squares and the ends of shortcuts */
export function pickupTiles(reserved, shortcuts) {
  const out = [];
  for (let i = 3; i < N - 2; i += 3) if (!reserved.includes(i) && !shortcuts.some((s) => s.from === i || s.to === i)) out.push(i);
  return out;
}

/** Distance to the nearest point of the path (and the path's height there), precomputed on a grid. The worlds ask this ~100k
 *  times while they are built (terrain, scenery spots); scanning 700 path points each time made the boot slow on an iPad.
 *  F.dist(x, z) returns the distance (capped at `reach`) and leaves the path height in F.y. */
export function pathField(curve, { half = 200, cells = 200, reach = 32, samples = 700 } = {}) {
  const n = cells + 1, step = (2 * half) / cells, r = Math.ceil(reach / step);
  const D = new Float32Array(n * n).fill(reach * reach), Y = new Float32Array(n * n);
  for (const p of curve.getSpacedPoints(samples)) {
    const ci = Math.round((p.x + half) / step), cj = Math.round((p.z + half) / step);
    for (let j = Math.max(0, cj - r); j <= Math.min(cells, cj + r); j++) {
      const dz = j * step - half - p.z;
      for (let i = Math.max(0, ci - r); i <= Math.min(cells, ci + r); i++) {
        const dx = i * step - half - p.x, d = dx * dx + dz * dz, k = j * n + i;
        if (d < D[k]) { D[k] = d; Y[k] = p.y; }
      }
    }
  }
  for (let k = 0; k < D.length; k++) D[k] = Math.sqrt(D[k]);
  const F = { y: 0 };
  F.dist = (x, z) => {
    const fx = clamp((x + half) / step, 0, cells - 1e-4), fz = clamp((z + half) / step, 0, cells - 1e-4), i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, k = j * n + i;
    F.y = (Y[k] * (1 - u) + Y[k + 1] * u) * (1 - v) + (Y[k + n] * (1 - u) + Y[k + n + 1] * u) * v;
    return (D[k] * (1 - u) + D[k + 1] * u) * (1 - v) + (D[k + n] * (1 - u) + D[k + n + 1] * u) * v;
  };
  return F;
}

/** inst(geo, mat, n, fn(i, object3d, color), shadow): one InstancedMesh of n copies placed by fn, added to the scene */
export const instancer = (scene) => (geo, mat, n, fn, shadow = true) => {
  const m = new THREE.InstancedMesh(geo, mat, n), o = new THREE.Object3D(), c = new THREE.Color();
  for (let i = 0; i < n; i++) { o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1); c.set(0xffffff); fn(i, o, c); o.updateMatrix(); m.setMatrixAt(i, o.matrix); m.setColorAt(i, c); }
  m.castShadow = shadow; m.receiveShadow = true; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; scene.add(m); return m;
};
/** spots(n, minPath, area): n random [x, z] places inside area = [x0, x1, z0, z1] that pass clear(x, z, minPath) */
export const spotFinder = (clear) => (n, minPath, area = [-110, 80, -125, 80]) => {
  const out = []; let tries = 0;
  while (out.length < n && tries++ < n * 60) { const x = rand(area[0], area[1]), z = rand(area[2], area[3]); if (clear(x, z, minPath)) out.push([x, z]); }
  return out;
};
