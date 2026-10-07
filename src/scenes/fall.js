import * as THREE from 'three';
import { BaseScene } from '../scene-base.js';
import { toon, mk, rand, pick, clamp, lerp, glowSprite, emojiSprite, emojiTex, stripedGeo, vertexToon, CANDY } from '../util.js';
import { sfx, playMusic, voice } from '../audio.js';
import { earn } from '../engine/sticker.js';
import { PIC } from '../learn/words.js';
import { wordsThrough, withPic, onset, sameSound } from '../learn/reading.js';

const sph = (r, w = 14, h = 10) => new THREE.SphereGeometry(r, w, h);
const cyl = (rt, rb, h, s = 12) => new THREE.CylinderGeometry(rt, rb, h, s);
const TUNNEL_LEN = 170, SPEED = 30, DURATION = 22;

/** Phase 1: the whirlpool pulls the girls under. Phase 2: the crazy Alice-in-Wonderland tunnel fall. */
export class FallScene extends BaseScene {
  constructor(game) {
    super(game);
    this.hfov = 80;
    this.dir = 1;                 // 1 = falling down the tunnel, -1 = flying back up it
    this.duration = DURATION;
    this.next = 'cat';
    this.phase = 'whirl';
    this.pt = 0;
    this.collected = 0;
    this.pointer = new THREE.Vector2(0, 0);
    this.center = new THREE.Vector2(0, 0);
    this.buildWhirl();
    this.buildTunnel();
    this.tunnel.visible = false;
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xffc8f0, 1.25));
    const d = new THREE.DirectionalLight(0xffffff, 1.2); d.position.set(2, 5, 8); this.scene.add(d);
  }

  buildWhirl() {
    const g = this.whirl = new THREE.Group(); this.scene.add(g);
    g.add(mk(new THREE.PlaneGeometry(200, 200).rotateX(-Math.PI / 2), 0x35b9e8, [0, -.1, 0]));
    this.whirlMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: { uTime: { value: 0 }, uPull: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: `uniform float uTime, uPull; varying vec2 vUv;
        void main(){
          vec2 p = (vUv-.5)*2.; float r = length(p); float a = atan(p.y,p.x);
          float sw = a*2. + log(r+.03)*3.2 - uTime*(2.5+uPull*3.);
          float bands = sin(sw*3.)*.5+.5;
          vec3 c = mix(vec3(.1,.4,.85), vec3(.35,.92,.95), bands);
          c = mix(c, vec3(1.), smoothstep(.82,1.,bands)*.8);
          c = mix(vec3(.45,.1,.75), c, smoothstep(.0,.3,r));
          c *= .55 + .45*smoothstep(.0,.5,r);
          float alpha = 1. - smoothstep(.8,1.,r);
          gl_FragColor = vec4(c, alpha);
        }`,
    });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(15, 64).rotateX(-Math.PI / 2), this.whirlMat);
    g.add(disc);
    this.camera.position.set(0, 12, 6); this.camera.lookAt(0, 0, 0);
  }

  buildTunnel() {
    const g = this.tunnel = new THREE.Group(); this.scene.add(g);
    this.tunnelMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, uniforms: { uTime: { value: 0 }, uDir: { value: 1 } },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: `uniform float uTime, uDir; varying vec3 vP;
        void main(){
          float a = atan(vP.y, vP.x);
          float zz = vP.z - uDir*uTime*${SPEED}.;
          float k = a*3./3.14159 + zz*.07;
          float st = step(.5, fract(k));
          vec3 c = mix(vec3(1.,.42,.72), vec3(.3,.88,.98), st);
          float ring = step(.92, fract(zz*.045));
          c = mix(c, vec3(1.,.92,.35), ring);
          float chk = step(.5, fract(a*4./3.14159)) * step(.5, fract(zz*.12)) + (1.-step(.5, fract(a*4./3.14159))) * (1.-step(.5, fract(zz*.12)));
          c = mix(c, c*.82, chk*.5);
          float d = clamp(-vP.z/${TUNNEL_LEN}.,0.,1.);
          c = mix(c, vec3(1.,.97,.8), pow(d,2.2));
          gl_FragColor = vec4(c,1.);
        }`,
    });
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.2, TUNNEL_LEN + 20, 40, 1, true).rotateX(Math.PI / 2), this.tunnelMat);
    tube.position.z = -TUNNEL_LEN / 2 + 8; g.add(tube);
    const endGlow = glowSprite(0xfff2b0, 36, 1); endGlow.position.set(0, 0, -TUNNEL_LEN + 5); g.add(endGlow);

    // flying wonderland junk
    this.items = [];
    const makers = [this.mkClock, this.mkCup, this.mkKey, this.mkCard, this.mkLolly, this.mkBook, this.mkMushroom, this.mkCandy, this.mkDoor];
    for (let i = 0; i < 45; i++) {
      const o = makers[i % makers.length].call(this);
      o.scale.setScalar(rand(1.3, 2));
      o.userData.spin = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1));
      this.respawn(o, true);
      this.items.push(o); g.add(o);
    }
    // sound bubbles: pictures to catch when their word starts with the sound the voice asks for
    this.bubbles = [];
    const shell = toon(0xcff4ff, { transparent: true, opacity: .32, depthWrite: false });
    for (let i = 0; i < 6; i++) {
      const b = new THREE.Group(), pic = emojiSprite('\u2B50', 1.15);
      b.add(new THREE.Mesh(new THREE.SphereGeometry(.78, 20, 14), shell), pic, glowSprite(0xbfefff, 2.2, .35));
      b.userData = { bubble: true, pic, word: null, bounce: 0, vx: 0 };
      b.visible = false; this.bubbles.push(b); g.add(b);
    }
    // collectable stars
    this.coins = [];
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Group();
      s.add(new THREE.Mesh(new THREE.OctahedronGeometry(.45, 0), new THREE.MeshBasicMaterial({ color: 0xffe14d })), glowSprite(0xffd84d, 2.4));
      s.userData.coin = true;
      s.position.set(rand(-2.6, 2.6), rand(-1.8, 1.8), -rand(10, TUNNEL_LEN));
      this.coins.push(s); g.add(s);
    }
  }
  respawn(o, first = false) {
    const a = rand(0, Math.PI * 2), r = rand(3.3, 4.5);
    o.position.set(Math.cos(a) * r, Math.sin(a) * r, first ? -rand(8, TUNNEL_LEN) : this.dir > 0 ? -TUNNEL_LEN + rand(-10, 0) : -rand(0, 4));
  }
  mkClock() { const g = new THREE.Group(); g.add(mk(new THREE.TorusGeometry(.6, .09, 8, 20), 0xffc83d), mk(new THREE.CircleGeometry(.58, 20), 0xffffff, [0, 0, .01]), mk(new THREE.BoxGeometry(.05, .4, .03), 0x333333, [0, .15, .03]), mk(new THREE.BoxGeometry(.3, .05, .03), 0x333333, [.12, 0, .03])); return g; }
  mkCup() { const g = new THREE.Group(); g.add(mk(cyl(.5, .3, .5, 14), 0xff9fcb), mk(new THREE.TorusGeometry(.2, .05, 6, 12), 0xff9fcb, [.55, 0, 0]), mk(cyl(.55, .55, .05, 14), 0xffffff, [0, -.3, 0])); return g; }
  mkKey() { const g = new THREE.Group(); g.add(mk(new THREE.TorusGeometry(.3, .07, 8, 14), 0xffc83d, [0, .6, 0]), mk(cyl(.06, .06, 1.1, 8), 0xffc83d), mk(new THREE.BoxGeometry(.3, .12, .1), 0xffc83d, [.15, -.45, 0])); return g; }
  mkCard() { const g = new THREE.Group(); g.add(mk(new THREE.BoxGeometry(.9, 1.3, .04), 0xffffff), mk(sph(.22), 0xe8334a, [0, 0, .03], [1, 1, .2])); return g; }
  mkLolly() { const g = new THREE.Group(); g.add(new THREE.Mesh(stripedGeo(sph(.55, 16, 12), CANDY, 8), vertexToon()), mk(cyl(.04, .04, 1.2, 6), 0xffffff, [0, -.9, 0])); return g; }
  mkBook() { const g = new THREE.Group(); g.add(mk(new THREE.BoxGeometry(.9, 1.2, .25), pick([0x62a8ff, 0xb07cff, 0x5be37d])), mk(new THREE.BoxGeometry(.8, 1.1, .2), 0xfff4d6, [.04, 0, 0])); return g; }
  mkMushroom() { const g = new THREE.Group(); g.add(mk(cyl(.15, .2, .6, 10), 0xfff4d6, [0, -.3, 0]), mk(sph(.55, 14, 8), 0xe8334a, [0, 0, 0], [1, .7, 1]), mk(sph(.1), 0xffffff, [.2, .3, .2]), mk(sph(.08), 0xffffff, [-.25, .25, 0])); return g; }
  mkCandy() { const g = new THREE.Group(); g.add(mk(sph(.4), pick(CANDY)), mk(new THREE.ConeGeometry(.3, .4, 8), 0xffffff, [.55, 0, 0]).rotateZ(-Math.PI / 2), mk(new THREE.ConeGeometry(.3, .4, 8), 0xffffff, [-.55, 0, 0]).rotateZ(Math.PI / 2)); return g; }
  mkDoor() { const g = new THREE.Group(); g.add(mk(new THREE.BoxGeometry(.7, 1.1, .1), 0x8a4b2a), mk(sph(.07), 0xffc83d, [.2, 0, .08])); return g; }

  // ===================================================================== flow
  enter() {
    const P = this.game.party;
    this.scene.add(P.group);
    P.frozen = true; P.target = null; P.setMode('idle');
    if (this.dir > 0) P.setForm('girl');      // (flying home, they keep their unicorn / mermaid forms)
    P.both().forEach((t) => { t.fx.spin = 0; t.fx.lift = 0; t.fx.squash = 1; t.root.scale.setScalar(1); });
    P.ground = () => ({ y: 0, swim: 1 });
    P.adalyn.root.rotation.y = 0; P.esmae.root.rotation.y = 0;
    this.game.ui.hud(false);
    this.game.ui.hideBubble();
    playMusic('fall');
    sfx.whoosh(3);
  }

  startTunnel() {
    this.phase = 'tunnel'; this.pt = 0; this.leaving = false;
    this.whirl.visible = false; this.tunnel.visible = true;
    const P = this.game.party;
    P.ground = () => ({ y: 0, swim: 0 });
    P.setMode('fall');
    this.camera.position.set(0, 0, 3); this.camera.rotation.set(0, 0, 0);
    sfx.whoosh(2.5);
    if (this.dir > 0) {
      this.game.ui.hud(true, { swap: false, stars: true });
      this.game.ui.setStars(this.collected);
      this.hintShown = true;
      this.game.ui.hint('👆');
      this.hintTime = 4;
      this.tm.after(2.2, () => this.newTarget());
    } else this.game.ui.hud(false);
  }

  onPointer(ndc) { this.pointer.copy(ndc); }
  onPointerMove(ndc, pressed) { if (pressed) this.pointer.copy(ndc); }

  update(dt) {
    super.update(dt);
    const t = this.time, P = this.game.party, G = this.game;
    this.pt += dt;
    this.whirlMat.uniforms.uTime.value = t;
    this.tunnelMat.uniforms.uTime.value = t;

    if (this.phase === 'whirl') {
      const k = clamp(this.pt / 5.2, 0, 1);
      this.whirlMat.uniforms.uPull.value = k;
      this.camera.position.set(0, lerp(7.5, 6.5, k), lerp(9, 6, k)); this.camera.lookAt(0, -.4, 0);
      this.whirl.visible = true;
      P.both().forEach((tw, i) => {
        const ang = t * (1.2 + k * 3.5) + i * Math.PI, r = lerp(5.2, .4, k * k);
        tw.root.position.set(Math.cos(ang) * r, -.2 - k * 1.4, Math.sin(ang) * r);
        tw.lookToward(-Math.sin(ang), Math.cos(ang), dt * 3);
        tw.root.scale.setScalar(lerp(1.2, .5, k * k));
        tw.update(dt, t, false, 1);
      });
      if (k >= 1 && !this.leaving) { this.leaving = true; sfx.splash(); this.startTunnelSoon(); }
      return;
    }

    // ---------------- tunnel ----------------
    P.both().forEach((tw) => tw.root.scale.setScalar(1));
    this.center.x = lerp(this.center.x, this.pointer.x * 2.8, 1 - Math.exp(-4 * dt));
    this.center.y = lerp(this.center.y, this.pointer.y * 1.9, 1 - Math.exp(-4 * dt));
    if (this.hintShown) {
      this.hintTime -= dt;
      const s = this.toScreen(new THREE.Vector3(this.center.x, this.center.y + 1.4, -4));
      G.ui.hintAt(s.x, s.y);
      if (this.hintTime <= 0 || Math.abs(this.pointer.x) + Math.abs(this.pointer.y) > .05) { G.ui.hideHint(); this.hintShown = false; }
    }
    P.both().forEach((tw, i) => {
      const s = i ? 1 : -1;
      tw.root.position.set(this.center.x + s * 1.0 + Math.sin(t * 1.3 + i) * .25, this.center.y - .9 + Math.sin(t * 1.7 + i * 2) * .3, -4.2);
      tw.root.rotation.set(0, Math.sin(t * .9 + i) * .35, Math.sin(t * 1.1 + i * 1.7) * .3, 'YXZ');
      tw.face = 0;
      tw.update(dt, t, false, 0);
    });

    // objects rush by
    this.tunnelMat.uniforms.uDir.value = this.dir;
    for (const o of this.items) {
      o.position.z += SPEED * dt * this.dir;
      o.rotation.x += o.userData.spin.x * dt * 2; o.rotation.y += o.userData.spin.y * dt * 2; o.rotation.z += o.userData.spin.z * dt * 2;
      if (this.dir > 0 ? o.position.z > 6 : o.position.z < -TUNNEL_LEN) this.respawn(o);
    }
    this.updateBubbles(dt, t);
    for (const c of this.coins) {
      if (this.dir < 0) { c.visible = false; continue; }
      c.position.z += SPEED * dt; c.rotation.y += dt * 3;
      if (c.position.z > 6) { c.position.set(rand(-2.6, 2.6), rand(-1.8, 1.8), -TUNNEL_LEN + rand(-10, 0)); }
      if (Math.abs(c.position.z + 4.2) < 1.4) {
        for (const tw of P.both()) {
          const tp = tw.root.position;
          if (Math.hypot(c.position.x - tp.x, c.position.y - (tp.y + 1)) < 1.3) {
            this.collected++; G.ui.setStars(this.collected); sfx.collect(this.collected); G.stars = this.collected;
            this.fx.burst(c.position, { count: 18, colors: [0xffe14d, 0xffffff, 0xff9fcb], speed: 4, gravity: 0, life: .8, size: .8 });
            c.position.set(rand(-2.6, 2.6), rand(-1.8, 1.8), -TUNNEL_LEN + rand(-10, 0));
            break;
          }
        }
      }
    }
    this.camera.rotation.z = Math.sin(t * .5) * .18;
    this.camera.position.x = this.center.x * .25; this.camera.position.y = this.center.y * .25;

    if (this.pt > this.duration && !this.leaving) {
      this.leaving = true;
      sfx.magic();
      G.goto(this.next, { flash: '#fff6c8' });
    }
  }

  // ===================================================================== the sound game
  /** pick the next first sound to listen for. This is oral phonemic awareness (hearing /m/ at the start of "moon"), which comes
   *  before letters, so it uses every picture word, not just the child's CKLA unit: at reading level 0 that unit has only four
   *  pictures, and every round was /d/. Consonant sounds with at least two pictures. */
  newTarget() {
    if (this.dir < 0 || this.disposed) return;
    const who = this.game.party.active;
    this.pool = withPic(wordsThrough(10));
    const options = [...new Set(this.pool.map(onset))].filter((s) => !/^[aeiou]/.test(s) && this.pool.filter((w) => onset(w) === s).length >= 2 && s !== this.target);
    if (!options.length || this.pool.length < 4) return;
    this.target = pick(options); this.caught = 0; this.who = who;
    this.bubbles.forEach((b, i) => this.fillBubble(b, true, i));
    voice(['catch_the', `snd_${this.target}`, 'things'], { priority: 2 });
  }
  /** half the bubbles carry a word with the target sound, half a word with a different first sound */
  fillBubble(b, first = false, i = 0) {
    const hit = this.target && Math.random() < .5, list = this.target ? this.pool.filter((w) => (hit ? onset(w) === this.target : !sameSound(onset(w), this.target))) : this.pool;
    const w = pick(list.length ? list : this.pool);
    b.userData.word = w; b.userData.bounce = 0; b.userData.vx = 0;
    b.userData.pic.material.map = emojiTex(PIC[w]); b.userData.pic.material.needsUpdate = true;
    b.position.set(rand(-2.4, 2.4), rand(-1.6, 1.6), first ? -40 - i * 22 : -TUNNEL_LEN + rand(-10, 0));
    b.scale.setScalar(1); b.visible = true;
  }
  updateBubbles(dt, t) {
    if (!this.pool) return;
    const P = this.game.party;
    for (const b of this.bubbles) {
      const u = b.userData;
      b.position.z += SPEED * .8 * dt; b.position.x += u.vx * dt; u.vx *= 1 - dt * 3;
      b.position.y += Math.sin(t * 2 + b.id) * dt * .3;
      if (u.bounce > 0) { u.bounce -= dt; b.scale.setScalar(1 + Math.sin(u.bounce * 30) * .15 * u.bounce); }
      if (b.position.z > 6) { this.fillBubble(b); continue; }
      if (!this.target || Math.abs(b.position.z + 4.2) > 1.3 || u.bounce > 0) continue;   // (between targets the bubbles just float by)
      for (const tw of P.both()) {
        const tp = tw.root.position;
        if (Math.hypot(b.position.x - tp.x, b.position.y - (tp.y + 1)) > 1.4) continue;
        if (onset(u.word) === this.target) {                       // the right sound: pop!
          this.caught++; sfx.collect(this.caught); voice(`w_${u.word}`, { priority: 1 });
          this.fx.burst(b.position, { count: 26, colors: [0xffffff, 0xbfefff, 0xffe14d, 0xff9fcb], speed: 5, gravity: 0, life: .9, size: .9 });
          this.fillBubble(b);
          // (not recorded as learning: it can't be missed, so it would only make the quizzes ask this sound less)
          if (this.caught >= 4) { sfx.tada(); earn(this.who, 'sound-catcher'); this.tm.after(1.2, () => this.newTarget()); this.target = null; }
        } else {                                                   // a different sound: it just bounces away, no penalty
          u.bounce = .5; u.vx = (b.position.x > tp.x ? 1 : -1) * 6; sfx.soft();
        }
        break;
      }
    }
  }

  startTunnelSoon() {
    this.game.ui.fade('#fffbe0', async () => { this.startTunnel(); }).then(() => {});
  }
}
