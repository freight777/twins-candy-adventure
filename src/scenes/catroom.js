import * as THREE from 'three';
import { BaseScene } from '../scene-base.js';
import { toon, mk, outline, rand, pick, clamp, lerp, ease, glowSprite, canvasTex, setStyle, shade, RAINBOW, CANDY } from '../util.js';
import { sfx, playMusic } from '../audio.js';

const sph = (r, w = 20, h = 14) => new THREE.SphereGeometry(r, w, h);
const cyl = (rt, rb, h, s = 14) => new THREE.CylinderGeometry(rt, rb, h, s);
const DOOR_Z = -16;

const candyCaneTex = () => canvasTex(64, 128, (g, w, h) => {
  g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.fillStyle = '#ff4d6d';
  for (let i = -2; i < 4; i++) { g.beginPath(); g.moveTo(0, i * 32); g.lineTo(w, i * 32 - 32 + 16); g.lineTo(w, i * 32 + 16); g.lineTo(0, i * 32 + 32); g.fill(); }
});
const swirlTex = (a, b) => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = a; g.fillRect(0, 0, w, h); g.strokeStyle = b; g.lineWidth = 26; g.lineCap = 'round'; g.beginPath();
  for (let t = 0; t < 14; t += .05) { const r = t * 8; g.lineTo(w / 2 + Math.cos(t) * r, h / 2 + Math.sin(t) * r); } g.stroke();
});

/** The Cheshire-style talking cat. Grin first, then the rest of him fades in. */
function makeCat() {
  const g = new THREE.Group(), body = [], grin = [];
  const purple = 0xb07cff, dark = 0x7a4ed1, cream = 0xfff0f8;
  const reg = (m, list = body) => { m.material.transparent = true; m.material.opacity = 0; list.push(m.material); return m; };
  g.add(reg(mk(sph(1), purple, [0, 0, 0], [1, 1.15, .9])));
  g.add(reg(mk(sph(.8), cream, [0, -.1, .45], [.9, 1.05, .6])));
  for (let i = 0; i < 4; i++) { const r = mk(new THREE.TorusGeometry(.97 - Math.abs(i - 1.5) * .06, .07, 6, 24), dark, [0, -.6 + i * .42, 0]); r.rotation.x = Math.PI / 2; r.scale.set(1, .9, 1); g.add(reg(r)); }
  const head = new THREE.Group(); head.position.set(0, 1.75, .15); g.add(head);
  head.add(reg(mk(sph(.95), purple, [0, 0, 0], [1.2, 1, 1])));
  for (const s of [-1, 1]) {
    const ear = mk(new THREE.ConeGeometry(.35, .7, 4), purple, [s * .75, .85, 0]); ear.rotation.z = -s * .35; head.add(reg(ear));
    head.add(reg(mk(new THREE.ConeGeometry(.2, .4, 4), 0xff9fcb, [s * .75, .8, .12]).rotateZ(-s * .35)));
    head.add(reg(mk(sph(.28), 0xeaff7a, [s * .42, .2, .8], [1, 1.2, .5])));
    head.add(reg(mk(sph(.08), 0x222222, [s * .42, .2, 1.02], [.5, 1.5, .3])));
    for (let k = 0; k < 3; k++) { const w = mk(cyl(.012, .012, .9, 4), 0xffffff, [s * .95, -.15 - k * .08, .7]); w.rotation.z = s * (Math.PI / 2 + (k - 1) * .22); head.add(reg(w)); }
  }
  head.add(reg(mk(sph(.09), 0xff7fbf, [0, -.08, .93], [1.2, .8, .6])));
  const grinM = mk(new THREE.TorusGeometry(.62, .06, 8, 28, Math.PI), 0xffffff, [0, -.12, .86]); grinM.rotation.z = Math.PI; grinM.scale.set(1.1, .8, .5);
  head.add(reg(grinM, grin));
  for (let i = -2; i <= 2; i++) head.add(reg(mk(new THREE.BoxGeometry(.1, .15, .05), 0xffffff, [i * .24, -.53 + (Math.abs(i) === 2 ? .2 : Math.abs(i) === 1 ? .08 : 0), .96]), grin));
  const tail = new THREE.Group(); g.add(tail); const tailBalls = [];
  for (let i = 0; i < 9; i++) { const b = reg(mk(sph(.3 - i * .018), i % 2 ? dark : purple), body); tail.add(b); tailBalls.push(b); }
  for (const s of [-1, 1]) { const a = reg(mk(sph(.22), purple, [s * .9, .2, .5], [1, 1.4, 1])); g.add(a); g.userData['arm' + (s > 0 ? 'R' : 'L')] = a; }
  g.userData = { ...g.userData, body, grin, head, tail, tailBalls };
  return g;
}

