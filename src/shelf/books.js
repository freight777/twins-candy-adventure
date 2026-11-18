// The books on the shelf, one plank per kind: mazes, hidden pictures (black-and-white or colour, his choice) and sticker by letter,
// four themes each, plus the Sticker Album at the end of the sticker plank.
import { THEMES } from './themes.js';

const THEME_IDS = ['gameday', 'cars', 'dinosaurs', 'ocean'];
export const KINDS = [
  { type: 'maze', title: 'Mazes' },
  { type: 'ispy', title: 'Hidden Pictures' },
  { type: 'sticker', title: 'Sticker by Letter' },
];
export const BOOKS = KINDS.flatMap(({ type, title }) => THEME_IDS.map((t) => ({
  id: `${type}-${t}`, type, theme: t, title: `${THEMES[t].title} ${title}`, pages: 24, cover: THEMES[t].hero,
})));
export const bookById = (id) => BOOKS.find((b) => b.id === id) || null;
export { THEMES };
