import * as THREE from 'three';
import { BaseScene } from '../scene-base.js';
import { toon, mk, outline, rand, pick, clamp, lerp, ease, glowSprite, canvasTex, stripedGeo, vertexToon, candyCaneTex, swirlTex, setStyle, shade, RAINBOW, CANDY } from '../util.js';
import { sfx, playMusic, voice } from '../audio.js';
import { levelOf, recordItem, recordSkill } from '../learn/profile.js';
import { renderShow } from '../learn/frame.js';
import { storyAdd } from '../learn/math.js';
import { ask } from '../engine/quiz.js';
import { model } from '../assets.js';
import { makeCandy, CANDY_KINDS } from '../candies.js';

const sph = (r, w = 18, h = 12) => new THREE.SphereGeometry(r, w, h);
const cyl = (rt, rb, h, s = 12) => new THREE.CylinderGeometry(rt, rb, h, s);
const PAD = new THREE.Vector3(15, 0, 2);       // the START pad
// what's out on the meadow, in order (c: = candy built in code, m: = real food model)
const ORDER = ['c:gummyBear', 'c:sourKid', 'c:nerds', 'm:lollypop', 'c:gummyWorm', 'c:sourRing', 'c:gummyBear', 'm:ice-cream-cne', 'c:sourKid', 'c:sourStraw', 'c:nerds', 'm:donut-sprinkles', 'c:gummyBear', 'c:sourKid', 'c:gummyWorm'];
// real models to eat: [model name, emoji on the EAT button, height in the world]
const FOOD = [['lollypop', '\u{1F36D}', 2.8], ['cupcake', '\u{1F9C1}', 2.2], ['donut-sprinkles', '\u{1F369}', 2], ['ice-cream-cne', '\u{1F366}', 2.8], ['cookie', '\u{1F36A}', 2], ['candy-bar', '\u{1F36B}', 1.8],
  ['sundae', '\u{1F368}', 2.4], ['muffin', '\u{1F9C1}', 2.2], ['ginger-bread', '\u{1F36A}', 2.4], ['cake', '\u{1F370}', 2.2], ['popsicle', '\u{1F367}', 2.8], ['waffle', '\u{1F9C7}', 2],
  ['strawberry', '\u{1F353}', 1.8], ['donut-chocolate', '\u{1F369}', 2], ['cake-birthday', '\u{1F382}', 2.6]];
const RIVER_Z = -14;
const _a = new THREE.Vector3(), _b = new THREE.Vector3();

/** Willy-Wonka-style candy meadow: chocolate river and waterfall, candy to eat, tap surprises, and the START pad. */
export class ChocolateScene extends BaseScene {
  constructor(game) {
    super(game);
    this.hfov = 78;
    this.eaten = 0;
    this.pending = null;
    this.edibles = [];
    this.idle = 0;
    this.wander = [];
    setStyle('candy');                      // this room gets the glossy, film-like look
    try {
      this.buildSky();
      this.buildGround();
      this.buildRiver();
      this.buildScenery();
      this.buildGiantGummies();
      this.buildEdibles();
      this.buildPad();
      this.buildAtmosphere();
    } finally { setStyle('toon'); }
    this.scene.environment = game.env('candy'); this.scene.environmentIntensity = 0.3;
    this.scene.fog = new THREE.Fog(0xffe9f3, 120, 320);
    this.scene.add(new THREE.HemisphereLight(0xfff6e8, 0xffc0e0, 0.4));
    const sun = new THREE.DirectionalLight(0xfff0d6, 2.0); sun.position.set(16, 28, 18); this.scene.add(sun);
    this.useShadows(sun, 26);
    this.scene.children.forEach((c) => { if (c.isGroup && !c.userData.noShadow) shade(c); });
    this.bakeMarked();
  }

