import './derby.css';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { Q, loadTier, lowerTier, raiseTier } from '../quality.js';
import { skyEnv } from '../env.js';
import { Timers, Fx, ease, lerp, clamp, rand, pick, linearizeFrag, glowSprite, canvasTex, RAINBOW } from '../util.js';
import { unlock, playMusic, stopMusic, say, sfx } from '../audio.js';
import { buildStadium } from './stadium.js';
import { createTracer } from './tracer.js';
import { makeBallMesh } from './props.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { createBatter, createPitcher, loadClips } from './players.js';

const $ = (s) => document.querySelector(s);
let stadium, batter, pitcher, ball, ballShadow, zoneGlow, tracer, hrTracer, blobB, blobP;

// ---------------------------------------------------------------- renderer (same glossy pipeline as the other 3D games)
const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
loadTier('derbyTier');                                 // this game remembers its own quality tier (and never remembers 'low')
const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, 1, 0.5, 1500);
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.08, 0.4, 1.05);
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, sat: { value: 1.0 }, con: { value: 1.08 }, time: { value: 0 }, grain: { value: .03 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float sat, con, time, grain; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
    void main(){ vec4 t = texture2D(tDiffuse, vUv); float l = dot(t.rgb, vec3(.2126,.7152,.0722));
      vec3 c = mix(vec3(l), t.rgb, sat); c = (c - .5)*con + .5; vec2 q = vUv - .5; c *= 1. - dot(q, q)*.55;
      c += (hash(vUv*vec2(1920.,1080.) + fract(time)*61.) - .5) * grain;                  // fine film grain
      gl_FragColor = vec4(clamp(c, 0., 1.), t.a); }`,
});
// broadcast-style image: ambient occlusion where things meet, and a shallow depth of field that softens the crowd and far wall (top quality tier only)
const gtao = new GTAOPass(scene, camera, 256, 256); gtao.blendIntensity = 0.9; gtao.updateGtaoMaterial({ radius: 0.9, distanceExponent: 1.4, thickness: 1.2, scale: 1.2, samples: 12 });
const bokeh = new BokehPass(scene, camera, { focus: 13, aperture: 0.00016, maxblur: 0.006 });
composer.addPass(new RenderPass(scene, camera)); composer.addPass(gtao); composer.addPass(bokeh); composer.addPass(bloom); composer.addPass(new OutputPass()); composer.addPass(grade);
function applyTier() { const pr = Math.min(window.devicePixelRatio, Q.pr); if (stadium) { stadium.setDensity(Q.name === 'low' ? .45 : Q.name === 'medium' ? .75 : 1); stadium.setShadows(Q.name); } bloom.enabled = Q.bloom; gtao.enabled = bokeh.enabled = !!Q.post; renderer.setPixelRatio(pr); composer.setPixelRatio(pr); composer.setSize(innerWidth, innerHeight); }
function resize() { const w = innerWidth, h = innerHeight, a = w / h; renderer.setSize(w, h, false); composer.setSize(w, h); camera.aspect = a; camera.fov = clamp(THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(54 / 2)) / a)), 34, 62); camera.updateProjectionMatrix(); }
applyTier(); resize(); addEventListener('resize', resize); addEventListener('orientationchange', () => setTimeout(resize, 200));
['gesturestart', 'dblclick', 'contextmenu'].forEach((ev) => document.addEventListener(ev, (e) => e.preventDefault()));

// ---------------------------------------------------------------- settings & leaderboard (kept on this device)
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
};
const prefs = { name: store.get('derbyName', 'Tony'), helper: store.get('derbyHelper', true), time: store.get('derbyTime', 'night') };
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
const PITCH = { fast: { lift: .9, spin: -17 }, curve: { lift: 2.0, spin: 15 } };       // lift = how far the pitch rises before it dives; spin = ball rotation (rad/s): backspin / topspin
const ballPath = (lane, k, type = 'fast') => {
  const kk = Math.min(k, 1), j = 1 - kk, yc = REL.y + PITCH[type].lift;
  const y = j * j * REL.y + 2 * j * kk * yc + kk * kk * HIT_Y;                                  // quadratic curve: rises a touch, then drops into the zone
  const x = lerp(REL.x, lane * LANE_X, kk * kk * (3 - 2 * kk) * .55 + kk * .45);               // drifts toward its side, mostly late
  return new THREE.Vector3(x, y, lerp(REL.z, -0.2, kk));
};
const flightTime = () => Math.max(1.6, 2.6 - Math.floor(S.hr / 4) * 0.12);
const camLook = new THREE.Vector3(0, 3.0, -18);
const env = { day: null, night: null, hdr: null };
/** day game or night game under the lights */
function setTime(mode) {
  const night = mode === 'night'; prefs.time = mode; store.set('derbyTime', mode);
  stadium.setMode(mode);
  scene.environment = night ? env.night : env.day; scene.background = night ? null : env.hdr; scene.environmentIntensity = night ? .55 : (env.hdr ? 1 : .35); scene.backgroundIntensity = 1;
  scene.fog.color.set(night ? 0x0a1022 : 0xc8d8e8); scene.fog.near = night ? 230 : 260; scene.fog.far = night ? 640 : 820;
  renderer.toneMappingExposure = night ? 1.0 : .95; bloom.strength = night ? .4 : .08; bloom.threshold = night ? 1.8 : 1.05;
  grade.uniforms.sat.value = night ? 1.16 : 1.0; grade.uniforms.con.value = night ? 1.12 : 1.08;
  const b = $('#time'); if (b) b.textContent = `Time: ${night ? 'Night' : 'Day'}`;
}

async function boot() {
  await new Promise((r) => setTimeout(r, 30));
  // photographic lighting (Poly Haven "Orlando Stadium" HDRI, CC0) and photo-scanned surfaces (ambientCG, CC0)
  const BASE = import.meta.env.BASE_URL, tl = new THREE.TextureLoader();
  const loadT = async (n) => { const g = async (f, srgb) => { const t = await tl.loadAsync(`${BASE}assets/derby/tex/${f}.jpg`); if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; }; return { c: await g(n + '_c', true), n: await g(n + '_n'), r: await g(n + '_r') }; };
  const T = { grass: await loadT('grass'), dirt: await loadT('dirt'), conc: await loadT('conc') };
  let hdr = null; try { hdr = await new HDRLoader().loadAsync(`${BASE}assets/derby/hdr/orlando_stadium_2k.hdr`); hdr.mapping = THREE.EquirectangularReflectionMapping; } catch (e) { console.warn('HDRI failed', e); }
  T.hdr = !!hdr;
  stadium = buildStadium(scene, T); stadium.setDensity(Q.name === 'low' ? .45 : Q.name === 'medium' ? .75 : 1); stadium.setShadows(Q.name);
  if (hdr) { scene.environment = hdr; scene.background = hdr; scene.environmentIntensity = 1.0; scene.backgroundIntensity = 1.0; stadium.sky.visible = false; stadium.clouds.forEach((c) => (c.visible = false)); }
  else { scene.environment = skyEnv(renderer, 'park', { top: 0x6fb4ff, mid: 0xfff4e6, bottom: 0xb8e8a8, sun: [25, 40, -20], sunPower: 6 }); scene.environmentIntensity = 0.35; }
  scene.fog = new THREE.Fog(0xc8d8e8, 260, 820);
  env.day = scene.environment; env.hdr = hdr; env.night = skyEnv(renderer, 'derbynight', { top: 0x0b1226, mid: 0x22335e, bottom: 0x090d16, sun: [10, 70, -40], sunColor: 0xbcd0ff, sunPower: 1.6 });
  scene.traverse((o) => { const m = o.material; if (m && m.isShaderMaterial && !m.userData.lin) { m.fragmentShader = linearizeFrag(m.fragmentShader); m.userData.lin = true; m.needsUpdate = true; } });
  const clips = await loadClips(import.meta.env.BASE_URL);              // real motion-capture swing and pitch (CMU Graphics Lab database)
  batter = createBatter(clips, 'JUDGE', '99'); batter.placeAt(0.0, -0.2); HIT_Y = batter.contactY; scene.add(batter.root);
  pitcher = createPitcher(clips); pitcher.root.position.set(0, .7, 0); pitcher.root.position.z = -15.0 - pitcher.releaseWorld().z; REL.copy(pitcher.releaseWorld()); scene.add(pitcher.root);
  scene.traverse((o) => { if (o.isMesh && o.geometry && o.geometry.type !== 'PlaneGeometry') { /* shadows only for the players */ } });
  [batter.root, pitcher.root].forEach((r) => r.traverse((o) => { if (o.isMesh) o.castShadow = true; }));
  ball = new THREE.Group(); ball.add(makeBallMesh(.16));
  const bg = glowSprite(0xffffff, 1.1, .3); ball.add(bg); ball.userData.glow = bg; ball.visible = false; scene.add(ball);
  ballShadow = new THREE.Mesh(new THREE.CircleGeometry(.4, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .3, depthWrite: false })); ballShadow.visible = false; scene.add(ballShadow);
  tracer = createTracer(scene, { n: 14, px: 3, opacity: .35 }); hrTracer = createTracer(scene, { n: 46, px: 9, color: 0xffe9a8, opacity: .9 });
  const blobTex = canvasTex(128, 128, (g, w, h) => { const gr = g.createRadialGradient(64, 64, 6, 64, 64, 62); gr.addColorStop(0, 'rgba(0,0,0,.6)'); gr.addColorStop(.5, 'rgba(0,0,0,.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  const mkBlob = () => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, fog: false })); m.renderOrder = 1; scene.add(m); return m; };
  blobB = mkBlob(); blobP = mkBlob();
  camera.position.set(0, 5.2, 12); camera.lookAt(camLook); setTime(prefs.time);
  $('#loading').classList.add('done'); setTimeout(() => $('#loading').remove(), 800);
  S.state = 'title'; taps(false); show('#title'); $('#name').value = prefs.name; $('#helper').textContent = `Helper arrows: ${prefs.helper ? 'ON' : 'OFF'}`; gfxLabel();
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
  S.pitchNo = (S.pitchNo || 0) + 1; tracer.clear();
  S.flight = { t: 0, F: flightTime(), lane, resolved: false, type: S.pitchNo > 2 && Math.random() < .4 ? 'curve' : 'fast' };
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
    const type = S.flight.type, k0 = S.flight.t / S.flight.F, to = ballPath(lane, 1, type);
    batter.setOffset(lane * LANE_X);
    batter.swing(() => { sfx.crack(); fx.burst(to, { count: 30, colors: [0xffffff, 0xffe14d, 0xffa030], speed: 6, gravity: -3, life: .7, size: 1 }); });
    sfx.swoosh();
    await anim(batter.contactDelay, (e) => ball.position.copy(ballPath(lane, lerp(k0, 1, e), type)), ease.out);
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
  const ang = rand(-.62, .62), end = stadium.landing(ang);
  const dur = 3.4, peak = 44; S.camMode = 'ball'; stadium.cheer(7);
  banner('HOME RUN!', 'good', 3.4); say('Home run!', 'counter'); sfx.cheer(); sfx.charge();
  ballShadow.visible = false;
  await anim(dur, (k) => {
    ball.position.set(lerp(from.x, end.x, k), lerp(from.y, end.y, k) + 4 * peak * k * (1 - k), lerp(from.z, end.z, k));
    ball.scale.setScalar(1 + k * 1.3); ball.userData.glow.scale.setScalar(1 + k * 2.5); ball.rotation.x -= .5; hrTracer.push(ball.position);
  }, ease.linear);
  ball.visible = false; hrTracer.clear(); ball.userData.glow.scale.setScalar(1); fx.burst(end, { count: 40, colors: [0xffffff, 0xffe14d, 0xd8c8a0], speed: 5, gravity: -5, life: 1.1, size: 1.2 }); stadium.cheer(7);   // it drops into the seats and the fans go wild
  S.hr++; setHud(); sfx.tada();
  for (let i = 0; i < 7; i++) { fx.burst(new THREE.Vector3(end.x + rand(-45, 45), rand(35, 70), end.z + rand(-25, 10)), { count: 90, colors: [0xffffff, 0xffe9a8, 0xffc04d, 0xff6a4a], speed: 12, gravity: -2.2, life: 2.8, size: 1.8 }); sfx.pop(); await sleep(.28); }
  ball.visible = false; hrTracer.clear(); S.camMode = 'home'; S.state = 'play';
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
const gfxLabel = () => { $('#gfx').textContent = `Graphics: ${gfx.auto ? 'Auto' : 'Best'}`; };
$('#gfx').addEventListener('click', () => { gfx.auto = !gfx.auto; store.set('derbyGfx', gfx.auto ? 'auto' : 'high'); if (!gfx.auto) { Q.name !== 'high' && (loadTierHigh()); } gfxLabel(); });
function loadTierHigh() { while (Q.name !== 'high' && raiseTier(null)); applyTier(); resize(); }
$('#time').addEventListener('click', () => setTime(prefs.time === 'night' ? 'day' : 'night'));
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
    ball.position.copy(ballPath(f.lane, k, f.type)); tracer.push(ball.position);
    ball.rotation.x += dt * PITCH[f.type].spin; ball.rotation.z += dt * 2.5; ballShadow.position.set(ball.position.x, .06, ball.position.z); ballShadow.scale.setScalar(clamp(1 - ball.position.y * .06, .4, 1));
    ball.scale.setScalar(1 + clamp(k, 0, 1.2) * .5);
    const near = f.t >= f.F - WIN && f.t <= f.F + LATE, z = stadium.zones[f.lane];
    z.material.opacity = near ? .9 : clamp(k - .3, 0, .5) * .6; z.material.color.set(near ? 0x7bff9a : 0xffffff);
    if (near && !f.said) { f.said = true; cue(prefs.helper ? 'NOW!' : '', 'now'); sfx.ting(); }
    if (f.t > f.F + LATE) { f.resolved = true; f.resolve({ type: 'late' }); }
  }
  grade.uniforms.time.value = t; groundShadow(blobB, batter.rig); groundShadow(blobP, pitcher.rig);
  if (S.debugCam) { camera.position.copy(S.debugCam.p); camera.lookAt(S.debugCam.l); ribbons(); return; }
  // camera: behind home plate; during a home run it swings to follow the ball
  const home = new THREE.Vector3(Math.sin(t * .2) * .6, 5.2, 12);
  camera.position.lerp(home, 1 - Math.exp(-2 * dt));
  const want = S.camMode === 'ball' ? ball.position.clone() : new THREE.Vector3(0, 3.0, -18);
  camLook.lerp(want, 1 - Math.exp(-(S.camMode === 'ball' ? 6 : 2.5) * dt)); camera.lookAt(camLook);
  stadium.sun.target.position.set(0, 0, -8);
  ribbons();
}
function ribbons() { tracer.update(camera, innerHeight, S.flight && !S.flight.resolved ? 1 : 0); hrTracer.update(camera, innerHeight, 1); }
/** a soft dark patch under a player's feet so they sit on the ground */
function groundShadow(blob, rig) {
  if (!blob || !rig || !rig.skinned) return;
  const a = rig.wp(rig.gb('DEF-foot.L')), b = rig.wp(rig.gb('DEF-foot.R')), sp = Math.hypot(a.x - b.x, a.z - b.z);
  blob.position.set((a.x + b.x) / 2, .055, (a.z + b.z) / 2); blob.scale.set(2.6 + sp * .7, 1, 2.1 + sp * .45);
}

const clock = new THREE.Clock(); const gfx = { auto: store.get('derbyGfx', 'auto') !== 'high', slow: 0, frames: 0, fast: 0, mute: performance.now() + 6000, noRaise: 0, lowered: 0 };
document.addEventListener('visibilitychange', () => { gfx.mute = performance.now() + 3000; gfx.slow = gfx.frames = gfx.fast = 0; });
function adapt(raw) {
  const now = performance.now(); if (!gfx.auto || now < gfx.mute || document.hidden || raw >= .5) return;
  gfx.frames++; if (raw > .03) gfx.slow++; if (raw < .02) gfx.fast++; else gfx.fast = 0;
  const change = () => { applyTier(); resize(); try { if (Q.name === 'low') localStorage.removeItem('derbyTier'); else localStorage.setItem('derbyTier', Q.name); } catch { /* ignore */ } };
  if (gfx.frames >= 150) { if (gfx.slow > 80 && lowerTier(null)) { gfx.lowered++; gfx.noRaise = now + 45000; gfx.fast = 0; change(); } gfx.slow = gfx.frames = 0; }
  if (gfx.fast >= 300 && now > gfx.noRaise && gfx.lowered < 3 && raiseTier(null)) { gfx.fast = 0; change(); }
}
renderer.setAnimationLoop(() => {
  if (!stadium || !batter || !pitcher) return;
  const raw = clock.getDelta(), dt = Math.min(raw, 0.05);
  update(dt); composer.render(dt); adapt(raw);
});
window.derby = { S, camera, renderer, passes: { gtao, bokeh, bloom, grade }, get stadium() { return stadium; }, get batter() { return batter; }, get pitcher() { return pitcher; }, get ball() { return ball; }, swing, start };
boot().catch((e) => { console.error(e); $('.l-text').textContent = 'Oops, something went wrong. Please reload!'; });
