import * as THREE from 'three';
import { toon, mk, glowSprite, setStyle, canvasTex, Timers, Fx, ease, rand, pick, clamp, lerp, RAINBOW } from '../util.js';
import { ask } from '../engine/quiz.js';
import { storyAdd } from '../learn/math.js';
import { createUnicorn, LOOKS } from './unicorn.js';

const sph = (r, w = 20, h = 14) => new THREE.SphereGeometry(r, w, h);
const cyl = (rt, rb, h, s = 20) => new THREE.CylinderGeometry(rt, rb, h, s);

function starGeo(R = 1, r = .48, depth = .3) {
  const sh = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 + Math.PI / 2, rad = i % 2 ? r : R; sh[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rad, Math.sin(a) * rad); }
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: .1, bevelSize: .1, bevelSegments: 3 });
  g.translate(0, 0, -depth / 2); return g;
}
const hitSphere = (obj, r) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), new THREE.MeshBasicMaterial({ visible: false })); obj.add(m); return m; };

export const HOUSES = {
  sparkle: { title: "Sparkle's Sparkle Studio", goal: 10, how: 'Tap the sparkle stars!', unit: '⭐' },
  rainbow: { title: "Rainbow's Music House", goal: 6, how: 'Tap every color to play music!', unit: '\u{1F308}' },
  cloud:   { title: "Cloud's Fluffy Hideout", goal: 6, how: 'Tap the glowing cloud to hop up!', unit: '☁️' },
  rain:    { title: "Rain's Garden Room", goal: 5, how: 'Tap a flower pot to water it!', unit: '\u{1F338}' },
  uni:     { title: "Uni's Ice Cream Parlor", goal: 3, how: 'Tap the flavors to build an ice cream!', unit: '\u{1F366}' },
};

/** A small themed house you can visit: its own little 3D room with a quick mini-game.
 *  api: { env, say, voice, sfx, who, level(strand), addStars, status(text), count(fill, goal, opts) } */
