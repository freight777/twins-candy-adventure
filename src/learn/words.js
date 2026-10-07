// Decodable words by the CKLA unit in which every letter of the word has been taught (cumulative: Unit 5 may use 3-5).
export const WORDS = {
  3: ['am', 'at', 'mat', 'dad', 'mad', 'add', 'dot', 'cot', 'cat', 'mom', 'dog', 'got', 'dig', 'it', 'tag', 'tot'],
  4: ['an', 'in', 'is', 'if', 'on', 'hat', 'ham', 'hen', 'hip', 'hop', 'hot', 'sat', 'sad', 'sit', 'sip', 'fan', 'fat', 'fin', 'fit', 'fog', 'fed', 'van', 'vet', 'zip', 'zap', 'zag', 'pan', 'pat', 'pen', 'pet', 'pig', 'pin', 'pit', 'pot', 'pod', 'pop', 'ten', 'net', 'nap', 'nod', 'not', 'man', 'men', 'map', 'mop', 'met', 'gas', 'gap', 'tan', 'tap', 'tip', 'top'],
  5: ['up', 'us', 'hug', 'hum', 'hut', 'sun', 'fun', 'fix', 'fox', 'pup', 'nut', 'mud', 'mug', 'mix', 'bad', 'bag', 'bat', 'bed', 'beg', 'bet', 'bib', 'big', 'bin', 'bit', 'bug', 'bun', 'bus', 'but', 'lap', 'leg', 'let', 'lid', 'lip', 'lit', 'log', 'rag', 'ram', 'ran', 'rat', 'red', 'rib', 'rid', 'rig', 'rip', 'rod', 'rub', 'rug', 'run', 'wag', 'wet', 'wig', 'win', 'web', 'wed', 'job', 'jam', 'jet', 'jig', 'jog', 'jug', 'yam', 'yes', 'yet', 'yum', 'box', 'six', 'wax', 'ox', 'ax', 'kit', 'kid', 'tub', 'cub', 'cup', 'cut', 'gum', 'tug', 'sub', 'sum'],
  6: ['stop', 'flag', 'frog', 'drum', 'crab', 'clap', 'swim', 'spin', 'grin', 'trip', 'plum', 'slip', 'snap', 'step', 'skip', 'drip', 'flip', 'glad', 'grab', 'hand', 'jump', 'lamp', 'land', 'nest', 'pond', 'sand', 'tent', 'wind', 'milk', 'help', 'belt', 'gift', 'bump', 'dust', 'fast', 'just', 'melt', 'pink', 'rest', 'soft', 'went', 'best', 'bend', 'camp', 'desk', 'mask', 'vest', 'hunt', 'lift', 'list'],
  7: ['fish', 'dish', 'wish', 'ship', 'shop', 'shut', 'shed', 'chat', 'chin', 'chip', 'chop', 'rich', 'much', 'such', 'lunch', 'bunch', 'that', 'them', 'then', 'this', 'thin', 'bath', 'math', 'moth', 'path', 'with', 'thick', 'sing', 'ring', 'king', 'wing', 'long', 'song', 'bang', 'hang', 'quit', 'quiz', 'quack'],
  8: ['off', 'puff', 'bell', 'doll', 'hill', 'fill', 'well', 'kiss', 'mess', 'miss', 'buzz', 'fizz', 'jazz', 'back', 'duck', 'kick', 'lick', 'neck', 'pick', 'rock', 'sock', 'sick', 'lock', 'pack', 'tick'],
  10: ['bee', 'see', 'tree', 'feet', 'sleep', 'green', 'queen', 'cake', 'game', 'gate', 'lake', 'make', 'name', 'wave', 'bike', 'kite', 'like', 'time', 'nine', 'ride', 'bone', 'home', 'nose', 'rope', 'rose', 'cute', 'mule', 'tube', 'cube'],
};
/**
 * A picture for every word a 5-year-old would name the same way at a glance. Deliberately left out: pictures a child
 * would call something else (moth = butterfly, mop = broom, hen = chicken, jet = plane, jam = honey, king = crown...).
 */
export const PIC = {
  cat: '🐱', dog: '🐶', mom: '👩', dad: '👨',
  hat: '🎩', pig: '🐷', pen: '🖊️', van: '🚐', ten: '🔟', map: '🗺️',
  sun: '☀️', fox: '🦊', bus: '🚌', cup: '🥤', bed: '🛏️', bug: '🐛', web: '🕸️', log: '🪵', rat: '🐀', bat: '🦇', tub: '🛁', nut: '🥜', hut: '🛖', box: '📦', six: '6️⃣', ox: '🐂', mug: '☕', leg: '🦵', red: '🔴',
  frog: '🐸', crab: '🦀', drum: '🥁', flag: '🚩', gift: '🎁', tent: '⛺', hand: '✋', milk: '🥛',
  fish: '🐟', ship: '🚢', ring: '💍',
  duck: '🦆', sock: '🧦', bell: '🔔', rock: '🪨', lock: '🔒',
  bee: '🐝', tree: '🌳', cake: '🎂', kite: '🪁', bike: '🚲', nine: '9️⃣', bone: '🦴', home: '🏠', nose: '👃', rose: '🌹', rope: '🪢', cube: '🧊', green: '🟢',
};