export class CatRoomScene extends BaseScene {
  constructor(game) {
    super(game);
    this.hfov = 80;
    this.stage = 'landing';
    this.done = { adalyn: false, esmae: false };
    this.drop = 18;
    setStyle('candy');
    try { this.build(); } finally { setStyle('toon'); }
    this.scene.environment = game.env('candy'); this.scene.environmentIntensity = 0.3;
    this.scene.add(new THREE.HemisphereLight(0xfff2ff, 0xffd0f0, 0.5));
    const d = new THREE.DirectionalLight(0xfff0e0, 1.7); d.position.set(5, 14, 10); this.scene.add(d);
    this.useShadows(d, 20);
    this.scene.children.forEach((c) => { if (c.isGroup && !c.userData.noShadow && c !== this.cat) shade(c); });
    this.camera.position.set(0, 4.2, 9.5); this.camera.lookAt(0, 3, -6);
  }

  build() {
    // striped circus-tent dome
    const stripes = canvasTex(1024, 8, (g, w, h) => {
      const cols = ['#ff9ecb', '#fff4d6', '#8fe3f0', '#fff4d6', '#ffd84d', '#fff4d6']; const n = 24;
      for (let i = 0; i < n; i++) { g.fillStyle = cols[i % cols.length]; g.fillRect((i * w) / n, 0, w / n + 1, h); }
    });
    this.scene.add(new THREE.Mesh(new THREE.SphereGeometry(24, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ map: stripes, side: THREE.BackSide })));
    // checkerboard floor
    const checker = canvasTex(128, 128, (g, w, h) => {
      g.fillStyle = '#ff9ecb'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff4d6'; g.fillRect(0, 0, w / 2, h / 2); g.fillRect(w / 2, h / 2, w / 2, h / 2);
    }, [11, 11]);
    this.scene.add(mk(new THREE.CircleGeometry(24, 64).rotateX(-Math.PI / 2), toon(0xffffff, { map: checker })));

    // marshmallow trampoline
    const tr = new THREE.Group(); this.scene.add(tr);
    tr.add(outline(mk(cyl(3, 3.1, .72, 32), 0xffb3d9, [0, .36, 0]), 1.03), mk(new THREE.TorusGeometry(3, .2, 10, 36), 0xffffff, [0, .72, 0]).rotateX(Math.PI / 2));
    tr.add(mk(cyl(2.9, 2.9, .05, 32), 0xff8fc4, [0, .74, 0]));

    // lollipop pillars, balloons, gumdrop lamps
    for (let i = 0; i < 11; i++) {
      const a = Math.PI * (.12 + i * .076) + Math.PI, r = 17 + (i % 2) * 2.5;
      const x = Math.cos(a) * r * 1.0, z = Math.sin(a) * r * .8 - 2;
      const L = new THREE.Group(); L.position.set(x, 0, z); this.scene.add(L);
      const h = rand(6, 9);
      L.add(mk(cyl(.2, .2, h, 10), toon(0xffffff, { map: candyCaneTex() }), [0, h / 2, 0]));
      const disc = mk(new THREE.CircleGeometry(rand(1.5, 2.3), 28), toon(0xffffff, { map: swirlTex(pick(['#ff6fb5', '#ffd84d', '#62e0d0']), '#fff'), side: THREE.DoubleSide }), [0, h + 1.4, 0]);
      disc.rotation.y = Math.atan2(-x, 10 - z) * .3; L.add(disc);
      L.userData.disc = disc; (this.pillars = this.pillars || []).push(L);
    }
    this.balloons = [];
    for (let i = 0; i < 16; i++) {
      const b = new THREE.Group(); b.position.set(rand(-14, 14), rand(6, 14), rand(-14, 3));
      b.add(mk(sph(.7, 14, 10), pick([0xff6f91, 0xffd84d, 0x62e0d0, 0xb07cff, 0xff9f4d]), [0, 0, 0], [1, 1.2, 1]), mk(cyl(.015, .015, 3, 4), 0xffffff, [0, -2.2, 0]));
      b.userData.p = rand(0, 6); this.balloons.push(b); this.scene.add(b);
    }
    for (let i = 0; i < 9; i++) { const lamp = mk(sph(.55), pick(CANDY), [-16 + i * 4, 15, rand(-12, -2)]); lamp.add(glowSprite(0xffffff, 3, .6)); this.scene.add(lamp); }

    this.buildDoors();

