/* Vehicle artwork: every vehicle is drawn as SVG in a 400 x 260 box.
   A cartoon toddler rides in the windows. */

const INK = '#2a2f55';
const ST = `stroke="${INK}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"`;
const ST3 = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;

// The public version uses a cartoon toddler instead of real photos: 4 looks, picked by p
const KIDS = [
  { hair: '#4a3426', mouth: 'open' },
  { hair: '#2f2622', mouth: 'grin' },
  { hair: '#6b4630', mouth: 'smile' },
  { hair: '#3a2a20', mouth: 'oh' },
];
const PHOTOS = KIDS;   // the home screen cycles through this list

let _uid = 0;
const uid = () => 'u' + (++_uid);

function mouth(kind) {
  const ink = `stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"`;
  if (kind === 'open') return `<path d="M-17 12 Q0 44 17 12 Z" fill="#8a2638" ${ink}/><path d="M-9 28 Q0 20 9 28 Q0 36 -9 28 Z" fill="#ff8fa0"/>`;
  if (kind === 'grin') return `<path d="M-19 12 Q0 40 19 12 Z" fill="#8a2638" ${ink}/><path d="M-15 13 L15 13 L13 20 Q0 24 -13 20 Z" fill="#fff"/>`;
  if (kind === 'oh') return `<ellipse cx="0" cy="22" rx="8" ry="10" fill="#8a2638" ${ink}/>`;
  return `<path d="M-16 14 Q0 34 16 14" fill="none" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>`;
}

// the cartoon face, centred at (fx,fy) with radius fr
function face(fx, fy, fr, p) {
  const k = KIDS[p % KIDS.length], id = uid();
  return `<g transform="translate(${fx} ${fy}) scale(${fr / 50})">
    <clipPath id="${id}"><circle r="50"/></clipPath>
    <circle r="50" fill="#ffd9b3"/>
    <g clip-path="url(#${id})">
      <path d="M-52 -4 Q-56 -56 0 -54 Q56 -56 52 -4 Q40 -30 16 -27 Q-4 -17 -22 -31 Q-42 -28 -52 -4 Z" fill="${k.hair}"/>
      <path d="M-8 -52 Q-2 -64 10 -54" stroke="${k.hair}" stroke-width="7" fill="none" stroke-linecap="round"/>
    </g>
    <ellipse cx="-18" cy="-2" rx="6.5" ry="8.5" fill="${INK}"/><ellipse cx="18" cy="-2" rx="6.5" ry="8.5" fill="${INK}"/>
    <circle cx="-15.5" cy="-5" r="2.6" fill="#fff"/><circle cx="20.5" cy="-5" r="2.6" fill="#fff"/>
    <circle cx="-31" cy="15" r="9" fill="#ff8f8f" opacity=".55"/><circle cx="31" cy="15" r="9" fill="#ff8f8f" opacity=".55"/>
    <path d="M-3 9 Q0 12 3 9" stroke="#d99a72" stroke-width="3" fill="none" stroke-linecap="round"/>
    ${mouth(k.mouth)}
  </g>`;
}

function wheel(cx, cy, r, hub = '#ffd23f') {
  return `<g transform="translate(${cx} ${cy})">
    <g class="spin">
      <circle r="${r}" fill="#343a5c" ${ST}/>
      <circle r="${r * 0.58}" fill="#e6e9f2" ${ST3}/>
      <circle r="${r * 0.22}" fill="${hub}" ${ST3}/>
      ${[0, 72, 144, 216, 288].map(a => `<circle cx="${(r * 0.4 * Math.cos(a * Math.PI / 180)).toFixed(1)}" cy="${(r * 0.4 * Math.sin(a * Math.PI / 180)).toFixed(1)}" r="${r * 0.06}" fill="${INK}"/>`).join('')}
    </g></g>`;
}

// translucent glass with a shine stripe, drawn over the face
function glass(d, shine) {
  return `<path d="${d}" fill="#bfe8ff" fill-opacity=".28"/>
    ${shine ? `<path d="${shine}" fill="#fff" fill-opacity=".55"/>` : ''}
    <path d="${d}" fill="none" ${ST}/>`;
}

const gloss = (d, o = .35) => `<path d="${d}" fill="#fff" fill-opacity="${o}"/>`;
const shade = (d, o = .18) => `<path d="${d}" fill="#000" fill-opacity="${o}"/>`;

