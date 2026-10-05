import * as THREE from 'three';
import { toon, mk, canvasTex, glowSprite, setStyle, rand, pick, clamp, lerp } from '../util.js';

const sph = (r, w = 16, h = 12) => new THREE.SphereGeometry(r, w, h);
const cyl = (rt, rb, h, s = 16) => new THREE.CylinderGeometry(rt, rb, h, s);

/** A big, colorful ballpark (original design, no team logos). Home plate is at the origin; the pitcher is toward -Z. */
export function buildStadium(scene) {
  setStyle('candy');
  const S = { cheering: 0, wallR: 108 };

  // ---- sky ----
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 40, 20), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `varying vec3 vP; void main(){ float h = clamp(vP.y, 0., 1.); vec3 c = mix(vec3(.80,.92,1.), vec3(.30,.60,.98), pow(h,.55));
      vec3 s = normalize(vec3(.4,.5,-.8)); c += vec3(1.,.95,.7)*(pow(max(dot(normalize(vP),s),0.),300.)*2.5 + pow(max(dot(normalize(vP),s),0.),12.)*.25); gl_FragColor = vec4(c,1.); }`,
  }));
  scene.add(sky); S.sky = sky;
  S.clouds = [];
  for (let i = 0; i < 12; i++) { const c = new THREE.Group(); for (let k = 0; k < 5; k++) c.add(mk(sph(rand(6, 10)), toon(0xffffff), [k * 8 - 16, rand(-1, 2), rand(-2, 2)], [1.4, .8, 1])); c.position.set(rand(-250, 250), rand(60, 120), rand(-260, -80)); c.userData.noShadow = true; scene.add(c); S.clouds.push(c); }

  // ---- grass with mowing stripes, infield dirt, warning track ----
  const grassTex = canvasTex(256, 256, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#3fae4a' : '#4cc257'; g.fillRect(0, i * (h / 8), w, h / 8); } }, [1, 14]);
  const grass = mk(new THREE.CircleGeometry(190, 64).rotateX(-Math.PI / 2), toon(0xffffff, { map: grassTex, clearcoat: 0, roughness: .9 }), [0, -.02, -60]); grass.receiveShadow = true; scene.add(grass);
  const dirt = new THREE.MeshStandardMaterial({ color: 0xd9a066, roughness: 1 });
  const infield = new THREE.Mesh(new THREE.CircleGeometry(36, 48).rotateX(-Math.PI / 2), dirt); infield.position.set(0, 0, -19); infield.receiveShadow = true; scene.add(infield);
  const infGrass = new THREE.Mesh(new THREE.CircleGeometry(21, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x45bd52, roughness: .9 })); infGrass.position.set(0, .01, -26); scene.add(infGrass);
  const box = new THREE.Mesh(new THREE.CircleGeometry(8, 36).rotateX(-Math.PI / 2), dirt); box.position.set(0, .02, -.5); box.receiveShadow = true; scene.add(box);
  const track = new THREE.Mesh(new THREE.RingGeometry(S.wallR - 8, S.wallR, 96, 1, Math.PI * 1.15, Math.PI * .7).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xb98a55, roughness: 1, side: THREE.DoubleSide })); track.position.y = .02; scene.add(track);
  // mound, plate, bases, foul lines
  const mound = mk(cyl(3, 4.6, .6, 28), 0xd9a066, [0, .3, -16.5]); mound.receiveShadow = true; scene.add(mound, mk(new THREE.BoxGeometry(1.6, .12, .35), 0xffffff, [0, .66, -16.5]));
  const plate = mk(new THREE.CylinderGeometry(1, 1, .12, 5).rotateY(Math.PI / 2), 0xffffff, [0, .08, 0]); plate.scale.set(1, 1, 1); scene.add(plate);
  [[19, -19], [0, -38], [-19, -19]].forEach(([x, z]) => scene.add(mk(new THREE.BoxGeometry(1.5, .2, 1.5), 0xffffff, [x, .12, z])));
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  [-1, 1].forEach((s) => { const l = new THREE.Mesh(new THREE.PlaneGeometry(.35, 150).rotateX(-Math.PI / 2), lineMat); l.position.set(s * 53, .05, -75); l.rotation.y = s * Math.PI / 4; scene.add(l); });
  // batter's boxes + a glowing hit-zone ring on each side of the plate
  [-1, 1].forEach((s) => { const r = new THREE.Mesh(new THREE.RingGeometry(.42, .55, 30).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .0, depthWrite: false })); r.position.set(s * 1.0, .11, -.4); scene.add(r); (S.zones = S.zones || {})[s] = r; });

  // ---- outfield wall with ads ----
  const adTex = canvasTex(1024, 128, (g, w, h) => {
    g.fillStyle = '#17803a'; g.fillRect(0, 0, w, h);
    const ads = [['SLUGGER SNACKS', '#ffd84d', '#a02020'], ['BIG DOG HOT DOGS', '#ff7a2e', '#fff'], ['ICE POPS', '#5bc0ff', '#fff'], ['HOME RUN JUICE', '#ff5fa4', '#fff'], ['PLAY BALL!', '#fff', '#14234a']];
    ads.forEach(([t, bg, fg], i) => { g.fillStyle = bg; g.fillRect(i * 204 + 6, 10, 192, 108); g.fillStyle = fg; g.font = '700 28px Fredoka, Arial, sans-serif'; g.textAlign = 'center'; g.fillText(t, i * 204 + 102, 74, 180); });
  }, [3, 1]);
  const a0 = Math.PI * 1.15, aL = Math.PI * .7;
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(S.wallR, S.wallR, 7, 96, 1, true, a0 - Math.PI / 2 + Math.PI, aL), new THREE.MeshStandardMaterial({ map: adTex, side: THREE.DoubleSide, roughness: .6 })); wall.position.y = 3.5; scene.add(wall);
  const wcap = new THREE.Mesh(new THREE.TorusGeometry(S.wallR, .35, 8, 96, aL).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xffd84d })); wcap.rotation.z = a0 - Math.PI / 2 + Math.PI; wcap.position.y = 7; scene.add(wcap);
  [-1, 1].forEach((s) => { const pole = mk(cyl(.2, .2, 26, 8), 0xffd84d, [Math.sin(s * .86) * S.wallR * .97, 13, -Math.cos(s * .86) * S.wallR * .97]); scene.add(pole); });

  // ---- the stands: a slanted seating bowl, full of cheering fans ----
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x2a3f8f, side: THREE.DoubleSide, roughness: .8 });
  const tiers = [[S.wallR + 2, S.wallR + 22, 22], [S.wallR + 26, S.wallR + 46, 22], [S.wallR + 50, S.wallR + 70, 22]];
  const angStart = -Math.PI * .5 - 1.3, angLen = 2.6;
  tiers.forEach(([r0, r1], k) => {
    const h = 14 + k * 3;
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, h, 80, 1, true, Math.PI - 1.35 + 0, 2.7), seatMat); bowl.position.y = 7 + k * 17; scene.add(bowl);
  });
  // fans (instanced) placed on the slanted bowls
  const fanCount = 2600, fans = new THREE.InstancedMesh(sph(.7, 8, 6), toon(0xffffff), fanCount); fans.castShadow = false;
  const colors = [0xff5fa4, 0xffd84d, 0x5bc0ff, 0xff7a2e, 0xffffff, 0x7be37d, 0xb07cff, 0xff4d4d], d = new THREE.Object3D(), col = new THREE.Color();
  S.fans = [];
  for (let i = 0; i < fanCount; i++) {
    const k = Math.floor(Math.random() * 3), [r0, r1] = tiers[k], f = Math.random(), r = lerp(r0 + 1, r1 - 1, f), ang = Math.PI + rand(-1.3, 1.3), y = 7 + k * 17 + lerp(-6.5, 6.5, 1 - f) + 1;
    const x = Math.sin(ang) * r, z = Math.cos(ang) * r;
    d.position.set(x, y, z); d.scale.setScalar(rand(.9, 1.3)); d.updateMatrix(); fans.setMatrixAt(i, d.matrix); col.set(pick(colors)); fans.setColorAt(i, col);
    S.fans.push({ x, y, z, ph: rand(0, 6), s: d.scale.x });
  }
  fans.instanceColor.needsUpdate = true; scene.add(fans); S.fanMesh = fans;
  // light towers and a big scoreboard
  [[-95, -110], [95, -110], [-130, -40], [130, -40]].forEach(([x, z]) => {
    scene.add(mk(cyl(1.2, 1.8, 70, 10), 0x9aa4b8, [x, 35, z]));
    const panel = mk(new THREE.BoxGeometry(22, 10, 1.4), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff6c8).multiplyScalar(2.2) }), [x, 74, z]); panel.lookAt(0, 74, 0); scene.add(panel);
    const gl = glowSprite(0xfff0b0, 60, .35); gl.position.set(x, 74, z); scene.add(gl);
  });
  const sbCanvas = document.createElement('canvas'); sbCanvas.width = 1024; sbCanvas.height = 384; const sbTex = new THREE.CanvasTexture(sbCanvas); sbTex.colorSpace = THREE.SRGBColorSpace;
  const board = new THREE.Mesh(new THREE.PlaneGeometry(52, 19.5), new THREE.MeshBasicMaterial({ map: sbTex })); board.position.set(0, 30, -S.wallR - 12); scene.add(board);
  scene.add(mk(new THREE.BoxGeometry(56, 23, 1.5), 0x1d2a66, [0, 30, -S.wallR - 12.9]));
  S.setScore = (hr, outs, name) => {
    const g = sbCanvas.getContext('2d'); g.fillStyle = '#0c1a3c'; g.fillRect(0, 0, 1024, 384);
    g.fillStyle = '#ffd84d'; g.font = '700 70px Fredoka, Arial, sans-serif'; g.textAlign = 'center'; g.fillText('HOME RUN DERBY', 512, 90);
    g.fillStyle = '#fff'; g.font = '700 52px Fredoka, Arial, sans-serif'; g.fillText(((name || 'Tony') + "'S").toUpperCase(), 512, 160);
    g.fillStyle = '#7bff9a'; g.font = '700 120px Fredoka, Arial, sans-serif'; g.fillText(`HR ${hr}`, 300, 300);
    g.fillStyle = '#ff6a6a'; g.fillText(`${'●'.repeat(outs)}${'○'.repeat(3 - outs)}`, 760, 290);
    g.fillStyle = '#fff'; g.font = '700 40px Fredoka, Arial, sans-serif'; g.fillText('OUTS', 760, 340); sbTex.needsUpdate = true;
  };
  S.setScore(0, 0);

  // ---- lights ----
  scene.add(new THREE.HemisphereLight(0xdff0ff, 0x6a9a5a, 1.1));
  const sun = new THREE.DirectionalLight(0xfff2d8, 2.2); sun.position.set(25, 50, 20); sun.castShadow = true;
  const c = sun.shadow.camera; c.left = c.bottom = -28; c.right = c.top = 28; c.near = 1; c.far = 140; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -.0005; sun.shadow.normalBias = .05; sun.shadow.radius = 3;
  sun.target.position.set(0, 0, -10); scene.add(sun, sun.target); S.sun = sun;

  const dummy = new THREE.Object3D();
  S.update = (dt, t) => {
    S.clouds.forEach((cl) => { cl.position.x += dt * 1.2; if (cl.position.x > 280) cl.position.x = -280; });
    if (S.cheering > 0) {                                               // fans bounce when the crowd is going wild
      S.cheering -= dt; const amp = Math.min(1, S.cheering), fm = S.fanMesh;
      S.fans.forEach((f, i) => { dummy.position.set(f.x, f.y + Math.abs(Math.sin(t * 9 + f.ph)) * 1.4 * amp, f.z); dummy.scale.setScalar(f.s); dummy.updateMatrix(); fm.setMatrixAt(i, dummy.matrix); });
      fm.instanceMatrix.needsUpdate = true;
    }
  };
  S.cheer = (sec = 3) => { S.cheering = sec; };
  setStyle('toon');
  return S;
}