  /** Soft shafts of sunlight and drifting sugar sparkles: the "wow" layer. */
  buildAtmosphere() {
    const rayTex = canvasTex(64, 256, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, 'rgba(255,240,200,0)'); gr.addColorStop(.5, 'rgba(255,240,200,1)'); gr.addColorStop(1, 'rgba(255,240,200,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      const fade = g.createLinearGradient(0, 0, 0, h); fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(.75, 'rgba(0,0,0,.6)'); fade.addColorStop(1, 'rgba(0,0,0,1)');
      g.globalCompositeOperation = 'destination-out'; g.fillStyle = fade; g.fillRect(0, 0, w, h);
    });
    rayTex.wrapS = rayTex.wrapT = THREE.ClampToEdgeWrapping;
    this.rays = new THREE.Group(); this.rays.userData.noShadow = true;
    for (let i = 0; i < 6; i++) {
      const r = new THREE.Mesh(new THREE.PlaneGeometry(rand(5, 9), 70), new THREE.MeshBasicMaterial({ map: rayTex, transparent: true, opacity: .08, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      r.position.set(-30 + i * 14 + rand(-3, 3), 32, -6 + rand(-6, 6)); r.rotation.set(0, rand(-.5, .5), .38); r.userData.noShadow = true; r.userData.base = r.position.x; this.rays.add(r);
    }
    this.scene.add(this.rays);
  }

  // ===================================================================== build
  buildSky() {
    this.scene.add(new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: `varying vec3 vP; void main(){ float h = clamp(vP.y*1.6+.1,0.,1.);
        vec3 c = mix(vec3(1.,.92,.9), vec3(.55,.8,1.), pow(h,.7)); gl_FragColor = vec4(c,1.); }`,
    })));
    this.clouds = [];
    for (let i = 0; i < 8; i++) {
      const c = new THREE.Group();
      for (let k = 0; k < 4; k++) c.add(mk(sph(rand(3, 5)), toon(pick([0xffffff, 0xffe3f1, 0xe8f4ff])), [k * 4 - 6, rand(-.5, 1), rand(-1, 1)], [1.3, .8, .9]));
      c.position.set(rand(-150, 150), rand(30, 55), rand(-220, -90)); c.userData.noShadow = true; c.userData.bake = true; this.clouds.push(c); this.scene.add(c); this.addInteractive(c, () => this.tapCloud(c), 11);
    }
  }

  buildGround() {
    const grass = canvasTex(64, 64, (g, w, h) => { g.fillStyle = '#7fe05f'; g.fillRect(0, 0, w, h); g.fillStyle = '#92ea6f'; g.fillRect(0, 0, w / 2, h); }, [40, 40]);
    const ground = mk(new THREE.CircleGeometry(90, 64).rotateX(-Math.PI / 2), toon(0xffffff, { map: grass })); ground.receiveShadow = true;
    this.scene.add(ground);
    // rolling candy hills in the distance
    [[-40, -26, 14, 0xff9ecb], [-18, -34, 18, 0x8fe3f0], [30, -30, 16, 0xffd84d], [52, -20, 12, 0xb89cf8], [8, -40, 20, 0xff9ecb], [-55, -16, 13, 0xffd84d]].forEach(([x, z, r, c]) => {
      const h = mk(sph(r, 24, 14), c, [x, -r * .35, z], [1.5, 1, 1.2]); this.scene.add(h); this.addInteractive(h, () => this.tapHill(h), r * 1.3, [0, r * .6, 0]);
    });
    // chocolate-bar stepping fence along the front
    for (let i = 0; i < 14; i++) {
      const bar = mk(new THREE.BoxGeometry(1.8, .3, 1), 0x6b3a1f, [-26 + i * 4, .15, 14.5]); this.scene.add(bar); this.addInteractive(bar, () => this.tapBar(bar, i), 1.5, [0, .5, 0]);
      bar.add(mk(new THREE.BoxGeometry(.04, .32, 1.02), 0x4b2a14, [0, 0, 0]));
    }
  }

  buildRiver() {
    this.riverMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }',
      fragmentShader: `uniform float uTime; varying vec2 vUv; varying vec3 vW;
        void main(){ float f = sin(vUv.x*38.-uTime*1.6 + sin(vUv.y*12.+uTime)*2.)*.5+.5;
          vec3 c = mix(vec3(.26,.12,.06), vec3(.46,.24,.1), f);
          // glossy chocolate: sky reflection that grows at grazing angles + bright sun glints
          vec3 V = normalize(cameraPosition - vW);
          float fres = pow(1. - clamp(V.y, 0., 1.), 2.5);
          c = mix(c, vec3(1., .86, .8), fres*.55);
          float g = smoothstep(.9, 1., sin(vUv.x*70.-uTime*2.5)*sin(vUv.y*26.+uTime*.5));
          c += g*(.5 + fres);
          gl_FragColor = vec4(c,1.); }`,
    });
    const r = new THREE.Mesh(new THREE.PlaneGeometry(130, 12).rotateX(-Math.PI / 2), this.riverMat); r.position.set(0, .04, RIVER_Z - 4); this.scene.add(r);
    const pebbles = new THREE.Group(); pebbles.userData.bake = true; this.scene.add(pebbles);
    for (let i = 0; i < 34; i++) pebbles.add(mk(sph(rand(.4, .8), 10, 8), pick([0xffffff, 0xffe3f1, 0xffd9a8]), [-60 + i * 3.6, .25, RIVER_Z + 2.4 + rand(-.3, .3)], [1, .6, 1]));

    // cliff + waterfall
    this.scene.add(mk(sph(18, 20, 12), 0xfff0e0, [0, -4, -34], [1.6, 1, .7]));
    this.fallMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } }, transparent: true,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: `uniform float uTime; varying vec2 vUv;
        void main(){ float s = fract(vUv.y*5. + uTime*1.3 + sin(vUv.x*18.+uTime)*.15);
          vec3 c = mix(vec3(.32,.16,.07), vec3(.58,.32,.15), smoothstep(.0,1.,s));
          c = mix(c, vec3(.85,.6,.4), smoothstep(.85,1.,s)*.5);
          float edge = smoothstep(.0,.08,vUv.x)*smoothstep(1.,.92,vUv.x);
          gl_FragColor = vec4(c, edge); }`,
    });
    const fall = new THREE.Mesh(new THREE.PlaneGeometry(10, 15), this.fallMat); fall.position.set(0, 7, -22); this.scene.add(fall);
    this.fall = fall;
    // candy pipes feeding the waterfall
    for (const s of [-1, 1]) { const p = mk(cyl(1.1, 1.1, 8, 14), toon(0xffffff, { map: candyCaneTex() }), [s * 8, 12, -22]); p.rotation.z = Math.PI / 2 * .0; this.scene.add(p); }
    this.mist = glowSprite(0xfff0dd, 14, .6); this.mist.position.set(0, 1, -21); this.scene.add(this.mist);
    this.addInteractive(fall, () => this.tapFall(), 8, [0, -1, 2]);
  }

  buildScenery() {
    // lollipop trees
    this.pops = [];
    [[-20, -5], [-12, -8], [20, -7], [11, -9], [-26, 4], [26, 10], [-7, -9.5]].forEach(([x, z], i) => {
      const g = new THREE.Group(); g.position.set(x, 0, z); this.scene.add(g);
      const h = rand(5, 7);
      g.add(mk(cyl(.2, .26, h, 8), toon(0xffffff, { map: candyCaneTex() }), [0, h / 2, 0]));
      const disc = mk(sph(1.9, 20, 14), toon(0xffffff, { map: swirlTex(pick(['#ff6fb5', '#ffd84d', '#62e0d0', '#b07cff']), '#fff') }), [0, h + 1.4, 0], [1, 1, .35]);
      disc.rotation.y = rand(-.4, .4); g.add(disc); g.userData.disc = disc; this.pops.push(g);
      this.addInteractive(g, () => this.tapPop(g), 2.4, [0, h + 1.2, 0]);
    });
    // cotton-candy trees
    [[-16, 8], [17, 8], [4, -9], [-27, 12]].forEach(([x, z]) => {
      const g = new THREE.Group(); g.position.set(x, 0, z); this.scene.add(g);
      g.add(mk(cyl(.25, .35, 3, 8), 0xa8683a, [0, 1.5, 0]));
      [[0, 4, 0, 1.8], [-1.1, 3.4, .4, 1.2], [1.1, 3.5, -.3, 1.3]].forEach(([a, b, c, r]) => g.add(mk(sph(r, 14, 10), toon(pick([0xffb3d9, 0xb8e8ff, 0xe3c8ff])), [a, b, c])));
      g.userData.bake = true;
      this.addInteractive(g, () => this.tapCotton(g), 2.4, [0, 3.6, 0]);
    });
    // gumdrop bushes
    for (let i = 0; i < 16; i++) {
      const g = new THREE.Group(); g.position.set(rand(-30, 30), 0, rand(-11, 15));
      if (Math.hypot(g.position.x - PAD.x, g.position.z - PAD.z) < 5) continue;
      const c = pick(CANDY); for (let k = 0; k < 3; k++) g.add(mk(sph(rand(.5, .8), 12, 8), c, [rand(-.7, .7), .35, rand(-.5, .5)], [1, .8, 1]));
      g.userData.bake = true;
      this.scene.add(g); this.addInteractive(g, () => this.tapBush(g), 1.5, [0, .6, 0]);
    }
    // giant mushrooms (bouncy!)
    this.mush = [];
    [[-9, 3], [8, 5], [-22, -2], [23, 3]].forEach(([x, z]) => {
      const g = new THREE.Group(); g.position.set(x, 0, z); this.scene.add(g);
      const real = null;   // (the Kenney mushroom looked too pale next to the candy, so we keep our own red-and-white one)
      let cap;
      if (real) { real.rotation.y = rand(0, 6); g.add(real); cap = real; }
      else {
        g.add(outline(mk(cyl(.5, .7, 2.2, 12), 0xfff4e0, [0, 1.1, 0]), 1.05));
        cap = outline(mk(sph(2, 20, 12), 0xff4d6d, [0, 2.4, 0], [1, .6, 1]), 1.03); cap.userData.dynamic = true; g.add(cap);
        for (let k = 0; k < 6; k++) { const a = k * 1.05; g.add(mk(sph(.28, 8, 6), 0xffffff, [Math.cos(a) * 1.2, 3.1 + Math.sin(a * 2) * .1, Math.sin(a) * 1.2], [1, .5, 1])); }
      }
      g.userData.cap = cap; g.userData.real = !!real; g.userData.bake = true; this.mush.push(g);
      this.addInteractive(g, () => this.tapMush(g), 2, [0, 2.2, 0]);
    });
    // singing daisies
    this.daisies = [];
    for (let i = 0; i < 7; i++) {
      const g = new THREE.Group(); g.position.set(-24 + i * 6 + rand(-1, 1), 0, rand(6, 12)); this.scene.add(g);
      g.add(mk(cyl(.07, .07, 2, 6), 0x3cc267, [0, 1, 0]));
      const f = new THREE.Group(); f.position.y = 2.1; g.add(f);
      const col = pick([0xff6fb5, 0xffffff, 0xffd84d, 0xb89cf8]);
      for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; f.add(mk(sph(.34, 8, 6), col, [Math.cos(a) * .55, Math.sin(a) * .55, 0], [1.3, .7, .4]).rotateZ(a)); }
      f.add(mk(sph(.28), 0xffc83d, [0, 0, .1]), mk(sph(.04), 0x5b3a24, [-.1, .05, .35]), mk(sph(.04), 0x5b3a24, [.1, .05, .35]));
      f.userData.bake = true;
      g.userData = { f, note: i, sway: 0 }; this.daisies.push(g);
      this.addInteractive(g, () => this.tapDaisy(g), 1.3, [0, 2, 0]);
    }
    // giant candy canes
    for (let i = 0; i < 6; i++) {
      const g = new THREE.Group(); g.position.set(-28 + i * 11 + rand(-2, 2), 0, rand(-12, -9));
      const m = toon(0xffffff, { map: candyCaneTex() });
      g.add(mk(cyl(.3, .3, 4, 10), m, [0, 2, 0]), mk(new THREE.TorusGeometry(.8, .3, 8, 16, Math.PI), m, [.8, 4, 0])); g.userData.bake = true;
      this.scene.add(g); this.addInteractive(g, () => this.tapCane(g), 1.7, [.4, 2.4, 0]);
    }
  }

  // --- things to eat ---
  buildEdibles() {
    const makers = [
      ['lollipop', '\u{1F36D}', () => { const g = new THREE.Group(); g.add(new THREE.Mesh(stripedGeo(sph(.8, 18, 12), CANDY, 10), vertexToon()), mk(cyl(.06, .06, 1.7, 6), 0xffffff, [0, -1.2, 0])); g.children[0].position.y = .6; g.position.y = 1.4; return g; }],
      ['cupcake', '\u{1F9C1}', () => { const g = new THREE.Group(); g.add(mk(cyl(.7, .5, .8, 14), 0xffd9a8, [0, .4, 0]), mk(sph(.8, 14, 10), 0xff9ecb, [0, 1.1, 0], [1, .8, 1]), mk(sph(.5, 12, 8), 0xffffff, [0, 1.6, 0], [1, .8, 1]), mk(sph(.22), 0xe8334a, [0, 2.0, 0])); return g; }],
      ['gumdrops', '\u{1F36C}', () => { const g = new THREE.Group(); [[0, 0, 0xff4d6d], [.9, .3, 0x5be37d], [-.8, .5, 0xffd84d]].forEach(([x, z, c]) => g.add(mk(sph(.6, 14, 10), c, [x, .5, z], [1, .85, 1]), mk(sph(.07), 0xffffff, [x, 1, z]))); return g; }],
      ['donut', '\u{1F369}', () => { const g = new THREE.Group(); const t = mk(new THREE.TorusGeometry(.7, .38, 14, 24), 0xe0a060, [0, 1.2, 0]); t.rotation.x = Math.PI / 2 - .5; const ic = mk(new THREE.TorusGeometry(.7, .4, 14, 24), 0xff6fb5, [0, 1.28, 0], [1, 1, .6]); ic.rotation.x = Math.PI / 2 - .5; g.add(t, ic); for (let i = 0; i < 10; i++) { const a = i * .63; const s = mk(new THREE.BoxGeometry(.18, .04, .04), pick(CANDY), [Math.cos(a) * .72, 1.5 - Math.cos(a) * .0, Math.sin(a) * .5 + .2]); g.add(s); } return g; }],
      ['choc', '\u{1F36B}', () => { const g = new THREE.Group(); g.add(mk(new THREE.BoxGeometry(1.6, .35, 1.1), 0x6b3a1f, [0, .6, 0])); for (let i = 0; i < 4; i++) g.add(mk(new THREE.BoxGeometry(.32, .05, .9), 0x8a4b2a, [-.5 + i * .33, .8, 0])); g.add(mk(new THREE.BoxGeometry(1.7, .3, .55), 0xff4d6d, [0, .55, .3])); g.rotation.x = -.4; g.position.y = .5; return g; }],
      ['cookie', '\u{1F36A}', () => { const g = new THREE.Group(); g.add(mk(cyl(.9, .9, .3, 20), 0xd9a05b, [0, .8, 0])); g.rotation.x = -.9; g.position.y = .6; for (let i = 0; i < 6; i++) g.add(mk(sph(.14, 6, 5), 0x4b2a14, [Math.cos(i * 1.1) * .5, 1, Math.sin(i * 1.1) * .5])); return g; }],
      ['cottoncandy', '\u{1F36C}', () => { const g = new THREE.Group(); g.add(mk(cyl(.05, .05, 1.8, 6), 0xffffff, [0, .9, 0])); [[0, 2, 0, .75], [.35, 1.7, .2, .5], [-.35, 1.75, -.1, .5], [0, 2.4, .1, .45]].forEach(([x, y, z, r]) => g.add(mk(sph(r, 12, 8), toon(0xffb3d9), [x, y, z]))); return g; }],
    ];
    const spots = [[-4, 4], [5, 2], [-8, 9], [10, 9], [-14, 3], [14, 12], [-2, 9.5], [0, -2], [-18, 9], [19, 5], [-12, -4], [8, -5], [3, 12], [-24, 8], [24, 7]];
    spots.forEach(([x, z], i) => {
      const [name, emoji, make] = makers[i % makers.length];
      const g = new THREE.Group(); g.position.set(x, 0, z);
      // the girls' favourites first: gummies, sour kids, nerd-style boxes, gummy worms, sour rings and straws, with a few treats from the real models mixed in
      const pickIt = ORDER[i % ORDER.length];
      let item, ename, eemoji;
      if (pickIt.startsWith('c:')) { const k = pickIt.slice(2); item = makeCandy(k); ename = k; eemoji = CANDY_KINDS[k].emoji; }
      else { const [mname, memoji, mh] = FOOD.find((f) => f[0] === pickIt.slice(2)) || FOOD[0]; item = model(`food/${mname}`, { size: mh * 0.7 / 1.35 }); ename = mname; eemoji = memoji; }
      if (!item) { item = make(); ename = name; eemoji = emoji; }
      g.add(item); g.scale.setScalar(1.35); item.userData.bake = true;
      g.userData = { name: ename, kind: ename, emoji: eemoji, eaten: false, idx: i, home: new THREE.Vector3(x, 0, z), item };
      this.scene.add(g); this.edibles.push(g);
      this.addInteractive(g, () => this.tapEdible(g), 1.5, [0, 1.1, 0]);
    });
  }

  buildPad() {
    const g = this.pad = new THREE.Group(); g.position.copy(PAD); this.scene.add(g);
    const tex = canvasTex(256, 256, (c, w, h) => {
      c.fillStyle = '#ff4fa0'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.beginPath(); c.arc(128, 128, 112, 0, 7); c.fill();
      c.fillStyle = '#7a4ed1'; c.beginPath(); c.arc(128, 128, 96, 0, 7); c.fill();
      c.fillStyle = '#fff'; c.font = 'bold 54px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('START', 128, 128);
    });
    g.add(mk(new THREE.CircleGeometry(2.8, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: tex }), [0, .06, 0]));
    this.padGlow = glowSprite(0xff9fe0, 9, .6); this.padGlow.position.y = 1.5; g.add(this.padGlow);
    RAINBOW.forEach((c, i) => { const a = mk(new THREE.TorusGeometry(3.6 - i * .28, .14, 8, 28, Math.PI), c, [0, 0, -3.2]); g.add(a); });
    this.addInteractive(g, () => this.tapRainbow(), 2.8, [0, 3.4, -3.2]);
    g.add(mk(cyl(.08, .08, 5, 6), 0xffffff, [3.4, 2.5, 0]), mk(new THREE.PlaneGeometry(1.6, .9), toon(0xff4fa0, { side: THREE.DoubleSide }), [4.2, 4.6, 0]));
    this.addInteractive(g, () => this.game.party.walkTo(PAD.x, PAD.z), 3.4, [0, 1.5, 0]);
  }

  // ===================================================================== flow
  enter() {
    const G = this.game, P = G.party;
    this.scene.add(P.group);
    P.ground = () => ({ y: 0, swim: 0 });
    P.bounds = { xmin: -28, xmax: 28, zmin: -9.5, zmax: 13 };
    P.speed = 4.8; P.frozen = false; P.target = null; P.setMode('idle');
    P.leader.root.position.set(0, 0, 9); P.follower.root.position.set(P.active === 'adalyn' ? 1.5 : -1.5, 0, 9.5);
    G.ui.hud(true, { swap: true, stars: true, icon: '\u{1F36C}' });
    G.ui.setStars(0);
    playMusic('choc');
    this.camera.position.set(0, 8.5, 22); this.look = new THREE.Vector3(0, 1.2, 6);
    G.ui.bubble('\u{1F43B} \u{1F36C} \u{1F36D}', 'Tap candy to eat it!');
    this.tm.after(5, () => G.ui.hideBubble());
    this.tm.after(5.5, () => this.startMission(0));
  }
  exit() { const m = document.getElementById('mission'); if (m) m.classList.add('hidden'); }

  // ===================================================================== counting missions (IM/ADM "counting collections")
  /** The Cat asks for a number of candies sized by the child's math level; a ten-frame fills one cell per candy eaten and the
   *  voice counts along. Level 4+: two collections, then "how many altogether?". The START pad works the whole time. */
  startMission(k) {
    if (this.starting || this.disposed) return;
    const who = this.game.party.active, lvl = levelOf(who, 'math'), R = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
    const goal = lvl <= 1 ? R(3, 5) : lvl <= 3 ? R(5, 10) : R(2, 5);
    const el = document.getElementById('mission'); el.classList.remove('hidden', 'done');
    this.mission = { who, lvl, k, goal, count: 0, done: false, show: renderShow(el, { frame: goal <= 5 ? 5 : 10, dots: 0 }) };
    this.game.ui.bubble('\u{1F431} \u{1F36C}', '', 'cat', false);
    voice(['cat_can_you_eat', `cat_n_${goal}`, 'cat_candies'], { priority: 2 }).then(() => this.tm.after(1.5, () => this.mission && !this.mission.done && this.game.ui.hideBubble()));
  }
  onEat() {
    const m = this.mission; if (!m || m.done) return;
    const c = m.show.cells[m.count]; if (c) { c.classList.add('dot'); }
    m.count++; voice(`n_${m.count}`, { priority: 1 });
    if (m.count >= m.goal) this.missionDone(m);
  }
  async missionDone(m) {
    m.done = true; const el = document.getElementById('mission'); el.classList.add('done');
    recordItem(m.who, `count:${m.goal}`, true, true); recordSkill(m.who, 'math', true, true);
    const P = this.game.party, hp = P.leader.root.position.clone().add(new THREE.Vector3(0, 2.6, 0));
    sfx.tada(); this.fx.burst(hp, { count: 70, colors: RAINBOW.concat(CANDY), speed: 7, gravity: -4, life: 1.8, size: 1 });
    this.game.ui.bubble('\u{1F431} \u{1F389}', '', 'cat', false);
    await this.alive(voice([`cat_n_${m.goal}`, 'cat_you_did_it'], { priority: 2 }));
    await this.wait(1.2); el.classList.add('hidden'); this.game.ui.hideBubble();
    if (m.k === 0) {
      if (m.lvl >= 4) { this.firstGoal = m.goal; await this.wait(1.5); this.startMission(1); }
      else this.tm.after(8, () => this.startMission(1));
    } else if (m.lvl >= 4 && this.firstGoal) {
      // two real collections -> an addition question about exactly those candies
      this.starting = true; this.game.party.target = null; this.game.ui.eat(false);
      await this.alive(ask(storyAdd(this.firstGoal, m.goal, { icon: '\u{1F36C}', iconAlt: '\u{1F36D}' }), m.who, { icon: '\u{1F36C}', iconAlt: '\u{1F36D}' }));
      this.starting = false;
    }
  }

  // ===================================================================== taps
  touch() { this.idle = 0; }
  onGround(p) {
    if (this.starting) return;
    this.touch();
    this.pending = null; this.game.ui.eat(false); this.shownEat = false;
    this.game.party.walkTo(p.x, p.z);
  }
  tapEdible(e) {
    if (e.userData.eaten || this.starting) return;
    this.touch(); sfx.pop();
    const P = this.game.party, side = P.leader.root.position.x < e.position.x ? -1.6 : 1.6;
    this.pending = e; this.shownEat = false; this.game.ui.eat(false);
    P.walkTo(e.position.x + side, e.position.z + .6);
    this.fx.burst(e.position.clone().add(new THREE.Vector3(0, 2.4, 0)), { count: 8, colors: [0xffffff, 0xffe14d], speed: 1.5, gravity: 0, life: .8, size: .6 });
  }
  showEat() {
    this.shownEat = true;
    this.game.ui.eat(true, this.pending.userData.emoji, () => this.eat(this.pending));
  }
  eat(e) {
    if (!e || e.userData.eaten) return;
    const G = this.game, P = G.party, L = P.leader;
    G.ui.eat(false); this.pending = null; e.userData.eaten = true;
    L.lookToward(e.position.x - L.root.position.x, e.position.z - L.root.position.z, 1);
    sfx.crunch(); sfx.yum();
    const crumbs = [0xffffff, 0xff9ecb, 0xffd84d, 0x8a4b2a];
    const at = e.position.clone().add(new THREE.Vector3(0, 1.6, 0));
    this.fx.burst(at, { count: 30, colors: crumbs, speed: 3.5, gravity: -9, life: .9, size: .5 });
    this.tm.tween(.9, (k) => {
      e.scale.setScalar(1.35 * (1 - ease.in(k)));
      L.fx.squash = 1 + Math.sin(k * Math.PI * 6) * .12;
    }, { ease: ease.linear, done: () => {
      L.fx.squash = 1; e.visible = false;
      this.eaten++; G.ui.setStars(this.eaten); G.eaten = (G.eaten || 0) + 1; this.onEat();
      const hp = L.root.position.clone().add(new THREE.Vector3(0, 2.4, 0));
      this.fx.burst(hp, { count: 14, colors: [0xff6f91, 0xff9fcb], speed: 2.5, gravity: 1.5, life: 1.5, size: .9 });
      if (this.eaten % 5 === 0) { sfx.tada(); this.fx.burst(hp, { count: 60, colors: RAINBOW.concat(CANDY), speed: 7, gravity: -4, life: 1.8, size: 1 }); G.ui.bubble('\u{1F36C}\u{1F389}', 'Yum yum!'); this.tm.after(2.5, () => G.ui.hideBubble()); }
      this.tm.after(9, () => this.respawn(e));
    } });
  }
  respawn(e) {
    e.visible = true; e.userData.eaten = false;
    this.tm.tween(.6, (k) => e.scale.setScalar(1.35 * k), { ease: ease.outBack });
    this.fx.burst(e.position.clone().add(new THREE.Vector3(0, 1.4, 0)), { count: 10, colors: [0xffffff], speed: 1.5, gravity: 0, life: .7, size: .5 });
  }
  /** Giant gummy bears sitting around the meadow: tap one and it jiggles like jelly. */
  buildGiantGummies() {
    this.gummies = [];
    [[-21, -6, 0xff3b5c], [22, -4, 0x4ddc5a], [-6, -8.8, 0xffd32a], [12, -9.2, 0x36a8ff], [-27, 6, 0xb35cff]].forEach(([x, z, c]) => {
      const g = makeCandy('gummyBear'); g.position.set(x, 0, z); g.scale.setScalar(2.6); g.rotation.y = rand(-.6, .6);
      const recol = new Map();      // one recoloured copy per original material, so the bear still merges into a few meshes
      g.traverse((o) => { if (o.isMesh && o.material && o.material.clearcoat && o.material.emissive) { if (!recol.has(o.material)) { const m = o.material.clone(); m.color.set(c); m.emissive.set(c); recol.set(o.material, m); } o.material = recol.get(o.material); } });
      g.userData.bake = true;
      this.scene.add(g); this.gummies.push(g);
      this.addInteractive(g, () => this.tapGummy(g), 1.3, [0, 1.1, 0]);
    });
  }
  tapGummy(g) {
    this.touch(); sfx.boing(); sfx.giggle();
    const s = g.scale.x;
    this.tm.tween(1.1, (k) => { const w = Math.sin(k * Math.PI * 5) * .14 * (1 - k); g.scale.set(s * (1 + w), s * (1 - w * 1.3), s * (1 + w)); }, { ease: ease.linear, done: () => g.scale.setScalar(s) });
    this.fx.burst(g.position.clone().add(new THREE.Vector3(0, 6, 0)), { count: 26, colors: [0xff3b5c, 0xffd32a, 0x4ddc5a, 0x36a8ff, 0xffffff], speed: 4, gravity: -3, life: 1.4, size: 1 });
  }

  tapMush(m) {
    this.touch(); sfx.boing();
    this.fx.burst(m.position.clone().add(new THREE.Vector3(0, 3.5, 0)), { count: 24, colors: [0xff4d6d, 0xffffff, 0xffe14d], speed: 4, gravity: -5, life: 1.1 });
    const cap = m.userData.cap, real = m.userData.real, b = real ? cap.userData.baseScale : 1;
    this.tm.tween(.8, (k) => {
      const w = Math.sin(k * Math.PI * 4) * .18 * (1 - k);
      if (real) cap.scale.set(b * (1 + w), b * (1 - w * 1.2), b * (1 + w));      // squash and stretch the whole mushroom
      else cap.scale.set(1 + w, .6 - w * 1.1, 1 + w);
    });
  }
  tapDaisy(d) {
    this.touch(); sfx.note(d.userData.note);
    this.fx.burst(d.position.clone().add(new THREE.Vector3(0, 3, 0)), { count: 10, colors: [0xffe14d, 0xff9fcb, 0xffffff], speed: 2.5, gravity: 1, life: 1.1, size: .7 });
    d.userData.sway = 1;
  }
  tapPop(p) {
    this.touch(); sfx.sparkle();
    this.tm.tween(1, (k) => { p.userData.disc.rotation.z = k * Math.PI * 6; }, { ease: ease.out });
    this.fx.burst(p.position.clone().add(new THREE.Vector3(0, 7, 0)), { count: 30, colors: CANDY, speed: 5, gravity: -3, life: 1.3 });
  }
  // ---- more things that react when tapped ----
  tapHill(h) {                       // hills wobble like jelly and giggle
    this.touch(); sfx.boing(); sfx.giggle();
    const s = h.scale.clone();
    this.tm.tween(1.1, (k) => { const w = Math.sin(k * Math.PI * 5) * .12 * (1 - k); h.scale.set(s.x * (1 + w), s.y * (1 - w * 1.4), s.z * (1 + w)); }, { ease: ease.linear, done: () => h.scale.copy(s) });
    this.fx.burst(h.position.clone().add(new THREE.Vector3(0, h.scale.y * 14, 6)), { count: 24, colors: CANDY, speed: 6, gravity: -3, life: 1.4, size: 1 });
  }
  tapBar(bar, i) {                   // the chocolate-bar fence is a piano: every bar has its own note
    this.touch(); sfx.note(i);
    const y = bar.position.y;
    this.tm.tween(.35, (k) => { bar.position.y = y + Math.sin(k * Math.PI) * .9; bar.rotation.z = Math.sin(k * Math.PI * 2) * .12; }, { ease: ease.linear, done: () => { bar.position.y = y; bar.rotation.z = 0; } });
    this.fx.burst(bar.position.clone().add(new THREE.Vector3(0, 1, 0)), { count: 8, colors: [0xffd84d, 0xffffff, 0xff9fcb], speed: 2.5, gravity: -2, life: .9, size: .6 });
  }
  tapCotton(g) {                     // cotton candy trees puff out a cloud of sweet fluff
    this.touch(); sfx.pop(); sfx.sparkle();
    this.fx.burst(g.position.clone().add(new THREE.Vector3(0, 4, 0)), { count: 70, colors: [0xffb3d9, 0xb8e8ff, 0xe3c8ff, 0xffffff], speed: 5, up: 2, gravity: -1, life: 2, size: 1.3 });
    this.tm.tween(.7, (k) => { const w = Math.sin(k * Math.PI * 4) * .12 * (1 - k); g.scale.set(1 + w, 1 - w, 1 + w); }, { ease: ease.linear, done: () => g.scale.set(1, 1, 1) });
  }
  tapBush(g) {                       // gumdrop bushes are trampolines
    this.touch(); sfx.boing();
    this.tm.tween(.7, (k) => { g.position.y = Math.abs(Math.sin(k * Math.PI)) * 2.6 * (1 - k * .3); const sq = 1 + Math.sin(k * Math.PI * 2) * .12; g.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq)); }, { ease: ease.linear, done: () => { g.position.y = 0; g.scale.set(1, 1, 1); } });
    this.fx.burst(g.position.clone().add(new THREE.Vector3(0, 1.5, 0)), { count: 22, colors: CANDY, speed: 4, gravity: -5, life: 1, size: .8 });
  }
  tapCane(g) {                       // candy canes ring like bells
    this.touch(); sfx.chime(); sfx.note(2 + Math.floor(Math.random() * 3));
    this.tm.tween(1, (k) => { g.rotation.z = Math.sin(k * 26) * .1 * (1 - k); }, { ease: ease.linear, done: () => (g.rotation.z = 0) });
    this.fx.burst(g.position.clone().add(new THREE.Vector3(.8, 4.2, 0)), { count: 24, colors: [0xff4d6d, 0xffffff], speed: 3.5, gravity: -3, life: 1.2, size: .8 });
  }
  tapRainbow() {                     // the rainbow shimmers
    this.touch(); sfx.tada(); sfx.magic();
    for (let i = 0; i < 8; i++) this.tm.after(i * .06, () => this.fx.burst(PAD.clone().add(new THREE.Vector3(Math.cos(i / 7 * Math.PI) * 3.4, Math.sin(i / 7 * Math.PI) * 3.4, -3.2)), { count: 10, colors: RAINBOW, speed: 2, gravity: -1, life: 1.4, size: 1 }));
  }
  tapCloud(c) {                      // tap a cloud and it sprinkles candy
    this.touch(); sfx.giggle(); sfx.sparkle();
    for (let i = 0; i < 5; i++) this.tm.after(i * .12, () => this.fx.burst(c.position.clone().add(new THREE.Vector3(rand(-8, 8), -2, rand(-2, 2))), { count: 40, colors: CANDY.concat(RAINBOW), speed: 2, gravity: -9, life: 3, size: 2.6 }));
  }

  tapFall() {
    this.touch(); sfx.splash(); sfx.giggle();
    this.fx.burst(new THREE.Vector3(rand(-2, 2), 2, -19), { count: 60, colors: [0x8a4b2a, 0xffffff, 0xd9a05b], speed: 7, up: 4, gravity: -9, life: 1.4, size: .9 });
  }

  // ===================================================================== update
  update(dt) {
    super.update(dt);
    const t = this.time, G = this.game, P = G.party;
    this.riverMat.uniforms.uTime.value = t; this.fallMat.uniforms.uTime.value = t;
    this.clouds.forEach((c) => { c.position.x += dt * .9; if (c.position.x > 170) c.position.x = -170; });
    this.mist.material.opacity = .45 + Math.sin(t * 2) * .12;
    this.rays.children.forEach((r, i) => { r.material.opacity = .07 + Math.sin(t * .6 + i * 1.7) * .035; });
    this.rays.position.x = this.camera.position.x * .6;
    if (Math.random() < dt * 22) {          // drifting sugar sparkles
      const c = this.camera.position;
      this.fx.burst(_a.set(c.x + rand(-22, 22), rand(.5, 9), c.z - rand(2, 26)), { count: 1, colors: [0xffffff, 0xffd9ec, 0xfff0a0, 0xd9f0ff], speed: .25, up: .1, gravity: 0, life: 3.2, size: .42 });
    }
    if (Math.random() < dt * 8) this.fx.burst(_a.set(rand(-4, 4), .5, -19.5), { count: 1, colors: [0xffffff, 0xd9a05b], speed: 1, up: 1.5, gravity: -1, life: 1, size: .8 });
    this.pops.forEach((p, i) => { p.userData.disc.rotation.z += dt * .15 * (i % 2 ? 1 : -1); });
    this.daisies.forEach((d) => { const u = d.userData; u.sway = Math.max(0, u.sway - dt); d.rotation.z = Math.sin(t * 2 + u.note) * .04 + Math.sin(t * 25) * .12 * u.sway; u.f.rotation.z = t * (.3 + u.sway * 6); });
    this.edibles.forEach((e) => { if (!e.userData.eaten) e.userData.item.rotation.y += dt * .6; });
    this.padGlow.material.opacity = .45 + Math.sin(t * 3) * .2;
    this.pad.rotation.y = 0;

    // reach a pending candy -> show the EAT button
    if (this.pending && !this.shownEat && !P.target) {
      const L = P.leader.root.position;
      if (Math.hypot(L.x - this.pending.position.x, L.z - this.pending.position.z) < 3.4) this.showEat();
    }

    // START pad
    if (!this.starting && !P.target) {
      const L = P.leader.root.position;
      if (Math.hypot(L.x - PAD.x, L.z - PAD.z) < 2.6) this.askStart();
    }
    this.idle += dt;
    if ((this.eaten >= 4 || this.idle > 40) && !this.hintOn && !this.starting) { this.hintOn = true; G.ui.hint('\u{1F449}'); }
    if (this.hintOn) { const s = this.toScreen(PAD.clone().add(new THREE.Vector3(0, 6, 0))); G.ui.hintAt(s.x, s.y); }

    P.update(dt, t);
    const L = P.leader.root.position, k = 1 - Math.exp(-3 * dt), gx = clamp(L.x, -26, 26);
    this.camera.position.lerp(_a.set(gx, 8.5, L.z + 13), k);
    this.look.lerp(_b.set(gx, 1.2, L.z - 3), k);
    this.camera.lookAt(this.look);
  }

  askStart() {
    this.starting = true;
    const G = this.game;
    G.ui.eat(false); G.ui.hideHint(); this.hintOn = false;
    sfx.chime();
    G.ui.message('\u{1F3B2}\u{1F3C1}', 'Ready to play Candyland?', "Let's go!", () => {
      sfx.tada(); G.party.frozen = true; G.goto('board', { flash: '#ffd9f0' });
    }, 'Not yet', () => { G.party.walkTo(PAD.x - 6, PAD.z + 3); this.tm.after(1.5, () => (this.starting = false)); });
  }
}
