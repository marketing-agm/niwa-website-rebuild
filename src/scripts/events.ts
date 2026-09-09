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

  // ---- filters -------------------------------------------------------------
  // Two lenses on the same records: a category, chosen from the chip row, and a
  // place, chosen by tapping a pin. They are alternatives rather than a
  // compound — picking one clears the other — because a page that quietly has
  // both on is a page where the count stops making sense.
  //
  // Hidden with the hidden attribute rather than a class, so a filtered-out
  // event leaves the accessibility tree along with the layout.
  let category = 'all';
  let venueIds: Set<string> | null = null;
  /** Keys of pins that are chosen, so their labels stay up after the pointer leaves. */
  const chosen = new Set<string>();
  const apply = () => {
    let shown = 0;
    for (const el of items()) {
      const id = el.dataset.evItem!;
      const on = venueIds ? venueIds.has(id) : (category === 'all' || el.dataset.evCatOf === category);
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
    paintChips();
  };

  // ---- the chip row, including the one a pin puts there ----------------------
  const venueChip = root.querySelector<HTMLButtonElement>('[data-ev-venue-chip]');
  const venueName = root.querySelector<HTMLElement>('[data-ev-venue-name]');
  const venueN = root.querySelector<HTMLElement>('[data-ev-venue-n]');

  const paintChips = () => {
    for (const b of $$<HTMLButtonElement>('[data-ev-cat]')) {
      const on = !venueIds && b.dataset.evCat === category;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', String(on));
    }
    chosen.clear();
    for (const p of pins) {
      const on = !!venueIds && p.dataset.evPinIds === [...venueIds].join(' ');
      p.classList.toggle('is-on', on);
      p.setAttribute('aria-pressed', String(on));
      if (on && p.dataset.evPin) chosen.add(p.dataset.evPin);
    }
    for (const [k, l] of labels) l.classList.toggle('is-lit', chosen.has(k));
  };

  const clearVenue = () => {
    venueIds = null;
    if (venueChip) venueChip.hidden = true;
    apply();
  };
  venueChip?.addEventListener('click', clearVenue);

  /** True when a filter was applied; false when the tap cleared one. */
  const pickVenue = (pin: HTMLElement): boolean => {
    const ids = (pin.dataset.evPinIds ?? '').split(' ').filter(Boolean);
    if (!ids.length) return false;
    // Tapping the pin that is already chosen puts everything back.
    if (venueIds && [...venueIds].join(' ') === ids.join(' ')) { clearVenue(); return false; }
    venueIds = new Set(ids);
    category = 'all';
    const name = pin.dataset.evPinName ?? 'This venue';
    if (venueChip && venueName && venueN) {
      venueName.textContent = name;
      venueN.textContent = String(ids.length);
      venueChip.hidden = false;
      venueChip.setAttribute('aria-label', `Showing ${ids.length} event${ids.length === 1 ? '' : 's'} at ${name}. Clear this filter.`);
    }
    apply();
    return true;
  };
  $$<HTMLButtonElement>('[data-ev-cat]').forEach((b) => b.addEventListener('click', () => {
    category = b.dataset.evCat!;
    venueIds = null;
    if (venueChip) venueChip.hidden = true;
    apply();
  }));

  // ---- the map answers to the cards, and the cards to the map -------------
  //
  // Matched on event ids rather than venue names, because a pin can now stand
  // for several venues at once: the ones whose dots would otherwise overlap
  // are drawn as one. A pin owns a set of ids; a card belongs to whichever pin
  // owns its own.
  const idsOf = (pin: Element) => new Set((pin as HTMLElement).dataset.evPinIds?.split(' ').filter(Boolean) ?? []);
  const pinIds = new Map<Element, Set<string>>(pins.map((p) => [p, idsOf(p)]));
  const pinFor = (id: string) => pins.find((p) => pinIds.get(p)!.has(id)) ?? null;

  // Labels live in a layer of their own, drawn after every pin, and are matched
  // back to their pin by key. They were inside the pin and hoisted to the end
  // of the group on hover, which put them on top and broke every click: moving
  // a node out from under the cursor means the browser never completes one.
  const labels = new Map<string, Element>(
    $$('[data-ev-label]').map((l) => [(l as HTMLElement).dataset.evLabel!, l]),
  );
  const map = root.querySelector<SVGElement>('[data-ev-map]');
  const light = (pin: Element | null) => {
    const ids = pin ? pinIds.get(pin)! : null;
    const key = pin ? (pin as HTMLElement).dataset.evPin : null;
    // Touch has no hover, so the sand only moves on a tap unless it is told to.
    map?.classList.toggle('is-live', !!pin || chosen.size > 0);
    for (const el of items()) el.classList.toggle('is-lit', !!ids && ids.has(el.dataset.evItem!));
    for (const p of pins) p.classList.toggle('is-lit', p === pin);
    for (const [k, l] of labels) l.classList.toggle('is-lit', k === key || chosen.has(k));
  };

  for (const el of items()) {
    const mine = () => pinFor(el.dataset.evItem!);
    el.addEventListener('mouseenter', () => light(mine()));
    el.addEventListener('mouseleave', () => light(null));
    el.addEventListener('focusin', () => light(mine()));
    el.addEventListener('focusout', () => light(null));
  }

  for (const pin of pins) {
    pin.addEventListener('mouseenter', () => light(pin));
    pin.addEventListener('mouseleave', () => light(null));
    pin.addEventListener('focus', () => light(pin));
    pin.addEventListener('blur', () => light(null));
    const jump = () => {
      // Filter to this pin first, then go to what is left. Scrolling to one
      // card in a list of sixty answered "where is it" but not "what is on
      // there", which is the question a pin actually asks.
      //
      // Only on the way in, though. Tapping a chosen pin to clear it used to
      // scroll too, which pulled you off the map you were still looking at and
      // showed you the same sixty events you started with.
      if (!pickVenue(pin as HTMLElement)) return;
      const target = items().find((el) => !el.hidden);
      if (!target) return;
      // The page scroller is Lenis on desktop; scrollIntoView is what it wraps.
      // 'start' on the bar, not the card, so the chip that says what has just
      // been filtered is on screen with it.
      const bar = root.querySelector('.ev-bar') ?? target;
      bar.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    pin.addEventListener('click', jump);
    pin.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); jump(); }
    });
  }
}