/* ---------- the vehicles ---------- */

function dumpTruck(p) {
  return `
  <g class="bed" style="transform-origin:34px 182px">
    <path d="M26 92 L226 92 L216 184 L34 184 Z" fill="#ffc233" ${ST}/>
    ${gloss('M32 98 L220 98 L219 112 L33 112 Z', .4)}
    <path d="M26 92 L226 92 L224 108 L28 108 Z" fill="#f29b00" ${ST}/>
    ${[78, 124, 170].map(x => `<path d="M${x} 114 L${x - 2} 180" ${ST3} opacity=".5"/>`).join('')}
    ${shade('M34 184 L216 184 L218 170 L33 170 Z', .15)}
  </g>
  <rect x="26" y="178" width="352" height="24" rx="8" fill="#4a5078" ${ST}/>
  <rect x="226" y="66" width="104" height="116" rx="16" fill="#ffc233" ${ST}/>
  <path d="M318 122 L372 122 Q384 122 384 134 L384 182 L318 182 Z" fill="#ffc233" ${ST}/>
  ${gloss('M236 74 L322 74 L322 80 L236 80 Z', .5)}
  ${shade('M226 160 L384 160 L384 182 L226 182 Z', .14)}
  ${[0, 1, 2].map(i => `<path d="M352 ${138 + i * 10} L376 ${138 + i * 10}" ${ST3} opacity=".55"/>`).join('')}
  <rect x="330" y="48" width="12" height="70" rx="5" fill="#8d93ad" ${ST}/>
  <rect x="236" y="76" width="84" height="68" rx="16" fill="#cdeeff" ${ST}/>
  ${face(278, 112, 29, p)}
  ${glass('M236 92 Q236 76 252 76 L304 76 Q320 76 320 92 L320 128 Q320 144 304 144 L252 144 Q236 144 236 128 Z', 'M246 84 L268 84 L252 138 L246 138 Z')}
  <circle cx="378" cy="146" r="9" fill="#fff6a8" ${ST3}/>
  <rect x="374" y="168" width="18" height="14" rx="4" fill="#8d93ad" ${ST3}/>
  ${wheel(88, 212, 33)}${wheel(160, 212, 33)}${wheel(338, 212, 33)}`;
}

function fireTruck(p) {
  return `
  <rect x="14" y="104" width="262" height="82" rx="14" fill="#e8382f" ${ST}/>
  ${gloss('M20 110 L270 110 L270 122 L20 122 Z', .35)}
  <rect x="14" y="150" width="262" height="14" fill="#ffd23f" ${ST3}/>
  ${[0, 1, 2].map(i => `<rect x="${92 + i * 58}" y="124" width="48" height="52" rx="8" fill="#c22a22" ${ST3}/><path d="M${100 + i * 58} 134 L${132 + i * 58} 134 M${100 + i * 58} 146 L${132 + i * 58} 146" ${ST3} opacity=".5"/>`).join('')}
  <circle cx="52" cy="144" r="24" fill="#aab0c8" ${ST}/><circle cx="52" cy="144" r="12" fill="#eef0f8" ${ST3}/><circle cx="52" cy="144" r="4" fill="${INK}"/>
  <path d="M30 86 L262 86" ${ST} /><path d="M30 100 L262 100" ${ST}/>
  ${[44, 74, 104, 134, 164, 194, 224].map(x => `<path d="M${x} 86 L${x} 100" ${ST3}/>`).join('')}
  <path d="M26 100 L26 86 M266 100 L266 86" ${ST}/>
  <path d="M256 74 L256 86" ${ST}/>
  <rect x="258" y="80" width="116" height="106" rx="18" fill="#e8382f" ${ST}/>
  ${gloss('M268 88 L364 88 L364 94 L268 94 Z', .45)}
  ${shade('M258 164 L374 164 L374 186 L258 186 Z', .16)}
  <rect x="268" y="92" width="92" height="62" rx="16" fill="#cdeeff" ${ST}/>
  ${face(314, 124, 30, p)}
  ${glass('M268 108 Q268 92 284 92 L344 92 Q360 92 360 108 L360 138 Q360 154 344 154 L284 154 Q268 154 268 138 Z', 'M278 100 L300 100 L284 148 L278 148 Z')}
  <rect x="272" y="62" width="88" height="20" rx="8" fill="#e6e9f2" ${ST}/>
  <g class="flashA"><path d="M280 62 Q280 44 296 44 Q312 44 312 62 Z" fill="#ff4b4b" ${ST}/></g>
  <g class="flashB"><path d="M320 62 Q320 44 336 44 Q352 44 352 62 Z" fill="#4b9bff" ${ST}/></g>
  <circle cx="368" cy="160" r="8" fill="#fff6a8" ${ST3}/>
  <rect x="364" y="174" width="20" height="14" rx="4" fill="#cfd3e4" ${ST3}/>
  ${wheel(88, 214, 32, '#e6e9f2')}${wheel(324, 214, 32, '#e6e9f2')}`;
}

