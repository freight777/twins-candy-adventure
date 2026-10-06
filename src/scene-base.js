import * as THREE from 'three';
import { Timers, Fx, clamp, linearizeFrag, disposeObject, keep, bakeStatic } from './util.js';
import { Q } from './engine/quality.js';
import { sayAsync } from './audio.js';

const hitMat = new THREE.MeshBasicMaterial({ visible: false }); keep.add(hitMat);
const _v = new THREE.Vector3(), _w = new THREE.Vector3();
const visibleChain = (o) => { while (o) { if (!o.visible) return false; o = o.parent; } return true; };

/** Shared plumbing for every scene: camera, timers, sparkles, tap picking. */
export class BaseScene {
  constructor(game) {
    this.game = game;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    this.hfov = 78;
    this.tm = new Timers();
    this.fx = new Fx(this.scene);
    this.hits = [];
    this.time = 0;
    this.ray = new THREE.Raycaster();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  }

  resize(w, h) {
    const a = w / h;
    const v = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(this.hfov / 2)) / a));
    this.camera.fov = clamp(v, 40, 85);
    this.camera.aspect = a;
    this.camera.updateProjectionMatrix();
  }

  /** Make something tappable. Big invisible sphere so small fingers still hit it. */
  addInteractive(obj, onTap, radius = 1, offset = [0, 0, 0]) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 8, 6), hitMat);
    m.position.set(...offset);
    m.userData.onTap = onTap; m.userData.noShadow = true; m.userData.keep = true;
    obj.add(m);
    this.hits.push(m);
    return m;
  }

  onPointer(ndc) {
    this.ray.setFromCamera(ndc, this.camera);
    const live = this.hits.filter((h) => h.userData.enabled !== false && visibleChain(h));
    const hit = this.ray.intersectObjects(live, false)[0];
    if (hit) { hit.object.userData.onTap(hit); return; }
    const p = new THREE.Vector3();
    if (this.ray.ray.intersectPlane(this.groundPlane, p)) this.onGround(p);
  }
  onPointerMove() {}
  onGround() {}

  /** project a world point to screen pixels */
  toScreen(v) {
    const p = _v.copy(v).project(this.camera);
    return { x: (p.x * 0.5 + 0.5) * innerWidth, y: (-p.y * 0.5 + 0.5) * innerHeight, behind: p.z > 1 };
  }

  enter() {}
  exit() {}
  /** wait (in game time, so it pauses with the scene) */
  wait(sec) { return new Promise((r) => this.tm.after(sec, r)); }
  /** speak a line and wait until it has been said; if the scene has ended meanwhile the chain just stops */
  line(text, who = 'narrator', opts = {}) { return sayAsync(text, who, opts).then((v) => (this.disposed ? new Promise(() => {}) : v)); }
  /** merge the meshes inside every object marked userData.bake (after shadows are set up): far fewer draw calls */
  bakeMarked() {
    const list = []; this.scene.traverse((o) => { if (o.userData.bake) list.push(o); });
    list.forEach((o) => bakeStatic(o));
  }
  /** Sun-style light that casts soft shadows around whoever the camera is following. */
  useShadows(light, extent = 24) {
    this.shadowSun = light; this.shadowOffset = light.position.clone();
    light.castShadow = true;
    const c = light.shadow.camera; c.left = c.bottom = -extent; c.right = c.top = extent; c.near = 1; c.far = 160;
    light.shadow.bias = -0.0005; light.shadow.normalBias = 0.05; light.shadow.radius = 3;
    this.scene.add(light.target);
  }

  update(dt) {
    if (!this.patched) {                    // raw shaders were written in screen colours; fix them up for the post-processing chain
      this.patched = true;
      this.scene.traverse((o) => {
        const m = o.material;
        if (m && m.isShaderMaterial && !m.userData.lin) { m.fragmentShader = linearizeFrag(m.fragmentShader); m.userData.lin = true; m.needsUpdate = true; }
      });
    }
    if (this.shadowSun) {
      const f = this.shadowFocus || this.game.party.leader.root.position;
      this.shadowSun.target.position.copy(f); this.shadowSun.position.copy(f).add(this.shadowOffset);
      const want = Q.shadow > 0;
      if (this.shadowSun.castShadow !== want) this.shadowSun.castShadow = want;
      if (want && this.shadowSun.shadow.mapSize.x !== Q.shadow) { this.shadowSun.shadow.mapSize.set(Q.shadow, Q.shadow); this.shadowSun.shadow.map && this.shadowSun.shadow.map.dispose(); this.shadowSun.shadow.map = null; }
    }
    this.time += dt;
    this.tm.update(dt);
    this.fx.update(dt);
    // magical aura: transformed girls leave a little trail of sparkles (rainbow for the unicorn, bubbles for the mermaid)
    const P = this.game.party;
    if (P.group.parent === this.scene && this.auraOn !== false) {
      for (const tw of P.both()) {
        if (tw.form === 'girl' || Math.random() > dt * 14) continue;
        const p = tw.root.position;
        this.fx.burst(_w.set(p.x + (Math.random() - .5) * 1.2, p.y + 0.5 + Math.random() * 1.8, p.z + (Math.random() - .5) * 1.2),
          { count: 1, colors: tw.form === 'unicorn' ? [0xff4d4d, 0xffe14d, 0x5be37d, 0x4db8ff, 0xb07cff, 0xffffff] : [0x9be7ff, 0xffffff, 0xff9fd0, 0x2fd6c8], speed: .5, gravity: tw.form === 'unicorn' ? -.6 : .8, life: 1.3, size: .5 });
      }
    }
  }

  dispose() {
    this.disposed = true;
    this.game.party.group.removeFromParent();
    disposeObject(this.scene);           // shared materials/textures (util.toon cache, glow/star sprites) stay alive for the next scene
  }
}
