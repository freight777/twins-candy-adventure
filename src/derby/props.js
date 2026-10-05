import * as THREE from 'three';
import { canvasTex } from '../util.js';

// Hand-held props: the baseball, the bat and the pitcher's glove. All are built in code.

let _ballTex = null;
/** white leather with two curved rows of red stitches */
export function ballTexture() {
  if (_ballTex) return _ballTex;
  return (_ballTex = canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#f4f1ea'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1800; i++) { g.fillStyle = `rgba(120,100,80,${Math.random() * .06})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    [0, 1].forEach((side) => {
      for (let x = 0; x <= w; x += 2) {
        const ph = (x / w) * Math.PI * 2 * 2, y = h / 2 + (side ? -1 : 1) * h * .23 * Math.sin(ph), dy = (side ? -1 : 1) * h * .23 * Math.cos(ph) * (Math.PI * 4 / w);
        g.fillStyle = '#c0282d'; g.beginPath(); g.arc(x, y, 3.2, 0, 7); g.fill();
        if (x % 12 === 0) { const nx = -dy, ny = 1, nl = Math.hypot(nx, ny); g.strokeStyle = '#c0282d'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(x - nx / nl * 10, y - ny / nl * 10); g.lineTo(x + nx / nl * 10, y + ny / nl * 10); g.stroke(); }
      }
    });
  }));
}
export const makeBallMesh = (radius) => new THREE.Mesh(new THREE.SphereGeometry(radius, 28, 20), new THREE.MeshStandardMaterial({ map: ballTexture(), roughness: .55 }));

/** a wooden bat lying along +X: knob at x = -0.2, barrel end at x = 2.57 (about 35 inches in the game's units) */
export function makeBat() {
  const ctl = [[-.2, 0], [-.19, .055], [-.15, .075], [-.1, .07], [-.05, .048], [.04, .038], [.9, .038], [1.2, .058], [1.6, .085], [2.0, .099], [2.35, .1], [2.47, .092], [2.54, .06], [2.57, 0]];
  const rAt = (h) => { for (let i = 0; i < ctl.length - 1; i++) { const [h0, r0] = ctl[i], [h1, r1] = ctl[i + 1]; if (h >= h0 && h <= h1) { const t = (h - h0) / (h1 - h0), k = t * t * (3 - 2 * t); return r0 + (r1 - r0) * (t * .6 + k * .4); } } return 0; };
  const pts = [], N = 70; for (let i = 0; i <= N; i++) { const h = -.2 + (2.77 * i) / N; pts.push(new THREE.Vector2(Math.max(rAt(h), .0005), h)); }
  const geo = new THREE.LatheGeometry(pts, 32); geo.rotateZ(-Math.PI / 2);
  const col = new Float32Array(geo.attributes.position.count * 3), wood = new THREE.Color(0xd9b886), tar = new THREE.Color(0x2c1c11), tape = new THREE.Color(0x15110f), c = new THREE.Color(), pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const h = pos.getX(i), grain = (Math.sin(pos.getY(i) * 90 + pos.getZ(i) * 40) * .5 + .5) * .06;
    c.copy(wood).multiplyScalar(1 - grain);
    const tarK = Math.min(1, Math.max(0, (h - .05) / .15)) * Math.min(1, Math.max(0, (.95 - h) / .25)); c.lerp(tar, tarK * .9);
    if (h < -.02) c.lerp(tape, Math.min(1, (-.02 - h) / .05));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals();
  const bat = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: .38, clearcoat: .7, clearcoatRoughness: .25 }));
  bat.castShadow = true; return bat;
}

/** a fielder's glove in the left hand's rest frame: fingers toward +X, palm facing -Y, thumb toward +Z (1 unit is about a third of a metre) */
export function makeGlove() {
  const g = new THREE.Group(), leather = new THREE.MeshPhysicalMaterial({ color: 0x7a4422, roughness: .62, clearcoat: .15 }), dark = new THREE.MeshStandardMaterial({ color: 0x4a2814, roughness: .7 }), lace = new THREE.MeshStandardMaterial({ color: 0x1c110a, roughness: .8 });
  const S = new THREE.SphereGeometry(1, 20, 14), C = new THREE.CapsuleGeometry(1, 1, 6, 12), Y = new THREE.CylinderGeometry(1, 1, 1, 18);
  const add = (geo, mat, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz); m.castShadow = true; g.add(m); return m; };
  add(S, leather, .32, 0, 0, .42, .13, .3);                                                    // padded palm / back of the glove
  add(S, dark, .36, -.085, 0, .3, .06, .22);                                                  // the pocket, a darker leather on the palm side
  [[-.2, .38], [-.07, .43], [.06, .4], [.19, .34]].forEach(([z, len]) => add(C, leather, .55 + len / 2, 0, z, .066, len / 3, .066, 0, 0, Math.PI / 2));   // four finger stalls, each a capsule along X
  add(C, leather, .52, .01, .3, .07, .34 / 3, .07, 0, -.5, Math.PI / 2);                    // thumb
  add(S, leather, .72, -.02, .22, .2, .05, .16);                                              // web between the thumb and first finger
  add(Y, dark, .0, 0, 0, .105, .18, .105, 0, 0, Math.PI / 2);                                // wrist strap
  for (let i = 0; i < 5; i++) add(new THREE.CylinderGeometry(.01, .01, .09, 6), lace, .66 + i * .045, -.1, .22 - i * .015, 1, 1, 1, Math.PI / 2, 0, .4);   // laces
  return g;
}
