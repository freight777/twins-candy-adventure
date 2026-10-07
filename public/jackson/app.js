/* Jackson's Vehicles: splash -> home (tap a vehicle) -> scene (tap anything: noise + wiggle) */

const $ = id => document.getElementById(id);
const splash = $('splash'), home = $('home'), scene = $('scene'), fxLayer = $('fx');
const rand = (a, b) => a + Math.random() * (b - a);

/* ---------- little helpers ---------- */
function cloudSVG() {
  return `<svg viewBox="0 0 200 100"><g fill="#fff"><ellipse cx="100" cy="68" rx="90" ry="26"/><circle cx="62" cy="52" r="32"/><circle cx="108" cy="42" r="40"/><circle cx="148" cy="56" r="28"/></g></svg>`;
}
function clouds(n, minTop, maxTop) {
  return Array.from({ length: n }, (_, i) =>
    `<div class="cloud" style="top:${rand(minTop, maxTop)}vh;animation-duration:${rand(45, 90)}s;animation-delay:-${rand(0, 80)}s;width:${rand(16, 30)}vmax;opacity:${rand(.75, 1)}">${cloudSVG()}</div>`).join('');
}
const BALLOON_COLORS = ['#ff4b4b', '#ffb02e', '#4aa8ff', '#35c46a', '#a46bff', '#ff7ac8'];
function balloons(n) {
  return Array.from({ length: n }, (_, i) => {
    const c = BALLOON_COLORS[i % BALLOON_COLORS.length];
    return `<svg class="balloon" viewBox="0 0 60 100" style="left:${rand(2, 92)}vw;animation-duration:${rand(11, 19)}s;animation-delay:-${rand(0, 16)}s">
      <ellipse cx="30" cy="34" rx="26" ry="32" fill="${c}" stroke="#2a2f55" stroke-width="3"/>
      <ellipse cx="20" cy="22" rx="7" ry="11" fill="#fff" opacity=".45"/>
      <path d="M26 66 L30 72 L34 66 Z" fill="${c}" stroke="#2a2f55" stroke-width="3" stroke-linejoin="round"/>
      <path d="M30 72 Q22 84 30 92" fill="none" stroke="#2a2f55" stroke-width="2.5"/></svg>`;
  }).join('');
}
const faceSVG = p => `<svg viewBox="0 0 100 100">${face(50, 50, 50, p)}</svg>`;

function burst(x, y, n = 9) {
  const bits = ['⭐', '💛', '✨', '🎉', '🌟', '💙', '🎈'];
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span'), a = rand(0, Math.PI * 2), d = rand(12, 26);
    s.className = 'pt'; s.textContent = bits[(Math.random() * bits.length) | 0];
    s.style.cssText = `left:${x}px;top:${y}px;--dx:${Math.cos(a) * d}vmin;--dy:${Math.sin(a) * d - 6}vmin;--rot:${rand(-90, 90)}deg;animation-delay:${i * 15}ms`;
    fxLayer.appendChild(s); setTimeout(() => s.remove(), 1200);
  }
}
function puff(x, y) {
  const s = document.createElement('span'), r = rand(2.2, 4);
  s.className = 'puff'; s.style.cssText = `left:${x}px;top:${y}px;width:${r}vmin;height:${r}vmin`;
  fxLayer.appendChild(s); setTimeout(() => s.remove(), 1700);
}

let screen = 'splash';
function show(name) {
  screen = name;
  splash.classList.toggle('hidden', name !== 'splash');
  home.classList.toggle('hidden', name !== 'home');
  scene.classList.toggle('hidden', name !== 'scene');
}

/* ---------- splash ---------- */
function buildSplash() {
  splash.innerHTML = `
    <div class="sky">${balloons(10)}</div>
    <div class="splash-title"><div class="s1">Happy 2nd Birthday</div><div class="s2">Jackson!</div></div>
    <div class="splash-photo-wrap"><div class="splash-photo">${faceSVG(0)}</div><div class="badge2">2</div></div>
    <button class="play" aria-label="Play"><svg viewBox="0 0 24 24"><path d="M6 3 L21 12 L6 21 Z" fill="#fff" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg></button>`;
  splash.addEventListener('pointerdown', e => {
    Sound.unlock(); Sound.fx('fanfare');
    burst(e.clientX, e.clientY, 12);
    setTimeout(() => { show('home'); }, 350);
  }, { once: true });
}

