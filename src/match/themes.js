// The two doors. Data only (§7). Phase 0 uses the colours; the pictures, lands, friends, charms and voice lines come in later phases.
export const THEMES = {
  unicorn: {
    id: 'unicorn', name: 'Unicorn',
    bg: ['#ffd9f1', '#c7b3ff'], square: 0xffffff,
    colors: ['#ffc928', '#ff6fae', '#45a6ff', '#43c768', '#a66bff'],   // star · pink heart · gem stone · four leaf clover · crystal ball
    names: ['Star', 'Pink heart', 'Gem stone', 'Four leaf clover', 'Crystal ball'],
    rainbow: [0xff5d5d, 0xffa53d, 0xffe14d, 0x5fd36b, 0x4aa8ff, 0xa66bff],
    baby: { body: 0xffffff, edge: 0xffc2e2, ear: 0xffd6ec, nose: 0xff7fb6 },   // the bunny to bring home
    friend: '\u{1F984}', home: '\u{1F430}',
  },
  mermaid: {
    id: 'mermaid', name: 'Mermaid',
    bg: ['#8ee8ff', '#2a7fd0'], square: 0xe8fbff,
    colors: ['#f5ecdc', '#ff5b5b', '#38c47c', '#3a8dff', '#ff9a2e'],   // spiral shell · crab · turtle · dolphin · octopus
    names: ['Spiral shell', 'Crab', 'Turtle', 'Dolphin', 'Octopus'],
    rainbow: [0xffffff, 0x9ff3ff, 0x4fd3ff, 0x2a9dff, 0x2a6fd0, 0xffd700],
    baby: { body: 0xdfe6ee, edge: 0x9fb2c6, ear: 0xc4d0dc, nose: 0x5a6878 },   // the seal pup to bring home
    friend: '\u{1F9DC}‍♀️', home: '\u{1F9AD}',
  },
};
