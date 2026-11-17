// The books on the shelf. Phase 1: four maze books, one per theme. Hidden-picture and sticker books join in Phases 2 and 3.
import { THEMES } from './themes.js';

export const BOOKS = ['gameday', 'cars', 'dinosaurs', 'ocean'].map((t) => ({
  id: `maze-${t}`, type: 'maze', theme: t, title: `${THEMES[t].title} Mazes`, pages: 24, cover: THEMES[t].hero,
}));
export const bookById = (id) => BOOKS.find((b) => b.id === id) || null;
export { THEMES };
