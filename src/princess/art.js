// All the pictures are drawn in code (SVG) so the game needs no image files.

const plate = '<ellipse cx="50" cy="84" rx="46" ry="11" fill="#fff" stroke="#d9c9d6" stroke-width="2"/><ellipse cx="50" cy="82" rx="34" ry="7" fill="#f3e9f1"/>';

export const FOODS = [
  {
    id: 'noodles', name: 'noodles', a: 'a bowl of noodles',
    svg: `<svg viewBox="0 0 100 100">${plate}
      <path d="M16 52 Q50 96 84 52 Z" fill="#e0443e" stroke="#a82a26" stroke-width="2"/>
      <ellipse cx="50" cy="52" rx="34" ry="9" fill="#ffd978"/>
      <path d="M24 52 q6-14 12 0 t12 0 t12 0 t12 0" fill="none" stroke="#f2b632" stroke-width="4" stroke-linecap="round"/>
      <path d="M30 48 q6-12 12 0 t12 0 t12 0" fill="none" stroke="#ffe9a0" stroke-width="3.5" stroke-linecap="round"/>
      <circle cx="40" cy="50" r="5" fill="#7bd66b"/><circle cx="62" cy="50" r="4" fill="#ff8d4d"/>
      <path d="M58 46 L88 8 M66 48 L94 14" stroke="#b9763a" stroke-width="3" stroke-linecap="round"/></svg>`,
  },
  {
    id: 'pupusas', name: 'pupusas', a: 'a pupusa',
    svg: `<svg viewBox="0 0 100 100">${plate}
      <ellipse cx="50" cy="66" rx="36" ry="14" fill="#c8923e"/>
      <ellipse cx="50" cy="60" rx="36" ry="14" fill="#f0c372"/>
      <circle cx="34" cy="58" r="3" fill="#b9762a"/><circle cx="52" cy="54" r="3" fill="#b9762a"/><circle cx="66" cy="61" r="3" fill="#b9762a"/><circle cx="44" cy="65" r="2.5" fill="#b9762a"/><circle cx="72" cy="55" r="2" fill="#b9762a"/>
      <path d="M78 62 q10 4 4 10 q-6 4-10-2z" fill="#ffd84a"/>
      <path d="M12 44 q8-16 22-8 q-6 14-22 8z" fill="#7bd66b"/><path d="M20 38 q8-8 14-2" stroke="#e0443e" stroke-width="3" fill="none"/></svg>`,
  },
  {
    id: 'popsicle', name: 'a popsicle', a: 'a popsicle',
    svg: `<svg viewBox="0 0 100 100">
      <ellipse cx="50" cy="90" rx="40" ry="8" fill="#fff" stroke="#d9c9d6" stroke-width="2"/><rect x="44" y="60" width="12" height="28" rx="5" fill="#e7b777"/>
      <rect x="28" y="6" width="44" height="62" rx="22" fill="#ff6fa8"/>
      <rect x="28" y="40" width="44" height="28" rx="14" fill="#ff9d4d"/><rect x="28" y="36" width="44" height="14" fill="#ff9d4d"/>
      <path d="M28 40 q11 10 22 0 t22 0 v-8 h-44z" fill="#ff6fa8"/>
      <rect x="35" y="14" width="8" height="26" rx="4" fill="#fff" opacity=".55"/></svg>`,
  },
  {
    id: 'bread', name: 'bread with butter', a: 'bread with butter',
    svg: `<svg viewBox="0 0 100 100">${plate}
      <path d="M20 70 V36 q0-20 18-20 q6 0 12 4 q6-4 12-4 q18 0 18 20 V70 q0 8-8 8 H28 q-8 0-8-8z" fill="#c8893e"/>
      <path d="M26 68 V38 q0-14 14-14 q5 0 10 3 q5-3 10-3 q14 0 14 14 V68 q0 5-5 5 H31 q-5 0-5-5z" fill="#f7d58e"/>
      <rect x="38" y="40" width="24" height="16" rx="3" fill="#ffe65c" transform="rotate(-8 50 48)"/>
      <rect x="38" y="40" width="24" height="5" rx="2" fill="#fff6a8" transform="rotate(-8 50 48)"/></svg>`,
  },
];

