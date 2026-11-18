// The sports layer (§9). No league or team logos, ever: a team is a name, two colours and a mascot animal on a plain shield.
// Sixteen invented teams ship with the game (the house league); a grown-up adds his real favourites as My Teams (name, two colours,
// a mascot), kept on this device only. Mascots are OpenMoji line drawings (tools/build-art.mjs → public/art/mascots.svg).
export const MASCOTS = {
  '1F9A6': 'otter', '1F985': 'eagle', '1F988': 'shark', '1F43B': 'bear', '1F98A': 'fox', '1F986': 'duck', '1F9AC': 'bison', '1F42C': 'dolphin',
  '1F989': 'owl', '1F981': 'lion', '1F427': 'penguin', '1F41D': 'bee', '1F98F': 'rhino', '1F40A': 'gator', '1F43A': 'wolf', '1F405': 'tiger',
  '1F40E': 'horse', '1F409': 'dragon', '1F408': 'cat', '1F415': 'dog', '1F402': 'ox', '1F98C': 'deer', '1F993': 'zebra', '1F996': 'T-rex',
};
/** the house league: place, nickname, mascot (OpenMoji code), colours */
export const HOUSE = [
  ['River City', 'Otters', '1F9A6', '#1f6fb2', '#8fd3ff'], ['Summit', 'Hawks', '1F985', '#c1272d', '#2b2b2b'],
  ['Harbor', 'Sharks', '1F988', '#0d3b66', '#5bc0eb'], ['Pine Valley', 'Bears', '1F43B', '#2e7d32', '#f9a825'],
  ['Desert', 'Foxes', '1F98A', '#e76f51', '#264653'], ['Lakeside', 'Ducks', '1F986', '#ffd166', '#118ab2'],
  ['Thunder Bay', 'Bison', '1F9AC', '#6d4c41', '#ffb300'], ['Coral Coast', 'Dolphins', '1F42C', '#00a6a6', '#ff7f50'],
  ['Maple Grove', 'Owls', '1F989', '#6a4c93', '#ffca3a'], ['Canyon', 'Lions', '1F981', '#b5121b', '#f2e8cf'],
  ['Glacier', 'Penguins', '1F427', '#003049', '#9be0f0'], ['Sunny Hills', 'Bees', '1F41D', '#ffbe0b', '#222222'],
  ['Redwood', 'Rhinos', '1F98F', '#8d99ae', '#ef233c'], ['Bayou', 'Gators', '1F40A', '#386641', '#a7c957'],
  ['Northwind', 'Wolves', '1F43A', '#495057', '#4cc9f0'], ['Starlight', 'Tigers', '1F405', '#ff7b00', '#1b1b1b'],
].map(([place, nick, mascot, c1, c2]) => ({ id: nick.toLowerCase(), place, nick, mascot, colors: [c1, c2], house: true }));

/** his teams first (a grown-up's typed names), then the house league */
export const allTeams = (mine = []) => [...mine.filter((t) => t && t.nick).map((t, i) => ({ id: `my${i}`, place: t.place || '', nick: t.nick, mascot: t.mascot || '1F985', colors: t.colors || ['#333', '#fff'], house: false })), ...HOUSE];
export const fullName = (t) => (t.place ? `${t.place} ${t.nick}` : t.nick);
export const initials = (t) => fullName(t).split(/\s+/).filter(Boolean).map((w) => w[0].toUpperCase()).join('').slice(0, 3);
