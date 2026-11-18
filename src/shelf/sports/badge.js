// A team's badge (§9): a plain shield in the team's two colours with its initials and the mascot's line drawing. The only team
// mark in the game — never a league or team logo. A real team from the scores feed has no mascot: its initials, bigger. The mascot drawings come from public/art/mascots.svg (load it with loadSprites('mascots')).
import { initials } from './teams.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export function badgeSVG(team, cls = 'badge') {
  const [c1, c2] = team.colors;
  return `<svg class="${cls}" viewBox="0 0 100 118" aria-hidden="true">
    <path d="M50 4 L94 16 V58 C94 86 74 104 50 113 C26 104 6 86 6 58 V16 Z" fill="${esc(c1)}" stroke="${esc(c2)}" stroke-width="7" stroke-linejoin="round"/>
    ${team.mascot ? `<circle cx="50" cy="45" r="27" fill="#fff" stroke="${esc(c2)}" stroke-width="3"/>
    <use href="#m${esc(team.mascot)}" x="25" y="20" width="50" height="50"/>` : ''}
    <text x="50" y="${team.mascot ? 97 : 72}" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="${(initials(team).length > 2 ? 18 : 22) * (team.mascot ? 1 : 1.6)}" fill="#fff" stroke="${esc(c2)}" stroke-width="4" paint-order="stroke">${esc(initials(team))}</text>
  </svg>`;
}