    // the cat (starts hidden)
    this.cat = makeCat(); this.cat.position.set(0, 4.2, -6); this.cat.scale.setScalar(1.15); this.cat.visible = false; this.scene.add(this.cat);
    this.addInteractive(this.cat, () => this.tapCat(), 2.3, [0, 1, 0]);
  }

  buildDoors() {
    const D = this.doors = new THREE.Group(); D.position.set(0, 0, DOOR_Z); D.scale.setScalar(1.9); this.scene.add(D);
    D.add(mk(new THREE.PlaneGeometry(9, 7), new THREE.MeshBasicMaterial({ color: 0xffd28a }), [0, 3, -.3]));
    this.doorGlow = glowSprite(0xffc870, 9, 0); this.doorGlow.position.set(0, 3, .5); D.add(this.doorGlow);
    const cane = toon(0xffffff, { map: candyCaneTex() });
    for (const s of [-1, 1]) D.add(mk(cyl(.2, .2, 6.4, 12), cane, [s * 2.85, 3.2, .2]));
    const arch = mk(new THREE.TorusGeometry(2.85, .2, 10, 32, Math.PI), cane, [0, 6.35, .2]); D.add(arch);
    D.add(mk(sph(.4), 0xffd84d, [0, 9.4, .2]));
    this.leftPivot = new THREE.Group(); this.leftPivot.position.set(-2.6, 0, 0); this.rightPivot = new THREE.Group(); this.rightPivot.position.set(2.6, 0, 0);
    for (const [pv, s] of [[this.leftPivot, 1], [this.rightPivot, -1]]) {
      pv.add(outline(mk(new THREE.BoxGeometry(2.6, 6.4, .3), 0x6b3a1f, [s * 1.3, 3.2, 0]), 1.01));
      for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) pv.add(mk(new THREE.BoxGeometry(.95, 2.2, .1), 0x8a4b2a, [s * (.7 + c * 1.2), 1.7 + r * 2.6, .17]));
      pv.add(mk(sph(.17), 0xffc83d, [s * 2.2, 3.1, .3]));
      for (let i = 0; i < 5; i++) pv.add(mk(sph(.14), CANDY[i % CANDY.length], [s * (.5 + i * .5), 5.9, .22]));
      D.add(pv);
    }
    this.addInteractive(D, () => this.tapDoors(), 3, [0, 3, 0]);
  }

  // ===================================================================== flow
  enter() {
    const G = this.game, P = G.party;
    this.scene.add(P.group);
    P.ground = (x, z) => ({ y: (Math.hypot(x, z) < 2.9 ? .74 : 0) + this.drop, swim: 0 });
    P.bounds = { xmin: -13, xmax: 13, zmin: -14.5, zmax: 6 };
    P.speed = 4.6;
    P.frozen = true; P.setForm('girl'); P.setMode('fall');
    P.leader.root.position.set(-1.1, 0, 1.2); P.follower.root.position.set(1.1, 0, 1.2);
    P.both().forEach((t) => { t.root.rotation.set(0, 0, 0); t.face = 0; t.root.scale.setScalar(1); this.addInteractive(t.root, () => this.transform(t), 1.3, [0, 1, 0]); });
    G.ui.hud(false); G.ui.hideBubble();
    playMusic('cat');
    this.landing();
  }
  exit() { this.hits.forEach((h) => { h.removeFromParent(); h.geometry.dispose(); }); }

  landing() {
    const P = this.game.party;
    this.tm.tween(1.4, (k) => { this.drop = lerp(18, 0, k); }, {
      ease: ease.in, done: () => {
        sfx.boing(); P.setMode('idle');
        this.fx.burst(new THREE.Vector3(0, 1.2, 1.2), { count: 60, colors: CANDY.concat(RAINBOW), speed: 7, gravity: -5, life: 1.8, size: .9 });
        const squash = (k) => P.both().forEach((t) => (t.fx.squash = 1 - Math.sin(k * Math.PI) * .25));
        this.tm.tween(.25, squash, { done: () => {
          this.tm.tween(.9, (k) => { this.drop = Math.sin(k * Math.PI) * 3.4; }, { ease: ease.linear, done: () => {
            sfx.boing(); this.tm.tween(.25, squash, { done: () => {
              this.tm.tween(.55, (k) => { this.drop = Math.sin(k * Math.PI) * 1.2; }, { ease: ease.linear, done: () => { this.drop = 0; sfx.pop(); this.summonCat(); } });
            } });
          } });
        } });
      },
    });
  }

  summonCat() {
    this.tm.after(.8, () => {
      const c = this.cat; c.visible = true; sfx.magic();
      this.fx.burst(c.position.clone().add(new THREE.Vector3(0, 2.2, 1)), { count: 70, colors: [0xb07cff, 0xff9fcb, 0xffffff, 0x8fe3f0], speed: 6, gravity: 0, life: 1.4, size: .9 });
      this.tm.tween(.6, (k) => c.userData.grin.forEach((m) => (m.opacity = k)));
      this.tm.tween(1.4, (k) => c.userData.body.forEach((m) => (m.opacity = k)), { delay: .9, done: () => this.dialogue() });
    });
  }

  dialogue() {
    const lines = [
      ['\u{1F431}\u{1F44B}', 'Hello Adalyn and Esmae! Welcome to Candy Land!', () => sfx.meow()],
      ['\u{1F3B2} \u{1F36D} \u{1F3F0}', "Let's play a game of Candyland!", () => sfx.babble(7)],
      ['\u{1F3C6} \u27A1\uFE0F \u{1F36B}\u{1F36B}\u{1F36B}', 'Win, and you get a lifetime supply of chocolate!', () => sfx.babble(9)],
      ['\u{1F984} \u2728 \u{1F9DC}\u200D\u2640\uFE0F', 'First, you must become your characters!', () => { sfx.babble(7); sfx.sparkle(); }],
    ];
    this.stage = 'dialogue'; this.lines = lines; this.li = -1; this.nextLine();
  }

  // the cat talks one bubble at a time; it moves on by itself, or when the girls tap the screen
  nextLine() {
    const ui = this.game.ui;
    this.li++;
    if (this.li < this.lines.length) {
      const [e, cap, fn] = this.lines[this.li];
      ui.bubble(e, cap, 'cat'); fn(); this.talk = 3; this.lineT = 4;
      return;
    }
    {
      this.stage = 'transform';
      ui.bubble('\u{1F446} \u{1F984}   \u{1F446} \u{1F9DC}\u200D\u2640\uFE0F', 'Tap Adalyn and Esmae to transform!', 'cat');
      this.markers = this.game.party.both().map((t) => {
        const m = new THREE.Group(); m.add(new THREE.Mesh(new THREE.OctahedronGeometry(.28, 0), new THREE.MeshBasicMaterial({ color: 0xffe14d })), glowSprite(0xffd84d, 1.8));
        m.position.y = 2.7; t.root.add(m); return m;
      });
      this.game.party.frozen = false;      // free to walk around now
      this.game.ui.hud(true, { swap: true });
    }
  }

  onPointer(ndc) {
    if (this.stage === 'dialogue') {        // tap anywhere to hear the next bit
      this.ray.setFromCamera(ndc, this.camera);
      const hit = this.ray.intersectObjects(this.hits.filter((h) => h.parent === this.cat), false)[0];
      if (hit) hit.object.userData.onTap(hit); else this.nextLine();
      return;
    }
    super.onPointer(ndc);
  }

  tapCat() {
    sfx.meow(); this.talk = 1.5;
    this.fx.burst(this.cat.position.clone().add(new THREE.Vector3(0, 3, 1)), { count: 14, colors: [0xff6f91, 0xff9fcb], speed: 2.5, gravity: 1.5, life: 1.4, size: .9 });
    this.tm.tween(.7, (k) => { this.cat.rotation.z = Math.sin(k * Math.PI * 4) * .15 * (1 - k); });
  }

  transform(tw) {
    if (this.stage !== 'transform' || this.done[tw.name]) return;
    this.done[tw.name] = true;
    const isA = tw.name === 'adalyn';
    const cols = isA ? RAINBOW.concat([0xff8a1f, 0xffc15a, 0xffffff]) : [0xff5fa8, 0x2fd6c8, 0xb89cf8, 0x82c4f4, 0xffffff, 0xff9fcb];
    const m = this.markers[isA ? 0 : 1]; m && m.removeFromParent();
    sfx.magic();
    let swapped = false;
    const P = this.game.party;
    P.target = null;
    this.tm.tween(2, (k) => {
      tw.fx.lift = Math.sin(k * Math.PI) * 2.8;
      tw.fx.spin = ease.inOut(k) * Math.PI * 8;
      tw.fx.squash = 1 + Math.sin(k * Math.PI * 3) * .16;
      const p = tw.root.position.clone(); p.y += 1 + tw.fx.lift;
      if (Math.random() < .6) this.fx.burst(p, { count: 3, colors: cols, speed: 2.5, gravity: -1, life: 1, size: .7 });
      if (k >= .5 && !swapped) {
        swapped = true; tw.setForm(isA ? 'unicorn' : 'mermaid');
        this.fx.burst(p, { count: 90, colors: cols, speed: 9, gravity: -2, life: 1.6, size: 1 });
        sfx.tada();
      }
    }, { ease: ease.linear, done: () => {
      tw.fx.lift = 0; tw.fx.spin = 0; tw.fx.squash = 1;
      sfx.chime(); this.tapCat();
      this.game.ui.bubble(isA ? '\u{1F984} \u2728' : '\u{1F9DC}\u200D\u2640\uFE0F \u2728', isA ? 'Adalyn is a Unicorn!' : 'Esmae is a Mermaid!', 'cat');
      if (this.done.adalyn && this.done.esmae) this.tm.after(2.2, () => this.openDoors());
    } });
  }

  openDoors() {
    this.stage = 'doors';
    const ui = this.game.ui;
    ui.bubble('\u{1F6AA} \u{1F36B}', 'The chocolate room awaits!', 'cat');
    sfx.babble(8); sfx.creak();
    const cx0 = this.cat.position.x;
    this.tm.tween(2.5, (k) => { this.cat.position.x = lerp(cx0, -8, k); });   // cat floats aside so the doorway is clear
    const glow = this.doorGlow;
    this.tm.tween(3, (k) => {
      this.leftPivot.rotation.y = -k * 1.75; this.rightPivot.rotation.y = k * 1.75;
      glow.material.opacity = k; glow.scale.setScalar(9 + k * 14);
      if (Math.random() < .5) this.fx.burst(new THREE.Vector3(rand(-3, 3), rand(1, 9), DOOR_Z + 2), { count: 3, colors: [0xffe14d, 0xffffff, 0xff9f4d], speed: 2, gravity: 0, life: 1.2, size: .9 });
    }, { ease: ease.inOut, done: () => {
      this.stage = 'free'; sfx.tada();
      ui.bubble('\u{1F36B} \u{1F3C3}\u200D\u2640\uFE0F\u{1F3C3}\u200D\u2640\uFE0F', 'Walk through the big doors!', 'cat');
      ui.hint('\u{1F447}'); this.hintOn = true;
    } });
  }

  tapDoors() {
    if (this.stage !== 'free') { sfx.bonk(); this.tm.tween(.4, (k) => { this.doors.position.x = Math.sin(k * 30) * .1 * (1 - k); }); return; }
    this.game.party.walkTo(0, DOOR_Z + 2.5);
  }
  onGround(p) {
    if (this.stage === 'landing' || this.game.party.frozen) return;
    this.game.party.walkTo(p.x, p.z);
    if (this.stage === 'free') this.game.ui.hideHint(), (this.hintOn = false);
  }

  // ===================================================================== update
  update(dt) {
    super.update(dt);
    const t = this.time, G = this.game, P = G.party;
    P.update(dt, t);
    if (this.stage === 'dialogue') { this.lineT -= dt; if (this.lineT <= 0) this.nextLine(); }
    this.balloons.forEach((b) => { b.position.y += Math.sin(t * .8 + b.userData.p) * dt * .4; b.rotation.z = Math.sin(t + b.userData.p) * .08; });
    (this.pillars || []).forEach((p, i) => { p.userData.disc.rotation.z += dt * .4 * (i % 2 ? 1 : -1); });
    if (this.cat.visible) {
      const u = this.cat.userData;
      this.cat.position.y = 4.2 + Math.sin(t * 1.4) * .35;
      u.head.rotation.z = Math.sin(t * 1.1) * .08;
      u.tailBalls.forEach((b, i) => b.position.set(Math.sin(t * 2 + i * .5) * .35 * (i / 8), -.2 + i * .28, -.95 - Math.sin(i * .3) * .2));
      this.talk = Math.max(0, (this.talk || 0) - dt);
      u.head.scale.y = 1 + (this.talk > 0 ? Math.abs(Math.sin(t * 14)) * .04 : 0);
    }
    if (this.hintOn) { const s = this.toScreen(new THREE.Vector3(0, 12.5, DOOR_Z)); G.ui.hintAt(s.x, s.y + 20); }
    // marker bobbing
    (this.markers || []).forEach((m) => { m.position.y = 2.7 + Math.sin(t * 4) * .15; m.rotation.y = t * 2; });
    // walk through the doors?
    if (this.stage === 'free' && !this.leaving) {
      const L = P.leader.root.position;
      if (L.z < DOOR_Z + 3.2 && Math.abs(L.x) < 4.5) { this.leaving = true; P.frozen = true; sfx.whoosh(1); G.goto('chocolate', { flash: '#ffd9a0' }); }
    }
    // gentle camera drift
    this.camera.position.x = Math.sin(t * .3) * .6;
    this.camera.lookAt(0, 3, -6);
  }
}

