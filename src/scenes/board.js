import * as THREE from 'three';
import { BaseScene } from '../scene-base.js';
import { toon, mk, outline, rand, pick, clamp, lerp, ease, glowSprite, canvasTex, stripedGeo, vertexToon, candyCaneTex, swirlTex, setStyle, shade, RAINBOW, CANDY } from '../util.js';
import { sfx, playMusic } from '../audio.js';
import { model } from '../assets.js';

const sph = (r, w = 16, h = 12) => new THREE.SphereGeometry(r, w, h);
const cyl = (rt, rb, h, s = 12) => new THREE.CylinderGeometry(rt, rb, h, s);
const N = 40;                                      // squares on the board (0 = start, N-1 = castle gate)
const TILE_COLS = [0xff4d6d, 0xb07cff, 0xffd84d, 0x4db8ff, 0xff9f2e, 0x5be37d];   // candyland colours
const WORDS = ['', 'one', 'two', 'three', 'four', 'five', 'six'];
const KEYCAP = (n) => `${n}️⃣`;

// ---- what each square does ----
const TYPES = Array(N).fill('normal');
const setT = (arr, t) => arr.forEach((i) => (TYPES[i] = t));
setT([4, 11, 25, 33], 'gum');        // gumdrop jump: bounce ahead 3
setT([14], 'rainbow');               // rainbow trail: big jump ahead 8
setT([19, 30], 'rush');              // sugar rush: roll again
setT([8, 23, 35], 'licorice');       // licorice slide: slide back 3
setT([16, 31], 'molasses');          // gooey molasses: stuck for a turn
TYPES[0] = 'start'; TYPES[N - 1] = 'finish';
const ICON = { gum: '\u{1F36C}', rainbow: '\u{1F308}', rush: '\u{1F3B2}', licorice: '\u{1F5A4}', molasses: '\u{1F36F}' };
const SPECIAL_COL = { gum: 0xffd84d, rainbow: 0xffffff, rush: 0x62e0d0, licorice: 0x2b2b3a, molasses: 0x8a4b2a, start: 0xffffff, finish: 0xffd84d };

const PATH = [[-34, 0, 22], [-24, .5, 20], [-14, 1.5, 22], [-4, 2, 18], [6, 1.5, 20], [16, 1, 16], [22, .5, 8], [16, .5, 0], [6, 1, -2], [-4, 2, 0],
  [-14, 2.5, -4], [-24, 2, -10], [-20, 1, -20], [-10, .5, -26], [0, 1, -24], [10, 2, -28], [20, 2.5, -32], [30, 1.5, -30], [36, 1, -22]];

const PIPS = { 1: [[1, 1]], 2: [[0, 0], [2, 2]], 3: [[0, 0], [1, 1], [2, 2]], 4: [[0, 0], [2, 0], [0, 2], [2, 2]], 5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]], 6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]] };
const FACE_N = { 1: [0, 1, 0], 2: [1, 0, 0], 3: [0, 0, 1], 4: [0, 0, -1], 5: [-1, 0, 0], 6: [0, -1, 0] };
const FACE_ORDER = [2, 5, 1, 6, 3, 4];             // box material order: +x -x +y -y +z -z

