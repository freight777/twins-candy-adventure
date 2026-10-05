import * as THREE from 'three';
import { canvasTex, clamp, lerp } from '../util.js';

const sph = (r, w = 24, h = 16) => new THREE.SphereGeometry(r, w, h);
const cyl = (rt, rb, h, s = 20) => new THREE.CylinderGeometry(rt, rb, h, s);
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------- real motion-capture clips
// CMU Graphics Lab Motion Capture Database (free for any use): 124_07 "Baseball Swing" and 124_01 "Baseball Pitch",
// converted by tools/export-clips.cjs into small JSON clips of key joint positions in the game's world.
export async function loadClips(base = '/') {
  const get = async (f) => { const c = await (await fetch(`${base}assets/mocap/${f}`)).json(); c.idx = {}; c.names.forEach((n, i) => (c.idx[n] = i * 3)); c.count = c.frames.length; return c; };
  const [swing, pitch] = await Promise.all([get('swing.json'), get('pitch.json')]);
  return { swing, pitch };
}
/** joint positions at a (fractional) frame index */
function frameAt(c, f) {
  f = clamp(f, 0, c.count - 1); const i = Math.floor(f), j = Math.min(c.count - 1, i + 1), k = f - i, A = c.frames[i], B = c.frames[j], F = {};
  c.names.forEach((n) => { const o = c.idx[n]; F[n] = V(lerp(A[o], B[o], k), lerp(A[o + 1], B[o + 1], k), lerp(A[o + 2], B[o + 2], k)); });
  return F;
}
const copyFrame = (F) => { const o = {}; Object.keys(F).forEach((n) => (o[n] = F[n].clone())); return o; };
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
/** batting stance: hands by the rear shoulder, bat upright and tipped a little back over the shoulder, weight slightly on the back foot */
function batterStance(F0) {
  const F = copyFrame(F0), base = F.rsh.clone().add(V(.38, .12, .04)), a = V(.1, 1, .42).normalize();
  F.lwr = base.clone().addScaledVector(a, -.1); F.rwr = base.clone().addScaledVector(a, .3);               // bottom hand, top hand
  F.lfin = F.lwr.clone(); F.rfin = F.rwr.clone();
  F.rel = F.rsh.clone().add(F.rwr).multiplyScalar(.5).add(V(.05, -.6, .3)); F.lel = F.lsh.clone().add(F.lwr).multiplyScalar(.5).add(V(.05, -.5, -.15));
  F.hips.z += .1; F.chest.z += .08; F.neck.z += .14; F.head.z += .14;
  return F;
}
/** pitcher's set position: sideways to the plate, feet planted, ball and glove together at the chest */
function pitcherSet(F0) {
  const F = copyFrame(F0), sv = F.rsh.clone().sub(F.lsh), yaw = Math.atan2(-sv.z, sv.x), fx = -Math.sin(yaw), fz = -Math.cos(yaw), hx = F.hips.x + fx * .55, hz = F.hips.z + fz * .55;
  F.lwr = V(hx, 3.15, hz + .12); F.rwr = V(hx, 3.2, hz - .1); F.lfin = F.lwr.clone(); F.rfin = F.rwr.clone();
  F.lel = F.lsh.clone().add(F.lwr).multiplyScalar(.5).add(V(0, -.5, .22)); F.rel = F.rsh.clone().add(F.rwr).multiplyScalar(.5).add(V(0, -.5, -.22));
  const dy = F.lankle.y - .19; F.lankle.y -= dy; F.ltoe.y = Math.max(.1, F.ltoe.y - dy); F.lknee.y = Math.max(.9, F.lknee.y - dy * .6);
  return F;
}
const blend = (A, B, k) => { const F = {}; Object.keys(A).forEach((n) => (F[n] = A[n].clone().lerp(B[n], k))); return F; };

