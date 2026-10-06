// The one quiz every game uses: a card with the question's picture (big glyph, equation, frames/objects), three big
// choices and a "hear it again" button. Errorless (WWC foundational-reading / early-math practice): a miss gets a soft boop
// and "try again"; a second miss SHOWS the thinking (sounds lit and said one by one, objects counted aloud) and then the right
// answer glows; a child who stops gets the question again at 8 s and a bouncing answer at 15 s. Nothing red, no buzzer,
// and the quiz always ends on a correct tap. Resolves { correct: true, first, helped, fresh, misses }.
import './quiz.css';
import { voice, sayAsync, sfx } from '../audio.js';
import { renderShow } from '../learn/frame.js';
import { segments } from '../learn/reading.js';
import { item, settings, recordItem, recordSkill } from '../learn/profile.js';

let root = null;
const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));
function mount() {
  if (root) return root;
  root = document.createElement('div'); root.className = 'aeq hidden';
  root.innerHTML = `<div class="aeq-card"><div class="aeq-top"><div class="aeq-big"></div><div class="aeq-eq readable"></div><button class="aeq-say" type="button" aria-label="Hear it again">\u{1F50A}</button></div>
    <div class="aeq-tiles readable"></div><div class="aeq-show"></div><div class="aeq-choices"></div></div><div class="aeq-confetti"></div>`;
  document.body.appendChild(root);
  return root;
}
export const quizOpen = () => !!root && !root.classList.contains('hidden');

/**
 * Ask a question (from learn/reading.js or learn/math.js). opts: { who, icon, iconAlt (pictures for math objects) }.
 * Records nothing; use ask() for the usual "ask and remember".
 */
export function quiz(q, { who = 'adalyn', icon, iconAlt } = {}) {
  return new Promise((resolve) => {
    const R = mount(), $ = (s) => R.querySelector(s);
    const big = $('.aeq-big'), eq = $('.aeq-eq'), tiles = $('.aeq-tiles'), showEl = $('.aeq-show'), box = $('.aeq-choices'), sayBtn = $('.aeq-say');
    big.textContent = q.prompt.big ?? ''; big.className = 'aeq-big ' + (q.prompt.bigClass || ''); big.hidden = !q.prompt.big;
    eq.innerHTML = ''; eq.hidden = !q.equation; if (q.equation) q.equation.split(' ').forEach((tok) => { const s = document.createElement('span'); s.textContent = tok; eq.appendChild(s); });
    tiles.innerHTML = ''; box.innerHTML = '';
    const shown = q.show ? renderShow(showEl, q.show, { icon, iconAlt }) : (showEl.innerHTML = '', showEl.className = 'aeq-show', null);
    showEl.classList.add('aeq-show'); showEl.hidden = !q.show;
    R.classList.remove('hidden'); R.querySelector('.aeq-card').classList.remove('done'); void R.offsetWidth;

    let misses = 0, done = false, busy = false, idleT = 0;
    const speak = () => (q.prompt.voice ? voice(q.prompt.voice, { priority: 2, fallback: q.prompt.say }) : sayAsync(q.prompt.say, 'narrator', { priority: 2 }));
    // the choices: buttons, or the two picture groups themselves for "which has more?"
    const els = q.choices.map((ch, i) => {
      let el;
      if (ch.group != null && shown) el = shown.groups[ch.group];
      else {
        el = document.createElement('button'); el.type = 'button';
        el.className = 'aeq-choice' + (ch.text != null ? (ch.num != null ? ' num readable' : ' word readable') : ' pic');
        el.textContent = ch.text ?? ch.emoji; el.setAttribute('aria-label', ch.say || ch.text || 'choice');
        el.style.animationDelay = `${i * 70}ms`;
        box.appendChild(el);
      }
      el.addEventListener('click', () => choose(ch, el));
      return el;
    });
    const right = els[q.choices.findIndex((c) => c.correct)];
    // prompt fading: brand-new items show the answer softly from the start; seen-once items only after a miss
    const fresh = settings.scaffoldNew !== false && q.id && item(who, q.id).box === 0 && item(who, q.id).seen === 0;
    let helped = false; if (fresh) right.classList.add('hint');

    const armIdle = () => {
      clearTimeout(idleT);
      idleT = setTimeout(async () => {
        if (done || busy) return;
        sayBtn.classList.add('pulse'); await speak(); sayBtn.classList.remove('pulse');
        idleT = setTimeout(() => { if (done) return; right.classList.add('bounce'); helped = true; voice('tap_the_one_that', { priority: 1 }); }, 7000);
      }, 8000);
    };
    sayBtn.onclick = () => { if (!done) { speak(); armIdle(); } };
    if (q.tapToCount && shown) shown.countTap((k) => { voice(`n_${k}`, { priority: 2 }); armIdle(); });
    speak().then(armIdle);

    async function choose(ch, el) {
      if (done || busy || el.classList.contains('dim')) return;
      if (ch.correct) {
        done = true; clearTimeout(idleT);
        el.classList.add('right'); els.forEach((e) => e !== el && e.classList.add('fade'));
        sfx.chime(); confetti(misses === 0 && !helped ? 22 : 8);
        const first = misses === 0;
        await voice(first && !helped ? 'yes_great' : misses ? 'thats_it' : 'you_got_it', { priority: 2 });   // celebrate in proportion
        if (q.answerVoice || q.answerSay) await voice(q.answerVoice || [], { priority: 2, fallback: q.answerSay });
        await wait(.25);
        R.querySelector('.aeq-card').classList.add('done'); await wait(.25); R.classList.add('hidden');
        resolve({ correct: true, first, helped: helped || misses > 0, fresh: !!fresh, misses });
        return;
      }
      misses++; el.classList.add('dim'); sfx.soft(); clearTimeout(idleT);
      if (ch.voice && !q.choices.every((c) => c.num != null)) voice(ch.voice, { priority: 1, fallback: ch.say });   // name the picture/word she tapped
      if (misses === 1) {
        if (q.id && item(who, q.id).box <= 1) { right.classList.add('hint'); helped = true; }
        await voice('hmm_try_again', { priority: 1 });
        return armIdle();
      }
      busy = true; box.classList.add('busy');
      await scaffold(q.scaffold, shown, tiles);
      busy = false; box.classList.remove('busy');
      right.classList.add('glow'); helped = true; armIdle();
    }
  });
}