function schoolBus(p) {
  const wins = [26, 82, 138, 194].map((x, i) => `
    <rect x="${x}" y="82" width="50" height="46" rx="10" fill="#cdeeff" ${ST3}/>
    ${face(x + 25, 105, 20, p + i)}
    ${glass(`M${x} 94 Q${x} 82 ${x + 12} 82 L${x + 38} 82 Q${x + 50} 82 ${x + 50} 94 L${x + 50} 116 Q${x + 50} 128 ${x + 38} 128 L${x + 12} 128 Q${x} 128 ${x} 116 Z`, null)}`).join('');
  return `
  <path d="M12 196 L12 92 Q12 62 42 62 L292 62 Q308 62 312 80 L318 120 L368 126 Q386 128 386 146 L386 196 Z" fill="#ffc72c" ${ST}/>
  ${gloss('M22 70 Q24 68 42 68 L290 68 L290 76 L22 76 Z', .5)}
  ${shade('M12 172 L386 172 L386 196 L12 196 Z', .14)}
  ${wins}
  <rect x="250" y="82" width="52" height="86" rx="10" fill="#cdeeff" ${ST3}/>
  ${face(276, 112, 24, p + 2)}
  ${glass('M250 94 Q250 82 262 82 L290 82 Q302 82 302 94 L302 156 Q302 168 290 168 L262 168 Q250 168 250 156 Z', 'M258 90 L272 90 L260 150 L258 150 Z')}
  <path d="M12 142 L386 142" ${ST3}/><rect x="12" y="150" width="374" height="10" fill="#2a2f55" opacity=".85"/>
  <path d="M12 134 L248 134" stroke="#2a2f55" stroke-width="4"/>
  <circle cx="306" cy="66" r="7" fill="#ff5a4f" ${ST3}/><circle cx="22" cy="68" r="6" fill="#ff5a4f" ${ST3}/>
  <circle cx="378" cy="150" r="9" fill="#fff6a8" ${ST3}/>
  <rect x="372" y="178" width="22" height="14" rx="4" fill="#4a5078" ${ST3}/>
  <path d="M60 196 Q60 168 92 168 Q124 168 124 196 Z" fill="#2a2f55"/>
  <path d="M270 196 Q270 168 302 168 Q334 168 334 196 Z" fill="#2a2f55"/>
  ${wheel(92, 208, 32)}${wheel(302, 208, 32)}`;
}

function train(p) {
  return `
  <rect x="0" y="108" width="116" height="84" rx="14" fill="#4aa8ff" ${ST}/>
  ${gloss('M8 114 L108 114 L108 124 L8 124 Z', .4)}
  <rect x="14" y="124" width="40" height="44" rx="10" fill="#cdeeff" ${ST3}/>${face(34, 146, 17, p + 1)}
  <rect x="62" y="124" width="40" height="44" rx="10" fill="#cdeeff" ${ST3}/>${face(82, 146, 17, p + 2)}
  <rect x="0" y="176" width="116" height="10" fill="#2a2f55" opacity=".6"/>
  <path d="M116 168 L130 168" ${ST}/>
  <rect x="128" y="112" width="86" height="72" rx="10" fill="#ff9d2e" ${ST}/>
  <path d="M134 112 Q142 92 154 100 Q164 86 176 98 Q190 88 198 104 Q210 100 214 112 Z" fill="#3a3f5c" ${ST3}/>
  <path d="M214 168 L228 168" ${ST}/>
  <rect x="226" y="96" width="62" height="92" rx="12" fill="#ff4b4b" ${ST}/>
  <rect x="220" y="82" width="74" height="18" rx="8" fill="#c22a22" ${ST}/>
  <rect x="236" y="104" width="42" height="44" rx="12" fill="#cdeeff" ${ST3}/>
  ${face(257, 126, 20, p)}
  ${glass('M236 118 Q236 104 250 104 L264 104 Q278 104 278 118 L278 134 Q278 148 264 148 L250 148 Q236 148 236 134 Z', 'M242 110 L252 110 L244 142 L242 142 Z')}
  <rect x="284" y="116" width="94" height="68" rx="30" fill="#4aa8ff" ${ST}/>
  ${gloss('M300 122 L366 122 L366 130 L300 130 Z', .45)}
  <rect x="338" y="78" width="26" height="46" rx="6" fill="#3a3f5c" ${ST}/>
  <path d="M330 80 L372 80 L364 66 L338 66 Z" fill="#5a608a" ${ST}/>
  <circle cx="312" cy="112" r="14" fill="#ffd23f" ${ST}/>
  <circle cx="380" cy="150" r="8" fill="#fff6a8" ${ST3}/>
  <path d="M384 196 L398 220 L372 220 Z" fill="#8d93ad" ${ST3}/>
  <path d="M250 214 L350 214" stroke="${INK}" stroke-width="6"/>
  ${wheel(30, 212, 26, '#ff4b4b')}${wheel(88, 212, 26, '#ff4b4b')}${wheel(150, 214, 22, '#ffd23f')}
  ${wheel(256, 208, 34, '#ffd23f')}${wheel(340, 214, 26, '#ffd23f')}`;
}