// ---------------------------------------------------------------- materials & helpers
const cloth = (color, o = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: .85, sheen: 1, sheenRoughness: .6, sheenColor: new THREE.Color(color).lerp(new THREE.Color(0xffffff), .4), ...o });
const skinMat = (c = 0x8a5a3c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: .55, sheen: .4, sheenColor: new THREE.Color(0xffb090), clearcoat: .1 });
const pinstripe = (base, line) => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = base; g.fillRect(0, 0, w, h); g.fillStyle = line; for (let x = 8; x < w; x += 20) g.fillRect(x, 0, 2.2, h);
  for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * .05})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
}, [2, 2]);
function bone(parent, r1, r2, mat) {
  const g = new THREE.Group(), body = new THREE.Mesh(cyl(r1, r2, 1, 18), mat), a = new THREE.Mesh(sph(r1, 18, 12), mat), b = new THREE.Mesh(sph(r2, 18, 12), mat);
  body.geometry.translate(0, .5, 0); [body, a, b].forEach((m) => { m.castShadow = true; g.add(m); }); parent.add(g);
  return (p, q) => { body.position.copy(p); const d = q.clone().sub(p), L = d.length(); body.scale.set(1, L, 1); body.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); a.position.copy(p); b.position.copy(q); };
}
/** two-bone IK: the joint (elbow/knee) between a and b with bone lengths l1, l2, bending toward `pole` */
function joint(a, b, l1, l2, pole) {
  const d = b.clone().sub(a), dist = clamp(d.length(), .05, l1 + l2 - .02), dir = d.normalize();
  const x = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist), h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  const side = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir)));
  if (side.lengthSq() < 1e-6) side.set(0, 0, 1); side.normalize();
  return a.clone().addScaledVector(dir, x).addScaledVector(side, h);
}
function makeHead(parent, helmet, skin, ears) {
  const h = new THREE.Group(); parent.add(h);
  const face = new THREE.Mesh(sph(.4, 28, 20), skin); face.scale.set(.88, 1.1, .95); face.castShadow = true; h.add(face);
  const hm = new THREE.Mesh(new THREE.SphereGeometry(.44, 28, 20, 0, Math.PI * 2, 0, Math.PI * .52), helmet); hm.position.y = .06; hm.scale.set(.96, 1.05, 1.02); hm.castShadow = true; h.add(hm);
  if (!ears) { const brim = new THREE.Mesh(new THREE.CylinderGeometry(.43, .43, .05, 24, 1, false, Math.PI / 2, Math.PI), helmet); brim.position.set(0, .04, -.02); brim.rotation.x = -.28; brim.scale.set(1.05, 1.5, 1.85); h.add(brim); }   // cap bill (front half-disc, toward -Z)
  [-.15, .15].forEach((x) => { const e = new THREE.Mesh(sph(.045, 10, 8), new THREE.MeshStandardMaterial({ color: 0x1a1210 })); e.position.set(x, .04, -.34); h.add(e); });
  const nose = new THREE.Mesh(sph(.06, 10, 8), skin); nose.position.set(0, -.06, -.38); h.add(nose);
  if (ears) { const ear = new THREE.Mesh(sph(.17, 14, 10), helmet); ear.position.set(.34, -.04, 0); ear.scale.set(.5, 1, .9); h.add(ear); }
  return h;
}

