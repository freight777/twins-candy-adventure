import * as THREE from 'three';
import { mk, canvasTex, clamp, lerp } from '../util.js';

const sph = (r, w = 24, h = 16) => new THREE.SphereGeometry(r, w, h);
const cyl = (rt, rb, h, s = 20) => new THREE.CylinderGeometry(rt, rb, h, s);

// realistic cloth / skin materials (physically based, matte, with a little fabric sheen)
const cloth = (color, o = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: .85, sheen: 1, sheenRoughness: .6, sheenColor: new THREE.Color(color).lerp(new THREE.Color(0xffffff), .4), ...o });
const skinMat = (c = 0x8a5a3c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: .55, sheen: .4, sheenColor: new THREE.Color(0xffb090), clearcoat: .1 });
const pinstripe = (base, line) => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = base; g.fillRect(0, 0, w, h); g.fillStyle = line; for (let x = 8; x < w; x += 20) g.fillRect(x, 0, 2.2, h);
  for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * .05})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
}, [2, 2]);

function bone(parent, r1, r2, mat) {
  const g = new THREE.Group(), body = new THREE.Mesh(cyl(r1, r2, 1, 18), mat), a = new THREE.Mesh(sph(r1, 18, 12), mat), b = new THREE.Mesh(sph(r2, 18, 12), mat);
  body.geometry.translate(0, .5, 0); [body, a, b].forEach((m) => { m.castShadow = true; g.add(m); }); parent.add(g);
  return (p, q) => { body.position.copy(p); const d = q.clone().sub(p), L = d.length(); body.scale.set(1, L, 1); body.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); a.position.copy(p); b.position.copy(q); };
}
/** two-bone IK: the joint (elbow/knee) between a and b, bending toward `pole` */
function joint(a, b, l1, l2, pole) {
  const d = b.clone().sub(a), dist = clamp(d.length(), .05, l1 + l2 - .02), dir = d.normalize();
  const x = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist), h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  const side = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
  return a.clone().addScaledVector(dir, x).addScaledVector(side, h);
}
function head(parent, helmet, skin, cap) {
  const h = new THREE.Group(); parent.add(h);
  const face = new THREE.Mesh(sph(.4, 28, 20), skin); face.scale.set(.88, 1.1, .95); face.castShadow = true; h.add(face);
  const hm = new THREE.Mesh(new THREE.SphereGeometry(.44, 28, 20, 0, Math.PI * 2, 0, Math.PI * .52), helmet); hm.position.y = .06; hm.scale.set(.96, 1.05, 1.02); hm.castShadow = true; h.add(hm);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(.43, .43, .05, 24, 1, false, 0, Math.PI), helmet); brim.position.set(0, .1, -.12); brim.rotation.y = Math.PI; brim.scale.set(1, 1, 1.25); h.add(brim);
  [-.15, .15].forEach((x) => { const e = new THREE.Mesh(sph(.045, 10, 8), new THREE.MeshStandardMaterial({ color: 0x1a1210 })); e.position.set(x, .04, -.34); h.add(e); });
  const nose = new THREE.Mesh(sph(.06, 10, 8), skin); nose.position.set(0, -.06, -.38); h.add(nose);
  if (cap) { const ear = new THREE.Mesh(sph(.17, 14, 10), helmet); ear.position.set(.34, -.04, .0); ear.scale.set(.5, 1, .9); h.add(ear); }
  return h;
}