/* ---------- home ---------- */
let jacksonPhoto = 0;
function buildHome() {
  const cells = [];
  VEHICLES.forEach((v, i) => {
    if (i === 4) cells.push(`<div class="tile center" id="jtile"><div class="jackson" id="jackson"><div class="ring"></div><div class="pic" id="jpic">${faceSVG(0)}</div><div class="badge2">2</div></div></div>`);
    cells.push(`<button class="tile" data-id="${v.id}" style="background:${v.tile}" aria-label="${v.name}">${vehicleSVG(v)}</button>`);
  });
  home.innerHTML = `<div class="sky">${clouds(4, 4, 70)}${balloons(5)}</div><div class="grid">${cells.join('')}</div>`;
  home.querySelectorAll('.tile[data-id]').forEach(t => t.addEventListener('pointerdown', e => {
    e.preventDefault(); Sound.unlock();
    t.classList.add('go');
    openScene(VEHICLES.find(v => v.id === t.dataset.id));
  }));
  const jt = $('jtile');
  jt.addEventListener('pointerdown', e => {
    e.preventDefault(); Sound.unlock();
    jacksonPhoto = (jacksonPhoto + 1) % PHOTOS.length;
    $('jpic').innerHTML = faceSVG(jacksonPhoto);
    const j = $('jackson'); j.classList.remove('boing'); void j.offsetWidth; j.classList.add('boing');
    Sound.fx('giggle'); Sound.voice('jackson');
    burst(e.clientX, e.clientY, 10);
  });
}

/* ---------- scene ---------- */
const BG = {
  road: () => `<div class="sky sky-theme"><div class="sun"></div>${clouds(4, 4, 38)}</div>${hills('#7ed37f', '#5cbf6a')}<div class="ground road"></div>`,
  rail: () => `<div class="sky sky-theme"><div class="sun"></div>${clouds(4, 4, 38)}</div>${hills('#8bd87c', '#62c06b')}<div class="ground rail"></div>`,
  farm: () => `<div class="sky sky-theme"><div class="sun"></div>${clouds(3, 4, 30)}</div>${hills('#9be07a', '#74c95c')}${barn()}<div class="ground field"></div><div class="fence"></div>`,
  sky: () => `<div class="sky sky-theme"><div class="sun"></div>${clouds(9, 3, 78)}</div>${hills('#8bd87c', '#62c06b', 0)}`,
};
function hills(c1, c2, bottom = 14) {
  return `<svg class="hills" style="bottom:${bottom}%" viewBox="0 0 1000 300" preserveAspectRatio="none">
    <path d="M0 300 L0 150 Q150 40 320 130 T640 110 T1000 90 L1000 300 Z" fill="${c1}"/>
    <path d="M0 300 L0 210 Q180 120 400 200 T760 180 T1000 170 L1000 300 Z" fill="${c2}"/></svg>`;
}
function barn() {
  return `<svg class="barn" viewBox="0 0 120 100"><path d="M8 96 L8 44 L60 8 L112 44 L112 96 Z" fill="#e8382f" stroke="#2a2f55" stroke-width="4" stroke-linejoin="round"/>
    <path d="M30 96 L30 58 L90 58 L90 96 Z" fill="#c22a22" stroke="#fff" stroke-width="4"/><path d="M30 58 L90 96 M90 58 L30 96" stroke="#fff" stroke-width="4"/>
    <circle cx="60" cy="36" r="8" fill="#fff" stroke="#2a2f55" stroke-width="3"/></svg>`;
}

// where the exhaust comes out (fraction of the vehicle box), and how the vehicle moves
const MOTION = {
  dump:    { speed: 95,  puff: [.84, .12], y: 0 },
  fire:    { speed: 130, puff: null, y: 0 },
  bus:     { speed: 105, puff: [.02, .72], y: 0 },
  train:   { speed: 110, puff: [.87, .16], y: 0 },
  garbage: { speed: 85,  puff: [.04, .7], y: 0 },
  tractor: { speed: 70,  puff: [.77, .12], y: 0 },
  heli:    { speed: 60,  puff: null, y: .26, fly: 'hover' },
  plane:   { speed: 210, puff: null, y: .24, fly: 'cruise' },
};

let cur = null;      // active scene state
let raf = 0;

function openScene(v) {
  const m = MOTION[v.id];
  scene.innerHTML = `${BG[v.theme]()}
    <div class="vwrap" id="vwrap"><div class="vbounce" id="vbounce">${vehicleSVG(v)}</div></div>
    <button class="homebtn" id="homebtn" aria-label="Tap twice to go home">
      <svg class="house" viewBox="0 0 24 24"><path d="M3 11 L12 3 L21 11 M6 9.5 V20 H18 V9.5" fill="none" stroke="#2a2f55" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <svg class="ringsvg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46"/></svg>
      <span class="hint">Hold to go home</span>
    </button>`;
  show('scene');
  scene.classList.remove('open'); void scene.offsetWidth; scene.classList.add('open');
  setTimeout(() => home.querySelectorAll('.go').forEach(t => t.classList.remove('go')), 400);

  const wrap = $('vwrap'), bounce = $('vbounce');
  cur = { v, m, wrap, bounce, x: 0, t: 0, w: 0, h: 0, lastPuff: 0, lastTap: 0, lastActive: performance.now(), tipTimer: 0 };
  layout();
  cur.x = (innerWidth - cur.w) / 2;     // start in the middle so he sees it right away
  Sound.enter(v.id);
  burst(innerWidth / 2, innerHeight / 2, 8);
  cancelAnimationFrame(raf); cur.prev = performance.now(); raf = requestAnimationFrame(tick);
  setupHomeBtn();
}

