import * as THREE from 'three';
import { toon, mk, canvasTex, setStyle, getStyle, clamp, lerp } from '../util.js';

const sph = (r, w = 20, h = 14) => new THREE.SphereGeometry(r, w, h);
const cyl = (rt, rb, h, s = 16) => new THREE.CylinderGeometry(rt, rb, h, s);
const stripeTex = (base, line) => canvasTex(128, 128, (g, w, h) => { g.fillStyle = base; g.fillRect(0, 0, w, h); g.fillStyle = line; for (let x = 6; x < w; x += 16) g.fillRect(x, 0, 3, h); }, [2, 2]);

/** a limb between two moving points (so the arms can follow the bat) */
function limb(parent, r, color) {
  const m = mk(cyl(r, r * .9, 1, 12), color); m.geometry.translate(0, .5, 0); parent.add(m);
  return (a, b) => { m.position.copy(a); const d = b.clone().sub(a), len = d.length(); m.scale.set(1, len, 1); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); };
}

/** An original big slugger in navy pinstripes (not any real player). Faces -Z (toward the pitcher). Bat swings around his hands. */
export function createBatter(name = 'ANTHONY', number = '99') {
  const prev = getStyle(); setStyle('candy');
  const root = new THREE.Group(), skin = 0xe8b48a, navy = 0x14234a;
  const jersey = toon(0xffffff, { map: stripeTex('#ffffff', '#14234a') });
  root.add(mk(cyl(.36, .3, 1.7), jersey, [-.4, .95, 0]), mk(cyl(.36, .3, 1.7), jersey, [.4, .95, 0]));
  [-.4, .4].forEach((x) => root.add(mk(sph(.38, 14, 10), navy, [x, .12, -.12], [1, .6, 1.5])));
  const torso = new THREE.Group(); torso.position.set(0, 2.2, 0); root.add(torso);
  torso.add(mk(new THREE.CapsuleGeometry(.62, .95, 10, 20), jersey, [0, .15, 0], [1.2, 1, .75]), mk(new THREE.TorusGeometry(.7, .09, 8, 24), navy, [0, -.5, 0]).rotateX(Math.PI / 2));
  torso.add(mk(cyl(.2, .26, .3), skin, [0, 1.15, 0]));
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.4), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, map: canvasTex(256, 320, (g, w, h) => { g.fillStyle = '#14234a'; g.font = '700 54px Fredoka, sans-serif'; g.textAlign = 'center'; g.fillText(name.slice(0, 8), w / 2, 70); g.font = '700 190px Fredoka, sans-serif'; g.fillText(number, w / 2, 250); }) }));
  plate.position.set(0, .2, .5); torso.add(plate);
  const head = new THREE.Group(); head.position.set(0, 1.75, 0); torso.add(head);
  head.add(mk(sph(.52, 20, 14), skin));
  head.add(mk(new THREE.SphereGeometry(.57, 20, 14, 0, Math.PI * 2, 0, Math.PI * .56), navy, [0, .04, 0]), mk(new THREE.CylinderGeometry(.5, .5, .08, 20, 1, false, 0, Math.PI), navy, [0, .12, -.52], [1, 1, 1]).rotateY(Math.PI));
  head.add(mk(new THREE.TorusGeometry(.18, .04, 8, 16, Math.PI).rotateZ(Math.PI), 0x7a3a2a, [0, -.18, -.5]), mk(sph(.07, 8, 6), 0x1a1a2a, [-.18, .05, -.46]), mk(sph(.07, 8, 6), 0x1a1a2a, [.18, .05, -.46]));
  // bat + hands
  const pivot = new THREE.Group(); pivot.position.set(.9, 2.55, -.35); root.add(pivot);
  const bat = new THREE.Group(); pivot.add(bat);
  bat.add(mk(cyl(.07, .07, .9), 0x3a2a1a, [.1, 0, 0]).rotateZ(Math.PI / 2));
  const barrel = mk(cyl(.22, .1, 2.9, 16), toon(0xd9a45c, { clearcoat: .6 }), [2.0, 0, 0]); barrel.rotation.z = -Math.PI / 2; bat.add(barrel);
  bat.add(mk(sph(.1, 10, 8), 0x3a2a1a, [-.35, 0, 0]));
  const hands = mk(sph(.22, 12, 8), skin, [.05, 0, 0]); bat.add(hands);
  const armL = limb(root, .2, jersey), armR = limb(root, .2, jersey);
  const sh = (s) => new THREE.Vector3(s * .95, 3.2, 0);
  let swingK = 0, swinging = false;
  const api = {
    root, pivot, bat, head,
    reset() { swinging = false; pivot.rotation.set(0, -1.55, .35); },
    /** play the swing; `theta` = where the bat crosses the plate; resolves a callback at contact */
    swing(theta, onContact, dur = .26) {
      swinging = true; const t0 = -1.55, t1 = theta + 1.2; let t = 0, hit = false;
      api._anim = (dt) => {
        t += dt; const k = clamp(t / dur, 0, 1), e = k * k * (3 - 2 * k);
        pivot.rotation.y = lerp(t0, t1, e); pivot.rotation.z = lerp(.35, -.15, e); torso.rotation.y = -.5 * Math.sin(e * Math.PI * .5) + .15;
        if (!hit && k >= .46) { hit = true; onContact && onContact(); }
        if (k >= 1) api._anim = null;
      };
    },
    update(dt, t) {
      if (api._anim) api._anim(dt); else if (!swinging) { pivot.rotation.y = -1.55 + Math.sin(t * 2) * .05; torso.rotation.y = Math.sin(t * 1.4) * .04; }
      pivot.updateMatrixWorld(true); const hp = pivot.position.clone();
      armL(sh(-1).setZ(0).add(torso.position.clone().setX(0).setY(0)), hp); armR(sh(1).add(torso.position.clone().setX(0).setY(0)).setY(3.2), hp);
    },
    unswing() { swinging = false; api._anim = null; api.reset(); },
  };
  api.reset(); setStyle(prev);
  return api;
}