/** A realistic-proportioned slugger in a navy-pinstriped home uniform (an original character, not any real player). Faces -Z. */
export function createBatter(name = 'JUDGE', number = '99') {
  const root = new THREE.Group(), skin = skinMat(), navy = cloth(0x10203f), stripes = cloth(0xffffff, { map: pinstripe('#f7f7f4', '#14234a') });
  const shoe = new THREE.MeshStandardMaterial({ color: 0x15151a, roughness: .5 });
  // legs: hips to feet with knees bent
  const hipsY = 2.75, feet = [new THREE.Vector3(.15, .12, -.95), new THREE.Vector3(.15, .12, .95)];
  const legBones = feet.map((f, i) => { const s = i ? 1 : -1; return { upper: bone(root, .4, .3, stripes), lower: bone(root, .3, .22, stripes), hip: new THREE.Vector3(0, hipsY, s * .34), foot: f, pole: new THREE.Vector3(1, 0, 0) }; });
  feet.forEach((f) => { const sh = new THREE.Mesh(new THREE.BoxGeometry(1.0, .26, .42), shoe); sh.position.set(f.x + .15, .13, f.z); sh.castShadow = true; root.add(sh); const toe = new THREE.Mesh(sph(.21, 12, 8), shoe); toe.position.set(f.x + .6, .14, f.z); toe.scale.set(1, .7, 1); root.add(toe); });
  // torso (jersey + belt + undershirt arms)
  const BASE = -Math.PI / 2 + .35;
  const torso = new THREE.Group(); torso.position.set(0, hipsY, 0); torso.rotation.y = BASE; root.add(torso);
  const chest = new THREE.Mesh(sph(1, 32, 24), stripes); chest.scale.set(.92, 1.08, .6); chest.position.y = 1.0; chest.castShadow = true; torso.add(chest);
  const waist = new THREE.Mesh(cyl(.55, .52, .7, 24), stripes); waist.scale.set(1, 1, .7); waist.position.y = .05; torso.add(waist);
  const belt = new THREE.Mesh(new THREE.TorusGeometry(.56, .06, 10, 28), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: .4 })); belt.rotation.x = Math.PI / 2; belt.scale.set(1, .72, 1); belt.position.y = -.1; torso.add(belt);
  const neck = new THREE.Mesh(cyl(.17, .21, .35, 16), skin); neck.position.y = 2.05; torso.add(neck);
  const backPlate = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.4), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, map: canvasTex(256, 320, (g, w, h) => { g.fillStyle = '#10203f'; g.textAlign = 'center'; g.font = '700 50px Arial, sans-serif'; g.fillText(name.slice(0, 8), w / 2, 62); g.font = '700 180px Arial, sans-serif'; g.fillText(number, w / 2, 240); }) }));
  backPlate.position.set(0, 1.05, .56); torso.add(backPlate);
  const hd = head(torso, navy, skin, true); hd.position.set(0, 2.55, 0); hd.rotation.y = Math.PI / 2 - .35;
  // bat and hands
  const pivot = new THREE.Group(); pivot.position.set(.35, 3.8, .55); root.add(pivot);
  const bat = new THREE.Group(); pivot.add(bat);
  const wood = new THREE.MeshPhysicalMaterial({ color: 0xc89a5a, roughness: .35, clearcoat: .5 });
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(.22, .085, 3.7, 24), wood); barrel.rotation.z = -Math.PI / 2; barrel.position.x = 2.2; barrel.castShadow = true; bat.add(barrel);
  const handle = new THREE.Mesh(cyl(.075, .075, .7, 14), new THREE.MeshStandardMaterial({ color: 0x241810, roughness: .8 })); handle.rotation.z = Math.PI / 2; handle.position.x = .15; bat.add(handle);
  const knob = new THREE.Mesh(sph(.12, 14, 10), new THREE.MeshStandardMaterial({ color: 0x241810 })); knob.position.x = -.22; bat.add(knob);
  const gloves = [0, .35].map((x) => { const g = new THREE.Mesh(sph(.16, 14, 10), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: .7 })); g.position.x = x; bat.add(g); return g; });
  const arms = [-1, 1].map((s) => ({ upper: bone(root, .27, .21, navy), fore: bone(root, .21, .17, navy), s }));
  let t0 = 0;
  const api = {
    root, pivot, bat, torso,
    reset() { api._anim = null; pivot.rotation.set(0, -1.7, 1.1); },
    swing(theta, onContact, dur = .24) {
      const a0 = -1.7, a1 = theta + 1.25; let t = 0, hit = false;
      api._anim = (dt) => {
        t += dt; const k = clamp(t / dur, 0, 1), e = k * k * (3 - 2 * k);
        pivot.rotation.y = lerp(a0, a1, e); pivot.rotation.z = lerp(1.1, -.12, e); torso.rotation.y = lerp(BASE - .3, BASE + .9, e); pivot.position.x = .35 + e * .2;
        if (!hit && k >= .46) { hit = true; onContact && onContact(); }
        if (k >= 1) api._anim = null;
      };
    },
    update(dt, t) {
      if (api._anim) api._anim(dt); else { pivot.rotation.y = -1.7 + Math.sin(t * 2.2) * .04; pivot.rotation.z = 1.1 + Math.sin(t * 1.7) * .03; torso.rotation.y = BASE + Math.sin(t * 1.3) * .03; pivot.position.x = .35; }
      hd.rotation.y = Math.PI / 2 - (torso.rotation.y - BASE) * .9 - .35;
      root.updateMatrixWorld(true);
      legBones.forEach((L) => { const k = joint(L.hip, L.foot.clone().setY(.45), 1.45, 1.4, L.pole); L.upper(L.hip, k); L.lower(k, L.foot.clone().setY(.45)); });
      // arms: shoulders (on the rotating torso) reach to the two hands on the bat handle
      arms.forEach((A, i) => {
        const sh = torso.localToWorld(new THREE.Vector3(A.s * .78, 1.55, 0)), local = root.worldToLocal(sh), hand = root.worldToLocal(gloves[i].getWorldPosition(new THREE.Vector3()));
        const el = joint(local, hand, 1.05, 1.0, new THREE.Vector3(.3, -1, A.s * .6)); A.upper(local, el); A.fore(el, hand);
      });
    },
    unswing() { api.reset(); },
  };
  api.reset(); return api;
}

