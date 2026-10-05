// Turns the CMU baseball BVH recordings into small JSON clips of key joint positions (swing.json, pitch.json).
// Data: CMU Graphics Lab Motion Capture Database (free for any use), BVH conversion by Bruce Hahne, per-file copies from una-dinosauria/cmu-mocap.
// Usage: node tools/convert-bvh.cjs
const fs = require('fs');

function parseBVH(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean), joints = []; let i = 0, stack = [];
  while (i < lines.length && lines[i] !== 'MOTION') {
    const l = lines[i].split(/\s+/);
    if (l[0] === 'ROOT' || l[0] === 'JOINT') { const j = { name: l[1], parent: stack.length ? stack[stack.length - 1] : -1, offset: [0, 0, 0], channels: [] }; joints.push(j); stack.push(joints.length - 1); }
    else if (l[0] === 'End') { stack.push(-2); }
    else if (l[0] === 'OFFSET' && stack[stack.length - 1] >= 0) joints[stack[stack.length - 1]].offset = l.slice(1).map(Number);
    else if (l[0] === 'CHANNELS') joints[stack[stack.length - 1]].channels = l.slice(2);
    else if (l[0] === '}') stack.pop();
    i++;
  }
  const nF = parseInt(lines[i + 1].split(/\s+/)[1], 10), dt = parseFloat(lines[i + 2].split(/\s+/)[2]), frames = [];
  for (let f = 0; f < nF; f++) frames.push(lines[i + 3 + f].split(/\s+/).map(Number));
  return { joints, frames, dt };
}
const mul = (a, b) => { const r = new Array(9); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j]; return r; };
const rx = (a) => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; };
const ry = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
const rz = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
function fk(bvh, frame) {
  const pos = [], rot = [], d = Math.PI / 180; let k = 0;
  bvh.joints.forEach((j, idx) => {
    let R = [1, 0, 0, 0, 1, 0, 0, 0, 1], T = j.offset.slice();
    j.channels.forEach((ch) => { const v = frame[k++]; if (ch === 'Xposition') T[0] += v; else if (ch === 'Yposition') T[1] += v; else if (ch === 'Zposition') T[2] += v; else if (ch === 'Xrotation') R = mul(R, rx(v * d)); else if (ch === 'Yrotation') R = mul(R, ry(v * d)); else if (ch === 'Zrotation') R = mul(R, rz(v * d)); });
    if (j.parent < 0) { pos[idx] = T; rot[idx] = R; }
    else { const P = rot[j.parent], pp = pos[j.parent]; pos[idx] = [pp[0] + P[0] * T[0] + P[1] * T[1] + P[2] * T[2], pp[1] + P[3] * T[0] + P[4] * T[1] + P[5] * T[2], pp[2] + P[6] * T[0] + P[7] * T[1] + P[8] * T[2]]; rot[idx] = mul(P, R); }
  });
  return pos;
}
const KEEP = { hips: 'Hips', lhip: 'LeftUpLeg', lknee: 'LeftLeg', lankle: 'LeftFoot', ltoe: 'LeftToeBase', rhip: 'RightUpLeg', rknee: 'RightLeg', rankle: 'RightFoot', rtoe: 'RightToeBase',
  chest: 'Spine1', neck: 'Neck', head: 'Head', lsh: 'LeftArm', lel: 'LeftForeArm', lwr: 'LeftHand', lfin: 'LeftFingerBase', rsh: 'RightArm', rel: 'RightForeArm', rwr: 'RightHand', rfin: 'RightFingerBase' };
const names = Object.keys(KEEP);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], len = (a) => Math.hypot(a[0], a[1], a[2]), dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function load(file) {
  const bvh = parseBVH(fs.readFileSync(file, 'utf8')), idx = {}; bvh.joints.forEach((j, i) => (idx[j.name] = i));
  const P = bvh.frames.map((f) => { const p = fk(bvh, f); const o = {}; names.forEach((n) => (o[n] = p[idx[KEEP[n]]])); return o; });
  return { P, dt: bvh.dt };
}
const speed = (P, dt, name, f) => (f > 0 ? len(sub(P[f][name], P[f - 1][name])) / dt : 0);

function analyze(file, kind) {
  const { P, dt } = load(file), n = P.length;
  // which hand is fastest (and when)? smooth over 5 frames
  const sp = (name) => P.map((_, f) => { let s = 0, c = 0; for (let k = -2; k <= 2; k++) { if (f + k > 0 && f + k < n) { s += speed(P, dt, name, f + k); c++; } } return s / c; });
  const sl = sp('lwr'), sr = sp('rwr'), peak = (a) => a.reduce((m, v, i) => (v > a[m] ? i : m), 0);
  const pl = peak(sl), pr = peak(sr);
  console.log(kind, 'frames', n, 'dt', dt, 'peak L', pl, sl[pl].toFixed(0), 'peak R', pr, sr[pr].toFixed(0));
  return { P, dt, n, sl, sr, pl, pr };
}
module.exports = { load, names, analyze, sub, len, dot };

if (require.main === module) {
  const sw = analyze('public/assets/mocap/124_07.bvh', 'swing'), pi = analyze('public/assets/mocap/124_01.bvh', 'pitch');
  // diagnostics for the swing: where do the feet / shoulders go?
  const P = sw.P; const f0 = 0, fc = sw.pr;
  const show = (f) => ({ hips: P[f].hips.map((v) => +v.toFixed(1)), lsh: P[f].lsh.map((v) => +v.toFixed(1)), rsh: P[f].rsh.map((v) => +v.toFixed(1)), lank: P[f].lankle.map((v) => +v.toFixed(1)), rank: P[f].rankle.map((v) => +v.toFixed(1)), lwr: P[f].lwr.map((v) => +v.toFixed(1)), rwr: P[f].rwr.map((v) => +v.toFixed(1)) });
  console.log('swing f0', JSON.stringify(show(0)));
  console.log('swing peak', fc, JSON.stringify(show(fc)));
  const spL = sw.sl.map((v, i) => [i, Math.round(v)]).filter((x, i) => i % 40 === 0); console.log('swing speed L every 40f', JSON.stringify(spL));
  const spR = sw.sr.map((v, i) => [i, Math.round(v)]).filter((x, i) => i % 40 === 0); console.log('swing speed R every 40f', JSON.stringify(spR));
}
