// All the pictures are drawn in code (SVG, so they stay sharp on any screen) and need no image files.
// Every SVG gets its own gradient ids (uid) so several copies can sit on the page at once.

let n = 0;
const uid = () => 'g' + (n++) + '_';

// ---------- plates & food ----------
const plateDefs = (p) => `<linearGradient id="${p}pl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d9cfe0"/></linearGradient>
  <radialGradient id="${p}pi" cx=".5" cy=".4" r=".7"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e6dcec"/></radialGradient>`;
const plateArt = (p) => `<ellipse cx="50" cy="90" rx="42" ry="6" fill="#000" opacity=".12"/>
  <ellipse cx="50" cy="84" rx="46" ry="12" fill="url(#${p}pl)" stroke="#cdbfd6" stroke-width="1.5"/>
  <ellipse cx="50" cy="83" rx="38" ry="9" fill="url(#${p}pi)" stroke="#f2c14e" stroke-width="1.5"/>`;

function noodlesSVG() {
  const p = uid();
  return `<svg viewBox="0 0 100 100"><defs>${plateDefs(p)}
    <linearGradient id="${p}b" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b92a2a"/><stop offset=".35" stop-color="#ff6a5c"/><stop offset="1" stop-color="#a72424"/></linearGradient>
    <radialGradient id="${p}r" cx=".5" cy=".5" r=".6"><stop offset="0" stop-color="#f6c562"/><stop offset="1" stop-color="#d9892c"/></radialGradient>
    <linearGradient id="${p}c" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e9c28a"/><stop offset="1" stop-color="#a8702f"/></linearGradient></defs>
    ${plateArt(p)}
    <path d="M13 48 C13 78 32 92 50 92 C68 92 87 78 87 48Z" fill="url(#${p}b)" stroke="#8c1f1f" stroke-width="1.5"/>
    <path d="M17 62 Q50 76 83 62" fill="none" stroke="#ffe9a8" stroke-width="2.4"/>
    <path d="M22 70 Q50 83 78 70" fill="none" stroke="#ffe9a8" stroke-width="1" opacity=".7"/>
    <ellipse cx="50" cy="48" rx="37" ry="10" fill="#8c1f1f"/>
    <ellipse cx="50" cy="47" rx="35" ry="8.6" fill="url(#${p}r)"/>
    <g fill="none" stroke-linecap="round">
      <path d="M22 47 q5-9 10 0 t10 0 t10 0 t10 0 t10 0" stroke="#e8b43a" stroke-width="4.2"/>
      <path d="M26 50 q5-8 10 0 t10 0 t10 0 t10 0" stroke="#ffe08a" stroke-width="3.6"/>
      <path d="M30 44 q5-8 10 0 t10 0 t10 0" stroke="#fff0b8" stroke-width="3"/>
      <path d="M24 46 q5-6 10 0 t10 0" stroke="#fff" stroke-width="1" opacity=".6"/></g>
    <g><ellipse cx="66" cy="44" rx="9" ry="6.5" fill="#fffdf6" stroke="#e8e0cf" stroke-width="1"/><ellipse cx="66" cy="44.5" rx="4.6" ry="3.4" fill="#ffb22e"/><ellipse cx="65" cy="43.4" rx="1.6" ry="1" fill="#fff3b0"/></g>
    <rect x="30" y="38" width="12" height="9" rx="1.5" fill="#1e3d2b" transform="rotate(-12 36 42)"/>
    <g fill="#7bd66b" stroke="#4fa844" stroke-width=".8"><circle cx="44" cy="43" r="2.4"/><circle cx="52" cy="40" r="2.2"/><circle cx="58" cy="50" r="2.2"/><circle cx="38" cy="52" r="2"/></g>
    <circle cx="48" cy="52" r="4.6" fill="#ff9aa8" stroke="#e8667a" stroke-width=".8"/><path d="M45 52 q3-3 6 0 q-3 3-6 0" fill="none" stroke="#fff" stroke-width=".9"/>
    <path d="M60 44 L90 4" stroke="url(#${p}c)" stroke-width="3" stroke-linecap="round"/><path d="M67 46 L96 10" stroke="url(#${p}c)" stroke-width="3" stroke-linecap="round"/>
    <g class="steam" fill="none" stroke="#fff" stroke-linecap="round" opacity=".7"><path d="M34 30 q-5-7 0-14 q5-7 0-14" stroke-width="3"/><path d="M50 28 q-5-7 0-14 q5-7 0-14" stroke-width="3"/><path d="M42 30 q-4-6 0-12" stroke-width="2.4"/></g></svg>`;
}

function pupusaSVG() {
  const p = uid();
  return `<svg viewBox="0 0 100 100"><defs>${plateDefs(p)}
    <radialGradient id="${p}t" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#ffe2a2"/><stop offset=".7" stop-color="#eeb55c"/><stop offset="1" stop-color="#d6933a"/></radialGradient>
    <linearGradient id="${p}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d79a43"/><stop offset="1" stop-color="#9a6422"/></linearGradient>
    <linearGradient id="${p}ch" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff07a"/><stop offset="1" stop-color="#f6c52a"/></linearGradient></defs>
    ${plateArt(p)}
    <path d="M12 60 V68 C12 78 30 84 50 84 C70 84 88 78 88 68 V60Z" fill="url(#${p}s)"/>
    <ellipse cx="50" cy="60" rx="38" ry="17" fill="url(#${p}t)" stroke="#b97a2c" stroke-width="1.2"/>
    <g fill="#b9732a" opacity=".85"><ellipse cx="32" cy="57" rx="3.4" ry="2"/><ellipse cx="50" cy="52" rx="3" ry="1.8"/><ellipse cx="66" cy="59" rx="3.6" ry="2.2"/><ellipse cx="44" cy="67" rx="3" ry="1.8"/><ellipse cx="72" cy="52" rx="2.2" ry="1.4"/><ellipse cx="25" cy="64" rx="2.2" ry="1.3"/><ellipse cx="58" cy="68" rx="2.4" ry="1.4"/></g>
    <path d="M64 70 C72 70 80 70 84 74 C90 78 86 84 80 82 C78 88 70 86 70 80 C64 80 58 76 64 70Z" fill="url(#${p}ch)" stroke="#e0a81c" stroke-width=".8"/>
    <ellipse cx="42" cy="53" rx="14" ry="4" fill="#fff" opacity=".28"/>
    <g><ellipse cx="17" cy="46" rx="13" ry="5" fill="#e8e0f0"/><path d="M5 44 C5 56 12 60 17 60 C22 60 29 56 29 44Z" fill="#fff" stroke="#d9cfe0" stroke-width="1"/>
      <g stroke-linecap="round" fill="none"><path d="M8 43 q4-9 8-3 t8-4" stroke="#8ed77a" stroke-width="2.4"/><path d="M10 45 q5-6 9-1 t8-3" stroke="#ff9fb0" stroke-width="2"/><path d="M7 41 q6-7 10-2" stroke="#b6e8a0" stroke-width="2"/></g></g>
    <g class="steam" fill="none" stroke="#fff" stroke-linecap="round" opacity=".6"><path d="M44 40 q-5-6 0-12 q5-6 0-12" stroke-width="2.6"/><path d="M58 42 q-4-6 0-10" stroke-width="2.2"/></g></svg>`;
}

