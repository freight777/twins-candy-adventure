import * as THREE from 'three';
import { Timers, Fx, clamp } from './util.js';

const hitMat = new THREE.MeshBasicMaterial({ visible: false });
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
    m.userData.onTap = onTap;
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
    const p = v.clone().project(this.camera);
    return { x: (p.x * 0.5 + 0.5) * innerWidth, y: (-p.y * 0.5 + 0.5) * innerHeight, behind: p.z > 1 };
  }

  enter() {}
  exit() {}
  update(dt) {
    this.time += dt;
    this.tm.update(dt);
    this.fx.update(dt);
  }

  dispose() {
    this.game.party.group.removeFromParent();
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.map && m.map.dispose(); m.dispose(); });
    });
  }
}
