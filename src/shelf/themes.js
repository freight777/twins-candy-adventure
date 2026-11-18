// Puzzle Shelf themes are data (§8): a new theme is one entry here plus its pictures (tools/fetch-art.mjs fetches every Fluent
// Emoji 3D name listed: hero, goal, decor and the maze shapes). A maze page is either a plain rectangle drawn in one of the
// theme's `mats` (a field, a court, a road…) or a shape: the outline of one of `shapes`, cut from the picture's silhouette.
// A hidden-picture page uses `ispy` (OpenMoji codes, line and colour, built by tools/build-art.mjs) on one of the theme's `sets`.
export const THEMES = {
  gameday: {
    id: 'gameday', title: 'Game Day', cover: ['#ff8a3d', '#ffd166'], line: 'Get the ball to the goal!',
    hero: 'Basketball', goal: 'Goal net',
    decor: ['Soccer ball', 'Baseball', 'American football', 'Tennis', 'Volleyball', 'Trophy', 'Sports medal', 'Running shoe', 'Megaphone', 'Popcorn', 'Flying disc', 'Ice hockey'],
    mats: ['field', 'court', 'pitch', 'rink'],
    shapes: ['Basketball', 'Soccer ball', 'Trophy', 'American football', 'Running shirt', 'Sports medal'],
    stickers: ['Soccer ball', 'Basketball', 'American football', 'Baseball', 'Trophy', 'Sports medal', 'Running shoe', 'Eagle', 'Tiger', 'Bear', 'Racing car', 'Ice hockey', 'Tennis', 'Volleyball', 'Boxing glove', 'Goal net'],          // sticker-by-letter pictures (tools/build-stickers.mjs)
    // hidden pictures: OpenMoji codes (tools/build-art.mjs), each with the word in the tray when the annotation needs shortening;
    // odd things in odd places are the point (a toothbrush in a stadium). sets = the backdrops in ispy/sets.js
    ispy: '26BD:soccer_ball 26BE:baseball 1F94E:softball 1F3C0:basketball 1F3D0:volleyball 1F3C8:football 1F3BE:tennis_ball 1F94F:frisbee 1F3B3:bowling 1F3D2:hockey_stick 1F3D3:paddle 1F3F8:badminton 1F94A:boxing_glove 1F945:goal 26F3:golf_flag 26F8:ice_skate 1F3A3:fishing_rod 1F93F:mask 1F3BD:jersey 1F3BF:skis 1F6F7:sled 1F94C:curling_stone 1F94D:lacrosse 1F3C6:trophy 1F3C5:medal 1F3AF:target 1FA80:yo-yo 1FA81:kite 1F3B1:eight_ball 1F3AE:game_pad 1F3B2:dice 1F9E9:puzzle 1F9F8:teddy 1FA85:pinata 1F45F:sneaker 1F9E2:cap 1F4E3:megaphone 23F1:stopwatch 1F37F:popcorn 1F32D:hot_dog 1F964:cup 1F9E6:socks 1F455:t-shirt 1F392:backpack 1F6B2:bike 1F6F9:skateboard 1F6FC:roller_skate 1F6F4:scooter 1F4F7:camera 1F941:drum 1F3BA:trumpet 1FAA5:toothbrush 1F355:pizza 1F34C:banana 1F34E:apple 1F9FD:sponge 1FAA3:bucket 1F9F9:broom 1F955:carrot 1F95E:pancakes 1F36D:lollipop 1F9C1:cupcake 1F369:doughnut 1F366:ice_cream 1F388:balloon 1F381:present 1F4A1:light_bulb 1F451:crown',
    sets: ['stadium', 'gym'],
  },
  cars: {
    id: 'cars', title: 'Cars & Trucks', cover: ['#3a86ff', '#8ecae6'], line: 'Drive to the finish flag!',
    hero: 'Racing car', goal: 'Chequered flag',
    decor: ['Automobile', 'Taxi', 'Bus', 'Fire engine', 'Police car', 'Tractor', 'Fuel pump', 'Vertical traffic light', 'Construction', 'Delivery truck', 'Motor scooter', 'Wrench'],
    mats: ['road', 'carpark', 'dirt'],
    shapes: ['Racing car', 'Bus', 'Articulated lorry', 'Fire engine', 'Tractor', 'Construction'],
    stickers: ['Automobile', 'Racing car', 'Fire engine', 'Police car', 'Bus', 'Tractor', 'Delivery truck', 'Articulated lorry', 'Pickup truck', 'Sport utility vehicle', 'Motorcycle', 'Ambulance', 'Taxi', 'Locomotive', 'Helicopter', 'Airplane'],          // sticker-by-letter pictures (tools/build-stickers.mjs)
    ispy: '1F682:train 1F683:train_car 1F68A:tram 1F68C:bus 1F690:minibus 1F691:ambulance 1F692:fire_truck 1F693:police_car 1F695:taxi 1F697:car 1F699:jeep 1F6FB:pickup 1F69A:truck 1F69B:big_truck 1F69C:tractor 1F3CE:race_car 1F3CD:motorbike 1F6F5:moped 1F6B2:bike 1F6F4:scooter 1F6F9:skateboard 1F68F:bus_stop 26FD:gas_pump 1F6DE:wheel 1F6A8:siren 1F6A6:traffic_light 1F6D1:stop_sign 1F6A7:roadwork_sign 2708:airplane 1FA82:parachute 1F681:helicopter 1F680:rocket 1F6F8:UFO 1F6F0:satellite 1F528:hammer 1F527:wrench 1FA9B:screwdriver 1F529:bolt 2699:gear 1F9F0:toolbox 1F9F2:magnet 1FA9C:ladder 1FA8F:shovel 1F3C1:race_flag 1F6A9:flag 1F526:flashlight 1F9EF:extinguisher 1FAA3:bucket 1F9FD:sponge 1F9FA:basket 1F355:pizza 1F34C:banana 1F9F8:teddy 1FA81:kite 1F388:balloon 1F95A:egg 1F453:glasses 1F9E6:socks 1F45F:sneaker 1F9E2:cap 1F392:backpack 1F4F7:camera 1F3B8:guitar 1F381:present 1FAA5:toothbrush 1F36D:lollipop 1F34E:apple 1F4A1:light_bulb',
    sets: ['street', 'garage'],
  },
  dinosaurs: {
    id: 'dinosaurs', title: 'Dinosaurs', cover: ['#4caf50', '#c5e17a'], line: 'Help the dinosaur find its egg!',
    hero: 'T-rex', goal: 'Egg',
    decor: ['Sauropod', 'Volcano', 'Palm tree', 'Bone', 'Footprints', 'Lizard', 'Herb', 'Rock', 'Spiral shell', 'Evergreen tree', 'Mushroom', 'Leaf fluttering in wind'],
    mats: ['jungle', 'sand'],
    shapes: ['Sauropod', 'T-rex', 'Egg', 'Volcano'],                         // footprints and bone were tried: too thin, or in two pieces
    stickers: ['T-rex', 'Sauropod', 'Dragon', 'Crocodile', 'Turtle', 'Lizard', 'Snake', 'Egg', 'Volcano', 'Palm tree', 'Mushroom', 'Cactus', 'Evergreen tree', 'Hatching chick', 'Bone', 'Dragon face'],          // sticker-by-letter pictures (tools/build-stickers.mjs)
    ispy: '1F995:long-neck 1F996:T-rex 1F40A:crocodile 1F422:turtle 1F98E:lizard 1F40D:snake 1F409:dragon 1F331:sprout 1F332:pine_tree 1F333:tree 1F334:palm_tree 1F335:cactus 1F33F:herb 1F340:clover 1F341:maple_leaf 1F343:leaf 1FABA:nest 1F344:mushroom 1F30B:volcano 26F0:mountain 1F95A:egg 1F9B4:bone 1F463:footprints 1FAA8:rock 1FAB5:log 1F98B:butterfly 1F41D:bee 1F40C:snail 1F41E:ladybug 1F997:cricket 1F426:bird 1F989:owl 1F9A3:mammoth 1F98F:rhino 1F418:elephant 1F992:giraffe 1F412:monkey 1F98D:gorilla 1FA8F:shovel 1FA9C:ladder 1F9F0:toolbox 1F50D:magnifier 1F526:flashlight 1FAA3:bucket 1F9FA:basket 1F34C:banana 1F34D:pineapple 1F965:coconut 1F349:watermelon 1F347:grapes 1F353:strawberry 1F955:carrot 1FAA5:toothbrush 1F355:pizza 1F9F8:teddy 1F45F:sneaker 1F9E2:cap 1F3C0:basketball 1F381:present 1F4A1:light_bulb 1FA81:kite 1F388:balloon 1F9E6:socks 1F366:ice_cream 1F4F7:camera 1F3B8:guitar',
    sets: ['jungle', 'volcano'],
  },
  ocean: {
    id: 'ocean', title: 'Ocean', cover: ['#0096c7', '#90e0ef'], line: 'Swim to the treasure!',
    hero: 'Tropical fish', goal: 'Gem stone',
    decor: ['Spiral shell', 'Crab', 'Octopus', 'Coral', 'Jellyfish', 'Seal', 'Dolphin', 'Spouting whale', 'Shark', 'Lobster', 'Blowfish', 'Anchor'],
    mats: ['sea', 'reef'],
    shapes: ['Spouting whale', 'Turtle', 'Tropical fish', 'Octopus', 'Dolphin', 'Crab'],
    stickers: ['Dolphin', 'Shark', 'Spouting whale', 'Whale', 'Octopus', 'Crab', 'Tropical fish', 'Blowfish', 'Turtle', 'Seal', 'Jellyfish', 'Spiral shell', 'Lobster', 'Squid', 'Sailboat', 'Anchor'],          // sticker-by-letter pictures (tools/build-stickers.mjs)
    ispy: '1F433:whale 1F42C:dolphin 1FACD:orca 1F9AD:seal 1F420:fish 1F421:puffer_fish 1F988:shark 1F419:octopus 1F41A:shell 1FAB8:coral 1FABC:jellyfish 1F980:crab 1F99E:lobster 1F990:shrimp 1F991:squid 1F9AA:oyster 1F422:turtle 1F427:penguin 1F9A6:otter 2693:anchor 1F6DF:life_ring 26F5:sailboat 1F6F6:canoe 1F6A4:speedboat 1F6E5:motor_boat 1F6A2:ship 1F6D9:lighthouse 1F93F:mask 1F3A3:fishing_rod 1F3D6:beach 1F3DD:island 1F48E:gem 1F451:crown 1F48D:ring 1FA99:coin 1F5DD:key 1F9ED:compass 1F52D:telescope 1F30A:wave 1F334:palm_tree 1FAA3:bucket 1F9FD:sponge 1FAA2:knot 1F9F2:magnet 1F381:present 1FAA5:toothbrush 1F355:pizza 1F34C:banana 1F9F8:teddy 1F45F:sneaker 1F3C0:basketball 1F388:balloon 1F9E6:socks 1F3B8:guitar 1F34E:apple 1F36D:lollipop 1F95A:egg 1F4A1:light_bulb 1FA81:kite 1F9E2:cap 1F4F7:camera 1F366:ice_cream 1F369:doughnut 1F3BA:trumpet 1F941:drum',
    sets: ['reef', 'shipwreck'],
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

/** a theme's hidden-picture objects: [{ hex, word }] (underscores in the theme file are spaces) */
export const ispyObjects = (t) => THEMES[t].ispy.split(/\s+/).map((e) => { const [hex, w] = e.split(':'); return { hex, word: w ? w.replace(/_/g, ' ') : null }; });
