import * as THREE from 'three';
import { FallScene } from './fall.js';
import { BeachScene } from './beach.js';
import { mk, ease, RAINBOW, CANDY } from '../util.js';
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
    this.camera.position.set(-9, 4.2, 15.5);
    this.look = new THREE.Vector3(-9.5, 1, 8);
    this.camera.lookAt(this.look);
  }

  enter() {
    const G = this.game, P = G.party, ui = G.ui;
    this.scene.add(P.group);
    P.ground = (x, z) => ({ y: this.lying ? .38 : 0, swim: 0 });
    P.frozen = true; P.target = null; P.setForm('girl'); P.setMode('idle');
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

    this.tm.after(3, () => { ui.bubble('\u{1F468}‍\u{1F469}‍\u{1F467}‍\u{1F467} ☀️', 'Wake up, sleepyheads!'); this.tapParents(); });
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
      P.both().forEach((t) => { t.root.rotation.set(0, 0, 0); t.face = 0; t.setMode('cheer'); });
      this.fx.burst(P.adalyn.root.position.clone().add(new THREE.Vector3(1, 2.4, 0)), { count: 60, colors: RAINBOW.concat(CANDY), speed: 6, gravity: -3, life: 2, size: 1 });
      sfx.giggle(); this.tm.after(.9, () => sfx.giggle());
      ui.bubble('\u{1F602} \u{1F389} \u{1F36B}', 'Giggle giggle giggle!');
      this.tm.after(4.5, () => this.theEnd());
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
    this.camera.position.x = -9.5 + Math.sin(this.time * .25) * .5;
    this.camera.lookAt(this.look);
  }
}
