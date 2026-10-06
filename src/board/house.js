// A friend's little house, for both board games: its own small 3D room (round walls, a domed ceiling, two round windows, a
// rug) with the visitor and the host in it, and a quick mini-game that each game adds on top (src/uni/houses.js,
// src/mermaid/houses.js). The room counts along on the house panel's ten-frame and cheers when the goal is reached.
// Underwater rooms (water: true) have bubbles drifting up and caustic light on everything.
import * as THREE from 'three';
import { toon, mk, canvasTex, disposeObject, keep, setStyle, setCaustic, Timers, Fx, ease, rand, RAINBOW } from '../util.js';
import { fovFor } from './deck.js';

/** made once, kept for every visit (a house's own geometry/materials are freed when you leave) */
let _wall, _bubble;
const wallTex = () => _wall || (_wall = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,255,255,.55)'; for (let i = 0; i < 24; i++) { g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 3 + Math.random() * 6, 0, 7); g.fill(); }
  g.strokeStyle = 'rgba(0,0,0,.05)'; g.lineWidth = 3; for (let x = 0; x < w; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
}, [6, 1]), keep.add(_wall), _wall);
export const bubbleTex = () => _bubble || (_bubble = canvasTex(64, 64, (g) => {
  g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = 4; g.beginPath(); g.arc(32, 32, 26, 0, 7); g.stroke();
  g.fillStyle = 'rgba(200,240,255,.18)'; g.fill(); g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.arc(23, 22, 6, 0, 7); g.fill();
}), _bubble.wrapS = _bubble.wrapT = THREE.ClampToEdgeWrapping, keep.add(_bubble), _bubble);
const hitSphere = (obj, r) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), new THREE.MeshBasicMaterial({ visible: false })); obj.add(m); return m; };

/**
 * key: which house. api (from board/deck.js): { env, say, voice, sfx, who, hero (voice), level(strand), addStars, status, count }.
 * opts: { info { title, goal, how }, theme { wall, floor, rug, ceil, light, win }, visitor(), host() (character factories),
 *         standY (how high the two stand; mermaids float), water }.
 * The game builds its mini-game with the helpers on H, then returns H.ready().
 */
