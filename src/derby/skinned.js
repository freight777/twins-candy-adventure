import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { canvasTex, clamp } from '../util.js';

// A real skinned human body (Quaternius "Universal Animation Library" mannequin, CC0), dressed in a uniform and posed from the
// motion-capture joint positions. Each frame every bone is aimed at its captured child joint ("aim retargeting").

export async function loadMannequin(base = '/') {
  const gltf = await new GLTFLoader().loadAsync(`${base}assets/derby/char/AnimationLibrary_Godot_Standard.gltf`);
  gltf.scene.updateMatrixWorld(true);
  return gltf.scene;
}

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const tmpQ = new THREE.Quaternion(), tmpQ2 = new THREE.Quaternion();

/** which part of the uniform each bone belongs to: colour + whether it gets pinstripes */
function region(name, o) {
  const n = name.replace('DEF-', '');
  if (/^(head|neck)$/.test(n)) return [o.skin, 0];
  if (/^(f_|thumb|hand)/.test(n)) return [o.hands, 0];
  if (/^forearm/.test(n)) return [o.forearm, 0];
  if (/^upper_arm/.test(n)) return [o.sleeve, 0];
  if (/^(thigh|shin)/.test(n)) return [o.pants, o.stripes ? 1 : 0];
  if (/^(foot|toe)/.test(n)) return [o.shoes, 0];
  return [o.jersey, o.stripes ? 1 : 0];                  // hips, spine, shoulders
}