function layout() {
  if (!cur) return;
  const vw = innerWidth, vh = innerHeight;
  const w = Math.min(vw * 0.74, vh * 1.05 * (412 / 262)) * (cur.v.id === 'train' ? 1.0 : 1);
  cur.w = w; cur.h = w * 262 / 412;
  cur.wrap.style.width = w + 'px';
  cur.wrap.style.top = 'auto'; cur.wrap.style.bottom = 'auto';
  if (cur.m.fly) cur.wrap.style.top = (vh * cur.m.y) + 'px';
  else cur.wrap.style.bottom = (vh * 0.05) + 'px';
}
addEventListener('resize', layout);

function tick(now) {
  if (!cur || screen !== 'scene') return;
  const dt = Math.min(0.05, (now - cur.prev) / 1000); cur.prev = now; cur.t += dt;
  const { m, w, h } = cur, vw = innerWidth;
  cur.x += m.speed * dt * (vw / 1024 > 0.6 ? vw / 1024 : 0.6);
  if (cur.x > vw + 20) cur.x = -w - 20;
  let y = 0, rot = 0;
  if (m.fly === 'hover') { y = Math.sin(cur.t * 1.6) * h * 0.05; rot = Math.sin(cur.t * 1.1) * 2.2; }
  else if (m.fly === 'cruise') { y = Math.sin(cur.t * 1.3) * h * 0.12; rot = Math.cos(cur.t * 1.3) * -4; }
  else { y = Math.abs(Math.sin(cur.t * 9)) * -h * 0.012; rot = Math.sin(cur.t * 5) * 0.25; }
  cur.wrap.style.transform = `translate3d(${cur.x}px,${y}px,0) rotate(${rot}deg)`;
  cur.wrap.classList.toggle('fast', m.speed > 120);
  if (m.puff && now - cur.lastPuff > 380 && cur.x > -w * .3 && cur.x < vw) {
    cur.lastPuff = now;
    const r = cur.wrap.getBoundingClientRect();
    puff(r.left + r.width * m.puff[0], r.top + r.height * m.puff[1]);
  }
  if (now - cur.lastActive > 60000) { goHome(); return; }   // wandered off? back to the menu
  raf = requestAnimationFrame(tick);
}

// tap anywhere in the scene: noise + wiggle + sparkles
scene.addEventListener('pointerdown', e => {
  if (!cur || e.target.closest('#homebtn')) return;
  e.preventDefault();
  const now = performance.now();
  cur.lastActive = now;
  const b = cur.bounce; b.classList.remove('boing'); void b.offsetWidth; b.classList.add('boing');
  burst(e.clientX, e.clientY, 7);
  if (now - cur.lastTap > 450) { cur.lastTap = now; Sound.poke(cur.v.id); }   // mashing is fine, just no sound pile-up
  if (cur.v.id === 'dump') {
    const svg = b.querySelector('svg'); svg.classList.add('tipping');
    clearTimeout(cur.tipTimer); cur.tipTimer = setTimeout(() => svg.classList.remove('tipping'), 1300);
  }
});

/* two quick taps on the house to leave (first tap lights the ring, second one within 1.5s goes home) */
function setupHomeBtn() {
  const btn = $('homebtn'); let armed = 0, timer = 0;
  btn.addEventListener('pointerdown', e => {
    e.preventDefault(); e.stopPropagation();
    if (armed) { clearTimeout(timer); goHome(); return; }
    armed = 1; btn.classList.add('armed');
    timer = setTimeout(() => { armed = 0; btn.classList.remove('armed'); }, 1500);
  });
}

function goHome() {
  cancelAnimationFrame(raf); cur = null;
  Sound.stopAll(); Sound.fx('whoosh');
  show('home');
}

/* ---------- go! ---------- */
buildSplash(); buildHome(); show('splash');
// iPad Safari ignores user-scalable=no, so block every zoom route by hand
['gesturestart', 'gesturechange', 'gestureend', 'dblclick'].forEach(t => document.addEventListener(t, e => e.preventDefault()));
document.addEventListener('touchstart', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
let lastTouchEnd = 0;
document.addEventListener('touchend', e => { const n = Date.now(); if (n - lastTouchEnd < 400) e.preventDefault(); lastTouchEnd = n; }, { passive: false });
document.addEventListener('contextmenu', e => e.preventDefault());