function popsicleSVG() {
  const p = uid();
  return `<svg viewBox="0 0 100 100"><defs>${plateDefs(p)}
    <linearGradient id="${p}a" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff5a98"/><stop offset=".5" stop-color="#ff86b3"/><stop offset="1" stop-color="#e83e86"/></linearGradient>
    <linearGradient id="${p}o" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff8a2a"/><stop offset=".5" stop-color="#ffb04a"/><stop offset="1" stop-color="#f06f12"/></linearGradient>
    <linearGradient id="${p}w" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#d9a35e"/><stop offset=".5" stop-color="#f0cc92"/><stop offset="1" stop-color="#c58d46"/></linearGradient></defs>
    ${plateArt(p)}
    <rect x="43.5" y="62" width="13" height="30" rx="6" fill="url(#${p}w)" stroke="#b07a38" stroke-width=".8"/><path d="M47 70 v18 M53 68 v20" stroke="#b07a38" stroke-width=".6" opacity=".6"/>
    <path d="M26 30 C26 4 74 4 74 30 V48 H26Z" fill="url(#${p}a)"/>
    <path d="M26 46 H74 V52 C74 66 26 66 26 52Z" fill="url(#${p}o)"/>
    <path d="M26 46 Q32 56 38 46 Q44 58 50 46 Q56 56 62 46 Q68 58 74 46 V44 H26Z" fill="url(#${p}a)"/>
    <path d="M60 56 q2 6 0 9 q-3-3 0-9" fill="url(#${p}o)"/>
    <rect x="32" y="12" width="7" height="30" rx="3.5" fill="#fff" opacity=".5"/><circle cx="35.5" cy="8.5" r="2" fill="#fff" opacity=".7"/>
    <ellipse cx="50" cy="90" rx="9" ry="2.4" fill="#ff86b3" opacity=".55"/></svg>`;
}

function breadSVG() {
  const p = uid();
  return `<svg viewBox="0 0 100 100"><defs>${plateDefs(p)}
    <linearGradient id="${p}cr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e0a050"/><stop offset="1" stop-color="#a86a28"/></linearGradient>
    <radialGradient id="${p}cm" cx=".5" cy=".4" r=".7"><stop offset="0" stop-color="#fff0c4"/><stop offset="1" stop-color="#f1cd84"/></radialGradient>
    <linearGradient id="${p}bu" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff7a8"/><stop offset="1" stop-color="#f9d94a"/></linearGradient>
    <linearGradient id="${p}kn" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#cfd6e0"/><stop offset=".5" stop-color="#fff"/><stop offset="1" stop-color="#b6bfcc"/></linearGradient></defs>
    ${plateArt(p)}
    <path d="M22 76 V42 C14 26 24 12 40 14 C45 15 48 17 50 18 C52 17 56 15 61 14 C77 12 87 26 79 42 V76 C79 82 75 84 70 84 H31 C26 84 22 82 22 76Z" fill="url(#${p}cr)" stroke="#8c5420" stroke-width="1.2"/>
    <path d="M27 74 V43 C21 31 28 20 40 21 C45 22 48 24 50 25 C53 24 56 22 61 21 C73 20 80 31 74 43 V74 C74 78 72 79 68 79 H33 C29 79 27 78 27 74Z" fill="url(#${p}cm)"/>
    <g fill="#d9aa5a" opacity=".6"><circle cx="36" cy="38" r="1.2"/><circle cx="60" cy="34" r="1"/><circle cx="46" cy="52" r="1.3"/><circle cx="64" cy="58" r="1.1"/><circle cx="38" cy="64" r="1"/><circle cx="52" cy="70" r="1.2"/></g>
    <g transform="rotate(-7 50 50)"><rect x="35" y="38" width="30" height="20" rx="4" fill="url(#${p}bu)" stroke="#e0b81c" stroke-width="1"/><rect x="37" y="40" width="26" height="5" rx="2.5" fill="#fffbd0" opacity=".85"/><path d="M45 58 q1 6-1 8 q-3-4 1-8" fill="#f9d94a"/></g>
    <g transform="rotate(20 84 78)"><rect x="80" y="64" width="5" height="24" rx="2.5" fill="url(#${p}kn)" stroke="#9aa4b4" stroke-width=".6"/></g></svg>`;
}

export const FOODS = [
  { id: 'noodles', name: 'noodles', a: 'a bowl of noodles', svg: noodlesSVG },
  { id: 'pupusas', name: 'pupusas', a: 'a pupusa', svg: pupusaSVG },
  { id: 'popsicle', name: 'a popsicle', a: 'a popsicle', svg: popsicleSVG },
  { id: 'bread', name: 'bread with butter', a: 'bread with butter', svg: breadSVG },
];

