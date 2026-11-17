// The two doors. Data only (§7): the five pieces (names = Fluent Emoji 3D pictures, fetched by tools/fetch-art.mjs), the magic piece,
// the pop ring, the friend who helps and the friend to bring home. Lands, charms and voice lines come in later phases.
export const THEMES = {
  unicorn: {
    id: 'unicorn', name: 'Unicorn',
    bg: ['#ffd9f1', '#c7b3ff'], square: 0xffffff,
    colors: ['#ffc928', '#ff6fae', '#45a6ff', '#43c768', '#a66bff'],   // star · pink heart · gem stone · four leaf clover · crystal ball
    names: ['Star', 'Pink heart', 'Gem stone', 'Four leaf clover', 'Crystal ball'],
    art: { magic: 'Rainbow', ring: 'Sparkles', band: null, friend: 'Unicorn', home: 'Rabbit', party: 'Party popper' },   // Fluent Emoji 3D (tools/fetch-art.mjs)
    rainbow: [0xff5d5d, 0xffa53d, 0xffe14d, 0x5fd36b, 0x4aa8ff, 0xa66bff],
    baby: { body: 0xffffff, edge: 0xffc2e2, ear: 0xffd6ec, nose: 0xff7fb6 },   // the bunny to bring home
    friend: '\u{1F984}', home: '\u{1F430}', voice: 'uni',
    short: ['star', 'heart', 'gem', 'clover', 'crystal ball'], homeColor: [0x8fd36b, 0x5fae45],
    lines: { help: ['Let me help!', 'Here I come!', 'I can help!'], praise: ['Wow!', 'Sparkle-tastic!', 'Amazing!', 'Ooh, sparkly!'], win: ['You did it!', 'Hooray!', 'Sparkle-tastic!'],
      lesson: { 11: 'Pop the pieces on the sparkly squares!', 21: 'Make four in a row!', 31: 'Help the bunny hop down to its home!' } },
  },
  mermaid: {
    id: 'mermaid', name: 'Mermaid',
    bg: ['#8ee8ff', '#2a7fd0'], square: 0xe8fbff,
    colors: ['#f5ecdc', '#ff5b5b', '#38c47c', '#3a8dff', '#ff9a2e'],   // spiral shell · crab · turtle · dolphin · octopus
    names: ['Spiral shell', 'Crab', 'Turtle', 'Dolphin', 'Octopus'],
    art: { magic: 'Trident emblem', ring: 'Bubbles', band: 'Water wave', friend: 'Woman merpeople', home: 'Seal', party: 'Party popper' },
    rainbow: [0xffffff, 0x9ff3ff, 0x4fd3ff, 0x2a9dff, 0x2a6fd0, 0xffd700],
    baby: { body: 0xdfe6ee, edge: 0x9fb2c6, ear: 0xc4d0dc, nose: 0x5a6878 },   // the seal pup to bring home
    friend: '\u{1F9DC}‍♀️', home: '\u{1F9AD}', voice: 'princess',
    short: ['shell', 'crab', 'turtle', 'dolphin', 'octopus'], homeColor: [0x7fd6ff, 0x3a9ad9],
    lines: { help: ['Let me help!', 'Here I come!', 'Splish splash, I can help!'], praise: ['Wow!', 'Splash!', 'Amazing!', 'Fin-tastic!'], win: ['You did it!', 'Hooray!', 'Splash-tastic!'],
      lesson: { 11: 'Pop the pieces on the sparkly squares!', 21: 'Make four in a row!', 31: 'Help the seal pup swim down to its home!' } },
  },
};

export const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
/** every picture a door needs */
export const artNames = (t) => [...t.names, ...Object.values(t.art).filter(Boolean)];
/** the level-1 lesson: 'Slide a star next to two more stars!' */
export const lessonOne = (t, k) => { const n = t.short[k]; return `Slide ${/^[aeiou]/.test(n) ? 'an' : 'a'} ${n} next to two more ${n === 'octopus' ? 'octopuses' : n + 's'}!`; };
