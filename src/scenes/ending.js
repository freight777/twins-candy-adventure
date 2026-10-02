import * as THREE from 'three';
import { FallScene } from './fall.js';
import { BeachScene } from './beach.js';
import { mk, ease, rand, pick, toon, setStyle, shade, RAINBOW, CANDY } from '../util.js';
import { model } from '../assets.js';
import { sfx, playMusic } from '../audio.js';

/** Whoosh! Back up the tunnel to the beach. Same tunnel as the fall, flowing the other way. */
export class WarpScene extends FallScene {
  constructor(game) {
    super(game);
    this.dir = -1;
    this.duration = 9;
    this.next = 'wake';
  }
  enter() {
    super.enter();
    this.startTunnel();
    this.game.party.setMode('fall');
  }
  update(dt) {
    if (this.phase === 'whirl') { this.startTunnel(); }
    super.update(dt);
  }
}

/** The girls "wake up" from a nap on the beach, parents beside them. The End. */
export class WakeScene extends BeachScene {
  constructor(game) {
    super(game);
    this.phase = 'wake';
    this.woke = false;
    (this.dunes || []).forEach((d) => (d.visible = false));        // no sand hills in front of the sleeping girls
    this.camera.position.set(-9, 4.2, 15.5);
    this.look = new THREE.Vector3(-9.5, 1, 8);
    this.camera.lookAt(this.look);
  }

  enter() {
    const G = this.game, P = G.party, ui = G.ui;
    this.scene.add(P.group);
    P.ground = (x, z) => ({ y: this.lying ? .38 : 0, swim: 0 });
    P.frozen = true; P.target = null; P.setForm('girl'); P.setMode('idle');
    P.both().forEach((t) => t.setOutfit('swim'));          // napping after a swim
    this.lying = true;
    P.both().forEach((t) => { t.fx.lift = 0; t.fx.spin = 0; t.fx.squash = 1; t.body.rotation.set(0, 0, 0); t.root.scale.setScalar(1); t.face = 0; });
    // two little towels, girls napping in front of mom and dad
    this.scene.add(mk(new THREE.BoxGeometry(2.8, .05, 1.6), 0xff9f2e, [-11.2, .03, 10.3]), mk(new THREE.BoxGeometry(2.8, .05, 1.6), 0xff7fb8, [-11.2, .03, 12.1]));
    P.adalyn.root.position.set(-9.9, 0, 10.3); P.esmae.root.position.set(-9.9, 0, 12.1);
    P.both().forEach((t) => t.root.rotation.set(0, 0, Math.PI / 2));
    ui.hud(false); ui.progress(false);
    playMusic('beach');
    ui.bubble('\u{1F634} \u{1F4A4}', '');
    this.camera.position.set(-9.5, 5, 18); this.look.set(-9.8, .8, 10);

    this.tm.after(3, () => { ui.bubble('\u{1F468}‍\u{1F469}‍\u{1F467}‍\u{1F467} ☀️', 'Wake up, sleepyheads!', 'queen'); this.tapParents(); });
    this.tm.after(6, () => this.wakeUp());
  }

  wakeUp() {
    const G = this.game, P = G.party, ui = G.ui;
    sfx.giggle();
    this.tm.tween(1.1, (k) => {
      P.both().forEach((t, i) => { t.root.rotation.z = (Math.PI / 2) * (1 - ease.out(Math.min(1, k * (1 + i * .15)))); });
      this.lying = k < .6;
    }, { ease: ease.linear, done: () => {
      this.lying = false;
      P.both().forEach((t) => { t.root.rotation.set(0, 0, 0); t.face = 0; t.mode = 'cheer'; });
      this.fx.burst(P.adalyn.root.position.clone().add(new THREE.Vector3(1, 2.4, 0)), { count: 60, colors: RAINBOW.concat(CANDY), speed: 6, gravity: -3, life: 2, size: 1 });
      sfx.giggle(); this.tm.after(.9, () => sfx.giggle());
      ui.bubble('\u{1F602} \u{1F389} \u{1F36B}', 'Giggle giggle giggle!', 'narrator', false);
      this.tm.after(3.2, () => this.truck());
    } });
  }