// ---------- the princess ----------
export function princessSVG() {
  const p = uid();
  return `<svg viewBox="0 0 240 420"><defs>
    <linearGradient id="${p}hr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7a4a35"/><stop offset=".5" stop-color="#52301f"/><stop offset="1" stop-color="#34190f"/></linearGradient>
    <linearGradient id="${p}dr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffa3d2"/><stop offset=".55" stop-color="#ff67ad"/><stop offset="1" stop-color="#e83f8e"/></linearGradient>
    <linearGradient id="${p}pn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe4f1"/><stop offset="1" stop-color="#ffb4d8"/></linearGradient>
    <linearGradient id="${p}go" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff2a8"/><stop offset=".5" stop-color="#ffcf3c"/><stop offset="1" stop-color="#d79a10"/></linearGradient>
    <radialGradient id="${p}sk" cx=".45" cy=".4" r=".75"><stop offset="0" stop-color="#ffe6d0"/><stop offset=".8" stop-color="#f6c6a4"/><stop offset="1" stop-color="#e9ae8a"/></radialGradient>
    <radialGradient id="${p}ir" cx=".5" cy=".35" r=".7"><stop offset="0" stop-color="#b57544"/><stop offset=".6" stop-color="#6b3a1c"/><stop offset="1" stop-color="#3a1c0a"/></radialGradient>
    <radialGradient id="${p}bl" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ff7fa0" stop-opacity=".75"/><stop offset="1" stop-color="#ff7fa0" stop-opacity="0"/></radialGradient>
    <radialGradient id="${p}gm" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="#ff5fa4"/><stop offset="1" stop-color="#b3185f"/></radialGradient>
    <radialGradient id="${p}gb" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="#6cc8ff"/><stop offset="1" stop-color="#1f6fc0"/></radialGradient></defs>
    <ellipse cx="120" cy="410" rx="108" ry="9" fill="#000" opacity=".16"/>
    <path d="M120 38 C60 38 40 92 48 150 C52 190 36 214 48 248 C68 268 98 256 104 236 L136 236 C142 256 172 268 192 248 C204 214 188 190 192 150 C200 92 180 38 120 38Z" fill="url(#${p}hr)"/>
    <path d="M60 170 C54 200 60 226 72 246 M180 170 C186 200 180 226 168 246" stroke="#8a5a43" stroke-width="3" fill="none" opacity=".5" stroke-linecap="round"/>
    <!-- gown -->
    <path d="M82 208 C62 268 30 340 14 396 Q120 432 226 396 C210 340 178 268 158 208Z" fill="url(#${p}dr)" stroke="#d63a86" stroke-width="2"/>
    <path d="M108 212 L132 212 C140 288 160 350 180 408 Q120 424 60 408 C80 350 100 288 108 212Z" fill="url(#${p}pn)" opacity=".92"/>
    <g fill="none" stroke="#d63a86" stroke-width="2" opacity=".5" stroke-linecap="round"><path d="M96 216 C80 290 56 350 36 402"/><path d="M84 216 C64 280 40 330 24 380"/><path d="M144 216 C160 290 184 350 204 402"/><path d="M156 216 C176 280 200 330 216 380"/></g>
    <g fill="none" stroke="#fff" stroke-width="2" opacity=".5" stroke-linecap="round"><path d="M112 224 C108 290 96 350 88 400"/><path d="M128 224 C132 290 144 350 152 400"/></g>
    <path d="M14 396 q13 20 26 0 q13 20 26 0 q13 20 26 0 q13 20 26 0 q13 20 26 0 q13 20 26 0 q13 20 26 0 q13 20 26 0 q13 20 26 0 Z" fill="#fff5fa" stroke="#ffb4d8" stroke-width="2"/>
    <g fill="#fff" opacity=".9"><circle cx="50" cy="360" r="2.4"/><circle cx="74" cy="320" r="2"/><circle cx="190" cy="350" r="2.4"/><circle cx="166" cy="310" r="2"/><circle cx="120" cy="390" r="2.6"/><circle cx="96" cy="280" r="1.8"/><circle cx="148" cy="272" r="2"/><circle cx="66" cy="384" r="1.8"/><circle cx="176" cy="388" r="1.8"/></g>
    <!-- bodice -->
    <path d="M86 150 C80 178 82 200 84 214 L156 214 C158 200 160 178 154 150Z" fill="url(#${p}dr)" stroke="#d63a86" stroke-width="2"/>
    <path d="M88 156 Q120 188 152 156 L154 150 Q120 172 86 150Z" fill="#fff5fa"/>
    <path d="M84 204 L156 204 L158 222 L82 222Z" fill="url(#${p}go)" stroke="#c98a0c" stroke-width="1.5"/>
    <circle cx="120" cy="213" r="8.5" fill="url(#${p}gb)" stroke="#c98a0c" stroke-width="1.5"/>
    <!-- neck + necklace -->
    <path d="M107 126 h26 v28 q-13 10-26 0z" fill="#efb996"/>
    <path d="M98 150 Q120 176 142 150" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-dasharray="0 8"/>
    <!-- arms and puffed sleeves -->
    <path d="M80 170 C66 198 74 228 102 242" fill="none" stroke="url(#${p}sk)" stroke-width="15" stroke-linecap="round"/>
    <path d="M160 170 C174 198 166 228 138 242" fill="none" stroke="url(#${p}sk)" stroke-width="15" stroke-linecap="round"/>
    <circle cx="106" cy="244" r="9" fill="url(#${p}sk)"/><circle cx="134" cy="244" r="9" fill="url(#${p}sk)"/>
    <circle cx="80" cy="158" r="19" fill="url(#${p}dr)" stroke="#d63a86" stroke-width="2"/><circle cx="160" cy="158" r="19" fill="url(#${p}dr)" stroke="#d63a86" stroke-width="2"/>
    <path d="M64 168 q16 10 32 0" fill="none" stroke="#fff5fa" stroke-width="5" stroke-linecap="round"/><path d="M144 168 q16 10 32 0" fill="none" stroke="#fff5fa" stroke-width="5" stroke-linecap="round"/>
    <path d="M70 150 q6-10 16-8" fill="none" stroke="#fff" stroke-width="3" opacity=".6" stroke-linecap="round"/><path d="M150 150 q6-10 16-8" fill="none" stroke="#fff" stroke-width="3" opacity=".6" stroke-linecap="round"/>
    <!-- head -->
    <ellipse cx="76" cy="100" rx="7" ry="10" fill="#f0bd9a"/><ellipse cx="164" cy="100" rx="7" ry="10" fill="#f0bd9a"/>
    <circle cx="76" cy="104" r="2.4" fill="#ffd84a"/><circle cx="164" cy="104" r="2.4" fill="#ffd84a"/>
    <ellipse cx="120" cy="92" rx="45" ry="49" fill="url(#${p}sk)"/>
    <path d="M70 92 C64 60 90 40 120 40 C150 40 176 60 170 92 C164 76 150 66 128 60 C114 72 92 76 70 92Z" fill="url(#${p}hr)"/>
    <path d="M72 96 C62 124 64 152 76 174 C86 152 82 122 86 102Z" fill="url(#${p}hr)"/><path d="M168 96 C178 124 176 152 164 174 C154 152 158 122 154 102Z" fill="url(#${p}hr)"/>
    <path d="M86 70 C100 56 116 54 128 60" fill="none" stroke="#a06a4e" stroke-width="3" opacity=".7" stroke-linecap="round"/><path d="M78 100 C70 122 72 146 80 164" fill="none" stroke="#a06a4e" stroke-width="2.5" opacity=".6" stroke-linecap="round"/><path d="M162 100 C170 122 168 146 160 164" fill="none" stroke="#a06a4e" stroke-width="2.5" opacity=".6" stroke-linecap="round"/>
    <!-- face -->
    <path d="M88 88 Q100 80 112 86" fill="none" stroke="#4a2a1a" stroke-width="3.2" stroke-linecap="round"/><path d="M128 86 Q140 80 152 88" fill="none" stroke="#4a2a1a" stroke-width="3.2" stroke-linecap="round"/>
    <g><ellipse cx="101" cy="102" rx="10" ry="12" fill="#fff"/><ellipse cx="101" cy="103" rx="7.6" ry="9.6" fill="url(#${p}ir)"/><ellipse cx="101" cy="104" rx="3.8" ry="5" fill="#1a0a04"/><circle cx="98" cy="98.5" r="3.2" fill="#fff"/><circle cx="104.5" cy="108" r="1.6" fill="#fff" opacity=".9"/>
      <path d="M90 100 Q101 88 112 100" fill="none" stroke="#2a140a" stroke-width="3.4" stroke-linecap="round"/><path d="M90 100 l-5-3 M92 95 l-4-5" stroke="#2a140a" stroke-width="2" stroke-linecap="round"/></g>
    <g><ellipse cx="139" cy="102" rx="10" ry="12" fill="#fff"/><ellipse cx="139" cy="103" rx="7.6" ry="9.6" fill="url(#${p}ir)"/><ellipse cx="139" cy="104" rx="3.8" ry="5" fill="#1a0a04"/><circle cx="136" cy="98.5" r="3.2" fill="#fff"/><circle cx="142.5" cy="108" r="1.6" fill="#fff" opacity=".9"/>
      <path d="M128 100 Q139 88 150 100" fill="none" stroke="#2a140a" stroke-width="3.4" stroke-linecap="round"/><path d="M150 100 l5-3 M148 95 l4-5" stroke="#2a140a" stroke-width="2" stroke-linecap="round"/></g>
    <path d="M117 116 q3 4 6 0" fill="none" stroke="#d99a7a" stroke-width="2.2" stroke-linecap="round"/>
    <ellipse cx="88" cy="122" rx="12" ry="8" fill="url(#${p}bl)"/><ellipse cx="152" cy="122" rx="12" ry="8" fill="url(#${p}bl)"/>
    <path d="M104 130 Q120 150 136 130 Q120 137 104 130Z" fill="#a8183c" stroke="#7a0f2a" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M108 132 Q120 137 132 132 Q120 136 108 132Z" fill="#fff"/><path d="M111 138 Q120 146 129 138 Q120 142 111 138Z" fill="#ff7f97"/>
    <!-- tiara -->
    <path d="M82 62 L88 34 L102 50 L120 20 L138 50 L152 34 L158 62 Q120 72 82 62Z" fill="url(#${p}go)" stroke="#c98a0c" stroke-width="2" stroke-linejoin="round"/>
    <path d="M90 56 Q120 66 150 56" fill="none" stroke="#fff" stroke-width="2" opacity=".6"/>
    <circle cx="120" cy="40" r="7.5" fill="url(#${p}gm)" stroke="#c98a0c" stroke-width="1.4"/><circle cx="98" cy="52" r="4.4" fill="url(#${p}gb)" stroke="#c98a0c" stroke-width="1"/><circle cx="142" cy="52" r="4.4" fill="url(#${p}gb)" stroke="#c98a0c" stroke-width="1"/>
    <g fill="#fff" stroke="#e6dcec" stroke-width=".8"><circle cx="120" cy="18" r="4.4"/><circle cx="88" cy="32" r="3.6"/><circle cx="152" cy="32" r="3.6"/></g>
  </svg>`;
}

