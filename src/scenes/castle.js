import * as THREE from 'three';
import { BaseScene } from '../scene-base.js';
import { toon, mk, outline, rand, pick, clamp, lerp, ease, glowSprite, canvasTex, candyCaneTex, setStyle, shade, bakeStatic, RAINBOW, CANDY } from '../util.js';
import { sfx, playMusic, voice, level, currentSpeaker } from '../audio.js';
import { makeGift } from '../candies.js';
import { earn } from '../engine/sticker.js';

const sph = (r, w = 18, h = 12) => new THREE.SphereGeometry(r, w, h);
const cyl = (rt, rb, h, s = 14) => new THREE.CylinderGeometry(rt, rb, h, s);

/** The King or the Queen. */
function makeRoyal(kind) {
  const king = kind === 'king', g = new THREE.Group();
  const robe = king ? 0x7a4ed1 : 0xff6fb5, skin = king ? 0xe8b88e : 0xf1c9a5;
  g.add(outline(mk(cyl(.4, king ? 1.0 : 1.3, 2.3), robe, [0, 1.15, 0]), 1.04));
  g.add(mk(new THREE.TorusGeometry(.5, .17, 8, 20), 0xffffff, [0, 2.2, 0]).rotateX(Math.PI / 2));
  g.add(mk(new THREE.TorusGeometry(.62, .06, 8, 24), 0xffc83d, [0, 1.3, 0]).rotateX(Math.PI / 2));
  for (const s of [-1, 1]) g.add(mk(cyl(.07, .07, 1.5, 8), 0xffffff, [s * (king ? .9 : 1.2) * .5, 1.1, 0.0]).rotateZ(s * .08));
  const head = outline(mk(sph(.55), skin, [0, 2.8, 0]), 1.04); g.add(head);
  if (king) {
    g.add(mk(sph(.5), 0xdddddd, [0, 2.95, -.1], [1, .8, 1]));                                    // grey hair
    [[0, 2.45], [-.28, 2.4], [.28, 2.4], [-.15, 2.28], [.15, 2.28], [0, 2.22]].forEach(([x, y]) => g.add(mk(sph(.22), 0xffffff, [x, y, .38])));   // beard
    g.add(mk(sph(.2), 0xffffff, [-.2, 2.68, .5], [1.6, .6, .8]), mk(sph(.2), 0xffffff, [.2, 2.68, .5], [1.6, .6, .8]));
  } else {
    g.add(mk(sph(.62), 0xd9a05b, [0, 2.75, -.2], [1, 1.1, .8]), mk(sph(.3), 0xd9a05b, [0, 2.2, -.4], [1.3, 2, .6]));
    g.add(mk(sph(.35), 0xd9a05b, [0, 3.18, .22], [1.1, .5, .7]));
  }
  const eyes = [];
  for (const s of [-1, 1]) { const e = mk(sph(.07), 0x3a2315, [s * .2, 2.85, .5], [1, 1.3, .5]); eyes.push(e); g.add(e, mk(sph(.08), 0xff9a9a, [s * .33, 2.68, .45], [1, .6, .4])); }
  const sm = mk(new THREE.TorusGeometry(.12, .02, 6, 12, Math.PI), 0xc0504d, [0, 2.65, .52]); sm.rotation.z = Math.PI; g.add(sm);
  Object.assign(g.userData, { eyes, smile: sm, who: kind, blinkT: 1 + Math.random() * 3, blink: 0 });
  const crown = new THREE.Group(); crown.position.set(0, 3.38, 0); g.add(crown);
  crown.add(mk(cyl(.4, .36, .25, 16), 0xffd84d));
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; crown.add(mk(new THREE.ConeGeometry(.12, .3, 6), 0xffd84d, [Math.cos(a) * .36, .25, Math.sin(a) * .36]), mk(sph(.07), pick([0xff4d6d, 0x4db8ff, 0x5be37d]), [Math.cos(a) * .36, .42, Math.sin(a) * .36])); }
  const arm = new THREE.Group(); arm.position.set(.5, 2.0, 0); arm.add(mk(new THREE.CapsuleGeometry(.1, .6, 4, 8), robe, [0, .35, 0]), mk(sph(.13), skin, [0, .82, 0])); g.add(arm);
  const arm2 = mk(new THREE.CapsuleGeometry(.1, .6, 4, 8), robe, [-.55, 1.8, .2]); arm2.rotation.z = .5; g.add(arm2);
  g.userData.arm = arm;
  return g;
}