function helicopter(p) {
  return `
  <path d="M262 126 L376 108 Q388 106 388 118 L388 128 Q388 138 376 138 L262 160 Z" fill="#ff5a4f" ${ST}/>
  <path d="M368 110 L386 62 L398 66 L392 112 Z" fill="#e8382f" ${ST}/>
  <g transform="translate(380 96)"><g class="tailrotor"><rect x="-4" y="-26" width="8" height="52" rx="4" fill="#cfd3e4" ${ST3}/></g></g>
  <ellipse cx="196" cy="156" rx="106" ry="66" fill="#ff5a4f" ${ST}/>
  ${shade('M110 184 Q196 232 282 184 Q282 214 196 222 Q110 214 110 184 Z', .2)}
  ${gloss('M120 128 Q160 92 220 92 Q170 100 140 136 Z', .5)}
  <path d="M196 90 L196 70" ${ST}/>
  <rect x="150" y="124" width="82" height="66" rx="30" fill="#cdeeff" ${ST}/>
  ${face(190, 156, 31, p)}
  ${glass('M150 154 Q150 124 182 124 L202 124 Q232 124 232 154 L232 160 Q232 190 202 190 L182 190 Q150 190 150 160 Z', 'M160 134 L180 130 L166 176 L160 170 Z')}
  <rect x="240" y="136" width="44" height="40" rx="12" fill="#cdeeff" ${ST3}/>
  <rect x="106" y="138" width="38" height="40" rx="12" fill="#ffd0cc" ${ST3}/>
  <g class="rotor" style="transform-origin:196px 66px">
    <ellipse cx="196" cy="66" rx="190" ry="9" fill="#2a2f55" fill-opacity=".18"/>
    <rect x="12" y="60" width="368" height="12" rx="6" fill="#4a5078" ${ST3}/>
  </g>
  <rect x="186" y="62" width="20" height="14" rx="4" fill="#8d93ad" ${ST3}/>
  <path d="M130 218 L120 244 M262 218 L272 244" ${ST}/>
  <path d="M96 246 L296 246" stroke="${INK}" stroke-width="9" stroke-linecap="round"/>
  <path d="M96 246 L296 246" stroke="#8d93ad" stroke-width="3" stroke-linecap="round"/>`;
}

