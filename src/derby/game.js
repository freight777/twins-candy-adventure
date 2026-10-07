import './derby.css';
import { loading } from '../engine/loading.js';
import { homeGate } from '../engine/gate.js';
import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { createPipeline } from '../engine/pipeline.js';
import { Q, auto as autoTier, chooseTier } from '../engine/quality.js';
import { skyEnv } from '../env.js';
import { Timers, Fx, ease, lerp, clamp, rand, linearizeFrag, glowSprite, canvasTex } from '../util.js';
import { unlock, playMusic, stopMusic, say, sayAsync, voice, sfx, crowdBed } from '../audio.js';
import { ask } from '../engine/quiz.js';
import { kid, levelOf, remember, startSession } from '../learn/profile.js';
import { earn } from '../engine/sticker.js';
import { buildStadium } from './stadium.js';
import { createTracer } from './tracer.js';
import { makeBallMesh } from './props.js';
import { createSwingTrail } from './swingtrail.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { createBatter, createPitcher, loadClips } from './players.js';

const $ = (s) => document.querySelector(s);
homeGate();
let stadium, batter, pitcher, ball, ballShadow, zoneGlow, tracer, hrTracer, blobB, blobP, swingTrail, baseFov = 54, replay = null;

// ---------------------------------------------------------------- renderer: the shared pipeline (src/engine/pipeline.js) plus this game's broadcast extras
const canvas = $('#c');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, 1, 0.5, 1500);
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, sat: { value: 1.0 }, con: { value: 1.08 }, time: { value: 0 }, grain: { value: .03 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float sat, con, time, grain; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
    void main(){ vec2 q0 = vUv - .5, off = q0 * dot(q0, q0) * .006;                                  // a whisper of lens colour fringing toward the corners
      vec4 t = vec4(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b, texture2D(tDiffuse, vUv).a); float l = dot(t.rgb, vec3(.2126,.7152,.0722));
      vec3 c = mix(vec3(l), t.rgb, sat); c = (c - .5)*con + .5; vec2 q = vUv - .5; c *= 1. - dot(q, q)*.55;
      c += (hash(vUv*vec2(1920.,1080.) + fract(time)*61.) - .5) * grain;                  // fine film grain
      gl_FragColor = vec4(clamp(c, 0., 1.), t.a); }`,
});
// broadcast-style image: ambient occlusion where things meet, and a shallow depth of field that softens the crowd and far wall (top quality tier only)
const gtao = new GTAOPass(scene, camera, 256, 256); gtao.blendIntensity = 0.9; gtao.updateGtaoMaterial({ radius: 0.9, distanceExponent: 1.4, thickness: 1.2, scale: 1.2, samples: 10 });
const bokeh = new BokehPass(scene, camera, { focus: 13, aperture: 0.00016, maxblur: 0.006 });
const depthSkip = [];
function collectDepthSkip() { depthSkip.length = 0; scene.traverse((o) => { const m = o.material; if (o.isSprite || o.isPoints || (o.isMesh && m && (Array.isArray(m) ? m.some((x) => x.transparent) : m.transparent))) depthSkip.push(o); }); }
[gtao, bokeh].forEach((p) => { const run = p.render.bind(p); p.render = (...args) => { const vis = depthSkip.map((o) => o.visible); depthSkip.forEach((o) => (o.visible = false)); try { run(...args); } finally { depthSkip.forEach((o, i) => (o.visible = vis[i])); } }; });
const pipe = createPipeline(canvas, { toneMapping: THREE.ACESFilmicToneMapping, exposure: 0.95, bloom: { strength: 0.08, radius: 0.4, threshold: 1.05 }, gradePass: grade, extraPasses: [gtao, bokeh] });
const renderer = pipe.renderer, bloom = pipe.bloomPass;
pipe.setScene(scene, camera);
const COARSE = matchMedia('(pointer: coarse)').matches;
pipe.onTier = (q) => { if (stadium) { stadium.setDensity(q.name === 'low' ? .45 : q.name === 'medium' ? .75 : 1); stadium.setShadows(q.name, q.shadow); } gtao.enabled = bokeh.enabled = !!q.post && !COARSE; };
pipe.onResize = (a) => { camera.aspect = a; baseFov = a < 1 ? clamp(THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(54 / 2)) / a)), 34, 62) : 54 * clamp(Math.pow(a, -.4), .8, 1); camera.fov = baseFov; camera.updateProjectionMatrix(); };
pipe.applyTier();
['gesturestart', 'dblclick', 'contextmenu'].forEach((ev) => document.addEventListener(ev, (e) => e.preventDefault()));

// ---------------------------------------------------------------- settings & leaderboard (kept on this device)
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
};
const prefs = { who: store.get('derbyWho', 'tony'), helper: store.get('derbyHelper', true), time: store.get('derbyTime', 'night') };
const PLAYERS = { tony: { emoji: '⚾', name: 'Tony' }, adalyn: { emoji: '\u{1F984}', name: 'Addie' }, esmae: { emoji: '\u{1F9DC}‍♀️', name: 'Esmae' } };
/** scores are { who, hr, at }; older saved scores had a typed name */
const scores = () => store.get('derbyScores', []).map((s) => (s.who ? s : { who: /^add/i.test(s.name || '') ? 'adalyn' : /^esm/i.test(s.name || '') ? 'esmae' : 'tony', hr: s.hr, at: s.at }));
function saveScore(who, hr) { const all = scores(), at = Date.now(); all.push({ who, hr, at }); all.sort((a, b) => b.hr - a.hr || a.at - b.at); store.set('derbyScores', all.slice(0, 10)); store.set('derbyWho', who); prefs.who = who; return at; }
/** the top five as rows of gold baseballs you can count (with the number too once Tony's math is past counting) */
function boardHTML(hl) {
  const all = scores(); if (!all.length) return '<p class="empty">⚾ ⚾ ⚾</p>';
  const nums = levelOf('tony', 'math') >= 2;
  return '<ol>' + all.slice(0, 5).map((s, i) => `<li class="${hl && s.at === hl ? 'me' : ''}"><span class="rk">${['\u{1F947}', '\u{1F948}', '\u{1F949}', '4', '5'][i]}</span><span class="av">${(PLAYERS[s.who] || PLAYERS.tony).emoji}</span><span class="gb">${'<i></i>'.repeat(Math.min(s.hr, 20))}</span>${nums ? `<span class="sc">${s.hr}</span>` : ''}</li>`).join('') + '</ol>';
}

// ---------------------------------------------------------------- the game
const timers = new Timers(), fx = new Fx(scene, 1200);
const sleep = (s) => new Promise((r) => timers.after(s, r));
const anim = (dur, fn, e = ease.inOut) => new Promise((r) => timers.tween(dur, fn, { ease: e, done: r }));
const S = { state: 'boot', hr: 0, balls: [], dists: [], flight: null, lastLanes: [], time: 0, camMode: 'home', over: false, timeScale: 1, stop: null, punch: 0, push: 0 };
const PITCHES = 10;                                     // a game is ten pitches: no outs, nothing to lose
const WIN = 0.55, LATE = 0.3;                          // seconds before / after the ball reaches the plate: a wide window
const LANE_X = 1.4, REL = new THREE.Vector3(0.4, 5.2, -15.0);
/** the two sides, told apart without reading: said out loud, and blue on the left, red on the right */
const LANE_COL = { '-1': 0x4aa8ff, 1: 0xff4a5e };
let HIT_Y = 3.3;
const PITCH = { fast: { lift: .9, spin: -17 }, curve: { lift: 2.0, spin: 15 } };       // lift = how far the pitch rises before it dives; spin = ball rotation (rad/s): backspin / topspin
const ballPath = (lane, k, type = 'fast') => {
  const kk = Math.min(k, 1), j = 1 - kk, yc = REL.y + PITCH[type].lift;
  const y = j * j * REL.y + 2 * j * kk * yc + kk * kk * HIT_Y;                                  // quadratic curve: rises a touch, then drops into the zone
  const x = lerp(REL.x, lane * LANE_X, kk * kk * (3 - 2 * kk) * .3 + kk * .7);                 // drifts toward its side early enough to see which side
  return new THREE.Vector3(x, y, lerp(REL.z, -0.2, kk));
};
const flightTime = () => Math.max(1.6, 2.6 - Math.floor(S.hr / 4) * 0.12);
const camLook = new THREE.Vector3(0, 3.0, -18);
const env = { dayFallback: null, night: null, hdr: null, failed: false, job: null };
/** the daytime sky photo (Poly Haven "Orlando Stadium" HDRI, CC0, 1k) is only fetched when someone actually chooses Day */
function ensureHdr() {
  if (env.hdr || env.failed) return Promise.resolve(env.hdr);
  return env.job || (env.job = new HDRLoader().loadAsync(`${import.meta.env.BASE_URL}assets/derby/hdr/orlando_stadium_1k.hdr`).then((h) => { h.mapping = THREE.EquirectangularReflectionMapping; env.hdr = h; return h; }).catch((e) => { console.warn('HDRI failed', e); env.failed = true; return null; }));
}
/** day game or night game under the lights */
async function setTime(mode) {
  if (mode !== 'night' && !env.hdr && !env.failed) { const lb = $('#time'); if (lb) lb.textContent = 'Time: ...'; await ensureHdr(); }
  prefs.time = mode; store.set('derbyTime', mode);
  applyTime(mode, mode === 'night' ? null : env.hdr);
}
function applyTime(mode, hdr) {
  const night = mode === 'night';
  stadium.setMode(mode, !!env.hdr);
  scene.environment = night ? env.night : (hdr || env.dayFallback); scene.background = hdr; scene.environmentIntensity = night ? .55 : (hdr ? 1 : .35); scene.backgroundIntensity = 1;
  scene.fog.color.set(night ? 0x0a1022 : 0xc8d8e8); scene.fog.near = night ? 230 : 260; scene.fog.far = night ? 640 : 820;
  renderer.toneMappingExposure = night ? 1.0 : .95; bloom.strength = night ? .4 : .08; bloom.threshold = night ? 1.8 : 1.05;
  grade.uniforms.sat.value = night ? 1.16 : 1.0; grade.uniforms.con.value = night ? 1.12 : 1.08;
  const b = $('#time'); if (b) b.textContent = `Time: ${night ? 'Night' : 'Day'}`;
}

async function boot() {
  await new Promise((r) => setTimeout(r, 30));
  // photographic lighting (Poly Haven "Orlando Stadium" HDRI, CC0) and photo-scanned surfaces (ambientCG, CC0)
  const BASE = import.meta.env.BASE_URL, tl = new THREE.TextureLoader(), tick = loading.counter(11);
  // everything loads at once; a texture set that fails just falls back to the stadium's drawn surfaces
  const g = (f, srgb) => tl.loadAsync(`${BASE}assets/derby/tex/${f}.jpg`).then((t) => { if (srgb) t.colorSpace = THREE.SRGBColorSpace; tick(); return t; }).catch(() => { tick(); return null; });
  const set = (n) => Promise.all([g(n + '_c', true), g(n + '_n'), g(n + '_r')]).then(([c, nn, r]) => (c && nn && r ? { c, n: nn, r } : null));
  const [grass, dirt, conc, clips] = await Promise.all([set('grass'), set('dirt'), set('conc'), loadClips(import.meta.env.BASE_URL).then((x) => { tick(); return x; })]);   // (real motion-capture swing and pitch, CMU Graphics Lab)
  const T = { grass, dirt, conc, hdr: true };
  stadium = buildStadium(scene, T); stadium.setDensity(Q.name === 'low' ? .45 : Q.name === 'medium' ? .75 : 1); stadium.setShadows(Q.name);
  env.dayFallback = skyEnv(renderer, 'park', { top: 0x6fb4ff, mid: 0xfff4e6, bottom: 0xb8e8a8, sun: [25, 40, -20], sunPower: 6 });
  scene.fog = new THREE.Fog(0xc8d8e8, 260, 820);
  env.night = skyEnv(renderer, 'derbynight', { top: 0x0b1226, mid: 0x22335e, bottom: 0x090d16, sun: [10, 70, -40], sunColor: 0xbcd0ff, sunPower: 1.6 });
  scene.traverse((o) => { const m = o.material; if (m && m.isShaderMaterial && !m.userData.lin) { m.fragmentShader = linearizeFrag(m.fragmentShader); m.userData.lin = true; m.needsUpdate = true; } });
  batter = createBatter(clips, 'JUDGE', '99'); batter.placeAt(0.0, -0.2); HIT_Y = batter.contactY; scene.add(batter.root);
  pitcher = createPitcher(clips); pitcher.root.position.set(0, .7, 0); pitcher.root.position.z = -15.0 - pitcher.releaseWorld().z; REL.copy(pitcher.releaseWorld()); scene.add(pitcher.root);
  [batter.root, pitcher.root].forEach((r) => r.traverse((o) => { if (o.isMesh) o.castShadow = true; }));
  ball = new THREE.Group(); ball.add(makeBallMesh(.16));
  const bg = glowSprite(0xffffff, 1.1, .3); ball.add(bg); ball.userData.glow = bg; ball.visible = false; scene.add(ball);
  ballShadow = new THREE.Mesh(new THREE.CircleGeometry(.4, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .3, depthWrite: false })); ballShadow.visible = false; scene.add(ballShadow);
  swingTrail = createSwingTrail(scene); tracer = createTracer(scene, { n: 14, px: 3, opacity: .35 }); hrTracer = createTracer(scene, { n: 46, px: 9, color: 0xffe9a8, opacity: .9 });
  const blobTex = canvasTex(128, 128, (g, w, h) => { const gr = g.createRadialGradient(64, 64, 6, 64, 64, 62); gr.addColorStop(0, 'rgba(0,0,0,.6)'); gr.addColorStop(.5, 'rgba(0,0,0,.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  const mkBlob = () => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, fog: false })); m.renderOrder = 1; scene.add(m); return m; };
  blobB = mkBlob(); blobP = mkBlob();
  camera.position.set(0, 5.2, 12); camera.lookAt(camLook); scene.environment = env.night; applyTime(prefs.time, null);
  collectDepthSkip();
  try { await Promise.race([renderer.compileAsync(scene, camera), new Promise((r) => setTimeout(r, 4000))]); } catch { /* the first frame will compile instead */ }       // build the shaders now, behind the loading screen, so the first frames are smooth
  loading.done();
  S.state = 'title'; taps(false); show('#title'); $('#helper').textContent = `Helper arrows: ${prefs.helper ? 'ON' : 'OFF'}`; gfxLabel();
  if (prefs.time === 'day') setTime('day');
}
const show = (sel, on = true) => $(sel).classList.toggle('hidden', !on);
const taps = (on) => document.querySelectorAll('.tap').forEach((e) => e.classList.toggle('hidden', !on));
const banner = (txt, cls = '', sec = 2, sub = '') => { const b = $('#bigtext'); b.textContent = txt; if (sub) { const sm = document.createElement('small'); sm.textContent = sub; b.appendChild(sm); } b.className = cls; show('#bigtext'); b.style.animation = 'none'; void b.offsetWidth; b.style.animation = ''; if (sec) timers.after(sec, () => show('#bigtext', false)); };
const cue = (txt, cls = '') => { const c = $('#cue'); c.textContent = txt; c.className = cls; show('#cue', !!txt); };
/** the scoreboard is a ten-frame of baseballs: gold for a home run, grey for a miss, white still to come */
const setHud = () => { $('#hr').textContent = S.hr; $('#balls').innerHTML = Array.from({ length: PITCHES }, (_, i) => `<i class="${S.balls[i] || ''}"></i>`).join(''); stadium.setScore(S.hr, S.balls, PITCHES, (PLAYERS[prefs.who] || PLAYERS.tony).name); };

function start() {
  unlock(); playMusic('park'); crowdBed(true); show('#title', false); show('#over', false); show('#board', false); show('#hud'); taps(true);
  S.hr = 0; S.balls = []; S.dists = []; S.over = false; S.lastLanes = []; S.pitchNo = 0; setHud(); startSession('tony');
  batter.unswing(); loop();
}

async function loop() {
  S.state = 'play';
  banner('PLAY BALL!', '', 1.6); say('Play ball!', 'announcer'); sfx.charge(); await sleep(2);
  while (S.balls.length < PITCHES && !S.over) { await pitchOnce(); }
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
  cue(prefs.helper ? (lane < 0 ? '⬅️  LEFT!' : 'RIGHT!  ➡️') : '', 'side ' + (lane < 0 ? 'left' : 'right'));
  say(lane < 0 ? 'Left!' : 'Right!', 'announcer', { priority: 2 });
  ball.userData.glow.material.color.set(LANE_COL[lane]); document.body.dataset.live = lane < 0 ? 'left' : 'right';
  const res = await new Promise((r) => (S.flight.resolve = r));
  delete document.body.dataset.live; ball.userData.glow.material.color.set(0xffffff);
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
    batter.swing(() => { sfx.crack(); S.stop = { t: 0 }; S.punch = 1; fx.burst(to, { count: 30, colors: [0xffffff, 0xffe14d, 0xffa030], speed: 6, gravity: -3, life: .7, size: 1 }); });
    sfx.swoosh();
    await anim(batter.contactDelay, (e) => ball.position.copy(ballPath(lane, lerp(k0, 1, e), type)), ease.out);
    await homeRun(to);
  } else if (res.type === 'wrong') {
    batter.setOffset(-lane * LANE_X); batter.swing(null); sfx.swoosh(); await keepFlying(); await miss();
  } else {
    await keepFlying(); await miss();
  }
  await sleep(.4); batter.unswing();
}

async function keepFlying() {                      // the pitch sails past the plate into the catcher's mitt
  const f = S.flight, a = ball.position.clone(), d = new THREE.Vector3(f.lane * LANE_X, 1.4, 3.6);
  await anim(.35, (k) => { ball.position.lerpVectors(a, d, k); ballShadow.position.set(ball.position.x, .06, ball.position.z); }, ease.linear);
  sfx.pop(); ball.visible = false; ballShadow.visible = false;
}

/** a miss costs nothing: a grey ball on the scoreboard and "Almost! Try again!" */
async function miss() {
  S.balls.push('miss'); setHud(); sfx.soft(); banner('Almost!', 'soft', 1.6); say('Almost! Try again!', 'announcer');
  await sleep(1.8);
}

async function homeRun(from) {
  S.state = 'flying';
  const ang = rand(-.62, .62), end = stadium.landing(ang);
  const dur = 3.4, peak = 44; S.camMode = 'ball'; stadium.cheer(7);
  const mph = Math.round(rand(98, 113)), last = S.dists[S.dists.length - 1];
  let ft = Math.round(rand(395, 505) / 5) * 5; if (last && Math.abs(ft - last) < 20) ft += ft > 450 ? -35 : 35;     // (spread out, so two in a row are easy to compare)
  banner('HOME RUN!', 'good', 3.4, `${ft} ft  \u2022  ${mph} mph`); say('Home run!', 'counter'); sfx.cheer(); sfx.charge();
  ballShadow.visible = false;
  await anim(dur, (k) => {
    ball.position.set(lerp(from.x, end.x, k), lerp(from.y, end.y, k) + 4 * peak * k * (1 - k), lerp(from.z, end.z, k));
    ball.scale.setScalar(1 + k * 1.3); ball.userData.glow.scale.setScalar(1 + k * 2.5); ball.rotation.x -= .5; hrTracer.push(ball.position);
  }, ease.linear);
  ball.visible = false; hrTracer.clear(); ball.userData.glow.scale.setScalar(1); fx.burst(end, { count: 40, colors: [0xffffff, 0xffe14d, 0xd8c8a0], speed: 5, gravity: -5, life: 1.1, size: 1.2 }); stadium.cheer(7);   // it drops into the seats and the fans go wild
  S.hr++; S.balls.push('hr'); S.dists.push(ft); stadium.celebrate(ft >= 500 ? 'MOON SHOT!' : 'HOME RUN!', `${ft} FT  \u2022  ${mph} MPH`, 4.5); setHud(); sfx.tada(); import('../engine/celebrate.js').then((m) => m.fireworks(scene, camera, ft >= 500 ? 5 : 3));
  if (ft >= 500) earn('tony', 'egg-moon');                                       // (an easter egg: a moon shot)
  (async () => { const dir = new THREE.Vector3(end.x, 0, end.z).normalize(), side = new THREE.Vector3(-dir.z, 0, dir.x); for (let i = 0; i < 7; i++) { fx.burst(end.clone().addScaledVector(dir, rand(55, 85)).addScaledVector(side, rand(-60, 60)).setY(rand(92, 120)), { count: 110, colors: [0xffffff, 0xffe9a8, 0xffc04d, 0xff6a4a, 0x7ab4ff], speed: 17, gravity: -2.6, life: 3, size: 3.2 }); sfx.pop(); await sleep(.28); } })();
  if (S.hr <= 2 || await offerReplay()) await playReplay(from, end, ft, mph, peak);       // the first two in full; after that, only if asked (📺)
  ball.visible = false; hrTracer.clear(); S.camMode = 'home'; S.state = 'play';
  await sleep(.9);
  if (S.hr % 3 === 0) await fartherQ();
}
/** a little 📺 button for a moment: tap it to watch the replay */
function offerReplay() {
  return new Promise((res) => {
    const b = $('#replayBtn'); show('#replayBtn'); let done = false;
    const end = (v) => { if (done) return; done = true; show('#replayBtn', false); b.onclick = null; res(v); };
    b.onclick = (e) => { e.stopPropagation(); end(true); }; timers.after(2.2, () => end(false));
  });
}
/** IM K Unit 2, compare: the last two home runs as two bars (the length is the concrete picture, the number the abstract) */
async function fartherQ() {
  const [a, b] = S.dists.slice(-2); if (a == null || b == null || a === b) return;
  const bar = (ft, col) => { const w = Math.round(46 + (ft - 380) / 140 * 150); return `<svg viewBox="0 0 250 64" class="bar"><rect x="4" y="10" width="${w}" height="40" rx="12" fill="${col}"/><circle cx="${w - 14}" cy="30" r="10" fill="#fff"/><text x="${w + 12}" y="42" font-family="Fredoka, sans-serif" font-weight="700" font-size="30" fill="#14234a">${ft}</text></svg>`; };
  taps(false);
  await ask({ id: `far:${Math.abs(a - b) <= 25 ? 'close' : 'clear'}`, strand: 'math', kind: 'compare', prompt: { voice: ['which_is_farther'], say: 'Which one went farther?' },
    choices: [{ html: bar(a, '#4aa8ff'), say: `${a} feet`, correct: a > b }, { html: bar(b, '#ffb030'), say: `${b} feet`, correct: b > a }], answerVoice: ['that_one_farther'], answerSay: 'That one went farther!' }, 'tony');
  taps(true);
}

/** the same flight again from a seat in the stands behind where it landed (tap to skip) */
function playReplay(from, end, ft, mph, peak) {
  return new Promise((res) => {
    const pos = new THREE.Vector3(end.x > 0 ? -22 : 22, 30, 54);                       // an aerial view from up behind the plate, off to one side, so the whole flight and the crowd show                       // up and back from the seat it lands in (the stands rise away from the field), so the view clears the rows in front
    replay = { t: 0, dur: 2.6, from: from.clone(), end: end.clone(), pos, peak, res, skip: false, look: from.clone() };
    S.camMode = 'replay'; taps(false); cue(''); camera.position.copy(pos); camLook.copy(from); camera.lookAt(camLook);
    ball.visible = true; ball.scale.setScalar(1); ball.userData.glow.scale.setScalar(1.6); hrTracer.clear();
    $('#replayinfo').textContent = `${ft} ft  \u2022  ${mph} mph`; show('#replay');
  });
}
function updateReplay(dt) {
  const R = replay; R.t += dt; const k = clamp(R.t / R.dur, 0, 1), e = k;
  ball.position.set(lerp(R.from.x, R.end.x, e), lerp(R.from.y, R.end.y, e) + 4 * R.peak * e * (1 - e), lerp(R.from.z, R.end.z, e)); ball.rotation.x -= .5; hrTracer.push(ball.position);
  R.look.lerp(ball.position, 1 - Math.exp(-5 * dt)); camera.position.copy(R.pos); camera.position.y += Math.sin(S.time * .9) * .03; camera.lookAt(R.look);
  bokeh.uniforms.focus.value = lerp(bokeh.uniforms.focus.value, Math.max(4, camera.position.distanceTo(ball.position)), 1 - Math.exp(-6 * dt));
  if (k >= 1 || R.skip) { replay = null; ball.userData.glow.scale.setScalar(1); show('#replay', false); camera.position.set(0, 5.2, 12); camLook.set(0, 3, -18); camera.lookAt(camLook); ball.visible = false; hrTracer.clear(); taps(true); R.res(); }
}

/** the end of ten pitches is always a celebration: count the gold balls together, and beat last time? */
async function gameOver() {
  S.over = true; S.state = 'over'; stopMusic(); crowdBed(false); taps(false);
  const hero = S.hr >= 5;
  banner(hero ? 'HOME RUN HERO!' : 'GREAT GAME!', 'good', 0); sfx.tada(); stadium.cheer(5);
  await sayAsync(hero ? 'Home run hero!' : 'Great game!', 'announcer', { priority: 2 }); await sleep(.4);
  const gold = [...document.querySelectorAll('#balls i.hr')];
  for (let i = 0; i < gold.length; i++) { gold[i].classList.add('counted'); sfx.collect(i); await voice(`n_${i + 1}`, { priority: 2, minMs: 450 }); }
  if (gold.length) await voice(gold.length === 1 ? 'home_run' : 'home_runs', { priority: 2 });
  const best = kid('tony').best || 0;
  if (best && S.hr > best) await voice(S.hr === best + 1 ? 'one_more_than_last' : 'new_best', { priority: 2 });
  if (S.hr > best) remember('tony', 'best', S.hr);
  if (hero) earn('tony', 'derby-hero'); if (best && S.hr > best) earn('tony', 'derby-best');
  show('#bigtext', false);
  $('#final').textContent = S.hr; $('#over h2').textContent = hero ? '\u{1F31F}' : '\u{1F389}';
  $('#boardmini').innerHTML = boardHTML(); document.querySelectorAll('#who button').forEach((b) => { b.disabled = false; b.classList.remove('picked'); });
  show('#hud', false); show('#over');
}

// ---------------------------------------------------------------- input
function swing(side) {
  const f = S.flight; if (!f || f.resolved || S.state !== 'play') return;
  if (f.t < f.F - WIN) { cue(prefs.helper ? 'Wait for the glow!' : '', 'wait'); return; }
  f.resolved = true; f.resolve({ type: side === f.lane ? 'hit' : 'wrong' });
}
addEventListener('pointerdown', (e) => { if (replay && !e.target.closest('#home')) replay.skip = true; });
$('#tapL').addEventListener('pointerdown', (e) => { e.preventDefault(); unlock(); swing(-1); });
$('#tapR').addEventListener('pointerdown', (e) => { e.preventDefault(); unlock(); swing(1); });
addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft' || e.key === 'a') swing(-1); if (e.key === 'ArrowRight' || e.key === 'd') swing(1); });
$('#play').addEventListener('click', start);
$('#lbBtn').addEventListener('click', () => { $('#boardfull').innerHTML = boardHTML(); show('#board'); });
$('#closeBoard').addEventListener('click', () => show('#board', false));
const gfxLabel = () => { $('#gfx').textContent = `Graphics: ${autoTier.on ? 'Auto' : Q.name === 'high' ? 'Best' : Q.name}`; };
$('#gfx').addEventListener('click', () => { chooseTier(autoTier.on ? 'high' : null); pipe.applyTier(); gfxLabel(); });      // Best = always the top tier (remembered); Auto = adjusts itself
$('#time').addEventListener('click', () => setTime(prefs.time === 'night' ? 'day' : 'night'));
$('#helper').addEventListener('click', () => { prefs.helper = !prefs.helper; store.set('derbyHelper', prefs.helper); $('#helper').textContent = `Helper arrows: ${prefs.helper ? 'ON' : 'OFF'}`; });
// who played? three big avatar buttons, no keyboard
document.querySelectorAll('#who button').forEach((b) => b.addEventListener('click', () => {
  const at = saveScore(b.dataset.who, S.hr); $('#boardmini').innerHTML = boardHTML(at);
  document.querySelectorAll('#who button').forEach((x) => { x.disabled = true; x.classList.toggle('picked', x === b); }); sfx.good();
}));
$('#again').addEventListener('click', start);

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
    z.material.opacity = near ? .95 : clamp(k - .2, 0, .6) * .9; z.material.color.set(near ? 0x7bff9a : LANE_COL[f.lane]);
    if (near && !f.said) { f.said = true; cue(prefs.helper ? 'NOW!' : '', 'now'); sfx.ting(); }
    if (f.t > f.F + LATE) { f.resolved = true; f.resolve({ type: 'late' }); }
  }
  grade.uniforms.time.value = t; groundShadow(blobB, batter.rig); groundShadow(blobP, pitcher.rig);
  if (batter.swinging) { const [a, b] = batter.barrel(); swingTrail.update(a, b, dt); } else swingTrail.update(null, null, dt);
  if (S.debugCam) { camera.position.copy(S.debugCam.p); camera.lookAt(S.debugCam.l); ribbons(); return; }
  if (replay) { updateReplay(dt); ribbons(); return; }
  bokeh.uniforms.focus.value = lerp(bokeh.uniforms.focus.value, S.camMode === 'ball' ? Math.max(6, camera.position.distanceTo(ball.position)) : 13, 1 - Math.exp(-5 * dt));
  // camera: behind home plate; during a home run it swings to follow the ball
  camera.position.lerp(_home.set(Math.sin(t * .2) * .6, 5.2, 12), 1 - Math.exp(-2 * dt));
  const pf = S.flight, lean = pf && !pf.resolved ? clamp((pf.t - (pf.F - .4)) / .4, 0, 1) : 0;
  S.push = lerp(S.push, lean, 1 - Math.exp(-(lean > S.push ? 12 : 4) * dt));
  const p = S.punch * S.punch, fov = baseFov * (1 - .075 * p) * (1 - .12 * S.push);
  if (p > 1e-6) { camera.position.x += (Math.random() - .5) * .22 * p; camera.position.y += (Math.random() - .5) * .16 * p; }
  if (Math.abs(camera.fov - fov) > .01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  const want = S.camMode === 'ball' ? _want.copy(ball.position) : _want.set(0, 3.0, -18);
  camLook.lerp(want, 1 - Math.exp(-(S.camMode === 'ball' ? 6 : 2.5) * dt)); camera.lookAt(camLook);
  stadium.sun.target.position.set(0, 0, -8);
  ribbons();
}
const _want = new THREE.Vector3(), _home = new THREE.Vector3();
function ribbons() { tracer.update(camera, innerHeight, S.flight && !S.flight.resolved ? 1 : 0); hrTracer.update(camera, innerHeight, 1); }
/** a soft dark patch under a player's feet so they sit on the ground */
function groundShadow(blob, rig) {
  if (!blob || !rig || !rig.skinned) return;
  const a = rig.wp(rig.gb('DEF-foot.L')), b = rig.wp(rig.gb('DEF-foot.R')), sp = Math.hypot(a.x - b.x, a.z - b.z);
  blob.position.set((a.x + b.x) / 2, .055, (a.z + b.z) / 2); blob.scale.set(2.6 + sp * .7, 1, 2.1 + sp * .45);
}

pipe.start((real) => {
  if (!stadium || !batter || !pitcher) return false;
  if (S.stop) { S.stop.t += real; const k = S.stop.t; S.timeScale = k < .11 ? .08 : lerp(.08, 1, clamp((k - .11) / .32, 0, 1)); if (k > .45) { S.timeScale = 1; S.stop = null; } }   // hit-stop
  S.punch = Math.max(0, S.punch - real * 3.2);
  update(real * S.timeScale);
});
window.derby = { S, scene, camera, renderer, passes: { gtao, bokeh, bloom, grade }, step: (dt = 1 / 60) => stadium && batter && update(dt), get stadium() { return stadium; }, get batter() { return batter; }, get pitcher() { return pitcher; }, get ball() { return ball; }, swing, start };
boot().catch((e) => { console.error(e); loading.fail(); });
