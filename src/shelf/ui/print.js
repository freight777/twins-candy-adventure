// Printing (§10): mazes and hidden pictures are black line art in SVG, so they print one page per sheet of Letter paper, a hidden
// picture with its list of things to find underneath. Sticker pages do not print. The grown-up corner asks for "this page" (the
// Keep going page) or "a 10-page book".
import { renderMaze, el } from '../maze/render.js';
import { renderScene, loadSprites, useOf } from '../ispy/render.js';

/** sheets: [{ kind: 'maze', page } | { kind: 'ispy', scene, theme }]; opens the device's print dialog */
export async function printSheets(sheets) {
  document.querySelector('#print')?.remove();
  const root = document.createElement('div'); root.id = 'print'; document.body.appendChild(root);
  for (const s of sheets) {
    const sheet = document.createElement('section'); sheet.className = 'print-sheet'; root.appendChild(sheet);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); sheet.appendChild(svg);
    if (s.kind === 'maze') renderMaze(svg, s.page, { mini: true, print: true });
    else {
      await loadSprites(s.theme);
      renderScene(svg, s.scene, 'line', { mini: true });
      const tray = document.createElement('div'); tray.className = 'print-tray'; sheet.appendChild(tray);
      for (const e of s.scene.tray) {
        const item = document.createElement('span'), pic = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); pic.setAttribute('viewBox', '-36 -36 72 72');
        useOf('line', e.id, pic); item.append(pic, `${e.count > 1 ? e.count + ' ' : ''}${e.word}`); tray.appendChild(item);
      }
    }
  }
  const done = () => { root.remove(); removeEventListener('afterprint', done); };
  addEventListener('afterprint', done);
  setTimeout(() => window.print(), 300);                                           // let the line art settle first
}
export { el };