function airplane(p) {
  return `
  <path d="M40 148 L22 76 Q22 66 34 68 L84 80 L110 150 Z" fill="#ff5a4f" ${ST}/>
  <path d="M60 154 L16 150 Q10 150 14 144 L24 130 L96 138 Z" fill="#ff7a6e" ${ST}/>
  <path d="M26 160 Q26 120 80 118 L300 118 Q386 118 388 160 Q386 198 300 198 L80 198 Q26 198 26 160 Z" fill="#f4f7ff" ${ST}/>
  ${gloss('M60 126 L290 126 Q330 126 350 136 L60 136 Z', .6)}
  <path d="M30 172 L380 172" stroke="#4aa8ff" stroke-width="12"/>
  <path d="M30 172 L380 172" stroke="${INK}" stroke-width="0"/>
  <path d="M170 166 L96 238 Q92 244 102 244 L142 244 Q154 244 164 232 L238 166 Z" fill="#4aa8ff" ${ST}/>
  ${gloss('M176 168 L110 232 L122 232 L190 168 Z', .35)}
  <rect x="96" y="130" width="38" height="34" rx="14" fill="#cdeeff" ${ST3}/>${face(115, 147, 15, p + 1)}
  <rect x="146" y="130" width="38" height="34" rx="14" fill="#cdeeff" ${ST3}/>${face(165, 147, 15, p + 2)}
  <rect x="196" y="130" width="38" height="34" rx="14" fill="#cdeeff" ${ST3}/>${face(215, 147, 15, p + 3)}
  <path d="M262 122 Q320 118 346 130 Q366 140 368 150 L262 154 Z" fill="#cdeeff" ${ST}/>
  ${face(308, 140, 26, p)}
  ${glass('M262 122 Q320 118 346 130 Q366 140 368 150 L262 154 Z', 'M270 128 L296 126 L274 150 Z')}
  <path d="M388 150 L392 150" ${ST}/>
  <circle cx="392" cy="160" r="12" fill="#ffd23f" ${ST}/>
  <g transform="translate(398 160)"><g class="prop"><rect x="-6" y="-60" width="12" height="120" rx="6" fill="#2a2f55" fill-opacity=".35"/><rect x="-5" y="-50" width="10" height="100" rx="5" fill="#5a608a" ${ST3}/></g></g>
  <path d="M126 198 L122 226 M300 198 L304 226" ${ST}/>
  ${wheel(122, 232, 16, '#e6e9f2')}${wheel(304, 232, 16, '#e6e9f2')}`;
}

function garbageTruck(p) {
  return `
  <path d="M14 182 L14 98 Q14 62 52 62 L214 62 Q272 62 272 118 L272 182 Z" fill="#35c46a" ${ST}/>
  ${gloss('M26 72 Q30 68 52 68 L206 68 L206 76 L26 76 Z', .45)}
  ${shade('M14 160 L272 160 L272 182 L14 182 Z', .16)}
  <path d="M14 98 L14 182 L58 182 L58 98 Q58 78 36 78 Q14 78 14 98 Z" fill="#1d8f48" ${ST}/>
  <path d="M20 108 L52 108 M18 122 L54 122" stroke="#0e5a2c" stroke-width="4" stroke-linecap="round"/>
  <circle cx="30" cy="150" r="5" fill="#ffe27a"/><circle cx="46" cy="144" r="4" fill="#ff8f8f"/>
  <path d="M82 70 L82 178 M150 70 L150 178" ${ST3} opacity=".35"/>
  <circle cx="186" cy="112" r="34" fill="#2bad5c" ${ST3}/>
  <path d="M174 100 L194 100 L200 112 M200 118 L192 130 L174 130 M170 124 L164 112 L170 102" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M276 76 L276 182 L376 182 L376 140 Q376 126 362 124 L336 120 L322 84 Q318 76 308 76 Z" fill="#35c46a" ${ST}/>
  <rect x="280" y="86" width="68" height="62" rx="14" fill="#cdeeff" ${ST3}/>
  ${face(314, 118, 27, p)}
  ${glass('M280 100 Q280 86 294 86 L334 86 Q348 86 348 100 L348 134 Q348 148 334 148 L294 148 Q280 148 280 134 Z', 'M288 94 L304 94 L292 142 L288 140 Z')}
  <g class="flashA"><path d="M296 76 Q296 60 312 60 Q328 60 328 76 Z" fill="#ffb02e" ${ST}/></g>
  ${shade('M276 164 L376 164 L376 182 L276 182 Z', .16)}
  <circle cx="368" cy="152" r="8" fill="#fff6a8" ${ST3}/>
  <rect x="368" y="172" width="20" height="14" rx="4" fill="#4a5078" ${ST3}/>
  <path d="M48 182 Q48 150 80 150 Q112 150 112 182 Z" fill="#2a2f55"/>
  <path d="M132 182 Q132 150 164 150 Q196 150 196 182 Z" fill="#2a2f55"/>
  ${wheel(80, 212, 33)}${wheel(164, 212, 33)}${wheel(326, 212, 33)}`;
}

