import * as THREE from 'three';
import { BaseScene } from '../scene-base.js';
import { toon, mk } from '../util.js';
import { sfx, playMusic } from '../audio.js';

/** Placeholder for Phase 3. The real Wonka-style chocolate room goes here. */
export class ChocolateScene extends BaseScene {
  constructor(game) {
    super(game);
    this.scene.background = new THREE.Color(0x5a2d17);
    this.scene.add(new THREE.HemisphereLight(0xfff0d0, 0x7a3b1d, 1.3));
    const ground = mk(new THREE.CircleGeometry(30, 40).rotateX(-Math.PI / 2), 0x4aa84a);
    this.scene.add(ground);
    this.camera.position.set(0, 5, 12); this.camera.lookAt(0, 1.6, 0);
  }
  enter() {
    const P = this.game.party;
    this.scene.add(P.group);
    P.ground = () => ({ y: 0, swim: 0 });
    P.frozen = false; P.setMode('cheer');
    P.place(-1.5, 3, 1.5, 3);
    this.game.ui.hud(false);
    playMusic('choc');
    this.game.ui.message('🍫', 'The chocolate room is coming next!', 'Play again', () => { this.game.started = false; this.game.goto('beach'); });
  }
  update(dt) { super.update(dt); this.game.party.update(dt, this.time); }
}
