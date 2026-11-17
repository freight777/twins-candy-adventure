// Puzzle Shelf themes are data (§8): a new theme is one entry here plus its pictures (tools/fetch-art.mjs fetches every Fluent
// Emoji 3D name listed: hero, goal, decor and the maze shapes). A maze page is either a plain rectangle drawn in one of the
// theme's `mats` (a field, a court, a road…) or a shape: the outline of one of `shapes`, cut from the picture's silhouette.
export const THEMES = {
  gameday: {
    id: 'gameday', title: 'Game Day', cover: ['#ff8a3d', '#ffd166'], line: 'Get the ball to the goal!',
    hero: 'Basketball', goal: 'Goal net',
    decor: ['Soccer ball', 'Baseball', 'American football', 'Tennis', 'Volleyball', 'Trophy', 'Sports medal', 'Running shoe', 'Megaphone', 'Popcorn', 'Flying disc', 'Ice hockey'],
    mats: ['field', 'court', 'pitch', 'rink'],
    shapes: ['Basketball', 'Soccer ball', 'Trophy', 'American football', 'Running shirt', 'Sports medal'],
  },
  cars: {
    id: 'cars', title: 'Cars & Trucks', cover: ['#3a86ff', '#8ecae6'], line: 'Drive to the finish flag!',
    hero: 'Racing car', goal: 'Chequered flag',
    decor: ['Automobile', 'Taxi', 'Bus', 'Fire engine', 'Police car', 'Tractor', 'Fuel pump', 'Vertical traffic light', 'Construction', 'Delivery truck', 'Motor scooter', 'Wrench'],
    mats: ['road', 'carpark', 'dirt'],
    shapes: ['Racing car', 'Bus', 'Articulated lorry', 'Fire engine', 'Tractor', 'Construction'],
  },
  dinosaurs: {
    id: 'dinosaurs', title: 'Dinosaurs', cover: ['#4caf50', '#c5e17a'], line: 'Help the dinosaur find its egg!',
    hero: 'T-rex', goal: 'Egg',
    decor: ['Sauropod', 'Volcano', 'Palm tree', 'Bone', 'Footprints', 'Lizard', 'Herb', 'Rock', 'Spiral shell', 'Evergreen tree', 'Mushroom', 'Leaf fluttering in wind'],
    mats: ['jungle', 'sand'],
    shapes: ['Sauropod', 'T-rex', 'Egg', 'Volcano'],                         // footprints and bone were tried: too thin, or in two pieces
  },
  ocean: {
    id: 'ocean', title: 'Ocean', cover: ['#0096c7', '#90e0ef'], line: 'Swim to the treasure!',
    hero: 'Tropical fish', goal: 'Gem stone',
    decor: ['Spiral shell', 'Crab', 'Octopus', 'Coral', 'Jellyfish', 'Seal', 'Dolphin', 'Spouting whale', 'Shark', 'Lobster', 'Blowfish', 'Anchor'],
    mats: ['sea', 'reef'],
    shapes: ['Spouting whale', 'Turtle', 'Tropical fish', 'Octopus', 'Dolphin', 'Crab'],
  },
};

/** the drawn ground under a plain maze: fill, the colour of its markings, and how they are laid out */
export const MATS = {
  field: { fill: '#7cc576', mark: '#ffffff', lines: 'yards' },
  pitch: { fill: '#8bd17c', mark: '#ffffff', lines: 'halfway' },
  court: { fill: '#f2b56b', mark: '#ffffff', lines: 'key' },
  rink: { fill: '#dff3ff', mark: '#e0245e', lines: 'halfway' },
  road: { fill: '#b9bfc8', mark: '#ffe14d', lines: 'dashes' },
  carpark: { fill: '#c9cdd3', mark: '#ffffff', lines: 'bays' },
  dirt: { fill: '#e2c08d', mark: '#a9773f', lines: 'tracks' },
  jungle: { fill: '#a8d98a', mark: '#5f9e45', lines: 'tracks' },
  sand: { fill: '#f3dfa8', mark: '#d8b468', lines: 'tracks' },
  sea: { fill: '#bfe9ff', mark: '#ffffff', lines: 'waves' },
  reef: { fill: '#ffd6c9', mark: '#ff9a8a', lines: 'waves' },
};

export const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const artURL = (name) => `${import.meta.env?.BASE_URL ?? './'}assets/shelf/${slug(name)}.webp`;
