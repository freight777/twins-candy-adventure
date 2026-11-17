// The books on the shelf, and the themes they are drawn in. Themes are data (§8). Phase 0 ships one book: Game Day Mazes.
export const THEMES = {
  gameday: { id: 'gameday', title: 'Game Day', hero: '\u{1F3C0}', goal: '\u{1F945}', cover: ['#ff8a3d', '#ffd166'], line: 'Get the ball to the goal!' },
};

export const BOOKS = [
  { id: 'maze-gameday', type: 'maze', theme: 'gameday', title: 'Game Day Mazes', pages: 24, cover: '\u{1F3C0}' },
];
export const bookById = (id) => BOOKS.find((b) => b.id === id) || null;