// A simple princess; `mood` swaps the mouth.
export function princessSVG(mood = 'happy') {
  const mouth = mood === 'happy'
    ? '<path d="M82 98 q18 18 36 0 q-18 6-36 0z" fill="#b3203d" stroke="#8c1230" stroke-width="2"/>'
    : '<path d="M86 104 q14 -8 28 0" fill="none" stroke="#8c1230" stroke-width="4" stroke-linecap="round"/>';
  return `<svg viewBox="0 0 200 320">
    <path d="M20 316 q-6-70 40-150 h80 q46 80 40 150z" fill="#ff7eb6" stroke="#d94d8f" stroke-width="4"/>
    <path d="M60 166 h80 l-6 22 q-34 14-68 0z" fill="#ffb6d8"/>
    <path d="M50 250 q50 20 100 0" fill="none" stroke="#ffe27a" stroke-width="6"/>
    <circle cx="100" cy="190" r="9" fill="#ffd84a"/>
    <path d="M62 170 q-32 30-26 62" fill="none" stroke="#ffd9bd" stroke-width="16" stroke-linecap="round"/>
    <path d="M138 170 q32 30 26 62" fill="none" stroke="#ffd9bd" stroke-width="16" stroke-linecap="round"/>
    <rect x="86" y="140" width="28" height="30" rx="10" fill="#ffd9bd"/>
    <path d="M40 90 q-6-70 60-70 q66 0 60 70 q2 50-10 80 q-20-30-50-30 q-30 0-50 30 q-12-30-10-80z" fill="#5b3a29"/>
    <circle cx="100" cy="92" r="52" fill="#ffd9bd"/>
    <path d="M52 76 q8-44 48-44 q40 0 48 44 q-30-26-48-26 q-18 0-48 26z" fill="#5b3a29"/>
    <circle cx="80" cy="86" r="7" fill="#3a2418"/><circle cx="120" cy="86" r="7" fill="#3a2418"/>
    <circle cx="82" cy="84" r="2.5" fill="#fff"/><circle cx="122" cy="84" r="2.5" fill="#fff"/>
    <circle cx="68" cy="102" r="8" fill="#ff9db8" opacity=".7"/><circle cx="132" cy="102" r="8" fill="#ff9db8" opacity=".7"/>
    ${mouth}
    <path d="M62 44 l8-30 l16 18 l14-26 l14 26 l16-18 l8 30z" fill="#ffd84a" stroke="#e0a800" stroke-width="3"/>
    <circle cx="100" cy="30" r="5" fill="#ff4d8d"/><circle cx="76" cy="38" r="3.5" fill="#5bc0ff"/><circle cx="124" cy="38" r="3.5" fill="#5bc0ff"/>
  </svg>`;
}

export const castleSVG = `
  <g fill="#ffffff" opacity=".9"><ellipse cx="60" cy="40" rx="30" ry="9"/><ellipse cx="330" cy="30" rx="34" ry="10"/></g>
  <g stroke="#c75b9b" stroke-width="2">
    <rect x="140" y="70" width="120" height="130" fill="#ffd6ea"/>
    <rect x="90" y="50" width="48" height="150" fill="#ffc2e0"/>
    <rect x="262" y="50" width="48" height="150" fill="#ffc2e0"/>
    <rect x="178" y="20" width="44" height="180" fill="#ffb3d9"/>
    <path d="M86 50 L114 10 L142 50z" fill="#b06bdc"/><path d="M258 50 L286 10 L314 50z" fill="#b06bdc"/><path d="M174 20 L200 -24 L226 20z" fill="#b06bdc"/>
  </g>
  <path d="M200 -24 v-14 l16 6 l-16 6" fill="#ff4d8d"/>
  <g fill="#8fd3ff" stroke="#c75b9b" stroke-width="2"><rect x="108" y="80" width="12" height="22" rx="6"/><rect x="280" y="80" width="12" height="22" rx="6"/><rect x="194" y="50" width="12" height="24" rx="6"/></g>
  <path d="M176 200 v-44 q24-30 48 0 v44z" fill="#a8672f" stroke="#7a4a20" stroke-width="2"/>`;
