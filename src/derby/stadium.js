import * as THREE from 'three';
import { canvasTex, glowSprite, rand, pick, lerp } from '../util.js';

const sph = (r, w = 12, h = 8) => new THREE.SphereGeometry(r, w, h);
const mat = (o) => new THREE.MeshStandardMaterial({ roughness: .9, ...o });

/** A big-league ballpark in a realistic style (generic design, no team logos). Home plate is the origin; the mound is toward -Z. */
export function buildStadium(scene, T = {}) {
  const S = { cheering: 0, wallR: 112 };

  // ---- sky: photographic gradient, haze at the horizon, soft thin clouds ----
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 40, 20), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `varying vec3 vP; void main(){ vec3 d = normalize(vP); float h = clamp(d.y, 0., 1.);
      vec3 c = mix(vec3(.86,.90,.95), vec3(.20,.42,.82), pow(h,.5)); c = mix(c, vec3(.96,.88,.78), pow(1.-h, 6.)*.6);
      vec3 s = normalize(vec3(.45,.32,-.8)); float sd = max(dot(d,s),0.); c += vec3(1.,.82,.55)*(pow(sd,400.)*3. + pow(sd,18.)*.45);
      gl_FragColor = vec4(c,1.); }`,
  }));
  scene.add(sky); S.sky = sky;
  const cloudTex = canvasTex(256, 128, (g, w, h) => { for (let i = 0; i < 40; i++) { const x = 40 + Math.random() * 176, y = 40 + Math.random() * 48, r = 20 + Math.random() * 34, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); } });
  S.clouds = [];
  for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(rand(160, 300), rand(50, 90)), new THREE.MeshBasicMaterial({ map: cloudTex, transparent: true, depthWrite: false, fog: false, opacity: rand(.6, .95) })); m.position.set(rand(-380, 380), rand(110, 220), rand(-420, -150)); m.rotation.x = -.35; scene.add(m); S.clouds.push(m); }

  // ---- ground: mowed grass, raked dirt, warning track, chalk ----
  const noise = (g, w, h, n, a) => { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * a})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); g.fillStyle = `rgba(255,255,255,${Math.random() * a * .6})`; g.fillRect(Math.random() * w, Math.random() * h, 1, 3); } };
  const grassTex = canvasTex(512, 512, (g, w, h) => { const bands = 8; for (let i = 0; i < bands; i++) { g.fillStyle = i % 2 ? '#2f6e32' : '#3b8038'; g.fillRect(0, i * (h / bands), w, h / bands + 1); } noise(g, w, h, 14000, .12); }, [1, 16]);
  grassTex.anisotropy = 8;
  // photographic PBR surfaces (ambientCG, CC0): colour + normal + roughness maps, tiled
  const DIRT_TINT = 0xd89a68;
  const pbr = (t, rx, ry, extra = {}) => { const set = (x) => { const c = x.clone(); c.wrapS = c.wrapT = THREE.RepeatWrapping; c.repeat.set(rx, ry); c.anisotropy = 8; c.needsUpdate = true; return c; }; return new THREE.MeshStandardMaterial({ map: set(t.c), normalMap: set(t.n), roughnessMap: set(t.r), roughness: 1, ...extra }); };
  const mow = (m) => {          // mowing stripes: alternate bands of lighter and darker turf
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix*vec4(transformed,1.)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= mix(.78, 1.08, step(.5, fract(vWP.z/9.)));');
    };
    m.customProgramCacheKey = () => 'mow'; return m;
  };
  const grassMat = T.grass ? mow(pbr(T.grass, 150, 150, { color: 0xe4f2d0 })) : null;
  const grass = new THREE.Mesh(new THREE.CircleGeometry(220, 64).rotateX(-Math.PI / 2), grassMat || mat({ map: grassTex })); grass.position.set(0, -.02, -60); grass.receiveShadow = true; scene.add(grass);
  const dirtTex = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#b57b4a'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(80,40,10,.18)'; g.lineWidth = 2; for (let y = 0; y < h; y += 9) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y + Math.random() * 4); g.stroke(); } noise(g, w, h, 6000, .25); }, [6, 6]);
  const dirt = T.dirt ? pbr(T.dirt, 4, 4, { color: DIRT_TINT }) : mat({ map: dirtTex, roughness: 1 });
  // infield: bases at the corners of a 90-ft diamond. Dirt base paths form the diamond's edges, the inside is grass,
  // and there is dirt around home, the mound and each base (second base sits in the dirt too).
  const dirtShapeTex = dirtTex.clone(); dirtShapeTex.repeat.set(1 / 7, 1 / 7); dirtShapeTex.needsUpdate = true;
  const dirtFlat = T.dirt ? pbr(T.dirt, .2, .2, { color: DIRT_TINT }) : mat({ map: dirtShapeTex, roughness: 1 });
  const dirtBase = T.dirt ? pbr(T.dirt, 2, 2, { color: DIRT_TINT }) : dirtFlat;
  const diamond = (half, cs) => { const pts = [[0, cs - half], [half, cs], [0, cs + half], [-half, cs]]; const sh = new THREE.Shape(); pts.forEach(([x, y], i) => sh[i ? 'lineTo' : 'moveTo'](x, y)); sh.closePath(); return sh; };
  const ringShape = diamond(19 + 4.4, 19); ringShape.holes.push(diamond(19 - 5, 19));
  const ring = new THREE.Mesh(new THREE.ShapeGeometry(ringShape).rotateX(-Math.PI / 2), dirtFlat); ring.position.y = .015; ring.receiveShadow = true; scene.add(ring);
  [[19, -19], [0, -38], [-19, -19]].forEach(([x, z]) => { const c = new THREE.Mesh(new THREE.CircleGeometry(4.6, 36).rotateX(-Math.PI / 2), dirtBase); c.position.set(x, .016, z); c.receiveShadow = true; scene.add(c); });
  const home = new THREE.Mesh(new THREE.CircleGeometry(9, 40).rotateX(-Math.PI / 2), dirt); home.position.set(0, .02, -.3); home.receiveShadow = true; scene.add(home);
  const track = new THREE.Mesh(new THREE.RingGeometry(S.wallR - 9, S.wallR, 96, 1, Math.PI * .1, Math.PI * .8).rotateX(-Math.PI / 2), mat({ color: 0x9a5f3a, side: THREE.DoubleSide })); track.position.y = .02; scene.add(track);
  const mound = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 5, .7, 32), dirt); mound.position.set(0, .35, -16.5); mound.receiveShadow = true; scene.add(mound);
  const rubber = new THREE.Mesh(new THREE.BoxGeometry(1.8, .1, .4), mat({ color: 0xf2f2f2 })); rubber.position.set(0, .75, -16.5); scene.add(rubber);
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, .1, 5), mat({ color: 0xf4f4f4, roughness: .6 })); plate.position.set(0, .07, 0); scene.add(plate);
  [[19, -19], [0, -38], [-19, -19]].forEach(([x, z]) => { const b = new THREE.Mesh(new THREE.BoxGeometry(1.6, .22, 1.6), mat({ color: 0xf4f4f4 })); b.position.set(x, .12, z); b.castShadow = true; scene.add(b); });
  const chalk = new THREE.MeshBasicMaterial({ color: 0xf2f2f2 });
  [-1, 1].forEach((s) => { const l = new THREE.Mesh(new THREE.PlaneGeometry(.35, S.wallR).rotateX(-Math.PI / 2), chalk); l.position.set(s * S.wallR * .3536, .06, -S.wallR * .3536); l.rotation.y = -s * Math.PI / 4; scene.add(l); });
  [-1, 1].forEach((s) => { const cx = s * 3.2, w = 3.3, d = 6.2, t = .14; [[0, -d / 2, w, t], [0, d / 2, w, t], [-w / 2, 0, t, d], [w / 2, 0, t, d]].forEach(([x, z, sx, sz]) => { const e = new THREE.Mesh(new THREE.PlaneGeometry(sx, sz).rotateX(-Math.PI / 2), chalk); e.position.set(cx + x, .05, z); scene.add(e); }); });
  S.zones = {};
  [-1, 1].forEach((s) => { const r = new THREE.Mesh(new THREE.RingGeometry(.42, .6, 30).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })); r.position.set(s * .8, .11, -.4); scene.add(r); S.zones[s] = r; });

  // ---- outfield wall: dark green padding with sponsor boards (generic names) ----
  const a0 = Math.PI * 1.1, aL = Math.PI * .8;
  const adTex = canvasTex(2048, 128, (g, w, h) => {
    g.fillStyle = '#12452a'; g.fillRect(0, 0, w, h);
    const ads = ['SLUGGER SNACKS', 'BIG DOG HOT DOGS', 'DERBY DAY', 'ICE POPS', 'HOME RUN JUICE', 'PLAY BALL', 'CITY BANK', 'SPEED TIRES'];
    ads.forEach((t, i) => { g.fillStyle = i % 2 ? '#f2f2f2' : '#14234a'; g.fillRect(i * 256 + 8, 14, 240, 100); g.fillStyle = i % 2 ? '#14234a' : '#f2f2f2'; g.font = '700 30px Arial, sans-serif'; g.textAlign = 'center'; g.fillText(t, i * 256 + 128, 74, 224); });
  }, [2, 1]);
  adTex.repeat.set(-2, 1); adTex.offset.set(2, 0);          // the boards face the field, so flip them to read correctly from inside the park
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(S.wallR, S.wallR, 8, 120, 1, true, Math.PI - aL / 2, aL), mat({ map: adTex, side: THREE.DoubleSide, roughness: .7 })); wall.position.y = 4; scene.add(wall);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(S.wallR + .15, S.wallR + .15, .7, 120, 1, true, Math.PI - aL / 2, aL), mat({ color: 0xe8c020, roughness: .5, side: THREE.DoubleSide })); cap.position.y = 8; scene.add(cap);
  [-1, 1].forEach((s) => { const pole = new THREE.Mesh(new THREE.CylinderGeometry(.22, .22, 30, 10), mat({ color: 0xe8c020 })); pole.position.set(s * S.wallR * .7071, 15, -S.wallR * .7071); scene.add(pole); });

  // ---- the stands: three seating decks, concrete fascia, white frieze, thousands of fans ----
  const seatTex = canvasTex(512, 128, (g, w, h) => { g.fillStyle = '#17306a'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 16) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, y, w, 3); } for (let x = 0; x < w; x += 20) { g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(x, 0, 2, h); } }, [18, 1]);
  const seatMat = mat({ map: seatTex, side: THREE.DoubleSide, roughness: .8 }), concrete = T.conc ? pbr(T.conc, 80, 1.5, { side: THREE.DoubleSide, color: 0xc4c8d2 }) : mat({ color: 0x8c8f98, side: THREE.DoubleSide });
  const tiers = [[S.wallR + 3, S.wallR + 26], [S.wallR + 32, S.wallR + 56], [S.wallR + 62, S.wallR + 86]];
  const centerAng = Math.PI, span = 2.8;
  tiers.forEach(([r0, r1], k) => {
    const h = 16 + k * 3, y = 8 + k * 19;
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, h, 100, 1, true, centerAng - span / 2, span), seatMat); bowl.position.y = y; scene.add(bowl);
    const fas = new THREE.Mesh(new THREE.CylinderGeometry(r0, r0, 6, 100, 1, true, centerAng - span / 2, span), concrete); fas.position.y = y - h / 2 - 3; scene.add(fas);
  });
  const frTex = canvasTex(1024, 128, (g, w, h) => { g.fillStyle = '#e9e7df'; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 64) { g.fillStyle = '#c9c6bb'; g.beginPath(); g.arc(x + 32, 40, 24, Math.PI, 0); g.fill(); g.fillRect(x + 8, 40, 48, 70); g.fillStyle = '#e9e7df'; g.beginPath(); g.arc(x + 32, 44, 18, Math.PI, 0); g.fill(); g.fillRect(x + 14, 44, 36, 60); } }, [10, 1]);
  const topR = tiers[2][1];
  const frieze = new THREE.Mesh(new THREE.CylinderGeometry(topR + 2, topR + 2, 9, 120, 1, true, centerAng - span / 2, span), mat({ map: frTex, side: THREE.DoubleSide, roughness: .6 })); frieze.position.y = 8 + 2 * 19 + 17; scene.add(frieze);
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(topR + 3, topR + 3, 2, 120, 1, true, centerAng - span / 2, span), mat({ color: 0x2f6f5a, side: THREE.DoubleSide })); roof.position.y = 8 + 2 * 19 + 22; scene.add(roof);
  // ---- the crowd: thousands of painted fans (skin tones, hair, caps, shirts; about a third cheering) as camera-facing cutouts ----
  const CW = 96, CH = 128, COLS = 8, ROWS = 4;
  const crowdTex = canvasTex(CW * COLS, CH * ROWS, (g) => {
    const skins = ['#f3d2b4', '#e6b88f', '#cf9a6d', '#a8734a', '#7a4f33', '#5a3a28'], hairs = ['#1e130b', '#3b2616', '#6b4423', '#b78a42', '#d8c08a', '#8e8e90', '#0e0e10'];
    const shirts = ['#14234a', '#14234a', '#f2f2f2', '#f2f2f2', '#9aa0ac', '#b02030', '#2a4a9a', '#33343c', '#c8b090', '#6a8ac0', '#1f5a3a'], caps = ['#14234a', '#14234a', '#f2f2f2', '#b02030', '#33343c'];
    const pick1 = (arr) => arr[Math.floor(Math.random() * arr.length)];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const x0 = c * CW, y0 = r * CH, cx = x0 + CW / 2, skin = pick1(skins), hair = pick1(hairs), shirt = pick1(shirts), cheer = Math.random() < .35, hasCap = Math.random() < .42, capC = pick1(caps), tilt = (Math.random() - .5) * .14;
      g.save(); g.translate(cx, y0 + CH); g.rotate(tilt); g.translate(-cx, -(y0 + CH));
      if (cheer) {                                                      // raised arm
        g.strokeStyle = shirt; g.lineWidth = 13; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx + 24, y0 + CH - 26); g.lineTo(cx + 34, y0 + 34); g.stroke();
        g.fillStyle = skin; g.beginPath(); g.arc(cx + 34, y0 + 28, 8.5, 0, 7); g.fill();
      }
      g.beginPath(); g.moveTo(x0 + 5, y0 + CH); g.quadraticCurveTo(x0 + 7, y0 + 72, cx - 20, y0 + 64); g.lineTo(cx + 20, y0 + 64); g.quadraticCurveTo(x0 + CW - 7, y0 + 72, x0 + CW - 5, y0 + CH); g.closePath();
      g.fillStyle = shirt; g.fill(); const sh = g.createLinearGradient(0, y0 + 60, 0, y0 + CH); sh.addColorStop(0, 'rgba(255,255,255,.12)'); sh.addColorStop(1, 'rgba(0,0,0,.4)'); g.fillStyle = sh; g.fill();
      g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 1.5; g.stroke();
      g.fillStyle = skin; g.fillRect(cx - 7, y0 + 54, 14, 14); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(cx - 7, y0 + 54, 14, 5);
      const hg = g.createRadialGradient(cx - 5, y0 + 34, 4, cx, y0 + 40, 22); hg.addColorStop(0, skin); hg.addColorStop(1, 'rgba(0,0,0,.35)');
      g.beginPath(); g.ellipse(cx, y0 + 40, 17, 20, 0, 0, 7); g.fillStyle = skin; g.fill(); g.fillStyle = hg; g.globalAlpha = .55; g.fill(); g.globalAlpha = 1; g.strokeStyle = 'rgba(0,0,0,.25)'; g.stroke();
      if (hasCap) { g.fillStyle = capC; g.beginPath(); g.ellipse(cx, y0 + 30, 19, 16, 0, Math.PI, 0); g.fill(); g.beginPath(); g.ellipse(cx + 9, y0 + 31, 15, 4.5, 0, 0, 7); g.fill(); }
      else { g.fillStyle = hair; g.beginPath(); g.ellipse(cx, y0 + 31, 18, 15, 0, Math.PI, 0); g.fill(); if (Math.random() < .4) { g.fillRect(cx - 18, y0 + 31, 6, 24); g.fillRect(cx + 12, y0 + 31, 6, 24); } }
      g.fillStyle = '#1a1210'; g.beginPath(); g.arc(cx - 6, y0 + 42, 1.8, 0, 7); g.arc(cx + 6, y0 + 42, 1.8, 0, 7); g.fill();
      g.strokeStyle = '#4a1a14'; g.lineWidth = 1.6; g.beginPath(); if (cheer) { g.fillStyle = '#4a1a14'; g.ellipse(cx, y0 + 51, 5, 3.4, 0, 0, 7); g.fill(); } else { g.moveTo(cx - 4, y0 + 51); g.quadraticCurveTo(cx, y0 + 53, cx + 4, y0 + 51); g.stroke(); }
      g.restore();
    }
  });
  crowdTex.anisotropy = 4;
  const FAN = 5200, fanGeo = new THREE.PlaneGeometry(1, 1).translate(0, .5, 0), cells = new Float32Array(FAN * 2);
  const crowdMat = new THREE.MeshBasicMaterial({ map: crowdTex, alphaTest: .45, side: THREE.DoubleSide });
  crowdMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 aCell;').replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv = uv * vec2(.125, .25) + aCell;\n#endif');
  };
  crowdMat.customProgramCacheKey = () => 'crowd';
  const fans = new THREE.InstancedMesh(fanGeo, crowdMat, FAN), d = new THREE.Object3D(), col = new THREE.Color();
  fanGeo.setAttribute('aCell', new THREE.InstancedBufferAttribute(cells, 2));
  S.fans = [];
  for (let i = 0; i < FAN; i++) {
    const k = Math.floor(Math.random() * 3), [r0, r1] = tiers[k], h = 16 + k * 3, f = Math.random(), r = lerp(r0 + 1.5, r1 - 1.5, f), ang = centerAng + rand(-span / 2 + .05, span / 2 - .05), y = 8 + k * 19 + lerp(-h / 2 + 1.4, h / 2 - 1, 1 - f) - .9;
    const x = Math.sin(ang) * r, z = Math.cos(ang) * r, w = rand(1.8, 2.5), hgt = w * (CH / CW), ry = Math.atan2(-x, -z);
    d.position.set(x, y, z); d.rotation.set(0, ry, 0); d.scale.set(w, hgt, 1); d.updateMatrix(); fans.setMatrixAt(i, d.matrix);
    const cx = Math.floor(Math.random() * COLS), cy = Math.floor(Math.random() * ROWS); cells[i * 2] = cx / COLS; cells[i * 2 + 1] = 1 - (cy + 1) / ROWS;
    const tone = (1 - k * .09) * rand(.78, 1.0); col.setRGB(tone, tone, tone); fans.setColorAt(i, col);
    S.fans.push({ x, y, z, ph: rand(0, 6), s: 1, w, hgt, ry });
  }
  fans.instanceColor.needsUpdate = true; fans.frustumCulled = false; scene.add(fans); S.fanMesh = fans;
  S.flashes = []; for (let i = 0; i < 40; i++) { const sp = glowSprite(0xffffff, 3, 0); const f = S.fans[Math.floor(Math.random() * FAN)]; sp.position.set(f.x, f.y + 1, f.z); scene.add(sp); S.flashes.push({ sp, t: rand(0, 6) }); }

  // ---- light towers (banks of lamps) and the scoreboard ----
  const lampM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff2d0).multiplyScalar(2.4) });
  [[-100, -118], [100, -118], [-150, -45], [150, -45]].forEach(([x, z]) => {
    const tw = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.8, 82, 6), mat({ color: 0x8d939e, metalness: .5 })); tw.position.set(x, 41, z); scene.add(tw);
    const bank = new THREE.Group(); bank.position.set(x, 84, z); bank.lookAt(0, 84, 0); scene.add(bank);
    bank.add(new THREE.Mesh(new THREE.BoxGeometry(26, 14, 1.2), mat({ color: 0x3a3f4a })));
    for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) { const lamp = new THREE.Mesh(new THREE.CircleGeometry(1.5, 14), lampM); lamp.position.set(-10.5 + i * 4.2, -4.5 + j * 3, .7); bank.add(lamp); }
    const gl = glowSprite(0xfff0c8, 70, .3); gl.position.set(x, 84, z); scene.add(gl);
  });
  const sbC = document.createElement('canvas'); sbC.width = 1024; sbC.height = 384; const sbT = new THREE.CanvasTexture(sbC); sbT.colorSpace = THREE.SRGBColorSpace;
  const board = new THREE.Mesh(new THREE.PlaneGeometry(54, 20.25), new THREE.MeshBasicMaterial({ map: sbT })); board.position.set(0, 31, -S.wallR - 13.4); scene.add(board);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(58, 24, 2), mat({ color: 0x1b2230, metalness: .3 })); frame.position.set(0, 31, -S.wallR - 15); scene.add(frame);
  S.setScore = (hr, outs, name) => {
    const g = sbC.getContext('2d'); g.fillStyle = '#05080f'; g.fillRect(0, 0, 1024, 384);
    for (let y = 0; y < 384; y += 6) { g.fillStyle = 'rgba(255,255,255,.03)'; g.fillRect(0, y, 1024, 2); }
    g.textAlign = 'center'; g.fillStyle = '#ffb030'; g.font = '700 64px "Courier New", monospace'; g.fillText('HOME RUN DERBY', 512, 84);
    g.fillStyle = '#f2f2f2'; g.font = '700 50px "Courier New", monospace'; g.fillText(((name || 'Tony') + "'S").toUpperCase(), 512, 154);
    g.fillStyle = '#5dff7a'; g.font = '700 118px "Courier New", monospace'; g.fillText(`HR ${hr}`, 290, 290);
    g.fillStyle = '#ff4a4a'; g.fillText('●'.repeat(outs) + '○'.repeat(3 - outs), 770, 280);
    g.fillStyle = '#ffb030'; g.font = '700 38px "Courier New", monospace'; g.fillText('OUTS', 770, 340); sbT.needsUpdate = true;
  };
  S.setScore(0, 0);

  // ---- lighting: low warm afternoon sun, soft sky fill, long shadows ----
  scene.add(new THREE.HemisphereLight(0xbcd4ff, 0x4a5a3a, T.hdr ? .25 : .7));
  const sun = new THREE.DirectionalLight(0xffe2b8, T.hdr ? 2.4 : 3.0); sun.position.set(34, 38, 26); sun.castShadow = true;
  const c = sun.shadow.camera; c.left = c.bottom = -30; c.right = c.top = 30; c.near = 1; c.far = 150; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -.0004; sun.shadow.normalBias = .04; sun.shadow.radius = 2;
  sun.target.position.set(0, 0, -10); scene.add(sun, sun.target); S.sun = sun;

  const dummy = new THREE.Object3D();
  S.update = (dt, t) => {
    S.clouds.forEach((m) => { m.position.x += dt * .8; if (m.position.x > 400) m.position.x = -400; });
    S.flashes.forEach((f) => { f.t -= dt; f.sp.material.opacity = f.t < .12 && f.t > 0 ? .9 : 0; if (f.t < -rand(1, 5)) f.t = rand(.5, 4); });
    if (S.cheering > 0) {
      S.cheering -= dt; const amp = Math.min(1, S.cheering), fm = S.fanMesh;
      S.fans.forEach((f, i) => { dummy.position.set(f.x, f.y + Math.abs(Math.sin(t * 9 + f.ph)) * 1.1 * amp, f.z); dummy.rotation.set(0, f.ry, 0); dummy.scale.set(f.w, f.hgt * (1 + Math.abs(Math.sin(t * 9 + f.ph)) * .06 * amp), 1); dummy.updateMatrix(); fm.setMatrixAt(i, dummy.matrix); });
      fm.instanceMatrix.needsUpdate = true;
    }
  };
  S.cheer = (sec = 3) => { S.cheering = sec; };
  return S;
}
