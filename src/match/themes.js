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
    // the journey (§2): ten lands of ten level stones; each won level gives that land a charm; each party level adds the land's friend to the map
    lands: [
      { name: 'Rainbow Meadow', bg: ['#c8f5c0', '#ffe0f4'], friend: 'Hamster', charms: ['Rainbow', 'Tulip', 'Sunflower', 'Blossom', 'Hibiscus', 'Four leaf clover', 'Herb', 'Seedling', 'Lady beetle', 'Honeybee'] },
      { name: 'Cloud Castle', bg: ['#dff3ff', '#f3e5ff'], friend: 'Bird', charms: ['Cloud', 'Castle', 'Sun behind cloud', 'Kite', 'Balloon', 'Dove', 'Feather', 'Umbrella', 'Parachute', 'Wind chime'] },
      { name: 'Candy Hills', bg: ['#ffe1ef', '#fff1c9'], friend: 'Bear', charms: ['Candy', 'Lollipop', 'Chocolate bar', 'Doughnut', 'Cookie', 'Custard', 'Honey pot', 'Shortcake', 'Birthday cake', 'Soft ice cream'] },
      { name: 'Star Lake', bg: ['#d7e6ff', '#efe1ff'], friend: 'Frog', charms: ['Star', 'Glowing star', 'Shooting star', 'Sparkles', 'Duck', 'Swan', 'Fish', 'Lotus', 'Comet', 'Sun'] },
      { name: 'Crystal Cave', bg: ['#e4ddff', '#d0f0ff'], friend: 'Koala', charms: ['Gem stone', 'Crystal ball', 'Ring', 'Diamond with a dot', 'Magic wand', 'Red paper lantern', 'Flashlight', 'Rock', 'Bat', 'Candle'] },
      { name: 'Butterfly Garden', bg: ['#e8ffd8', '#ffe6f6'], friend: 'Hedgehog', charms: ['Butterfly', 'Snail', 'Bug', 'Rose', 'Cherry blossom', 'Bouquet', 'Potted plant', 'Mushroom', 'Ant', 'Hyacinth'] },
      { name: 'Moon Forest', bg: ['#d9d4ff', '#c7e6d8'], friend: 'Fox', charms: ['Crescent moon', 'Full moon face', 'Owl', 'Evergreen tree', 'Deciduous tree', 'Raccoon', 'Maple leaf', 'Fallen leaf', 'Chestnut', 'Wood'] },
      { name: 'Cupcake Village', bg: ['#fff0d9', '#ffd9e6'], friend: 'Cat', charms: ['Cupcake', 'Croissant', 'Bread', 'Pancakes', 'Waffle', 'Teacup without handle', 'Hot beverage', 'Strawberry', 'Cherries', 'Peach'] },
      { name: 'Sparkle Mountain', bg: ['#e6f6ff', '#ffffff'], friend: 'Llama', charms: ['Snow-capped mountain', 'Mountain', 'Snowman', 'Ice', 'Sled', 'Gloves', 'Scarf', 'Snowflake', 'Penguin', 'Polar bear'] },
      { name: 'Rainbow Palace', bg: ['#ffe3f6', '#e6dcff'], friend: 'Peacock', charms: ['Crown', 'Trophy', 'Wrapped gift', 'Party popper', 'Confetti ball', 'Ribbon', 'Teddy bear', 'Mirror ball', 'Musical notes', 'Sparkling heart'] },
    ],
    door: { title: 'Unicorn', song: 'matchUni', colors: ['#ffb8e6', '#b9a2ff'] },
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
    // the journey (§2): ten lands of ten level stones; each won level gives that land a charm; each party level adds the land's friend to the map
    lands: [
      { name: 'Shell Beach', bg: ['#fff3cf', '#bdeeff'], friend: 'Parrot', charms: ['Spiral shell', 'Crab', 'Beach with umbrella', 'Sunglasses', 'Palm tree', 'Coconut', 'Tropical drink', 'Bucket', 'Sun with face', 'Watermelon'] },
      { name: 'Coral Garden', bg: ['#ffd9d0', '#a8e8ff'], friend: 'Snail', charms: ['Coral', 'Tropical fish', 'Blowfish', 'Shrimp', 'Lobster', 'Oyster', 'Squid', 'Lotus', 'Hibiscus', 'Bubbles'] },
      { name: 'Kelp Forest', bg: ['#c9f2d8', '#8fd6e8'], friend: 'Frog', charms: ['Leafy green', 'Herb', 'Seedling', 'Seal', 'Otter', 'Water wave', 'Droplet', 'Rock', 'Wood', 'Mushroom'] },
      { name: 'Dolphin Bay', bg: ['#bfe9ff', '#e4f7ff'], friend: 'Duck', charms: ['Dolphin', 'Spouting whale', 'Whale', 'Sailboat', 'Canoe', 'Anchor', 'Ring buoy', 'Sun', 'Cloud', 'Rainbow'] },
      { name: 'Pearl Lagoon', bg: ['#f3e7ff', '#c7f0ff'], friend: 'Swan', charms: ['Gem stone', 'Ring', 'Crystal ball', 'Diamond with a dot', 'Sparkles', 'Glowing star', 'Star', 'Mirror ball', 'Ribbon', 'Bell'] },
      { name: 'Turtle Reef', bg: ['#d4f7e3', '#9ee0f0'], friend: 'Flamingo', charms: ['Turtle', 'Octopus', 'Jellyfish', 'Shark', 'Diving mask', 'Compass', 'Lizard', 'Pineapple', 'Mango', 'Banana'] },
      { name: 'Jellyfish Deep', bg: ['#c8d9ff', '#a0b8f0'], friend: 'Penguin', charms: ['Crescent moon', 'Full moon face', 'Shooting star', 'Comet', 'Flashlight', 'Candle', 'Red paper lantern', 'Light bulb', 'Microbe', 'Snowflake'] },
      { name: 'Sunken Ship', bg: ['#b9d8e8', '#e8d9b9'], friend: 'Mouse', charms: ['Ship', 'Old key', 'Coin', 'Telescope', 'Fishing pole', 'Hourglass done', 'Teapot', 'Jar', 'Framed picture', 'Knot'] },
      { name: 'Crystal Grotto', bg: ['#d9f3ff', '#e9dcff'], friend: 'Owl', charms: ['Ice', 'Snow-capped mountain', 'Mountain', 'Bat', 'Diya lamp', 'Violin', 'Flute', 'Yarn', 'Thread', 'Artist palette'] },
      { name: 'Mermaid Palace', bg: ['#ffe0f0', '#d8e9ff'], friend: 'Unicorn', charms: ['Crown', 'Trophy', 'Wrapped gift', 'Party popper', 'Confetti ball', 'Teddy bear', 'Pink heart', 'Sparkling heart', 'Heart with ribbon', 'Birthday cake'] },
    ],
    door: { title: 'Mermaid', song: 'matchSea', colors: ['#7fe3ff', '#3a8dff'] },
    skins: ['Default', 'Light', 'Medium-Light', 'Medium', 'Medium-Dark', 'Dark'],   // the mermaid's skin tone: a grown-up setting
    short: ['shell', 'crab', 'turtle', 'dolphin', 'octopus'], homeColor: [0x7fd6ff, 0x3a9ad9],
    lines: { help: ['Let me help!', 'Here I come!', 'Splish splash, I can help!'], praise: ['Wow!', 'Splash!', 'Amazing!', 'Fin-tastic!'], win: ['You did it!', 'Hooray!', 'Splash-tastic!'],
      lesson: { 11: 'Pop the pieces on the sparkly squares!', 21: 'Make four in a row!', 31: 'Help the seal pup swim down to its home!' } },
  },
};

export const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
/** every picture a door needs */
export const artNames = (t) => [...new Set([...t.names, ...Object.values(t.art).filter(Boolean), ...t.lands.flatMap((l) => [l.friend, ...l.charms]), ...(t.skins || []).filter((k) => k !== 'Default').map((k) => `${t.art.friend}|${k}`)])];
/** a picture name with an optional skin tone ('Woman merpeople|Medium') as a file name */
export const artFile = (name) => slug(name.replace('|', ' '));
/** the level-1 lesson: 'Slide a star next to two more stars!' */
export const lessonOne = (t, k) => { const n = t.short[k]; return `Slide ${/^[aeiou]/.test(n) ? 'an' : 'a'} ${n} next to two more ${n === 'octopus' ? 'octopuses' : n + 's'}!`; };