/** shared body rig: torso, head, two legs, two arms. `drive(F)` poses it from a motion-capture frame. */
function createRig({ torsoMat, legMat, armMat, foreMat, helmet, skin, ears }) {
  const root = new THREE.Group(), shoe = new THREE.MeshStandardMaterial({ color: 0x15151a, roughness: .5 });
  const legs = [0, 1].map(() => {
    const sh = new THREE.Mesh(new THREE.BoxGeometry(1.0, .26, .42), shoe), toe = new THREE.Mesh(sph(.21, 12, 8), shoe); sh.castShadow = true; toe.scale.set(1, .7, 1); root.add(sh, toe);
    return { upper: bone(root, .4, .3, legMat), lower: bone(root, .3, .22, legMat), shoe: sh, toe };
  });
  const torso = new THREE.Group(); torso.rotation.order = 'YXZ'; root.add(torso);
  const chest = new THREE.Mesh(sph(1, 32, 24), torsoMat); chest.scale.set(.92, 1.08, .6); chest.position.y = 1.0; chest.castShadow = true; torso.add(chest);
  const waist = new THREE.Mesh(cyl(.55, .52, .7, 24), torsoMat); waist.scale.set(1, 1, .7); waist.position.y = .05; torso.add(waist);
  const belt = new THREE.Mesh(new THREE.TorusGeometry(.56, .06, 10, 28), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: .4 })); belt.rotation.x = Math.PI / 2; belt.scale.set(1, .72, 1); belt.position.y = -.1; torso.add(belt);
  const neck = new THREE.Mesh(cyl(.17, .21, .35, 16), skin); neck.position.y = 2.05; torso.add(neck);
  const hd = makeHead(torso, helmet, skin, ears); hd.position.set(0, 2.55, 0);
  const arms = [-1, 1].map((s) => ({ upper: bone(root, .27, .21, armMat), fore: bone(root, .21, .17, foreMat), s }));
  const rig = { root, torso, hd, legs, arms };
  rig.drive = (F, headYawWorld) => {
    // torso from the shoulder line and the spine
    torso.position.copy(F.hips);
    const sv = F.rsh.clone().sub(F.lsh), yaw = Math.atan2(-sv.z, sv.x), sp = F.neck.clone().sub(F.hips);
    const fwd = V(-Math.sin(yaw), 0, -Math.cos(yaw)), right = V(Math.cos(yaw), 0, -Math.sin(yaw));
    torso.rotation.set(-Math.atan2(sp.dot(fwd), sp.y), yaw, -Math.atan2(sp.dot(right), sp.y));
    hd.rotation.y = clamp(headYawWorld - yaw, -1.5, 1.5); hd.rotation.x = -.1;
    // legs: hip -> knee -> ankle, knees bending the way the captured knees do
    [[F.lhip, F.lknee, F.lankle, F.ltoe, 0], [F.rhip, F.rknee, F.rankle, F.rtoe, 1]].forEach(([hip, knee, ank, toe, i]) => {
      const L = legs[i], l1 = hip.distanceTo(knee), l2 = knee.distanceTo(ank), mid = hip.clone().add(ank).multiplyScalar(.5), pole = knee.clone().sub(mid);
      const k = joint(hip, ank, l1, l2, pole); L.upper(hip, k); L.lower(k, ank);
      const dir = toe.clone().sub(ank).setY(0); if (dir.lengthSq() < 1e-6) dir.set(1, 0, 0); dir.normalize();
      const ay = Math.atan2(-dir.z, dir.x); L.shoe.rotation.y = ay; L.toe.rotation.y = ay;
      L.shoe.position.set(ank.x + dir.x * .15, Math.max(.13, ank.y - .1), ank.z + dir.z * .15); L.toe.position.set(ank.x + dir.x * .6, Math.max(.14, ank.y - .09), ank.z + dir.z * .6);
    });
    // arms: root at this body's shoulders, reaching the same relative hand position as the capture
    const out = {};
    torso.updateMatrix(); torso.updateMatrixWorld(true);
    [[F.lsh, F.lel, F.lwr, -1, 'L'], [F.rsh, F.rel, F.rwr, 1, 'R']].forEach(([sh, el, wr, s, key]) => {
      const A = arms[s < 0 ? 0 : 1], root0 = root.worldToLocal(torso.localToWorld(V(s * .78, 1.55, 0))), tgt = root0.clone().add(wr.clone().sub(sh)), l1 = sh.distanceTo(el), l2 = el.distanceTo(wr);
      const e = joint(root0, tgt, l1, l2, el.clone().sub(sh.clone().add(wr).multiplyScalar(.5)).add(V(0, -.3, 0))); A.upper(root0, e); A.fore(e, tgt); out[key] = tgt;
    });
    return out;                                                           // hand positions (left, right) in rig space
  };
  return rig;
}