export function createSkinnedRig(template, o) {
  const root = new THREE.Group(), holder = new THREE.Group(), model = cloneSkinned(template); holder.add(model); root.add(holder);
  const B = {}; model.traverse((x) => { if (x.isBone) B[x.name] = x; });
  const gb = (n) => B[n.replace(/[.\[\]/:]/g, '')];
  const meshes = []; model.traverse((x) => { if (x.isSkinnedMesh) { meshes.push(x); x.castShadow = true; x.receiveShadow = false; x.frustumCulled = false; } });
  holder.updateMatrixWorld(true);
  const hipsRest = new THREE.Vector3(); gb('DEF-hips').getWorldPosition(hipsRest);
  const s = 2.75 / hipsRest.y; holder.scale.setScalar(s); root.updateMatrixWorld(true);
  const rest = {}; Object.values(B).forEach((b) => (rest[b.name] = { q: b.quaternion.clone(), p: b.position.clone() }));

  // ---- paint the uniform: per-vertex colour by the bone that moves each vertex most; pinstripes where flagged ----
  const col = (c) => new THREE.Color(c);
  const palette = { skin: col(o.skin), hands: col(o.hands), forearm: col(o.forearm), sleeve: col(o.sleeve), pants: col(o.pants), shoes: col(o.shoes), jersey: col(o.jersey), stripes: o.stripes };
  const regionBB = { head: new THREE.Box3(), spine: new THREE.Box3() };
  meshes.forEach((m) => {
    m.geometry = m.geometry.clone();                     // each player paints their own copy (the clone shares geometry otherwise)
    const g = m.geometry, pos = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, bones = m.skeleton.bones;
    const colors = new Float32Array(pos.count * 3), stripe = new Float32Array(pos.count), v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      let bi = si.getX(i), bw = sw.getX(i);
      for (let k = 1; k < 4; k++) { const w = [sw.getX(i), sw.getY(i), sw.getZ(i), sw.getW(i)][k]; if (w > bw) { bw = w; bi = [si.getX(i), si.getY(i), si.getZ(i), si.getW(i)][k]; } }
      const nm = bones[bi].name, [c, st] = region(nm, palette);
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b; stripe[i] = st;
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
      if (nm === 'DEF-head') regionBB.head.expandByPoint(v); else if (/spine00[23]/.test(nm)) regionBB.spine.expandByPoint(v);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3)); g.setAttribute('stripe', new THREE.BufferAttribute(stripe, 1));
    const mat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: .85, sheen: .25, sheenRoughness: .8, sheenColor: new THREE.Color(0x888888), clearcoat: 0 });
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float stripe; varying float vStripe; varying float vBX;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvStripe = stripe; vBX = position.x;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vStripe; varying float vBX;').replace('#include <color_fragment>', '#include <color_fragment>\nfloat st = vStripe * step(.8, fract(vBX*17.)); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.07,.12,.26), st*.9);');
    };
    mat.customProgramCacheKey = () => 'skinstripe';
    m.material = mat;
  });

  // ---- accessories fixed to bones: cap/helmet, eyes, name + number on the back (placed at rest, so they follow the bone) ----
  const attach = (bone, obj, pos, quat = new THREE.Quaternion()) => {
    const world = new THREE.Matrix4().compose(pos, quat, V(1, 1, 1)); bone.updateWorldMatrix(true, false);
    const local = new THREE.Matrix4().copy(bone.matrixWorld).invert().multiply(world); local.decompose(obj.position, obj.quaternion, obj.scale); bone.add(obj);
  };
  const hc = regionBB.head.getCenter(V()), hs = regionBB.head.getSize(V()), hr = Math.max(hs.x, hs.z) * .5;
  const capMat = new THREE.MeshPhysicalMaterial({ color: o.cap, roughness: .85, sheen: .3, sheenColor: new THREE.Color(o.cap) });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(hr * 1.08, 28, 20, 0, Math.PI * 2, 0, Math.PI * .56), capMat); dome.castShadow = true;
  attach(gb('DEF-head'), dome, V(hc.x, hc.y + hs.y * .06, hc.z - hr * .06));
  if (o.bill) { const bill = new THREE.Mesh(new THREE.CylinderGeometry(hr * 1.02, hr * 1.02, hr * .1, 24, 1, false, 0, Math.PI), capMat); bill.scale.set(1, 1, 1.5); bill.castShadow = true; attach(gb('DEF-head'), bill, V(hc.x, hc.y + hs.y * .12, hc.z + hr * .1), new THREE.Quaternion().setFromEuler(new THREE.Euler(.3, 0, 0))); }
  if (o.earFlap) { const f = new THREE.Mesh(new THREE.SphereGeometry(hr * .42, 14, 10), capMat); f.scale.set(.5, 1, .9); attach(gb('DEF-head'), f, V(hc.x + hr * .98, hc.y - hs.y * .04, hc.z)); }
  [-1, 1].forEach((sd) => { const e = new THREE.Mesh(new THREE.SphereGeometry(hr * .085, 12, 8), new THREE.MeshStandardMaterial({ color: 0x1a1210, roughness: .3 })); attach(gb('DEF-head'), e, V(hc.x + sd * hr * .36, hc.y + hs.y * .02, regionBB.head.max.z - hr * .02)); });
  const nose = new THREE.Mesh(new THREE.SphereGeometry(hr * .12, 12, 8), new THREE.MeshPhysicalMaterial({ color: o.skin, roughness: .55 })); attach(gb('DEF-head'), nose, V(hc.x, hc.y - hs.y * .1, regionBB.head.max.z + hr * .01));
  if (o.back) {
    const sc = regionBB.spine.getCenter(V()), plate = new THREE.Mesh(new THREE.PlaneGeometry(.95, 1.25), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, side: THREE.DoubleSide, map: canvasTex(256, 330, (g, w, h) => { g.fillStyle = '#10203f'; g.textAlign = 'center'; g.font = '700 46px Arial, sans-serif'; g.fillText(o.back.name.slice(0, 8), w / 2, 70); g.font = '700 190px Arial, sans-serif'; g.fillText(o.back.number, w / 2, 262); }) }));
    attach(gb('DEF-spine.003'), plate, V(sc.x, sc.y + .15, regionBB.spine.min.z - .03), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, 0)));
  }

  // ---- posing: copy the captured limb directions and body orientation, so differences in body proportions do not matter ----
  const tw = (p) => root.localToWorld(p.clone());
  const wp = (b) => b.getWorldPosition(V()), wq = (b) => b.getWorldQuaternion(new THREE.Quaternion());
  function setWorldQ(bone, q) { bone.updateWorldMatrix(true, false); const pq = bone.parent.getWorldQuaternion(new THREE.Quaternion()); bone.quaternion.copy(pq.invert().multiply(q)); bone.updateMatrixWorld(true); }
  const applyWorld = (bone, q) => setWorldQ(bone, q.clone().multiply(wq(bone)));
  function aimDir(bone, child, dir) {
    bone.updateWorldMatrix(true, true); const cur = wp(child).sub(wp(bone)); if (cur.lengthSq() < 1e-8 || dir.lengthSq() < 1e-8) return;
    applyWorld(bone, new THREE.Quaternion().setFromUnitVectors(cur.normalize(), dir.clone().normalize()));
  }
  // an orientation from a "left" direction and an "up" direction (forward = left x up, matching a body that faces +Z at rest)
  const basisQ = (left, up) => { const u = up.clone().normalize(), l = left.clone().sub(u.clone().multiplyScalar(left.dot(u))).normalize(), f = l.clone().cross(u); return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(l, u, f)); };
  const restWQ = {}; Object.values(B).forEach((b) => (restWQ[b.name] = wq(b)));
  const restUp = wp(gb('DEF-neck')).sub(wp(gb('DEF-hips'))), restChestUp = wp(gb('DEF-spine.003')).sub(wp(gb('DEF-hips')));
  const restH = basisQ(wp(gb('DEF-thigh.L')).sub(wp(gb('DEF-thigh.R'))), restChestUp), restS = basisQ(wp(gb('DEF-upper_arm.L')).sub(wp(gb('DEF-upper_arm.R'))), restUp);
  const curl = o.curl ?? 0;
  const fingers = Object.values(B).filter((b) => /f_(index|middle|ring|pinky)0[123]/.test(b.name)), thumbs = Object.values(B).filter((b) => /thumb0[123]/.test(b.name));
  const rig = {
    root, skinned: true, B, hs, hc, meshes, gb, wp,
    drive(F, headYaw = 0) {
      Object.values(B).forEach((b) => { b.quaternion.copy(rest[b.name].q); b.position.copy(rest[b.name].p); });
      root.updateMatrixWorld(true);
      const hips = gb('DEF-hips'); hips.parent.updateWorldMatrix(true, false); hips.position.copy(hips.parent.worldToLocal(tw(F.hips))); hips.updateMatrixWorld(true);
      // hips and spine take the captured body orientation
      const up = F.neck.clone().sub(F.hips), sp = gb('DEF-spine.001');
      setWorldQ(hips, basisQ(F.lhip.clone().sub(F.rhip), F.chest.clone().sub(F.hips)).multiply(restH.clone().invert()).multiply(restWQ[hips.name]));
      setWorldQ(sp, basisQ(F.lsh.clone().sub(F.rsh), up).multiply(restS.clone().invert()).multiply(restWQ[sp.name]));
      // neck and head (the face keeps looking where headYaw says)
      aimDir(gb('DEF-neck'), gb('DEF-head'), F.head.clone().sub(F.neck));
      const head = gb('DEF-head'), fw = V(0, 0, 1).applyQuaternion(wq(head)); fw.y = 0; fw.normalize();
      const des = V(-Math.sin(headYaw), 0, -Math.cos(headYaw)); let dy = Math.atan2(fw.x * des.z - fw.z * des.x, fw.x * des.x + fw.z * des.z); dy = clamp(dy, -1.2, 1.2);
      applyWorld(head, new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), -dy));
      // arms and legs follow the captured bone directions
      [['L', F.lsh, F.lel, F.lwr, F.lfin, F.lknee, F.lankle, F.ltoe, F.lhip], ['R', F.rsh, F.rel, F.rwr, F.rfin, F.rknee, F.rankle, F.rtoe, F.rhip]].forEach(([k, sh, el, wr, fin, kn, an, to, hp]) => {
        aimDir(gb(`DEF-shoulder.${k}`), gb(`DEF-upper_arm.${k}`), sh.clone().sub(F.neck));
        aimDir(gb(`DEF-upper_arm.${k}`), gb(`DEF-forearm.${k}`), el.clone().sub(sh));
        aimDir(gb(`DEF-forearm.${k}`), gb(`DEF-hand.${k}`), wr.clone().sub(el));
        aimDir(gb(`DEF-hand.${k}`), gb(`DEF-f_middle.01.${k}`), fin.clone().sub(wr));
        aimDir(gb(`DEF-thigh.${k}`), gb(`DEF-shin.${k}`), kn.clone().sub(hp));
        aimDir(gb(`DEF-shin.${k}`), gb(`DEF-foot.${k}`), an.clone().sub(kn));
        aimDir(gb(`DEF-foot.${k}`), gb(`DEF-toe.${k}`), to.clone().sub(an));
      });
      if (curl) { fingers.forEach((f) => { f.rotation.x += curl; }); thumbs.forEach((f) => { f.rotation.x += curl * .5; }); }
      root.updateMatrixWorld(true);
      // keep the feet on the ground whatever the proportions
      const toeY = Math.min(wp(gb('DEF-toe.L')).y, wp(gb('DEF-toe.R')).y), want = root.getWorldPosition(V()).y + .1, shift = want - toeY;
      if (Math.abs(shift) < 1.5) { hips.position.y += shift / holder.scale.x; root.updateMatrixWorld(true); }
      return { L: root.worldToLocal(wp(gb('DEF-hand.L'))), R: root.worldToLocal(wp(gb('DEF-hand.R'))) };
    },
  };
  return rig;
}
