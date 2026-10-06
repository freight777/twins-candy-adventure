// The games menu. Offline support (the service worker) is added to every page by vite-plugin-pwa at build time.
import './engine/fonts.css';
import { holdGate } from './engine/gate.js';
// the grown-ups progress page: hold the gear for 2 seconds (kids mash; they don't hold still)
holdGate(document.getElementById('grownups'), () => { location.href = './progress.html'; });
