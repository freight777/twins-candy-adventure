import * as THREE from 'three';
import { getHDREnv } from './assets.js';

/**
 * Lighting "environment" for shiny materials to reflect: a soft sky with a bright sun.
 * Built from code for now. When we add a real sky photo (an HDRI from Poly Haven) it plugs in here instead.
 */
const cache = {};
export function skyEnv(renderer, key = 'day', { top = 0x6fb4ff, mid = 0xfff4e6, bottom = 0xffc8de, sun = [25, 30, 15], sunColor = 0xfff0cc, sunPower = 7 } = {}) {
  const photo = getHDREnv(key);          // a real sky photo, if one was loaded for this scene
  if (photo) return photo;
  if (cache[key]) return cache[key];
  const s = new THREE.Scene();
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { top: { value: new THREE.Color(top) }, mid: { value: new THREE.Color(mid) }, bottom: { value: new THREE.Color(bottom) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `uniform vec3 top, mid, bottom; varying vec3 vP;
      void main(){ float h = vP.y; vec3 c = h > 0. ? mix(mid, top, pow(h, .6)) : mix(mid, bottom, pow(-h, .6)); gl_FragColor = vec4(c, 1.); }`,
  });
  s.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), mat));
  const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(5, 16, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(sunColor).multiplyScalar(sunPower) }));
  sunMesh.position.set(...sun); s.add(sunMesh);
  // a few soft bright panels so glossy candy picks up pretty highlights
  for (const [x, y, z, c] of [[-30, 15, 20, 0xffd9ec], [10, 8, -35, 0xd9f0ff]]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(26, 14), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(2.5), side: THREE.DoubleSide }));
    p.position.set(x, y, z); p.lookAt(0, 0, 0); s.add(p);
  }
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(s, 0.02).texture;
  pm.dispose();
  return (cache[key] = tex);
}
