// The sticker book's stickers (#47). Earned stickers live in each child's profile (profile.award); this is the catalogue:
// what each one looks like, its spoken name (clip stk_<id>), which game it belongs to (the hub's badges), who can earn it,
// and, for grown-ups, how. Secret ones (the easter eggs, #49) show as a question mark until found.
const ALL = ['adalyn', 'esmae', 'tony'], TWINS = ['adalyn', 'esmae'];
const S = (id, emoji, name, game, who, how, secret = false) => ({ id, emoji, name, game, who, how, secret });

export const STICKERS = [
  S('castle-crown', '\u{1F451}', 'Castle crown', 'candy', TWINS, 'Reach the castle in Candy Adventure'),
  S('sound-catcher', '\u{1F442}', 'Sound catcher', 'candy', TWINS, 'Catch four first-sound bubbles in the tunnel'),
  S('candy-counter', '\u{1F36C}', 'Candy counter', 'candy', TWINS, 'Finish a counting mission in the chocolate meadow'),
  S('rainbow-castle', '\u{1F3F0}', 'Rainbow castle', 'uni', ['adalyn'], "Reach the Rainbow Castle in Uni's adventure"),
  S('house-party', '\u{1F3E1}', 'House party', 'uni', ['adalyn'], "Finish all five friends' house games"),
  S('mermaid-palace', '\u{1F531}', 'Mermaid palace', 'mermaid', ['esmae'], 'Reach the Mermaid Palace'),
  S('kind-heart', '\u{1F49D}', 'Kind heart', 'mermaid', ['esmae'], 'Help all three friends find what they lost'),
  S('frame-of-love', '\u{1F496}', 'Frame of love', 'mermaid', ['esmae'], 'Fill a ten-frame with hearts'),
  S('sea-houses', '\u{1F420}', 'Sea house party', 'mermaid', ['esmae'], "Finish all four friends' house games"),
  S('royal-feast', '\u{1F370}', 'Royal feast', 'princess', ['esmae'], 'Serve ten dishes in Princess Kitchen'),
  S('derby-hero', '\u{1F3C6}', 'Home run hero', 'derby', ['tony'], 'Hit five home runs in one game'),
  S('derby-best', '\u{1F31F}', 'Best ever', 'derby', ['tony'], 'Beat your best number of home runs'),
  // learning: every new reading or math level (only real first-try answers move a level)
  ...['\u{1F4D7}', '\u{1F4D8}', '\u{1F4D9}', '\u{1F4D5}', '\u{1F4D3}', '\u{1F4DA}'].map((e, i) => S(`reading-${i + 1}`, e, `Reading star ${i + 1}`, 'learn', ALL, `Reach reading level ${i + 1}`)),
  ...['\u{1F522}', '➕', '➖', '\u{1F51F}', '\u{1F9EE}', '\u{1F4AF}'].map((e, i) => S(`math-${i + 1}`, e, `Math star ${i + 1}`, 'learn', ALL, `Reach math level ${i + 1}`)),
  // the easter eggs: never explained, found by tapping around
  S('egg-sun', '\u{1F60E}', 'Cool sun', 'candy', TWINS, 'Tap the sun on the beach five times', true),
  S('egg-cat-tail', '\u{1F36D}', 'Lollipop tail', 'candy', TWINS, 'Tap the Cat four times', true),
  S('egg-dice', '\u{1F3B2}', 'Giant dice', 'candy', TWINS, 'Tap the dice three more times while it rolls', true),
  S('egg-portrait', '\u{1F61B}', 'Silly twin', 'candy', TWINS, 'Tap your own picture three times', true),
  S('egg-lamps', '\u{1F319}', 'Night forest', 'uni', ['adalyn'], 'Tap five lamp posts', true),
  S('egg-cherry', '\u{1F352}', 'Cherry horn', 'uni', ['adalyn'], 'Eat at three ice-cream stops in one game', true),
  S('egg-crab', '\u{1F980}', 'Waving crab', 'mermaid', ['esmae'], 'Tap a clam', true),
  S('egg-nap', '\u{1F4A4}', 'Sleepy king', 'mermaid', ['esmae'], 'Tap the King three times', true),
  S('egg-bat', '\u{1F987}', 'Chandelier bat', 'princess', ['esmae'], 'Tap a chandelier', true),
  S('egg-dance', '\u{1F57A}', 'Dancing butler', 'princess', ['esmae'], 'Serve noodles three times in one game', true),
  S('egg-moon', '\u{1F315}', 'Moon shot', 'derby', ['tony'], 'Hit a home run of 500 feet or more', true),
  S('egg-parade', '\u{1F389}', 'Hero parade', 'hub', ALL, 'Tap the & on the games menu', true),
];
export const sticker = (id) => STICKERS.find((s) => s.id === id);
export const stickersFor = (who) => STICKERS.filter((s) => s.who.includes(who));
