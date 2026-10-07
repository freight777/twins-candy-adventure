// Bedtime mode (#50), switched on by a grown-up (progress page or Candy's menu): softer, warmer colours, the music at half
// volume, no questions, and after 20 minutes one gentle "It's getting late. Time for sleep soon!". Nothing a child is doing is
// ever interrupted.
import { settings } from '../learn/profile.js';
import { getMusicLevel, setMusicLevel, voice } from '../audio.js';

let applied = false;
export function applyBedtime() {
  if (applied || !settings.bedtime) return;
  applied = true;
  document.documentElement.classList.add('bedtime');
  setMusicLevel(getMusicLevel() * .5);
  setTimeout(() => voice('bedtime_soon', { priority: 1 }), 20 * 60 * 1000);
}
