// Draws a question's concrete picture (q.show) into a container, IM/ADM style:
//   { frame: 5|10, dots, extra, flashMs }  five- or ten-frame filled top row first, left to right (+ loose dots beside it)
//   { objects: n | [a, b], scatter, remove } one or two groups of tappable objects; `remove` of them walk away
//   { groups: [a, b] }                      two groups to compare (each group is a tap target)
//   { bond: [whole, part] }                 a number bond with one part missing
// Returns handles the quiz uses to count along (scaffolds) and to make objects tap-countable.
export function renderShow(el, show = {}, { icon = '\u{1F9C1}', iconAlt = '\u{1F36A}' } = {}) {
  el.innerHTML = ''; el.className = 'show';
  const make = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const out = { cells: [], dots: [], empties: [], loose: [], objs: [], groupObjs: [[], []], groups: [], bond: null, frame: null };
  if (show.frame) {
    const f = make('div', `frame f${show.frame}`); out.frame = f;
    for (let i = 0; i < show.frame; i++) { const c = make('i', 'cell' + (i < show.dots ? ' dot' : '')); c.style.animationDelay = `${i * 40}ms`; f.appendChild(c); out.cells.push(c); (i < show.dots ? out.dots : out.empties).push(c); }
    el.appendChild(f);
    if (show.extra) { const loose = make('div', 'loose'); for (let i = 0; i < show.extra; i++) { const c = make('i', 'cell dot'); loose.appendChild(c); out.loose.push(c); } el.appendChild(loose); }
    if (show.flashMs) setTimeout(() => f.classList.add('hide'), show.flashMs);
  }
  if (show.objects != null) {
    const groups = Array.isArray(show.objects) ? show.objects : [show.objects];
    groups.forEach((count, gi) => {
      if (gi) el.appendChild(make('span', 'plus', '+'));
      const g = make('div', 'group' + (show.scatter ? ' scatter' : ''));
      for (let i = 0; i < count; i++) {
        const b = make('button', 'obj', gi ? iconAlt : icon); b.type = 'button';
        if (show.scatter) b.style.setProperty('--r', `${Math.random() * 40 - 20}deg`);
        g.appendChild(b); out.objs.push(b); out.groupObjs[gi].push(b);
      }
      el.appendChild(g);
    });
    if (show.remove) setTimeout(() => out.objs.slice(-show.remove).forEach((b) => b.classList.add('gone')), 1100);
  }
  if (show.groups) show.groups.forEach((count, gi) => {
    const g = make('button', 'group pickable'); g.type = 'button'; g.dataset.group = gi;
    for (let i = 0; i < count; i++) { const o = make('span', 'obj', gi ? iconAlt : icon); g.appendChild(o); out.groupObjs[gi].push(o); }
    el.appendChild(g); out.groups.push(g);
  });
  if (show.bond) {
    const [whole, part] = show.bond, b = make('div', 'bond');
    b.append(make('div', 'bw readable', whole), make('div', 'bl'), make('div', 'bp readable', part), make('div', 'bp missing readable', '?'));
    el.appendChild(b); out.bond = b;
  }
  /** each first tap on an object counts up: cb(k, element) */
  out.countTap = (cb) => {
    let k = 0;
    out.objs.forEach((b) => b.addEventListener('pointerdown', () => { if (b.classList.contains('counted') || b.classList.contains('gone')) return; b.classList.add('counted'); cb(++k, b); }));
  };
  return out;
}