// ---------------------------------------------------------------- the batter
/** A realistic-proportioned slugger in a navy-pinstriped home uniform (an original character, not any real player).
 *  His swing is the real CMU motion-capture "Baseball Swing". Hands, hips, shoulders and feet follow the recording. */
export function createBatter(clips, name = 'JUDGE', number = '99') {
  const clip = clips.swing, skin = skinMat(), navy = cloth(0x10203f), stripes = cloth(0xffffff, { map: pinstripe('#f7f7f4', '#14234a') });
  const rig = createRig({ torsoMat: stripes, legMat: stripes, armMat: navy, foreMat: navy, helmet: navy, skin, ears: true });
  const { root, torso } = rig;
  // name and number on the back: a plate that sits just off the jersey and curves around the body so nothing is buried in it
  const plateGeo = new THREE.PlaneGeometry(.9, 1.2, 10, 1), pp = plateGeo.attributes.position;
  for (let i = 0; i < pp.count; i++) pp.setZ(i, -(pp.getX(i) * pp.getX(i)) * 0.3);
  const backPlate = new THREE.Mesh(plateGeo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, map: canvasTex(256, 320, (g, w, h) => { g.fillStyle = '#10203f'; g.textAlign = 'center'; g.font = '700 46px Arial, sans-serif'; g.fillText(name.slice(0, 8), w / 2, 70); g.font = '700 190px Arial, sans-serif'; g.fillText(number, w / 2, 258); }) }));
  backPlate.position.set(0, 1.1, .64); torso.add(backPlate);
  // bat
  const pivot = new THREE.Group(); root.add(pivot);
  const wood = new THREE.MeshPhysicalMaterial({ color: 0xc89a5a, roughness: .35, clearcoat: .5 });
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(.22, .085, 3.7, 24), wood); barrel.rotation.z = -Math.PI / 2; barrel.position.x = 2.2; barrel.castShadow = true; pivot.add(barrel);
  const handle = new THREE.Mesh(cyl(.075, .075, .7, 14), new THREE.MeshStandardMaterial({ color: 0x241810, roughness: .8 })); handle.rotation.z = Math.PI / 2; handle.position.x = .15; pivot.add(handle);
  const knob = new THREE.Mesh(sph(.12, 14, 10), new THREE.MeshStandardMaterial({ color: 0x241810 })); knob.position.x = -.22; pivot.add(knob);
  [0, .35].forEach((x) => { const g = new THREE.Mesh(sph(.16, 14, 10), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: .7 })); g.position.x = x; pivot.add(g); });
  const IDLE = 8, START = 10, RATE = 1.5, CONTACT = clip.center, axisQ = new THREE.Quaternion(), tmpQ = new THREE.Quaternion(), SWEET = 3.2;
  let anim = null, hold = null, baseX = 0, off = 0, offT = 0;
  const pose = (F) => {
    const hands = rig.drive(F, 0), axis = hands.R.clone().sub(hands.L); if (axis.lengthSq() < 1e-6) axis.set(1, 0, 0); axis.normalize();
    tmpQ.setFromUnitVectors(V(1, 0, 0), axis); axisQ.slerp(tmpQ, .65); pivot.quaternion.copy(axisQ); pivot.position.copy(hands.L);
    return { axis, hands };
  };
  const idleFrame = batterStance(frameAt(clip, IDLE)), contactFrame = frameAt(clip, CONTACT);
  let cp = pose(contactFrame); axisQ.copy(pivot.quaternion); cp = pose(contactFrame);
  const contactLocal = cp.hands.L.clone().addScaledVector(cp.axis, SWEET);       // sweet spot of the bat at contact (in rig space)
  pose(idleFrame); axisQ.copy(pivot.quaternion); pose(idleFrame);
  const api = {
    root, pivot, torso, contactLocal, contactY: contactLocal.y, contactDelay: (CONTACT - START) / 60 / RATE,
    /** stand so the bat meets the ball over the plate */
    placeAt(x, z) { baseX = x - contactLocal.x; off = 0; offT = 0; root.position.set(baseX, 0, z - contactLocal.z); },
    /** step a little toward the side the ball is on, so the bat meets it there */
    setOffset(v) { offT = v; },
    contactWorld() { return root.localToWorld(contactLocal.clone()); },
    swing(arg1, arg2) {
      const cb = typeof arg1 === 'function' ? arg1 : arg2; let f = START, hit = false; api._back = null;
      anim = (dt) => {
        f += dt * 60 * RATE; if (!hit && f >= CONTACT) { hit = true; cb && cb(); }
        if (f >= clip.count - 1) { hold = frameAt(clip, clip.count - 1); anim = null; api._back = 0; return; }
        pose(blend(idleFrame, frameAt(clip, f), smooth((f - START) / (CONTACT - 14 - START))));   // bat starts upright, then follows the real swing path
      };
    },
    update(dt, t) {
      off += (offT - off) * (1 - Math.exp(-16 * dt)); root.position.x = baseX + off;
      if (anim) { anim(dt); return; }
      if (api._back != null && api._back < 1) { api._back = Math.min(1, api._back + dt * 2.2); pose(blend(hold, idleFrame, api._back * api._back * (3 - 2 * api._back))); return; }
      const F = copyFrame(idleFrame); F.hips.y += Math.sin(t * 1.8) * .015; F.rwr.y += Math.sin(t * 1.8 + 1) * .02; pose(F);
    },
    unswing() { anim = null; api._back = 1; offT = 0; },
  };
  return api;
}

