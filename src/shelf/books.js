// The books on the shelf, one plank per kind. Phase 2: four maze books and four hidden-picture books (each in black-and-white or
// colour, his choice). Sticker books join in Phase 3.
import { THEMES } from './themes.js';

const THEME_IDS = ['gameday', 'cars', 'dinosaurs', 'ocean'];
export const KINDS = [
  { type: 'maze', title: 'Mazes' },
  { type: 'ispy', title: 'Hidden Pictures' },
];
export const BOOKS = KINDS.flatMap(({ type, title }) => THEME_IDS.map((t) => ({
  id: `${type}-${t}`, type, theme: t, title: `${THEMES[t].title} ${title}`, pages: 24, cover: THEMES[t].hero,
})));
export const bookById = (id) => BOOKS.find((b) => b.id === id) || null;
export { THEMES };
