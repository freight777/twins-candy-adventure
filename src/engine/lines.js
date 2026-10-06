// Every line the games speak, keyed by id. tools/voice-bank.mjs renders each one to public/voice/<id>.mp3 with Kokoro-82M
// (Apache-2.0, runs at build time on the computer; nothing is ever sent anywhere). The games play the clip when it exists
// and fall back to the device's own voice when it doesn't, so a new line works immediately and sounds great after a render.
// Pure data, no imports: the build tool reads it too.
import { WORDS } from '../learn/words.js';
import { UNITS, SOUND_TEXT } from '../learn/code.js';

/** speaker -> [Kokoro voice, speed]. Different timbres, not just pitches. */
export const VOICES = {
  narrator: ['af_heart', .95], counter: ['af_heart', 1], cat: ['af_nicole', .95], queen: ['af_bella', .92], king: ['bm_george', .88],
  uni: ['af_kore', 1], sparkle: ['af_aoede', 1.02], rainbow: ['af_sarah', 1], cloud: ['af_nova', .9], rain: ['bf_isabella', .95],
  princess: ['af_aoede', .95], mom: ['bf_emma', .95], dad: ['am_michael', .95], announcer: ['am_michael', 1],
};
/** the same clean-up the speech queue applies (emoji and symbols out) */
export const cleanText = (t) => String(t ?? '').replace(/[^\p{L}\p{N}\s.,!?'-]/gu, ' ').replace(/\s+/g, ' ').trim();
const slug = (t) => cleanText(t).toLowerCase().replace(/'/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 32);
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36).slice(-5); }
/** the clip id for a sentence said by a speaker (so say('Time to go home!', 'king') finds king_time_to_go_home_xxxxx) */
export const storyId = (who, text) => `${who}_${slug(text)}_${hash(who + '|' + cleanText(text))}`;

export const LINES = {};
const add = (id, text, who = 'narrator', extra = {}) => { LINES[id] = { text, who, ...extra }; };
const story = (who, ...texts) => texts.forEach((t) => add(storyId(who, t), t, who));

// ---------------------------------------------------------------- numbers, colours, letters, sounds, words
const NUM = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
NUM.forEach((w, i) => add(`n_${i}`, w, 'counter'));
for (let i = 21; i <= 30; i++) add(`n_${i}`, i === 30 ? 'thirty' : `twenty-${NUM[i - 20]}`, 'counter');
['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink'].forEach((c) => add(`c_${c}`, c, 'counter'));
/** letter NAMES (CKLA Unit 6+) */
const NAME = { a: 'ay', b: 'bee', c: 'see', d: 'dee', e: 'ee', f: 'eff', g: 'jee', h: 'aitch', i: 'eye', j: 'jay', k: 'kay', l: 'el', m: 'em', n: 'en', o: 'oh', p: 'pee', q: 'cue', r: 'ar', s: 'ess', t: 'tee', u: 'you', v: 'vee', w: 'double you', x: 'ex', y: 'why', z: 'zee' };
Object.entries(NAME).forEach(([l, say]) => add(`name_${l}`, say, 'counter'));
/**
 * letter SOUNDS, rendered from phonemes (IPA) so the voice says /m/ and not "em". Continuants are held, stops get the
 * shortest possible vowel and are clipped (maxMs) — the way kindergarten teachers say them.
 */
const IPA = {
  m: 'mːːː', a: 'æː', t: 'tʰə', d: 'də', o: 'ɑː', c: 'kə', g: 'ɡə', i: 'ɪː', n: 'nːːː', h: 'hə', s: 'sːːː', f: 'fːːː', v: 'vːːː', z: 'zːːː', p: 'pʰə', e: 'ɛː',
  b: 'bə', l: 'lːːː', r: 'ɹːːː', u: 'ʌː', w: 'wə', j: 'dʒə', y: 'jə', x: 'ks', k: 'kə', ch: 'tʃə', sh: 'ʃːːː', th: 'θːːː', qu: 'kwə', ng: 'ŋːːː',
  ff: 'fːːː', ll: 'lːːː', ss: 'sːːː', zz: 'zːːː', ck: 'kə', ee: 'iːː', a_e: 'eɪ', i_e: 'aɪ', o_e: 'oʊ', u_e: 'juː',
};
const STOPS = new Set(['t', 'd', 'c', 'g', 'h', 'p', 'b', 'w', 'j', 'y', 'k', 'ch', 'qu', 'ck']);
Object.keys(SOUND_TEXT).forEach((s) => add(`snd_${s}`, SOUND_TEXT[s], 'counter', { ipa: IPA[s], maxMs: STOPS.has(s) ? 300 : 900 }));
/** every decodable word, every Tricky Word ("a" and "I" need phonemes so they aren't read as letter names) */
const WORD_IPA = { a: 'ə', I: 'aɪ' };
const words = new Set([...Object.values(WORDS).flat(), ...UNITS.flatMap((u) => u.tricky)]);
words.forEach((w) => add(`w_${w.toLowerCase() === 'i' ? 'I' : w}`, w, 'counter', WORD_IPA[w] ? { ipa: WORD_IPA[w] } : {}));

// ---------------------------------------------------------------- question phrases (reading #13, math #14, help #15)
const P = (id, text, who = 'narrator') => add(id, text, who);
P('which_starts_with', 'Which one starts with'); P('listen', 'Listen.'); P('which_word_says', 'Which word says'); P('read_the_word_tap_picture', 'Read the word. Then tap the picture!');
P('find_the_word', 'Find the word'); P('find_the_letter', 'Find the letter'); P('it_says', 'It says'); P('this_is', 'This is'); P('this_word_says', 'This word says'); P('the_word_says', 'The word says');
P('starts_with', 'starts with'); P('say_it_with_me', 'Say it with me!');
P('how_many', 'How many?'); P('how_many_tap_each', 'How many? Tap each one to count!'); P('which_has_more', 'Which has more?'); P('which_has_fewer', 'Which has fewer?');
P('is_more', 'is more!'); P('is_fewer', 'is fewer!'); P('story_has', 'The princess has'); P('story_brings', 'and the cook brings'); P('story_eats', 'She eats');
P('how_many_now', 'How many now?'); P('how_many_left', 'How many are left?'); P('plus', 'plus'); P('take_away', 'take away'); P('is', 'is'); P('and', 'and'); P('make', 'make');
P('and_how_many_more_make_ten', 'and how many more make ten?'); P('and_how_many', 'and how many?'); P('ten_and', 'Ten and'); P('which_is_farther', 'Which one went farther?');
P('yes_great', 'Yes! Great job!', 'counter'); P('you_got_it', 'You got it!', 'counter'); P('thats_it', "That's it!", 'counter'); P('hmm_try_again', 'Hmm, try again!', 'counter');
P('tap_the_one_that', 'Tap the one that is bouncing!', 'counter'); P('lets_count', "Let's count together!", 'counter'); P('well_done', 'Well done!', 'counter'); P('wow', 'Wow!', 'counter');
P('hold_to_go_home', 'Hold the house to go home!');

// ---------------------------------------------------------------- the story lines, exactly as the games pass them to say()/bubble()
// Candy Adventure
story('narrator', 'Something shiny in the water!', "Let's race to the castle!", "Adalyn's turn!", "Esmae's turn!", 'Wiggle wiggle... free!', 'Sparkle dice! Big roll!', 'Oops! Next time!',
  'Gumdrop jump!', 'Rainbow trail!', 'Sugar rush! Roll again!', 'Licorice slide!', 'Oh no, sticky molasses! Stuck for a turn.', 'Adalyn made it to the castle!', 'Esmae made it to the castle!',
  'You both made it!', 'Gumdrop jump! Bounce ahead three!', 'Rainbow trail! Zoom way ahead!', 'Licorice slide! Whee, back you go!', 'Sticky molasses! You get stuck for a turn!',
  'The castle!', 'Tap candy to eat it!', 'Yum yum!', 'Ready to play Candyland?', 'Giggle giggle giggle!', 'You did it!', 'Find the word.', 'Read the word. Then tap the picture!');
story('counter', 'Jackson!', 'Yes! Great job!', 'You got it!', 'Not quite. Try again!', ...NUM.slice(1, 7).map((w) => `${w}!`), ...NUM.slice(1, 7));
story('cat', 'Hello Adalyn and Esmae! Welcome to Candy Land!', "Let's play a game of Candyland!", 'Win, and you get a lifetime supply of candy!', 'First, you must become your characters!',
  'Tap Adalyn and Esmae to transform!', 'Adalyn is a Unicorn!', 'Esmae is a Mermaid!', 'The candy room awaits!', 'Walk through the big doors!');
story('king', 'Congratulations Adalyn and Esmae!', 'Time to go home!');
story('queen', 'Your candy is on its way to your house!', 'Wake up, sleepyheads!', 'Look! Candy, presents and toys are here!');
// Uni's Blast Awesome Adventures
story('uni', "Let's go on an adventure, Uni!", 'Rainbow slide!', 'Yummy ice cream!', 'The Rainbow Castle! We made it!', 'Whoa! Another unicorn named Uni!', "Hi! I'm Uni too! We have the same name!",
  'You did it, Uni! You made it to the castle!', 'Meet your twin at the castle first!', 'Wait for Uni to stop first!', 'You did it! Great job!', 'Uni!',
  'strawberry', 'vanilla', 'chocolate', 'mint', 'lemon', 'grape',
  ...['Sparkle', 'Rainbow', 'Cloud', 'Rain'].flatMap((n) => [`${n} joins the adventure!`, `Meet ${n} on the path first!`, `${n}!`]),
  "Welcome to Sparkle's Sparkle Studio! Tap the sparkle stars!", "Welcome to Rainbow's Music House! Tap every color to play music!", "Welcome to Cloud's Fluffy Hideout! Tap the glowing cloud to hop up!",
  "Welcome to Rain's Garden Room! Tap a flower pot to water it!", "Welcome to Uni's Ice Cream Parlor! Tap the flavors to build an ice cream!");
story('sparkle', "Hi Uni! I'm Sparkle! Let's sparkle together!", "Hi Esmae! I'm Sparkle! Let's shine together!", "Esmae! It's me, Lucy! We're twins!");
story('rainbow', "Hello Uni! I'm Rainbow! I love all the colors!", "Hello Esmae! I'm Rainbow! I love every color!");
story('cloud', "Hi Uni! I'm Cloud. I'm soft and fluffy!");
story('rain', "Hi Uni! I'm Rain. Splish splash!");
story('cat', "Hi Esmae! I'm Kitty! Let's swim and play!");
story('king', 'Welcome, brave Uni! You made it to the Rainbow Castle!', 'A lifetime supply of Uni treats!', 'Welcome to the Mermaid Palace, Esmae! Thank you for spreading so much love.',
  'A lifetime supply of hair clips, toys, mermaid pets, and candy!');
story('queen', 'Your kindness sparkles like magic! We have a gift for you!', 'You and your friends are so kind. We have gifts for you!');
// Mermaid Love Adventure
story('uni', "Let's go on a mermaid adventure, Esmae!", 'A dolphin ride!', 'A shiny pearl!', 'The Mermaid Palace! We made it!', 'Esmae!', 'Lucy!', 'The King!', 'The Queen!',
  ...['Sparkle', 'Rainbow', 'Kitty'].map((n) => `${n} joins the adventure!`), 'Kitty!');
// Uni & Mermaid cards: "Red!" / "Double red!"
['red', 'purple', 'yellow', 'blue', 'orange', 'green'].forEach((c) => story('counter', `${c}!`, `Double ${c}!`));
// Tony's Home Run Derby
story('counter', 'Play ball!', 'Home run!');
story('announcer', 'Play ball!', 'Home run!', 'Almost! Try again!', 'Great game!', 'Home run hero!', 'Here comes the pitch!', 'Left!', 'Right!');
// Princess Kitchen
story('princess', 'Try again!', 'Thank you!');
