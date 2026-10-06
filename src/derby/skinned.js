import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { canvasTex, clamp } from '../util.js';

// A real skinned human body (Quaternius "Universal Base Characters" Superhero Male, CC0), dressed in a baseball uniform made of
// real cloth geometry (a smoothed, thickened shell grown off the body) and posed from motion-capture joint positions.
// Each frame every bone is aimed at its captured child joint ("aim retargeting").

export async function loadBody(base = '/') {
  const gltf = await new GLTFLoader().loadAsync(`${base}assets/derby/char/ubc/male.gltf`);
  gltf.scene.userData.kind = 'ubc';
  gltf.scene.updateMatrixWorld(true);
  return gltf.scene;
}

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const tmpQ = new THREE.Quaternion();
const SKIN_AVG = new THREE.Color().setRGB(169.5 / 255, 118.4 / 255, 82.1 / 255, THREE.SRGBColorSpace);      // average colour of the body texture's skin
const clean = (n) => n.replace(/[.\[\]/:]/g, '');

/** our canonical bone names (the mannequin's, without dots) -> the Universal Base Characters' names */
const UBC = (() => {
  const m = { 'DEF-hips': 'pelvis', 'DEF-spine001': 'spine_01', 'DEF-spine002': 'spine_02', 'DEF-spine003': 'spine_03', 'DEF-neck': 'neck_01', 'DEF-head': 'Head' };
  for (const [K, l] of [['L', 'l'], ['R', 'r']]) {
    Object.assign(m, { [`DEF-shoulder${K}`]: `clavicle_${l}`, [`DEF-upper_arm${K}`]: `upperarm_${l}`, [`DEF-forearm${K}`]: `lowerarm_${l}`, [`DEF-hand${K}`]: `hand_${l}`, [`DEF-thigh${K}`]: `thigh_${l}`, [`DEF-shin${K}`]: `calf_${l}`, [`DEF-foot${K}`]: `foot_${l}`, [`DEF-toe${K}`]: `ball_${l}` });
    for (const f of ['index', 'middle', 'ring', 'pinky']) for (const n of [1, 2, 3]) m[`DEF-f_${f}0${n}${K}`] = `${f}_0${n}_${l}`;
    for (const n of [1, 2, 3]) m[`DEF-thumb0${n}${K}`] = `thumb_0${n}_${l}`;
  }
  return m;
})();
const UBC_INV = Object.fromEntries(Object.entries(UBC).map(([c, u]) => [u, c]));

