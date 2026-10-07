// Fluent Emoji 3D pictures (MIT, Microsoft; fetched by tools/fluent-emoji.mjs into public/emoji/). Every emoji the games put in
// the page is swapped for its picture as it appears (a MutationObserver), so bubbles, cards, quiz choices, the HUD and the
// sticker book look the same on every iPad. Emoji drawn into 3D textures use the pictures too (util.emojiTex).
import LIST from './fluent-list.json';

const HAVE = new Set(LIST), BASE = `${import.meta.env.BASE_URL}emoji/`;
const EMOJI = /\p{Extended_Pictographic}(️|‍\p{Extended_Pictographic}️?|‍[♀♂]️?|[\u{1F3FB}-\u{1F3FF}])*/gu;
export const fluentKey = (s) => [...s].map((c) => c.codePointAt(0)).filter((c) => c !== 0xfe0f).map((c) => c.toString(16)).join('-');
/** the picture's URL for an emoji, or null if there isn't one */
export const fluentURL = (e) => { const k = fluentKey(e); return HAVE.has(k) ? BASE + k + '.webp' : null; };

const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'OPTION', 'TITLE']);
function convertText(t) {
  const s = t.nodeValue; if (!s || !EMOJI.test(s)) return; EMOJI.lastIndex = 0;
  const p = t.parentNode; if (!p || SKIP.has(p.nodeName) || p.closest('svg, [data-nofluent]')) return;
  const frag = document.createDocumentFragment(); let i = 0, any = false;
  for (const m of s.matchAll(EMOJI)) {
    const url = fluentURL(m[0]); if (!url) continue;
    any = true; if (m.index > i) frag.append(s.slice(i, m.index));
    const img = document.createElement('img'); img.className = 'fe'; img.src = url; img.alt = m[0]; img.draggable = false; frag.append(img);
    i = m.index + m[0].length;
  }
  if (!any) return;
  if (i < s.length) frag.append(s.slice(i));
  p.replaceChild(frag, t);
}
function convertTree(root) {
  if (root.nodeType === 3) return convertText(root);
  if (root.nodeType !== 1 || SKIP.has(root.nodeName)) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), list = [];
  while (w.nextNode()) list.push(w.currentNode);
  list.forEach(convertText);
}
let started = false;
/** swap emoji for pictures in the page now and whenever text changes */
export function fluentPage() {
  if (started || typeof document === 'undefined') return; started = true;
  const go = () => {
    convertTree(document.body);
    new MutationObserver((ms) => ms.forEach((m) => { if (m.type === 'characterData') convertText(m.target); else m.addedNodes.forEach(convertTree); }))
      .observe(document.body, { childList: true, subtree: true, characterData: true });
  };
  if (document.body) go(); else addEventListener('DOMContentLoaded', go);
}
