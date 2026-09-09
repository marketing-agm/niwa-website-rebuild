// The events page: two views of one set of records, a category filter, and a
// map that answers to both. Everything here is progressive — the page is
// complete and readable before this file runs, which is why the grid ships
// visible and the list ships hidden rather than the other way round.
const root = document.querySelector<HTMLElement>('[data-events]');

if (root) {
  const $$ = <T extends Element = HTMLElement>(s: string) => Array.from(root.querySelectorAll<T>(s));
  const grid = root.querySelector<HTMLElement>('[data-ev-grid]');
  const list = root.querySelector<HTMLElement>('[data-ev-list]');
  const empty = root.querySelector<HTMLElement>('[data-ev-empty]');
  const items = () => $$('[data-ev-item]');
  const pins = $$<SVGGElement>('[data-ev-pin]');
  const VIEW_KEY = 'niwa:events:view';

  // ---- grid / list --------------------------------------------------------
  const setView = (view: string) => {
    if (!grid || !list) return;
    const listed = view === 'list';
    // Which view is chosen has to survive the filter hiding both of them, so it
    // is recorded rather than inferred from what is currently visible.
    list.dataset.evOn = String(listed);
    grid.hidden = listed;
    list.hidden = !listed;
    $$<HTMLButtonElement>('[data-ev-view]').forEach((b) => {
      const on = b.dataset.evView === view;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', String(on));
    });
    try { localStorage.setItem(VIEW_KEY, view); } catch { /* private mode */ }
  };
  $$<HTMLButtonElement>('[data-ev-view]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.evView!)));
  try {
    const saved = localStorage.getItem(VIEW_KEY);
    if (saved === 'list' || saved === 'grid') setView(saved);
  } catch { /* private mode */ }

  // ---- category filter ----------------------------------------------------
  // Hidden with the hidden attribute rather than a class, so a filtered-out
  // event leaves the accessibility tree along with the layout.
  let category = 'all';
  const apply = () => {
    let shown = 0;
    for (const el of items()) {
      const on = category === 'all' || el.dataset.evCatOf === category;
      el.hidden = !on;
      if (on) shown++;
    }
    // A day heading with nothing under it is a heading for nothing.
    for (const day of $$('[data-ev-day]')) {
      day.hidden = !Array.from(day.querySelectorAll<HTMLElement>('[data-ev-item]')).some((e) => !e.hidden);
    }
    // Both views hold every record, so `shown` counts each event twice — which
    // is fine, because all that is asked of it is whether it is zero.
    if (empty) empty.hidden = shown > 0;
    if (grid && list) {
      const listed = list.dataset.evOn === 'true';
      grid.hidden = shown === 0 || listed;
      list.hidden = shown === 0 || !listed;
    }
    // A pin whose events are all filtered out goes quiet rather than vanishing:
    // the venue is still there, it just has nothing on in this category.
    for (const pin of pins) {
      const ids = (pin.dataset.evPinIds ?? '').split(' ').filter(Boolean);
      const live = ids.some((id) => root.querySelector<HTMLElement>(`[data-ev-item="${CSS.escape(id)}"]:not([hidden])`));
      pin.classList.toggle('is-out', !live);
    }
  };
  $$<HTMLButtonElement>('[data-ev-cat]').forEach((b) => b.addEventListener('click', () => {
    category = b.dataset.evCat!;
    $$<HTMLButtonElement>('[data-ev-cat]').forEach((o) => {
      const on = o === b;
      o.classList.toggle('is-on', on);
      o.setAttribute('aria-pressed', String(on));
    });
    apply();
  }));

  // ---- the map answers to the cards, and the cards to the map -------------
  const light = (venue: string | null) => {
    for (const el of items()) el.classList.toggle('is-lit', !!venue && el.dataset.evVenue === venue);
    for (const p of pins) p.classList.toggle('is-lit', !!venue && p.dataset.evPin === venue);
  };
  for (const el of items()) {
    el.addEventListener('mouseenter', () => light(el.dataset.evVenue ?? null));
    el.addEventListener('mouseleave', () => light(null));
    el.addEventListener('focusin', () => light(el.dataset.evVenue ?? null));
    el.addEventListener('focusout', () => light(null));
  }
  for (const pin of pins) {
    const venue = pin.dataset.evPin ?? null;
    pin.addEventListener('mouseenter', () => light(venue));
    pin.addEventListener('mouseleave', () => light(null));
    pin.addEventListener('focus', () => light(venue));
    pin.addEventListener('blur', () => light(null));
    const jump = () => {
      const target = items().find((el) => el.dataset.evVenue === venue && !el.hidden);
      if (!target) return;
      light(venue);
      // The page scroller is Lenis on desktop; scrollIntoView is what it wraps,
      // and 'center' keeps the card clear of the fixed nav either way.
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
    pin.addEventListener('click', jump);
    pin.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); jump(); }
    });
  }
}