/** "show the thinking": blend the word's sounds, or count the objects, out loud */
async function scaffold(s, shown, tiles) {
  if (!s) return;
  const lightSay = async (el, id, gap = .18) => { el && el.classList.add('lit'); await voice(id, { priority: 2 }); await wait(gap); };
  if (s.word) {
    const parts = s.kind === 'show' ? [s.word] : segments(s.word);
    tiles.innerHTML = ''; const tl = parts.map((p) => { const t = document.createElement('span'); t.className = 'tile'; t.textContent = p.replace('_e', '-e'); tiles.appendChild(t); return t; });
    if (s.kind === 'show') { tl[0].classList.add('lit'); await voice(`w_${s.word}`, { priority: 2 }); return; }
    const list = s.kind === 'stretch' ? [0] : parts.map((_, i) => i);
    for (const i of list) await lightSay(tl[i], `snd_${parts[i]}`, .25);
    tl.forEach((t) => t.classList.add('lit')); await voice(`w_${s.word}`, { priority: 2 });
    return;
  }
  if (!shown) return;
  if (shown.frame) shown.frame.classList.remove('hide');
  const count = async (els, from = 0) => { let k = from; for (const el of els) { k++; el.classList.add('counted'); await voice(`n_${k}`, { priority: 2 }); await wait(.15); } return k; };
  switch (s.kind) {
    case 'count': await count(shown.dots.length ? shown.dots : shown.objs); break;
    case 'count-on': { shown.groupObjs[0].forEach((e) => e.classList.add('counted')); await voice(`n_${s.a}`, { priority: 2 }); await wait(.2); await count(shown.groupObjs[1], s.a); break; }
    case 'count-left': await count(shown.objs.filter((e) => !e.classList.contains('gone'))); break;
    case 'count-empty': await count(shown.empties); break;
    case 'count-groups': { await count(shown.groupObjs[0]); await wait(.3); shown.groupObjs[0].forEach((e) => e.classList.remove('counted')); await count(shown.groupObjs[1]); break; }
    case 'count-on-ten': { shown.dots.forEach((e) => e.classList.add('counted')); await voice('n_10', { priority: 2 }); await wait(.2); await count(shown.loose, 10); break; }
    case 'count-bond': { await voice([`n_${s.n}`, 'is', `n_${s.a}`, 'and'], { priority: 2 }); shown.bond?.querySelector('.missing')?.classList.add('lit'); break; }
    default: break;
  }
}

/** a little burst of confetti from the card */
function confetti(n) {
  const box = root.querySelector('.aeq-confetti'), bits = ['\u{1F389}', '⭐', '\u{1F496}', '✨', '\u{1F308}', '\u{1F36C}'];
  for (let i = 0; i < n; i++) {
    const b = document.createElement('span'); b.textContent = bits[i % bits.length];
    b.style.setProperty('--x', `${(Math.random() - .5) * 90}vw`); b.style.setProperty('--y', `${-30 - Math.random() * 50}vh`); b.style.setProperty('--r', `${(Math.random() - .5) * 720}deg`);
    b.style.animationDelay = `${Math.random() * .15}s`; box.appendChild(b); setTimeout(() => b.remove(), 1700);
  }
}

/**
 * ask and remember. The item: up a box when right first time (a brand-new item counts even though its answer glowed),
 * down a box after a miss. The child's level: only real first-try answers move it; brand-new items are neutral.
 */
export async function ask(q, who, opts = {}) {
  const r = await quiz(q, { who, ...opts }), clean = r.misses === 0;
  if (q.id) recordItem(who, q.id, clean, clean && (r.fresh || !r.helped));
  if (!r.fresh || !clean) recordSkill(who, q.strand || 'reading', clean, clean && !r.helped);
  return r;
}
