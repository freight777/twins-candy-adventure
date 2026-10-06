import * as THREE from 'three';
import { createTwin } from './characters.js';

/** Both girls. One is "active" (you tap to move her), the other follows along. */
export class Party {
  constructor() {
    this.adalyn = createTwin('adalyn');
    this.esmae = createTwin('esmae');
    this.group = new THREE.Group();
    this.group.add(this.adalyn.root, this.esmae.root);
    this.active = 'adalyn';
    this.target = null;
    this.speed = 4.6;
    this.frozen = false;                 // when true they don't move on their own (cutscenes)
    this.ground = () => ({ y: 0, swim: 0 });
    this.bounds = { xmin: -22, xmax: 22, zmin: -14, zmax: 18 };
    this.moving = { adalyn: false, esmae: false };
  }
  get leader() { return this.active === 'adalyn' ? this.adalyn : this.esmae; }
  get follower() { return this.active === 'adalyn' ? this.esmae : this.adalyn; }
  both() { return this._both || (this._both = [this.adalyn, this.esmae]); }    // the same array every call (it runs every frame)

  /** Stand them back up, normal size, no leftover spin/squash from the previous scene. */
  resetPose() {
    this.both().forEach((t) => {
      t.root.rotation.set(0, 0, 0); t.face = 0; t.root.scale.setScalar(t.form === 'girl' ? 1 : 1.12); t.body.rotation.set(0, 0, 0);
      t.fx.lift = 0; t.fx.spin = 0; t.fx.squash = 1; t.mode = 'idle';
    });
    this.target = null;
  }

  place(lx, lz, fx, fz) {
    this.leader.root.position.set(lx, 0, lz);
    this.follower.root.position.set(fx ?? lx + 1.5, 0, fz ?? lz);
    this.target = null;
  }
  setForm(f) { this.both().forEach((t) => t.setForm(f)); }
  setMode(m) { this.both().forEach((t) => (t.mode = m)); }

  walkTo(x, z) {
    const b = this.bounds;
    this.target = { x: Math.min(b.xmax, Math.max(b.xmin, x)), z: Math.min(b.zmax, Math.max(b.zmin, z)) };
  }

  _step(twin, tx, tz, dt, speedMul = 1) {
    const p = twin.root.position;
    const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
    const g = this.ground(p.x, p.z);
    const sp = this.speed * speedMul * (1 - g.swim * 0.3);
    if (d > 0.12) {
      const s = Math.min(d, sp * dt);
      p.x += (dx / d) * s; p.z += (dz / d) * s;
      twin.lookToward(dx, dz, dt);
      return true;
    }
    return false;
  }

  update(dt, t) {
    const L = this.leader, F = this.follower;
    let lm = false, fm = false;
    if (!this.frozen) {
      if (this.target) {
        lm = this._step(L, this.target.x, this.target.z, dt);
        if (!lm) this.target = null;
      }
      const side = this.active === 'adalyn' ? 1 : -1;
      const fx = L.root.position.x + side * 1.5, fz = L.root.position.z + 0.5;
      const fd = Math.hypot(fx - F.root.position.x, fz - F.root.position.z);
      if (fd > 0.35 && (lm || fd > 1.2)) fm = this._step(F, fx, fz, dt, 1.12);
    }
    this.moving.adalyn = this.active === 'adalyn' ? lm : fm;
    this.moving.esmae = this.active === 'esmae' ? lm : fm;
    for (const tw of this.both()) {
      const p = tw.root.position, g = this.ground(p.x, p.z);
      p.y = g.y;
      tw.update(dt, t, this.moving[tw.name], g.swim);
    }
  }
}
