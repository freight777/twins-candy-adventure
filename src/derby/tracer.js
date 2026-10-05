import * as THREE from 'three';

/** A broadcast-style "tracer": a soft comet tail that follows the ball. Its width is measured in screen pixels, so it stays readable at any distance. */
export function createTracer(scene, { n = 40, px = 7, color = 0xffffff, opacity = .85, additive = true } = {}) {
  const pos = new Float32Array(n * 2 * 3), col = new Float32Array(n * 2 * 4), idx = [];
  for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 4)); g.setIndex(idx);
  const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }));
  mesh.frustumCulled = false; mesh.visible = false; mesh.renderOrder = 5; scene.add(mesh);
  const pts = [], c = new THREE.Color(color), tan = new THREE.Vector3(), view = new THREE.Vector3(), side = new THREE.Vector3();
  return {
    mesh,
    clear() { pts.length = 0; mesh.visible = false; },
    /** add the ball's newest position (newest first) */
    push(p) { pts.unshift(p.clone()); if (pts.length > n) pts.pop(); },
    /** rebuild the ribbon facing the camera; `fade` 0..1 fades the whole thing */
    update(camera, viewH, fade = 1) {
      const k = pts.length; if (k < 3 || fade <= 0) { mesh.visible = false; return; } mesh.visible = true;
      const wpp = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) / viewH;     // world units per pixel at distance 1
      for (let i = 0; i < n; i++) {
        const j = Math.min(i, k - 1), p = pts[j];
        tan.copy(pts[Math.max(j - 1, 0)]).sub(pts[Math.min(j + 1, k - 1)]); if (tan.lengthSq() < 1e-10) tan.set(0, 0, 1);
        view.copy(camera.position).sub(p); const d = view.length(); side.crossVectors(tan, view).normalize();
        const t = i / (n - 1), alive = i < k ? 1 : 0, w = px * wpp * d * (1 - t * .85) * .5, a = opacity * (1 - t) * (1 - t) * alive * fade;
        pos[i * 6] = p.x + side.x * w; pos[i * 6 + 1] = p.y + side.y * w; pos[i * 6 + 2] = p.z + side.z * w;
        pos[i * 6 + 3] = p.x - side.x * w; pos[i * 6 + 4] = p.y - side.y * w; pos[i * 6 + 5] = p.z - side.z * w;
        for (let s = 0; s < 2; s++) { const o = (i * 2 + s) * 4; col[o] = c.r * a; col[o + 1] = c.g * a; col[o + 2] = c.b * a; col[o + 3] = a; }
      }
      g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true;
    },
  };
}