function emojiSprite(ch, size = 2.4) {
  const tex = canvasTex(128, 128, (g, w, h) => { g.font = '96px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, w / 2, h / 2 + 6); });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set(size, size, 1);
  return s;
}

export class BoardScene extends BaseScene {
  constructor(game) {
    super(game);
    this.hfov = 74;
    this.state = 'intro';
    this.rollResolve = null;
    this.over = false;
    this.camTarget = new THREE.Vector3();
    setStyle('candy');                      // glossy candy world
    try { this.buildPath(); this.buildWorld(); this.buildDice(); } finally { setStyle('toon'); }
    this.scene.environment = game.env('candy'); this.scene.environmentIntensity = 0.4;
    this.scene.fog = new THREE.Fog(0xffe9f3, 140, 360);
    this.scene.add(new THREE.HemisphereLight(0xfff6e8, 0xffc0e0, 0.4));
    const d = new THREE.DirectionalLight(0xfff0d6, 2.3); d.position.set(18, 34, 20); this.scene.add(d);
    this.useShadows(d, 30);
    this.scene.children.forEach((c) => { if (c.isGroup && !c.userData.noShadow) shade(c); });
    this.tileMeshes.forEach((g) => { g.userData.noShadow = false; });
    shade(this.dice);
  }

  // ===================================================================== build
  buildPath() {
    const curve = new THREE.CatmullRomCurve3(PATH.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', .5);
    this.curve = curve;
    this.tiles = curve.getSpacedPoints(N - 1);
    // candy path ribbon under the squares
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 260, .7, 8), toon(0xfff1d6));
    tube.position.y = -.1; this.scene.add(tube);
    this.tileMeshes = [];
    this.tiles.forEach((p, i) => {
      const type = TYPES[i], col = type === 'normal' ? TILE_COLS[i % TILE_COLS.length] : SPECIAL_COL[type];
      const g = new THREE.Group(); g.position.copy(p); this.scene.add(g);
      g.add(outline(mk(cyl(2.1, 2.2, .6, 28), 0xffffff, [0, 0, 0]), 1.03));
      g.add(mk(cyl(1.75, 1.75, .62, 28), col, [0, .02, 0]));
      if (type === 'rainbow') RAINBOW.forEach((c, k) => { const r = mk(new THREE.TorusGeometry(1.5 - k * .22, .12, 6, 24), c, [0, .34, 0]); r.rotation.x = Math.PI / 2; g.add(r); });
      if (type === 'normal' && i % 2) g.add(mk(cyl(.6, .6, .64, 16), 0xffffff, [0, .03, 0]));
      if (ICON[type]) { const s = emojiSprite(ICON[type], 3); s.position.y = 3.2; g.add(s); g.userData.icon = s; }
      if (p.y > .6) g.add(mk(cyl(.3, .3, p.y + .7, 8), toon(0xffffff, { map: candyCaneTex() }), [0, -(p.y + .7) / 2 - .3, 0]));
      this.tileMeshes.push(g);
      if (ICON[type]) this.addInteractive(g, () => this.tapTile(type, g), 2.4, [0, 2.4, 0]);
    });
    const start = this.tileMeshes[0]; const s = emojiSprite('\u{1F3C1}', 4); s.position.y = 4; start.add(s);
  }

  slot(idx, who) { const p = this.tiles[idx]; return new THREE.Vector3(p.x + (who ? .8 : -.8), p.y + .31, p.z); }

  buildWorld() {
    // sky
    this.scene.add(new THREE.Mesh(new THREE.SphereGeometry(700, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: `varying vec3 vP; void main(){ float h = clamp(vP.y*1.5+.1,0.,1.); gl_FragColor = vec4(mix(vec3(1.,.9,.94), vec3(.5,.78,1.), pow(h,.7)),1.); }`,
    })));
    const grass = canvasTex(64, 64, (g, w, h) => { g.fillStyle = '#86e864'; g.fillRect(0, 0, w, h); g.fillStyle = '#9af276'; g.fillRect(0, 0, w / 2, h); }, [60, 60]);
    const meadow = mk(new THREE.CircleGeometry(160, 64).rotateX(-Math.PI / 2), toon(0xffffff, { map: grass }), [0, -.6, 0]); meadow.receiveShadow = true; this.scene.add(meadow);
    this.clouds = [];
    for (let i = 0; i < 10; i++) {
      const c = new THREE.Group(); for (let k = 0; k < 4; k++) c.add(mk(sph(rand(4, 6)), toon(pick([0xffffff, 0xffe3f1, 0xe8f4ff])), [k * 5 - 8, rand(-.5, 1), rand(-1, 1)], [1.3, .8, .9]));
      c.position.set(rand(-180, 180), rand(40, 70), rand(-200, 0)); c.userData.noShadow = true; this.clouds.push(c); this.scene.add(c);
    }
    const near = (x, z, r) => this.tiles.some((p) => Math.hypot(p.x - x, p.z - z) < r);
    const place = (n, r, fn) => { let k = 0, tries = 0; while (k < n && tries++ < 400) { const x = rand(-70, 70), z = rand(-60, 50); if (near(x, z, r)) continue; fn(x, z); k++; } };
    // gumdrop mountains & lollipop forest & candy decor, kept clear of the path
    [[-60, -50, 22, 0xff9ecb], [-20, -70, 26, 0x8fe3f0], [30, -75, 24, 0xffd84d], [70, -45, 20, 0xb89cf8], [-80, 0, 18, 0xffd84d], [80, 10, 20, 0xff9ecb]].forEach(([x, z, r, c]) => {
      const m = mk(new THREE.ConeGeometry(r, r * 1.5, 18), c, [x, r * .6, z]); m.add(mk(new THREE.ConeGeometry(r * .34, r * .5, 18), 0xffffff, [0, r * .62, 0])); this.scene.add(m);
    });
    place(14, 7, (x, z) => { const g = new THREE.Group(); g.position.set(x, -.6, z); const h = rand(5, 8);
      g.add(mk(cyl(.22, .28, h, 8), toon(0xffffff, { map: candyCaneTex() }), [0, h / 2, 0]), mk(sph(1.9, 18, 12), toon(0xffffff, { map: swirlTex(pick(['#ff6fb5', '#ffd84d', '#62e0d0', '#b07cff']), '#fff') }), [0, h + 1.2, 0], [1, 1, .35]));
      g.rotation.y = rand(0, 6); this.scene.add(g); });
    place(14, 6, (x, z) => { const g = new THREE.Group(); g.position.set(x, -.6, z); const c = pick(CANDY); for (let k = 0; k < 3; k++) g.add(mk(sph(rand(.8, 1.4), 12, 8), c, [rand(-1, 1), .6, rand(-.8, .8)], [1, .8, 1])); this.scene.add(g); });
    place(5, 9, (x, z) => { const g = new THREE.Group(); g.position.set(x, -.6, z); g.rotation.y = rand(0, 6);   // gingerbread houses
      g.add(outline(mk(new THREE.BoxGeometry(5, 3.4, 4.4), 0xc98a4b, [0, 1.7, 0]), 1.02), mk(new THREE.ConeGeometry(3.9, 2.2, 4), 0xff6f91, [0, 4.5, 0]).rotateY(Math.PI / 4), mk(new THREE.BoxGeometry(1.1, 2, .2), 0x6b3a1f, [0, 1, 2.25]));
      for (const s of [-1, 1]) g.add(mk(sph(.25), pick(CANDY), [s * 1.6, 2.2, 2.25]));
      g.add(mk(new THREE.BoxGeometry(5.2, .25, 4.6), 0xffffff, [0, 3.4, 0])); this.scene.add(g); });
    const GIANTS = [['cake-birthday', 8], ['ice-cream-cne', 11], ['donut-sprinkles', 6], ['sundae', 9], ['cupcake', 8], ['lollypop', 11]]; let gi = 0;
    place(6, 9, (x, z) => {
      const [gn, gh] = GIANTS[gi++ % GIANTS.length];
      const real = model(`food/${gn}`, { height: gh });                       // real sculpted candy if it loaded
      if (real) { real.position.set(x, -.6, z); real.rotation.y = rand(0, 6); this.scene.add(real); return; }
      const g = new THREE.Group(); g.position.set(x, -.6, z);                                 // (fallback) giant cupcakes
      g.add(mk(cyl(2.2, 1.7, 2.6, 16), 0xffd9a8, [0, 1.3, 0]), mk(sph(2.4, 16, 10), pick([0xff9ecb, 0x8fe3f0, 0xb89cf8]), [0, 3.2, 0], [1, .8, 1]), mk(sph(1.2, 12, 8), 0xffffff, [0, 4.6, 0], [1, .8, 1]), mk(sph(.55), 0xe8334a, [0, 5.6, 0])); this.scene.add(g); });
    // chocolate pond
    this.scene.add(mk(new THREE.CircleGeometry(7, 32).rotateX(-Math.PI / 2), 0x5a2d17, [-44, -.5, -26]));

    // the castle at the finish
    const e = this.tiles[N - 1]; const C = this.castle = new THREE.Group(); C.position.set(e.x + 7, -.6, e.z - 5); C.rotation.y = -.6; this.scene.add(C);
    C.add(outline(mk(new THREE.BoxGeometry(12, 10, 8), 0xffe3f1, [0, 5, 0]), 1.02));
    for (let i = 0; i < 7; i++) C.add(mk(new THREE.BoxGeometry(1.2, 1.2, 1.2), 0xffe3f1, [-5.4 + i * 1.8, 10.6, 3.6]));
    [[-6.5, -3.5, 0x4db8ff], [6.5, -3.5, 0xb07cff], [-6.5, 3.5, 0xff6f91], [6.5, 3.5, 0xffd84d]].forEach(([x, z, c]) => {
      C.add(outline(mk(cyl(1.6, 1.8, 15, 14), 0xfff4e0, [x, 7.5, z]), 1.02), mk(new THREE.ConeGeometry(2.3, 4.5, 14), c, [x, 17.2, z]), mk(cyl(.05, .05, 2, 4), 0xffffff, [x, 20.2, z]), mk(new THREE.PlaneGeometry(1.2, .7), toon(0xffd84d, { side: THREE.DoubleSide }), [x + .6, 20.6, z]));
    });
    C.add(mk(cyl(2, 2, .4, 16).rotateX(Math.PI / 2), 0x6b3a1f, [0, 3, 4.05], [1, 1, 1]), mk(new THREE.BoxGeometry(3.4, 5.2, .3), 0x6b3a1f, [0, 2.6, 4.1]), mk(sph(.2), 0xffc83d, [.8, 2.4, 4.3]));
    C.add(mk(new THREE.ConeGeometry(3, 5, 4), 0xff6f91, [0, 12.8, 0]).rotateY(Math.PI / 4));
    const star = glowSprite(0xffe680, 14, .7); star.position.set(0, 10, 5); C.add(star);
    this.castleGlow = star;
  }

  buildDice() {
    const mats = FACE_ORDER.map((v, i) => toon(0xffffff, { map: canvasTex(128, 128, (g, w, h) => {
      g.fillStyle = '#fff7e6'; g.fillRect(0, 0, w, h); g.strokeStyle = '#ffb3d9'; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
      g.fillStyle = ['#ff4d6d', '#4db8ff', '#ffb000', '#b07cff', '#2fc462', '#ff7a2e'][v - 1];
      PIPS[v].forEach(([x, y]) => { g.beginPath(); g.arc(28 + x * 36, 28 + y * 36, 13, 0, 7); g.fill(); });
    }) }));
    this.dice = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 2.2), mats); this.dice.visible = false;
    outline(this.dice, 1.06);
    this.diceGlow = glowSprite(0xffe680, 6, .5); this.dice.add(this.diceGlow);
    this.scene.add(this.dice);
    this.addInteractive(this.dice, () => this.pressRoll(), 2.4);
  }

  // ===================================================================== flow
  enter() {
    const G = this.game, P = G.party;
    this.scene.add(P.group);
    P.frozen = true; P.target = null; P.setMode('idle');
    const first = P.active;
    this.players = [P.adalyn, P.esmae].map((tw, i) => ({ tw, i, idx: 0, skip: false, done: false, extra: false, moving: false, swim: 0 }));
    this.order = first === 'adalyn' ? [0, 1] : [1, 0];
    this.players.forEach((pl) => { pl.tw.root.position.copy(this.slot(0, pl.i)); pl.tw.root.rotation.y = 0; pl.tw.face = 0; pl.tw.root.scale.setScalar(1.15); pl.tw.mode = 'idle'; pl.tw.setForm(pl.tw.form); });
    G.ui.hud(true, { swap: true, stars: false, lockSwap: true });
    G.ui.progress(true);
    playMusic('board');
    this.introT = 0; this.state = 'intro';
    G.ui.bubble('\u{1F36D} \u{1F3B2} \u{1F3C1}', "Let's race to the castle!");
    this.camera.position.set(0, 85, 55); this.camera.lookAt(0, 0, -2);
    this.tm.after(5, () => { this.state = 'play'; G.ui.hideBubble(); this.loop(); });
  }

  sleep(s) { return new Promise((r) => this.tm.after(s, r)); }
  anim(dur, fn, e = ease.inOut) { return new Promise((r) => this.tm.tween(dur, fn, { ease: e, done: r })); }

  async loop() {
    let turn = 0;
    while (!this.over) {
      const pl = this.players[this.order[turn % 2]];
      turn++;
      if (pl.done) continue;
      await this.takeTurn(pl);
      if (this.players.every((p) => p.done)) this.over = true;
    }
    await this.finishGame();
  }

  async takeTurn(pl) {
    const G = this.game, ui = G.ui;
    this.cur = pl; G.ui.setActive(pl.tw.name);
    if (pl.skip) {
      pl.skip = false;
      ui.bubble('\u{1F36F} \u{1F4A6}', 'Wiggle wiggle... free!');
      sfx.babble(5);
      await this.anim(1.4, (k) => { pl.tw.fx.spin = Math.sin(k * 40) * .25; pl.tw.fx.lift = -.3 * (1 - k); }, ease.linear);
      pl.tw.fx.spin = 0; pl.tw.fx.lift = 0; sfx.boing(); ui.hideBubble();
      await this.sleep(.4);
      return;
    }
    ui.bubble(pl.tw.name === 'adalyn' ? '\u{1F984} \u{1F3B2}' : '\u{1F9DC}‍♀️ \u{1F3B2}', pl.tw.name === 'adalyn' ? "Adalyn's turn!" : "Esmae's turn!");
    sfx.chime();
    this.dice.visible = true; this.dice.scale.setScalar(1); this.diceFree = false; this.dicePos = 'hover';
    this.dice.position.copy(pl.tw.root.position).add(new THREE.Vector3(0, 4.6, 0));
    const v = await this.waitRoll();
    ui.hideBubble(); ui.hideHint(); ui.roll(false);
    await this.punch(pl, v);
    await this.move(pl, v);
    if (pl.done) return;
    await this.resolve(pl, 0);
    if (pl.extra && !pl.done) { pl.extra = false; await this.takeTurn(pl); }
  }

  waitRoll() {
    return new Promise((res) => {
      this.rollResolve = res;
      this.game.ui.roll(true, () => this.pressRoll());
      this.rollIdle = 0; this.hintShown = false;
    });
  }
  pressRoll() {
    if (!this.rollResolve) return;
    const r = this.rollResolve; this.rollResolve = null;
    r(1 + Math.floor(Math.random() * 6));
  }

  async punch(pl, v) {
    const tw = pl.tw, G = this.game;
    this.dicePos = 'free';
    tw.mode = 'idle';
    await this.anim(.28, (k) => { tw.fx.lift = Math.sin(k * Math.PI * .5) * 2.6; }, ease.linear);   // jump!
    sfx.dice(); sfx.bonk();
    const dp = this.dice.position.clone();
    this.fx.burst(dp.clone().add(new THREE.Vector3(0, -1, 0)), { count: 30, colors: [0xffffff, 0xffe14d, 0xff9fcb], speed: 5, gravity: -4, life: .9, size: .8 });
    const y0 = dp.y;
    this.spinning = true;
    const down = this.anim(.4, (k) => { tw.fx.lift = 2.6 * (1 - ease.in(k)); }, ease.linear);
    await this.anim(.7, (k) => { this.dice.position.y = y0 + Math.sin(k * Math.PI * .5) * 2.4; }, ease.linear);
    await down;
    tw.fx.lift = 0; sfx.pop();
    await this.anim(.5, (k) => { this.dice.position.y = y0 + 2.4 + Math.sin(k * Math.PI) * .6; }, ease.linear);
    this.spinning = false;
    // settle to the rolled face, turned toward the camera
    const n = new THREE.Vector3(...FACE_N[v]);
    const toCam = this.camera.position.clone().sub(this.dice.position).normalize();
    const target = new THREE.Quaternion().setFromUnitVectors(n, toCam);
    const startQ = this.dice.quaternion.clone();
    sfx.chime();
    await this.anim(.4, (k) => this.dice.quaternion.slerpQuaternions(startQ, target, k), ease.out);
    G.ui.bubble(KEYCAP(v), '');
    G.ui.say(WORDS[v] + '!', 'counter');
    this.fx.burst(this.dice.position, { count: 24, colors: RAINBOW, speed: 4, gravity: 0, life: 1, size: .8 });
    await this.sleep(1.1);
    await this.anim(.3, (k) => this.dice.scale.setScalar(1 - ease.in(k)), ease.linear);
    this.dice.visible = false; this.dice.scale.setScalar(1);
  }

  async hop(pl, to, height = 1.5, dur = .38) {
    const tw = pl.tw, a = tw.root.position.clone(), b = this.slot(to, pl.i);
    tw.lookToward(b.x - a.x, b.z - a.z, 1);
    sfx.hop();
    pl.moving = true;
    await this.anim(dur, (k) => {
      tw.root.position.set(lerp(a.x, b.x, k), lerp(a.y, b.y, k) + Math.sin(k * Math.PI) * height, lerp(a.z, b.z, k));
    }, ease.linear);
    pl.moving = false; pl.idx = to;
    tw.root.position.copy(b);
    this.updateProgress();
    this.fx.burst(b, { count: 6, colors: [0xffffff, TILE_COLS[to % 6]], speed: 2, gravity: -3, life: .5, size: .6 });
    await this.anim(.1, (k) => (tw.fx.squash = 1 - Math.sin(k * Math.PI) * .18), ease.linear); tw.fx.squash = 1;
  }

  async move(pl, steps) {
    const ui = this.game.ui;
    for (let s = steps; s > 0; s--) {
      if (pl.idx >= N - 1) break;
      const n = steps - s + 1;                         // count UP as they hop: 1, 2, 3...
      ui.bubble(KEYCAP(n), ''); ui.say(WORDS[n], 'counter');
      await this.hop(pl, pl.idx + 1);
    }
    ui.hideBubble();
    if (pl.idx >= N - 1) await this.reachFinish(pl);
  }

  async resolve(pl, depth) {
    if (depth > 3 || pl.done) return;
    const ui = this.game.ui, type = TYPES[pl.idx], tw = pl.tw;
    const here = this.slot(pl.idx, pl.i);
    if (type === 'gum') {
      sfx.boing(); sfx.sparkle(); ui.bubble('\u{1F36C} ⬆️', 'Gumdrop jump!');
      this.fx.burst(here, { count: 40, colors: CANDY, speed: 6, gravity: -3, life: 1.2 });
      await this.sleep(.5);
      for (let k = 0; k < 3 && pl.idx < N - 1; k++) await this.hop(pl, pl.idx + 1, 3.2, .45);
      ui.hideBubble();
      if (pl.idx >= N - 1) return this.reachFinish(pl);
      return this.resolve(pl, depth + 1);
    }
    if (type === 'rainbow') {
      sfx.magic(); ui.bubble('\u{1F308} \u{1F680}', 'Rainbow trail!');
      await this.sleep(.6);
      const to = Math.min(pl.idx + 8, N - 1), a = tw.root.position.clone(), b = this.slot(to, pl.i);
      tw.lookToward(b.x - a.x, b.z - a.z, 1);
      await this.anim(1.5, (k) => {
        tw.root.position.set(lerp(a.x, b.x, k), lerp(a.y, b.y, k) + Math.sin(k * Math.PI) * 9, lerp(a.z, b.z, k));
        tw.fx.spin = k * Math.PI * 4;
        this.fx.burst(tw.root.position, { count: 3, colors: RAINBOW, speed: 1.5, gravity: -2, life: 1.2, size: .9 });
      }, ease.inOut);
      tw.fx.spin = 0; pl.idx = to; tw.root.position.copy(b); this.updateProgress(); sfx.tada(); ui.hideBubble();
      if (pl.idx >= N - 1) return this.reachFinish(pl);
      return this.resolve(pl, depth + 1);
    }
    if (type === 'rush') {
      sfx.sparkle(); sfx.tada(); ui.bubble('\u{1F3B2} ✨', 'Sugar rush! Roll again!');
      this.fx.burst(here, { count: 40, colors: [0x62e0d0, 0xffffff, 0xffe14d], speed: 6, gravity: -2, life: 1.2 });
      pl.extra = true; await this.sleep(1.6); ui.hideBubble(); return;
    }
    if (type === 'licorice') {
      sfx.womp(); ui.bubble('\u{1F5A4} ⬇️', 'Licorice slide!');
      await this.sleep(.6);
      const from = pl.idx, to = Math.max(0, pl.idx - 3);
      await this.anim(.9, (k) => {
        const f = lerp(from, to, k), i0 = Math.floor(f), i1 = Math.min(N - 1, i0 + 1), t = f - i0;
        const a = this.slot(i0, pl.i), b = this.slot(i1, pl.i);
        tw.root.position.lerpVectors(a, b, t); tw.fx.spin = k * Math.PI * 6; tw.fx.squash = 1 - Math.sin(k * Math.PI) * .2;
      }, ease.inOut);
      tw.fx.spin = 0; tw.fx.squash = 1; pl.idx = to; tw.root.position.copy(this.slot(to, pl.i)); this.updateProgress();
      sfx.pop(); await this.sleep(.5); ui.hideBubble(); return;
    }
    if (type === 'molasses') {
      sfx.womp(); ui.bubble('\u{1F36F}', 'Oh no, sticky molasses! Stuck for a turn.');
      this.fx.burst(here, { count: 20, colors: [0x8a4b2a, 0xd9a05b], speed: 3, gravity: -5, life: 1 });
      await this.anim(.6, (k) => { tw.fx.lift = -.35 * k; tw.fx.squash = 1 - k * .15; }, ease.out);
      pl.skip = true; await this.sleep(1.4); tw.fx.lift = 0; tw.fx.squash = 1; ui.hideBubble(); return;
    }
    sfx.pop();
  }

  async reachFinish(pl) {
    const G = this.game;
    pl.done = true; pl.tw.mode = 'cheer';
    sfx.tada(); sfx.sparkle();
    const crown = mk(new THREE.ConeGeometry(.35, .45, 5), 0xffd84d, [0, 2.15, 0]); crown.add(glowSprite(0xffe680, 1.4));
    pl.tw.body.add(crown);
    this.fx.burst(pl.tw.root.position.clone().add(new THREE.Vector3(0, 2, 0)), { count: 90, colors: RAINBOW.concat(CANDY), speed: 8, gravity: -3, life: 2, size: 1 });
    G.ui.bubble('\u{1F451} \u{1F389}', pl.tw.name === 'adalyn' ? 'Adalyn made it to the castle!' : 'Esmae made it to the castle!');
    await this.sleep(2.6); G.ui.hideBubble();
  }

  async finishGame() {
    const G = this.game;
    G.ui.roll(false); G.ui.progress(false);
    sfx.tada();
    G.ui.bubble('\u{1F3F0} \u{1F451}\u{1F451}', 'You both made it!');
    await this.sleep(2.4);
    G.goto('castle', { flash: '#fff2c8' });
  }

  /** Tap any special square while you wait: it wiggles, makes its sound and tells you what it does. */
  tapTile(type, g) {
    const say = {
      gum: 'Gumdrop jump! Bounce ahead three!', rainbow: 'Rainbow trail! Zoom way ahead!', rush: 'Sugar rush! Roll again!',
      licorice: 'Licorice slide! Whee, back you go!', molasses: 'Sticky molasses! You get stuck for a turn!',
    }[type];
    ({ gum: sfx.boing, rainbow: sfx.magic, rush: sfx.sparkle, licorice: sfx.womp, molasses: sfx.womp })[type]();
    this.game.ui.say(say, 'narrator');
    const icon = g.userData.icon;
    if (icon) { const s = icon.scale.x; this.tm.tween(.8, (k) => icon.scale.setScalar(s * (1 + Math.sin(k * Math.PI * 4) * .35 * (1 - k))), { ease: ease.linear, done: () => icon.scale.setScalar(s) }); }
    const col = { gum: [0xffd84d, 0xff6fb5, 0x62e0d0], rainbow: RAINBOW, rush: [0x62e0d0, 0xffffff, 0xffe14d], licorice: [0x2b2b3a, 0x7a4ed1, 0xffffff], molasses: [0x8a4b2a, 0xd9a05b, 0xffffff] }[type];
    this.fx.burst(g.position.clone().add(new THREE.Vector3(0, 3, 0)), { count: 30, colors: col, speed: 4, gravity: -3, life: 1.3, size: .9 });
  }

  updateProgress() { this.game.ui.progressSet(this.players.map((p) => p.idx / (N - 1))); }

  // ===================================================================== update
  update(dt) {
    super.update(dt);
    const t = this.time, G = this.game;
    this.clouds.forEach((c) => { c.position.x += dt * .9; if (c.position.x > 200) c.position.x = -200; });
    this.tileMeshes.forEach((g, i) => { if (g.userData.icon) g.userData.icon.position.y = 3.2 + Math.sin(t * 2 + i) * .3; });
    this.castleGlow.material.opacity = .45 + Math.sin(t * 2.5) * .2;

    if (this.players) {
      this.players.forEach((pl) => {
        pl.tw.update(dt, t, pl.moving, 0);
        if (!pl.moving && !this.over && pl.done) pl.tw.mode = 'cheer';
      });
      this.updateProgress();
    }

    // the dice
    if (this.dice.visible && this.cur) {
      if (this.dicePos === 'hover') {
        const hp = this.cur.tw.root.position;
        this.dice.position.set(hp.x, hp.y + 4.6 + Math.sin(t * 3) * .25, hp.z);
        this.dice.rotation.y += dt * 1.2; this.dice.rotation.x = Math.sin(t * 2) * .25;
      } else if (this.spinning) { this.dice.rotation.x += dt * 14; this.dice.rotation.y += dt * 11; this.dice.rotation.z += dt * 7; }
      this.diceGlow.material.opacity = .4 + Math.sin(t * 5) * .15;
    }
    // keep the dice on screen (and below the speech bubble) no matter the screen shape: nudge it down if it climbs too high
    if (this.dice.visible) {
      const limit = innerHeight * 0.27;
      for (let i = 0; i < 24; i++) { if (this.toScreen(this.dice.position).y >= limit) break; this.dice.position.y -= 0.4; }
    }
    if (this.rollResolve) {
      this.rollIdle = (this.rollIdle || 0) + dt;
      if (this.rollIdle > 9 && !this.hintShown) { this.hintShown = true; G.ui.hint('\u{1F446}'); }
      if (this.hintShown) { const s = this.toScreen(this.dice.position.clone().add(new THREE.Vector3(0, -2.2, 0))); G.ui.hintAt(s.x, s.y); }
    }

    // camera
    if (this.state === 'intro') {
      this.introT += dt;
      const k = clamp(this.introT / 5, 0, 1), e = ease.inOut(k);
      const s = this.tiles[0];
      this.camera.position.set(lerp(0, s.x + 4, e), lerp(85, 14, e), lerp(55, s.z + 24, e));
      this.camTarget.set(lerp(0, s.x, e), 0, lerp(-2, s.z, e));
      this.camera.lookAt(this.camTarget);
    } else if (this.cur) {
      const p = this.cur.tw.root.position, k = 1 - Math.exp(-2.6 * dt);
      this.camTarget.lerp(new THREE.Vector3(p.x, p.y + 1, p.z), k);
      const want = new THREE.Vector3(this.camTarget.x + 3, this.camTarget.y + 13, this.camTarget.z + 17);
      this.camera.position.lerp(want, k);
      this.camera.lookAt(this.camTarget);
    }
  }
}