export class CastleScene extends BaseScene {
  constructor(game) {
    super(game);
    this.hfov = 80;
    this.stage = 'walk-in';
    setStyle('candy');                      // same glossy film look as the candy world
    try { this.build(); } finally { setStyle('toon'); }
    this.scene.environment = game.env('castle'); this.scene.environmentIntensity = 0.35;
    this.scene.add(new THREE.HemisphereLight(0xfff4e8, 0xffc8e8, 0.35));
    const d = new THREE.DirectionalLight(0xfff0d6, 1.4); d.position.set(0, 14, 12); this.scene.add(d);
    this.useShadows(d, 22);
    this.scene.children.forEach((c) => { if (c.isGroup && !c.userData.noShadow) shade(c); });
    this.camera.position.set(0, 5, 14); this.camera.lookAt(0, 3.6, -6);
  }

  build() {
    this.scene.background = new THREE.Color(0xe98fb5);
    const floor = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#e9cfae'; g.fillRect(0, 0, w, h); g.fillStyle = '#e88ab4'; g.fillRect(0, 0, w / 2, h / 2); g.fillRect(w / 2, h / 2, w / 2, h / 2); }, [8, 8]);
    this.scene.add(mk(new THREE.PlaneGeometry(40, 40).rotateX(-Math.PI / 2), toon(0xffffff, { map: floor }), [0, 0, -4]));
    this.scene.add(mk(new THREE.PlaneGeometry(6, 40).rotateX(-Math.PI / 2), 0xe0405f, [0, .02, -4]));                    // red carpet
    this.scene.add(mk(new THREE.PlaneGeometry(6.6, 40).rotateX(-Math.PI / 2), 0xffc83d, [0, .015, -4]));
    // back wall with stained glass
    this.scene.add(mk(new THREE.PlaneGeometry(44, 26), 0xe48ab4, [0, 12, -16]));
    [[-12, 0x4db8ff], [-6, 0xff6f91], [0, 0xffd84d], [6, 0x5be37d], [12, 0xb07cff]].forEach(([x, c], i) => {
      const w = mk(sph(2.4, 20, 12), new THREE.MeshBasicMaterial({ color: c }), [x, 13, -15.8], [1, 1.9, .05]); this.scene.add(w);
      const gl = glowSprite(0xffffff, 8, .15); gl.position.set(x, 13, -15.3); this.scene.add(gl);
    });
    // pillars and banners
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
      const p = mk(cyl(.7, .8, 14, 14), toon(0xffffff, { map: candyCaneTex() }), [s * 11, 7, -2 - i * 4]); this.scene.add(p);
      this.scene.add(mk(new THREE.PlaneGeometry(1.6, 4), toon(pick([0xff6f91, 0x4db8ff, 0xffd84d, 0xb07cff]), { side: THREE.DoubleSide }), [s * 9.5, 9, -2 - i * 4]));
    }
    // dais and thrones
    for (let i = 0; i < 3; i++) this.scene.add(mk(new THREE.BoxGeometry(18 - i * 2, .5, 6 - i), i % 2 ? 0xff9ecb : 0xffffff, [0, .25 + i * .5, -11 + i * 1.1 - (i ? 0 : 0)]));
    [-4.5, 4.5].forEach((x, i) => {
      const t = new THREE.Group(); t.position.set(x, 1.5, -12.5); this.scene.add(t);
      t.add(outline(mk(new THREE.BoxGeometry(3.6, 1.4, 3), 0xc0392b, [0, .7, 0]), 1.02), outline(mk(new THREE.BoxGeometry(3.6, 5.5, .6), 0xc0392b, [0, 3.4, -1.2]), 1.02), mk(new THREE.BoxGeometry(3, .5, 2.6), 0xff6f91, [0, 1.6, .1]));
      t.add(mk(sph(.4), 0xffc83d, [-1.8, 6.2, -1.2]), mk(sph(.4), 0xffc83d, [1.8, 6.2, -1.2]), mk(new THREE.ConeGeometry(.9, 1.3, 3), 0xffc83d, [0, 6.6, -1.2]));
    });
    this.king = makeRoyal('king'); this.king.position.set(-5, 1.5, -9.4); this.king.scale.setScalar(1.25); this.scene.add(this.king);
    this.queen = makeRoyal('queen'); this.queen.position.set(5, 1.5, -9.4); this.queen.scale.setScalar(1.25); this.scene.add(this.queen);
    this.addInteractive(this.king, () => this.wave(this.king), 2, [0, 2.5, 0]);
    this.addInteractive(this.queen, () => this.wave(this.queen), 2, [0, 2.5, 0]);
    // hanging candy lights
    for (let i = 0; i < 8; i++) { const l = mk(sph(.5), pick(CANDY), [-14 + i * 4, 15, -8 - (i % 3) * 2]); l.add(glowSprite(0xffffff, 3, .5)); this.scene.add(l); }

