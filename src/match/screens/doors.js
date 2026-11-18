// The home screen (§2 "Two games in one"): two doors, Unicorn and Mermaid. Each door shows its friend and how many charms are
// behind it. The house (hold) goes back to the A&E games menu; the gear (hold 2 s) opens the grown-up corner.
import { THEMES, artFile } from '../themes.js';
import { save, wonCount } from '../save.js';

export const friendName = (t) => (t.id === 'mermaid' && save.settings.skin && save.settings.skin !== 'Default' ? `${t.art.friend}|${save.settings.skin}` : t.art.friend);
export const artSrc = (name) => `${import.meta.env.BASE_URL}assets/match/${artFile(name)}.webp`;

export function showDoors(root, { onPick }) {
  root.innerHTML = `<div class="doors">
    ${Object.values(THEMES).map((t) => `<button class="door" data-door="${t.id}" aria-label="${t.door.title}" style="--d0:${t.door.colors[0]};--d1:${t.door.colors[1]}">
      <span class="arch"><img class="door-friend" src="${artSrc(friendName(t))}" alt="" draggable="false"></span>
      <span class="door-charms"><img src="${artSrc(t.lands[0].charms[0])}" alt="">${wonCount(t.id)}</span></button>`).join('')}
  </div>`;
  root.querySelectorAll('.door').forEach((b) => b.addEventListener('click', () => { b.classList.add('opening'); onPick(b.dataset.door); }));
}
