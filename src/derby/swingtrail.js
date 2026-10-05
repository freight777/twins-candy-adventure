import * as THREE from 'three';

/** A soft arc of light that follows the bat through the swing (a cheap stand-in for motion blur). Sampled in game time, so slow motion stretches it correctly. */
export function createSwingTrail(scene, { n = 22, color = 0xdbeaff, opacity = .85, step = 1 / 110 } = {}) {
  const pos = new Float32Array(n * 2 * 3), col = new Float32Array(n * 2 * 4), idx = [];
  for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 4)); g.setIndex(idx);
  const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false, blending: THREE.AdditiveBlending }));
  mesh.frustumCulled = false; mesh.visible = false; mesh.renderOrder = 4; scene.add(mesh);
  const hist = [], c = new THREE.Color(color); let acc = 0, last = null;
  return {
    mesh,
    clear() { hist.length = 0; mesh.visible = false; last = null; acc = 0; },
    /** the bat's two points (world space) this frame, or null to let the trail fade; dt is game time */
    update(a, b, dt) {
      acc += dt;
      if (a && b) {
        if (!last) last = [a.clone(), b.clone()];
        const subs = Math.min(8, Math.floor(acc / step));
        for (let j = 1; j <= subs; j++) { const k = j / subs; hist.unshift([last[0].clone().lerp(a, k), last[1].clone().lerp(b, k)]); if (hist.length > n) hist.pop(); }
        if (subs) { acc -= subs * step; last = [a.clone(), b.clone()]; }
      } else { last = null; const subs = Math.floor(acc / step); for (let j = 0; j < subs && hist.length; j++) hist.pop(); acc = acc % step; }
      const k = hist.length; if (k < 2) { mesh.visible = false; return; } mesh.visible = true;
      for (let i = 0; i < n; i++) {
        const h = hist[Math.min(i, k - 1)], t = i / (n - 1), al = i < k ? opacity * Math.pow(1 - t, 1.4) : 0;
        pos.set([h[0].x, h[0].y, h[0].z, h[1].x, h[1].y, h[1].z], i * 6);
        for (let s = 0; s < 2; s++) { const o = (i * 2 + s) * 4, f = s ? 1 : .3; col[o] = c.r * al * f; col[o + 1] = c.g * al * f; col[o + 2] = c.b * al * f; col[o + 3] = al * f; }
      }
      g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true;
    },
  };
}
