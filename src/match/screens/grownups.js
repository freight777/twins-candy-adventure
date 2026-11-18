// The grown-up corner (§8 Phase 3): reached by holding the gear on the doors screen for two seconds. Sound, music, the mermaid's
// skin tone, "always show hints", and resetting a door (hold to confirm). Nothing here is reachable by a quick tap.
import { THEMES } from '../themes.js';
import { save, setSetting, resetDoor, wonCount } from '../save.js';
import { artSrc } from './doors.js';
import { holdGate } from '../../engine/gate.js';

export function showGrownups(root, { onChange }) {
  const sea = THEMES.mermaid, el = document.createElement('div'), s = save.settings;
  el.className = 'grownups';
  el.innerHTML = `<div class="gu-card"><h2>Grown-ups</h2>
    <label><input type="checkbox" data-k="sound" ${s.sound ? 'checked' : ''}> Sound</label>
    <label><input type="checkbox" data-k="music" ${s.music ? 'checked' : ''}> Music</label>
    <label><input type="checkbox" data-k="hints" ${s.hints ? 'checked' : ''}> Always show hints (after 2 seconds instead of 5)</label>
    <div class="gu-row"><span>Mermaid</span>${sea.skins.map((k) => `<button class="skin${s.skin === k ? ' on' : ''}" data-skin="${k}" aria-label="${k}"><img src="${artSrc(k === 'Default' ? sea.art.friend : `${sea.art.friend}|${k}`)}" alt=""></button>`).join('')}</div>
    <div class="gu-row">${Object.values(THEMES).map((t) => `<button class="reset" data-door="${t.id}">Reset ${t.door.title} (${wonCount(t.id)} won) — hold</button>`).join('')}</div>
    <p class="gu-note">Progress is kept on this device only. Add the games to the Home Screen so Safari keeps it.</p>
    <button class="gu-close">Done</button></div>`;
  root.appendChild(el);
  el.querySelectorAll('input[type=checkbox]').forEach((c) => c.addEventListener('change', () => { setSetting(c.dataset.k, c.checked); onChange?.(); }));
  el.querySelectorAll('.skin').forEach((b) => b.addEventListener('click', () => { setSetting('skin', b.dataset.skin); el.querySelectorAll('.skin').forEach((x) => x.classList.toggle('on', x === b)); onChange?.(); }));
  el.querySelectorAll('.reset').forEach((b) => holdGate(b, () => { resetDoor(b.dataset.door); b.textContent = `${THEMES[b.dataset.door].door.title}: reset`; onChange?.(); }, { ms: 2000 }));
  el.querySelector('.gu-close').addEventListener('click', () => el.remove());
}