export function createSkinnedRig(template, o) {
  const ubc = template.userData.kind === 'ubc';
  const root = new THREE.Group(), holder = new THREE.Group(), model = cloneSkinned(template); holder.add(model); root.add(holder);
  const B = {}; model.traverse((x) => { if (x.isBone) B[x.name] = x; });
  const gb = (n) => { const c = clean(n); return B[ubc ? UBC[c] : c]; };       // bone by canonical name
  const canonOf = (name) => (ubc ? UBC_INV[name] || name : name);
  const meshes = []; model.traverse((x) => { if (x.isSkinnedMesh) { meshes.push(x); x.castShadow = true; x.receiveShadow = true; x.frustumCulled = false; } });
  const bodies = meshes.filter((m) => !/^(Eyes|Eyebrows)$/.test(m.name));
  holder.updateMatrixWorld(true);
  // rest positions in the model's own units (metres), before scaling
  const R = {}; Object.values(B).forEach((b) => (R[b.name] = b.getWorldPosition(V())));
  const bp = (c) => R[ubc ? UBC[clean(c)] : clean(c)] || V();
  const s = 2.75 / bp('DEF-hips').y; holder.scale.setScalar(s); root.updateMatrixWorld(true);
  const rest = {}; Object.values(B).forEach((b) => (rest[b.name] = { q: b.quaternion.clone(), p: b.position.clone() }));
  const wp = (b, out = V()) => b.getWorldPosition(out), wq = (b, out = new THREE.Quaternion()) => b.getWorldQuaternion(out);
  const restWQ = {}, restWQinv = {}; Object.values(B).forEach((b) => { restWQ[b.name] = wq(b); restWQinv[b.name] = restWQ[b.name].clone().invert(); });

  // ---- skin: the body's texture, re-tinted to any skin tone ----
  const skinTarget = new THREE.Color(o.skin), tint = new THREE.Color(skinTarget.r / SKIN_AVG.r, skinTarget.g / SKIN_AVG.g, skinTarget.b / SKIN_AVG.b);
  const regionBB = { head: new THREE.Box3(), spine: new THREE.Box3() }, minY = { v: 1e9 };
  const dom = (g, i) => { const si = g.attributes.skinIndex, sw = g.attributes.skinWeight; let bi = si.getX(i), bw = sw.getX(i); for (let k = 1; k < 4; k++) { const w = [sw.getX(i), sw.getY(i), sw.getZ(i), sw.getW(i)][k]; if (w > bw) { bw = w; bi = [si.getX(i), si.getY(i), si.getZ(i), si.getW(i)][k]; } } return bi; };
  const domName = new Map();                                     // mesh -> per-vertex canonical bone name
  bodies.forEach((m) => {
    const g = m.geometry, pos = g.attributes.position, bones = m.skeleton.bones, v = V(), names = new Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      const nm = canonOf(bones[dom(g, i)].name); names[i] = nm; v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
      if (nm === 'DEF-head') regionBB.head.expandByPoint(v); else if (/spine00[23]/.test(nm)) regionBB.spine.expandByPoint(v);
      minY.v = Math.min(minY.v, v.y);
    }
    domName.set(m, names);
    if (ubc) {
      const old = m.material, mat = new THREE.MeshPhysicalMaterial({ map: old.map, normalMap: old.normalMap, normalScale: new THREE.Vector2(.8, .8), roughnessMap: old.roughnessMap, roughness: 1, metalness: 0, color: tint, sheen: .35, sheenRoughness: .6, sheenColor: new THREE.Color(0xd8a890) });
      if (mat.map) mat.map.anisotropy = 8;
      m.material = mat;
    } else m.material = new THREE.MeshPhysicalMaterial({ color: o.skin, roughness: .6, sheen: .3 });
  });
  meshes.filter((m) => m.name === 'Eyebrows').forEach((m) => { m.material = new THREE.MeshStandardMaterial({ color: o.hair ?? 0x14100e, roughness: .85 }); });
  meshes.filter((m) => m.name === 'Eyes').forEach((m) => { m.material.roughness = .12; m.material.envMapIntensity = 1.4; });

  // ---- the uniform: cloth shell grown off the body ----
  const col = (c) => new THREE.Color(c);
  const PAL = { guard: col(o.guard ?? 0x16171b), collar: col(o.under ?? o.forearm), sole: col(o.sole ?? 0xdcd8d0), jersey: col(o.jersey), sleeve: col(o.jersey), pants: col(o.pants), under: col(o.under ?? o.forearm), sock: col(o.sock ?? o.pants), shoe: col(o.shoes), glove: col(o.glove ?? 0x1a1a1e), strap: col(o.strap ?? 0xf0f0ea), belt: col(o.belt ?? 0x14161c) };
  const OFF = { guard: .021, collar: .034, sole: .02, jersey: .034, sleeve: .02, belt: .04, pants: .034, under: .013, sock: .013, shoe: .02, glove: .009, strap: .013 };
  const beltY = bp('DEF-hips').y + (bp('DEF-spine001').y - bp('DEF-hips').y) * .62, kneeY = bp('DEF-shinL').y, hemY = kneeY - (bp('DEF-thighL').y - kneeY) * .3, shoeTop = bp('DEF-footL').y + .04, collarY = bp('DEF-neck').y - .052, soleY = bp('DEF-toeL').y - .005;
  const NONE = [0, 0, 0, 0];
  const torsoAxis = [0, bp('DEF-spine001').z, o.stripes ? 54 : 0, 0];
  const legAxis = (x) => [x, bp('DEF-thighL').z, o.stripes ? 30 : 0, 0];
  const armAxis = (K) => [bp(`DEF-upper_arm${K}`).y, bp(`DEF-upper_arm${K}`).z, o.stripes ? 15 : 0, 1];
  const LIMB = { upper_arm: 'forearm', forearm: 'hand', thigh: 'shin', shin: 'foot', hand: 'f_middle01' };
  const alongLimb = (n, p) => {                                  // 0..1 down the limb the vertex belongs to
    const base = n.replace(/[LR]$/, ''), side = n.slice(-1), child = LIMB[base]; if (!child) return 0;
    const a = bp(`DEF-${base}${side}`), b = bp(`DEF-${child}${side}`), ab = b.clone().sub(a);
    return clamp(p.clone().sub(a).dot(ab) / Math.max(1e-6, ab.lengthSq()), 0, 1);
  };
  /** which garment (if any) covers a vertex: [kind, stripe axis] */
  const garment = (cn, p) => {
    const n = cn.replace('DEF-', ''), side = /[LR]$/.test(n) ? n.slice(-1) : '', t = alongLimb(n, p);
    if (/^(head|neck)/.test(n)) return null;
    if (/^(f_|thumb|hand)/.test(n)) return o.gloves ? [/^hand/.test(n) && t < .3 ? 'strap' : 'glove', NONE] : null;
    if (/^forearm/.test(n)) return [o.elbowGuard && side === 'R' && t < .34 ? 'guard' : 'under', NONE];
    if (/^upper_arm/.test(n)) return t < .62 ? ['sleeve', armAxis(side)] : [o.elbowGuard && side === 'R' && t > .8 ? 'guard' : 'under', NONE];
    if (/^shoulder/.test(n)) return ['sleeve', armAxis(side)];
    if (/^thigh/.test(n)) return ['pants', legAxis(bp(`DEF-thigh${side}`).x)];
    if (/^shin/.test(n)) return p.y > hemY ? ['pants', legAxis(bp(`DEF-thigh${side}`).x)] : p.y > shoeTop ? ['sock', NONE] : ['shoe', NONE];
    if (/^(foot|toe)/.test(n)) return [p.y < soleY ? 'sole' : 'shoe', NONE];
    if (p.y < beltY - .022) return ['pants', legAxis(p.x >= 0 ? bp('DEF-thighL').x : bp('DEF-thighR').x)];
    if (p.y < beltY + .022) return ['belt', NONE];
    return [p.y > collarY ? 'collar' : 'jersey', p.y > collarY ? NONE : torsoAxis];
  };
  const ux = Math.abs(bp('DEF-upper_armL').x), fx = Math.abs(bp('DEF-forearmL').x), hx0 = Math.abs(bp('DEF-handL').x), mx = Math.abs(bp('DEF-f_middle01L').x);
  const sleeveX = ux + .62 * (fx - ux), guardA = ux + .8 * (fx - ux), guardB = fx + .34 * (hx0 - fx), strapX = hx0 + .3 * (mx - hx0);
  const FAM = { collar: 0, sole: 0, jersey: 0, belt: 0, pants: 0, sock: 0, shoe: 0, sleeve: 1, under: 1, guard: 1, strap: 2, glove: 2 };     // 0 = body (coloured by height), 1 = arm (by distance out along the arm), 2 = hand
  const SU = {
    uJersey: { value: PAL.jersey }, uPants: { value: PAL.pants }, uUnder: { value: PAL.under }, uSock: { value: PAL.sock }, uShoe: { value: PAL.shoe }, uSole: { value: PAL.sole }, uBelt: { value: PAL.belt }, uCollar: { value: PAL.collar }, uGuard: { value: PAL.guard }, uGlove: { value: PAL.glove }, uStrap: { value: PAL.strap },
    uY: { value: new THREE.Vector4(beltY, collarY, hemY, shoeTop) }, uY2: { value: new THREE.Vector4(soleY, sleeveX, strapX, o.elbowGuard ? 1 : 0) }, uG: { value: new THREE.Vector4(guardA, guardB, hx0, o.gloves ? 1 : 0) },
  };
  const shellMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: .9, specularIntensity: .4, sheen: .3, sheenRoughness: .6, sheenColor: new THREE.Color(0xffffff), side: THREE.DoubleSide });
  shellMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, SU);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 aSt; attribute float aFam; flat varying vec4 vSt; flat varying float vFam; varying vec3 vRP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvSt = aSt; vFam = aFam; vRP = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n#ifdef USE_SHEEN\nmaterial.sheenColor = clamp(diffuseColor.rgb * .9 + .05, 0., 1.);       // fabric sheen takes the fabric colour (dark cloth stays dark)\n#endif').replace('#include <common>', '#include <common>\nflat varying vec4 vSt; flat varying float vFam; varying vec3 vRP;\nuniform vec3 uJersey, uPants, uUnder, uSock, uShoe, uSole, uBelt, uCollar, uGuard, uGlove, uStrap; uniform vec4 uY, uY2, uG;').replace('#include <color_fragment>', `#include <color_fragment>
      float sOK = 0.; vec3 rc;
      if (vFam < .5) { float y = vRP.y; if (y > uY.y) rc = uCollar; else if (y > uY.x + .022) { rc = uJersey; sOK = 1.; } else if (y > uY.x - .022) rc = uBelt; else if (y > uY.z) { rc = uPants; sOK = 1.; } else if (y > uY.w) rc = uSock; else if (y > uY2.x) rc = uShoe; else rc = uSole; }
      else { float x = abs(vRP.x); if (x < uY2.y) { rc = uJersey; sOK = 1.; } else if (uG.w > .5 && x > uG.z) rc = x < uY2.z ? uStrap : uGlove; else rc = (uY2.w > .5 && vRP.x < 0. && x > uG.x && x < uG.y) ? uGuard : uUnder; }
      diffuseColor.rgb = rc * vColor.rgb;                    // the vertex colour now only carries the baked occlusion
      if (vSt.z > .5 && sOK > .5) {                                   // pinstripes: evenly spaced lines around a torso / leg / arm axis, anti-aliased
        vec2 q = vSt.w < .5 ? vRP.xz - vSt.xy : vRP.yz - vSt.xy; float r = max(length(q), 1e-4); vec2 dir = q / r;
        float u = atan(dir.x, dir.y) / 6.2831853 * vSt.z, du = length(fwidth(dir)) * vSt.z / 6.2831853;
        float ln = 1. - smoothstep(.07, .07 + du * 1.3, abs(fract(u) - .5));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.09,.13,.25), ln * .8);
      }`);
  };
  shellMat.customProgramCacheKey = () => 'uniformShell';
  const shells = [];
  bodies.forEach((m) => {
    const g = m.geometry, pos = g.attributes.position, nrm = g.attributes.normal, n = pos.count, names = domName.get(m), v = V();
    const info = new Array(n);
    for (let i = 0; i < n; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld).multiplyScalar(1 / s); info[i] = garment(names[i], v); }   // metres, rest pose
    const idx = g.index ? g.index.array : null, nt = (idx ? idx.length : n) / 3, tris = [];
    for (let t = 0; t < nt; t++) { const a = idx ? idx[t * 3] : t * 3, b = idx ? idx[t * 3 + 1] : t * 3 + 1, c = idx ? idx[t * 3 + 2] : t * 3 + 2; if (info[a] && info[b] && info[c]) tris.push(a, b, c); }
    if (!tris.length) return;
    // weld duplicate vertices (UV seams) so smoothing moves both copies together
    const key = new Map(), grp = new Int32Array(n).fill(-1), members = [], used = new Uint8Array(n); tris.forEach((i) => (used[i] = 1));
    for (let i = 0; i < n; i++) { if (!used[i]) continue; const k = `${Math.round(pos.getX(i) * 3000)},${Math.round(pos.getY(i) * 3000)},${Math.round(pos.getZ(i) * 3000)}`; let gi = key.get(k); if (gi === undefined) { gi = members.length; key.set(k, gi); members.push([]); } grp[i] = gi; members[gi].push(i); }
    const G = members.length, P = new Float32Array(G * 3), P0 = new Float32Array(G * 3), N0 = new Float32Array(G * 3), nbr = Array.from({ length: G }, () => new Set()), edge = new Map();
    members.forEach((mem, gi) => { const i = mem[0]; P[gi * 3] = P0[gi * 3] = pos.getX(i); P[gi * 3 + 1] = P0[gi * 3 + 1] = pos.getY(i); P[gi * 3 + 2] = P0[gi * 3 + 2] = pos.getZ(i); mem.forEach((j) => { N0[gi * 3] += nrm.getX(j); N0[gi * 3 + 1] += nrm.getY(j); N0[gi * 3 + 2] += nrm.getZ(j); }); });
    for (let t = 0; t < tris.length; t += 3) for (let e = 0; e < 3; e++) { const a = grp[tris[t + e]], b = grp[tris[t + (e + 1) % 3]]; if (a === b) continue; nbr[a].add(b); nbr[b].add(a); const k = a < b ? `${a}_${b}` : `${b}_${a}`; edge.set(k, (edge.get(k) || 0) + 1); }
    const border = new Uint8Array(G); edge.forEach((c, k) => { if (c === 1) { const [a, b] = k.split('_').map(Number); border[a] = border[b] = 1; } });
    const nbrA = nbr.map((st) => [...st]);
    // baked ambient occlusion: where the surface is dented (armpits, waist, behind the knees, under the chin) the cloth is darker
    const A1 = new Float32Array(G * 3), A2 = new Float32Array(G * 3), ao = new Float32Array(G).fill(1);
    const blur = (src, dst) => { for (let gi = 0; gi < G; gi++) { const nb = nbrA[gi]; if (!nb.length) { dst[gi * 3] = src[gi * 3]; dst[gi * 3 + 1] = src[gi * 3 + 1]; dst[gi * 3 + 2] = src[gi * 3 + 2]; continue; } let x = 0, y = 0, z = 0; nb.forEach((j) => { x += src[j * 3]; y += src[j * 3 + 1]; z += src[j * 3 + 2]; }); dst[gi * 3] = x / nb.length; dst[gi * 3 + 1] = y / nb.length; dst[gi * 3 + 2] = z / nb.length; } };
    blur(P0, A1); blur(A1, A2);
    for (let gi = 0; gi < G; gi++) { const nl = Math.hypot(N0[gi * 3], N0[gi * 3 + 1], N0[gi * 3 + 2]) || 1, cv = ((A2[gi * 3] - P0[gi * 3]) * N0[gi * 3] + (A2[gi * 3 + 1] - P0[gi * 3 + 1]) * N0[gi * 3 + 1] + (A2[gi * 3 + 2] - P0[gi * 3 + 2]) * N0[gi * 3 + 2]) / nl; ao[gi] = 1 - Math.min(1, Math.max(0, cv / .028)) * .5; }
    for (let it = 0; it < 12; it++) {                            // Taubin smoothing: rounds off the muscle detail without shrinking the body
      const lam = it % 2 ? -.53 : .5, Q = new Float32Array(P);
      for (let gi = 0; gi < G; gi++) { if (border[gi] || !nbrA[gi].length) continue; let ax = 0, ay = 0, az = 0; nbrA[gi].forEach((j) => { ax += P[j * 3]; ay += P[j * 3 + 1]; az += P[j * 3 + 2]; }); const k = nbrA[gi].length; Q[gi * 3] = P[gi * 3] + lam * (ax / k - P[gi * 3]); Q[gi * 3 + 1] = P[gi * 3 + 1] + lam * (ay / k - P[gi * 3 + 1]); Q[gi * 3 + 2] = P[gi * 3 + 2] + lam * (az / k - P[gi * 3 + 2]); }
      P.set(Q);
    }
    const Ns = new Float32Array(G * 3), a = V(), b = V(), c = V(), e1 = V(), e2 = V();
    for (let t = 0; t < tris.length; t += 3) { const ga = grp[tris[t]], gb2 = grp[tris[t + 1]], gc = grp[tris[t + 2]]; a.fromArray(P, ga * 3); b.fromArray(P, gb2 * 3); c.fromArray(P, gc * 3); e1.subVectors(b, a); e2.subVectors(c, a); e1.cross(e2); [ga, gb2, gc].forEach((gi) => { Ns[gi * 3] += e1.x; Ns[gi * 3 + 1] += e1.y; Ns[gi * 3 + 2] += e1.z; }); }
    const outP = new Float32Array(pos.array), outN = new Float32Array(nrm.array), colors = new Float32Array(n * 3), fam = new Float32Array(n), st = new Float32Array(n * 4), nv = V(), n0 = V(), q = V(), p0 = V();
    members.forEach((mem, gi) => {
      const [kind, ax] = info[mem[0]], d = OFF[kind], c0 = PAL[kind];
      n0.set(N0[gi * 3], N0[gi * 3 + 1], N0[gi * 3 + 2]).normalize(); nv.set(Ns[gi * 3], Ns[gi * 3 + 1], Ns[gi * 3 + 2]).normalize().multiplyScalar(.75).addScaledVector(n0, .25).normalize();
      q.set(P[gi * 3], P[gi * 3 + 1], P[gi * 3 + 2]).addScaledVector(nv, d); p0.set(P0[gi * 3], P0[gi * 3 + 1], P0[gi * 3 + 2]);
      const have = q.clone().sub(p0).dot(n0); if (have < d * .6) q.addScaledVector(n0, d * .6 - have);      // never sink into the skin
      mem.forEach((i) => { outP[i * 3] = q.x; outP[i * 3 + 1] = q.y; outP[i * 3 + 2] = q.z; outN[i * 3] = nv.x; outN[i * 3 + 1] = nv.y; outN[i * 3 + 2] = nv.z; colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = ao[gi]; fam[i] = FAM[kind]; st[i * 4] = ax[0]; st[i * 4 + 1] = ax[1]; st[i * 4 + 2] = ax[2]; st[i * 4 + 3] = ax[3]; });
    });
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(outP, 3)); sg.setAttribute('normal', new THREE.BufferAttribute(outN, 3));
    sg.setAttribute('skinIndex', g.attributes.skinIndex); sg.setAttribute('skinWeight', g.attributes.skinWeight);
    sg.setAttribute('color', new THREE.BufferAttribute(colors, 3)); sg.setAttribute('aSt', new THREE.BufferAttribute(st, 4)); sg.setAttribute('aFam', new THREE.BufferAttribute(fam, 1));
    sg.setIndex(new THREE.BufferAttribute(n > 65535 ? new Uint32Array(tris) : new Uint16Array(tris), 1));
    const shell = new THREE.SkinnedMesh(sg, shellMat); shell.name = "Uniform"; shell.castShadow = true; shell.receiveShadow = true; shell.frustumCulled = false;
    shell.position.copy(m.position); shell.quaternion.copy(m.quaternion); shell.scale.copy(m.scale);
    m.parent.add(shell); shell.bind(m.skeleton, m.bindMatrix); shell.updateMatrixWorld(true); shells.push(shell);
  });
  shells.forEach((sh) => meshes.push(sh));

  // ---- accessories fixed to bones: cap/helmet, hair, name + number on the back (placed at rest, so they follow the bone) ----
  const attach = (bone, obj, pos, quat = new THREE.Quaternion()) => {
    const world = new THREE.Matrix4().compose(pos, quat, obj.scale.clone()); bone.updateWorldMatrix(true, false);
    const local = new THREE.Matrix4().copy(bone.matrixWorld).invert().multiply(world); local.decompose(obj.position, obj.quaternion, obj.scale); bone.add(obj);
  };
  const hc = regionBB.head.getCenter(V()), hs = regionBB.head.getSize(V()), headBone = gb('DEF-head');
  const eyeBB = new THREE.Box3(); meshes.filter((m) => m.name === 'Eyes').forEach((m) => eyeBB.expandByObject(m, true));
  const eyeY = eyeBB.isEmpty() ? hc.y : eyeBB.getCenter(V()).y, hx = hs.x / 2, hz = hs.z / 2;
  const capMat = o.helmet ? new THREE.MeshPhysicalMaterial({ color: o.cap, roughness: .42, clearcoat: .5, clearcoatRoughness: .32, envMapIntensity: .5 }) : new THREE.MeshPhysicalMaterial({ color: o.cap, roughness: .9, sheen: .25, sheenRoughness: .7, sheenColor: new THREE.Color(o.cap) });
  // hair under the cap (short and dark), then the cap itself with its brim above the brows so the eyes stay clear
  const hairMat = new THREE.MeshStandardMaterial({ color: o.hair ?? 0x14100e, roughness: .9 });
  const top = regionBB.head.max.y, cy = hc.y + hs.y * .08, ry = top + .03 - cy, rimY = eyeY + hs.y * .2, thR = Math.acos(clamp((rimY - cy) / ry, -.95, .95)), cz = hc.z - hz * .02, rz = hz * 1.05;
  const hair = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18, Math.PI + .12, Math.PI - .24, thR - .3, 1.2), hairMat); hair.scale.set(hx * 1.075, ry * 1.02, hz * 1.0); hair.castShadow = true;
  attach(headBone, hair, V(hc.x, cy, cz));
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 36, 24, 0, Math.PI * 2, 0, thR), capMat); dome.scale.set(hx * 1.09, ry * 1.04, rz * 1.04); dome.castShadow = true;
  attach(headBone, dome, V(hc.x, cy, cz), new THREE.Quaternion().setFromEuler(new THREE.Euler(-.06, 0, 0)));
  if (o.bill) {                                                   // curved bill
    const w = hx * 1.04, d = hz * (o.helmet ? .5 : .8), shp = new THREE.Shape(); shp.moveTo(-w, 0); for (let i = 0; i <= 24; i++) { const a = Math.PI - (i / 24) * Math.PI; shp.lineTo(Math.cos(a) * w, Math.sin(a) * d); } shp.closePath();
    const bg = new THREE.ExtrudeGeometry(shp, { depth: hs.y * .03, bevelEnabled: false, curveSegments: 1 });
    const bpos = bg.attributes.position; for (let i = 0; i < bpos.count; i++) { const x = bpos.getX(i), y = bpos.getY(i); bpos.setZ(i, bpos.getZ(i) + (x * x) / (w * w) * hs.y * .12 + (y / d) * hs.y * .04); }
    bg.computeVertexNormals(); bg.rotateX(Math.PI / 2);        // lie flat, pointing forward (+Z)
    const bill = new THREE.Mesh(bg, capMat); bill.castShadow = true;
    attach(headBone, bill, V(hc.x, rimY - hs.y * .01, cz + rz * Math.sin(thR) * 1.02 - hs.z * .04), new THREE.Quaternion().setFromEuler(new THREE.Euler(.16, 0, 0)));
  }
  if (o.earFlap) {                                                // batting helmet: one ear flap, on the side that faces the pitcher
    const flap = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 14, Math.PI - .75, 1.5, 1.2, 1.15), capMat); flap.scale.set(hx * 1.12, hs.y * .5, hz * 1.04); flap.castShadow = true;
    attach(headBone, flap, V(hc.x, eyeY, cz));
  }
  if (o.back) {
    // Name + number as a decal skinned onto the jersey itself: every vertex of the plate is projected onto the real back surface
    // (a ray from behind) and takes that surface's bone weights, so it bends with the torso instead of floating off it.
    const sc = regionBB.spine.getCenter(V()), PW = .7, PH = .9, NX = 12, NY = 16, cy2 = sc.y - .1, z0 = regionBB.spine.min.z - 3;
    const cand = meshes.map((m) => {
      m.updateMatrixWorld(true);
      const g = m.geometry, n = g.attributes.position.count, w = [], idx = g.index ? g.index.array : null, nt = (idx ? idx.length : n) / 3, tris = [];
      for (let i = 0; i < n; i++) w.push(m.getVertexPosition(i, V()).applyMatrix4(m.matrixWorld));
      for (let t = 0; t < nt; t++) {
        const i0 = idx ? idx[t * 3] : t * 3, i1 = idx ? idx[t * 3 + 1] : t * 3 + 1, i2 = idx ? idx[t * 3 + 2] : t * 3 + 2, p = [w[i0], w[i1], w[i2]];
        if (p.some((q) => Math.abs(q.x - sc.x) < PW / 2 + .4 && Math.abs(q.y - cy2) < PH / 2 + .4 && q.z < sc.z + .3)) tris.push([i0, i1, i2, ...p]);
      }
      return tris.map((t) => [...t, m]);
    }).flat();
    const ray = new THREE.Ray(V(), V(0, 0, 1)), tmp = V(), bary = V();
    const cast = (list, x, y) => {
      ray.origin.set(x, y, z0); let bt = Infinity, best = null;
      for (const tr of list) { const r = ray.intersectTriangle(tr[3], tr[4], tr[5], false, tmp); if (r) { const t = r.z - z0; if (t < bt) { bt = t; best = { tr, point: r.clone() }; } } }
      return best;
    };
    if (cand.length) {
      const base = bodies[0], list = cand;
      const pg = new THREE.PlaneGeometry(PW, PH, NX, NY), np = pg.attributes.position.count, pa = pg.attributes.position;
      const P = new Float32Array(np * 3), N = new Float32Array(np * 3), SI = new Uint8Array(np * 4), SW = new Float32Array(np * 4), got = new Array(np).fill(false);
      const inv = new THREE.Matrix4().copy(base.matrixWorld).invert(), nl = V(), pw = V(), acc = new Map();
      for (let i = 0; i < np; i++) {
        const hit = cast(list, sc.x - pa.getX(i), cy2 + pa.getY(i)); if (!hit) continue;
        const [i0, i1, i2, A, Bq, C, hm] = hit.tr, hg = hm.geometry, si = hg.attributes.skinIndex, sw = hg.attributes.skinWeight, nr = hg.attributes.normal; THREE.Triangle.getBarycoord(hit.point, A, Bq, C, bary);
        const ids = [i0, i1, i2], bw = [bary.x, bary.y, bary.z]; nl.set(0, 0, 0); acc.clear();
        ids.forEach((vi, k) => {
          nl.x += nr.getX(vi) * bw[k]; nl.y += nr.getY(vi) * bw[k]; nl.z += nr.getZ(vi) * bw[k];
          for (let c = 0; c < 4; c++) { const wgt = [sw.getX(vi), sw.getY(vi), sw.getZ(vi), sw.getW(vi)][c], bi = [si.getX(vi), si.getY(vi), si.getZ(vi), si.getW(vi)][c]; if (wgt > 0) acc.set(bi, (acc.get(bi) || 0) + wgt * bw[k]); }
        });
        nl.normalize();
        pw.copy(hit.point).addScaledVector(nl.clone().transformDirection(hm.matrixWorld), .012).applyMatrix4(inv);   // a hair off the cloth
        P.set([pw.x, pw.y, pw.z], i * 3); N.set([nl.x, nl.y, nl.z], i * 3);
        const top2 = [...acc.entries()].sort((p, q) => q[1] - p[1]).slice(0, 4), tot = top2.reduce((u, e) => u + e[1], 0) || 1;
        top2.forEach(([bi, wgt], c) => { SI[i * 4 + c] = bi; SW[i * 4 + c] = wgt / tot; });
        got[i] = true;
      }
      for (let i = 0; i < np; i++) {                           // vertices whose ray missed copy their nearest neighbour that hit
        if (got[i]) continue; let j = -1, bd = Infinity;
        for (let k = 0; k < np; k++) if (got[k]) { const d = (pa.getX(k) - pa.getX(i)) ** 2 + (pa.getY(k) - pa.getY(i)) ** 2; if (d < bd) { bd = d; j = k; } }
        if (j >= 0) { for (let c = 0; c < 3; c++) { P[i * 3 + c] = P[j * 3 + c]; N[i * 3 + c] = N[j * 3 + c]; } for (let c = 0; c < 4; c++) { SI[i * 4 + c] = SI[j * 4 + c]; SW[i * 4 + c] = SW[j * 4 + c]; } }
      }
      pg.setAttribute('position', new THREE.BufferAttribute(P, 3)); pg.setAttribute('normal', new THREE.BufferAttribute(N, 3));
      pg.setAttribute('skinIndex', new THREE.BufferAttribute(SI, 4)); pg.setAttribute('skinWeight', new THREE.BufferAttribute(SW, 4));
      const tex = canvasTex(256, 330, (c, w, h) => {
        c.textAlign = 'center'; c.lineJoin = 'round'; c.strokeStyle = '#ffffff'; c.fillStyle = '#10203f';
        const put = (txt, font, y, lw) => { c.font = font; c.lineWidth = lw; c.strokeText(txt, w / 2, y); c.fillText(txt, w / 2, y); };   // white edge so it reads over the pinstripes
        put(o.back.name.slice(0, 8), '800 58px Arial, sans-serif', 72, 9); put(o.back.number, '800 215px Arial, sans-serif', 292, 16);
      });
      const plate = new THREE.SkinnedMesh(pg, new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: .85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
      plate.position.copy(base.position); plate.quaternion.copy(base.quaternion); plate.scale.copy(base.scale); plate.frustumCulled = false;
      base.parent.add(plate); plate.bind(base.skeleton, base.bindMatrix); plate.updateMatrixWorld(true);
    }
  }

  // ---- posing: copy the captured limb directions and body orientation, so differences in body proportions do not matter ----
  // (this runs every frame for both players, so it reuses scratch objects instead of allocating ~200 per pose)
  const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _qc = new THREE.Quaternion(), _qd = new THREE.Quaternion(), _qe = new THREE.Quaternion(), _qf = new THREE.Quaternion();
  const _va = V(), _vb = V(), _vc = V(), _vd = V(), _ve = V(), _vf = V(), _vg = V(), _vt = V(), _dir = V(), _up = V(), _lf = V(), _m4 = new THREE.Matrix4(), Y = V(0, 1, 0);
  const tw = (p) => root.localToWorld(_vt.copy(p));
  function setWorldQ(bone, q) { bone.parent.getWorldQuaternion(_qa); bone.quaternion.copy(_qa.invert().multiply(q)); bone.updateMatrixWorld(true); }
  const applyWorld = (bone, q) => setWorldQ(bone, _qb.copy(q).multiply(wq(bone, _qc)));
  function aimDir(bone, child, dir) {
    const cur = wp(child, _va).sub(wp(bone, _vb)); if (cur.lengthSq() < 1e-8 || dir.lengthSq() < 1e-8) return;     // (getWorldPosition refreshes the parent chain itself)
    applyWorld(bone, _qd.setFromUnitVectors(cur.normalize(), _vc.copy(dir).normalize()));
  }
  // an orientation from a "left" direction and an "up" direction (forward = left x up, matching a body that faces +Z at rest)
  const basisQ = (left, up, out = new THREE.Quaternion()) => { const u = _vd.copy(up).normalize(), l = _ve.copy(left).addScaledVector(u, -left.dot(u)).normalize(), f = _vg.copy(l).cross(u); return out.setFromRotationMatrix(_m4.makeBasis(l, u, f)); };
  const restUp = wp(gb('DEF-neck')).sub(wp(gb('DEF-hips'))), restChestUp = wp(gb('DEF-spine.003')).sub(wp(gb('DEF-hips')));
  const restH = basisQ(wp(gb('DEF-thigh.L')).sub(wp(gb('DEF-thigh.R'))), restChestUp), restS = basisQ(wp(gb('DEF-upper_arm.L')).sub(wp(gb('DEF-upper_arm.R'))), restUp);
  const restHinv = restH.clone().invert(), restSinv = restS.clone().invert(), boneList = Object.values(B);
  const limbs = ['L', 'R'].map((k) => {
    const l = k.toLowerCase(), b = (n) => gb(`DEF-${n}.${k}`);
    return { shoulder: b('shoulder'), upper: b('upper_arm'), fore: b('forearm'), hand: b('hand'), mid: b('f_middle.01'), thigh: b('thigh'), shin: b('shin'), foot: b('foot'), toe: b('toe'),
      sh: l + 'sh', el: l + 'el', wr: l + 'wr', fin: l + 'fin', kn: l + 'knee', an: l + 'ankle', to: l + 'toe', hp: l + 'hip' };
  });
  const hipsB = gb('DEF-hips'), spineB = gb('DEF-spine.001'), neckB = gb('DEF-neck'), headB = gb('DEF-head');
  const res = { L: V(), R: V(), gL: V(), gR: V() };          // drive() fills and returns this same object every frame
  const curl = o.curl ?? 0;
  // fingers curl toward the palm (palms face down in the rest pose): the curl axis is found from each finger's own direction
  const curlers = [];
  Object.keys(ubc ? UBC : B).filter((c) => /f_(index|middle|ring|pinky)0[123]|thumb0[123]/.test(c)).forEach((c) => {
    const b = gb(c); if (!b) return; const child = b.children.find((x) => x.isBone); if (!child) return;
    const d = wp(child).sub(wp(b)).normalize(), axisW = d.clone().cross(V(0, -1, 0)).normalize(), axisL = axisW.applyQuaternion(restWQ[b.name].clone().invert());
    curlers.push({ b, axis: axisL, k: /thumb/.test(c) ? .55 : 1 });
  });
  const toeH = (bp('DEF-toeL').y - minY.v / s + OFF.shoe) * s;
  const rig = {
    root, skinned: true, B, hs, hc, meshes, gb, wp,
    /** how far a hand has turned from its rest orientation, in the rig's own space (to orient things held in it) */
    handQ(K, out = new THREE.Quaternion()) { const b = limbs[K === 'L' ? 0 : 1].hand; root.getWorldQuaternion(out).invert(); return out.multiply(wq(b, _qf).multiply(restWQinv[b.name])); },
    drive(F, headYaw = 0) {
      for (const b of boneList) { const r = rest[b.name]; b.quaternion.copy(r.q); b.position.copy(r.p); }
      root.updateMatrixWorld(true);
      const hips = hipsB; hips.parent.updateWorldMatrix(true, false); hips.position.copy(hips.parent.worldToLocal(tw(F.hips))); hips.updateMatrixWorld(true);
      // hips and spine take the captured body orientation
      _up.subVectors(F.neck, F.hips);
      setWorldQ(hips, basisQ(_lf.subVectors(F.lhip, F.rhip), _dir.subVectors(F.chest, F.hips), _qe).multiply(restHinv).multiply(restWQ[hips.name]));
      setWorldQ(spineB, basisQ(_lf.subVectors(F.lsh, F.rsh), _up, _qe).multiply(restSinv).multiply(restWQ[spineB.name]));
      // neck and head (the face keeps looking where headYaw says)
      aimDir(neckB, headB, _dir.subVectors(F.head, F.neck));
      const fw = _vf.set(0, 0, 1).applyQuaternion(wq(headB, _qf).multiply(restWQinv[headB.name])); fw.y = 0; fw.normalize();
      const dx = -Math.sin(headYaw), dz = -Math.cos(headYaw); let dy = Math.atan2(fw.x * dz - fw.z * dx, fw.x * dx + fw.z * dz); dy = clamp(dy, -1.2, 1.2);
      applyWorld(headB, _qe.setFromAxisAngle(Y, -dy));
      // arms and legs follow the captured bone directions
      for (const L of limbs) {
        aimDir(L.shoulder, L.upper, _dir.subVectors(F[L.sh], F.neck));
        aimDir(L.upper, L.fore, _dir.subVectors(F[L.el], F[L.sh]));
        aimDir(L.fore, L.hand, _dir.subVectors(F[L.wr], F[L.el]));
        aimDir(L.hand, L.mid, _dir.subVectors(F[L.fin], F[L.wr]));
        aimDir(L.thigh, L.shin, _dir.subVectors(F[L.kn], F[L.hp]));
        aimDir(L.shin, L.foot, _dir.subVectors(F[L.an], F[L.kn]));
        aimDir(L.foot, L.toe, _dir.subVectors(F[L.to], F[L.an]));
      }
      if (curl) for (const c of curlers) c.b.quaternion.multiply(tmpQ.setFromAxisAngle(c.axis, curl * c.k));
      root.updateMatrixWorld(true);
      // keep the feet on the ground whatever the proportions
      const toeY = Math.min(wp(limbs[0].toe, _va).y, wp(limbs[1].toe, _vb).y), want = root.getWorldPosition(_vc).y + toeH, shift = want - toeY;
      if (Math.abs(shift) < 1.5) { hips.position.y += shift / holder.scale.x; root.updateMatrixWorld(true); }
      // the grip: between the palm and the middle finger, a touch off the palm
      const grip = (L, out) => { const c = wp(L.hand, _va).lerp(wp(L.mid, _vb), .55), pn = _vc.set(0, -1, 0).applyQuaternion(wq(L.hand, _qf).multiply(restWQinv[L.hand.name])); return root.worldToLocal(out.copy(c).addScaledVector(pn, .055 * s)); };
      root.worldToLocal(wp(limbs[0].hand, res.L)); root.worldToLocal(wp(limbs[1].hand, res.R)); grip(limbs[0], res.gL); grip(limbs[1], res.gR);
      return res;
    },
  };
  return rig;
}