// ---------- staff (butler, maid, cook, footman) ----------
// kind: butler | maid | cook | footman. Each carries a silver tray at about 56% of its height.
const trayItems = {
  butler: '',
  maid: `<g><path d="M30 134 h14 l-2 10 h-10z" fill="#ff8fc2"/><ellipse cx="37" cy="134" rx="8" ry="5" fill="#fff"/><circle cx="37" cy="128" r="3" fill="#e0443e"/>
    <path d="M52 134 h14 l-2 10 h-10z" fill="#8fd3ff"/><ellipse cx="59" cy="134" rx="8" ry="5" fill="#fff"/><circle cx="59" cy="128" r="3" fill="#e0443e"/>
    <path d="M74 134 h14 l-2 10 h-10z" fill="#ffd45a"/><ellipse cx="81" cy="134" rx="8" ry="5" fill="#fff"/><circle cx="81" cy="128" r="3" fill="#e0443e"/></g>`,
  cook: `<g><ellipse cx="60" cy="138" rx="24" ry="7" fill="#d9a35e"/><path d="M36 138 C36 118 84 118 84 138Z" fill="#f0c372"/><path d="M44 130 q16-8 32 0" stroke="#fff3c8" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="50" cy="128" r="2" fill="#e0443e"/><circle cx="68" cy="126" r="2" fill="#e0443e"/></g>`,
  footman: `<g><path d="M34 144 q-2-18 6-18 q8 0 6 18z" fill="#fff" opacity=".85" stroke="#cfd6e0"/><path d="M58 144 q-2-18 6-18 q8 0 6 18z" fill="#fff" opacity=".85" stroke="#cfd6e0"/>
    <path d="M78 144 h16 l-2-16 h-12z" fill="#ffd45a" stroke="#c98a0c"/><path d="M82 128 q-4-8 6-8" stroke="#c98a0c" stroke-width="2" fill="none"/></g>`,
};

