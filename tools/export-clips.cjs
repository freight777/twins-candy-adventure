// Exports compact 60 fps clips (swing.json, pitch.json) of the key joints, rotated into the game's world:
// the batter faces the plate (+X) with the pitcher toward -Z; the pitcher throws toward +Z. 1 BVH unit is scaled so hips are 2.75 high.
const fs = require('fs');
const { load, names } = require('./convert-bvh.cjs');
const r2 = (v) => Math.round(v * 100) / 100;

function clip(file, outFile, { centerFrame, before, after, aim, kind }) {
  const { P, dt } = load(file), step = Math.round((1 / 60) / dt);
  const start = centerFrame - before, end = centerFrame + after;
  const s0 = P[start], hx0 = s0.hips[0], hz0 = s0.hips[2], scale = 2.75 / s0.hips[1];
  // rotation about Y so that the BVH direction `aim` (unit x,z) becomes the game's direction (target x,z)
  const [ax, az] = aim.from, [tx, tz] = aim.to, ang = Math.atan2(tz, tx) - Math.atan2(az, ax), c = Math.cos(ang), s = Math.sin(ang);
  const tr = (p) => { const x = p[0] - hx0, z = p[2] - hz0; return [r2((x * c - z * s) * scale), r2(p[1] * scale), r2((x * s + z * c) * scale)]; };
  const frames = [];
  for (let f = start; f <= end; f += step) frames.push(names.flatMap((n) => tr(P[f][n])));
  const centerIdx = Math.round((centerFrame - start) / step);
  const out = { kind, fps: 60, names, scale, center: centerIdx, frames };
  fs.writeFileSync(outFile, JSON.stringify(out));
  console.log(outFile, 'frames', frames.length, 'center', centerIdx, 'bytes', JSON.stringify(out).length);
  return { P, dt };
}
// swing: pitcher direction in the BVH is +Z (the lead foot strides toward +Z); in the game the pitcher is toward -Z
clip('tools/mocap/124_07.bvh', 'public/assets/mocap/swing.json', { centerFrame: 341 + 4, before: 80, after: 130, aim: { from: [0, 1], to: [0, -1] }, kind: 'swing' });
// pitch: release direction from the throwing hand's velocity
const { P, dt } = load('tools/mocap/124_01.bvh'), rel = 445;
const v = [P[rel + 3].rwr[0] - P[rel - 3].rwr[0], P[rel + 3].rwr[2] - P[rel - 3].rwr[2]], vl = Math.hypot(...v);
console.log('pitch release dir', v.map((x) => +(x / vl).toFixed(2)));
clip('tools/mocap/124_01.bvh', 'public/assets/mocap/pitch.json', { centerFrame: rel, before: 250, after: 90, aim: { from: [v[0] / vl, v[1] / vl], to: [0, 1] }, kind: 'pitch' });