export function createHouse(key, api) {
  setStyle('candy');
  const info = HOUSES[key];
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
  const timers = new Timers(), fx = new Fx(scene, 500), ray = new THREE.Raycaster();
  const H = { scene, camera, info, key, interactive: [], t: 0, count: 0, done: false, fx, timers, extra: [] };
  const sleep = (s) => new Promise((r) => timers.after(s, r));
  const anim = (dur, fn, e = ease.inOut) => new Promise((r) => timers.tween(dur, fn, { ease: e, done: r }));
  scene.environment = api.env; scene.environmentIntensity = 0.4;
  const look = new THREE.Vector3(0, 2.8, 0);

  // ---- the room shell: round walls, floor, dome ceiling, round windows ----
  const theme = {
    sparkle: { wall: 0xffb3dc, floor: 0xffe0f2, rug: 0xff7ab8, ceil: 0xd98cff, light: 0xffd0f0 },
    rainbow: { wall: 0xfff6e8, floor: 0xe6f6ff, rug: 0xffe27a, ceil: 0xcfe8ff, light: 0xfff2d8 },
    cloud:   { wall: 0xcfe8ff, floor: 0xf4faff, rug: 0xffffff, ceil: 0x9fd0ff, light: 0xe8f4ff },
    rain:    { wall: 0x7a8fe0, floor: 0xb8c8f0, rug: 0x4a62c8, ceil: 0x4a5ab8, light: 0xd8e4ff },
    uni:     { wall: 0xffd0e6, floor: 0xfff4f8, rug: 0xff9ecb, ceil: 0xffb8d8, light: 0xfff0e8 },
  }[key];
  const wallTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,.55)'; for (let i = 0; i < 24; i++) { g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 3 + Math.random() * 6, 0, 7); g.fill(); }
    g.strokeStyle = 'rgba(0,0,0,.05)'; g.lineWidth = 3; for (let x = 0; x < w; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  }, [6, 1]);
  const wallMat = new THREE.MeshStandardMaterial({ color: theme.wall, map: wallTex, side: THREE.BackSide, roughness: .9 });
  scene.add(new THREE.Mesh(new THREE.CylinderGeometry(11, 11, 9, 56, 1, true), wallMat).translateY(4.5));
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(11.1, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: theme.ceil, side: THREE.BackSide, roughness: .9 })).translateY(9));
  const floor = new THREE.Mesh(new THREE.CircleGeometry(11, 56).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: theme.floor, roughness: .6 })); scene.add(floor);
  scene.add(mk(new THREE.CircleGeometry(6.5, 48).rotateX(-Math.PI / 2), toon(theme.rug), [0, .02, 0]), mk(new THREE.RingGeometry(6.5, 7.1, 48).rotateX(-Math.PI / 2), 0xffffff, [0, .03, 0]));
  scene.add(mk(new THREE.TorusGeometry(10.9, .28, 10, 56).rotateX(Math.PI / 2), 0xffffff, [0, .25, 0]));
  [-.62, .62].forEach((a) => {                                                    // round windows at the back
    const g = new THREE.Group(); g.position.set(Math.sin(a) * 10.7, 4.8, -Math.cos(a) * 10.7); g.rotation.y = -a; scene.add(g);
    g.add(new THREE.Mesh(new THREE.CircleGeometry(1.7, 32), new THREE.MeshBasicMaterial({ color: key === 'rain' ? 0x7a96d8 : 0xa8e4ff })), mk(new THREE.TorusGeometry(1.7, .16, 10, 32), 0xffffff, [0, 0, .05]));
    g.add(mk(new THREE.BoxGeometry(3.4, .1, .06), 0xffffff, [0, 0, .08]), mk(new THREE.BoxGeometry(.1, 3.4, .06), 0xffffff, [0, 0, .08]));
    g.userData.win = true; H.extra.push(g);
  });
  scene.add(new THREE.HemisphereLight(0xfff6ff, theme.floor, 1.0));
  const pl = new THREE.PointLight(theme.light, 1400, 60, 1.6); pl.position.set(0, 7, 4); scene.add(pl);
  camera.position.set(0, 5.2, 13); H.camBase = camera.position.clone();

  // two unicorns: the visitor (Uni) and the host
  const uni = createUnicorn(LOOKS.uni); uni.root.scale.setScalar(1.15); uni.root.position.set(-4.2, 0, 3.2); uni.root.rotation.y = .5; scene.add(uni.root);
  const host = createUnicorn(LOOKS[key === 'uni' ? 'twin' : key]); host.root.scale.setScalar(1.15); host.root.position.set(4.2, 0, 3.2); host.root.rotation.y = -.5; scene.add(host.root);
  H.uni = uni; H.host = host;

  const goal = () => H.goal ?? info.goal;
  /** the panel's frame fills one cell per thing done, and the voice counts along */
  const progress = (speak = true) => api.count(Math.min(H.count, goal()), goal(), { speak: speak && !H.done, colors: H.colors });
  const celebrate = async () => {
    if (H.done) return; H.done = true;
    api.sfx.fanfare(); api.say('You did it! Great job!', 'uni'); api.status('\u{1F389}'); api.addStars(3);
    for (let i = 0; i < 6; i++) { fx.burst(new THREE.Vector3(rand(-6, 6), rand(3, 8), rand(-3, 3)), { count: 50, colors: RAINBOW.concat([0xffffff]), speed: 6, gravity: -2, life: 1.6, size: 1 }); api.sfx.pop(); await sleep(.35); }
    [uni, host].forEach((u) => anim(.6, (k) => { u.lift = Math.sin(k * Math.PI) * 1.6; }, ease.linear));
  };
  H.celebrate = celebrate;
  const tapOn = (obj, fn, r = 1) => { obj.userData.tap = fn; hitSphere(obj, r); H.interactive.push(obj); };
  const hop = (u) => anim(.5, (k) => { u.lift = Math.sin(k * Math.PI) * 1.2; }, ease.linear);

  // ===================================================================================== the five houses
  if (key === 'sparkle') {
    const disco = new THREE.Mesh(new THREE.IcosahedronGeometry(1.3, 2), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: .12, flatShading: true, emissive: 0xff9ed8, emissiveIntensity: .35 }));
    disco.position.set(0, 7, -3); scene.add(disco, mk(cyl(.04, .04, 3, 6), 0xffffff, [0, 8.6, -3])); const dg = glowSprite(0xffc0f0, 9, .5); dg.position.copy(disco.position); scene.add(dg);
    H.extra.push({ update: (t) => { disco.rotation.y = t * .6; dg.material.opacity = .4 + Math.sin(t * 4) * .15; } });
    scene.add(mk(sph(1.6, 24, 16), toon(0xff7ab8), [0, 0, -7], [2.2, 1.1, 1]), mk(new THREE.BoxGeometry(5, 3.4, .2), 0xffffff, [0, 3.6, -10]));
    const mirror = mk(new THREE.CircleGeometry(1.4, 32), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: .05 }), [0, 3.7, -9.85]); scene.add(mirror);
    const sg = starGeo(.8, .38, .25), smat = new THREE.MeshStandardMaterial({ color: 0xffd84d, emissive: 0xffc83a, emissiveIntensity: 1.6, roughness: .35 });
    const stars = [];
    const place = (s) => { s.position.set(rand(-7, 7), rand(2.5, 8), rand(-6, 3)); s.userData.ph = rand(0, 6); s.userData.y0 = s.position.y; s.scale.setScalar(1); s.visible = true; };
    for (let i = 0; i < 12; i++) {
      const s = new THREE.Mesh(sg, i % 3 ? smat : new THREE.MeshStandardMaterial({ color: 0xff7ab8, emissive: 0xff4d9a, emissiveIntensity: 1.5, roughness: .35 })); s.add(glowSprite(0xffe680, 3.2, .5)); place(s); scene.add(s); stars.push(s);
      tapOn(s, async () => {
        if (!s.visible) return; s.visible = false; H.count++; progress(); api.sfx.collect(H.count); fx.burst(s.position.clone(), { count: 24, colors: [0xffe14d, 0xffffff, 0xff9ed8], speed: 4, gravity: -2, life: 1, size: .9 });
        if (H.count >= info.goal) celebrate(); await sleep(1.2); place(s);
      }, 1.4);
    }
    H.extra.push({ update: (t) => stars.forEach((s) => { if (s.visible) { s.rotation.y = t * 1.3 + s.userData.ph; s.position.y = s.userData.y0 + Math.sin(t * 1.8 + s.userData.ph) * .5; } }) });
    for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI - Math.PI, b = mk(sph(.22, 10, 8), pick([0xffd84d, 0xff7ab8, 0xffffff]), [Math.cos(a) * 9, 8.4 + Math.sin(a) * -.6, -Math.sin(a) * 5 - 3]); scene.add(b); }
  }

  if (key === 'rainbow') {
    const bars = [], notes = new Set();
    RAINBOW.forEach((c, k) => { const arc = new THREE.Mesh(new THREE.TorusGeometry(9 - k * .75, .34, 10, 40, Math.PI), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: .1, roughness: .5 })); arc.position.set(0, 1, -9.5); scene.add(arc); bars.push(arc); });
    const bx = [];
    RAINBOW.forEach((c, k) => {
      const h = 3.4 - k * .35, bar = new THREE.Group(); bar.position.set((k - 2.5) * 1.75, 0, 1.2 - Math.abs(k - 2.5) * .15); bar.scale.setScalar(.8); scene.add(bar);
      host.root.position.set(7, 0, 3.4); uni.root.position.set(-7, 0, 3.4);
      bar.add(mk(new THREE.BoxGeometry(1.8, .5, 3.6 + (5 - k) * .35), toon(c, { emissive: c, emissiveIntensity: .15, clearcoat: 1, unique: true }), [0, h * .3 + .6, 0]), mk(cyl(.2, .2, h * .3 + .4, 10), 0xffffff, [-.6, (h * .3 + .4) / 2, 1.2]), mk(cyl(.2, .2, h * .3 + .4, 10), 0xffffff, [.6, (h * .3 + .4) / 2, -1.2]));
      bar.userData.y0 = 0; bx.push(bar);
      tapOn(bar, () => {
        api.sfx.note(k); bar.position.y = .5; timers.tween(.4, (e) => { bar.position.y = .5 * (1 - e); }, { ease: ease.out });
        fx.burst(bar.position.clone().add(new THREE.Vector3(0, 2.2, 0)), { count: 26, colors: [c, 0xffffff], speed: 5, gravity: -2, life: 1.2, size: .9 });
        bars[k].material.emissiveIntensity = 1.1; hop(host); if (!notes.has(k)) { notes.add(k); H.count = notes.size; progress(); if (notes.size >= 6) celebrate(); }
      }, 1.5);
    });
    H.extra.push({ update: (t) => bars.forEach((a, k) => { a.material.emissiveIntensity = lerp(a.material.emissiveIntensity, notes.has(k) ? (H.done ? .9 + Math.sin(t * 3 + k) * .2 : .5) : .1, .05); }) });
    for (let i = 0; i < 5; i++) scene.add(mk(sph(.9, 14, 10), toon(0xffffff), [-9 + i * 4.5, 7.5, -7], [1.6, .8, 1]));
  }

  if (key === 'cloud') {
    const puff = (x, y, z, s = 1) => { const g = new THREE.Group(); g.position.set(x, y, z); [[0, 0, 0, 1.2], [-1.1, -.15, .1, .9], [1.1, -.1, 0, .95], [.3, .5, .2, .8]].forEach(([a, b, c, r]) => g.add(mk(sph(r * s, 18, 12), toon(0xffffff), [a * s, b * s, c * s], [1.1, .85, 1]))); scene.add(g); return g; };
    for (let i = 0; i < 9; i++) puff(rand(-9, 9), rand(.3, 1), rand(-8, 0), rand(1, 1.8));
    const pts = [[-5.5, .5, 4], [-3.4, 1.9, 1.6], [-1.2, 3.1, -.6], [1.1, 4.3, -2.4], [3.2, 5.5, -4], [1, 6.8, -6]];
    const clouds = pts.map(([x, y, z], i) => { const c = puff(x, y, z, 1.25); const ring = new THREE.Mesh(new THREE.TorusGeometry(1.8, .12, 8, 28).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff0a0).multiplyScalar(1.6) })); ring.position.y = .9; c.add(ring); ring.visible = false; c.userData.ring = ring; return c; });
    const gStar = new THREE.Mesh(starGeo(1, .45, .35), new THREE.MeshStandardMaterial({ color: 0xffd84d, emissive: 0xffc83a, emissiveIntensity: 1.6 })); gStar.position.set(-1.5, 8.6, -6.5); gStar.add(glowSprite(0xffe680, 5, .6)); scene.add(gStar);
    host.root.position.set(5.5, 0, 0); uni.root.position.copy(clouds[0].position).add(new THREE.Vector3(0, 1.1, 0)); uni.root.rotation.y = .3;
    let next = 1, busy = false;
    const arm = () => { clouds.forEach((c, i) => (c.userData.ring.visible = i === next)); gStar.userData.ready = next >= clouds.length; };
    clouds.forEach((c, i) => tapOn(c, async () => {
      if (busy || i !== next) return; busy = true; const a = uni.root.position.clone(), b = c.position.clone().add(new THREE.Vector3(0, 1.1, 0));
      api.sfx.boing(); await anim(.8, (k) => { uni.root.position.set(lerp(a.x, b.x, k), lerp(a.y, b.y, k) + Math.sin(k * Math.PI) * 2.4, lerp(a.z, b.z, k)); uni.speed = 1; }, ease.linear); uni.speed = 0;
      fx.burst(b, { count: 30, colors: [0xffffff, 0xcfe6ff, 0xffe0f0], speed: 4, gravity: -1, life: 1.2, size: 1 }); api.sfx.pop();
      H.count = next; progress(); next++; arm(); busy = false;
    }, 2.2));
    tapOn(gStar, async () => { if (!gStar.userData.ready || H.done) return; const a = uni.root.position.clone(), b = gStar.position.clone().add(new THREE.Vector3(0, -1.2, 0)); await anim(.8, (k) => uni.root.position.set(lerp(a.x, b.x, k), lerp(a.y, b.y, k) + Math.sin(k * Math.PI) * 1.5, lerp(a.z, b.z, k))); H.count = 6; progress(); gStar.visible = false; celebrate(); }, 2);
    arm(); H.extra.push({ update: (t) => { clouds.forEach((c, i) => { c.position.y = pts[i][1] + Math.sin(t + i) * .12; if (c.userData.ring.visible) c.userData.ring.scale.setScalar(1 + Math.sin(t * 4) * .1); }); gStar.rotation.y = t * 1.4; gStar.position.y = 8.6 + Math.sin(t * 2) * .3; if (!busy && next < 7) uni.root.position.y = (next > 1 ? clouds[next - 1].position.y + 1.1 : pts[0][1] + 1.1); } });
    camera.position.set(0, 5.8, 14); look.set(0, 4, 0);
  }

  if (key === 'rain') {
    const winG = H.extra.find((e) => e.userData && e.userData.win);
    // rain drops outside the windows (just falling streaks) and the pet raincloud
    const drops = []; for (let i = 0; i < 30; i++) { const d = mk(new THREE.BoxGeometry(.04, .5, .04), new THREE.MeshBasicMaterial({ color: 0xcfe0ff }), [rand(-9, 9), rand(2, 9), -10.4]); d.userData.sp = rand(5, 9); scene.add(d); drops.push(d); }
    H.extra.push({ update: (t, dt) => drops.forEach((d) => { d.position.y -= d.userData.sp * dt; if (d.position.y < 1.5) d.position.y = 9; }) });
    const cloud = new THREE.Group(); [[0, 0, 0, 1.2], [-1.1, -.1, 0, .9], [1.1, -.1, 0, .95], [.2, .5, 0, .8]].forEach(([a, b, c, r]) => cloud.add(mk(sph(r, 16, 12), toon(0xb8c8ee), [a, b, c], [1.1, .85, 1]))); cloud.position.set(0, 6.4, 1); scene.add(cloud);
    const eyeL = mk(sph(.1), 0x2a3a7a, [-.4, .1, 1.05]), eyeR = mk(sph(.1), 0x2a3a7a, [.4, .1, 1.05]); cloud.add(eyeL, eyeR, mk(new THREE.TorusGeometry(.22, .04, 6, 14, Math.PI).rotateZ(Math.PI), 0x2a3a7a, [0, -.25, 1.08]));
    const pots = [], petalCols = [0xff7fb5, 0xffe14d, 0xb07cff, 0xff9f4d, 0x7be0ff];
    for (let i = 0; i < 5; i++) {
      const g = new THREE.Group(); g.position.set((i - 2) * 3.2, 0, -2.2 - Math.abs(i - 2) * .3); scene.add(g);
      g.add(mk(cyl(.9, .65, 1.2, 20), toon(0xc86a4a), [0, .6, 0]), mk(new THREE.TorusGeometry(.92, .12, 8, 24).rotateX(Math.PI / 2), 0xe0805a, [0, 1.2, 0]), mk(cyl(.07, .07, 2, 8), 0x5fc86a, [0, 2.1, 0]));
      const flower = new THREE.Group(); flower.position.y = 3.2; flower.scale.setScalar(.35); g.add(flower);
      for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; flower.add(mk(sph(.55, 12, 8), toon(petalCols[i]), [Math.cos(a) * .95, Math.sin(a) * .95, 0], [1, 1.4, .5]).rotateZ(a - Math.PI / 2)); }
      flower.add(mk(sph(.55, 14, 10), 0xffe14d, [0, 0, .2]));
      pots.push({ g, flower, grown: false });
      tapOn(g, async () => {
        const p = pots[i]; if (p.grown || H.busy) return; H.busy = true;
        const a = cloud.position.clone(), b = new THREE.Vector3(g.position.x, 6.4, g.position.z + .5);
        await anim(.7, (k) => cloud.position.lerpVectors(a, b, k)); api.sfx.splash();
        for (let n = 0; n < 12; n++) { fx.burst(new THREE.Vector3(g.position.x + rand(-.8, .8), 6, g.position.z), { count: 3, colors: [0x7fc4ff, 0xbfd8ff, 0xffffff], speed: .5, gravity: -9, life: 1.2, size: .8 }); await sleep(.1); }
        p.grown = true; await anim(.8, (k) => flower.scale.setScalar(lerp(.35, 1, ease.outBack(k)))); api.sfx.sparkle(); fx.burst(g.position.clone().add(new THREE.Vector3(0, 3.4, 0)), { count: 40, colors: [petalCols[i], 0xffffff], speed: 4, gravity: -1, life: 1.3, size: 1 });
        H.count = pots.filter((q) => q.grown).length; progress(); H.busy = false; if (H.count >= 5) celebrate();
      }, 1.6);
    }
    H.extra.push({ update: (t) => { cloud.position.y += Math.sin(t * 2) * .003; eyeL.scale.y = eyeR.scale.y = 1; pots.forEach((p) => { if (!p.grown) p.flower.rotation.z = Math.sin(t * 1.5) * .1; }); } });
    const bow = RAINBOW.map((c, k) => { const a = new THREE.Mesh(new THREE.TorusGeometry(8 - k * .55, .3, 8, 40, Math.PI), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0 })); a.position.set(0, .5, -10.3); scene.add(a); return a; });
    H.extra.push({ update: () => bow.forEach((a) => (a.material.opacity = lerp(a.material.opacity, H.done ? .85 : 0, .04))) });
  }

  if (key === 'uni') {
    scene.add(mk(new THREE.BoxGeometry(16, 2.4, 3), toon(0xffffff), [0, 1.2, -4]), mk(new THREE.BoxGeometry(16.4, .3, 3.4), 0xff9ecb, [0, 2.5, -4]));
    for (let i = 0; i < 7; i++) scene.add(mk(new THREE.ConeGeometry(.9, 1.2, 14).rotateX(Math.PI), pick([0xff9ecb, 0xffd84d, 0x9ff0c8]), [-9 + i * 3, 9, -8]));   // bunting
    const flav = [[0xff9ecb, 'strawberry'], [0xfff0c8, 'vanilla'], [0x8b5a3a, 'chocolate'], [0x9ff0c8, 'mint'], [0xffd84d, 'lemon'], [0xc9a8ff, 'grape']];
    // the order: 3, 4 or 5 scoops by her math level; at level 3+ a recipe (two strawberry and three lemon), then "how many?"
    const lvl = api.level ? api.level('math') : 0, recipe = lvl >= 3 ? [[0, 2], [4, 3]] : null;
    H.goal = recipe ? 5 : lvl >= 2 ? 5 : lvl >= 1 ? 4 : 3;
    const cellColor = H.colors = recipe ? recipe.flatMap(([f, n]) => Array(n).fill('#' + new THREE.Color(flav[f][0]).getHexString())) : null;
    const cone = new THREE.Group(); cone.position.set(0, 2.7, -4); scene.add(cone);
    cone.add(mk(new THREE.ConeGeometry(.9, 2.4, 16).rotateX(Math.PI), toon(0xe8b86a), [0, .9, 0]));
    const scoops = [], filled = []; let eating = false, ready = false;
    const tell = () => api.voice(recipe ? ['ice_make', 'n_2', 'ice_strawberry', 'and', 'n_3', 'ice_lemon'] : ['ice_make', `n_${H.goal}`, 'ice_scoops'], { priority: 1 });
    const glows = [];
    flav.forEach(([c], i) => {
      const tub = new THREE.Group(); tub.position.set((i - 2.5) * 2.5, 2.6, -3.4); scene.add(tub);
      tub.add(mk(cyl(.85, .7, .9, 20), toon(0xffffff), [0, .45, 0]), mk(sph(.8, 16, 10), toon(c), [0, .95, 0], [1, .55, 1]));
      if (recipe && recipe.some(([f]) => f === i)) { const gl = glowSprite(c, 4.2, .6); gl.position.set(0, 1.2, 0); tub.add(gl); glows.push(gl); }
      tapOn(tub, async () => {
        if (eating) return;
        if (scoops.length >= H.goal) { api.sfx.soft(); hop(host); return; }
        let cell = scoops.length;
        if (recipe) {                                     // only a flavour the recipe still needs; anything else just wobbles
          const at = recipe.findIndex(([f]) => f === i), start = recipe.slice(0, Math.max(0, at)).reduce((a, [, n]) => a + n, 0);
          cell = at < 0 ? -1 : [...Array(recipe[at][1]).keys()].map((k) => start + k).find((k) => !filled[k]) ?? -1;
          if (cell < 0) { api.sfx.soft(); tub.position.y = 2.9; timers.tween(.3, (e) => { tub.position.y = 2.9 - .3 * e; }); return; }
        }
        const s = mk(sph(.74, 18, 12), toon(c), [0, 2.1 + scoops.length * .98, 0]); cone.add(s); scoops.push(s); s.scale.setScalar(.2); filled[cell] = true;
        timers.tween(.4, (e) => s.scale.setScalar(.2 + .8 * e), { ease: ease.outBack }); api.sfx.pop(); fx.burst(cone.position.clone().add(new THREE.Vector3(0, 3 + scoops.length, 0)), { count: 16, colors: [c, 0xffffff], speed: 3, gravity: -2, life: .9, size: .8 });
        H.count = scoops.length; api.count(recipe ? filled : scoops.length, H.goal, { colors: cellColor });
        if (scoops.length === H.goal) {
          cherry.visible = true; cherry.position.y = 2.1 + H.goal * .98 - .1; api.sfx.sparkle(); hop(host);
          if (recipe) { await sleep(1); await ask(storyAdd(2, 3, { icon: '\u{1F353}', iconAlt: '\u{1F34B}' }), api.who, { icon: '\u{1F353}', iconAlt: '\u{1F34B}' }); }
          ready = true; api.status('\u{1F366} \u{1F449} \u{1F60B}'); api.voice('ice_eat', { priority: 1 });
        }
      }, 1.4);
    });
    const cherry = mk(sph(.35, 12, 8), 0xe8334a, [0, 6, 0]); cherry.visible = false; cone.add(cherry);
    tapOn(cone, async () => {
      if (eating || H.done) return;
      if (!ready) { api.sfx.soft(); tell(); return; }
      eating = true; cherry.visible = false;
      uni.lookToward(cone.position.x - uni.root.position.x, cone.position.z - uni.root.position.z, 1);
      while (scoops.length) { const s = scoops.pop(); api.sfx.crunch(); fx.burst(cone.position.clone().add(new THREE.Vector3(0, 3, 0)), { count: 14, colors: [0xffffff, 0xffb8d8], speed: 3, gravity: -3, life: .8 }); cone.remove(s); await sleep(.5); }
      api.sfx.yum(); await hop(uni); celebrate(); eating = false;
    }, 2.6);
    H.extra.push({ update: (t) => glows.forEach((g, k) => (g.material.opacity = .45 + Math.sin(t * 4 + k) * .2)) });
    timers.after(2.6, tell);
    host.root.position.set(5.5, 0, 3); uni.root.position.set(-5.5, 0, 3);
  }

  H.update = (dt, t) => {
    H.t += dt; const tt = H.t;
    timers.update(dt); fx.update(dt);
    uni.update(dt, tt, uni.speed || 0); host.update(dt, tt, 0);
    H.extra.forEach((e) => e.update && e.update(tt, dt));
    camera.position.x = Math.sin(tt * .25) * 1.2; camera.lookAt(look);
  };
  H.pointer = (ndc) => {
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(H.interactive, true)[0];
    if (!hit) { const u = ray.intersectObject(host.root, true)[0] || ray.intersectObject(uni.root, true)[0]; if (u) { api.sfx.giggle(); const w = ray.intersectObject(host.root, true)[0] ? host : uni; fx.burst(w.root.position.clone().add(new THREE.Vector3(0, 2.6, 0)), { count: 24, colors: RAINBOW, speed: 4, gravity: -1, life: 1, size: .9 }); hop(w); } return; }
    let o = hit.object; while (o && !o.userData.tap) o = o.parent; if (o) o.userData.tap(o);
  };
  H.resize = (a) => { camera.aspect = a; camera.fov = clamp(THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(76 / 2)) / a)), 42, 82); camera.updateProjectionMatrix(); };
  H.dispose = () => scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  setStyle('toon');
  progress(false);
  return H;
}
