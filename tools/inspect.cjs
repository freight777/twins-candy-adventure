const { load, sub, len, dot } = require('./convert-bvh.cjs');
const r1 = (v) => v.map((x) => +x.toFixed(1));
for (const [file, kind] of [['tools/mocap/124_07.bvh', 'swing'], ['tools/mocap/124_01.bvh', 'pitch']]) {
  const { P, dt } = load(file), n = P.length;
  const sp = (name) => P.map((_, f) => { let s = 0, c = 0; for (let k = -4; k <= 4; k++) { const g = f + k; if (g > 10 && g < n) { s += len(sub(P[g][name], P[g - 1][name])) / dt; c++; } } return c ? s / c : 0; });
  const sl = sp('lwr'), sr = sp('rwr');
  const peaks = (a) => { const out = []; for (let i = 12; i < n - 12; i++) { let ok = a[i] > 28; for (let k = -25; k <= 25 && ok; k++) if (a[i + k] > a[i]) ok = false; if (ok) out.push([i, +(i * dt).toFixed(2), Math.round(a[i])]); } return out; };
  console.log(kind, 'L peaks', JSON.stringify(peaks(sl)), 'R peaks', JSON.stringify(peaks(sr)));
  const pk = peaks(sl.map((v, i) => Math.max(v, sr[i])));
  console.log(kind, 'combined peaks', JSON.stringify(pk));
  for (const [f] of pk) {
    const a = P[Math.max(10, f - 90)], b = P[f];
    console.log(' peak', f, 'lead? Lankle move', JSON.stringify(r1(sub(b.lankle, a.lankle))), 'Rankle move', JSON.stringify(r1(sub(b.rankle, a.rankle))), 'hips', JSON.stringify(r1(b.hips)), 'lsh-rsh', JSON.stringify(r1(sub(b.lsh, b.rsh))), 'lwr', JSON.stringify(r1(b.lwr)), 'rwr', JSON.stringify(r1(b.rwr)));
  }
  console.log(kind, 'frame 30 pose', JSON.stringify({ hips: r1(P[30].hips), lsh: r1(P[30].lsh), rsh: r1(P[30].rsh), lank: r1(P[30].lankle), rank: r1(P[30].rankle) }));
}