function tractor(p) {
  return `
  <path d="M96 196 L330 196 L330 170 L96 170 Z" fill="#c22a22" ${ST}/>
  <path d="M226 160 L226 122 Q226 110 238 110 L350 110 Q364 110 364 124 L364 176 L226 176 Z" fill="#ff4b4b" ${ST}/>
  ${gloss('M234 118 L350 118 L350 126 L234 126 Z', .45)}
  ${[0, 1, 2, 3].map(i => `<path d="M${352 + i * 3} ${130 + i * 10} L${364} ${130 + i * 10}" ${ST3}/>`).join('')}
  <rect x="300" y="64" width="12" height="52" rx="5" fill="#8d93ad" ${ST}/>
  <rect x="296" y="56" width="20" height="12" rx="5" fill="#5a608a" ${ST3}/>
  <rect x="86" y="130" width="140" height="48" rx="12" fill="#ff4b4b" ${ST}/>
  <rect x="104" y="150" width="30" height="40" rx="8" fill="#c22a22" ${ST3}/>
  <path d="M92 40 L212 40" stroke="${INK}" stroke-width="16" stroke-linecap="round"/>
  <path d="M92 40 L212 40" stroke="#4a8cff" stroke-width="8" stroke-linecap="round"/>
  <path d="M104 46 L104 130 M200 46 L200 130" stroke="${INK}" stroke-width="12" stroke-linecap="round"/>
  <path d="M104 46 L104 130 M200 46 L200 130" stroke="#8d93ad" stroke-width="5" stroke-linecap="round"/>
  ${face(152, 94, 36, p)}
  <path d="M120 130 Q120 124 152 124 Q184 124 184 130 L184 140 L120 140 Z" fill="#4a5078" ${ST3}/>
  <path d="M206 112 L238 86 M238 86 L250 98" ${ST} />
  <circle cx="246" cy="96" r="16" fill="none" stroke="${INK}" stroke-width="7"/>
  <circle cx="246" cy="96" r="16" fill="none" stroke="#ffd23f" stroke-width="3"/>
  <circle cx="362" cy="140" r="8" fill="#fff6a8" ${ST3}/>
  <g transform="translate(126 190)"><g class="spin">
    <circle r="62" fill="#343a5c" ${ST}/>
    ${[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(a => `<rect x="-5" y="-66" width="10" height="14" rx="3" fill="#4a5078" transform="rotate(${a})"/>`).join('')}
    <circle r="36" fill="#ffd23f" ${ST}/><circle r="12" fill="#e6e9f2" ${ST3}/>
    ${[0, 72, 144, 216, 288].map(a => `<circle cx="${(24 * Math.cos(a * Math.PI / 180)).toFixed(1)}" cy="${(24 * Math.sin(a * Math.PI / 180)).toFixed(1)}" r="4" fill="${INK}"/>`).join('')}
  </g></g>
  ${wheel(318, 218, 34, '#ffd23f')}`;
}

/* ---------- the list (order = position around Jackson on the home screen) ---------- */
const VEHICLES = [
  { id: 'dump',    name: 'Dump truck',    draw: dumpTruck,    tile: '#ffe9a8', theme: 'road', ground: true,  photo: 0 },
  { id: 'fire',    name: 'Fire truck',    draw: fireTruck,    tile: '#ffc9c4', theme: 'road', ground: true,  photo: 1 },
  { id: 'bus',     name: 'School bus',    draw: schoolBus,    tile: '#fff0b0', theme: 'road', ground: true,  photo: 2 },
  { id: 'train',   name: 'Train',         draw: train,        tile: '#c8e4ff', theme: 'rail', ground: true,  photo: 0 },
  // (center tile is Jackson)
  { id: 'heli',    name: 'Helicopter',    draw: helicopter,   tile: '#d4f0ff', theme: 'sky',  ground: false, photo: 1 },
  { id: 'plane',   name: 'Airplane',      draw: airplane,     tile: '#e0d6ff', theme: 'sky',  ground: false, photo: 0 },
  { id: 'garbage', name: 'Garbage truck', draw: garbageTruck, tile: '#c9f2d5', theme: 'road', ground: true,  photo: 3 },
  { id: 'tractor', name: 'Tractor',       draw: tractor,      tile: '#ffd9b8', theme: 'farm', ground: true,  photo: 1 },
];

function vehicleSVG(v, cls = '') {
  return `<svg class="veh ${cls}" viewBox="-6 0 412 262" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${v.draw(v.photo)}</svg>`;
}
