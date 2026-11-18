// The journey (§2): behind each door a winding path through ten lands, ten level stones each, drawn by code from the theme file.
// Won stones show their charm; the friend stands on the next stone, which pulses; later stones wait. Each land has a little book
// (its charm page) and, once its party level is won, its friend lives by the land's name and waves. Land 1 is at the bottom.
import { artSrc } from './doors.js';
import { won, open, current } from '../save.js';

const H = 760, STONE = 66;
const stoneAt = (land, j) => ({ x: 50 + 30 * Math.sin(j * 1.05 + land * 0.8), y: H - 96 - j * 60 });

export function buildMap(root, theme, door, friend, { onPlay, onCharms }) {
  const cur = current(door);
  root.innerHTML = `<div class="map-scroll"><div class="lands">${theme.lands.map((land, li) => {
    const pts = Array.from({ length: 10 }, (_, j) => stoneAt(li, j)), partyWon = won(door, li * 10 + 10), got = land.charms.filter((_, j) => won(door, li * 10 + j + 1)).length;
    return `<section class="land" data-land="${li}" style="--l0:${land.bg[0]};--l1:${land.bg[1]};height:${H}px">
      ${land.charms.slice(0, 6).map((c, k) => `<img class="decor" src="${artSrc(c)}" alt="" style="left:${[8, 78, 14, 84, 6, 72][k]}%;top:${[18, 30, 52, 62, 82, 86][k]}%;animation-delay:${-k * 1.3}s">`).join('')}
      <svg class="path" viewBox="0 0 100 ${H}" preserveAspectRatio="none"><polyline points="50,${H} ${pts.map((p) => `${p.x},${p.y}`).join(' ')} 50,0"/></svg>
      <div class="banner"><span class="land-name">${land.name}</span>
        <button class="charm-book" data-land="${li}" aria-label="${land.name} charms"><img src="${artSrc(land.charms[0])}" alt=""><b>${got}</b></button>
        ${partyWon ? `<img class="map-friend" src="${artSrc(land.friend)}" alt="">` : ''}</div>
      ${pts.map((p, j) => { const n = li * 10 + j + 1, w = won(door, n), party = j === 9;
        return `<button class="stone${w ? ' won' : ''}${n === cur && !w ? ' current' : ''}${open(door, n) ? '' : ' locked'}${party ? ' party' : ''}" data-n="${n}" aria-label="Level ${n}"
          style="left:calc(${p.x}% - ${STONE / 2}px);top:${p.y - STONE / 2}px">${w ? `<img src="${artSrc(land.charms[j])}" alt="">` : party ? `<img src="${artSrc(theme.art.party)}" alt="">` : `<b>${n}</b>`}</button>`; }).join('')}
    </section>`; }).reverse().join('')}</div>
    <img class="walker" src="${artSrc(friend)}" alt=""></div>`;
  const scroller = root.querySelector('.map-scroll'), walker = root.querySelector('.walker');
  root.querySelectorAll('.stone').forEach((b) => b.addEventListener('click', () => {
    if (b.classList.contains('locked')) { b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope'); return; }
    onPlay(+b.dataset.n);
  }));
  root.querySelectorAll('.charm-book').forEach((b) => b.addEventListener('click', () => onCharms(+b.dataset.land)));
  /** put the friend on a stone (optionally hopping there from another), and scroll it into the middle */
  function standOn(n, from = null) {
    const stone = root.querySelector(`.stone[data-n="${n}"]`); if (!stone) return;
    const at = (s) => { const r = s.getBoundingClientRect(), base = scroller.getBoundingClientRect(); return { x: r.left - base.left + r.width / 2, y: r.top - base.top + scroller.scrollTop }; };
    const place = (p) => { walker.style.left = p.x - 40 + 'px'; walker.style.top = p.y - 92 + 'px'; };
    scroller.scrollTop = Math.max(0, at(stone).y - scroller.clientHeight * 0.55);
    const prev = from && root.querySelector(`.stone[data-n="${from}"]`);
    if (prev) { walker.classList.add('still'); place(at(prev)); void walker.offsetWidth; walker.classList.remove('still'); setTimeout(() => { walker.classList.add('hop'); place(at(stone)); setTimeout(() => walker.classList.remove('hop'), 900); }, 500); }
    else { walker.classList.add('still'); place(at(stone)); void walker.offsetWidth; walker.classList.remove('still'); }
  }
  return { standOn };
}

/** a land's charm page: ten places, the ones won filled with their charm */
export function showCharms(root, theme, door, li, { onClose, fresh = null }) {
  const land = theme.lands[li], el = document.createElement('div');
  el.className = 'charms'; el.style.setProperty('--l0', land.bg[0]); el.style.setProperty('--l1', land.bg[1]);
  el.innerHTML = `<div class="charm-page"><h2>${land.name}</h2><div class="slots">${land.charms.map((c, j) => { const n = li * 10 + j + 1;
    return `<span class="slot${won(door, n) ? ' got' : ''}${fresh === n ? ' fresh' : ''}"><img src="${artSrc(c)}" alt=""></span>`; }).join('')}</div>
    <button class="close" aria-label="Close"><i></i></button></div>`;
  root.appendChild(el);
  const close = () => { el.remove(); onClose?.(); };
  el.addEventListener('click', (e) => { if (e.target === el || e.target.closest('.close')) close(); });
  return close;
}