export function staffSVG(kind, withTrayItems = true) {
  const p = uid();
  const C = {
    butler: { body: '#2b2b3a', body2: '#14141e', hair: '#c9ccd4', hat: '', skin: '#f2c9a5' },
    maid: { body: '#7fb8ff', body2: '#4a86d8', hair: '#6b3f26', skin: '#f6d0b0' },
    cook: { body: '#ffffff', body2: '#d9d4e0', hair: '#4a2d1c', skin: '#f0c19c' },
    footman: { body: '#e0443e', body2: '#a82a26', hair: '#ffffff', skin: '#f4cfae' },
  }[kind];
  const defs = `<defs><linearGradient id="${p}b" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${C.body2}"/><stop offset=".4" stop-color="${C.body}"/><stop offset="1" stop-color="${C.body2}"/></linearGradient>
    <radialGradient id="${p}s" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#fff0e0"/><stop offset="1" stop-color="${C.skin}"/></radialGradient>
    <linearGradient id="${p}v" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6f8fc"/><stop offset=".5" stop-color="#c3cad6"/><stop offset="1" stop-color="#8d96a6"/></linearGradient>
    <linearGradient id="${p}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff2a8"/><stop offset="1" stop-color="#d79a10"/></linearGradient></defs>`;

  let lower = '', upper = '', hat = '', face = '';
  const eyes = `<circle cx="51" cy="52" r="2.6" fill="#2a1a10"/><circle cx="69" cy="52" r="2.6" fill="#2a1a10"/><circle cx="51.8" cy="51" r=".9" fill="#fff"/><circle cx="69.8" cy="51" r=".9" fill="#fff"/>
    <ellipse cx="45" cy="60" rx="4.5" ry="3" fill="#ff8fa0" opacity=".5"/><ellipse cx="75" cy="60" rx="4.5" ry="3" fill="#ff8fa0" opacity=".5"/><path d="M53 61 Q60 68 67 61" fill="none" stroke="#9a3a3a" stroke-width="2" stroke-linecap="round"/>`;

  if (kind === 'butler') {
    lower = `<path d="M40 150 L36 244 H56 L60 170 L64 244 H84 L80 150Z" fill="#14141e"/><ellipse cx="46" cy="248" rx="13" ry="5" fill="#000"/><ellipse cx="74" cy="248" rx="13" ry="5" fill="#000"/>`;
    upper = `<path d="M30 80 C26 110 28 150 24 196 L52 186 L60 200 L68 186 L96 196 C92 150 94 110 90 80 Q60 70 30 80Z" fill="url(#${p}b)" stroke="#0a0a12" stroke-width="1.5"/>
      <path d="M48 78 L60 130 L72 78 Q60 74 48 78Z" fill="#fff"/><path d="M46 80 L60 124 L50 96Z M74 80 L60 124 L70 96Z" fill="#14141e"/>
      <path d="M50 82 L70 82 L66 90 L54 90Z" fill="#c0262a"/><circle cx="60" cy="86" r="3" fill="#a01a1e"/>
      <path d="M60 130 v50" stroke="#555" stroke-width="1"/><circle cx="56" cy="140" r="1.6" fill="url(#${p}g)"/><circle cx="56" cy="154" r="1.6" fill="url(#${p}g)"/>`;
    face = `<path d="M44 62 Q60 50 76 62" fill="none"/>`;
    hat = `<path d="M38 50 C36 28 50 24 60 26 C70 24 84 28 82 50 C80 40 74 34 60 34 C46 34 40 40 38 50Z" fill="${C.hair}"/><path d="M45 66 Q60 64 75 66 L72 70 Q60 66 48 70Z" fill="#9aa0ac"/>`;
  } else if (kind === 'maid') {
    lower = `<path d="M38 140 C28 190 22 220 20 238 Q60 252 100 238 C98 220 92 190 82 140Z" fill="url(#${p}b)" stroke="#3a6ab8" stroke-width="1.5"/><path d="M20 238 q10 8 20 0 q10 8 20 0 q10 8 20 0 q10 8 20 0" fill="#fff" stroke="#e4e0ec"/>
      <ellipse cx="46" cy="246" rx="9" ry="4" fill="#5a3320"/><ellipse cx="74" cy="246" rx="9" ry="4" fill="#5a3320"/>`;
    upper = `<path d="M34 80 C30 108 34 132 38 148 L82 148 C86 132 90 108 86 80 Q60 70 34 80Z" fill="url(#${p}b)" stroke="#3a6ab8" stroke-width="1.5"/>
      <path d="M42 100 Q60 108 78 100 L80 150 Q60 158 40 150Z" fill="#fff" stroke="#e4e0ec"/><path d="M46 100 L50 88 M74 100 L70 88" stroke="#fff" stroke-width="5" stroke-linecap="round"/>
      <circle cx="60" cy="114" r="2" fill="#ff8fc2"/>`;
    hat = `<circle cx="60" cy="26" r="11" fill="${C.hair}"/><path d="M38 52 C34 28 52 24 60 28 C68 24 86 28 82 52 C78 40 70 36 60 36 C50 36 42 40 38 52Z" fill="${C.hair}"/>
      <path d="M42 36 Q60 24 78 36 Q78 42 60 38 Q42 42 42 36Z" fill="#fff" stroke="#e4e0ec"/><path d="M44 36 q4 6 8 0 q4 6 8 0 q4 6 8 0 q4 6 8 0" fill="none" stroke="#e4e0ec"/>`;
  } else if (kind === 'cook') {
    lower = `<path d="M40 150 L38 238 H58 L60 170 L62 238 H82 L80 150Z" fill="#4a5568"/><ellipse cx="48" cy="246" rx="12" ry="5" fill="#2b2b3a"/><ellipse cx="72" cy="246" rx="12" ry="5" fill="#2b2b3a"/>`;
    upper = `<path d="M30 80 C24 110 30 150 32 176 L88 176 C90 150 96 110 90 80 Q60 70 30 80Z" fill="url(#${p}b)" stroke="#bdb6c9" stroke-width="1.5"/>
      <path d="M60 78 V176" stroke="#bdb6c9" stroke-width="1.5"/><g fill="#c98a0c"><circle cx="54" cy="100" r="2.2"/><circle cx="54" cy="122" r="2.2"/><circle cx="54" cy="144" r="2.2"/><circle cx="66" cy="100" r="2.2"/><circle cx="66" cy="122" r="2.2"/><circle cx="66" cy="144" r="2.2"/></g>
      <path d="M46 80 L60 96 L74 80 L72 76 L60 84 L48 76Z" fill="#c0262a"/>`;
    hat = `<path d="M40 46 C28 30 36 8 52 14 C56 0 70 0 72 12 C88 8 96 30 80 46Z" fill="#fff" stroke="#e0dbe8" stroke-width="1.5"/><path d="M42 40 H78 V48 H42Z" fill="#f4f0f8" stroke="#e0dbe8"/>
      <path d="M50 40 C46 26 52 20 56 20" stroke="#e8e2f0" fill="none" stroke-width="1.5"/><path d="M44 62 Q60 58 76 62 q-2 8-16 8 q-14 0-16-8Z" fill="${C.hair}"/>`;
    face = '';
  } else {
    lower = `<path d="M40 150 L38 238 H58 L60 170 L62 238 H82 L80 150Z" fill="#fff" stroke="#d6d0e0"/><path d="M38 200 H58 M62 200 H82" stroke="#c98a0c" stroke-width="2"/><ellipse cx="48" cy="246" rx="12" ry="5" fill="#2b2b3a"/><ellipse cx="72" cy="246" rx="12" ry="5" fill="#2b2b3a"/><circle cx="50" cy="246" r="2" fill="url(#${p}g)"/><circle cx="70" cy="246" r="2" fill="url(#${p}g)"/>`;
    upper = `<path d="M30 80 C24 108 28 150 24 186 L60 194 L96 186 C92 150 96 108 90 80 Q60 70 30 80Z" fill="url(#${p}b)" stroke="#7a1a18" stroke-width="1.5"/>
      <path d="M60 80 V192" stroke="#7a1a18"/><g fill="url(#${p}g)"><circle cx="54" cy="104" r="2.4"/><circle cx="54" cy="126" r="2.4"/><circle cx="54" cy="148" r="2.4"/><circle cx="66" cy="104" r="2.4"/><circle cx="66" cy="126" r="2.4"/><circle cx="66" cy="148" r="2.4"/></g>
      <path d="M32 84 Q38 80 44 86 M88 84 Q82 80 76 86" stroke="url(#${p}g)" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M50 80 L60 96 L70 80Z" fill="#fff"/>`;
    hat = `<path d="M36 56 C30 36 40 22 60 22 C80 22 90 36 84 56 C80 44 72 38 60 38 C48 38 40 44 36 56Z" fill="#fff" stroke="#d6d0e0"/><g fill="#fff" stroke="#d6d0e0"><circle cx="34" cy="58" r="5"/><circle cx="34" cy="68" r="4.5"/><circle cx="86" cy="58" r="5"/><circle cx="86" cy="68" r="4.5"/></g>
      <path d="M42 30 q8-10 20-6 q10-4 18 6" fill="none" stroke="#e8e2f0" stroke-width="2"/>`;
  }

  const items = withTrayItems ? trayItems[kind] : '';
  return `<svg viewBox="0 0 120 260">${defs}
    <ellipse cx="60" cy="252" rx="38" ry="6" fill="#000" opacity=".18"/>
    ${lower}${upper}
    <rect x="53" y="68" width="14" height="14" rx="5" fill="url(#${p}s)"/>
    <ellipse cx="60" cy="52" rx="22" ry="24" fill="url(#${p}s)"/>
    ${hat}${eyes}
    ${kind === 'butler' ? `<path d="M50 63 Q60 59 70 63 Q66 70 60 66 Q54 70 50 63Z" fill="${C.hair}"/>` : ''}
    <path d="M30 100 C16 120 22 140 42 148" fill="none" stroke="url(#${p}b)" stroke-width="13" stroke-linecap="round"/><path d="M90 100 C104 120 98 140 78 148" fill="none" stroke="url(#${p}b)" stroke-width="13" stroke-linecap="round"/>
    <ellipse cx="40" cy="148" rx="7" ry="6" fill="${kind === 'butler' || kind === 'footman' ? '#fff' : 'url(#' + p + 's)'}"/><ellipse cx="80" cy="148" rx="7" ry="6" fill="${kind === 'butler' || kind === 'footman' ? '#fff' : 'url(#' + p + 's)'}"/>
    <ellipse cx="60" cy="146" rx="50" ry="9" fill="url(#${p}v)" stroke="#8d96a6" stroke-width="1.2"/><ellipse cx="60" cy="144" rx="42" ry="6" fill="#fff" opacity=".45"/>
    ${items}
  </svg>`;
}

