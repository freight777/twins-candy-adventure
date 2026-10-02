import * as THREE from 'three';
import { BaseScene } from '../scene-base.js';
import { toon, mk, outline, rand, pick, clamp, lerp, smooth, ease, glowSprite, stripedGeo, vertexToon, RAINBOW, CANDY } from '../util.js';
import { createAdult } from '../characters.js';
import { sfx, playMusic } from '../audio.js';

const sph = (r, w = 20, h = 14) => new THREE.SphereGeometry(r, w, h);
const cyl = (rt, rb, h, s = 12) => new THREE.CylinderGeometry(rt, rb, h, s);
const SHORE = -2;
const ORB = new THREE.Vector3(5, 0.9, -24);

export class BeachScene extends BaseScene {
  constructor(game) {
    super(game);
    this.phase = 'title';
    this.autopilot = false;
    this.idle = 0;
    this.wander = [];       // things that update every frame
    this.surprises = 0;
    this.buildSky();
    this.buildGround();
    this.buildWater();
    this.buildProps();
    this.buildCritters();
    this.buildOrb();
    this.scene.add(new THREE.HemisphereLight(0xd8efff, 0xffe2b0, 1.15));
    const sun = new THREE.DirectionalLight(0xfff0d0, 1.6); sun.position.set(20, 30, 14); this.scene.add(sun);
  }

