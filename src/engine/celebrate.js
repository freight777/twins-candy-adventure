// Celebrations worth cheering for (#44), made with three.quarks (MIT): a shower of tumbling paper confetti when a child gets a
// question right first try, and fireworks over the stadium for a Derby home run. Works in any scene: the effects are placed
// in front of the camera, and they run themselves (their own animation frame loop while particles are alive), so a game
// only has to call confetti(scene, camera) / fireworks(scene, camera). Loaded on demand (import()) so it costs nothing until the first cheer.
import * as THREE from 'three';
import {
  BatchedRenderer, ParticleSystem, RenderMode, ConstantValue, IntervalValue, ConeEmitter, SphereEmitter, ApplyForce, RotationOverLife,
  ColorOverLife, SizeOverLife, Gradient, ConstantColor, PiecewiseBezier, Bezier, Noise, Vector3 as QV3, Vector4 as QV4,
} from 'three.quarks';
import { canvasTex, keep, starTex } from '../util.js';

const COLORS = ['#ff5a8a', '#ffd84d', '#5be3a0', '#5bc0ff', '#b07cff', '#ff9f4d', '#ffffff', '#ff7ad9'];
let _sheet;
/** 4 x 2 little paper rectangles, one per colour: each particle picks a tile */
const sheet = () => _sheet || (keep.add(_sheet = canvasTex(256, 128, (g) => {
  COLORS.forEach((c, i) => { const x = (i % 4) * 64, y = Math.floor(i / 4) * 64; g.fillStyle = c; g.beginPath(); g.roundRect(x + 14, y + 6, 36, 52, 6); g.fill(); });
})), _sheet);

const fade = (hold = .75) => new ColorOverLife(new Gradient([[new QV3(1, 1, 1), 0], [new QV3(1, 1, 1), 1]], [[1, 0], [1, hold], [0, 1]]));
function confettiSystem() {
  const ps = new ParticleSystem({
    duration: 1, looping: false, worldSpace: true, autoDestroy: false,
    startLife: new IntervalValue(2.2, 3.2), startSpeed: new IntervalValue(5, 9), startSize: new IntervalValue(.32, .5),
    startRotation: new IntervalValue(0, Math.PI * 2), startColor: new ConstantColor(new QV4(1, 1, 1, 1)),
    emissionOverTime: new ConstantValue(0), emissionBursts: [{ time: 0, count: new ConstantValue(90), cycle: 1, interval: .01, probability: 1 }],
    shape: new ConeEmitter({ radius: .6, angle: Math.PI / 4 }),
    material: new THREE.MeshBasicMaterial({ map: sheet(), transparent: true, side: THREE.DoubleSide, depthWrite: false }),
    renderMode: RenderMode.BillBoard, uTileCount: 4, vTileCount: 2, startTileIndex: new IntervalValue(0, 8), renderOrder: 12,
  });
  ps.addBehavior(new ApplyForce(new QV3(0, -1, 0), new ConstantValue(7)));                   // falls...
  ps.addBehavior(new Noise(new ConstantValue(1.2), new ConstantValue(2.5), new ConstantValue(1), new ConstantValue(4)));   // ...fluttering like paper
  ps.addBehavior(new RotationOverLife(new IntervalValue(-7, 7)));
  ps.addBehavior(fade());
  return ps;
}
function fireworkSystem() {
  const ps = new ParticleSystem({
    duration: 1, looping: false, worldSpace: true, autoDestroy: false,
    startLife: new IntervalValue(1.3, 1.9), startSpeed: new IntervalValue(17, 22), startSize: new IntervalValue(1.5, 2.2),
    startColor: new ConstantColor(new QV4(1, 1, 1, 1)),
    emissionOverTime: new ConstantValue(0), emissionBursts: [{ time: 0, count: new ConstantValue(55), cycle: 1, interval: .01, probability: 1 }],
    shape: new SphereEmitter({ radius: .3 }),
    material: new THREE.MeshBasicMaterial({ map: starTex(), transparent: true, depthWrite: false, fog: false }),
    renderMode: RenderMode.BillBoard, renderOrder: 12,
  });
  ps.addBehavior(new ApplyForce(new QV3(0, -1, 0), new ConstantValue(4)));
  ps.addBehavior(new SizeOverLife(new PiecewiseBezier([[new Bezier(1, .9, .5, 0), 0]])));
  ps.addBehavior(fade(.5));
  return ps;
}

// one renderer per scene, a few of each effect in rotation so bursts can overlap
const perScene = new WeakMap();
function rig(scene) {
  let r = perScene.get(scene);
  if (!r) {
    const batch = new BatchedRenderer(); batch.renderOrder = 12; scene.add(batch);
    r = { batch, pools: { confetti: [], fireworks: [] }, next: { confetti: 0, fireworks: 0 }, until: 0, running: false };
    perScene.set(scene, r);
  }
  return r;
}
function take(r, scene, kind) {
  const pool = r.pools[kind];
  if (pool.length < 3) { const ps = kind === 'confetti' ? confettiSystem() : fireworkSystem(); r.batch.addSystem(ps); scene.add(ps.emitter); pool.push(ps); }
  const ps = pool[r.next[kind]++ % pool.length]; return ps;
}
function run(r, life) {
  r.until = Math.max(r.until, performance.now() + life * 1000);
  if (r.running) return; r.running = true;
  let last = performance.now();
  const step = (now) => { r.batch.update(Math.min(.05, (now - last) / 1000)); last = now; if (now < r.until) requestAnimationFrame(step); else r.running = false; };
  requestAnimationFrame(step);
}
const _f = new THREE.Vector3(), _u = new THREE.Vector3();
/** a point `dist` in front of the camera, `up` above its centre line */
function ahead(camera, dist, up, side = 0) {
  camera.getWorldDirection(_f); _u.set(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(_f, _u).normalize();
  return camera.getWorldPosition(new THREE.Vector3()).addScaledVector(_f, dist).addScaledVector(_u, up).addScaledVector(right, side);
}

/** paper confetti bursting up from just below the middle of the view and fluttering down */
export function confetti(scene, camera) {
  if (!scene || !camera || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const r = rig(scene), ps = take(r, scene, 'confetti');
  ps.emitter.position.copy(ahead(camera, 9, -2.5)); ps.emitter.rotation.set(0, 0, 0); ps.restart(); run(r, 3.6);
}
const SHELLS = [0xff5a8a, 0xffd84d, 0x5bc0ff, 0x5be3a0, 0xb07cff, 0xff9f4d]; let shell = 0;
/** three fireworks high in the sky ahead, one after another */
export function fireworks(scene, camera, n = 3) {
  if (!scene || !camera) return;
  const r = rig(scene);
  for (let i = 0; i < n; i++) setTimeout(() => {
    const ps = take(r, scene, 'fireworks'), c = new THREE.Color(SHELLS[(shell++) % SHELLS.length]);
    ps.startColor = new ConstantColor(new QV4(c.r, c.g, c.b, 1));
    ps.emitter.position.copy(ahead(camera, 55, 10 + Math.random() * 8, (Math.random() - .5) * 40)); ps.restart(); run(r, 2.2);
  }, i * 380);
}
