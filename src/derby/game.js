import './derby.css';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { Q, loadTier, lowerTier } from '../quality.js';
import { skyEnv } from '../env.js';
import { Timers, Fx, ease, lerp, clamp, rand, pick, linearizeFrag, glowSprite, RAINBOW } from '../util.js';
import { unlock, playMusic, stopMusic, say, sfx } from '../audio.js';
import { buildStadium } from './stadium.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { createBatter, createPitcher, loadClips } from './players.js';

const $ = (s) => document.querySelector(s);

// ---------------------------------------------------------------- renderer (same glossy pipeline as the other 3D games)
const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
loadTier();
const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, 1, 0.5, 1500);
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.08, 0.4, 1.05);
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, sat: { value: 1.0 }, con: { value: 1.08 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float sat, con; varying vec2 vUv;
    void main(){ vec4 t = texture2D(tDiffuse, vUv); float l = dot(t.rgb, vec3(.2126,.7152,.0722));
      vec3 c = mix(vec3(l), t.rgb, sat); c = (c - .5)*con + .5; vec2 q = vUv - .5; c *= 1. - dot(q, q)*.9; gl_FragColor = vec4(clamp(c, 0., 1.), t.a); }`,
});
// broadcast-style image: ambient occlusion where things meet, and a shallow depth of field that softens the crowd and far wall (top quality tier only)
const gtao = new GTAOPass(scene, camera, 256, 256); gtao.blendIntensity = 0.9; gtao.updateGtaoMaterial({ radius: 0.9, distanceExponent: 1.4, thickness: 1.2, scale: 1.2, samples: 12 });
const bokeh = new BokehPass(scene, camera, { focus: 13, aperture: 0.00016, maxblur: 0.006 });
composer.addPass(new RenderPass(scene, camera)); composer.addPass(gtao); composer.addPass(bokeh); composer.addPass(bloom); composer.addPass(new OutputPass()); composer.addPass(grade);
function applyTier() { const pr = Math.min(window.devicePixelRatio, Q.pr); bloom.enabled = Q.bloom; gtao.enabled = bokeh.enabled = !!Q.post; renderer.setPixelRatio(pr); composer.setPixelRatio(pr); composer.setSize(innerWidth, innerHeight); }
function resize() { const w = innerWidth, h = innerHeight, a = w / h; renderer.setSize(w, h, false); composer.setSize(w, h); camera.aspect = a; camera.fov = clamp(THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(54 / 2)) / a)), 34, 62); camera.updateProjectionMatrix(); }
applyTier(); resize(); addEventListener('resize', resize); addEventListener('orientationchange', () => setTimeout(resize, 200));
['gesturestart', 'dblclick', 'contextmenu'].forEach((ev) => document.addEventListener(ev, (e) => e.preventDefault()));

// ---------------------------------------------------------------- settings & leaderboard (kept on this device)
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
};
const prefs = { name: store.get('derbyName', 'Tony'), helper: store.get('derbyHelper', true) };
const scores = () => store.get('derbyScores', []);
function saveScore(name, hr) { const all = scores(); all.push({ name, hr, at: Date.now() }); all.sort((a, b) => b.hr - a.hr || a.at - b.at); store.set('derbyScores', all.slice(0, 10)); store.set('derbyName', name); prefs.name = name; }
function boardHTML(hl) {
  const all = scores(); if (!all.length) return '<p class="empty">No scores yet. Hit some home runs!</p>';
  return '<ol>' + all.slice(0, 5).map((s, i) => `<li class="${hl && s.at === hl ? 'me' : ''}"><span class="rk">${['\u{1F947}', '\u{1F948}', '\u{1F949}', '4', '5'][i]}</span><span class="nm">${s.name.replace(/[<>&]/g, '')}</span><span class="sc">${s.hr} ⚾</span></li>`).join('') + '</ol>';
}

// ---------------------------------------------------------------- the game
const timers = new Timers(), fx = new Fx(scene, 1200);
const sleep = (s) => new Promise((r) => timers.after(s, r));
const anim = (dur, fn, e = ease.inOut) => new Promise((r) => timers.tween(dur, fn, { ease: e, done: r }));
const S = { state: 'boot', hr: 0, outs: 0, flight: null, lastLanes: [], time: 0, camMode: 'home', over: false };
const WIN = 0.55, LATE = 0.3;                          // seconds before / after the ball reaches the plate: a wide window
const LANE_X = 0.8, REL = new THREE.Vector3(0.4, 5.2, -15.0), PLATE_PT = (lane) => new THREE.Vector3(lane * LANE_X, HIT_Y, -0.2);
let HIT_Y = 3.3;
const ballPath = (lane, k) => new THREE.Vector3(lerp(REL.x, lane * LANE_X, k), lerp(REL.y, HIT_Y, k) + Math.sin(Math.min(k, 1) * Math.PI) * .6, lerp(REL.z, -0.2, k));
const flightTime = () => Math.max(1.6, 2.6 - Math.floor(S.hr / 4) * 0.12);
let stadium, batter, pitcher, ball, ballShadow, zoneGlow;
const camLook = new THREE.Vector3(0, 3.0, -18);

async function boot() {
  await new Promise((r) => setTimeout(r, 30));
  // photographic lighting (Poly Haven "Orlando Stadium" HDRI, CC0) and photo-scanned surfaces (ambientCG, CC0)
  const BASE = import.meta.env.BASE_URL, tl = new THREE.TextureLoader();
  const loadT = async (n) => { const g = async (f, srgb) => { const t = await tl.loadAsync(`${BASE}assets/derby/tex/${f}.jpg`); if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; }; return { c: await g(n + '_c', true), n: await g(n + '_n'), r: await g(n + '_r') }; };
  const T = { grass: await loadT('grass'), dirt: await loadT('dirt'), conc: await loadT('conc') };
  let hdr = null; try { hdr = await new HDRLoader().loadAsync(`${BASE}assets/derby/hdr/orlando_stadium_2k.hdr`); hdr.mapping = THREE.EquirectangularReflectionMapping; } catch (e) { console.warn('HDRI failed', e); }
  T.hdr = !!hdr;
  stadium = buildStadium(scene, T);
  if (hdr) { scene.environment = hdr; scene.background = hdr; scene.environmentIntensity = 1.0; scene.backgroundIntensity = 1.0; stadium.sky.visible = false; stadium.clouds.forEach((c) => (c.visible = false)); }
  else { scene.environment = skyEnv(renderer, 'park', { top: 0x6fb4ff, mid: 0xfff4e6, bottom: 0xb8e8a8, sun: [25, 40, -20], sunPower: 6 }); scene.environmentIntensity = 0.35; }
  scene.fog = new THREE.Fog(0xc8d8e8, 260, 820);
  scene.traverse((o) => { const m = o.material; if (m && m.isShaderMaterial && !m.userData.lin) { m.fragmentShader = linearizeFrag(m.fragmentShader); m.userData.lin = true; m.needsUpdate = true; } });
  const clips = await loadClips(import.meta.env.BASE_URL);              // real motion-capture swing and pitch (CMU Graphics Lab database)
  batter = createBatter(clips, 'JUDGE', '99'); batter.placeAt(0.0, -0.2); HIT_Y = batter.contactY; scene.add(batter.root);
  pitcher = createPitcher(clips); pitcher.root.position.set(0, .7, 0); pitcher.root.position.z = -15.0 - pitcher.releaseWorld().z; REL.copy(pitcher.releaseWorld()); scene.add(pitcher.root);
  scene.traverse((o) => { if (o.isMesh && o.geometry && o.geometry.type !== 'PlaneGeometry') { /* shadows only for the players */ } });
  [batter.root, pitcher.root].forEach((r) => r.traverse((o) => { if (o.isMesh) o.castShadow = true; }));
  ball = new THREE.Group(); ball.add(new THREE.Mesh(new THREE.SphereGeometry(.22, 24, 16), new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: .55 })));
  const seam = new THREE.Mesh(new THREE.TorusGeometry(.17, .014, 6, 24), new THREE.MeshBasicMaterial({ color: 0xb02828 })); seam.rotation.y = Math.PI / 2; ball.add(seam);
  const bg = glowSprite(0xffffff, 1.4, .35); ball.add(bg); ball.userData.glow = bg; ball.visible = false; scene.add(ball);
  ballShadow = new THREE.Mesh(new THREE.CircleGeometry(.4, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .3, depthWrite: false })); ballShadow.visible = false; scene.add(ballShadow);
  camera.position.set(0, 5.2, 12); camera.lookAt(camLook);
  $('#loading').classList.add('done'); setTimeout(() => $('#loading').remove(), 800);
  S.state = 'title'; taps(false); show('#title'); $('#name').value = prefs.name; $('#helper').textContent = `Helper arrows: ${prefs.helper ? 'ON' : 'OFF'}`;
}
const show = (sel, on = true) => $(sel).classList.toggle('hidden', !on);
const taps = (on) => document.querySelectorAll('.tap').forEach((e) => e.classList.toggle('hidden', !on));
const banner = (txt, cls = '', sec = 2) => { const b = $('#bigtext'); b.textContent = txt; b.className = cls; show('#bigtext'); b.style.animation = 'none'; void b.offsetWidth; b.style.animation = ''; if (sec) timers.after(sec, () => show('#bigtext', false)); };
const cue = (txt, cls = '') => { const c = $('#cue'); c.textContent = txt; c.className = cls; show('#cue', !!txt); };
const setHud = () => { $('#hr').textContent = S.hr; $('#outs').innerHTML = [0, 1, 2].map((i) => `<i class="${i < S.outs ? 'out' : ''}"></i>`).join(''); stadium.setScore(S.hr, S.outs, prefs.name); };

function start() {
  unlock(); playMusic('park'); show('#title', false); show('#over', false); show('#board', false); show('#hud'); taps(true);
  S.hr = 0; S.outs = 0; S.over = false; S.lastLanes = []; setHud();
  batter.unswing(); loop();
}

async function loop() {
  S.state = 'play';
  banner('PLAY BALL!', '', 1.6); say('Play ball!', 'counter'); sfx.charge(); await sleep(2);
  while (S.outs < 3 && !S.over) { await pitchOnce(); }
  if (!S.over) await gameOver();
}

function pickLane() {
  let lane = Math.random() < .5 ? -1 : 1; const l = S.lastLanes;
  if (l.length >= 2 && l[l.length - 1] === l[l.length - 2] && l[l.length - 1] === lane) lane = -lane;     // never 3 of the same side in a row
  l.push(lane); return lane;
}

async function pitchOnce() {
  const lane = pickLane();
  cue('Here comes the pitch!'); pitcher.root.rotation.y = 0;
  const wind = 1.5; await anim(wind, (k) => pitcher.pose(k), ease.linear);
  ball.visible = true; ballShadow.visible = true; ball.scale.setScalar(1); ball.position.copy(REL); pitcher.holdBall(false); sfx.swoosh(); anim(.6, (k) => pitcher.pose(1 + k * .36), ease.linear);
  S.flight = { t: 0, F: flightTime(), lane, resolved: false };
  cue(prefs.helper ? (lane < 0 ? '⬅️  LEFT!' : 'RIGHT!  ➡️') : '', 'side');
  const res = await new Promise((r) => (S.flight.resolve = r));
  await outcome(res, lane);
  S.flight = null; pitcher.idle();
}

function laneTheta(lane) { const px = batter.root.position.x + batter.pivot.position.x, pz = batter.root.position.z + batter.pivot.position.z; return Math.atan2(-(-0.2 - pz), lane * LANE_X - px); }

async function outcome(res, lane) {
  cue(''); const zone = stadium.zones[lane]; zone.material.opacity = 0;
  if (res.type === 'hit') {
    // swing, the ball jumps to the bat, then launches
    const k0 = S.flight.t / S.flight.F, to = ballPath(lane, 1);
    batter.setOffset(lane * LANE_X);
    batter.swing(() => { sfx.crack(); fx.burst(to, { count: 30, colors: [0xffffff, 0xffe14d, 0xffa030], speed: 6, gravity: -3, life: .7, size: 1 }); });
    sfx.swoosh();
    await anim(batter.contactDelay, (e) => ball.position.copy(ballPath(lane, lerp(k0, 1, e))), ease.out);
    await homeRun(to);
  } else if (res.type === 'wrong') {
    batter.setOffset(-lane * LANE_X); batter.swing(null); sfx.swoosh(); await keepFlying(); await miss('Swing and a miss!');
  } else {
    await keepFlying(); await miss('Strike!');
  }
  await sleep(.4); batter.unswing();
}

async function keepFlying() {                      // the pitch sails past the plate into the catcher's mitt
  const f = S.flight, a = ball.position.clone(), d = new THREE.Vector3(f.lane * LANE_X, 1.4, 3.6);
  await anim(.35, (k) => { ball.position.lerpVectors(a, d, k); ballShadow.position.set(ball.position.x, .06, ball.position.z); }, ease.linear);
  sfx.pop(); ball.visible = false; ballShadow.visible = false;
}

async function miss(msg) {
  S.outs++; setHud(); sfx.strike(); banner(msg + ' OUT!', 'bad', 2); say(msg, 'counter');
  await sleep(2.1);
}

async function homeRun(from) {
  S.state = 'flying';
  const ang = rand(-.62, .62), R = stadium.wallR + rand(16, 40), end = new THREE.Vector3(Math.sin(ang) * R, rand(12, 24), -Math.cos(ang) * R);
  const dur = 3.4, peak = 44; S.camMode = 'ball'; stadium.cheer(7);
  banner('HOME RUN!', 'good', 3.4); say('Home run!', 'counter'); sfx.cheer(); sfx.charge();
  ballShadow.visible = false;
  await anim(dur, (k) => {
    ball.position.set(lerp(from.x, end.x, k), lerp(from.y, end.y, k) + 4 * peak * k * (1 - k), lerp(from.z, end.z, k));
    ball.scale.setScalar(1 + k * 9); ball.rotation.x += .4;
    if (Math.random() < .8) fx.burst(ball.position, { count: 2, colors: [0xffffff, 0xffe14d, 0xff9f2e], speed: 1, gravity: -1, life: .8, size: 1.2 });
  }, ease.linear);
  S.hr++; setHud(); sfx.tada();
  for (let i = 0; i < 7; i++) { fx.burst(new THREE.Vector3(end.x + rand(-45, 45), rand(35, 70), end.z + rand(-25, 10)), { count: 70, colors: RAINBOW.concat([0xffffff, 0xffd84d]), speed: 12, gravity: -4, life: 2.2, size: 1.8 }); sfx.pop(); await sleep(.28); }
  ball.visible = false; S.camMode = 'home'; S.state = 'play';
  await sleep(1.6);
}

async function gameOver() {
  S.over = true; S.state = 'over'; stopMusic();
  banner('GAME OVER', 'bad', 0); await sleep(1.8); show('#bigtext', false);
  $('#final').textContent = S.hr; $('#over h2').textContent = S.hr === 0 ? 'Good try!' : S.hr >= 5 ? 'WOW! Superstar!' : 'Great game!';
  $('#name').value = prefs.name; $('#boardmini').innerHTML = boardHTML(); show('#hud', false); taps(false); show('#over');
  say(`You hit ${S.hr} home runs!`, 'counter');
}

// ---------------------------------------------------------------- input
function swing(side) {
  const f = S.flight; if (!f || f.resolved || S.state !== 'play') return;
  if (f.t < f.F - WIN) { cue(prefs.helper ? 'Wait for the glow!' : '', 'wait'); return; }
  f.resolved = true; f.resolve({ type: side === f.lane ? 'hit' : 'wrong' });
}
$('#tapL').addEventListener('pointerdown', (e) => { e.preventDefault(); unlock(); swing(-1); });
$('#tapR').addEventListener('pointerdown', (e) => { e.preventDefault(); unlock(); swing(1); });
addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft' || e.key === 'a') swing(-1); if (e.key === 'ArrowRight' || e.key === 'd') swing(1); });
$('#play').addEventListener('click', start);
$('#lbBtn').addEventListener('click', () => { $('#boardfull').innerHTML = boardHTML(); show('#board'); });
$('#closeBoard').addEventListener('click', () => show('#board', false));
$('#helper').addEventListener('click', () => { prefs.helper = !prefs.helper; store.set('derbyHelper', prefs.helper); $('#helper').textContent = `Helper arrows: ${prefs.helper ? 'ON' : 'OFF'}`; });
$('#save').addEventListener('click', () => { const nm = ($('#name').value || 'Tony').trim().slice(0, 10) || 'Tony'; const at = Date.now(); saveScore(nm, S.hr); const all = scores(); $('#boardmini').innerHTML = boardHTML(all.find((s) => s.name === nm && s.hr === S.hr)?.at); $('#save').disabled = true; $('#save').textContent = 'Saved ✅'; });
$('#again').addEventListener('click', () => { $('#save').disabled = false; $('#save').textContent = 'Save my score'; if (batter) { batter.root.traverse(() => {}); } start(); });

// ---------------------------------------------------------------- per-frame
function update(dt) {
  S.time += dt; const t = S.time;
  timers.update(dt); fx.update(dt); stadium.update(dt, t);
  batter.update(dt, t); if (!S.flight) pitcher.idle(t);
  const f = S.flight;
  if (f && !f.resolved) {
    f.t += dt; const k = f.t / f.F;
    ball.position.copy(ballPath(f.lane, k));
    ball.rotation.x += dt * 14; ballShadow.position.set(ball.position.x, .06, ball.position.z); ballShadow.scale.setScalar(clamp(1 - ball.position.y * .06, .4, 1));
    ball.scale.setScalar(1 + clamp(k, 0, 1.2) * 1.4);
    const near = f.t >= f.F - WIN && f.t <= f.F + LATE, z = stadium.zones[f.lane];
    z.material.opacity = near ? .9 : clamp(k - .3, 0, .5) * .6; z.material.color.set(near ? 0x7bff9a : 0xffffff);
    if (near && !f.said) { f.said = true; cue(prefs.helper ? 'NOW!' : '', 'now'); sfx.ting(); }
    if (f.t > f.F + LATE) { f.resolved = true; f.resolve({ type: 'late' }); }
  }
  if (S.debugCam) { camera.position.copy(S.debugCam.p); camera.lookAt(S.debugCam.l); return; }
  // camera: behind home plate; during a home run it swings to follow the ball
  const home = new THREE.Vector3(Math.sin(t * .2) * .6, 5.2, 12);
  camera.position.lerp(home, 1 - Math.exp(-2 * dt));
  const want = S.camMode === 'ball' ? ball.position.clone() : new THREE.Vector3(0, 3.0, -18);
  camLook.lerp(want, 1 - Math.exp(-(S.camMode === 'ball' ? 6 : 2.5) * dt)); camera.lookAt(camLook);
  stadium.sun.target.position.set(0, 0, -8);
}

const clock = new THREE.Clock(); let slow = 0, frames = 0;
renderer.setAnimationLoop(() => {
  if (!stadium || !batter || !pitcher) return;
  const raw = clock.getDelta(), dt = Math.min(raw, 0.05);
  update(dt); composer.render(dt);
  if (raw > 0.03 && raw < 0.5) slow++;
  if (++frames === 150) { if (slow > 80 && lowerTier()) { applyTier(); resize(); } slow = 0; frames = 0; }
});
window.derby = { S, camera, get batter() { return batter; }, get ball() { return ball; }, swing, start };
boot().catch((e) => { console.error(e); $('.l-text').textContent = 'Oops, something went wrong. Please reload!'; });
