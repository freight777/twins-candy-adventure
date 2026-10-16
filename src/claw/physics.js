// The toys are real rigid bodies (cannon-es, MIT): each one is the handful of spheres its builder made, so a pile settles,
// a dropped toy tumbles and rolls, and pulling one out lets the others slump into the gap. The claw itself isn't simulated:
// a toy in its grip leaves the world and rides along, and comes back as a falling body when it slips or is let go.
import * as CANNON from 'cannon-es';
import { DIM } from './machine.js';

export function createPhysics() {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0), allowSleep: true });
  world.broadphase = new CANNON.SAPBroadphase(world);
  world.solver.iterations = 12; world.solver.tolerance = 1e-4;
  const plush = new CANNON.Material('plush'), hard = new CANNON.Material('hard');
  world.addContactMaterial(new CANNON.ContactMaterial(plush, plush, { friction: .4, restitution: .04, contactEquationStiffness: 6e5, contactEquationRelaxation: 4 }));
  world.addContactMaterial(new CANNON.ContactMaterial(plush, hard, { friction: .45, restitution: .1, contactEquationStiffness: 8e5, contactEquationRelaxation: 4 }));
  world.defaultContactMaterial.friction = .4;

  const staticBox = (cx, cy, cz, hx, hy, hz) => { const b = new CANNON.Body({ mass: 0, material: hard, shape: new CANNON.Box(new CANNON.Vec3(hx, hy, hz)) }); b.position.set(cx, cy, cz); world.addBody(b); return b; };
  const { W, D, chute: C, guardH } = DIM;
  // the floor, with the chute hole in the front-left corner
  staticBox(0, -.25, (C.z0 - D) / 2, W + .05, .25, (C.z0 + D) / 2);
  staticBox((W + C.x1) / 2, -.25, (D + C.z0) / 2, (W - C.x1) / 2, .25, (D - C.z0) / 2);
  // walls (glass and backdrop): thick, tall, and reaching down past the chute, so nothing can be squeezed out
  staticBox(-W - .25, .3, 0, .25, 1.2, D + .5); staticBox(W + .25, .3, 0, .25, 1.2, D + .5);
  staticBox(0, .3, -D - .25, W + .5, 1.2, .25); staticBox(0, .3, D + .25, W + .5, 1.2, .25);
  // the chute guard: two thin acrylic walls, and the shaft below
  staticBox((C.x0 + C.x1) / 2, guardH / 2, C.z0, (C.x1 - C.x0) / 2 + .004, guardH / 2, .004);
  staticBox(C.x1, guardH / 2, (C.z0 + C.z1) / 2, .004, guardH / 2, (C.z1 - C.z0) / 2 + .004);
  staticBox((C.x0 + C.x1) / 2, -.3, C.z0 - .01, (C.x1 - C.x0) / 2 + .01, .3, .01); staticBox(C.x1 + .01, -.3, (C.z0 + C.z1) / 2, .01, .3, (C.z1 - C.z0) / 2 + .01);

  const bodies = new Map();       // toy group -> body
  let acc = 0;
  const api = {
    world, CANNON, onImpact: null,
    /** a body for a toy group (built from userData.toy.spheres) at a position */
    add(toy, pos, quat = null) {
      const b = new CANNON.Body({ mass: .16, material: plush, linearDamping: .32, angularDamping: .62, sleepSpeedLimit: .045, sleepTimeLimit: .6 });
      for (const s of toy.userData.toy.spheres) b.addShape(new CANNON.Sphere(s.r), new CANNON.Vec3(s.p.x, s.p.y, s.p.z));
      b.position.set(pos.x, pos.y, pos.z); if (quat) b.quaternion.set(quat.x, quat.y, quat.z, quat.w);
      b.userData = { toy }; world.addBody(b); bodies.set(toy, b); toy.userData.body = b;
      b.addEventListener('collide', (e) => { if (api.onImpact) { const v = Math.abs(e.contact.getImpactVelocityAlongNormal()); if (v > .7) api.onImpact(toy, v); } });
      return b;
    },
    remove(toy) { const b = bodies.get(toy); if (b) { world.removeBody(b); bodies.delete(toy); toy.userData.body = null; } api.wakeAll(); },
    /** take a toy out of the simulation (the claw has it) */
    hold(toy) { const b = bodies.get(toy); if (b) { world.removeBody(b); b.userData.held = true; } api.wakeAll(); },
    /** give it back as a falling body, at the group's current pose, moving with velocity v */
    release(toy, v = { x: 0, y: 0, z: 0 }, spin = 1) {
      const b = bodies.get(toy); if (!b) return;
      b.position.set(toy.position.x, toy.position.y, toy.position.z); b.quaternion.set(toy.quaternion.x, toy.quaternion.y, toy.quaternion.z, toy.quaternion.w);
      b.velocity.set(v.x, v.y, v.z); b.angularVelocity.set((Math.random() - .5) * 4 * spin, (Math.random() - .5) * 3 * spin, (Math.random() - .5) * 4 * spin);
      b.userData.held = false; world.addBody(b); b.wakeUp();
    },
    wakeAll() { world.bodies.forEach((b) => b.mass && b.wakeUp()); },
    bodyOf: (toy) => bodies.get(toy),
    toys: () => [...bodies.keys()],
    /** fixed 120 Hz steps */
    step(dt) { acc = Math.min(acc + dt, 1 / 20); let n = 0; while (acc >= 1 / 120 && n < 6) { world.step(1 / 120); acc -= 1 / 120; n++; } },
    /** run the world forward quickly without drawing (settling a fresh pile) */
    settle(seconds) { for (let i = 0; i < seconds * 120; i++) world.step(1 / 120); },
    /** copy every free body's pose onto its toy */
    sync() { for (const [toy, b] of bodies) if (!b.userData.held) { toy.position.set(b.position.x, b.position.y, b.position.z); toy.quaternion.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w); } },
    /** straight down from (x, top, z): what is the first thing hit? -> { y, toy (or null for the floor) } */
    probe(x, z, from = .9) {
      const r = new CANNON.RaycastResult(); world.raycastClosest(new CANNON.Vec3(x, from, z), new CANNON.Vec3(x, -.2, z), { skipBackfaces: true }, r);
      if (!r.hasHit) return { y: 0, toy: null };
      return { y: r.hitPointWorld.y, toy: r.body?.userData?.toy || null };
    },
    /** a soft push to everything near a point (the claw bumping into the pile) */
    nudge(x, y, z, radius, strength) {
      for (const b of world.bodies) {
        if (!b.mass) continue; const dx = b.position.x - x, dz = b.position.z - z, dy = b.position.y - y, d = Math.hypot(dx, dz);
        if (d > radius || dy < -.25) continue;
        b.wakeUp(); const k = strength * (1 - d / radius);
        b.applyImpulse(new CANNON.Vec3(dx / (d + .01) * k * .5, -k, dz / (d + .01) * k * .5), new CANNON.Vec3((Math.random() - .5) * .02, .02, (Math.random() - .5) * .02));
      }
    },
  };
  return api;
}