  // ===================================================================== build
  buildSky() {
    const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: `varying vec3 vP; void main(){ float h = clamp(vP.y*1.7+.12,0.,1.);
        vec3 c = mix(vec3(1.,.96,.84), vec3(.28,.7,1.), pow(h,.65)); gl_FragColor = vec4(c,1.); }`,
    }));
    this.scene.add(sky);

    // smiling sun
    const sunG = new THREE.Group(); sunG.position.set(36, 30, -170); sunG.scale.setScalar(1.6);
    sunG.add(glowSprite(0xffe680, 60, .9), mk(sph(7, 24, 18), new THREE.MeshBasicMaterial({ color: 0xffd84d })));
    const dark = new THREE.MeshBasicMaterial({ color: 0x7a3b10 });
    for (const s of [-1, 1]) {
      const eye = mk(sph(.9), dark, [s * 2.4, 1.4, 6.6], [.8, 1.3, .4]); sunG.add(eye);
      sunG.add(mk(sph(1.2), new THREE.MeshBasicMaterial({ color: 0xff9a7a }), [s * 4.4, -1.2, 6], [1, .6, .3]));
      if (s === 1) this.sunEye = eye;
    }
    const smile = mk(new THREE.TorusGeometry(2.2, .3, 8, 20, Math.PI), dark, [0, -.8, 6.6]); smile.rotation.z = Math.PI; sunG.add(smile);
    this.sun = sunG; this.scene.add(sunG);
    this.addInteractive(sunG, () => this.tapSun(), 9);

    // clouds
    this.clouds = [];
    for (let i = 0; i < 9; i++) {
      const c = new THREE.Group();
      const n = 3 + Math.floor(Math.random() * 3);
      for (let k = 0; k < n; k++) c.add(mk(sph(rand(3, 5)), toon(0xffffff), [k * 4 - n * 2, rand(-.5, 1.2), rand(-1, 1)], [1.3, .8, .9]));
      c.position.set(rand(-160, 160), rand(24, 50), rand(-230, -110));
      this.clouds.push(c); this.scene.add(c);
    }
  }

  buildGround() {
    const sand = mk(new THREE.PlaneGeometry(160, 70).rotateX(-Math.PI / 2), 0xffdf9e, [0, 0, SHORE + 35]);
    const wet = mk(new THREE.PlaneGeometry(160, 3.5).rotateX(-Math.PI / 2), 0xe9c27f, [0, .01, SHORE + .6]);
    const slope = mk(new THREE.PlaneGeometry(160, 12.2).rotateX(-Math.PI / 2), 0xe3c58c, [0, -.8, SHORE - 6]);
    slope.rotation.x = -Math.PI / 2 * 0 - Math.atan(1.6 / 12);
    const floor = mk(new THREE.PlaneGeometry(500, 320).rotateX(-Math.PI / 2), 0x4aa8c8, [0, -1.6, -170]);
    this.scene.add(sand, wet, slope, floor);

    // dunes, shells and bumps for visual interest
    for (let i = 0; i < 9; i++) {
      const d = mk(sph(1), 0xffd68a, [rand(-40, 40), -.3, rand(14, 45)], [rand(4, 9), rand(.8, 1.6), rand(3, 6)]); this.scene.add(d);
    }
    for (let i = 0; i < 30; i++) {
      const s = mk(new THREE.ConeGeometry(.16, .22, 7), pick([0xff9fcb, 0xffffff, 0xffb86b, 0xc79bff]), [rand(-25, 25), .12, rand(0, 20)]);
      s.rotation.set(rand(-.5, .5), rand(0, 6), rand(1, 2)); this.scene.add(s);
    }
  }

  buildWater() {
    this.waterMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: { uTime: { value: 0 } },
      vertexShader: `uniform float uTime; varying vec3 vW;
        void main(){ vec4 w = modelMatrix*vec4(position,1.);
          w.y += sin(w.x*.5+uTime*1.2)*.05 + sin(w.z*.45+uTime*1.1)*.05; vW = w.xyz;
          gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `uniform float uTime; varying vec3 vW;
        void main(){
          float depth = clamp((-vW.z-2.)/30.,0.,1.);
          vec3 shallow = vec3(.45,.95,.9), deep = vec3(.08,.45,.85);
          vec3 c = mix(shallow, deep, pow(depth,.55));
          c += .05*sin(vW.x*1.7+uTime*1.3)*sin(vW.z*1.3-uTime*1.1);
          float sp = smoothstep(.92,1., sin(vW.x*7.+uTime*1.8)*sin(vW.z*6.5-uTime*1.5));
          c += sp*.55;
          float edge = -vW.z-2.;
          float wave = sin(uTime*.9)*.6+.9;
          float foam = smoothstep(.45,0.,abs(edge-wave)) + smoothstep(.2,0.,abs(edge-wave*1.9-.8))*.4;
          c = mix(c, vec3(1.), clamp(foam,0.,1.)*.85);
          float a = mix(.55,.93,pow(depth,.5)); a = max(a, foam*.9);
          if (edge < 0.) a = 0.;
          gl_FragColor = vec4(c, a);
        }`,
    });
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(500, 320, 60, 40).rotateX(-Math.PI / 2), this.waterMat);
    this.water.position.set(0, -.04, SHORE - 160);
    this.water.renderOrder = 5;
    this.scene.add(this.water);
  }

  buildProps() {
    // palm trees
    [[-15, 1, .35, 7], [14, -.5, -.3, 8], [-26, 6, .25, 7.5], [24, 8, -.25, 7], [-30, 14, .2, 8.5]].forEach(([x, z, lean, h]) => this.addPalm(x, z, lean, h));

    // umbrella, towels, mom and dad
    const u = new THREE.Group(); u.position.set(-10, 0, 7); this.scene.add(u);
    u.add(mk(cyl(.07, .07, 3.4, 8), 0xffffff, [0, 1.7, 0]));
    const canopy = new THREE.Mesh(stripedGeo(new THREE.ConeGeometry(2.6, 1, 16), [0xff4d6d, 0xffffff], 16), vertexToon());
    canopy.position.y = 3.5; u.add(canopy);
    u.add(mk(sph(.12), 0xffd84d, [0, 4.05, 0]));
    u.add(mk(new THREE.BoxGeometry(3.4, .06, 2.2), 0x5ec6ff, [0, .03, 0]), mk(new THREE.BoxGeometry(3.4, .065, .5), 0xffffff, [0, .031, 0]));
    this.mom = createAdult('mom'); this.dad = createAdult('dad');
    this.mom.position.set(-.9, .06, .1); this.dad.position.set(.9, .06, .1);
    this.mom.rotation.y = .3; this.dad.rotation.y = -.3; this.mom.scale.setScalar(1); this.dad.scale.setScalar(1.08);
    u.add(this.mom, this.dad);
    this.parents = u;
    this.addInteractive(u, () => this.tapParents(), 2.6, [0, 1.4, 0]);

    // beach ball
    this.ball = new THREE.Mesh(stripedGeo(sph(.65), [0xff4d6d, 0xffffff, 0x4db8ff, 0xffe14d, 0x5be37d, 0xffffff], 12), vertexToon());
    this.ball.position.set(-3, .65, 5); this.ball.userData = { vy: 0, vx: 0, home: new THREE.Vector3(-3, .65, 5) }; this.scene.add(this.ball);
    this.addInteractive(this.ball, () => this.tapBall(), 1.1);

    // sandcastle
    const c = new THREE.Group(); c.position.set(8, 0, 6.5); this.scene.add(c);
    const sc = 0xf0c27a;
    c.add(outline(mk(cyl(1.5, 1.7, 1, 18), sc, [0, .5, 0]), 1.04), mk(cyl(.9, 1, 1.2, 14), sc, [0, 1.5, 0]));
    c.add(outline(mk(new THREE.ConeGeometry(.9, .9, 14), 0xff6f91, [0, 2.6, 0]), 1.04));
    for (const [x, z] of [[-1.7, -1.2], [1.7, -1.2], [-1.7, 1.2], [1.7, 1.2]]) {
      c.add(mk(cyl(.4, .45, 1.3, 10), sc, [x * .75, .65, z * .75]), mk(new THREE.ConeGeometry(.45, .6, 10), 0x62d0e0, [x * .75, 1.6, z * .75]));
    }
    c.add(mk(cyl(.03, .03, 1.1, 6), 0xffffff, [0, 3.4, 0]));
    this.flag = mk(new THREE.PlaneGeometry(.8, .5), toon(0xffd84d, { side: THREE.DoubleSide }), [.4, 3.7, 0]);
    c.add(this.flag); this.castle = c;
    this.addInteractive(c, () => this.tapCastle(), 2.4, [0, 1.5, 0]);

    // starfish
    this.stars = [];
    [[-7, 3.5, 0xff9f4d], [3.5, 9.5, 0xff6fb5], [-1, 13, 0xb07cff]].forEach(([x, z, col], i) => {
      const shape = new THREE.Shape();
      for (let k = 0; k < 10; k++) { const r = k % 2 ? .22 : .6, a = (k / 10) * Math.PI * 2; k ? shape.lineTo(Math.cos(a) * r, Math.sin(a) * r) : shape.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
      const s = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: .14, bevelEnabled: true, bevelSize: .05, bevelThickness: .05, bevelSegments: 2 }), toon(col));
      s.rotation.x = -Math.PI / 2; s.position.set(x, .08, z); this.scene.add(s);
      s.userData.home = s.position.clone();
      this.stars.push(s);
      this.addInteractive(s, () => this.tapStar(s, i), 1.1);
    });
  }

  addPalm(x, z, lean, h) {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    const trunk = new THREE.Group(); g.add(trunk);
    const segs = 7;
    for (let i = 0; i < segs; i++) {
      const t = i / segs, r = .42 - t * .15;
      const s = mk(cyl(r * .9, r, h / segs + .05, 10), i % 2 ? 0x9a6a3a : 0xb07d48, [lean * h * t * t, h * t + h / segs / 2, 0]);
      s.rotation.z = -lean * 2 * t * .5; trunk.add(s);
    }
    const top = new THREE.Group(); top.position.set(lean * h * .92, h + .1, 0); trunk.add(top);
    for (let i = 0; i < 8; i++) {
      const arm = new THREE.Group(); arm.rotation.y = (i / 8) * Math.PI * 2;
      const leaf = mk(sph(1, 10, 6), i % 2 ? 0x3cc267 : 0x56d977, [2, 0, 0], [2.1, .09, .5]); leaf.rotation.z = -.25;
      arm.add(leaf); arm.rotation.z = -.35; top.add(arm);
      arm.rotation.order = 'YZX';
    }
    for (let i = 0; i < 3; i++) top.add(mk(sph(.28), 0x6b4423, [Math.cos(i * 2.1) * .35, -.35, Math.sin(i * 2.1) * .35]));
    g.userData = { trunk, top, shake: 0 };
    this.scene.add(g);
    this.palms = this.palms || []; this.palms.push(g);
    this.addInteractive(g, () => this.tapPalm(g), 1.6, [lean * h * .6, h * .55, 0]);
  }

  buildCritters() {
    // crabs
    this.crabs = [];
    [[4, 3.5], [-12, 10]].forEach(([x, z]) => {
      const g = this.makeCrab(); g.position.set(x, 0, z);
      Object.assign(g.userData, { dir: 1, timer: rand(1, 3), jump: 0, home: x, busy: false });
      this.crabs.push(g); this.scene.add(g);
      this.addInteractive(g, () => this.tapCrab(g), 1.1, [0, .4, 0]);
    });

    // seagull
    this.gull = this.makeGull(); this.gull.position.set(-5.5, 0, 0.5); Object.assign(this.gull.userData, { home: this.gull.position.clone(), flying: false });
    this.scene.add(this.gull);
    this.addInteractive(this.gull, () => this.tapGull(), 1.2, [0, .6, 0]);

    // dolphin
    this.dolphin = this.makeDolphin(); this.dolphin.visible = false; this.scene.add(this.dolphin);
    this.dolphinT = 8; this.dolphinJumping = false;
    this.addInteractive(this.dolphin, () => {}, 2.2);
  }

  makeCrab() {
    const g = new THREE.Group(), red = 0xff5a4a;
    g.add(outline(mk(sph(.38), red, [0, .28, 0], [1.25, .62, .88]), 1.08));
    for (const s of [-1, 1]) {
      g.add(mk(cyl(.035, .035, .22, 6), red, [s * .16, .55, .22]), mk(sph(.075), 0xffffff, [s * .16, .68, .22]), mk(sph(.035), 0x222222, [s * .16, .69, .27]));
      const claw = new THREE.Group(); claw.position.set(s * .5, .34, .3);
      claw.add(mk(sph(.09), red, [s * .08, 0, -.05]), mk(sph(.17), red, [s * .1, .18, .05], [1.3, 1, .8]), mk(sph(.07), 0x7a1f1f, [s * .1, .3, .08]));
      claw.rotation.z = -s * .2; g.add(claw);
      (g.userData.claws = g.userData.claws || []).push(claw);
      for (let k = 0; k < 3; k++) { const l = mk(cyl(.025, .025, .34, 5), red, [s * .42, .13, -.15 + k * .17]); l.rotation.z = s * 1.0; g.add(l); }
    }
    const sm = mk(new THREE.TorusGeometry(.07, .014, 6, 10, Math.PI), 0x7a1f1f, [0, .3, .33]); sm.rotation.z = Math.PI; g.add(sm);
    return g;
  }

  makeGull() {
    const g = new THREE.Group();
    g.add(outline(mk(sph(.3), 0xffffff, [0, .62, 0], [1, .85, 1.5]), 1.08), mk(sph(.17), 0xffffff, [0, .98, .42]));
    const beak = mk(new THREE.ConeGeometry(.06, .22, 8), 0xffa31a, [0, .95, .66]); beak.rotation.x = Math.PI / 2; g.add(beak);
    g.add(mk(new THREE.ConeGeometry(.12, .4, 6), 0xffffff, [0, .6, -.5]).rotateX(-1.9));
    g.userData.wings = [];
    for (const s of [-1, 1]) {
      g.add(mk(sph(.04), 0x222222, [s * .09, 1.02, .55]));
      const w = new THREE.Group(); w.position.set(s * .25, .7, 0);
      w.add(mk(sph(.3), 0xf2f2f2, [s * .3, 0, 0], [1.4, .12, .75]), mk(sph(.15), 0x7a8aa0, [s * .66, 0, -.02], [1.2, .12, .75]));
      g.add(w); g.userData.wings.push(w);
      g.add(mk(cyl(.018, .018, .38, 5), 0xffa31a, [s * .1, .2, 0]));
    }
    return g;
  }

  makeDolphin() {
    const g = new THREE.Group(), blue = 0x6aa6e8;
    g.add(outline(mk(sph(.7, 20, 14), blue, [0, 0, 0], [2.4, .8, .8]), 1.06));
    g.add(mk(sph(.5, 16, 10), 0xeaf4ff, [.2, -.2, 0], [2.0, .5, .7]));
    g.add(mk(new THREE.ConeGeometry(.17, .6, 10), blue, [1.9, -.05, 0]).rotateZ(-Math.PI / 2));
    g.add(mk(new THREE.ConeGeometry(.28, .7, 8), blue, [-.2, .85, 0]).rotateZ(.5));
    const tail = new THREE.Group(); tail.position.set(-1.7, 0, 0); g.add(tail);
    for (const s of [-1, 1]) tail.add(mk(sph(.4, 10, 6), blue, [-.2, .1 * s, s * .35], [.8, .12, 1]));
    for (const s of [-1, 1]) { g.add(mk(sph(.06), 0x222222, [1.35, .12, s * .35])); g.add(mk(sph(.3, 10, 6), blue, [.4, -.3, s * .65], [.8, .1, .5])); }
    const sm = mk(new THREE.TorusGeometry(.12, .02, 6, 10, Math.PI), 0x335a8a, [1.6, -.1, .3]); sm.rotation.z = Math.PI; g.add(sm);
    g.userData.tail = tail;
    return g;
  }

  buildOrb() {
    const g = new THREE.Group(); g.position.copy(ORB);
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(.75, 0), new THREE.MeshBasicMaterial({ color: 0xfff1a0 }));
    g.add(core, glowSprite(0xffd84d, 7), glowSprite(0xffffff, 3.2));
    for (let i = 0; i < 4; i++) {
      const ray = mk(new THREE.PlaneGeometry(.18, 7), new THREE.MeshBasicMaterial({ color: 0xfff5b0, transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      ray.rotation.z = (i / 4) * Math.PI; g.add(ray);
    }
    const beam = mk(cyl(.25, 1.1, 40, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff1a0, transparent: true, opacity: .22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), [0, 20, 0]);
    g.add(beam);                                  // a tall beam of light so the girls can spot it from the sand
    this.orb = g; this.orbCore = core; this.scene.add(g);
    g.scale.setScalar(1.5);
    this.addInteractive(g, () => this.tapOrb(), 4.5);
  }

  // ===================================================================== flow
  enter() {
    const G = this.game, P = G.party;
    this.scene.add(P.group);
    P.ground = (x, z) => {
      if (z > SHORE) return { y: 0, swim: 0 };
      const d = clamp((SHORE - z) / 6, 0, 1);
      return { y: -.6 * smooth(d), swim: smooth(clamp((-z - 4) / 4, 0, 1)) };
    };
    P.bounds = { xmin: -24, xmax: 24, zmin: -14, zmax: 20 };
    P.frozen = false;
    P.setForm('girl');
    if (!G.started) {
      this.phase = 'title';
      P.active = P.active || 'adalyn';
      P.place(-1.5, 7, 1.5, 7);
      P.setMode('cheer');
      G.ui.title(true); G.ui.hud(false); G.ui.setActive(P.active);
      this.camera.position.set(0, 3.2, 13.5); this.camera.lookAt(0, 2.4, 0);
    } else {
      this.beginPlay(false);
    }
  }
  startPlay() {
    if (this.phase !== 'title') return;
    this.game.started = true;
    sfx.sparkle();
    this.game.ui.title(false);
    this.beginPlay(true);
  }
  beginPlay(fresh) {
    const P = this.game.party;
    this.phase = 'play'; P.setMode('idle');
    this.game.ui.hud(true); this.game.ui.setActive(P.active);
    if (!fresh) P.place(0, 6, side(P) * 1.5, 6);
    playMusic('beach');
    this.camGoal = new THREE.Vector3(); this.look = new THREE.Vector3(0, 2, 0);
    this.snapCamera();
  }
  snapCamera() {
    const L = this.game.party.leader.root.position;
    this.camera.position.set(L.x, 5.2, L.z + 11.5);
    this.look.set(L.x, 1.6, L.z - 4);
    this.camera.lookAt(this.look);
  }

  // ===================================================================== taps
  touch() { this.idle = 0; this.surprises++; }
  onGround(p) {
    if (this.phase !== 'play' || this.autopilot) return;
    this.idle = 0;
    const P = this.game.party;
    P.walkTo(p.x, p.z);
    if (P.target) this.ring(P.target.x, P.target.z);
  }
  ring(x, z) {
    const m = new THREE.Mesh(new THREE.RingGeometry(.35, .5, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .9, depthWrite: false, side: THREE.DoubleSide }));
    m.position.set(x, z > SHORE ? .06 : -.02, z); m.renderOrder = 8; this.scene.add(m);
    this.tm.tween(.7, (k) => { m.scale.setScalar(1 + k * 1.8); m.material.opacity = .9 * (1 - k); }, { ease: ease.out, done: () => { this.scene.remove(m); m.geometry.dispose(); m.material.dispose(); } });
  }

  tapSun() {
    this.touch(); sfx.giggle();
    this.fx.burst(this.sun.position.clone().add(new THREE.Vector3(0, 0, 20)), { count: 40, colors: [0xffe14d, 0xffffff, 0xff9f4d], speed: 12, gravity: 0, life: 1.4, size: 2 });
    this.tm.tween(.6, (k) => { this.sunEye.scale.y = 1.3 * (1 - Math.sin(k * Math.PI) * .9); this.sun.rotation.z = Math.sin(k * Math.PI * 2) * .2; });
  }
  tapParents() {
    this.touch(); sfx.babble(5);
    const hearts = this.parents.position.clone().add(new THREE.Vector3(0, 3, 0));
    this.fx.burst(hearts, { count: 24, colors: [0xff6f91, 0xff9fcb], speed: 3, gravity: 1.5, life: 1.6, size: .9 });
    this.tm.tween(1.8, (k) => {
      for (const p of [this.mom, this.dad]) p.userData.arm.rotation.z = -2.4 + Math.sin(k * 40) * .35;
    }, { done: () => [this.mom, this.dad].forEach((p) => (p.userData.arm.rotation.z = 0)) });
  }
  tapBall() {
    this.touch(); sfx.boing();
    const b = this.ball.userData; b.vy = 9; b.vx = rand(-3, 3); b.vz = rand(-2, 2);
  }
  tapCastle() {
    this.touch(); sfx.tada();
    const p = this.castle.position.clone(); p.y = 3.6;
    this.fx.burst(p, { count: 50, colors: CANDY, speed: 6, gravity: -4, life: 1.6 });
    this.tm.tween(1.4, (k) => { this.flag.rotation.y = k * Math.PI * 6; this.castle.scale.y = 1 + Math.sin(k * Math.PI * 4) * .06; }, { done: () => (this.castle.scale.y = 1, this.flag.rotation.y = 0) });
  }
  tapStar(s, i) {
    this.touch(); sfx.note(i * 2 + Math.floor(Math.random() * 2));
    const h = s.userData.home;
    this.fx.burst(h, { count: 14, colors: [0xffffff, 0xffe14d], speed: 3, life: .9 });
    this.tm.tween(.9, (k) => { s.position.y = h.y + Math.sin(k * Math.PI) * 2.2; s.rotation.z = k * Math.PI * 4; }, { ease: ease.linear, done: () => (s.position.y = h.y) });
  }
  tapCrab(c) {
    if (c.userData.busy) return;
    this.touch(); c.userData.busy = true; sfx.squeak(); sfx.boing();
    this.tm.tween(.8, (k) => {
      c.position.y = Math.sin(k * Math.PI) * 1.6;
      c.userData.claws.forEach((cl, i) => (cl.rotation.z = (i ? 1 : -1) * (-.2 - Math.abs(Math.sin(k * 24)) * .9)));
    }, { ease: ease.linear, done: () => { c.position.y = 0; c.userData.busy = false; c.userData.dir *= -1; c.userData.timer = 2.4; } });
  }
  tapGull() {
    const g = this.gull, u = g.userData;
    if (u.flying) return;
    this.touch(); u.flying = true; sfx.squawk();
    const h = u.home;
    this.tm.tween(3.2, (k) => {
      const a = k * Math.PI * 2;
      g.position.set(h.x + Math.sin(a) * 5, Math.sin(k * Math.PI) * 4.5, h.z - 4 + Math.cos(a) * 4 + 4);
      g.rotation.y = Math.atan2(Math.cos(a) * 5, -Math.sin(a) * 4);
      u.wings.forEach((w, i) => (w.rotation.z = (i ? -1 : 1) * Math.sin(k * 70) * .7));
    }, { ease: ease.linear, done: () => { g.position.copy(h); g.rotation.y = 0; u.wings.forEach((w) => (w.rotation.z = 0)); u.flying = false; } });
    this.tm.after(1.6, () => sfx.squawk());
  }
  tapPalm(p) {
    this.touch(); sfx.bonk();
    this.tm.tween(.8, (k) => { p.userData.top.rotation.z = Math.sin(k * 30) * .08 * (1 - k); p.userData.trunk.rotation.z = Math.sin(k * 30) * .02 * (1 - k); });
    const nut = mk(sph(.3), 0x6b4423);
    const tp = new THREE.Vector3(); p.userData.top.getWorldPosition(tp);
    nut.position.copy(tp).add(new THREE.Vector3(.5, -.3, 1)); this.scene.add(nut);
    let vy = 0, vx = rand(.5, 1.5), vz = 2, bounces = 0;
    const id = setInterval(() => {}, 1e9); clearInterval(id);
    this.coconuts = this.coconuts || [];
    this.coconuts.push({ m: nut, vy, vx, vz, bounces });
  }
  tapOrb() {
    if (this.phase !== 'play' || this.autopilot) return;
    this.autopilot = true;
    sfx.magic();
    this.fx.burst(this.orb.position, { count: 40, colors: [0xffe14d, 0xffffff], speed: 5, gravity: 0, life: 1.2 });
    const P = this.game.party;
    P.bounds = { xmin: -30, xmax: 30, zmin: -40, zmax: 20 };
    P.speed = 5.2; P.walkTo(ORB.x, ORB.z + 1);
    this.game.ui.hideHint(); this.hintOn = false;
    this.ring(ORB.x, ORB.z);
  }

  // ===================================================================== update
  update(dt) {
    super.update(dt);
    const t = this.time, G = this.game, P = G.party;
    this.waterMat.uniforms.uTime.value = t;
    this.clouds.forEach((c) => { c.position.x += dt * 1.2; if (c.position.x > 190) c.position.x = -190; });
    this.sun.rotation.y = Math.sin(t * .3) * .08;

    // shiny thing
    this.orb.position.y = ORB.y + Math.sin(t * 1.6) * .35;
    this.orbCore.rotation.y = t * 1.5; this.orbCore.rotation.x = t * .8;
    const pulse = 1.5 + Math.sin(t * 5) * .18; this.orb.scale.setScalar(pulse);
    if (Math.random() < dt * 3) this.fx.burst(this.orb.position.clone().add(new THREE.Vector3(rand(-1.5, 1.5), rand(-1, 2), rand(-1, 1))), { count: 2, colors: [0xffffff, 0xffe14d], speed: .6, gravity: 0, life: 1.1, size: .6 });

    // critters
    this.crabs.forEach((c) => {
      const u = c.userData;
      if (u.busy) return;
      u.timer -= dt; if (u.timer <= 0) { u.dir = Math.random() < .5 ? 1 : -1; u.timer = rand(1.5, 4); }
      c.position.x = clamp(c.position.x + u.dir * dt * .9, u.home - 5, u.home + 5);
      c.position.y = Math.abs(Math.sin(t * 9)) * .03;
      c.rotation.y = Math.sin(t * .7) * .25;
      u.claws.forEach((cl, i) => (cl.rotation.z = (i ? 1 : -1) * (-.2 - Math.sin(t * 3 + i) * .12)));
    });
    if (!this.gull.userData.flying) { this.gull.rotation.y = Math.sin(t * .5) * .5; this.gull.children[1].position.y = .98 + Math.sin(t * 2.2) * .02; }
    this.stars.forEach((s, i) => (s.rotation.z += Math.sin(t + i) * .001));
    this.flag.rotation.z = Math.sin(t * 3) * .12;
    this.palms.forEach((p, i) => { p.userData.top.rotation.y = Math.sin(t * .8 + i) * .06; });
    this.dad.userData.arm.rotation.z += (0 - this.dad.userData.arm.rotation.z) * dt * 3;
    // ball physics
    const b = this.ball.userData;
    if (b.vy !== 0 || this.ball.position.y > .66) {
      b.vy -= 22 * dt; this.ball.position.y += b.vy * dt;
      this.ball.position.x += (b.vx || 0) * dt; this.ball.position.z += (b.vz || 0) * dt;
      this.ball.rotation.z += (b.vx || 0) * dt; this.ball.rotation.x += (b.vz || 0) * dt;
      if (this.ball.position.y <= .65) { this.ball.position.y = .65; if (Math.abs(b.vy) > 3) { b.vy = -b.vy * .55; sfx.pop(); } else { b.vy = 0; b.vx *= .9; b.vz *= .9; } }
    }
    this.ball.position.z = clamp(this.ball.position.z, -1, 18);
    // falling coconuts
    (this.coconuts || []).forEach((c) => {
      c.vy -= 22 * dt; c.m.position.y += c.vy * dt; c.m.position.x += c.vx * dt; c.m.position.z += c.vz * dt;
      if (c.m.position.y < .3) { c.m.position.y = .3; if (c.bounces < 2) { c.vy = 4 / (c.bounces + 1); c.bounces++; sfx.bonk(); } else { c.vy = 0; c.vx = c.vz = 0; } }
    });
    this.dolphinUpdate(dt);

    // idle hint: after a while, make the shiny thing call out to the girls
    if (this.phase === 'play' && !this.autopilot) {
      this.idle += dt;
      if (this.idle > 22 && !this.hintOn) { this.hintOn = true; sfx.ting(); G.ui.hint('✨'); G.ui.bubble('✨ 👆', 'Something shiny in the water!'); this.tm.after(4, () => G.ui.hideBubble()); }
    }
    if (this.hintOn) { const s = this.toScreen(this.orb.position); G.ui.hintAt(s.x, s.y - 70); }

    P.update(dt, t);

    if (this.phase === 'title') {
      this.camera.position.x = Math.sin(t * .3) * 1.2;
      this.camera.lookAt(0, 2.4, 0);
    } else if (this.phase === 'play') {
      const L = P.leader.root.position;
      const k = 1 - Math.exp(-3 * dt);
      const gx = clamp(L.x, -26, 26);
      this.camera.position.lerp(new THREE.Vector3(gx, 5.2 + Math.max(0, -L.z - 6) * .1, L.z + 11.5), k);
      this.look.lerp(new THREE.Vector3(gx, 1.6, L.z - 4), k);
      this.camera.lookAt(this.look);
      if (this.autopilot && !this.diving && Math.hypot(L.x - ORB.x, L.z - ORB.z) < 2.8) this.dive();
    }
  }

  dive() {
    this.diving = true; this.game.party.target = null; this.game.party.frozen = true;
    sfx.splash();
    this.fx.burst(this.orb.position, { count: 80, colors: [0xffffff, 0xffe14d, 0x9be7ff], speed: 8, gravity: -3, life: 1.2, size: 1 });
    this.game.goto('fall', { flash: '#fffbe0' });
  }

  dolphinUpdate(dt) {
    const d = this.dolphin;
    this.dolphinT -= dt;
    if (this.dolphinT <= 0 && !this.dolphinJumping) {
      this.dolphinJumping = true;
      const x0 = rand(-14, 4), z = rand(-13, -9);
      d.visible = true; d.userData.t = 0; d.userData.x0 = x0; d.userData.z = z;
      sfx.splash(); this.fx.burst(new THREE.Vector3(x0, 0, z), { count: 25, colors: [0xffffff, 0x9be7ff], speed: 4, up: 3, gravity: -9, life: .9, size: .7 });
    }
    if (this.dolphinJumping) {
      const u = d.userData; u.t += dt / 2.2;
      const k = u.t;
      if (k >= 1) {
        d.visible = false; this.dolphinJumping = false; this.dolphinT = rand(9, 15);
        sfx.splash(); this.fx.burst(new THREE.Vector3(u.x0 + 9, 0, u.z), { count: 25, colors: [0xffffff, 0x9be7ff], speed: 4, up: 3, gravity: -9, life: .9, size: .7 });
        return;
      }
      d.position.set(u.x0 + k * 9, -1 + 5.2 * 4 * k * (1 - k), u.z);
      d.rotation.z = Math.atan2(5.2 * 4 * (1 - 2 * k), 9);
      u.tail.rotation.z = Math.sin(k * 40) * .4;
    }
  }
}

const side = (P) => (P.active === 'adalyn' ? 1 : -1);