/** a realistic pitcher in a gray road uniform and red cap (original design). Faces +Z toward home plate. */
export function createPitcher() {
  const root = new THREE.Group(), skin = skinMat(0xc08a63), gray = cloth(0xd6d9df, { map: pinstripe('#d8dbe0', '#d8dbe0') }), red = cloth(0xb81f30), shoe = new THREE.MeshStandardMaterial({ color: 0x15151a, roughness: .5 });
  const hipsY = 2.75, hips = [new THREE.Vector3(-.3, hipsY, 0), new THREE.Vector3(.3, hipsY, 0)];
  const L = [0, 1].map(() => ({ u: bone(root, .4, .3, gray), l: bone(root, .3, .22, gray) }));
  const shoes = [0, 1].map(() => { const s = new THREE.Mesh(new THREE.BoxGeometry(.42, .26, 1.0), shoe); s.castShadow = true; root.add(s); return s; });
  const torso = new THREE.Group(); torso.position.set(0, hipsY, 0); root.add(torso);
  const chest = new THREE.Mesh(sph(1, 32, 24), gray); chest.scale.set(.9, 1.08, .6); chest.position.y = 1.0; chest.castShadow = true; torso.add(chest);
  const belt = new THREE.Mesh(new THREE.TorusGeometry(.54, .06, 10, 28), new THREE.MeshStandardMaterial({ color: 0x111111 })); belt.rotation.x = Math.PI / 2; belt.scale.set(1, .72, 1); belt.position.y = -.05; torso.add(belt);
  const pw = new THREE.Mesh(cyl(.52, .5, .7, 24), gray); pw.scale.set(1, 1, .7); torso.add(pw);
  const neck = new THREE.Mesh(cyl(.17, .21, .35, 16), skin); neck.position.y = 2.05; torso.add(neck);
  const hd = head(torso, red, skin, false); hd.position.set(0, 2.55, 0); hd.rotation.y = Math.PI;
  const armU = bone(root, .27, .21, gray), armF = bone(root, .21, .17, skin), gloveU = bone(root, .27, .21, gray), gloveF = bone(root, .21, .17, skin);
  const mitt = new THREE.Mesh(sph(.3, 16, 12), new THREE.MeshStandardMaterial({ color: 0x6a3a1c, roughness: .6 })); mitt.castShadow = true; root.add(mitt);
  const phase = { k: 0 };
  const shoulder = (s) => torso.localToWorld(new THREE.Vector3(s * .78, 1.55, 0)).sub(root.position);
  const place = () => {
    root.updateMatrixWorld(true);
    const k = phase.k, lift = k > .15 && k < .62 ? Math.sin(((k - .15) / .47) * Math.PI) : 0;
    // legs: standing leg planted, the other kicks up in the windup
    const f0 = new THREE.Vector3(-.75, .45, .1), f1 = new THREE.Vector3(.75, .45 + lift * 1.7, .1 + (k > .62 ? (k - .62) * 3.2 : 0) + lift * .3);
    [f0, f1].forEach((f, i) => { const kn = joint(hips[i], f, 1.45, 1.4, new THREE.Vector3(0, 0, 1)); L[i].u(hips[i], kn); L[i].l(kn, f); shoes[i].position.set(f.x, f.y - .3, f.z - .2); });
    // throwing arm: sweeps down, back, up and over (phi), releasing forward
    const shR = root.worldToLocal(torso.localToWorld(new THREE.Vector3(.78, 1.55, 0)));
    const phi = k < .15 ? 0 : -1.5 * Math.PI * ((k - .15) / .85) * (1);
    const hand = shR.clone().add(new THREE.Vector3(.1, -Math.cos(phi) * 1.95, Math.sin(phi) * 1.95));
    armU(shR, joint(shR, hand, 1.05, 1.0, new THREE.Vector3(.8, .3, -.3))); const el = joint(shR, hand, 1.05, 1.0, new THREE.Vector3(.8, .3, -.3)); armF(el, hand);
    const shL = root.worldToLocal(torso.localToWorld(new THREE.Vector3(-.78, 1.55, 0))), gl = shL.clone().add(new THREE.Vector3(-.2 + lift * .2, -.5 + lift * .6, 1.5));
    const eL = joint(shL, gl, 1.05, 1.0, new THREE.Vector3(-.8, -.6, .2)); gloveU(shL, eL); gloveF(eL, gl); mitt.position.copy(gl).add(new THREE.Vector3(0, 0, .15));
    torso.rotation.y = k < .5 ? lerp(0, .35, k * 2) : lerp(.35, -.4, (k - .5) * 2); torso.rotation.x = k > .6 ? lerp(0, .45, (k - .6) / .4) : 0;
    api.hand = hand;
  };
  const api = {
    root, hand: new THREE.Vector3(),
    handWorld() { return root.localToWorld(api.hand.clone()); },
    pose(k) { phase.k = clamp(k, 0, 1); place(); },
    idle(t) { phase.k = 0; place(); },
  };
  place(); return api;
}
