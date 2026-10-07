// Bedtime mode (#50), switched on by a grown-up (progress page or Candy's menu): softer colours (through the colour-grade shader,
// not a CSS filter on the canvas, which would cost a full-screen compositing pass every frame on iOS), the music at half
// volume, no questions, and after 20 minutes one gentle "It's getting late. Time for sleep soon!". Nothing a child is doing is
// ever interrupted. applyBedtime() can be called again after the setting changes: turning it off restores colours and music.
import { settings } from '../learn/profile.js';
import { getMusicLevel, setMusicLevel, voice } from '../audio.js';

const grades = new Map();                    // grade pass -> its own saturation
let on = false, musicBefore = null, timer = 0;
/** the pipeline hands over its colour-grade pass; bedtime lowers its saturation while on */
export function registerGrade(pass) {
  if (!pass?.uniforms?.sat) return;
  if (!grades.has(pass)) grades.set(pass, pass.uniforms.sat.value); paint(pass);
}
function paint(pass) { pass.uniforms.sat.value = grades.get(pass) * (on ? .8 : 1); }

export function applyBedtime() {
  const want = !!settings.bedtime;
  if (want === on) return;
  on = want;
  document.documentElement.classList.toggle('bedtime', on);
  grades.forEach((_, p) => paint(p));
  if (on) {
    musicBefore = getMusicLevel(); setMusicLevel(musicBefore * .5);
    timer = setTimeout(() => voice('bedtime_soon', { priority: 1 }), 20 * 60 * 1000);
  } else {
    if (musicBefore !== null) setMusicLevel(musicBefore);
    musicBefore = null; clearTimeout(timer);
  }
}