// ---------- the hall ----------
export function wallSVG() {
  const p = uid();
  const windows = [200, 600, 1000, 1400].map((cx) => `<g>
    <path d="M${cx - 95} 450 V230 C${cx - 95} 150 ${cx - 50} 112 ${cx} 112 C${cx + 50} 112 ${cx + 95} 150 ${cx + 95} 230 V450Z" fill="url(#${p}sky)" stroke="url(#${p}gold)" stroke-width="12"/>
    <path d="M${cx - 80} 440 L${cx - 60} 360 L${cx - 40} 440Z M${cx + 10} 440 V380 L${cx + 24} 360 L${cx + 38} 380 V440Z M${cx + 40} 440 V400 L${cx + 54} 380 L${cx + 68} 400 V440Z" fill="#c9a2e0" opacity=".8"/>
    <ellipse cx="${cx - 30}" cy="300" rx="34" ry="10" fill="#fff" opacity=".85"/><ellipse cx="${cx + 36}" cy="270" rx="26" ry="8" fill="#fff" opacity=".8"/>
    <path d="M${cx} 112 V450 M${cx - 95} 300 H${cx + 95}" stroke="url(#${p}gold)" stroke-width="7"/>
    <path d="M${cx - 95} 450 H${cx + 95}" stroke="url(#${p}gold)" stroke-width="16"/>
    <path d="M${cx - 150} 100 C${cx - 140} 200 ${cx - 150} 340 ${cx - 140} 470 H${cx - 82} C${cx - 92} 340 ${cx - 78} 200 ${cx - 88} 120Z" fill="url(#${p}cur)"/>
    <path d="M${cx + 150} 100 C${cx + 140} 200 ${cx + 150} 340 ${cx + 140} 470 H${cx + 82} C${cx + 92} 340 ${cx + 78} 200 ${cx + 88} 120Z" fill="url(#${p}cur)"/>
    <path d="M${cx - 124} 160 C${cx - 126} 240 ${cx - 118} 330 ${cx - 120} 440 M${cx + 124} 160 C${cx + 126} 240 ${cx + 118} 330 ${cx + 120} 440" stroke="#7a1428" stroke-width="3" opacity=".5" fill="none"/>
    <path d="M${cx - 150} 340 Q${cx - 112} 320 ${cx - 82} 340 M${cx + 82} 340 Q${cx + 112} 320 ${cx + 150} 340" stroke="url(#${p}gold)" stroke-width="9" fill="none" stroke-linecap="round"/>
    <path d="M${cx - 152} 96 H${cx + 152}" stroke="url(#${p}gold)" stroke-width="10" stroke-linecap="round"/></g>`).join('');
  const banners = [400, 800, 1200].map((x) => `<g>
    <path d="M${x - 44} 40 H${x + 44} V250 L${x} 290 L${x - 44} 250Z" fill="url(#${p}ban)" stroke="url(#${p}gold)" stroke-width="5"/>
    <path d="M${x - 24} 130 L${x - 18} 100 L${x - 8} 116 L${x} 90 L${x + 8} 116 L${x + 18} 100 L${x + 24} 130Z" fill="url(#${p}gold)"/><circle cx="${x}" cy="108" r="4" fill="#ff5fa4"/>
    <path d="M${x - 24} 150 H${x + 24}" stroke="url(#${p}gold)" stroke-width="4"/><path d="M${x - 14} 168 L${x} 190 L${x + 14} 168Z" fill="url(#${p}gold)"/>
    <rect x="${x - 56}" y="34" width="112" height="10" rx="5" fill="url(#${p}gold)"/></g>`).join('');
  const chandelier = (cx) => `<g>
    <path d="M${cx} 0 V90" stroke="#c98a0c" stroke-width="5"/>
    <path d="M${cx - 80} 128 Q${cx} 168 ${cx + 80} 128 L${cx + 70} 116 Q${cx} 150 ${cx - 70} 116Z" fill="url(#${p}gold)" stroke="#a87408" stroke-width="2"/>
    <ellipse cx="${cx}" cy="100" rx="22" ry="22" fill="url(#${p}gold)" stroke="#a87408" stroke-width="2"/>
    ${[-64, -32, 0, 32, 64].map((dx) => `<rect x="${cx + dx - 4}" y="${96 + Math.abs(dx) * 0.28}" width="8" height="22" rx="2" fill="#fff8e0"/><ellipse class="flame" cx="${cx + dx}" cy="${90 + Math.abs(dx) * 0.28}" rx="5" ry="9" fill="#ffc83a"/><ellipse cx="${cx + dx}" cy="${92 + Math.abs(dx) * 0.28}" rx="2.5" ry="5" fill="#fff4b0"/>`).join('')}
    ${[-56, -28, 0, 28, 56].map((dx, i) => `<path d="M${cx + dx} ${138 + Math.abs(dx) * 0.2} l-5 12 l5 14 l5 -14z" fill="#d8f1ff" stroke="#9fd0f0" stroke-width="1" opacity=".9"/>`).join('')}
    <ellipse cx="${cx}" cy="116" rx="130" ry="60" fill="#ffe08a" opacity=".12"/></g>`;
  return `<svg viewBox="0 0 1600 640" preserveAspectRatio="xMidYMax slice" aria-hidden="true"><defs>
    <linearGradient id="${p}wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbeedd"/><stop offset="1" stop-color="#e9cfb0"/></linearGradient>
    <pattern id="${p}brick" width="120" height="60" patternUnits="userSpaceOnUse"><path d="M0 .5 H120 M0 30.5 H120 M0 0 V30 M60 30 V60" stroke="#c9a77f" stroke-width="2" opacity=".35" fill="none"/></pattern>
    <linearGradient id="${p}gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff2a8"/><stop offset=".5" stop-color="#e8b422"/><stop offset="1" stop-color="#a87408"/></linearGradient>
    <linearGradient id="${p}sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fd0ff"/><stop offset=".7" stop-color="#d8f0ff"/><stop offset="1" stop-color="#ffe3f0"/></linearGradient>
    <linearGradient id="${p}cur" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8e1230"/><stop offset=".5" stop-color="#d9304f"/><stop offset="1" stop-color="#8e1230"/></linearGradient>
    <linearGradient id="${p}ban" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7a35b8"/><stop offset=".5" stop-color="#a65be0"/><stop offset="1" stop-color="#7a35b8"/></linearGradient>
    <linearGradient id="${p}pan" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8a0c8"/><stop offset="1" stop-color="#b8609a"/></linearGradient></defs>
    <rect width="1600" height="640" fill="url(#${p}wall)"/><rect width="1600" height="640" fill="url(#${p}brick)"/>
    <path d="M0 0 H1600 V36 Q1500 56 1400 36 Q1300 56 1200 36 Q1100 56 1000 36 Q900 56 800 36 Q700 56 600 36 Q500 56 400 36 Q300 56 200 36 Q100 56 0 36Z" fill="url(#${p}gold)" opacity=".9"/>
    ${windows}${banners}${chandelier(600)}${chandelier(1000)}
    <rect x="0" y="470" width="1600" height="170" fill="url(#${p}pan)"/>
    ${Array.from({ length: 14 }, (_, i) => `<rect x="${i * 120 + 14}" y="494" width="92" height="124" rx="10" fill="none" stroke="#ffe3f1" stroke-width="3" opacity=".7"/>`).join('')}
    <rect x="0" y="462" width="1600" height="14" fill="url(#${p}gold)"/><rect x="0" y="626" width="1600" height="14" fill="url(#${p}gold)"/>
  </svg>`;
}