// ---------------------------------------------------------------- the pitcher
/** an original pitcher in a gray road uniform and red cap. His windup and throw are the real CMU "Baseball Pitch" capture. */
export function createPitcher(clips) {
  const clip = clips.pitch, skin = skinMat(0xc08a63), gray = cloth(0xd6d9df), red = cloth(0xb81f30);
  const rig = createRig({ torsoMat: gray, legMat: gray, armMat: gray, foreMat: new THREE.MeshPhysicalMaterial({ color: 0xc08a63, roughness: .55 }), helmet: red, skin, ears: false });
  const { root } = rig, REL_IDX = clip.center;
  const mitt = new THREE.Mesh(sph(.3, 16, 12), new THREE.MeshStandardMaterial({ color: 0x6a3a1c, roughness: .6 })); mitt.castShadow = true; root.add(mitt);
  const ballM = new THREE.Mesh(sph(.2, 16, 12), new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: .55 })); root.add(ballM);
  let hands = null, holding = true;
  const setF = pitcherSet(frameAt(clip, 0));
  const drivePose = (F) => { hands = rig.drive(F, Math.PI); mitt.position.copy(hands.L); ballM.visible = holding; ballM.position.copy(hands.R); };
  const at = (idx) => { const k = smooth(idx / 24), F = blend(setF, frameAt(clip, idx), k); drivePose(F); };
  holding = false; drivePose(frameAt(clip, REL_IDX)); const relLocal = hands.R.clone(); holding = true; drivePose(setF);
  return {
    root, relLocal,
    /** release point of the ball in world space */
    releaseWorld() { root.updateMatrixWorld(true); return root.localToWorld(relLocal.clone()); },
    /** k 0..1 = the windup up to the release; k > 1 = the follow-through */
    pose(k) { at(k * REL_IDX); },
    idle() { holding = true; drivePose(setF); },
    holdBall(on) { holding = on; ballM.visible = on; },
    handWorld() { return root.localToWorld(hands.R.clone()); },
  };
}
