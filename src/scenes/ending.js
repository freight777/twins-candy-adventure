import * as THREE from 'three';
import { FallScene } from './fall.js';
import { BeachScene } from './beach.js';
import { mk, ease, rand, pick, lerp, toon, setStyle, shade, bakeStatic, RAINBOW, CANDY } from '../util.js';
import { model } from '../assets.js';
import { makeCandy, makeGift, makeTeddy, makeBalloon } from '../candies.js';
import { sfx, playMusic } from '../audio.js';

/** A random surprise from the truck: sour or gummy candy, a present, a teddy bear, or a treat. */
function goodie(size) {
  const r = Math.random();
  let m;
  if (r < .45) m = makeCandy(pick(['gummyBear', 'sourKid', 'nerds', 'gummyWorm', 'sourRing', 'sourStraw']));
  else if (r < .65) m = makeGift();
  else if (r < .8) m = makeTeddy(pick([0xc98a4b, 0xf4b6d0, 0x9ad0ff]));
  else m = model(`food/${pick(['cake', 'donut-sprinkles', 'ice-cream-cne', 'cupcake', 'lollypop', 'popsicle', 'sundae'])}`, { size: 1.8 }) || makeGift();
  m.scale.multiplyScalar(size / 2);
  shade(m); return bakeStatic(m);             // one mesh per material: a box of Nerds is a few draw calls, not 25
}

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
    this.setFxMax(1500);                                              // confetti + the candy shower overflowed the 600-sparkle pool
    if (this.duneG) this.duneG.visible = false;                       // no sand hills in front of the sleeping girls
    this.camera.position.set(-9, 4.2, 15.5);
    this.jackRegion = 'wake';                                         // Jackson runs back and forth in front of the towels
    if (this.jack) this.jack.tw.root.position.set(-4, 0, 13.4);
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
    this.scene.add(mk(new THREE.BoxGeometry(2.0, .05, 3.6), 0xff9f2e, [-11.4, .03, 10.0]), mk(new THREE.BoxGeometry(2.0, .05, 3.6), 0xff7fb8, [-8.2, .03, 10.0]));       // side-by-side towels
    P.adalyn.root.position.set(-11.4, 0, 11.6); P.esmae.root.position.set(-8.2, 0, 11.6);
    P.both().forEach((t) => t.root.rotation.set(-Math.PI / 2, 0, 0));        // lying on their backs, heads toward the ocean, side by side
    ui.hud(false); ui.progress(false);
    playMusic('beach');
    ui.bubble('\u{1F634} \u{1F4A4}', '');
    this.camera.position.set(-9.5, 5, 18); this.look.set(-9.8, .8, 10);

    this.tm.after(3, () => { ui.bubble('\u{1F468}‍\u{1F469}‍\u{1F467}‍\u{1F467} ☀️', 'Wake up, sleepyheads!', 'mom'); this.tapParents(); });
    this.tm.after(6, () => this.wakeUp());
  }

  wakeUp() {
    const G = this.game, P = G.party, ui = G.ui;
    sfx.giggle();
    this.tm.tween(1.1, (k) => {
      P.both().forEach((t, i) => { t.root.rotation.x = -(Math.PI / 2) * (1 - ease.out(Math.min(1, k * (1 + i * .15)))); });
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
    const bed = new THREE.Group(); bed.position.set(3.7, .7, 0); bed.userData.dynamic = true; T.add(bed);                  // tipping bed (pivot at the back)
    const bm = (w, h, d, col, x, y, z) => { const m = mk(new THREE.BoxGeometry(w, h, d), col, [x, y, z]); bed.add(m); return m; };
    bm(4.2, .2, 2.5, 0xfff4e0, -2.1, 0, 0); bm(.2, 1.4, 2.5, 0x8a4b2a, -4.1, .8, 0); bm(4.2, 1.4, .2, 0x8a4b2a, -2.1, .8, 1.2); bm(4.2, 1.4, .2, 0x8a4b2a, -2.1, .8, -1.2);
    for (let i = 0; i < 9; i++) { const p = goodie(1.3); p.position.set(-.6 - (i % 3) * 1.2, .55 + Math.floor(i / 3) * .2, (Math.floor(i / 3) - 1) * .7); p.rotation.y = rand(0, 6); bed.add(p); }
    for (let i = 0; i < 6; i++) { const b = makeBalloon(); b.position.set(-.4 - (i % 3) * 1.3, .8, i < 3 ? -.9 : .9); bed.add(b); }       // balloons tied to the load
    const wheels = [];
    for (const [x, z] of [[-2.2, 1.25], [-2.2, -1.25], [2.4, 1.25], [2.4, -1.25]]) { const w = mk(new THREE.CylinderGeometry(.55, .55, .4, 16), 0x2b2b3a, [x, .55, z]); w.rotation.x = Math.PI / 2; w.userData.dynamic = true; w.add(mk(new THREE.CylinderGeometry(.25, .25, .42, 12), 0xffd84d)); T.add(w); wheels.push(w); }
    const sign = mk(new THREE.BoxGeometry(2.6, .8, .12), 0xffffff, [1.6, 2.6, 1.28]); T.add(sign, mk(new THREE.SphereGeometry(.22, 10, 8), 0xff3b5c, [1.2, 2.6, 1.36]), mk(new THREE.SphereGeometry(.22, 10, 8), 0xffd32a, [1.6, 2.6, 1.36]), mk(new THREE.SphereGeometry(.22, 10, 8), 0x4ddc5a, [2.0, 2.6, 1.36]));
    setStyle('toon');
    shade(T); bakeStatic(T); bakeStatic(bed); this.scene.add(T); this.truckG = T;
    this.pieces = [];

    ui.bubble('\u{1F69A} \u{1F36C}\u{1F381}\u{1F9F8}', 'Look! Candy, presents and toys are here!', 'mom');
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
        const m = goodie(rand(1.3, 2.0));
        m.position.set(T.position.x - 4.3 + rand(-.3, .3), 2.2, T.position.z + rand(-1, 1)); m.rotation.set(rand(0, 6), rand(0, 6), rand(0, 6));
        this.scene.add(m);
        this.pieces.push({ m, vy: rand(0, 2), vx: -rand(.6, 2.2), vz: rand(-1.2, 1.2), spin: rand(-4, 4), rest: false });
      });
      this.tm.after(1.2, () => { sfx.tada(); this.fx.burst(new THREE.Vector3(T.position.x - 6, 3, T.position.z), { count: 100, colors: RAINBOW.concat(CANDY), speed: 8, gravity: -3, life: 2.2, size: 1.2 }); sfx.giggle(); });
      this.tm.after(5, () => this.theEnd());
    } });
  }

  /** The final picture: the whole family of five posed next to the chocolate, confetti falling, "You did it!" banner, small Play again button. */
  theEnd() {
    const G = this.game, ui = G.ui, P = G.party;
    ui.hideBubble(); this.finaleOn = true;
    sfx.fanfare();
    const spots = { mom: [-14.2, 8.6], adalyn: [-12.4, 9.0], jack: [-10.7, 10.1], esmae: [-9.0, 9.0], dad: [-7.3, 8.6] };
    // the girls hop over to their spots, side by side
    const place = (tw, spot) => {
      const from = tw.root.position.clone(); tw.root.rotation.set(0, 0, 0); tw.mode = 'cheer';
      this.tm.tween(1.2, (k) => tw.root.position.set(lerp(from.x, spot[0], k), 0, lerp(from.z, spot[1], k)), { ease: ease.inOut });
    };
    place(P.adalyn, spots.adalyn); place(P.esmae, spots.esmae);
    // mom and dad stand up and join in
    const stand = (adult, spot, sc, ry) => {
      this.scene.attach(adult); adult.userData.setStanding(true);
      const from = adult.position.clone(), ry0 = adult.rotation.y;
      this.tm.tween(1.3, (k) => { adult.position.set(lerp(from.x, spot[0], k), lerp(from.y, 0, k), lerp(from.z, spot[1], k)); adult.scale.setScalar(lerp(1.04, sc, k)); adult.rotation.y = lerp(ry0, ry, k); }, { ease: ease.inOut });
    };
    stand(this.mom, spots.mom, 1.3, .12); stand(this.dad, spots.dad, 1.4, -.12);
    this.jackFinale = spots.jack;                       // little Jackson runs to the front of the group
    this.finaleCam = true;                              // camera eases back so everyone, the truck and the chocolate fit
    this.tm.after(1.5, () => {
      sfx.tada(); sfx.giggle(); ui.say('You did it!', 'narrator');
      ui.finale('You did it!', 'Play again', () => { G.started = false; G.goto('beach'); });
      const burst = () => { if (!this.finaleOn) return; this.fx.burst(new THREE.Vector3(rand(-15, -1), rand(9, 13), rand(4, 12)), { count: 40, colors: RAINBOW.concat(CANDY), speed: 2.5, gravity: -2.6, life: 4.5, size: 1.1 }); this.tm.after(.3, burst); };
      burst();
      this.floaters = [];                                                  // party balloons drifting up behind the family
      for (let i = 0; i < 10; i++) { const b = makeBalloon(); b.position.set(rand(-15, -2), rand(-1, 6), rand(5.5, 8)); b.userData.sp = rand(.5, 1); b.userData.ph = rand(0, 6); this.scene.add(b); this.floaters.push(b); }
      // a shower of candy, presents and teddy bears lands in a big pile right next to the family
      const bonus = Math.min(10, G.stars || 0);                          // the tunnel stars become extra presents in the pile
      for (let i = 0; i < 34 + bonus; i++) this.tm.after(i * .06, () => {
        const m = goodie(rand(1.5, 2.3));
        m.position.set(rand(-5.2, -2.4), rand(9, 14), rand(7.2, 10.6)); m.rotation.set(rand(0, 6), rand(0, 6), rand(0, 6)); this.scene.add(m);
        this.pieces.push({ m, vy: 0, vx: rand(-.4, .4), vz: rand(-.4, .4), spin: rand(-3, 3), rest: false });
      });
    });
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
    for (const b of this.floaters || []) { b.position.y += dt * b.userData.sp; b.position.x += Math.sin(this.time * 1.2 + b.userData.ph) * dt * .3; if (b.position.y > 9) b.position.y = -4; }
    if (this.finaleOn) {                                  // mom and dad wave and everyone bounces while the camera settles on the group
      const t = this.time;
      this.mom.userData.arm.rotation.z = -2.4 + Math.sin(t * 5) * .3; this.dad.userData.arm.rotation.z = -2.4 + Math.sin(t * 5 + 1) * .3;
      this.mom.position.y = Math.abs(Math.sin(t * 4)) * .12; this.dad.position.y = Math.abs(Math.sin(t * 4 + 1)) * .12;
    }
    if (this.finaleCam) {
      const k = 1 - Math.exp(-1.5 * dt);
      this.camera.position.lerp(new THREE.Vector3(-8.2, 5.6, 19.8), k); this.look.lerp(new THREE.Vector3(-8.4, 1.7, 8), k);
    } else this.camera.position.x = -9.5 + Math.sin(this.time * .25) * .5;
    this.camera.lookAt(this.look);
  }
}