// Marble floor in perspective with a red carpet down the middle.
export function floorSVG() {
  const p = uid();
  const W = 1600, H = 270, V = { x: 800, y: -380 };
  const xAt = (bx, y) => V.x + (bx - V.x) * ((y - V.y) / (H - V.y));
  const rows = 9, ys = Array.from({ length: rows + 1 }, (_, i) => H * Math.pow(i / rows, 1.7));
  const cols = Array.from({ length: 31 }, (_, i) => V.x + (i - 15) * 150);
  let tiles = '';
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols.length - 1; c++) {
    const y0 = ys[r], y1 = ys[r + 1];
    tiles += `<path d="M${xAt(cols[c], y0)} ${y0} L${xAt(cols[c + 1], y0)} ${y0} L${xAt(cols[c + 1], y1)} ${y1} L${xAt(cols[c], y1)} ${y1}Z" fill="${(r + c) % 2 ? '#fff4f8' : '#f3c4dc'}"/>`;
  }
  const carpet = (a, b, fill, extra = '') => `<path d="M${xAt(V.x + a, 0)} 0 L${xAt(V.x + b, 0)} 0 L${V.x + b} ${H} L${V.x + a} ${H}Z" fill="${fill}" ${extra}/>`;
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" aria-hidden="true"><defs>
    <linearGradient id="${p}c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b8203c"/><stop offset="1" stop-color="#e8405e"/></linearGradient>
    <linearGradient id="${p}sh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a4a6b" stop-opacity=".45"/><stop offset=".25" stop-color="#7a4a6b" stop-opacity="0"/></linearGradient></defs>
    ${tiles}${carpet(-330, 330, '#e8b422')}${carpet(-300, 300, 'url(#' + p + 'c)')}${carpet(-250, 250, 'none', 'stroke="#ffd45a" stroke-width="4" stroke-dasharray="14 10"')}
    <rect width="${W}" height="${H}" fill="url(#${p}sh)"/></svg>`;
}

export function tableSVG() {
  const p = uid();
  const candle = (x) => `<g><rect x="${x - 3}" y="18" width="6" height="26" fill="url(#${p}g)"/><path d="M${x - 14} 52 Q${x} 40 ${x + 14} 52Z" fill="url(#${p}g)"/><rect x="${x - 3}" y="2" width="6" height="20" rx="2" fill="#fff8e0"/><ellipse class="flame" cx="${x}" cy="-4" rx="4" ry="8" fill="#ffc83a"/><ellipse cx="${x}" cy="-2" rx="2" ry="4.4" fill="#fff4b0"/></g>`;
  return `<svg viewBox="0 0 420 200" style="overflow:visible"><defs>
    <linearGradient id="${p}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff2a8"/><stop offset=".5" stop-color="#e8b422"/><stop offset="1" stop-color="#a87408"/></linearGradient>
    <linearGradient id="${p}t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#ece4f4"/></linearGradient>
    <linearGradient id="${p}cl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e6dcf0"/><stop offset=".3" stop-color="#fff"/><stop offset=".7" stop-color="#fdfaff"/><stop offset="1" stop-color="#ded2ea"/></linearGradient>
    <linearGradient id="${p}r" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#a8203c"/><stop offset=".5" stop-color="#e0405c"/><stop offset="1" stop-color="#a8203c"/></linearGradient></defs>
    <ellipse cx="210" cy="196" rx="214" ry="10" fill="#000" opacity=".15"/>
    <path d="M14 58 L406 58 L420 80 L0 80Z" fill="url(#${p}t)" stroke="#d6cce0" stroke-width="2"/>
    <path d="M6 76 H414 V176 Q392 194 372 176 Q352 194 332 176 Q312 194 292 176 Q272 194 252 176 Q232 194 212 176 Q192 194 172 176 Q152 194 132 176 Q112 194 92 176 Q72 194 52 176 Q32 194 12 176 Q6 180 6 176Z" fill="url(#${p}cl)" stroke="#d6cce0" stroke-width="2"/>
    <path d="M6 80 H414" stroke="url(#${p}g)" stroke-width="7"/>
    <path d="M150 80 H270 L286 182 Q210 194 134 182Z" fill="url(#${p}r)" opacity=".9"/><path d="M150 80 L134 182 M270 80 L286 182" stroke="url(#${p}g)" stroke-width="3" fill="none"/>
    <g stroke="#d6cce0" stroke-width="2" fill="none" opacity=".8"><path d="M60 84 Q56 130 62 172"/><path d="M110 84 Q112 130 106 176"/><path d="M310 84 Q308 130 314 176"/><path d="M360 84 Q364 130 358 172"/></g>
    <g transform="translate(40 14)">${candle(0)}</g><g transform="translate(380 14)">${candle(0)}</g>
    <g><path d="M326 58 q-8-30 4-34 q12 4 4 34z" fill="#f4f0ff" stroke="#cfc4e4"/><circle cx="326" cy="18" r="7" fill="#ff7eb6"/><circle cx="336" cy="12" r="7" fill="#ffd45a"/><circle cx="318" cy="10" r="6" fill="#b06bdc"/><path d="M332 24 q10-4 12 4" stroke="#4fa844" stroke-width="3" fill="none"/></g>
    <g><path d="M92 58 l2-16 h8 l2 16z" fill="#f8fbff" stroke="#cfd6e8"/><path d="M95 52 h8 l-1 6 h-6z" fill="#e0405c" opacity=".8"/></g><g><path d="M110 58 l2-16 h8 l2 16z" fill="#f8fbff" stroke="#cfd6e8"/></g>
  </svg>`;
}