  /** The cat's promise comes true: a pink chocolate truck honks its way up the beach and tips out a mountain of candy. */
  truck() {
    const G = this.game, ui = G.ui, P = G.party;
    setStyle('candy');
    const T = new THREE.Group(); T.position.set(-26, 0, 5.2); T.rotation.y = Math.PI;      // drives in from the left (behind everyone), cab first, and parks on the right
    const box = (w, h, d, col, x, y, z) => { const m = mk(new THREE.BoxGeometry(w, h, d), col, [x, y, z]); T.add(m); return m; };
    box(2.2, 1.9, 2.4, 0xff6fb5, -1.9, 1.35, 0);                    // cab
    box(.1, .9, 1.9, 0xbfeaff, -3.02, 1.7, 0);                      // windscreen
    box(2.4, .25, 2.5, 0xffffff, -1.9, .35, 0);                     // bumper
    box(4.2, .3, 2.5, 0xfff4e0, 1.6, .55, 0);                       // cargo floor
    const bed = new THREE.Group(); bed.position.set(3.7, .7, 0); T.add(bed);                  // tipping bed (pivot at the back)
    const bm = (w, h, d, col, x, y, z) => { const m = mk(new THREE.BoxGeometry(w, h, d), col, [x, y, z]); bed.add(m); return m; };
    bm(4.2, .2, 2.5, 0xfff4e0, -2.1, 0, 0); bm(.2, 1.4, 2.5, 0x8a4b2a, -4.1, .8, 0); bm(4.2, 1.4, .2, 0x8a4b2a, -2.1, .8, 1.2); bm(4.2, 1.4, .2, 0x8a4b2a, -2.1, .8, -1.2);
    for (let i = 0; i < 9; i++) { const p = model(`food/${pick(['chocolate', 'candy-bar', 'cookie-chocolate', 'chocolate'])}`, { size: 1.3 }); if (p) { p.position.set(-.6 - (i % 3) * 1.2, .55 + Math.floor(i / 3) * .2, (Math.floor(i / 3) - 1) * .7); p.rotation.y = rand(0, 6); bed.add(p); } }
    const wheels = [];
    for (const [x, z] of [[-2.2, 1.25], [-2.2, -1.25], [2.4, 1.25], [2.4, -1.25]]) { const w = mk(new THREE.CylinderGeometry(.55, .55, .4, 16), 0x2b2b3a, [x, .55, z]); w.rotation.x = Math.PI / 2; w.add(mk(new THREE.CylinderGeometry(.25, .25, .42, 12), 0xffd84d)); T.add(w); wheels.push(w); }
    const sign = mk(new THREE.BoxGeometry(2.6, .8, .12), 0xffffff, [1.6, 2.6, 1.28]); T.add(sign, mk(new THREE.SphereGeometry(.22, 10, 8), 0x6b3a1f, [1.2, 2.6, 1.36]), mk(new THREE.SphereGeometry(.22, 10, 8), 0x6b3a1f, [1.6, 2.6, 1.36]), mk(new THREE.SphereGeometry(.22, 10, 8), 0x6b3a1f, [2.0, 2.6, 1.36]));
    setStyle('toon');
    shade(T); this.scene.add(T); this.truckG = T;
    this.pieces = [];

    ui.bubble('\u{1F69A} \u{1F36B}', 'Look! The chocolate is here!', 'queen');
    sfx.honk(); this.tm.after(.9, () => sfx.honk());
    this.tm.tween(4.2, (k) => {
      T.position.x = -26 + (-1.2 + 26) * k; wheels.forEach((w) => (w.rotation.y += .25));
      T.rotation.z = Math.sin(k * 40) * .008;
      if (Math.random() < .4) this.fx.burst(new THREE.Vector3(T.position.x - 4.5, .6, T.position.z), { count: 1, colors: [0xdddddd, 0xffffff], speed: .5, up: .8, gravity: .5, life: 1.2, size: 1.2 });
    }, { ease: ease.out, done: () => {
      P.both().forEach((t) => (t.mode = 'cheer'));
      sfx.honk();
      // tip the bed and let the chocolate pour out
      this.tm.tween(1.4, (k) => { bed.rotation.z = -k * .6; });
      for (let i = 0; i < 26; i++) this.tm.after(.5 + i * .09, () => {
        const m = model(`food/${pick(['chocolate', 'candy-bar', 'cookie-chocolate', 'chocolate', 'donut-chocolate', 'popsicle-chocolate'])}`, { size: rand(1.3, 2.0) });
        if (!m) return;
        m.position.set(T.position.x - 4.3 + rand(-.3, .3), 2.2, T.position.z + rand(-1, 1)); m.rotation.set(rand(0, 6), rand(0, 6), rand(0, 6));
        shade(m); this.scene.add(m);
        this.pieces.push({ m, vy: rand(0, 2), vx: -rand(.6, 2.2), vz: rand(-1.2, 1.2), spin: rand(-4, 4), rest: false });
      });
      this.tm.after(1.2, () => { sfx.tada(); this.fx.burst(new THREE.Vector3(T.position.x - 6, 3, T.position.z), { count: 100, colors: RAINBOW.concat(CANDY), speed: 8, gravity: -3, life: 2.2, size: 1.2 }); sfx.giggle(); });
      this.tm.after(5, () => this.theEnd());
    } });
  }

  theEnd() {
    const G = this.game;
    sfx.tada();
    G.ui.hideBubble();
    G.ui.message('\u{1F308}\u{1F36B}\u{1F984}\u{1F9DC}‍♀️', 'The End', 'Play again', () => { G.started = false; G.goto('beach'); });
  }

  update(dt) {
    super.update(dt);
    for (const p of this.pieces || []) {                 // falling chocolate: gravity, bounce, settle into a pile
      if (p.rest) continue;
      p.vy -= 22 * dt; p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt;
      p.m.rotation.x += p.spin * dt; p.m.rotation.z += p.spin * .6 * dt;
      p.vx *= 1 - dt * .8; p.vz *= 1 - dt * .8;
      if (p.m.position.y < .35) {
        p.m.position.y = .35;
        if (Math.abs(p.vy) > 3) { p.vy = -p.vy * .38; p.vx *= .6; } else { p.rest = true; }
      }
    }
    this.camera.position.x = -9.5 + Math.sin(this.time * .25) * .5;
    this.camera.lookAt(this.look);
  }
}