    // the swirly way home
    this.portalMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: { uTime: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: `uniform float uTime; varying vec2 vUv;
        void main(){ vec2 p=(vUv-.5)*2.; float r=length(p), a=atan(p.y,p.x); float sw=a*2.+log(r+.03)*3.-uTime*3.; float b=sin(sw*3.)*.5+.5;
          vec3 c=mix(vec3(1.,.42,.72), vec3(.3,.88,.98), b); c=mix(vec3(1.,.95,.6), c, smoothstep(0.,.3,r)); gl_FragColor=vec4(c, 1.-smoothstep(.85,1.,r)); }`,
    });
    this.portal = new THREE.Mesh(new THREE.CircleGeometry(3.2, 48), this.portalMat);
    this.portal.position.set(0, 3.4, 1.5); this.portal.scale.setScalar(.001); this.scene.add(this.portal);
    this.addInteractive(this.portal, () => this.stage === 'portal' && this.game.party.walkTo(0, 1.4), 3.4);
  }

  wave(r) {
    sfx.babble(5); const a = r.userData.arm;
    this.fx.burst(r.position.clone().add(new THREE.Vector3(0, 5, 1)), { count: 14, colors: [0xffd84d, 0xffffff, 0xff9fcb], speed: 3, gravity: -2, life: 1.2, size: .8 });
    this.tm.tween(1.4, (k) => { a.rotation.z = -2.4 + Math.sin(k * 30) * .35; }, { done: () => (a.rotation.z = 0) });
  }

  // ===================================================================== flow
  enter() {
    const G = this.game, P = G.party;
    this.scene.add(P.group);
    P.ground = () => ({ y: 0, swim: 0 });
    P.bounds = { xmin: -9, xmax: 9, zmin: -6, zmax: 9 };
    P.frozen = false; P.setMode('idle'); P.target = null;

    P.both().forEach((t) => { t.root.scale.setScalar(1); t.fx.lift = 0; t.fx.spin = 0; t.fx.squash = 1; t.root.rotation.set(0, 0, 0); t.face = 0; t.body.rotation.set(0, 0, 0); });
    P.leader.root.position.set(-1.2, 0, 11); P.follower.root.position.set(1.2, 0, 11);
    G.ui.hud(false); G.ui.progress(false);
    playMusic('castle');
    P.walkTo(0, -2);
    const ui = G.ui;
    this.ceremony(ui, P);
  }

  /** each line waits for the one before it to finish (and the walk-in to land) */
  async ceremony(ui, P) {
    ui.bubble('\u{1F3F0} \u{1F451}', 'The castle!');
    await this.wait(4.5);
    this.stage = 'greet'; this.wave(this.king); this.wave(this.queen); sfx.fanfare(); this.confetti(); P.both().forEach((t) => (t.mode = 'cheer'));
    ui.bubble('\u{1F451}\u{1F389}\u{1F389}', 'Congratulations Adalyn and Esmae!', 'king', false);
    await this.line('Congratulations Adalyn and Esmae!', 'king', { priority: 2, minMs: 2500 }); await this.wait(.4);
    earn('adalyn', 'castle-crown'); earn('esmae', 'castle-crown');
    // the tunnel stars pay off: the King names how many they caught (counting to 10, incidentally)
    const stars = Math.min(10, this.game.stars || 0);
    if (stars > 0) { ui.bubble('\u2B50'.repeat(Math.min(stars, 5)), '', 'king', false); await this.alive(voice(['you_caught', `n_${stars}`, 'stars_in_tunnel'], { priority: 2 })); await this.wait(.3); }
    ui.bubble('\u{1F36C} \u{1F69A} \u{1F3E0}', 'Your candy is on its way to your house!', 'queen', false); sfx.babble(9); this.wave(this.queen); P.both().forEach((t) => (t.mode = 'idle'));
    await this.line('Your candy is on its way to your house!', 'queen', { priority: 2, minMs: 2500 }); await this.wait(.3);
    await this.countCandy(Math.min(10, this.game.eaten || 0));
    await this.wait(.4);
    ui.bubble('\u{1F3E0} \u{1F4A4}', 'Time to go home!', 'king', false); sfx.magic(); this.openPortal();
    await this.line('Time to go home!', 'king', { priority: 2 });
  }

  /** every candy they ate in the meadow drops into a gift box, and the voice counts them: one... two... three... */
  async countCandy(n) {
    if (n <= 0) return;
    const box = makeGift(0xff6fb5); box.scale.setScalar(1.6); box.position.set(0, 1.5, -6.5); shade(box); bakeStatic(box); this.scene.add(box);
    this.tm.tween(.5, (k) => box.scale.setScalar(1.6 * ease.outBack(k)));
    await this.wait(.6);
    for (let i = 1; i <= n; i++) {
      const g = mk(new THREE.SphereGeometry(.32, 14, 10), pick(CANDY), [rand(-1, 1), 7, -6.5], [1, .85, 1]); this.scene.add(g);
      this.tm.tween(.55, (k) => { g.position.y = 7 - ease.in(k) * 4.6; }, { ease: ease.linear, done: () => { g.visible = false; sfx.pop(); this.fx.burst(new THREE.Vector3(0, 3, -6.2), { count: 6, colors: CANDY, speed: 2, gravity: -3, life: .6, size: .6 }); } });
      await this.alive(voice(`n_${i}`, { priority: 2, minMs: 600 }));
    }
    await this.alive(voice('yum_count_done', { priority: 2 }));
  }
  confetti() {
    for (let i = 0; i < 6; i++) this.tm.after(i * .35, () => this.fx.burst(new THREE.Vector3(rand(-8, 8), rand(9, 13), rand(-8, 2)), { count: 60, colors: RAINBOW.concat(CANDY), speed: 5, gravity: -6, life: 2.4, size: .8 }));
  }

  openPortal() {
    this.stage = 'portal';
    this.tm.tween(1.2, (k) => this.portal.scale.setScalar(Math.max(.001, k)), { ease: ease.outBack });
    this.tm.after(3.5, () => this.game.party.walkTo(0, 1.4));
  }

  update(dt) {
    super.update(dt);
    const t = this.time, G = this.game, P = G.party;
    this.portalMat.uniforms.uTime.value = t;
    P.update(dt, t);
    this.king.userData.arm.rotation.z += (0 - this.king.userData.arm.rotation.z) * dt * 2;
    [this.king, this.queen].forEach((r, i) => {
      r.position.y = 1.5 + Math.sin(t * 2 + i) * .04;
      const u = r.userData, amp = currentSpeaker() === u.who ? level.v : 0;
      u.smile.scale.set(1 + amp * .5, 1 + amp * 2, 1);
      u.blinkT -= dt; if (u.blinkT < 0) { u.blinkT = 2.5 + Math.random() * 3.5; u.blink = .14; }
      u.blink = Math.max(0, u.blink - dt); u.eyes.forEach((e) => (e.scale.y = u.blink > 0 ? .15 : 1.3));
    });
    if (this.stage === 'portal' && !this.leaving) {
      const L = P.leader.root.position;
      if (Math.hypot(L.x - 0, L.z - 1.4) < 1.3) {
        this.leaving = true; P.frozen = true; sfx.whoosh(1.2); sfx.sparkle();
        this.fx.burst(new THREE.Vector3(0, 3, 1.6), { count: 80, colors: RAINBOW, speed: 7, gravity: 0, life: 1.4, size: 1 });
        this.tm.tween(.9, (k) => P.both().forEach((tw) => { tw.root.scale.setScalar(1 - k * .9); tw.fx.spin = k * Math.PI * 6; tw.root.position.y = k * 2; }), { ease: ease.in, done: () => G.goto('warp', { flash: '#fff6c8' }) });
      }
    }
  }
}