export function createRoom(key, api, { info, theme, visitor, host: makeHost, standY = 0, water = false }) {
  setStyle('candy'); if (water) setCaustic(.3);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
  const timers = new Timers(), fx = new Fx(scene, 500), ray = new THREE.Raycaster(), time = { value: 0 };
  const H = { scene, camera, info, key, api, interactive: [], t: 0, count: 0, done: false, fx, timers, extra: [], look: new THREE.Vector3(0, 2.8, 0), standY };
  H.sleep = (s) => new Promise((r) => timers.after(s, r));
  H.anim = (dur, fn, e = ease.inOut) => new Promise((r) => timers.tween(dur, fn, { ease: e, done: r }));
  scene.environment = api.env; scene.environmentIntensity = 0.4;

  // ---- the room shell: round walls, floor, dome ceiling, round windows ----
  const wallMat = new THREE.MeshStandardMaterial({ color: theme.wall, map: wallTex(), side: THREE.BackSide, roughness: .9 });
  scene.add(new THREE.Mesh(new THREE.CylinderGeometry(11, 11, 9, 56, 1, true), wallMat).translateY(4.5));
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(11.1, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: theme.ceil, side: THREE.BackSide, roughness: .9 })).translateY(9));
  scene.add(new THREE.Mesh(new THREE.CircleGeometry(11, 56).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: theme.floor, roughness: .6 })));
  scene.add(mk(new THREE.CircleGeometry(6.5, 48).rotateX(-Math.PI / 2), toon(theme.rug), [0, .02, 0]), mk(new THREE.RingGeometry(6.5, 7.1, 48).rotateX(-Math.PI / 2), 0xffffff, [0, .03, 0]));
  scene.add(mk(new THREE.TorusGeometry(10.9, .28, 10, 56).rotateX(Math.PI / 2), 0xffffff, [0, .25, 0]));
  [-.62, .62].forEach((a) => {                                                    // round windows at the back
    const g = new THREE.Group(); g.position.set(Math.sin(a) * 10.7, 4.8, -Math.cos(a) * 10.7); g.rotation.y = -a; scene.add(g);
    g.add(new THREE.Mesh(new THREE.CircleGeometry(1.7, 32), new THREE.MeshBasicMaterial({ color: theme.win ?? 0xa8e4ff })), mk(new THREE.TorusGeometry(1.7, .16, 10, 32), 0xffffff, [0, 0, .05]));
    g.add(mk(new THREE.BoxGeometry(3.4, .1, .06), 0xffffff, [0, 0, .08]), mk(new THREE.BoxGeometry(.1, 3.4, .06), 0xffffff, [0, 0, .08]));
    g.userData.win = true; H.extra.push(g);
  });
  scene.add(new THREE.HemisphereLight(0xfff6ff, theme.floor, 1.0));
  const pl = new THREE.PointLight(theme.light, 1400, 60, 1.6); pl.position.set(0, 7, 4); scene.add(pl);
  camera.position.set(0, 5.2, 13); H.camBase = camera.position.clone();
  if (water) {                                                                     // bubbles drifting up around the room (on the GPU)
    const n = 140, P = new Float32Array(n * 3), spd = new Float32Array(n);
    for (let i = 0; i < n; i++) { const a = rand(0, 6.28), r = rand(4, 10.4); P.set([Math.cos(a) * r, rand(0, 9), Math.sin(a) * r], i * 3); spd[i] = rand(.5, 1.3); }
    const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(P, 3)).setAttribute('aSpeed', new THREE.BufferAttribute(spd, 1));
    const mat = new THREE.PointsMaterial({ size: .5, map: bubbleTex(), transparent: true, depthWrite: false, opacity: .8 });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.time = time;
      sh.vertexShader = 'uniform float time;\nattribute float aSpeed;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        transformed.y = mod(position.y + time * aSpeed, 9.);
        transformed.x += sin(time + float(gl_VertexID)) * .2;`);
    };
    const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; scene.add(pts);
  }

  // the visitor (Uni / Esmae) and the host
  const place = (c, x, ry) => { c.root.scale.setScalar(1.15); c.root.position.set(x, standY, 3.2); c.root.rotation.y = ry; scene.add(c.root); return c; };
  H.visitor = place(visitor(), -4.2, .5); H.host = place(makeHost(), 4.2, -.5);

  const goal = () => H.goal ?? info.goal;
  /** the panel's frame fills one cell per thing done, and the voice counts along */
  H.progress = (speak = true) => api.count(Math.min(H.count, goal()), goal(), { speak: speak && !H.done, colors: H.colors });
  H.celebrate = async () => {
    if (H.done) return; H.done = true;
    api.sfx.fanfare(); api.say('You did it! Great job!', api.hero); api.status('\u{1F389}'); api.addStars(3);
    for (let i = 0; i < 6; i++) { fx.burst(new THREE.Vector3(rand(-6, 6), rand(3, 8), rand(-3, 3)), { count: 50, colors: RAINBOW.concat([0xffffff]), speed: 6, gravity: -2, life: 1.6, size: 1 }); api.sfx.pop(); await H.sleep(.35); }
    [H.visitor, H.host].forEach((u) => H.anim(.6, (k) => { u.lift = Math.sin(k * Math.PI) * 1.6; }, ease.linear));
  };
  /** make obj tappable (with an invisible hit sphere of radius r, so small things are easy to hit) */
  H.tapOn = (obj, fn, r = 1) => { obj.userData.tap = fn; hitSphere(obj, r); H.interactive.push(obj); };
  H.hop = (u, h = 1.2) => H.anim(.5, (k) => { u.lift = Math.sin(k * Math.PI) * h; }, ease.linear);

  H.update = (dt) => {
    H.t += dt; const tt = H.t; time.value = tt;
    timers.update(dt); fx.update(dt);
    H.visitor.update(dt, tt, H.visitor.speed || 0); H.host.update(dt, tt, 0);
    H.extra.forEach((e) => e.update && e.update(tt, dt));
    camera.position.x = Math.sin(tt * .25) * 1.2; camera.lookAt(H.look);
  };
  H.pointer = (ndc) => {
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(H.interactive, true)[0];
    if (!hit) {                                                                     // tapping a character: a giggle and a hop
      const w = [H.host, H.visitor].find((c) => ray.intersectObject(c.root, true).length);
      if (w) { api.sfx.giggle(); fx.burst(w.root.position.clone().add(new THREE.Vector3(0, 2.6, 0)), { count: 24, colors: RAINBOW, speed: 4, gravity: -1, life: 1, size: .9 }); H.hop(w); }
      return;
    }
    let o = hit.object; while (o && !o.userData.tap) o = o.parent; if (o) o.userData.tap(o);
  };
  H.resize = (a) => { camera.aspect = a; camera.fov = fovFor(a); camera.updateProjectionMatrix(); };
  H.dispose = () => { timers.clear(); disposeObject(scene); };
  /** call when the mini-game is built */
  H.ready = () => { setStyle('toon'); setCaustic(0); H.progress(false); return H; };
  return H;
}