/** an original pitcher in a gray-and-red uniform. Faces +Z (toward home plate). */
export function createPitcher() {
  const prev = getStyle(); setStyle('candy');
  const root = new THREE.Group(), skin = 0xc98e66, gray = 0xdfe3ea, red = 0xc8283a;
  const legs = [-.3, .3].map((x) => { const l = new THREE.Group(); l.position.set(x, 1.5, 0); root.add(l); l.add(mk(cyl(.3, .26, 1.5), gray, [0, -.75, 0]), mk(sph(.3, 12, 8), 0x222, [0, -1.5, .12], [1, .6, 1.4])); return l; });
  const torso = new THREE.Group(); torso.position.set(0, 1.5, 0); root.add(torso);
  torso.add(mk(new THREE.CapsuleGeometry(.55, .8, 10, 16), gray, [0, 1, 0], [1.15, 1, .75]), mk(new THREE.TorusGeometry(.62, .08, 8, 20), red, [0, .4, 0]).rotateX(Math.PI / 2));
  torso.add(mk(sph(.46, 18, 12), skin, [0, 2.3, 0]), mk(new THREE.SphereGeometry(.5, 18, 12, 0, Math.PI * 2, 0, Math.PI * .55), red, [0, 2.36, 0]), mk(cyl(.5, .5, .06, 18), red, [0, 2.38, .42]));
  [-.1, .1].forEach((x) => torso.add(mk(sph(.06, 8, 6), 0x1a1a2a, [x * 1.8, 2.34, .4])));
  const armG = new THREE.Group(); armG.position.set(.8, 1.7, 0); torso.add(armG); armG.add(mk(new THREE.CapsuleGeometry(.17, 1.1, 8, 12), gray, [0, -.7, 0]), mk(sph(.2, 12, 8), skin, [0, -1.45, 0]));
  const glove = mk(sph(.32, 12, 8), 0x7a4a2a, [-.9, 1.1, .5]); torso.add(glove, mk(new THREE.CapsuleGeometry(.17, .8, 8, 12), gray, [-.8, 1.2, .2]).rotateX(.6));
  const handPos = () => armG.localToWorld(new THREE.Vector3(0, -1.45, 0));
  setStyle(prev);
  return {
    root, handPos, glove,
    /** t in seconds: 0..1.0 windup, release at 1.0 */
    pose(t) {
      const k = clamp(t / 1.0, 0, 1);
      armG.rotation.x = k < .6 ? lerp(0, -2.6, k / .6) : lerp(-2.6, 1.1, (k - .6) / .4);                // arm up and back, then whips forward
      legs[0].rotation.x = k < .5 ? lerp(0, -.9, k / .5) : lerp(-.9, .2, (k - .5) / .5);
      torso.rotation.x = k < .5 ? 0 : lerp(0, .35, (k - .5) / .5); torso.rotation.y = k < .5 ? lerp(0, -.3, k * 2) : lerp(-.3, .2, (k - .5) / .5);
    },
    idle(t) { armG.rotation.x = Math.sin(t * 1.5) * .05; legs[0].rotation.x = 0; torso.rotation.x = 0; torso.rotation.y = 0; },
  };
}
