  // Year
  document.getElementById('yr').textContent = new Date().getFullYear();

  // Sticky nav border
  const nav = document.getElementById('nav');
  const onScroll = () => {
    if (window.scrollY > 8) nav.classList.add('scrolled');
    else nav.classList.remove('scrolled');
  };
  document.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Scrollspy: highlight the nav link for whichever section is in view, so the
  // bar doubles as a position indicator on a long single-page layout.
  (function () {
    const links = [...document.querySelectorAll('.nav-links a[href^="#"]:not(.nav-cta)')];
    const targets = links
      .map(a => ({ a, el: document.getElementById(a.getAttribute('href').slice(1)) }))
      .filter(t => t.el);
    if (!targets.length) return;

    let current = null;
    const setActive = (a) => {
      if (current === a) return;
      links.forEach(l => l.classList.remove('is-active'));
      if (a) a.classList.add('is-active');
      current = a;
    };

    const io = new IntersectionObserver((entries) => {
      // Pick the entry nearest the top of the viewport that's still on screen.
      const visible = entries.filter(e => e.isIntersecting);
      if (!visible.length) return;
      const best = visible.reduce((a, b) =>
        Math.abs(a.boundingClientRect.top) < Math.abs(b.boundingClientRect.top) ? a : b);
      const match = targets.find(t => t.el === best.target);
      if (match) setActive(match.a);
    }, { rootMargin: '-20% 0px -70% 0px', threshold: 0 });

    targets.forEach(t => io.observe(t.el));
    // Back at the very top, no section is "current".
    window.addEventListener('scroll', () => {
      if (window.scrollY < 80) setActive(null);
    }, { passive: true });
  })();

  // Mobile menu toggle
  (function () {
    const toggle = document.getElementById('nav-toggle');
    const panel = document.getElementById('nav-mobile');
    if (!toggle || !panel) return;
    const setOpen = (open) => {
      panel.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      document.body.classList.toggle('nav-open', open);
    };
    toggle.addEventListener('click', () => setOpen(!panel.classList.contains('is-open')));
    panel.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setOpen(false)));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && panel.classList.contains('is-open')) setOpen(false);
    });
    // Close if viewport grows past mobile breakpoint
    const mq = window.matchMedia('(min-width: 861px)');
    mq.addEventListener('change', (e) => { if (e.matches) setOpen(false); });
  })();

  // Reveal animations
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.reveal').forEach(el => io.observe(el));

  // ============== UNITS DATA & RENDERING ==============
  const UNITS = (window.__SITE__ && window.__SITE__.data.units) || [];

  const filters = { beds: 'all', avail: 'all' };
  let sortBy = 'price-asc';

  const PLAN_LABELS = {
    '1br': '1 BR · 1 BA',
    '2br2ba': '2 BR · 2 BA'
  };

  // ----- Conversion state: favorites (persisted), compare (session), budget
  const COMPARE_MAX = 3;
  let favorites = new Set();
  try { favorites = new Set(JSON.parse(localStorage.getItem('mc_favs') || '[]')); } catch (e) { favorites = new Set(); }
  const compareSet = new Set();
  let affordableMax = null; // null = no income entered

  function saveFavs() {
    try { localStorage.setItem('mc_favs', JSON.stringify([...favorites])); } catch (e) {}
  }
  // Unit numbers repeat across buildings — two Magnolia properties both have a
  // 307 — so identity is the uid, not the printed unit number. Falls back to id
  // for sites whose units.json predates multi-property support.
  const uidOf = (u) => String(u.uid || u.id);
  function unitById(uid) { return UNITS.find(u => uidOf(u) === String(uid)); }
  // More than one building in the list means the unit number alone is ambiguous
  // to a renter, so cards and the modal have to name the property.
  const MULTI_PROPERTY = new Set(UNITS.map(u => u.property).filter(Boolean)).size > 1;

  // Saved favourites persist across visits, so they outlive both the feed and
  // the id scheme: a home can lease and vanish, and favourites saved before
  // uids existed are keyed by bare unit number. Either way the id no longer
  // resolves — drop it, or the shortlist counter advertises homes the panel
  // can't show.
  (function pruneStaleFavs() {
    let dropped = false;
    favorites.forEach((key) => {
      if (!UNITS.some((u) => uidOf(u) === String(key))) { favorites.delete(key); dropped = true; }
    });
    if (dropped) saveFavs();
  })();

  // Advertised home counts come from the live unit data, never hardcoded copy —
  // availability is refreshed automatically, so any typed-in number goes stale.
  // Fills [data-unit-count] with the total and [data-unit-noun] with home/homes.
  function minRentOf(list) {
    const priced = list.filter((u) => u.rent != null).map((u) => u.rent);
    return priced.length ? Math.min.apply(null, priced) : null;
  }

  function syncUnitCounts() {
    // "N homes available" must count only what someone can actually move into;
    // the feed also carries units that are merely coming soon.
    const available = UNITS.filter((u) => u.availType === 'now');
    const n = available.length;
    document.querySelectorAll('[data-unit-count]').forEach((el) => { el.textContent = n; });
    document.querySelectorAll('[data-unit-noun]').forEach((el) => { el.textContent = n === 1 ? 'home' : 'homes'; });
    // "Showing X of N homes" counts everything the filters can surface.
    document.querySelectorAll('[data-unit-total]').forEach((el) => { el.textContent = UNITS.length; });
    // Advertised starting price, derived so it can't drift from the feed.
    const min = minRentOf(available.length ? available : UNITS);
    document.querySelectorAll('[data-unit-min-rent]').forEach((el) => {
      el.textContent = min == null ? 'Inquire' : '$' + min.toLocaleString();
    });
  }

  // The floor-plan panel quotes a "from $X" per layout, which drifts from the
  // feed exactly like the hero figure did — and on a page taking paid traffic a
  // stale price is a landing-page mismatch that costs Quality Score and can trip
  // Google's misrepresentation policy, not just a typo. The hero's overall
  // minimum is handled by [data-unit-min-rent] in syncUnitCounts(); this fills
  // the per-plan figures: [data-plan-from="<key>"] → "from $X" and
  // [data-plan-rate="<key>"] → "$X / mo".
  //
  // Scoped to move-in-ready units, matching syncUnitCounts() — advertising a
  // price you can only get by waiting for a coming-soon unit is the same
  // mismatch in a subtler form. A plan with nothing available says so rather
  // than quoting a price nobody can rent today.
  const asMoney = (n) => '$' + Number(n).toLocaleString();
  // Units carry a more specific key than the floor-plan tabs do ("2br2ba" vs
  // "2br"), so reduce to the bedroom-count prefix — same rule as planConfig().
  const planKeyOf = (plan) => {
    const m = String(plan || '').match(/^(studio|\d+br)/);
    return m ? m[1] : String(plan || '');
  };
  // The Rental terms panel quoted a hand-typed rent range that had drifted from
  // the feed — it advertised $1,395–$2,095 while nothing rented below $1,595.
  // Derive it, and derive the move-in estimate from the same numbers so the two
  // can never disagree with each other either.
  //   due at signing = first month + one month deposit + screening fee
  const SCREENING_FEE = 50;
  function syncRentalTerms() {
    const available = UNITS.filter((u) => u.availType === 'now');
    const scope = available.length ? available : UNITS;
    const rents = scope.map((u) => Number(u.rent)).filter((n) => Number.isFinite(n) && n > 0);
    if (!rents.length) return;
    const lo = Math.min(...rents), hi = Math.max(...rents);
    const range = (a, b) => (a === b ? asMoney(a) : asMoney(a) + ' – ' + asMoney(b));

    document.querySelectorAll('[data-terms-rent-range]').forEach((el) => {
      el.textContent = range(lo, hi);
    });
    document.querySelectorAll('[data-terms-due-range]').forEach((el) => {
      el.textContent = range(lo * 2 + SCREENING_FEE, hi * 2 + SCREENING_FEE);
    });
  }

  function syncPlanPricing() {
    const available = UNITS.filter((u) => u.availType === 'now');
    const scope = available.length ? available : UNITS;

    const lowestByPlan = new Map();
    scope.forEach((u) => {
      if (u.rent == null) return;
      const rent = Number(u.rent);
      if (!Number.isFinite(rent) || rent <= 0) return;
      const k = planKeyOf(u.plan);
      if (!lowestByPlan.has(k) || rent < lowestByPlan.get(k)) lowestByPlan.set(k, rent);
    });

    document.querySelectorAll('[data-plan-from]').forEach((el) => {
      const min = lowestByPlan.get(el.dataset.planFrom);
      el.textContent = min == null ? 'none available now' : 'from ' + asMoney(min);
    });
    document.querySelectorAll('[data-plan-rate]').forEach((el) => {
      const min = lowestByPlan.get(el.dataset.planRate);
      el.textContent = min == null ? 'None available now' : asMoney(min) + ' / mo';
    });
  }

  function toggleFav(id) {
    if (favorites.has(id)) favorites.delete(id);
    else favorites.add(id);
    saveFavs();
    renderUnits();
  }
  function toggleCompare(id) {
    if (compareSet.has(id)) compareSet.delete(id);
    else if (compareSet.size < COMPARE_MAX) compareSet.add(id);
    renderUnits();
  }

  // Honest scarcity: among "available now" units sharing a unit's plan + lowest
  // priced tier, flag when 2 or fewer remain. Returns a label string or null.
  function urgencyFor(unit) {
    if (unit.availType !== 'now' || unit.rent == null) return null;
    const samePlanNow = UNITS.filter(u => u.plan === unit.plan && u.availType === 'now' && u.rent != null);
    const minRent = Math.min.apply(null, samePlanNow.map(u => u.rent));
    if (unit.rent !== minRent) return null;
    const atMin = samePlanNow.filter(u => u.rent === minRent).length;
    if (atMin > 2) return null;
    return atMin === 1 ? 'Last one at this price' : 'Only ' + atMin + ' left at this price';
  }

  function getFilteredSortedUnits() {
    let list = UNITS.slice();
    if (filters.beds !== 'all') list = list.filter(u => u.beds === parseInt(filters.beds, 10));
    if (filters.avail !== 'all') list = list.filter(u => u.availType === filters.avail);

    const priceOf = u => (u.rent == null ? Infinity : u.rent);
    switch (sortBy) {
      case 'price-asc': list.sort((a, b) => priceOf(a) - priceOf(b)); break;
      case 'price-desc': list.sort((a, b) => (b.rent ?? -Infinity) - (a.rent ?? -Infinity)); break;
      case 'size-desc': list.sort((a, b) => b.sqft - a.sqft); break;
      case 'beds-asc': list.sort((a, b) => a.beds - b.beds || priceOf(a) - priceOf(b)); break;
    }
    return list;
  }

  function formatBedsLabel(beds) {
    if (beds === 0) return 'Studio';
    return beds === 1 ? '1 bed' : `${beds} beds`;
  }

  function unitCardHTML(unit, idx) {
    const bedsDisplay = unit.beds === 0 ? '—' : unit.beds;
    const featured = unit.featured ? '<span class="badge-featured">Featured</span>' : '';
    const featureTags = unit.features.map(f => `<li>${f}</li>`).join('');
    const availClass = unit.availType === 'soon' ? 'avail soon' : 'avail';
    const priceHTML = unit.rent == null
      ? `<div class="price price--inquire">Inquire</div>`
      : `<div class="price">$${unit.rent.toLocaleString()}<span>/mo</span></div>`;

    const isFaved = favorites.has(uidOf(unit));
    const isCmp = compareSet.has(uidOf(unit));
    let budgetClass = '';
    if (affordableMax != null && unit.rent != null) {
      budgetClass = unit.rent <= affordableMax ? ' fits-budget' : ' below-budget';
    }
    const budgetTag = (affordableMax != null && unit.rent != null && unit.rent <= affordableMax)
      ? '<span class="unit-budget-tag">Within budget</span>' : '';
    const urgency = urgencyFor(unit);
    const urgencyHTML = urgency
      ? `<span class="unit-urgency"><svg width="11" height="11" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"/></svg>${urgency}</span>`
      : '';
    const cls = 'unit-card' + (unit.featured ? ' is-featured' : '') + (isFaved ? ' is-faved' : '') + (isCmp ? ' is-compared' : '') + budgetClass;
    return `
      <article class="${cls}" style="animation-delay:${idx * 50}ms" data-unit-open="${uidOf(unit)}">
        <div class="unit-card-plan">
          <span class="unit-plan-label">${PLAN_LABELS[unit.plan]}</span>
          ${featured}
          <span class="unit-plan-placeholder">Floor Plan<br><em>Coming Soon</em></span>
        </div>
        <div class="unit-card-body">
          <div class="unit-card-head">
            <div>
              <button class="unit-card-num" type="button" data-unit-open="${uidOf(unit)}">Unit <span class="italic">${unit.id}</span><span class="sr-only"> — view details</span></button>
              <span class="unit-card-floor">${unit.floor}${MULTI_PROPERTY && unit.address ? ' · ' + unit.address : ''}</span>
            </div>
            <div class="unit-card-tools">
              <button class="unit-fav" type="button" data-fav="${uidOf(unit)}" aria-pressed="${isFaved}" aria-label="${(isFaved ? 'Remove Unit ' : 'Save Unit ') + unit.id + (MULTI_PROPERTY && unit.property ? ' at ' + unit.property : '') + (isFaved ? ' from saved homes' : '')}" title="Save home">
                <svg width="16" height="16" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>
              </button>
              <button class="unit-cmp" type="button" data-cmp="${uidOf(unit)}" aria-pressed="${isCmp}" aria-label="${(isCmp ? 'Remove Unit ' : 'Add Unit ') + unit.id + (MULTI_PROPERTY && unit.property ? ' at ' + unit.property : '') + (isCmp ? ' from comparison' : ' to comparison')}" title="Compare">vs</button>
            </div>
          </div>
          ${budgetTag}
          <div class="unit-card-specs">
            <div><strong>${bedsDisplay}</strong><span>${unit.beds === 0 ? 'studio' : (unit.beds === 1 ? 'bed' : 'beds')}</span></div>
            <div><strong>${unit.baths}</strong><span>${unit.baths === 1 ? 'bath' : 'baths'}</span></div>
            <div><strong>${unit.sqft.toLocaleString()}</strong><span>sqft</span></div>
          </div>
          <div class="unit-card-price">
            ${priceHTML}
            <div class="${availClass}"><span class="dot"></span>${unit.available}</div>
          </div>
          ${urgencyHTML}
          <ul class="unit-card-features">${featureTags}</ul>
          <a href="#tour" class="unit-card-cta">
            Schedule a tour
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </a>
        </div>
      </article>
    `;
  }

  function renderUnits() {
    const grid = document.getElementById('unit-grid');
    const empty = document.getElementById('empty-state');
    const countEl = document.getElementById('results-count');
    const list = getFilteredSortedUnits();

    countEl.textContent = list.length;

    if (list.length === 0) {
      grid.innerHTML = '';
      grid.hidden = true;
      empty.hidden = false;
    } else {
      grid.hidden = false;
      empty.hidden = true;
      // The rail scrolls horizontally, so rebuilding it would jump back to the
      // first card — losing the place of anyone who favourited/compared a card
      // further along. Restore the offset after the swap.
      const keepScroll = grid.scrollLeft;
      grid.innerHTML = list.map((u, i) => unitCardHTML(u, i)).join('');
      grid.scrollLeft = keepScroll;
    }

    updateAffordResult();
    updateShortlistBar();
    // Card count changed, so the rail's overflow state may have too.
    if (typeof updateUnitRailNav === 'function') requestAnimationFrame(updateUnitRailNav);
  }

  function updateAffordResult() {
    const out = document.getElementById('afford-result');
    if (!out) return;
    if (affordableMax == null) { out.textContent = ''; out.classList.remove('is-none'); return; }
    const priced = UNITS.filter(u => u.rent != null);
    const fit = priced.filter(u => u.rent <= affordableMax).length;
    out.classList.toggle('is-none', fit === 0);
    out.innerHTML = 'Comfortable up to <strong>$' + affordableMax.toLocaleString() + '/mo</strong> — ' +
      (fit === 0 ? '<strong>no homes</strong> in range' : '<strong>' + fit + '</strong> home' + (fit === 1 ? '' : 's') + ' fit');
  }

  // Wire up filter pills
  document.querySelectorAll('.pill-toggle .pill-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const filterName = tab.dataset.filter;
      const value = tab.dataset.value;
      filters[filterName] = value;
      // Toggle active state within the same group
      tab.parentElement.querySelectorAll('.pill-tab').forEach(t => t.classList.remove('is-active'));
      tab.classList.add('is-active');
      renderUnits();
    });
  });

  // Sort
  document.getElementById('sort-units').addEventListener('change', (e) => {
    sortBy = e.target.value;
    renderUnits();
  });

  // Reset
  document.getElementById('reset-filters').addEventListener('click', () => {
    filters.beds = 'all';
    filters.avail = 'all';
    document.querySelectorAll('.pill-toggle').forEach(group => {
      group.querySelectorAll('.pill-tab').forEach(t => t.classList.remove('is-active'));
      const first = group.querySelector('.pill-tab[data-value="all"]');
      if (first) first.classList.add('is-active');
    });
    renderUnits();
  });

  // Affordability: 30% of monthly income
  const affordInput = document.getElementById('afford-income');
  if (affordInput) {
    affordInput.addEventListener('input', () => {
      const income = parseFloat(affordInput.value);
      affordableMax = (!isNaN(income) && income > 0) ? Math.round(income / 12 * 0.30) : null;
      renderUnits();
    });
  }

  // Delegated heart / compare toggles (survives grid re-render)
  document.getElementById('unit-grid').addEventListener('click', (e) => {
    const fav = e.target.closest('[data-fav]');
    if (fav) { toggleFav(fav.dataset.fav); return; }
    const cmp = e.target.closest('[data-cmp]');
    if (cmp) {
      const id = cmp.dataset.cmp;
      if (!compareSet.has(id) && compareSet.size >= COMPARE_MAX) {
        flashShortlistMsg('Compare up to ' + COMPARE_MAX + ' homes');
        return;
      }
      toggleCompare(id);
      return;
    }
    // Anything else on the card opens the detail modal — except the tour CTA,
    // which should keep its own jump-to-form behaviour.
    if (e.target.closest('.unit-card-cta')) return;
    const card = e.target.closest('[data-unit-open]');
    if (card) openUnitDetail(card.dataset.unitOpen);
  });

  // The card is a plain <article>; the unit number inside it is the real button,
  // so keyboard users get it for free and the nested heart/compare/tour controls
  // stay individually reachable (they would be presentational children of a
  // role="button" card).

  // ----- Shortlist bar + overlays
  const slBar = document.getElementById('shortlist-bar');
  const slFavCount = document.getElementById('sl-fav-count');
  const slCmpCount = document.getElementById('sl-cmp-count');
  const slCmpSummary = document.getElementById('sl-cmp-summary');
  const slCompareBtn = document.getElementById('sl-compare-btn');

  function updateShortlistBar() {
    if (!slBar) return;
    slFavCount.textContent = favorites.size;
    slCmpCount.textContent = compareSet.size;
    slCmpSummary.hidden = compareSet.size === 0;
    slCompareBtn.disabled = compareSet.size < 2;
    slCompareBtn.textContent = compareSet.size >= 2 ? 'Compare (' + compareSet.size + ')' : 'Compare';
    slBar.classList.toggle('is-visible', favorites.size > 0 || compareSet.size > 0);
  }

  let slMsgTimer = null;
  function flashShortlistMsg(msg) {
    if (!slBar) return;
    const summary = document.getElementById('sl-fav-summary');
    const prev = summary.innerHTML;
    summary.textContent = msg;
    slBar.classList.add('is-visible');
    clearTimeout(slMsgTimer);
    slMsgTimer = setTimeout(() => { summary.innerHTML = prev; updateShortlistBar(); }, 1800);
  }

  // ----- Generic overlay open/close (mirrors contact widget)
  let lastFocused = null;
  function openOverlay(el) {
    lastFocused = document.activeElement;
    el.classList.add('is-open');
    el.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    const f = el.querySelector('button, a, input, select, [tabindex]');
    if (f) setTimeout(() => f.focus({ preventScroll: true }), 50);
  }
  function closeOverlay(el) {
    el.classList.remove('is-open');
    el.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (lastFocused && lastFocused.focus) lastFocused.focus({ preventScroll: true });
  }
  document.querySelectorAll('.ct-overlay').forEach(ov => {
    ov.querySelectorAll('[data-ct-close]').forEach(b => b.addEventListener('click', () => closeOverlay(ov)));
  });

  // ----- Sheet modals (neighborhood, tour, FAQ)
  // These used to be full-page sections. Every existing link that pointed at
  // them — nav, footer, hero CTA, unit cards, sticky mobile bar — now opens the
  // matching dialog instead of scrolling, so no link had to be rewritten.
  const SHEETS = {
    '#neighborhood': 'neighborhood-overlay',
    '#tour': 'tour-overlay',
    '#faq': 'faq-overlay',
  };

  function sheetEl(hash) {
    return SHEETS[hash] ? document.getElementById(SHEETS[hash]) : null;
  }

  function openSheet(hash) {
    const el = sheetEl(hash);
    if (!el) return false;
    openOverlay(el);
    // Leaflet lays out to zero size while its container is hidden, so re-measure
    // once the sheet is on screen.
    if (hash === '#neighborhood' && typeof map !== 'undefined' && map) {
      setTimeout(() => { try { map.invalidateSize(); } catch (e) {} }, 60);
    }
    if (window.trackEvent) window.trackEvent('sheet_opened', { sheet: hash.slice(1) });
    return true;
  }

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const hash = a.getAttribute('href');
    // Only intercept when the dialog actually exists — a site without FAQ data
    // renders no #faq-overlay, and swallowing the click would leave a dead link.
    if (!sheetEl(hash)) return;
    e.preventDefault();
    // Coming from another dialog (e.g. a unit's tour button): close it first.
    document.querySelectorAll('.ct-overlay.is-open').forEach(closeOverlay);
    openSheet(hash);
  });

  // Inbound deep links. These used to be page sections, so /#tour, /#faq and
  // /#neighborhood are already published — the guide pages and llms.txt point at
  // them. Without this an arriving visitor lands on the homepage with no dialog.
  function openSheetFromHash() {
    if (openSheet(window.location.hash)) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }
  openSheetFromHash();
  window.addEventListener('hashchange', openSheetFromHash);

  // ----- Unit detail modal
  // Units carry a more specific plan key than the floor-plan config sometimes
  // does (e.g. "2br2ba" vs "2br"), so fall back to the bedroom-count prefix.
  // Keeps studio / 1br / 3br2ba working without renaming existing config.
  function planConfig(plan) {
    const fp = (window.__SITE__ && window.__SITE__.config.floorPlans) || {};
    if (fp[plan]) return fp[plan];
    const m = String(plan || '').match(/^(studio|\d+br)/);
    return (m && fp[m[1]]) || null;
  }

  // Representative media for the unit's plan: the floor-plan drawing first,
  // then photos of that layout. Anything not supplied yet shows the placeholder.
  function renderUnitMedia(unit) {
    const wrap = document.getElementById('ud-media');
    if (!wrap) return;
    const cfg = planConfig(unit.plan) || {};
    const items = [];
    if (cfg.image) items.push({ src: cfg.image, title: 'Floor plan', kind: 'plan' });
    (cfg.photos || []).forEach(p => items.push({ src: p.src, title: p.title, kind: 'photo' }));

    if (!items.length) { wrap.innerHTML = ''; wrap.hidden = true; return; }
    wrap.hidden = false;
    // Built as nodes rather than an HTML string: src/title come from
    // site.config.json, which is editable through the CMS, so a quote in a title
    // would otherwise break out of the attribute.
    wrap.innerHTML = '';
    const strip = document.createElement('div');
    strip.className = 'ud-media-strip';
    items.forEach((it) => {
      const fig = document.createElement('figure');
      fig.className = 'ud-media-item' + (it.kind === 'plan' ? ' is-plan' : '');
      const box = document.createElement('div');
      box.className = 'ud-media-img';
      const img = document.createElement('img');
      img.src = it.src;
      img.alt = it.title || '';
      img.loading = 'lazy';
      img.addEventListener('error', () => {
        box.innerHTML = '';
        const ph = document.createElement('span');
        ph.className = 'ud-media-ph';
        ph.textContent = 'Coming soon';
        box.appendChild(ph);
      }, { once: true });
      box.appendChild(img);
      const cap = document.createElement('figcaption');
      cap.textContent = it.title || '';
      fig.appendChild(box);
      fig.appendChild(cap);
      strip.appendChild(fig);
    });
    wrap.appendChild(strip);

  }

  // Tabs keep the detail content in one consistent container.
  (function () {
    const tabs = [...document.querySelectorAll('[data-ud-tab]')];
    if (!tabs.length) return;
    tabs.forEach(tab => tab.addEventListener('click', () => {
      const key = tab.dataset.udTab;
      tabs.forEach(t => {
        const on = t === tab;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      document.querySelectorAll('[data-ud-panel]').forEach(p => {
        p.hidden = p.dataset.udPanel !== key;
      });
    }));
  })();

  // Inside-the-home, rental terms and application criteria are static content in
  // the modal; only this per-unit summary is rendered per open.
  function openUnitDetail(id) {
    const u = unitById(id);
    const overlay = document.getElementById('unit-overlay');
    if (!u || !overlay) return;

    const title = document.getElementById('ud-title');
    const eyebrow = document.getElementById('ud-eyebrow');
    const summary = document.getElementById('ud-summary');

    if (title) title.innerHTML = 'Unit <span class="italic">' + u.id + '</span>';
    if (eyebrow) {
      const plan = PLAN_LABELS[u.plan] || 'Available home';
      // With more than one building in play, the plan alone doesn't tell a
      // renter which home they're looking at — name the property and street.
      const where = MULTI_PROPERTY
        ? [u.property, u.address].filter(Boolean).join(' · ')
        : '';
      eyebrow.textContent = where ? plan + ' · ' + where : plan;
    }
    if (summary) {
      const price = u.rent == null
        ? 'Inquire'
        : '$' + u.rent.toLocaleString() + '<span>/mo</span>';
      const tags = (u.features || []).map(f => '<li>' + f + '</li>').join('');
      summary.className = 'ud-summary';
      summary.innerHTML =
        '<div class="ud-summary-top">' +
          '<div class="ud-price">' + price + '</div>' +
          '<div class="' + (u.availType === 'soon' ? 'avail soon' : 'avail') + '"><span class="dot"></span>' + u.available + '</div>' +
        '</div>' +
        '<dl class="ud-stats">' +
          '<div><dt>Beds</dt><dd>' + (u.beds === 0 ? 'Studio' : u.beds) + '</dd></div>' +
          '<div><dt>Baths</dt><dd>' + u.baths + '</dd></div>' +
          '<div><dt>Size</dt><dd>' + u.sqft.toLocaleString() + ' sqft</dd></div>' +
          '<div><dt>Floor</dt><dd>' + (u.floor || '—') + '</dd></div>' +
        '</dl>' +
        (tags ? '<ul class="ud-tags">' + tags + '</ul>' : '') +
        '<div class="ud-actions">' +
          '<a href="#tour" class="btn btn-primary" data-ud-tour>Schedule a tour →</a>' +
        '</div>';
    }
    renderUnitMedia(u);
    // Always reopen on the first tab so the modal reads the same way each time.
    const firstTab = document.querySelector('[data-ud-tab]');
    if (firstTab) firstTab.click();

    openOverlay(overlay);
    if (window.trackEvent) window.trackEvent('unit_detail_opened', { unit: u.id, uid: uidOf(u), property: u.property || null });
  }

  // The tour CTA inside the unit modal is an <a href="#tour">, so the sheet
  // handler above closes this dialog and opens the tour sheet.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    document.querySelectorAll('.ct-overlay.is-open').forEach(closeOverlay);
  });

  // ----- Shortlist drawer
  const slOverlay = document.getElementById('shortlist-overlay');
  const slBody = document.getElementById('sl-drawer-body');

  function renderShortlist() {
    const ids = [...favorites];
    if (ids.length === 0) {
      slBody.innerHTML = '<div class="sl-empty"><p>No saved homes yet.</p><p style="font-size:13px;margin-top:6px;">Tap the heart on any home to add it here.</p></div>';
      return;
    }
    const rows = ids.map(id => {
      const u = unitById(id);
      if (!u) return '';
      const price = u.rent == null ? 'Inquire' : '$' + u.rent.toLocaleString() + '<span>/mo</span>';
      return `<div class="sl-row">
        <div class="sl-row-info">
          <div class="sl-row-title">Unit <span class="italic">${u.id}</span></div>
          <div class="sl-row-meta">${PLAN_LABELS[u.plan]} · ${u.sqft.toLocaleString()} sqft · ${MULTI_PROPERTY && u.address ? u.address : u.floor}</div>
        </div>
        <div class="sl-row-price">${price}</div>
        <button class="sl-row-remove" type="button" data-sl-remove="${uidOf(u)}" aria-label="Remove Unit ${u.id}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>`;
    }).join('');
    slBody.innerHTML = `<div class="sl-list">${rows}</div>
      <div class="sl-drawer-foot">
        <button class="btn btn-primary" type="button" id="sl-send-tour">Schedule a tour for these</button>
      </div>`;
  }

  if (slBody) {
    slBody.addEventListener('click', (e) => {
      const rm = e.target.closest('[data-sl-remove]');
      if (rm) { favorites.delete(rm.dataset.slRemove); saveFavs(); renderUnits(); renderShortlist(); return; }
      if (e.target.closest('#sl-send-tour')) {
        sendShortlistToTour([...favorites]);
      }
    });
  }
  document.getElementById('sl-view-btn').addEventListener('click', () => {
    renderShortlist();
    openOverlay(slOverlay);
  });

  // ----- Compare overlay
  const cmpOverlay = document.getElementById('compare-overlay');
  const cmpBody = document.getElementById('cmp-body');

  function buildCompareTable(ids) {
    const units = ids.map(unitById).filter(Boolean);
    const ppsq = u => (u.rent == null ? null : u.rent / u.sqft);
    const minRent = Math.min.apply(null, units.filter(u => u.rent != null).map(u => u.rent));
    const maxSqft = Math.max.apply(null, units.map(u => u.sqft));
    const minPpsq = Math.min.apply(null, units.filter(u => ppsq(u) != null).map(ppsq));
    const head = '<tr><th></th>' + units.map(u => `<th>Unit <span class="italic">${u.id}</span></th>`).join('') + '</tr>';
    function row(label, fn) {
      return '<tr><th>' + label + '</th>' + units.map(fn).join('') + '</tr>';
    }
    const rows = [
      row('Plan', u => `<td>${PLAN_LABELS[u.plan]}</td>`),
      row('Beds', u => `<td>${u.beds}</td>`),
      row('Baths', u => `<td>${u.baths}</td>`),
      row('Size', u => `<td class="${u.sqft === maxSqft ? 'ct-best' : ''}">${u.sqft.toLocaleString()} sqft</td>`),
      row('Rent', u => `<td class="${u.rent != null && u.rent === minRent ? 'ct-best' : ''}">${u.rent == null ? 'Inquire' : '$' + u.rent.toLocaleString() + '/mo'}</td>`),
      row('$ / sqft', u => `<td class="${ppsq(u) != null && ppsq(u) === minPpsq ? 'ct-best' : ''}">${ppsq(u) == null ? '—' : '$' + ppsq(u).toFixed(2)}</td>`),
      row('Floor', u => `<td>${u.floor}</td>`),
      row('Availability', u => `<td>${u.available}</td>`),
      row('Features', u => `<td><ul class="compare-feats">${u.features.map(f => '<li>' + f + '</li>').join('')}</ul></td>`)
    ].join('');
    cmpBody.innerHTML = `<div class="compare-scroll"><table class="compare-table"><thead>${head}</thead><tbody>${rows}</tbody></table></div>
      <div class="sl-drawer-foot"><button class="btn btn-primary" type="button" id="cmp-send-tour">Schedule a tour for these</button></div>`;
  }

  if (cmpBody) {
    cmpBody.addEventListener('click', (e) => {
      if (e.target.closest('#cmp-send-tour')) sendShortlistToTour([...compareSet]);
    });
  }
  slCompareBtn.addEventListener('click', () => {
    if (compareSet.size < 2) return;
    buildCompareTable([...compareSet]);
    openOverlay(cmpOverlay);
  });

  // ----- Hand off to tour wizard
  function sendShortlistToTour(ids) {
    const valid = ids.map(unitById).filter(Boolean);
    if (valid.length === 0) return;
    const list = valid.map(u => u.id).join(', ');
    const plural = valid.length === 1 ? 'unit' : 'units';
    const msg = "I'm interested in " + plural + ' ' + list + '. Could we tour ' + (valid.length === 1 ? 'it' : 'them') + '?';
    if (typeof window.tourPrefill === 'function') window.tourPrefill(msg);
    document.querySelectorAll('.ct-overlay.is-open').forEach(closeOverlay);
    openSheet('#tour');
  }

  // ----- Availability rail: arrows + scroll affordance
  // Without a visible cue the extra homes past the third card go unnoticed.
  function updateUnitRailNav() {
    const grid = document.getElementById('unit-grid');
    const wrap = document.getElementById('unit-rail-wrap');
    if (!grid || !wrap) return;
    // The rail carries 4px of scroll padding, so resting "at start" is a few
    // pixels in rather than exactly 0.
    const EDGE = 8;
    const overflowing = grid.scrollWidth > grid.clientWidth + EDGE;
    const atStart = grid.scrollLeft <= EDGE;
    const atEnd = grid.scrollLeft + grid.clientWidth >= grid.scrollWidth - EDGE;
    wrap.classList.toggle('has-overflow', overflowing);
    wrap.classList.toggle('is-at-start', atStart);
    wrap.classList.toggle('is-at-end', atEnd);
    const prev = wrap.querySelector('.unit-prev');
    const next = wrap.querySelector('.unit-next');
    if (prev) prev.classList.toggle('is-hidden', !overflowing || atStart);
    if (next) next.classList.toggle('is-hidden', !overflowing || atEnd);
  }
  function scrollUnitRail(dir) {
    const grid = document.getElementById('unit-grid');
    if (!grid) return;
    const card = grid.querySelector('.unit-card');
    const step = card ? card.getBoundingClientRect().width + 20 : grid.clientWidth * 0.7;
    grid.scrollBy({ left: dir * step, behavior: 'smooth' });
  }
  document.querySelector('.unit-prev')?.addEventListener('click', () => scrollUnitRail(-1));
  document.querySelector('.unit-next')?.addEventListener('click', () => scrollUnitRail(1));
  document.getElementById('unit-grid')?.addEventListener('scroll', () => {
    requestAnimationFrame(updateUnitRailNav);
  }, { passive: true });
  window.addEventListener('resize', () => requestAnimationFrame(updateUnitRailNav));

  // Hero photography. Falls back to the illustrated skyline when a site hasn't
  // supplied a photo yet, and also if the file 404s.
  (function () {
    const cfg = (window.__SITE__ && window.__SITE__.config) || {};
    const hero = cfg.hero || {};
    const visual = document.querySelector('.hero-visual');
    if (!visual || !hero.image) return;
    const img = new Image();
    img.className = 'hero-photo';
    img.alt = hero.alt || '';
    img.decoding = 'async';
    img.fetchPriority = 'high';
    img.onload = () => { visual.classList.add('has-photo'); visual.prepend(img); };
    img.src = hero.image;
  })();

  // Initial render
  syncUnitCounts();
  syncPlanPricing();
  syncRentalTerms();
  renderUnits();

  // ============== FLOOR PLAN SWITCHER ==============
  const planTourEl = document.querySelector('.plan-view-3d');
  const planTourIframe = document.querySelector('.plan-tour-iframe');
  // Whatever plan the server rendered first, not a hardcoded '1br' — a property
  // whose cheapest layout is a studio (or which has no 1BR at all) would
  // otherwise start on a tab that doesn't exist, leaving the panel blank.
  const firstPlanTab = document.querySelector('.plan-tab.is-active') || document.querySelector('.plan-tab');
  let activePlan = (firstPlanTab && firstPlanTab.dataset.plan) || '1br';
  let activeView = '2d';

  // Plans whose 3D tour has already been counted this pageview, so switching
  // back and forth between tabs doesn't inflate the conversion.
  const tour3dTracked = new Set();

  function applyTourSrc() {
    if (!planTourEl || !planTourIframe) return;
    const placeholder = planTourEl.querySelector('.plan-tour-placeholder');
    const url = planTourEl.dataset['tour' + activePlan.charAt(0).toUpperCase() + activePlan.slice(1)];
    if (activeView === '3d' && url) {
      if (planTourIframe.getAttribute('src') !== url) planTourIframe.setAttribute('src', url);
      planTourIframe.hidden = false;
      if (placeholder) placeholder.style.display = 'none';
      // The 3D tab is a <button>, so the delegated tour_3d_opened listener in
      // Analytics.astro — which matches matterport links and [data-3d-tour] —
      // never saw it. Fire here instead, and only once a tour is actually on
      // screen: clicking the tab while it still says "Coming Soon" is not a
      // tour view and shouldn't be counted as one.
      if (!tour3dTracked.has(activePlan) && window.trackEvent) {
        tour3dTracked.add(activePlan);
        window.trackEvent('tour_3d_opened', { plan: activePlan });
      }
    } else {
      planTourIframe.hidden = true;
      if (placeholder) placeholder.style.display = '';
    }
  }

  document.querySelectorAll('.plan-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.plan;
      activePlan = target;
      document.querySelectorAll('.plan-tab').forEach(t => t.classList.toggle('is-active', t === tab));
      document.querySelectorAll('.plan-svg').forEach(svg => {
        svg.classList.toggle('is-active', svg.dataset.plan === target);
      });
      document.querySelectorAll('.plan-content').forEach(c => {
        c.classList.toggle('is-active', c.dataset.plan === target);
      });
      applyTourSrc();
    });
  });

  document.querySelectorAll('.plan-view-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const view = tab.dataset.view;
      activeView = view;
      document.querySelectorAll('.plan-view-tab').forEach(t => {
        const on = t === tab;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      document.querySelectorAll('.plan-view').forEach(v => {
        v.classList.toggle('is-active', v.dataset.view === view);
      });
      applyTourSrc();
    });
  });

  // Floor-plan images + 3D tour URLs come from site config (CMS-editable).
  (function applyFloorPlanConfig() {
    const fp = (window.__SITE__ && window.__SITE__.config.floorPlans) || {};
    // 3D tours: feed the data-tour-* attributes applyTourSrc() reads. Iterates
    // whatever plan keys the site actually configured — this used to check
    // '1br' and '2br' by name, so a property with a studio or 3BR could set a
    // tourUrl and have it silently ignored, with the tab stuck on
    // "Coming Soon" and nothing logged to explain why.
    if (planTourEl) {
      Object.keys(fp).forEach((key) => {
        const plan = fp[key];
        if (!plan || !plan.tourUrl) return;
        // Mirrors the read in applyTourSrc(): '1br' -> tour1br, 'studio' -> tourStudio.
        planTourEl.dataset['tour' + key.charAt(0).toUpperCase() + key.slice(1)] = plan.tourUrl;
      });
    }
    // 2D floor plan image: swap the placeholder for an uploaded drawing.
    const view2d = document.querySelector('.plan-view-2d');
    function applyPlanImage() {
      if (!view2d) return;
      const cfg = fp[activePlan];
      const placeholder = view2d.querySelector('.plan-placeholder');
      let img = view2d.querySelector('.plan-image');
      if (cfg && cfg.image) {
        if (!img) {
          img = document.createElement('img');
          img.className = 'plan-image';
          img.loading = 'lazy';
          // A configured path is not a guarantee the file shipped. Without this,
          // a missing drawing hides the placeholder and leaves a broken image in
          // its place — worse than the honest "Coming Soon" it replaced.
          img.addEventListener('error', function () {
            img.style.display = 'none';
            var ph = view2d.querySelector('.plan-placeholder');
            if (ph) ph.style.display = '';
          });
          view2d.appendChild(img);
        }
        img.src = cfg.image;
        img.alt = activePlan.toUpperCase() + ' floor plan';
        img.style.display = '';
        if (placeholder) placeholder.style.display = 'none';
      } else {
        if (img) img.style.display = 'none';
        if (placeholder) placeholder.style.display = '';
      }
    }
    document.querySelectorAll('.plan-tab').forEach((tab) =>
      tab.addEventListener('click', applyPlanImage)
    );
    applyPlanImage();
    if (typeof applyTourSrc === 'function') applyTourSrc();
  })();

  // ============== INTERACTIVE NEIGHBORHOOD MAP ==============
  const PROPERTY = (function () {
    const c = (window.__SITE__ && window.__SITE__.config) || {};
    const a = c.address || {};
    return {
      // No hardcoded default: this used to fall back to Magnolia's coordinates,
      // so any site launched before its geo was filled in would centre the map
      // and drop its "you are here" pin on a different property entirely.
      // null means "unknown" and the map skips the pin rather than lying.
      lat: c.geo && c.geo.latitude != null ? c.geo.latitude : null,
      lng: c.geo && c.geo.longitude != null ? c.geo.longitude : null,
      name: c.name || '',
      address: [a.streetAddress, [a.addressLocality, a.addressRegion].filter(Boolean).join(', ') +
        (a.postalCode ? ' ' + a.postalCode : '')].filter(Boolean).join('<br>'),
    };
  })();

  // Where to centre the map when the property's own coordinates are unknown:
  // a sibling building, else the first neighborhood pin. Returns null if the
  // site has nothing positioned yet, and the map section is skipped.
  function mapCentre() {
    if (PROPERTY.lat != null) return [PROPERTY.lat, PROPERTY.lng];
    if (BUILDINGS.length) return [BUILDINGS[0].lat, BUILDINGS[0].lng];
    if (PLACES.length && PLACES[0].lat != null) return [PLACES[0].lat, PLACES[0].lng];
    return null;
  }

  // Additional buildings this property is made of. Only those with real
  // coordinates are pinned — a guessed lat/lng would drop a renter on the wrong
  // block, which is worse than the building simply not being on the map. A
  // building at the anchor coordinates is skipped so it doesn't stack on the
  // main marker.
  const BUILDINGS = ((window.__SITE__ && window.__SITE__.config.buildings) || [])
    .filter((b) => b && b.geo && b.geo.latitude != null && b.geo.longitude != null)
    .filter((b) => !(b.geo.latitude === PROPERTY.lat && b.geo.longitude === PROPERTY.lng))
    .map((b) => {
      const a = b.address || {};
      return {
        lat: b.geo.latitude,
        lng: b.geo.longitude,
        name: b.name || '',
        address: [a.streetAddress, [a.addressLocality, a.addressRegion].filter(Boolean).join(', ') +
          (a.postalCode ? ' ' + a.postalCode : '')].filter(Boolean).join('<br>'),
      };
    });

  // Map popup copy, derived from the live unit data for the same reason the hero
  // counts are: availability is refreshed automatically and typed-in figures go stale.
  function homesLabel() {
    const n = UNITS.filter((u) => u.availType === 'now').length;
    return n + (n === 1 ? ' home' : ' homes');
  }
  function fromLabel() {
    const avail = UNITS.filter((u) => u.availType === 'now');
    const min = minRentOf(avail.length ? avail : UNITS);
    return min == null ? 'Inquire' : 'From $' + min.toLocaleString();
  }

  // Straight-line (great-circle) distance from the property, in miles
  function haversineMiles(a, b) {
    const R = 3958.8;
    const toRad = d => d * Math.PI / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.asin(Math.sqrt(h));
  }

  function formatDistance(mi) {
    return mi < 0.1 ? 'Doorstep' : `${mi.toFixed(1)} mi`;
  }

  function formatTime(mi) {
    if (mi < 0.1) return 'At your doorstep';
    if (mi <= 1.3) return `${Math.max(1, Math.round(mi * 20))} min walk`;
    return `${Math.max(1, Math.round(mi / 25 * 60))} min drive`;
  }

  const CATEGORIES = {
    parks:    { label: 'Parks & Outdoors', color: '#F1E249' },
    food:     { label: 'Food & Drink',     color: '#F1E249' },
    shopping: { label: 'Shopping & Grocery', color: '#8b6f47' },
    transit:  { label: 'Transit',          color: '#3d5a6c' },
    schools:  { label: 'Schools',          color: '#6b4a7a' }
  };

  // Grouped by category; the list is sorted by computed distance at render time
  const PLACES = (window.__SITE__ && window.__SITE__.data.places) || [];

  // Derive distance + travel time from real coordinates so labels stay accurate
  PLACES.forEach(p => {
    p.dist = haversineMiles(PROPERTY, p);
    p.distance = formatDistance(p.dist);
    p.time = formatTime(p.dist);
  });

  // King County Metro routes serving Magnolia. Geometry comes from OpenStreetMap
  // (relation members of route=bus,ref=33 and ref=24), so the lines follow the
  // actual streets the buses drive — each route is a set of way segments.
  const BUS_ROUTES = [
    { id: 33, name: 'Metro Route 33', dash: null,
      segments: [[[47.61863,-122.35739],[47.61866,-122.35744]],[[47.59888,-122.32903],[47.59912,-122.32902],[47.59918,-122.32902],[47.5992,-122.32902]],[[47.61858,-122.35535],[47.61858,-122.3551],[47.61858,-122.35479]],[[47.63232,-122.3909],[47.63232,-122.39126],[47.63232,-122.3913],[47.63232,-122.39165],[47.63232,-122.3917],[47.63232,-122.39191]],[[47.60088,-122.32901],[47.60101,-122.32915],[47.60104,-122.32918],[47.60128,-122.32939],[47.6013,-122.32942],[47.60133,-122.32945],[47.60136,-122.32948],[47.60138,-122.32951],[47.6014,-122.32955],[47.60143,-122.32959],[47.60145,-122.32963],[47.60146,-122.32967],[47.60148,-122.32971],[47.60152,-122.32981]],[[47.60172,-122.33028],[47.60178,-122.33041],[47.60179,-122.33045],[47.6018,-122.33048],[47.60186,-122.33056],[47.60192,-122.33064]],[[47.63232,-122.39191],[47.63241,-122.3919],[47.63266,-122.3919],[47.63283,-122.3919],[47.63288,-122.3919],[47.6329,-122.3919],[47.63299,-122.39189],[47.6331,-122.39189],[47.63314,-122.39189],[47.63322,-122.39189],[47.63328,-122.39189],[47.63335,-122.39189],[47.6334,-122.39189],[47.63352,-122.39189],[47.63355,-122.39188],[47.63368,-122.39188],[47.63369,-122.39188],[47.63391,-122.39188],[47.63392,-122.39188],[47.63397,-122.39188],[47.63407,-122.39187],[47.6341,-122.39187],[47.63413,-122.39187],[47.63416,-122.39189]],[[47.63511,-122.39063],[47.63537,-122.39035],[47.63541,-122.39031],[47.63558,-122.39014],[47.63582,-122.38996],[47.63591,-122.38989],[47.63593,-122.38988],[47.63621,-122.38968],[47.63627,-122.38963]],[[47.63359,-122.37548],[47.63359,-122.37637]],[[47.61863,-122.35739],[47.61861,-122.35727],[47.6186,-122.35714],[47.61859,-122.35703],[47.61859,-122.35694],[47.61859,-122.35692],[47.61859,-122.35675]],[[47.63274,-122.3895],[47.63267,-122.38961],[47.63261,-122.38972],[47.63255,-122.38983],[47.6325,-122.38995],[47.63246,-122.39008],[47.63241,-122.39025],[47.63239,-122.39032],[47.63237,-122.39043],[47.63235,-122.39055],[47.63234,-122.39067],[47.63233,-122.39078],[47.63232,-122.3909]],[[47.63337,-122.37478],[47.6334,-122.37484],[47.63347,-122.37497],[47.63351,-122.37507],[47.63355,-122.3752],[47.63358,-122.37535],[47.63359,-122.37548]],[[47.62309,-122.3638],[47.62319,-122.36393],[47.62344,-122.36422],[47.62352,-122.36432],[47.62381,-122.36466],[47.62384,-122.3647],[47.62402,-122.36492],[47.62412,-122.36505],[47.62419,-122.36513],[47.62442,-122.36542]],[[47.59787,-122.32904],[47.5976,-122.32903],[47.59752,-122.32903]],[[47.63627,-122.38963],[47.63634,-122.38954],[47.63638,-122.3895],[47.63649,-122.3894],[47.63692,-122.38903],[47.63699,-122.38897],[47.6372,-122.3888],[47.63771,-122.38842],[47.63832,-122.38797],[47.63835,-122.38795],[47.63841,-122.3879],[47.63916,-122.38735],[47.63938,-122.38718],[47.63941,-122.38716],[47.63953,-122.38707],[47.63979,-122.38687],[47.64019,-122.38658],[47.64035,-122.38646],[47.64038,-122.38644],[47.64055,-122.38635],[47.64064,-122.38634]],[[47.66479,-122.41097],[47.66481,-122.41089],[47.66483,-122.4108],[47.66483,-122.41071],[47.66484,-122.41062],[47.66483,-122.41053]],[[47.66483,-122.41053],[47.66479,-122.41028],[47.66463,-122.40953],[47.66462,-122.40946],[47.66464,-122.4094]],[[47.66483,-122.41053],[47.66487,-122.41071],[47.66489,-122.4109],[47.66491,-122.41101],[47.6649,-122.41114]],[[47.6649,-122.41127],[47.66486,-122.41134],[47.66482,-122.4114],[47.66479,-122.41144],[47.66475,-122.41147],[47.6647,-122.41149],[47.66465,-122.4115],[47.66462,-122.4115],[47.66458,-122.4115],[47.66455,-122.41148],[47.66452,-122.41146]],[[47.63348,-122.38284],[47.63349,-122.38302],[47.63349,-122.38331],[47.63349,-122.38671],[47.63348,-122.38769],[47.63347,-122.38785],[47.63346,-122.388],[47.63344,-122.38815],[47.6334,-122.38829],[47.63337,-122.38843],[47.63332,-122.38857],[47.63327,-122.3887],[47.63321,-122.38882],[47.63315,-122.38894],[47.63309,-122.38904],[47.63302,-122.38914],[47.63274,-122.3895]],[[47.63203,-122.37412],[47.63223,-122.37414],[47.63242,-122.37423],[47.63317,-122.37459],[47.63322,-122.37463],[47.63323,-122.37463],[47.63337,-122.37478]],[[47.59574,-122.32904],[47.59515,-122.32905]],[[47.59402,-122.32905],[47.59381,-122.32906]],[[47.65586,-122.38647],[47.65595,-122.38658],[47.65609,-122.38675],[47.65612,-122.38679],[47.6562,-122.38689],[47.65628,-122.38699],[47.65634,-122.38706]],[[47.65868,-122.40393],[47.65984,-122.40391],[47.66055,-122.40388],[47.66067,-122.40391],[47.66076,-122.404],[47.66081,-122.40417],[47.66082,-122.40513],[47.66086,-122.40533],[47.66092,-122.40544],[47.66101,-122.40551],[47.66114,-122.40554],[47.66153,-122.40554],[47.66173,-122.40554],[47.6623,-122.40554],[47.66232,-122.40554],[47.66241,-122.40554],[47.66275,-122.40554],[47.66314,-122.40553],[47.6633,-122.40553],[47.6635,-122.40556],[47.66356,-122.40561],[47.66363,-122.40566],[47.66371,-122.40578],[47.66384,-122.40598],[47.66387,-122.40617],[47.66416,-122.40742],[47.66447,-122.40877]],[[47.66128,-122.39431],[47.6613,-122.39442],[47.66131,-122.39455],[47.66132,-122.39499],[47.66132,-122.39542],[47.66132,-122.39572],[47.66132,-122.39576],[47.66132,-122.39604],[47.66132,-122.39612],[47.66132,-122.39651],[47.66131,-122.39717]],[[47.65399,-122.38464],[47.6549,-122.38531],[47.65498,-122.38537],[47.65505,-122.38544],[47.65513,-122.38551],[47.65519,-122.38559],[47.65522,-122.38562],[47.65539,-122.38586],[47.65566,-122.3862],[47.65576,-122.38634],[47.65586,-122.38647]],[[47.61163,-122.3396],[47.6117,-122.33971],[47.61207,-122.34031],[47.61235,-122.34079],[47.61241,-122.3409]],[[47.61859,-122.35675],[47.61859,-122.35662],[47.61859,-122.35627]],[[47.63142,-122.3746],[47.63152,-122.37446],[47.63165,-122.37427]],[[47.6306,-122.37357],[47.63099,-122.37406],[47.63106,-122.37415],[47.63116,-122.37427],[47.63142,-122.3746]],[[47.63359,-122.37637],[47.63359,-122.37727]],[[47.63359,-122.37727],[47.63359,-122.378],[47.63359,-122.37875],[47.63359,-122.37889],[47.63359,-122.37911],[47.63359,-122.37942],[47.63358,-122.38004],[47.63356,-122.38015]],[[47.6202,-122.36005],[47.62025,-122.36015],[47.62035,-122.36033],[47.62047,-122.36054],[47.62052,-122.36064]],[[47.61859,-122.35141],[47.61851,-122.35128],[47.61831,-122.35094],[47.61823,-122.3508]],[[47.61858,-122.35344],[47.61858,-122.35299],[47.61858,-122.35286]],[[47.61858,-122.35286],[47.61859,-122.35275],[47.61859,-122.35206],[47.61859,-122.35195],[47.61859,-122.35141]],[[47.60277,-122.33142],[47.60284,-122.33148],[47.60344,-122.33203],[47.60348,-122.33207]],[[47.64293,-122.38465],[47.64308,-122.38465],[47.6432,-122.38464],[47.64332,-122.38465],[47.64357,-122.38465],[47.64399,-122.38465],[47.64418,-122.38465],[47.64455,-122.38464],[47.6447,-122.38464],[47.64476,-122.38464],[47.64482,-122.38464],[47.64503,-122.38465],[47.64634,-122.38465],[47.64655,-122.38465],[47.64659,-122.38465],[47.64662,-122.38465],[47.64686,-122.38465],[47.64825,-122.38467],[47.64837,-122.38467],[47.64847,-122.38467],[47.64857,-122.38467],[47.64868,-122.38467],[47.64873,-122.38467],[47.65016,-122.38468],[47.65028,-122.38468],[47.65033,-122.38468],[47.65038,-122.38468],[47.65055,-122.38468],[47.65192,-122.3847],[47.65206,-122.3847],[47.65211,-122.3847],[47.65215,-122.3847],[47.65222,-122.3847],[47.6534,-122.38468],[47.65354,-122.38468],[47.65359,-122.38468],[47.65364,-122.38468],[47.6537,-122.38467],[47.65399,-122.38464]],[[47.65871,-122.40195],[47.65864,-122.40212],[47.65859,-122.40225],[47.65853,-122.4024],[47.65846,-122.40266],[47.65841,-122.40291],[47.6584,-122.40301],[47.65838,-122.40319],[47.65836,-122.40336],[47.65835,-122.4035],[47.65834,-122.40359]],[[47.65887,-122.4016],[47.65873,-122.40191],[47.65871,-122.40195]],[[47.63165,-122.37427],[47.63169,-122.37422],[47.63175,-122.37417],[47.6318,-122.37414],[47.63186,-122.37411],[47.63194,-122.3741],[47.63203,-122.37412]],[[47.62052,-122.36064],[47.6207,-122.36095]],[[47.61602,-122.34703],[47.61596,-122.34694],[47.61592,-122.34687],[47.61581,-122.34668],[47.61554,-122.34622],[47.61548,-122.34611]],[[47.61602,-122.34703],[47.61608,-122.34714],[47.61653,-122.3479],[47.61658,-122.34799],[47.61663,-122.34807],[47.6168,-122.34837],[47.61694,-122.34861]],[[47.60004,-122.32901],[47.60006,-122.32901],[47.6001,-122.32901],[47.60054,-122.32901],[47.60071,-122.32901]],[[47.61457,-122.34457],[47.61438,-122.34425],[47.61427,-122.34407],[47.61399,-122.3436],[47.61393,-122.34351]],[[47.60491,-122.33338],[47.60484,-122.33332],[47.60432,-122.33284],[47.60427,-122.33279],[47.60419,-122.33272]],[[47.60849,-122.33665],[47.60817,-122.33635],[47.60783,-122.33604],[47.60776,-122.33598]],[[47.62792,-122.37013],[47.62799,-122.37021],[47.62801,-122.37024]],[[47.62663,-122.36841],[47.62706,-122.36898],[47.62713,-122.36908]],[[47.66445,-122.41119],[47.66449,-122.41114],[47.66454,-122.41111],[47.6646,-122.41108]],[[47.6649,-122.41114],[47.6649,-122.4112],[47.6649,-122.41127]],[[47.65634,-122.38706],[47.65658,-122.38736],[47.65716,-122.38808],[47.65753,-122.38853],[47.65767,-122.38872],[47.65785,-122.38893],[47.65824,-122.38942],[47.65832,-122.38952],[47.65835,-122.38956],[47.65849,-122.38974]],[[47.66131,-122.39717],[47.66131,-122.39732],[47.66129,-122.39751],[47.66125,-122.3977],[47.66118,-122.39785],[47.66111,-122.39796],[47.66103,-122.39806],[47.6609,-122.39816]],[[47.66016,-122.39835],[47.66009,-122.39847],[47.66005,-122.39861],[47.66003,-122.39876],[47.66001,-122.39886],[47.65996,-122.39937],[47.65994,-122.39953],[47.65993,-122.39964],[47.65992,-122.3997],[47.65991,-122.39981],[47.6599,-122.39991],[47.65987,-122.40002],[47.65985,-122.4001],[47.65983,-122.40018],[47.65981,-122.40024],[47.65977,-122.40032],[47.65973,-122.4004],[47.65968,-122.40049],[47.65963,-122.40057]],[[47.62606,-122.36762],[47.62625,-122.36789],[47.62632,-122.36798],[47.62634,-122.36801]],[[47.62634,-122.36801],[47.62637,-122.36805],[47.62647,-122.36819],[47.62663,-122.36841]],[[47.6138,-122.34327],[47.61322,-122.34228],[47.61317,-122.3422]],[[47.61241,-122.3409],[47.61246,-122.34098],[47.61253,-122.3411],[47.61261,-122.34124]],[[47.60704,-122.33532],[47.60701,-122.33528],[47.60693,-122.33521],[47.60654,-122.33487],[47.6064,-122.33474],[47.60634,-122.33469]],[[47.63033,-122.37324],[47.6306,-122.37357]],[[47.62742,-122.36946],[47.62765,-122.36977],[47.62778,-122.36994],[47.62792,-122.37013]],[[47.62713,-122.36908],[47.62717,-122.36913],[47.62734,-122.36935],[47.62742,-122.36946]],[[47.62189,-122.3624],[47.62205,-122.36258],[47.62213,-122.36267]],[[47.6207,-122.36095],[47.62095,-122.36128]],[[47.62213,-122.36267],[47.62221,-122.36277],[47.62235,-122.36294],[47.62241,-122.36301]],[[47.60192,-122.33064],[47.60208,-122.33079],[47.60209,-122.3308]],[[47.60071,-122.32901],[47.60079,-122.32901],[47.60081,-122.32901],[47.60088,-122.32901]],[[47.59845,-122.32905],[47.59862,-122.32903],[47.59881,-122.32903]],[[47.59845,-122.32905],[47.59787,-122.32904]],[[47.59752,-122.32903],[47.59718,-122.32903]],[[47.59718,-122.32903],[47.59669,-122.32904],[47.59648,-122.32904]],[[47.61799,-122.35039],[47.61803,-122.35046],[47.61807,-122.35054],[47.61818,-122.35072],[47.61823,-122.3508]],[[47.61768,-122.34986],[47.61772,-122.34994],[47.61796,-122.35035],[47.61799,-122.35039]],[[47.61897,-122.35798],[47.61908,-122.35816],[47.61978,-122.35935]],[[47.62174,-122.36223],[47.62189,-122.3624]],[[47.61997,-122.35966],[47.62007,-122.35984],[47.6201,-122.35988],[47.6202,-122.36005]],[[47.61978,-122.35935],[47.61997,-122.35966]],[[47.60209,-122.3308],[47.60213,-122.33083],[47.60218,-122.33088],[47.60222,-122.33092],[47.60261,-122.33127],[47.60272,-122.33137],[47.60277,-122.33142]],[[47.60152,-122.32981],[47.60161,-122.33004],[47.60164,-122.3301],[47.60172,-122.33028]],[[47.59881,-122.32903],[47.59888,-122.32903]],[[47.64064,-122.38634],[47.64087,-122.38618],[47.64133,-122.38584],[47.64217,-122.38519],[47.64293,-122.38465]],[[47.63431,-122.39152],[47.63436,-122.39147]],[[47.6609,-122.39816],[47.66082,-122.39818],[47.66068,-122.39821],[47.66053,-122.39821],[47.66038,-122.39822],[47.66033,-122.39823]],[[47.65916,-122.40103],[47.65908,-122.40117],[47.65903,-122.40126],[47.65887,-122.4016]],[[47.59381,-122.32906],[47.5936,-122.32906],[47.59344,-122.32906],[47.59334,-122.32906]],[[47.63356,-122.38015],[47.63355,-122.38163],[47.63352,-122.38246],[47.63348,-122.38284]],[[47.61694,-122.34861],[47.61708,-122.34884],[47.61713,-122.34893]],[[47.66033,-122.39823],[47.66026,-122.39826],[47.66022,-122.39829],[47.66016,-122.39835]],[[47.6646,-122.41108],[47.66464,-122.41105],[47.66479,-122.41097]],[[47.65963,-122.40057],[47.65957,-122.40064],[47.65948,-122.40073],[47.65946,-122.40075],[47.65926,-122.40094],[47.65923,-122.40097],[47.65916,-122.40103]],[[47.65834,-122.40359],[47.65833,-122.4038],[47.65832,-122.40394]],[[47.60704,-122.33532],[47.60712,-122.33538],[47.60772,-122.33594],[47.60776,-122.33598]],[[47.61713,-122.34893],[47.61717,-122.349],[47.61763,-122.34978],[47.61768,-122.34986]],[[47.61103,-122.33898],[47.61147,-122.3394],[47.61152,-122.33944],[47.61156,-122.33948],[47.6116,-122.33954],[47.61163,-122.3396]],[[47.60977,-122.33782],[47.60981,-122.33786],[47.60999,-122.33803],[47.61017,-122.33819],[47.61067,-122.33865],[47.61075,-122.33872]],[[47.60634,-122.33469],[47.60627,-122.33463],[47.60569,-122.33408],[47.60563,-122.33403]],[[47.61548,-122.34611],[47.61542,-122.34602],[47.61525,-122.34573],[47.61505,-122.34539],[47.61476,-122.3449],[47.6147,-122.3448]],[[47.61075,-122.33872],[47.61083,-122.3388],[47.61101,-122.33896]],[[47.62241,-122.36301],[47.62257,-122.36319],[47.62261,-122.36323],[47.62276,-122.36341],[47.62309,-122.3638]],[[47.60348,-122.33207],[47.60354,-122.33212],[47.60383,-122.33239],[47.60401,-122.33255],[47.60414,-122.33267],[47.60419,-122.33272]],[[47.60876,-122.33689],[47.60882,-122.33695],[47.6091,-122.33721],[47.60958,-122.33764],[47.6097,-122.33776],[47.60977,-122.33782]],[[47.60563,-122.33403],[47.60558,-122.33398],[47.60545,-122.33386],[47.6053,-122.33374],[47.60497,-122.33344],[47.60491,-122.33338]],[[47.61858,-122.35611],[47.61858,-122.35554],[47.61858,-122.35545],[47.61858,-122.35535]],[[47.65849,-122.38974],[47.65853,-122.38979],[47.6586,-122.38987],[47.65864,-122.38993],[47.65874,-122.39005],[47.65937,-122.39088],[47.65938,-122.3909],[47.65941,-122.39094],[47.65945,-122.39099],[47.65957,-122.39114],[47.65968,-122.39127],[47.65974,-122.39135],[47.65989,-122.39155],[47.66027,-122.3921],[47.66064,-122.39278],[47.6607,-122.39289],[47.66082,-122.39313],[47.661,-122.39352],[47.66114,-122.39384],[47.6612,-122.394],[47.66124,-122.3941],[47.66126,-122.39421],[47.66128,-122.39431]],[[47.61275,-122.34147],[47.61311,-122.34209],[47.61317,-122.3422]],[[47.63416,-122.39189],[47.63418,-122.39175],[47.63419,-122.39169]],[[47.6147,-122.3448],[47.61465,-122.34472],[47.61457,-122.34457]],[[47.59515,-122.32905],[47.59478,-122.32905],[47.59459,-122.32905]],[[47.61101,-122.33896],[47.61103,-122.33898]],[[47.61261,-122.34124],[47.61275,-122.34147]],[[47.6212,-122.36158],[47.6214,-122.36182],[47.62147,-122.36191],[47.62161,-122.36208],[47.62174,-122.36223]],[[47.60876,-122.33689],[47.60869,-122.33683],[47.60849,-122.33665]],[[47.63419,-122.39169],[47.63424,-122.39161],[47.63431,-122.39152]],[[47.63436,-122.39147],[47.63476,-122.39102],[47.63511,-122.39063]],[[47.62801,-122.37024],[47.62848,-122.37086],[47.62853,-122.37093],[47.62864,-122.37108],[47.6287,-122.37115],[47.62872,-122.37118],[47.62884,-122.37134],[47.62892,-122.37144],[47.62904,-122.37159],[47.62924,-122.37184],[47.62928,-122.37189],[47.62959,-122.37229],[47.62962,-122.37233],[47.62974,-122.37248],[47.62975,-122.3725],[47.62987,-122.37266],[47.63011,-122.37295],[47.63026,-122.37315],[47.63029,-122.37318],[47.63033,-122.37324]],[[47.61858,-122.35416],[47.61858,-122.35405],[47.61858,-122.35352],[47.61858,-122.35344]],[[47.66452,-122.41146],[47.66448,-122.41141],[47.66444,-122.41134],[47.66444,-122.41126],[47.66445,-122.41119]],[[47.59967,-122.32911],[47.59995,-122.3291],[47.59996,-122.3291],[47.59999,-122.32907],[47.60004,-122.32901]],[[47.62453,-122.36557],[47.62458,-122.36563],[47.6247,-122.36577]],[[47.6247,-122.36577],[47.62476,-122.36585],[47.62503,-122.36621],[47.62515,-122.36637],[47.62529,-122.36657],[47.62545,-122.36678],[47.62574,-122.36719],[47.6259,-122.3674],[47.62591,-122.36742],[47.62598,-122.36751],[47.62606,-122.36762]],[[47.62442,-122.36542],[47.62453,-122.36557]],[[47.61858,-122.35479],[47.61858,-122.35416]],[[47.59423,-122.32905],[47.59402,-122.32905]],[[47.59648,-122.32904],[47.59619,-122.32904],[47.59574,-122.32904]],[[47.61393,-122.34351],[47.61389,-122.34343],[47.6138,-122.34327]],[[47.62095,-122.36128],[47.62115,-122.36152],[47.6212,-122.36158]],[[47.61859,-122.35627],[47.61858,-122.35611]],[[47.59459,-122.32905],[47.59423,-122.32905]],[[47.66447,-122.40877],[47.66458,-122.40925],[47.66461,-122.40932],[47.66464,-122.4094]],[[47.65832,-122.40394],[47.65839,-122.40394],[47.65868,-122.40393]],[[47.5992,-122.32902],[47.59922,-122.32904],[47.59931,-122.3291],[47.59932,-122.32911],[47.59933,-122.32912],[47.59967,-122.32911]],[[47.61866,-122.35744],[47.6189,-122.35785],[47.61897,-122.35798]]] },
    { id: 24, name: 'Metro Route 24', dash: '6 7',
      segments: [[[47.61863,-122.35739],[47.61866,-122.35744]],[[47.645,-122.40964],[47.64504,-122.40963],[47.64514,-122.40963],[47.64674,-122.40959],[47.6468,-122.40959],[47.64686,-122.40959],[47.64688,-122.40959],[47.64708,-122.40958],[47.64839,-122.40957],[47.64856,-122.40957],[47.64863,-122.40957],[47.64869,-122.40957],[47.64883,-122.40957],[47.65026,-122.40957],[47.6504,-122.40957],[47.65046,-122.40957],[47.6505,-122.40956],[47.65065,-122.40956],[47.65077,-122.40955],[47.65093,-122.4096],[47.65113,-122.40974],[47.65164,-122.41016],[47.65184,-122.41033],[47.6519,-122.41039],[47.65203,-122.41049],[47.65207,-122.41053]],[[47.59888,-122.32903],[47.59912,-122.32902],[47.59918,-122.32902],[47.5992,-122.32902]],[[47.65317,-122.39289],[47.65316,-122.39299],[47.65316,-122.39311],[47.65316,-122.39355],[47.65316,-122.39414],[47.65316,-122.39423],[47.65316,-122.39431],[47.65316,-122.39457],[47.65316,-122.39489],[47.65316,-122.39525],[47.65316,-122.39547],[47.65316,-122.39556]],[[47.61858,-122.35535],[47.61858,-122.3551],[47.61858,-122.35479]],[[47.63232,-122.3909],[47.63232,-122.39126],[47.63232,-122.3913],[47.63232,-122.39165],[47.63232,-122.3917],[47.63232,-122.39191]],[[47.63881,-122.40239],[47.6387,-122.40253],[47.63864,-122.40261],[47.63854,-122.40276],[47.63844,-122.40289],[47.63833,-122.40303],[47.63793,-122.40357],[47.63784,-122.40368],[47.63781,-122.40372],[47.6378,-122.40373]],[[47.60088,-122.32901],[47.60101,-122.32915],[47.60104,-122.32918],[47.60128,-122.32939],[47.6013,-122.32942],[47.60133,-122.32945],[47.60136,-122.32948],[47.60138,-122.32951],[47.6014,-122.32955],[47.60143,-122.32959],[47.60145,-122.32963],[47.60146,-122.32967],[47.60148,-122.32971],[47.60152,-122.32981]],[[47.637,-122.40541],[47.63703,-122.40555],[47.63708,-122.40566],[47.63723,-122.4059],[47.63729,-122.40599],[47.63734,-122.40607],[47.63746,-122.40625],[47.63749,-122.40631],[47.63758,-122.40643],[47.63769,-122.40655],[47.6377,-122.40657],[47.63782,-122.40663],[47.63809,-122.40673],[47.63829,-122.40686],[47.63843,-122.407],[47.6385,-122.40707],[47.63853,-122.40712],[47.63854,-122.40713],[47.63866,-122.40733],[47.63928,-122.4083],[47.63948,-122.40865],[47.63975,-122.40901],[47.64006,-122.4093],[47.64016,-122.40936],[47.64023,-122.4094],[47.64028,-122.40943]],[[47.60172,-122.33028],[47.60178,-122.33041],[47.60179,-122.33045],[47.6018,-122.33048],[47.60186,-122.33056],[47.60192,-122.33064]],[[47.63232,-122.39191],[47.63241,-122.3919],[47.63266,-122.3919],[47.63283,-122.3919],[47.63288,-122.3919],[47.6329,-122.3919],[47.63299,-122.39189],[47.6331,-122.39189],[47.63314,-122.39189],[47.63322,-122.39189],[47.63328,-122.39189],[47.63335,-122.39189],[47.6334,-122.39189],[47.63352,-122.39189],[47.63355,-122.39188],[47.63368,-122.39188],[47.63369,-122.39188],[47.63391,-122.39188],[47.63392,-122.39188],[47.63397,-122.39188],[47.63407,-122.39187],[47.6341,-122.39187],[47.63413,-122.39187],[47.63416,-122.39189]],[[47.65839,-122.39659],[47.65855,-122.3967],[47.65866,-122.39683],[47.65876,-122.39695],[47.65879,-122.39697],[47.65882,-122.397],[47.65891,-122.39708],[47.65913,-122.39718],[47.65932,-122.39727],[47.65947,-122.39734],[47.6599,-122.39755],[47.65999,-122.39759],[47.66006,-122.39763]],[[47.63359,-122.37548],[47.63359,-122.37637]],[[47.61863,-122.35739],[47.61861,-122.35727],[47.6186,-122.35714],[47.61859,-122.35703],[47.61859,-122.35694],[47.61859,-122.35692],[47.61859,-122.35675]],[[47.63274,-122.3895],[47.63267,-122.38961],[47.63261,-122.38972],[47.63255,-122.38983],[47.6325,-122.38995],[47.63246,-122.39008],[47.63241,-122.39025],[47.63239,-122.39032],[47.63237,-122.39043],[47.63235,-122.39055],[47.63234,-122.39067],[47.63233,-122.39078],[47.63232,-122.3909]],[[47.65407,-122.39566],[47.65414,-122.39566],[47.65418,-122.39566],[47.65422,-122.39566],[47.65427,-122.39566],[47.65575,-122.39568],[47.65595,-122.39568],[47.65601,-122.39568],[47.65606,-122.39568],[47.65624,-122.3957],[47.65645,-122.39573],[47.65692,-122.39584],[47.65722,-122.39599],[47.65744,-122.39608],[47.65776,-122.39625],[47.65831,-122.39654],[47.65839,-122.39659]],[[47.65316,-122.39556],[47.65324,-122.39556],[47.65395,-122.39556],[47.65402,-122.3956],[47.65407,-122.39566]],[[47.63337,-122.37478],[47.6334,-122.37484],[47.63347,-122.37497],[47.63351,-122.37507],[47.63355,-122.3752],[47.63358,-122.37535],[47.63359,-122.37548]],[[47.62309,-122.3638],[47.62319,-122.36393],[47.62344,-122.36422],[47.62352,-122.36432],[47.62381,-122.36466],[47.62384,-122.3647],[47.62402,-122.36492],[47.62412,-122.36505],[47.62419,-122.36513],[47.62442,-122.36542]],[[47.59787,-122.32904],[47.5976,-122.32903],[47.59752,-122.32903]],[[47.66006,-122.3978],[47.66006,-122.39804],[47.66006,-122.39822]],[[47.66006,-122.39822],[47.66009,-122.39826],[47.66016,-122.39835]],[[47.63348,-122.38284],[47.63349,-122.38302],[47.63349,-122.38331],[47.63349,-122.38671],[47.63348,-122.38769],[47.63347,-122.38785],[47.63346,-122.388],[47.63344,-122.38815],[47.6334,-122.38829],[47.63337,-122.38843],[47.63332,-122.38857],[47.63327,-122.3887],[47.63321,-122.38882],[47.63315,-122.38894],[47.63309,-122.38904],[47.63302,-122.38914],[47.63274,-122.3895]],[[47.63203,-122.37412],[47.63223,-122.37414],[47.63242,-122.37423],[47.63317,-122.37459],[47.63322,-122.37463],[47.63323,-122.37463],[47.63337,-122.37478]],[[47.59574,-122.32904],[47.59515,-122.32905]],[[47.59402,-122.32905],[47.59381,-122.32906]],[[47.61163,-122.3396],[47.6117,-122.33971],[47.61207,-122.34031],[47.61235,-122.34079],[47.61241,-122.3409]],[[47.63634,-122.39305],[47.6364,-122.39305],[47.63664,-122.39305],[47.6367,-122.39305],[47.63678,-122.39305],[47.63691,-122.39304],[47.63698,-122.39304],[47.63706,-122.39304],[47.63735,-122.39304],[47.63741,-122.39304],[47.63745,-122.39304],[47.63753,-122.39304],[47.63769,-122.39303],[47.63778,-122.39303],[47.63791,-122.39303],[47.63806,-122.39303],[47.63812,-122.39303],[47.6382,-122.39302],[47.63841,-122.39302],[47.63877,-122.39302],[47.63884,-122.39302]],[[47.6419,-122.39298],[47.64223,-122.39297],[47.64232,-122.39297],[47.64313,-122.39297],[47.6432,-122.39297],[47.64331,-122.39296],[47.64346,-122.39296],[47.64351,-122.39296],[47.64369,-122.39296],[47.64454,-122.39294],[47.64461,-122.39294],[47.64468,-122.39294],[47.64568,-122.39294],[47.64579,-122.39294],[47.64588,-122.39293],[47.64678,-122.39292],[47.64684,-122.39292],[47.6469,-122.39292],[47.64695,-122.39292],[47.64708,-122.39293],[47.64837,-122.39294],[47.64852,-122.39294],[47.64859,-122.39294],[47.64864,-122.39294],[47.6487,-122.39294],[47.64877,-122.39294],[47.64879,-122.39293],[47.65016,-122.3929],[47.65037,-122.3929],[47.65045,-122.3929],[47.6505,-122.3929],[47.65059,-122.39289],[47.65128,-122.39288],[47.65133,-122.39288],[47.65136,-122.39288],[47.65142,-122.39288],[47.65169,-122.39288],[47.65198,-122.39288],[47.65204,-122.39288],[47.65216,-122.39289],[47.6522,-122.39289],[47.65228,-122.39289],[47.65233,-122.39289],[47.6531,-122.39289],[47.65317,-122.39289]],[[47.61859,-122.35675],[47.61859,-122.35662],[47.61859,-122.35627]],[[47.63142,-122.3746],[47.63152,-122.37446],[47.63165,-122.37427]],[[47.6306,-122.37357],[47.63099,-122.37406],[47.63106,-122.37415],[47.63116,-122.37427],[47.63142,-122.3746]],[[47.63359,-122.37637],[47.63359,-122.37727]],[[47.63359,-122.37727],[47.63359,-122.378],[47.63359,-122.37875],[47.63359,-122.37889],[47.63359,-122.37911],[47.63359,-122.37942],[47.63358,-122.38004],[47.63356,-122.38015]],[[47.6202,-122.36005],[47.62025,-122.36015],[47.62035,-122.36033],[47.62047,-122.36054],[47.62052,-122.36064]],[[47.61859,-122.35141],[47.61851,-122.35128],[47.61831,-122.35094],[47.61823,-122.3508]],[[47.61858,-122.35344],[47.61858,-122.35299],[47.61858,-122.35286]],[[47.61858,-122.35286],[47.61859,-122.35275],[47.61859,-122.35206],[47.61859,-122.35195],[47.61859,-122.35141]],[[47.60277,-122.33142],[47.60284,-122.33148],[47.60344,-122.33203],[47.60348,-122.33207]],[[47.63165,-122.37427],[47.63169,-122.37422],[47.63175,-122.37417],[47.6318,-122.37414],[47.63186,-122.37411],[47.63194,-122.3741],[47.63203,-122.37412]],[[47.62052,-122.36064],[47.6207,-122.36095]],[[47.61602,-122.34703],[47.61596,-122.34694],[47.61592,-122.34687],[47.61581,-122.34668],[47.61554,-122.34622],[47.61548,-122.34611]],[[47.61602,-122.34703],[47.61608,-122.34714],[47.61653,-122.3479],[47.61658,-122.34799],[47.61663,-122.34807],[47.6168,-122.34837],[47.61694,-122.34861]],[[47.60004,-122.32901],[47.60006,-122.32901],[47.6001,-122.32901],[47.60054,-122.32901],[47.60071,-122.32901]],[[47.61457,-122.34457],[47.61438,-122.34425],[47.61427,-122.34407],[47.61399,-122.3436],[47.61393,-122.34351]],[[47.60491,-122.33338],[47.60484,-122.33332],[47.60432,-122.33284],[47.60427,-122.33279],[47.60419,-122.33272]],[[47.60849,-122.33665],[47.60817,-122.33635],[47.60783,-122.33604],[47.60776,-122.33598]],[[47.62792,-122.37013],[47.62799,-122.37021],[47.62801,-122.37024]],[[47.62663,-122.36841],[47.62706,-122.36898],[47.62713,-122.36908]],[[47.64053,-122.40097],[47.64116,-122.40097],[47.64124,-122.40097],[47.64158,-122.40097],[47.64173,-122.40097],[47.64299,-122.40098],[47.643,-122.40098],[47.64312,-122.40098],[47.64316,-122.40098],[47.6448,-122.40095],[47.64494,-122.40094],[47.64501,-122.40094],[47.64508,-122.40094],[47.6452,-122.40094],[47.64661,-122.40094],[47.64677,-122.40094],[47.64683,-122.40094],[47.64691,-122.40094],[47.64706,-122.40094],[47.64842,-122.40093],[47.64857,-122.40093],[47.64863,-122.40093],[47.64871,-122.40093],[47.64886,-122.40093],[47.65023,-122.40092],[47.65038,-122.40092],[47.65045,-122.40092],[47.65052,-122.40092],[47.65065,-122.40092],[47.65218,-122.40092],[47.65225,-122.40093],[47.65232,-122.40092],[47.65245,-122.40092],[47.65297,-122.40092],[47.65377,-122.40091],[47.654,-122.40091],[47.65406,-122.40091],[47.65413,-122.40091],[47.65423,-122.40091],[47.65434,-122.40091],[47.6549,-122.4009],[47.65564,-122.4009],[47.6558,-122.4009],[47.65586,-122.4009],[47.65594,-122.40089],[47.65608,-122.40089],[47.65729,-122.40088],[47.65751,-122.40088],[47.65762,-122.40088],[47.65765,-122.40088]],[[47.63955,-122.40099],[47.63946,-122.40104],[47.63937,-122.40111],[47.63924,-122.40113]],[[47.63416,-122.39189],[47.63418,-122.39195],[47.6342,-122.392],[47.6342,-122.39201],[47.63421,-122.3921],[47.63421,-122.39213],[47.63421,-122.39228],[47.63421,-122.39238],[47.63421,-122.39247],[47.63421,-122.39261],[47.63422,-122.39281],[47.63423,-122.39291],[47.63426,-122.39297],[47.63431,-122.39308]],[[47.66016,-122.39835],[47.66009,-122.39847],[47.66005,-122.39861],[47.66003,-122.39876],[47.66001,-122.39886],[47.65996,-122.39937],[47.65994,-122.39953],[47.65993,-122.39964],[47.65992,-122.3997],[47.65991,-122.39981],[47.6599,-122.39991],[47.65987,-122.40002],[47.65985,-122.4001],[47.65983,-122.40018],[47.65981,-122.40024],[47.65977,-122.40032],[47.65973,-122.4004],[47.65968,-122.40049],[47.65963,-122.40057]],[[47.62606,-122.36762],[47.62625,-122.36789],[47.62632,-122.36798],[47.62634,-122.36801]],[[47.62634,-122.36801],[47.62637,-122.36805],[47.62647,-122.36819],[47.62663,-122.36841]],[[47.6138,-122.34327],[47.61322,-122.34228],[47.61317,-122.3422]],[[47.61241,-122.3409],[47.61246,-122.34098],[47.61253,-122.3411],[47.61261,-122.34124]],[[47.60704,-122.33532],[47.60701,-122.33528],[47.60693,-122.33521],[47.60654,-122.33487],[47.6064,-122.33474],[47.60634,-122.33469]],[[47.63033,-122.37324],[47.6306,-122.37357]],[[47.62742,-122.36946],[47.62765,-122.36977],[47.62778,-122.36994],[47.62792,-122.37013]],[[47.62713,-122.36908],[47.62717,-122.36913],[47.62734,-122.36935],[47.62742,-122.36946]],[[47.62189,-122.3624],[47.62205,-122.36258],[47.62213,-122.36267]],[[47.6207,-122.36095],[47.62095,-122.36128]],[[47.62213,-122.36267],[47.62221,-122.36277],[47.62235,-122.36294],[47.62241,-122.36301]],[[47.60192,-122.33064],[47.60208,-122.33079],[47.60209,-122.3308]],[[47.60071,-122.32901],[47.60079,-122.32901],[47.60081,-122.32901],[47.60088,-122.32901]],[[47.59845,-122.32905],[47.59862,-122.32903],[47.59881,-122.32903]],[[47.59845,-122.32905],[47.59787,-122.32904]],[[47.59752,-122.32903],[47.59718,-122.32903]],[[47.59718,-122.32903],[47.59669,-122.32904],[47.59648,-122.32904]],[[47.61799,-122.35039],[47.61803,-122.35046],[47.61807,-122.35054],[47.61818,-122.35072],[47.61823,-122.3508]],[[47.61768,-122.34986],[47.61772,-122.34994],[47.61796,-122.35035],[47.61799,-122.35039]],[[47.61897,-122.35798],[47.61908,-122.35816],[47.61978,-122.35935]],[[47.62174,-122.36223],[47.62189,-122.3624]],[[47.61997,-122.35966],[47.62007,-122.35984],[47.6201,-122.35988],[47.6202,-122.36005]],[[47.61978,-122.35935],[47.61997,-122.35966]],[[47.65765,-122.40088],[47.65772,-122.40088],[47.65797,-122.40089],[47.65802,-122.40089],[47.65847,-122.40089],[47.65879,-122.4009],[47.65899,-122.4009],[47.65904,-122.40093],[47.65906,-122.40094],[47.65906,-122.40095],[47.65916,-122.40103]],[[47.60209,-122.3308],[47.60213,-122.33083],[47.60218,-122.33088],[47.60222,-122.33092],[47.60261,-122.33127],[47.60272,-122.33137],[47.60277,-122.33142]],[[47.60152,-122.32981],[47.60161,-122.33004],[47.60164,-122.3301],[47.60172,-122.33028]],[[47.59881,-122.32903],[47.59888,-122.32903]],[[47.63431,-122.39308],[47.63443,-122.39308],[47.6345,-122.39308],[47.63457,-122.39308],[47.63492,-122.39307],[47.63492,-122.39307],[47.63502,-122.39307],[47.63514,-122.39307]],[[47.63985,-122.40098],[47.63992,-122.40098],[47.63996,-122.40098],[47.64004,-122.40098]],[[47.63955,-122.40099],[47.63964,-122.40098],[47.63972,-122.40098],[47.63985,-122.40098]],[[47.63924,-122.40113],[47.63923,-122.40123],[47.63922,-122.40132],[47.63919,-122.40152],[47.63914,-122.4017],[47.63908,-122.40188],[47.63901,-122.40206],[47.63899,-122.4021],[47.63893,-122.40222],[47.63888,-122.4023],[47.63881,-122.40239]],[[47.59381,-122.32906],[47.5936,-122.32906],[47.59344,-122.32906],[47.59334,-122.32906]],[[47.63356,-122.38015],[47.63355,-122.38163],[47.63352,-122.38246],[47.63348,-122.38284]],[[47.61694,-122.34861],[47.61708,-122.34884],[47.61713,-122.34893]],[[47.66006,-122.39763],[47.66006,-122.3978]],[[47.65207,-122.41053],[47.65212,-122.41057],[47.65225,-122.41067],[47.6523,-122.4107],[47.65261,-122.41092],[47.65273,-122.41098],[47.65288,-122.41101],[47.65403,-122.41104],[47.6541,-122.41104]],[[47.6541,-122.41104],[47.6541,-122.41175]],[[47.65963,-122.40057],[47.65957,-122.40064],[47.65948,-122.40073],[47.65946,-122.40075],[47.65926,-122.40094],[47.65923,-122.40097],[47.65916,-122.40103]],[[47.60704,-122.33532],[47.60712,-122.33538],[47.60772,-122.33594],[47.60776,-122.33598]],[[47.61713,-122.34893],[47.61717,-122.349],[47.61763,-122.34978],[47.61768,-122.34986]],[[47.61103,-122.33898],[47.61147,-122.3394],[47.61152,-122.33944],[47.61156,-122.33948],[47.6116,-122.33954],[47.61163,-122.3396]],[[47.60977,-122.33782],[47.60981,-122.33786],[47.60999,-122.33803],[47.61017,-122.33819],[47.61067,-122.33865],[47.61075,-122.33872]],[[47.60634,-122.33469],[47.60627,-122.33463],[47.60569,-122.33408],[47.60563,-122.33403]],[[47.61548,-122.34611],[47.61542,-122.34602],[47.61525,-122.34573],[47.61505,-122.34539],[47.61476,-122.3449],[47.6147,-122.3448]],[[47.61075,-122.33872],[47.61083,-122.3388],[47.61101,-122.33896]],[[47.64004,-122.40098],[47.64015,-122.40098],[47.64025,-122.40098],[47.64053,-122.40097]],[[47.62241,-122.36301],[47.62257,-122.36319],[47.62261,-122.36323],[47.62276,-122.36341],[47.62309,-122.3638]],[[47.6378,-122.40373],[47.63773,-122.40383],[47.63762,-122.40399],[47.63711,-122.40469],[47.63706,-122.40479],[47.63702,-122.4049],[47.63699,-122.40503],[47.63699,-122.40508],[47.63698,-122.40516],[47.63698,-122.40529],[47.63699,-122.40536],[47.637,-122.40541]],[[47.64028,-122.40943],[47.64035,-122.40947],[47.64036,-122.40948],[47.64057,-122.40958],[47.64068,-122.40962],[47.64078,-122.40964],[47.64091,-122.40968],[47.64127,-122.40969],[47.64141,-122.40969],[47.64142,-122.40969],[47.64149,-122.40969],[47.6417,-122.40969],[47.64203,-122.40968],[47.64232,-122.40967],[47.64237,-122.40967],[47.64242,-122.40967],[47.64318,-122.40965],[47.64319,-122.40965],[47.64323,-122.40965],[47.64328,-122.40965],[47.6433,-122.40965],[47.64345,-122.40965],[47.64485,-122.40964],[47.64494,-122.40964],[47.645,-122.40964]],[[47.60348,-122.33207],[47.60354,-122.33212],[47.60383,-122.33239],[47.60401,-122.33255],[47.60414,-122.33267],[47.60419,-122.33272]],[[47.60876,-122.33689],[47.60882,-122.33695],[47.6091,-122.33721],[47.60958,-122.33764],[47.6097,-122.33776],[47.60977,-122.33782]],[[47.60563,-122.33403],[47.60558,-122.33398],[47.60545,-122.33386],[47.6053,-122.33374],[47.60497,-122.33344],[47.60491,-122.33338]],[[47.61858,-122.35611],[47.61858,-122.35554],[47.61858,-122.35545],[47.61858,-122.35535]],[[47.61275,-122.34147],[47.61311,-122.34209],[47.61317,-122.3422]],[[47.6147,-122.3448],[47.61465,-122.34472],[47.61457,-122.34457]],[[47.59515,-122.32905],[47.59478,-122.32905],[47.59459,-122.32905]],[[47.61101,-122.33896],[47.61103,-122.33898]],[[47.61261,-122.34124],[47.61275,-122.34147]],[[47.6212,-122.36158],[47.6214,-122.36182],[47.62147,-122.36191],[47.62161,-122.36208],[47.62174,-122.36223]],[[47.60876,-122.33689],[47.60869,-122.33683],[47.60849,-122.33665]],[[47.62801,-122.37024],[47.62848,-122.37086],[47.62853,-122.37093],[47.62864,-122.37108],[47.6287,-122.37115],[47.62872,-122.37118],[47.62884,-122.37134],[47.62892,-122.37144],[47.62904,-122.37159],[47.62924,-122.37184],[47.62928,-122.37189],[47.62959,-122.37229],[47.62962,-122.37233],[47.62974,-122.37248],[47.62975,-122.3725],[47.62987,-122.37266],[47.63011,-122.37295],[47.63026,-122.37315],[47.63029,-122.37318],[47.63033,-122.37324]],[[47.61858,-122.35416],[47.61858,-122.35405],[47.61858,-122.35352],[47.61858,-122.35344]],[[47.59967,-122.32911],[47.59995,-122.3291],[47.59996,-122.3291],[47.59999,-122.32907],[47.60004,-122.32901]],[[47.62453,-122.36557],[47.62458,-122.36563],[47.6247,-122.36577]],[[47.6247,-122.36577],[47.62476,-122.36585],[47.62503,-122.36621],[47.62515,-122.36637],[47.62529,-122.36657],[47.62545,-122.36678],[47.62574,-122.36719],[47.6259,-122.3674],[47.62591,-122.36742],[47.62598,-122.36751],[47.62606,-122.36762]],[[47.62442,-122.36542],[47.62453,-122.36557]],[[47.61858,-122.35479],[47.61858,-122.35416]],[[47.59423,-122.32905],[47.59402,-122.32905]],[[47.59648,-122.32904],[47.59619,-122.32904],[47.59574,-122.32904]],[[47.61393,-122.34351],[47.61389,-122.34343],[47.6138,-122.34327]],[[47.63514,-122.39307],[47.63523,-122.39307],[47.63587,-122.39306],[47.63592,-122.39306],[47.636,-122.39306],[47.6362,-122.39305],[47.63628,-122.39305],[47.63634,-122.39305]],[[47.62095,-122.36128],[47.62115,-122.36152],[47.6212,-122.36158]],[[47.61859,-122.35627],[47.61858,-122.35611]],[[47.59459,-122.32905],[47.59423,-122.32905]],[[47.5992,-122.32902],[47.59922,-122.32904],[47.59931,-122.3291],[47.59932,-122.32911],[47.59933,-122.32912],[47.59967,-122.32911]],[[47.63884,-122.39302],[47.63891,-122.39301],[47.63896,-122.39301],[47.63914,-122.39301],[47.63918,-122.39301],[47.63934,-122.39301],[47.63949,-122.39301],[47.63952,-122.39301],[47.63956,-122.39301]],[[47.63956,-122.39301],[47.64002,-122.393],[47.64008,-122.393],[47.64028,-122.393],[47.64065,-122.39299],[47.6411,-122.39298],[47.64116,-122.39298],[47.64123,-122.39298],[47.64129,-122.39298],[47.64156,-122.39298],[47.6419,-122.39298]],[[47.61866,-122.35744],[47.6189,-122.35785],[47.61897,-122.35798]]] }
  ];

  // Bus stops along Routes 24 & 33 — also pulled from OSM (highway=bus_stop
  // nodes that are members of the route relations), deduplicated by node id.
  const BUS_STOPS = (window.__SITE__ && window.__SITE__.data.busStops) || [];

  let activeCategory = 'all';
  let activePlaceId = null;
  const markersById = {};
  let map = null;
  let leafletReady = false;

  // ----- List rendering (works with or without map) -----
  function getFilteredPlaces() {
    const places = activeCategory === 'all'
      ? PLACES.slice()
      : PLACES.filter(p => p.cat === activeCategory);
    return places.sort((a, b) => a.dist - b.dist);
  }

  function renderList() {
    const listEl = document.getElementById('nb-place-list');
    if (!listEl) return;
    const filtered = getFilteredPlaces();
    const countEl = document.getElementById('visible-count');
    if (countEl) countEl.textContent = filtered.length;

    if (filtered.length === 0) {
      listEl.innerHTML = `<div class="nb-place-empty"><strong>Nothing here yet</strong>Try another category.</div>`;
      return;
    }

    listEl.innerHTML = filtered.map((p, i) => {
      const color = CATEGORIES[p.cat].color;
      const activeClass = p.id === activePlaceId ? ' is-active' : '';
      return `
        <li class="nb-place${activeClass}" data-place-id="${p.id}" data-cat="${p.cat}" style="animation-delay:${Math.min(i, 12) * 24}ms">
          <span class="nb-place-dot" style="background:${color}"></span>
          <div>
            <div class="nb-place-name">${p.name}</div>
            <div class="nb-place-desc">${p.desc}</div>
          </div>
          <div class="nb-place-meta">
            <span class="nb-place-time">${p.time}</span>
            <span class="nb-place-distance">${p.distance}</span>
          </div>
        </li>
      `;
    }).join('');

    listEl.querySelectorAll('.nb-place').forEach(el => {
      el.addEventListener('click', () => {
        const id = parseInt(el.dataset.placeId, 10);
        setActivePlace(id, true);
      });
    });
  }

  function updateActiveStates() {
    document.querySelectorAll('.nb-place').forEach(el => {
      el.classList.toggle('is-active', parseInt(el.dataset.placeId, 10) === activePlaceId);
    });
    document.querySelectorAll('.marker-dot').forEach(el => {
      el.classList.toggle('is-active', parseInt(el.dataset.placeId, 10) === activePlaceId);
    });
  }

  function setActivePlace(id, fromList) {
    activePlaceId = id;
    updateActiveStates();
    if (!leafletReady) return;
    const m = markersById[id];
    if (!m) return;
    if (fromList) {
      map.flyTo([m.place.lat, m.place.lng], Math.max(map.getZoom(), 15), { duration: 0.7 });
      setTimeout(() => m.marker.openPopup(), 720);
    } else {
      m.marker.openPopup();
    }
  }

  function filterByCategory(cat) {
    activeCategory = cat;
    activePlaceId = null;

    document.querySelectorAll('.nb-pill').forEach(p => {
      p.classList.toggle('is-active', p.dataset.cat === cat);
    });

    if (leafletReady) {
      PLACES.forEach(p => {
        const show = cat === 'all' || p.cat === cat;
        const m = markersById[p.id];
        if (!m) return;
        if (show && !map.hasLayer(m.marker)) m.marker.addTo(map);
        else if (!show && map.hasLayer(m.marker)) map.removeLayer(m.marker);
      });

      const visible = getFilteredPlaces();
      if (visible.length > 0 && cat !== 'all') {
        const bounds = L.latLngBounds(visible.map(p => [p.lat, p.lng]));
        if (PROPERTY.lat != null) bounds.extend([PROPERTY.lat, PROPERTY.lng]);
        map.flyToBounds(bounds, { padding: [60, 60], duration: 0.8, maxZoom: 15 });
      } else if (cat === 'all') {
        if (PROPERTY.lat != null) map.flyTo([PROPERTY.lat, PROPERTY.lng], 14, { duration: 0.6 });
      }
    }

    renderList();
  }

  // ----- Wire up filter pills, counts, initial list (always runs) -----
  document.querySelectorAll('.nb-pill').forEach(p => {
    p.addEventListener('click', () => filterByCategory(p.dataset.cat));
  });

  const allCountEl = document.querySelector('[data-count="all"]');
  if (allCountEl) allCountEl.textContent = PLACES.length;
  Object.keys(CATEGORIES).forEach(cat => {
    const count = PLACES.filter(p => p.cat === cat).length;
    const el = document.querySelector(`[data-count="${cat}"]`);
    if (el) el.textContent = count;
  });

  renderList();

  // ----- Map init: only if Leaflet loaded -----
  function initLeafletMap() {
    if (typeof L === 'undefined') return false;
    // A site with no coordinates anywhere has nothing to centre on. Skip rather
    // than let Leaflet throw or centre on an arbitrary point.
    const centre = mapCentre();
    if (!centre) return false;

    try {
      map = L.map('leaflet-map', {
        center: centre,
        zoom: 14,
        zoomControl: false,
        scrollWheelZoom: true,
        attributionControl: true
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OSM</a>, © <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
      }).addTo(map);

      L.control.zoom({ position: 'topright' }).addTo(map);

      // Home marker
      const homeIcon = L.divIcon({
        className: '',
        html: `<div class="marker-home"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });
      if (PROPERTY.lat != null) L.marker([PROPERTY.lat, PROPERTY.lng], { icon: homeIcon, zIndexOffset: 1000 })
        .addTo(map)
        .bindPopup(`<div class="map-popup home"><span class="cat"><span class="dot" style="background:var(--accent)"></span>You are here</span><h4>${PROPERTY.name}</h4><p>${PROPERTY.address}</p><div class="foot"><span>${homesLabel()}</span><span>${fromLabel()}</span></div></div>`);

      // Sibling buildings get the same marker, named individually — a renter
      // looking at a home on a different street should see where it actually is.
      BUILDINGS.forEach((b) => {
        L.marker([b.lat, b.lng], { icon: homeIcon, zIndexOffset: 900 })
          .addTo(map)
          .bindPopup(`<div class="map-popup home"><span class="cat"><span class="dot" style="background:var(--accent)"></span>Building</span><h4>${b.name}</h4><p>${b.address}</p></div>`);
      });

      // Bus routes — drawn once, beneath the markers, always visible
      BUS_ROUTES.forEach(r => {
        L.polyline(r.segments, { color: '#f4f1ec', weight: 7, opacity: 0.7 }).addTo(map);
        L.polyline(r.segments, {
          color: '#3d5a6c', weight: 3.5, opacity: 0.85,
          dashArray: r.dash, lineJoin: 'round', lineCap: 'round'
        }).addTo(map)
          .bindPopup(`<div class="map-popup"><span class="cat"><span class="dot" style="background:#3d5a6c"></span>Transit</span><h4>${r.name}</h4><p>Direct service to Downtown Seattle</p></div>`);
      });

      // Bus stops along those routes — small dots on the line
      BUS_STOPS.forEach(s => {
        L.circleMarker([s.lat, s.lng], {
          radius: 3.5,
          fillColor: '#3d5a6c',
          fillOpacity: 1,
          color: '#f4f1ec',
          weight: 1.5
        }).addTo(map)
          .bindPopup(`<div class="map-popup"><span class="cat"><span class="dot" style="background:#3d5a6c"></span>Bus stop</span><h4>${s.name}</h4></div>`);
      });

      // Place markers
      PLACES.forEach(place => {
        const color = CATEGORIES[place.cat].color;
        const icon = L.divIcon({
          className: '',
          html: `<div class="marker-dot" data-place-id="${place.id}" style="background:${color}"></div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        });
        const marker = L.marker([place.lat, place.lng], { icon })
          .bindPopup(`<div class="map-popup"><span class="cat"><span class="dot" style="background:${color}"></span>${CATEGORIES[place.cat].label}</span><h4>${place.name}</h4><p>${place.desc}</p><div class="foot"><span>${place.time}</span><span>${place.distance}</span></div></div>`);

        marker.on('click', () => setActivePlace(place.id, false));
        marker.on('popupopen', () => {
          activePlaceId = place.id;
          updateActiveStates();
          const listItem = document.querySelector(`.nb-place[data-place-id="${place.id}"]`);
          if (listItem) listItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
        marker.on('popupclose', () => {
          if (activePlaceId === place.id) {
            activePlaceId = null;
            updateActiveStates();
          }
        });

        markersById[place.id] = { marker, place };
        marker.addTo(map);
      });

      leafletReady = true;

      // Invalidate size on visibility (handles hidden-at-load case)
      const mapObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) map.invalidateSize();
        });
      }, { threshold: 0.1 });
      mapObserver.observe(document.getElementById('leaflet-map'));

      return true;
    } catch (err) {
      console.error('Map init failed:', err);
      return false;
    }
  }

  function showMapFallback() {
    const mapEl = document.getElementById('leaflet-map');
    const legend = document.querySelector('.nb-map-overlay-legend');
    if (legend) legend.style.display = 'none';
    if (!mapEl) return;
    mapEl.innerHTML = `
      <div class="nb-map-fallback">
        <div class="nb-map-fallback-inner">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-7.5-7-12a7 7 0 1 1 14 0c0 4.5-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>
          <h4>Interactive map unavailable</h4>
          <p>The map couldn't load in this preview. Browse the full list of nearby places, or open the location in Google Maps.</p>
          <a href="https://maps.google.com/maps?t=m&z=14&q=2701+W+Manor+Pl%2C+Seattle%2C+WA+98199" target="_blank" rel="noopener" class="btn btn-primary">Open in Google Maps →</a>
        </div>
      </div>
    `;
  }

  // Try immediate init; if Leaflet isn't there yet, wait for window load; if it still
  // isn't there, fall back to a graceful static state. The list works either way.
  if (!initLeafletMap()) {
    window.addEventListener('load', () => {
      if (!initLeafletMap()) {
        showMapFallback();
      }
    });
  }

  // ============== GALLERY & LIGHTBOX ==============
  const GALLERY_CATS = {
    interior: 'Interior',
    exterior: 'Exterior',
    units: 'Units',
    neighborhood: 'Neighborhood'
  };

  // Photo data — Unsplash IDs with Picsum seeds as automatic fallback
  // (Replace imgId values with actual property photos when available)
  const PHOTOS = (window.__SITE__ && window.__SITE__.data.photos) || [];

  const PHOTO_PLACEHOLDER =
    '<div class="gallery-item-placeholder">' +
      '<span class="ph-eyebrow">Photography</span>' +
      '<span class="ph-title">Coming <em>soon.</em></span>' +
    '</div>';

  let galleryCat = 'all';
  let lightboxIdx = 0;
  let lightboxList = [];

  function getGalleryPhotos() {
    return galleryCat === 'all' ? PHOTOS.slice() : PHOTOS.filter(p => p.cat === galleryCat);
  }

  function renderGallery() {
    const strip = document.getElementById('gallery-strip');
    if (!strip) return;
    const photos = getGalleryPhotos();
    strip.innerHTML = photos.map((p, i) => {
      const delay = Math.min(i, 12) * 35;
      const media = p.src
        ? `<img class="gallery-item-photo" src="${p.src}" alt="${p.title}" loading="lazy" />`
        : PHOTO_PLACEHOLDER;
      return `
        <button class="gallery-item" type="button" data-photo-id="${p.id}" style="animation-delay:${delay}ms" aria-label="View ${p.title}">
          <div class="gallery-item-img">
            ${media}
          </div>
          <div class="gallery-item-info">
            <span class="gallery-item-cat">${GALLERY_CATS[p.cat]}</span>
            <span class="gallery-item-title">${p.title}</span>
          </div>
        </button>
      `;
    }).join('');

    // photos.json ships the intended filename for every slot, so a photo that
    // hasn't been supplied yet 404s. Fall back to the placeholder rather than
    // showing a broken image.
    strip.querySelectorAll('.gallery-item-photo').forEach(img => {
      img.addEventListener('error', () => {
        const wrap = img.closest('.gallery-item-img');
        if (wrap) wrap.innerHTML = PHOTO_PLACEHOLDER;
      }, { once: true });
    });

    strip.querySelectorAll('.gallery-item').forEach(el => {
      el.addEventListener('click', () => {
        const id = parseInt(el.dataset.photoId, 10);
        openLightbox(id);
      });
    });

    // Reset scroll position and update nav visibility
    strip.scrollLeft = 0;
    updateStripNav();
  }

  // Strip nav (prev/next + edge fades)
  function updateStripNav() {
    const strip = document.getElementById('gallery-strip');
    const wrap = document.querySelector('.gallery-strip-wrap');
    if (!strip || !wrap) return;
    const sl = strip.scrollLeft;
    const max = strip.scrollWidth - strip.clientWidth;
    const atStart = sl < 8;
    const atEnd = sl >= max - 8 || max <= 0;
    wrap.classList.toggle('is-at-start', atStart);
    wrap.classList.toggle('is-at-end', atEnd);
    const prev = wrap.querySelector('.strip-prev');
    const next = wrap.querySelector('.strip-next');
    if (prev) prev.classList.toggle('is-hidden', atStart);
    if (next) next.classList.toggle('is-hidden', atEnd);
  }

  function scrollStrip(dir) {
    const strip = document.getElementById('gallery-strip');
    if (!strip) return;
    const amount = Math.max(strip.clientWidth * 0.7, 360);
    strip.scrollBy({ left: dir * amount, behavior: 'smooth' });
  }

  document.querySelector('.strip-prev')?.addEventListener('click', () => scrollStrip(-1));
  document.querySelector('.strip-next')?.addEventListener('click', () => scrollStrip(1));
  document.getElementById('gallery-strip')?.addEventListener('scroll', () => {
    requestAnimationFrame(updateStripNav);
  }, { passive: true });
  window.addEventListener('resize', () => requestAnimationFrame(updateStripNav));

  // Lightbox
  const lightboxEl = document.getElementById('lightbox');
  const lbImg = document.getElementById('lightbox-img');
  const lbCat = document.getElementById('lightbox-cat');
  const lbTitle = document.getElementById('lightbox-title');
  const lbDesc = document.getElementById('lightbox-desc');
  const lbCounter = document.getElementById('lightbox-counter');

  function openLightbox(photoId) {
    lightboxList = getGalleryPhotos();
    lightboxIdx = lightboxList.findIndex(p => p.id === photoId);
    if (lightboxIdx < 0) lightboxIdx = 0;
    lightboxEl.classList.add('is-open');
    lightboxEl.setAttribute('aria-hidden', 'false');
    document.body.classList.add('lightbox-open');
    updateLightbox();
  }

  function closeLightbox() {
    lightboxEl.classList.remove('is-open');
    lightboxEl.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('lightbox-open');
  }

  function updateLightbox() {
    const p = lightboxList[lightboxIdx];
    if (!p) return;
    lbCat.textContent = GALLERY_CATS[p.cat];
    lbTitle.textContent = p.title;
    lbDesc.textContent = p.desc;
    lbCounter.textContent = `${lightboxIdx + 1} / ${lightboxList.length}`;
    if (lbImg) {
      // #lightbox-img is the "coming soon" placeholder <div>; the photo is a
      // separate <img>. Show whichever applies, and fall back to the placeholder
      // if the file hasn't been uploaded yet.
      const lbPhoto = document.getElementById('lightbox-photo');
      if (p.src && lbPhoto) {
        // Hide the placeholder up front: waiting for onload flashes the
        // "Coming soon" card on every open of a photo that does exist.
        lbImg.hidden = true;
        lbPhoto.onerror = () => { lbPhoto.hidden = true; lbImg.hidden = false; };
        lbPhoto.onload = () => { lbPhoto.hidden = false; lbImg.hidden = true; };
        lbPhoto.alt = p.title;
        lbPhoto.src = p.src;
      } else {
        if (lbPhoto) { lbPhoto.hidden = true; lbPhoto.removeAttribute('src'); }
        lbImg.hidden = false;
      }
    }
    // Reset animation
    lbImg.style.animation = 'none';
    void lbImg.offsetHeight;
    lbImg.style.animation = '';
  }

  function nextLightbox() {
    lightboxIdx = (lightboxIdx + 1) % lightboxList.length;
    updateLightbox();
  }
  function prevLightbox() {
    lightboxIdx = (lightboxIdx - 1 + lightboxList.length) % lightboxList.length;
    updateLightbox();
  }

  // Wire gallery tabs
  document.querySelectorAll('.gallery-tab').forEach(t => {
    t.addEventListener('click', () => {
      galleryCat = t.dataset.cat;
      document.querySelectorAll('.gallery-tab').forEach(x => x.classList.toggle('is-active', x === t));
      renderGallery();
    });
  });

  // Wire lightbox controls
  document.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
  document.querySelector('.lightbox-prev').addEventListener('click', prevLightbox);
  document.querySelector('.lightbox-next').addEventListener('click', nextLightbox);
  document.querySelectorAll('[data-lb-close]').forEach(el => {
    el.addEventListener('click', closeLightbox);
  });

  document.addEventListener('keydown', (e) => {
    if (!lightboxEl.classList.contains('is-open')) return;
    if (e.key === 'Escape')      { e.preventDefault(); closeLightbox(); }
    if (e.key === 'ArrowRight')  { e.preventDefault(); nextLightbox(); }
    if (e.key === 'ArrowLeft')   { e.preventDefault(); prevLightbox(); }
  });

  // Update tab counts
  document.querySelector('.gallery-tab[data-cat="all"] .g-count').textContent = PHOTOS.length;
  Object.keys(GALLERY_CATS).forEach(cat => {
    const el = document.querySelector(`.gallery-tab[data-cat="${cat}"] .g-count`);
    if (el) el.textContent = PHOTOS.filter(p => p.cat === cat).length;
  });

  renderGallery();

  // ============== FORM ==============
  function handleSubmit(e) {
    e.preventDefault();
    const btn = e.target.querySelector('.form-submit');
    const original = btn.innerHTML;
    btn.innerHTML = 'Thanks — we\'ll be in touch ✓';
    btn.style.background = 'var(--accent)';
    setTimeout(() => {
      e.target.reset();
      btn.innerHTML = original;
      btn.style.background = '';
    }, 2800);
  }

  // ============== MOVE-IN COST CALCULATOR ==============
  (function () {
    const sel = document.getElementById('mc-unit');
    if (!sel) return;
    const SCREENING = 50; // per adult
    const linesEl = document.getElementById('mc-lines');
    const totalEl = document.getElementById('mc-total');
    const footEl = document.getElementById('mc-foot');
    const adultsEl = document.getElementById('mc-adults');
    const specialEl = document.getElementById('mc-special');
    let adults = 1;

    // Populate from priced UNITS (skip inquire-only), 1BR then 2BR
    const priced = UNITS.filter(u => u.rent != null).sort((a, b) => a.beds - b.beds || a.rent - b.rent);
    sel.innerHTML = priced.map(u =>
      `<option value="${uidOf(u)}">Unit ${u.id}${MULTI_PROPERTY && u.property ? " · " + u.property : ""} · ${PLAN_LABELS[u.plan]} · $${u.rent.toLocaleString()}/mo</option>`
    ).join('');

    function money(n) { return '$' + Math.round(n).toLocaleString(); }

    function render() {
      const u = UNITS.find(x => x.id === sel.value);
      adultsEl.textContent = adults;
      if (!u || u.rent == null) {
        linesEl.innerHTML = '';
        totalEl.textContent = 'Contact us';
        footEl.textContent = 'Pricing for this home is available on request — call (206) 694-1713.';
        return;
      }
      const special = specialEl.checked;
      const screening = SCREENING * adults;
      const credit = special ? u.rent : 0;
      const total = u.rent + u.rent + screening - credit;
      const rows = [
        { label: 'First month\'s rent', val: u.rent },
        { label: 'Refundable security deposit', val: u.rent },
        { label: 'Screening fee · ' + adults + ' adult' + (adults === 1 ? '' : 's'), val: screening }
      ];
      let html = rows.map(r => `<div class="mc-line"><span>${r.label}</span><strong>${money(r.val)}</strong></div>`).join('');
      if (special) html += `<div class="mc-line is-credit"><span>1-month-free special</span><strong>−${money(credit)}</strong></div>`;
      linesEl.innerHTML = html;
      totalEl.textContent = money(total);
      footEl.textContent = 'Estimate only. Water/sewer/garbage ($100/mo, +$50 per extra occupant) and electricity are billed monthly, not at signing. Renters insurance required.';
    }

    sel.addEventListener('change', render);
    specialEl.addEventListener('change', render);
    document.querySelector('[data-mc-stepper="adults"]').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-mc-step]');
      if (!btn) return;
      adults = Math.min(6, Math.max(1, adults + parseInt(btn.dataset.mcStep, 10)));
      render();
    });
    render();
  })();

  // ============== COMMUTE ESTIMATOR ==============
  (function () {
    const form = document.getElementById('commute-form');
    if (!form) return;
    const input = document.getElementById('commute-dest');
    const btn = document.getElementById('commute-submit');
    const result = document.getElementById('commute-result');
    const destLabel = document.getElementById('commute-dest-label');
    const attrib = document.getElementById('commute-attrib');
    const errEl = document.getElementById('commute-error');

    // Drop a valid OpenRouteService key here for precise drive/bike/walk times.
    // Left blank → the estimator uses a straight-line approximation (clearly labeled).
    const ORS_API_KEY = (window.__SITE__ && window.__SITE__.config.integrations.orsApiKey) || '';
    const PROFILES = ['driving-car', 'cycling-regular', 'foot-walking'];
    const SPEEDS = { 'driving-car': 35, 'cycling-regular': 15, 'foot-walking': 5 }; // km/h
    const DETOUR = { 'driving-car': 1.4, 'cycling-regular': 1.35, 'foot-walking': 1.25 };

    function fmtDur(sec) {
      const m = Math.round(sec / 60);
      if (m < 60) return m + ' min';
      return Math.floor(m / 60) + 'h ' + (m % 60) + 'm';
    }
    function fmtDist(km) { return km < 1 ? Math.round(km * 1000) + ' m' : km.toFixed(1) + ' km'; }
    function haversineKm(a, b) {
      const R = 6371, toRad = d => d * Math.PI / 180;
      const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
      const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
    }
    function withTimeout(promise, ms) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), ms);
      return { signal: ctrl.signal, done: () => clearTimeout(t) };
    }

    async function geocode(q) {
      const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=' + encodeURIComponent(q);
      const to = withTimeout(null, 5000);
      try {
        const res = await fetch(url, { signal: to.signal, headers: { 'Accept': 'application/json' } });
        const data = await res.json();
        if (!data.length) return null;
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), name: data[0].display_name };
      } finally { to.done(); }
    }

    async function orsRoute(profile, dest) {
      const url = 'https://api.openrouteservice.org/v2/directions/' + profile +
        '?api_key=' + ORS_API_KEY +
        '&start=' + PROPERTY.lng + ',' + PROPERTY.lat +
        '&end=' + dest.lng + ',' + dest.lat;
      const to = withTimeout(null, 6000);
      try {
        const res = await fetch(url, { signal: to.signal });
        if (!res.ok) throw new Error('ors');
        const data = await res.json();
        const summ = data.features[0].properties.summary;
        return { duration: summ.duration, distance: summ.distance / 1000 };
      } finally { to.done(); }
    }

    function approxRoute(profile, dest) {
      const straight = haversineKm(PROPERTY, dest);
      const dist = straight * DETOUR[profile];
      const duration = dist / SPEEDS[profile] * 3600;
      return { duration, distance: dist, approx: true };
    }

    function paint(routes, approx) {
      PROFILES.forEach(p => {
        const r = routes[p];
        const timeEl = result.querySelector('[data-mode="' + p + '"]');
        const distEl = result.querySelector('[data-dist="' + p + '"]');
        timeEl.textContent = r ? fmtDur(r.duration) : '—';
        distEl.textContent = r ? fmtDist(r.distance) : '';
      });
      attrib.textContent = approx
        ? 'Approximate · straight-line estimate · Geocoding © OpenStreetMap contributors'
        : 'Routing by OpenRouteService · © OpenStreetMap contributors';
      result.classList.add('is-active');
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const q = input.value.trim();
      if (!q) return;
      errEl.hidden = true;
      btn.disabled = true;
      btn.textContent = 'Estimating…';
      try {
        const dest = await geocode(q);
        if (!dest) {
          errEl.textContent = "We couldn't find that place — try a more specific address.";
          errEl.hidden = false;
          result.classList.remove('is-active');
          return;
        }
        // Shared template — the origin is whichever property this site is, not
        // a baked-in street address.
        const originLabel = (PROPERTY && PROPERTY.address ? PROPERTY.address.split('<br>')[0] : '') || 'the property';
        destLabel.innerHTML = 'From <strong>' + originLabel + '</strong> to <strong>' + dest.name.split(',').slice(0, 2).join(',') + '</strong>';
        let routes = {}, approx = false;
        if (ORS_API_KEY) {
          try {
            const got = await Promise.all(PROFILES.map(p => orsRoute(p, dest).catch(() => null)));
            PROFILES.forEach((p, i) => { routes[p] = got[i] || approxRoute(p, dest); });
            approx = got.some(r => !r);
          } catch (err) {
            PROFILES.forEach(p => { routes[p] = approxRoute(p, dest); });
            approx = true;
          }
        } else {
          PROFILES.forEach(p => { routes[p] = approxRoute(p, dest); });
          approx = true;
        }
        paint(routes, approx);
      } catch (err) {
        errEl.textContent = 'Something went wrong fetching travel times. Please try again.';
        errEl.hidden = false;
      } finally {
        btn.disabled = false;
        btn.textContent = 'Estimate';
      }
    });
  })();

  // ============== TOUR WIZARD ==============
  (function () {
    const root = document.getElementById('tour-wizard');
    if (!root) return;

    const TITLES = {
      1: { eyebrow: 'Step 1 of 3', html: 'Pick a date that <span class="italic">works for you.</span>' },
      2: { eyebrow: 'Step 2 of 3', html: 'Tell us a bit <span class="italic">about you.</span>' },
      3: { eyebrow: 'Step 3 of 3', html: 'Anything else we <span class="italic">should know?</span>' },
      done: { eyebrow: 'Confirmed', html: 'You\'re <span class="italic">on the books.</span>' }
    };

    const SLOTS = ['10:00 AM', '11:30 AM', '1:00 PM', '2:30 PM', '4:00 PM', '5:30 PM'];

    const MSG_TEMPLATES = {
      // Questions
      parking:     'Could you share details on parking?',
      pets:        'What\'s the pet policy and pet rent?',
      storage:     'Is there any in-unit or building storage?',
      laundry:     'How is laundry handled?',
      lease:       'What lease lengths are available?',
      utilities:   'Which utilities are included?',
      application: 'Could you walk me through the application process?',
      // Mentions
      pet:         'I have a pet.',
      needparking: 'I\'ll need a parking spot.',
      bike:        'I\'ll be bringing a bike.',
      wfh:         'I work from home, so layout matters.',
      cosigner:    'I have a co-signer available if needed.',
      oos:         'I\'m moving from out of state.'
    };

    const MSG_ORDER = ['parking','pets','storage','laundry','lease','utilities','application','pet','needparking','bike','wfh','cosigner','oos'];

    const today = new Date(); today.setHours(0,0,0,0);
    const maxDate = new Date(today); maxDate.setDate(maxDate.getDate() + 60);

    const state = {
      step: 1,
      viewMonth: new Date(today.getFullYear(), today.getMonth(), 1),
      date: null,
      slot: null,
      stage: null,
      beds: null,
      window: null,
      household: null,
      first: '', last: '', email: '', phone: '',
      message: '',
      chips: new Set(),
      composedSnapshot: ''
    };

    // ----- helpers
    function pad(n) { return n < 10 ? '0' + n : '' + n; }
    function isoDay(d) { return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()); }
    function sameDay(a, b) { return a && b && isoDay(a) === isoDay(b); }
    function hash(str) {
      let h = 2166136261;
      for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
      return (h >>> 0);
    }
    function seededRand(seed, idx) {
      return ((hash(seed + ':' + idx) % 1000) / 1000);
    }
    function fmtMonth(d) {
      return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    function fmtDateShort(d) {
      return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }
    function fmtDateLong(d) {
      return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    }
    function parseSlotTo24(slot) {
      const m = slot.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      let h = parseInt(m[1], 10); const min = parseInt(m[2], 10); const ap = m[3].toUpperCase();
      if (ap === 'PM' && h !== 12) h += 12;
      if (ap === 'AM' && h === 12) h = 0;
      return { h, min };
    }
    // Google Calendar accepts floating local time as YYYYMMDDTHHmmss (no Z),
    // which matches how the slot reads to the visitor ("10:00 AM").
    function toGCalLocal(d) {
      return d.getFullYear() + pad(d.getMonth()+1) + pad(d.getDate()) + 'T' +
             pad(d.getHours()) + pad(d.getMinutes()) + '00';
    }

    // ----- calendar
    function renderCalendar() {
      const monthEl = root.querySelector('[data-tw-month]');
      const grid = root.querySelector('[data-tw-grid]');
      const prev = root.querySelector('[data-tw-nav="prev"]');
      const next = root.querySelector('[data-tw-nav="next"]');
      const vm = state.viewMonth;
      monthEl.textContent = fmtMonth(vm);

      const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const maxMonthStart  = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
      prev.disabled = vm <= thisMonthStart;
      next.disabled = vm >= maxMonthStart;

      const first = new Date(vm.getFullYear(), vm.getMonth(), 1);
      // shift so Monday = 0
      const offset = (first.getDay() + 6) % 7;
      const daysInMonth = new Date(vm.getFullYear(), vm.getMonth() + 1, 0).getDate();

      let html = '';
      for (let i = 0; i < offset; i++) {
        html += '<button class="tw-day is-blank" type="button" tabindex="-1" aria-hidden="true"></button>';
      }
      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(vm.getFullYear(), vm.getMonth(), d);
        const disabled = date < today || date > maxDate;
        const cls = ['tw-day'];
        if (sameDay(date, today)) cls.push('is-today');
        if (sameDay(date, state.date)) cls.push('is-selected');
        html += '<button class="' + cls.join(' ') + '" type="button" data-tw-day="' + isoDay(date) + '"' +
                (disabled ? ' disabled aria-disabled="true"' : '') + '>' + d + '</button>';
      }
      // trailing blanks to fill the row
      const total = offset + daysInMonth;
      const trail = (7 - (total % 7)) % 7;
      for (let i = 0; i < trail; i++) {
        html += '<button class="tw-day is-blank" type="button" tabindex="-1" aria-hidden="true"></button>';
      }
      grid.innerHTML = html;
    }

    function renderSlots() {
      const wrap = root.querySelector('[data-tw-slots]');
      const grid = root.querySelector('[data-tw-slots-grid]');
      const label = root.querySelector('[data-tw-slots-date]');
      if (!state.date) { wrap.classList.remove('is-open'); return; }
      wrap.classList.add('is-open');
      label.textContent = '· ' + fmtDateLong(state.date);
      const seed = isoDay(state.date);
      // 1–2 booked per day, deterministic
      const bookedCount = seededRand(seed, 'count') < 0.5 ? 1 : 2;
      const bookedSet = new Set();
      let i = 0;
      while (bookedSet.size < bookedCount && i < 20) {
        const idx = Math.floor(seededRand(seed, 'p' + i) * SLOTS.length);
        bookedSet.add(idx); i++;
      }
      let html = '';
      SLOTS.forEach((s, idx) => {
        const booked = bookedSet.has(idx);
        const selected = state.slot === s;
        const cls = ['tw-chip'];
        if (selected && !booked) cls.push('is-selected');
        if (booked) cls.push('is-booked');
        html += '<button class="' + cls.join(' ') + '" type="button" data-tw-slot="' + s + '"' +
                (booked ? ' disabled aria-disabled="true"' : '') + '>' +
                (booked ? s + ' · Booked' : s) + '</button>';
      });
      grid.innerHTML = html;
    }

    // ----- step navigation
    function setStep(n) {
      state.step = n;
      root.dataset.twStep = n;
      const t = TITLES[n] || TITLES[1];
      root.querySelector('[data-tw-eyebrow]').textContent = t.eyebrow;
      root.querySelector('[data-tw-title]').innerHTML = t.html;
      updateDots();
      updateContinueStates();
      updateSubmitLabel();
      const body = root.querySelector('.tw-panel[data-tw-step="' + n + '"]');
      if (body) {
        const focusable = body.querySelector('input, textarea, button:not(:disabled)');
        if (focusable && n !== 1) setTimeout(() => focusable.focus({ preventScroll: true }), 50);
      }
    }
    function updateDots() {
      const dots = root.querySelectorAll('.tw-dot');
      dots.forEach(dot => {
        const n = parseInt(dot.dataset.twGoto, 10);
        const reached = canReach(n);
        dot.disabled = !reached && n !== state.step && n > state.step;
        dot.classList.toggle('is-active', state.step === n);
        dot.classList.toggle('is-done', state.step !== n && state.step !== 1 && n < numericStep());
        if (state.step === 'done') dot.classList.add('is-done');
        if (state.step === n) dot.classList.remove('is-done');
        dot.setAttribute('aria-current', state.step === n ? 'step' : 'false');
      });
      const sep12 = root.querySelector('[data-tw-sep="1-2"]');
      const sep23 = root.querySelector('[data-tw-sep="2-3"]');
      if (sep12) sep12.classList.toggle('is-done', numericStep() >= 2);
      if (sep23) sep23.classList.toggle('is-done', numericStep() >= 3);
    }
    function numericStep() {
      if (state.step === 'done') return 4;
      return state.step;
    }
    function canReach(n) {
      if (n === 1) return true;
      if (n === 2) return !!(state.date && state.slot);
      if (n === 3) return !!(state.date && state.slot) && step2Complete();
      return false;
    }
    function step2Complete() {
      return state.stage && state.beds && state.window && state.household &&
             state.first.trim() && state.last.trim() && /\S+@\S+\.\S+/.test(state.email);
    }
    function updateContinueStates() {
      const c1 = root.querySelector('.tw-panel[data-tw-step="1"] .tw-continue');
      if (c1) c1.disabled = !(state.date && state.slot);
      const c2 = root.querySelector('.tw-panel[data-tw-step="2"] .tw-continue');
      if (c2) c2.disabled = !step2Complete();
    }
    function updateSubmitLabel() {
      const lbl = root.querySelector('[data-tw-submit-label]');
      if (!lbl) return;
      if (state.date && state.slot) {
        lbl.textContent = 'Confirm tour for ' + fmtDateShort(state.date) + ' at ' + state.slot;
      } else {
        lbl.textContent = 'Confirm tour';
      }
    }

    // ----- chips (Step 2 single-select)
    function bindChips() {
      root.querySelectorAll('.tw-chipset').forEach(set => {
        const group = set.dataset.twGroup;
        if (group === 'q' || group === 'm') return; // handled separately
        set.querySelectorAll('[data-tw-chip]').forEach(chip => {
          chip.addEventListener('click', () => {
            const id = chip.dataset.twChip;
            state[group] = state[group] === id ? null : id;
            set.querySelectorAll('[data-tw-chip]').forEach(c => {
              c.classList.toggle('is-selected', state[group] === c.dataset.twChip);
              c.setAttribute('aria-pressed', state[group] === c.dataset.twChip ? 'true' : 'false');
            });
            updateContinueStates();
            updateDots();
          });
        });
      });
    }

    // ----- message chips (Step 3 multi-select w/ template composition)
    function getComposed() {
      return MSG_ORDER.filter(id => state.chips.has(id)).map(id => MSG_TEMPLATES[id]).join(' ');
    }
    function composeMessage() {
      const ta = root.querySelector('[data-tw-textarea]');
      const composed = getComposed();
      const manual = state.message;
      const sep = (composed && manual.trim()) ? ' ' : '';
      ta.value = composed + sep + manual;
    }
    function bindMessageChips() {
      root.querySelectorAll('[data-tw-msg]').forEach(chip => {
        chip.addEventListener('click', () => {
          const id = chip.dataset.twMsg;
          if (state.chips.has(id)) state.chips.delete(id);
          else state.chips.add(id);
          chip.classList.toggle('is-selected', state.chips.has(id));
          chip.setAttribute('aria-pressed', state.chips.has(id) ? 'true' : 'false');
          composeMessage();
        });
      });
      const ta = root.querySelector('[data-tw-textarea]');
      ta.addEventListener('input', () => {
        // Composed sentences live at the START of the textarea; user-typed text
        // follows. Recover the manual residue by stripping the composed prefix.
        const composed = getComposed();
        const val = ta.value;
        if (!composed) {
          state.message = val;
          return;
        }
        if (val.startsWith(composed)) {
          state.message = val.slice(composed.length).replace(/^[\s]+/, '');
        } else {
          // User edited inside composed region — promote everything to manual
          // and clear chip selection so we don't double-up on the next compose.
          state.message = val;
          if (state.chips.size) {
            state.chips.clear();
            root.querySelectorAll('[data-tw-msg]').forEach(c => {
              c.classList.remove('is-selected');
              c.setAttribute('aria-pressed', 'false');
            });
          }
        }
      });
    }

    // ----- inputs (Step 2)
    function bindInputs() {
      root.querySelectorAll('[data-tw-input]').forEach(inp => {
        inp.addEventListener('input', () => {
          state[inp.dataset.twInput] = inp.value;
          updateContinueStates();
          updateDots();
        });
      });
    }

    // ----- nav buttons
    function bindNav() {
      root.querySelectorAll('[data-tw-next]').forEach(btn => {
        btn.addEventListener('click', () => {
          const n = parseInt(btn.dataset.twNext, 10);
          if (canReach(n)) setStep(n);
        });
      });
      root.querySelectorAll('[data-tw-prev]').forEach(btn => {
        btn.addEventListener('click', () => {
          setStep(parseInt(btn.dataset.twPrev, 10));
        });
      });
      root.querySelectorAll('[data-tw-goto]').forEach(btn => {
        btn.addEventListener('click', () => {
          const n = parseInt(btn.dataset.twGoto, 10);
          if (canReach(n)) setStep(n);
        });
      });
      root.querySelector('[data-tw-nav="prev"]').addEventListener('click', () => {
        const vm = state.viewMonth;
        state.viewMonth = new Date(vm.getFullYear(), vm.getMonth() - 1, 1);
        renderCalendar();
      });
      root.querySelector('[data-tw-nav="next"]').addEventListener('click', () => {
        const vm = state.viewMonth;
        state.viewMonth = new Date(vm.getFullYear(), vm.getMonth() + 1, 1);
        renderCalendar();
      });
      // Calendar day delegation
      root.querySelector('[data-tw-grid]').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-tw-day]');
        if (!btn || btn.disabled) return;
        const [y, m, d] = btn.dataset.twDay.split('-').map(Number);
        state.date = new Date(y, m - 1, d);
        state.slot = null;
        renderCalendar();
        renderSlots();
        updateContinueStates();
        updateDots();
        updateSubmitLabel();
      });
      // Slot delegation
      root.querySelector('[data-tw-slots-grid]').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-tw-slot]');
        if (!btn || btn.disabled) return;
        state.slot = btn.dataset.twSlot;
        renderSlots();
        updateContinueStates();
        updateDots();
        updateSubmitLabel();
      });
      // Submit
      root.querySelector('[data-tw-submit]').addEventListener('click', submit);
    }

    async function submit() {
      // Capture final textarea content
      const ta = root.querySelector('[data-tw-textarea]');
      const finalMessage = ta.value;

      const cfg = (window.__SITE__ && window.__SITE__.config) || {};
      const ej = cfg.integrations && cfg.integrations.emailjs;
      const submitBtn = root.querySelector('[data-tw-submit]');
      const lbl = root.querySelector('[data-tw-submit-label]');
      const originalLabel = lbl ? lbl.textContent : '';

      if (ej && ej.publicKey && ej.serviceId && ej.templateId) {
        const bedsLabel = { '1br': '1 BR', '2br': '2 BR / 2 BA', 'either': '1 BR or 2 BR' }[state.beds] || state.beds || '—';
        const windowLabel = { 'asap': 'ASAP', '30d': 'Next 30 days', '60d': '1–2 months out', 'flex': 'Flexible' }[state.window] || state.window || '—';
        const payload = {
          to_email: ej.toEmail || '',
          property_name: cfg.name || '',
          property_site_id: (window.__SITE__ && window.__SITE__.id) || '',
          lead_first_name: state.first,
          lead_last_name: state.last,
          lead_email: state.email,
          lead_phone: state.phone || '—',
          beds_interest: bedsLabel,
          move_in_date: windowLabel,
          tour_date: fmtDateShort(state.date),
          tour_time: state.slot,
          unit_interest: '—',
          source: 'tour wizard',
          message: finalMessage || '',
          page_url: location.href,
          ...adAttributionFields(),
        };
        if (submitBtn) submitBtn.disabled = true;
        if (lbl) lbl.textContent = 'Sending…';
        try {
          await sendViaEmailJS(payload);
        } catch (err) {
          console.error('[emailjs] tour wizard send failed', err);
          if (lbl) lbl.textContent = "Couldn't send — try again";
          if (submitBtn) submitBtn.disabled = false;
          return;
        }
        if (submitBtn) submitBtn.disabled = false;
        if (lbl) lbl.textContent = originalLabel;
      }

      // The wizard is a <div> driven by a type="button" submit, so the delegated
      // 'submit' listener in Analytics.astro never sees it. Fire the conversion
      // explicitly — this is the highest-intent action on the site.
      if (window.trackEvent) {
        window.trackEvent('tour_requested', {
          source: 'tour wizard',
          beds: state.beds || null,
          move_in: state.window || null,
        });
      }

      showConfirmation(finalMessage);
      setStep('done');
    }

    function showConfirmation(message) {
      const cfg = (window.__SITE__ && window.__SITE__.config) || {};
      const propertyName = cfg.name || 'the property';
      const phone = (cfg.contact && cfg.contact.phone) || '';
      const addr = cfg.address || {};
      const fullAddress = addr.streetAddress
        ? `${addr.streetAddress}, ${addr.addressLocality}, ${addr.addressRegion} ${addr.postalCode}`
        : '';

      const summary = root.querySelector('[data-tw-summary]');
      const interestLabel = { '1br': '1 BR', '2br': '2 BR / 2 BA', 'either': '1 BR or 2 BR' }[state.beds] || '—';
      const cells = [
        { label: 'Date', value: fmtDateShort(state.date) },
        { label: 'Time', value: state.slot },
        { label: 'Name', value: (state.first + ' ' + state.last).trim() },
        { label: 'Interest', value: interestLabel }
      ];
      summary.innerHTML = cells.map(c =>
        '<div class="tw-summary-cell"><small>' + c.label + '</small><span>' + escapeHtml(c.value) + '</span></div>'
      ).join('');

      // Google Calendar link
      const [h, min] = [parseSlotTo24(state.slot).h, parseSlotTo24(state.slot).min];
      const start = new Date(state.date); start.setHours(h, min, 0, 0);
      const end = new Date(start.getTime() + 30 * 60000);
      const details = encodeURIComponent(
        'Apartment tour at ' + propertyName + '.\n\n' +
        (message ? 'Notes: ' + message + '\n\n' : '') +
        (phone ? 'Contact: ' + phone : '')
      );
      const gcal =
        'https://www.google.com/calendar/render?action=TEMPLATE' +
        '&text=' + encodeURIComponent(propertyName + ' · Apartment Tour') +
        '&dates=' + toGCalLocal(start) + '/' + toGCalLocal(end) +
        '&ctz=America/Los_Angeles' +
        '&location=' + encodeURIComponent(fullAddress) +
        '&details=' + details;
      root.querySelector('[data-tw-gcal]').href = gcal;

      const sub = root.querySelector('[data-tw-success-sub]');
      sub.textContent = 'Hold tight — we\'ll confirm your ' + fmtDateShort(state.date) +
                        ' at ' + state.slot + ' tour within one business day.';
    }

    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, c => ({
        '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
      }[c]));
    }

    // ----- init
    function init() {
      // Social proof: 8–15 tours this week (stable per page load)
      const tc = 8 + Math.floor(Math.random() * 8);
      root.querySelector('[data-tw-tour-count]').textContent = tc + ' tours scheduled this week';
      root.querySelector('[data-tw-max-date]').textContent =
        maxDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      renderCalendar();
      renderSlots();
      bindNav();
      bindChips();
      bindMessageChips();
      bindInputs();
      setStep(1);
    }

    // Allow other features (e.g. the saved shortlist) to seed the message and
    // bring the visitor into the booking flow at step 1 (date first).
    window.tourPrefill = function (msg) {
      state.message = msg || '';
      state.chips.clear();
      root.querySelectorAll('[data-tw-msg]').forEach(c => {
        c.classList.remove('is-selected');
        c.setAttribute('aria-pressed', 'false');
      });
      const ta = root.querySelector('[data-tw-textarea]');
      if (ta) ta.value = state.message;
    };

    init();
  })();

  // ============== FLOATING CONTACT WIDGET ==============
  (function () {
    const fab = document.getElementById('fab-contact');
    const overlay = document.getElementById('contact-widget');
    if (!fab || !overlay) return;
    const panel = overlay.querySelector('.cw-panel');
    const titleEl = overlay.querySelector('[data-cw-title]');
    const eyebrowEl = overlay.querySelector('[data-cw-eyebrow]');

    const STEPS = {
      choose:      { eyebrow: 'Get in touch',      title: 'How can we help?' },
      leasing:     { eyebrow: 'Leasing inquiry',   title: 'Tell us about you' },
      maintenance: { eyebrow: 'Maintenance request', title: 'What\'s going on?' }
    };

    function setStep(step) {
      if (!STEPS[step]) step = 'choose';
      panel.dataset.step = step;
      eyebrowEl.textContent = STEPS[step].eyebrow;
      titleEl.textContent = STEPS[step].title;
      const body = overlay.querySelector('.cw-body');
      if (body) body.scrollTop = 0;
    }

    function openWidget() {
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
      fab.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
      setStep('choose');
    }

    function closeWidget() {
      overlay.classList.remove('is-open');
      overlay.setAttribute('aria-hidden', 'true');
      fab.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }

    fab.addEventListener('click', openWidget);
    overlay.querySelectorAll('[data-cw-close]').forEach(el => el.addEventListener('click', closeWidget));
    overlay.querySelectorAll('[data-cw-go]').forEach(el => {
      el.addEventListener('click', () => setStep(el.dataset.cwGo));
    });
    overlay.querySelectorAll('[data-cw-back]').forEach(el => {
      el.addEventListener('click', () => setStep('choose'));
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('is-open')) closeWidget();
    });

    // Reveal FAB after small scroll so it doesn't compete with hero
    function updateFabVisibility() {
      if (window.scrollY > 240) fab.classList.add('is-visible');
      else fab.classList.remove('is-visible');
    }
    window.addEventListener('scroll', updateFabVisibility, { passive: true });
    updateFabVisibility();
  })();

  // Attribution fields appended to every lead email. Lets leasing see which
  // campaign produced a tour, and gives you the gclid needed to upload a
  // signed-lease conversion back into Google Ads later.
  function adAttributionFields() {
    var a = (window.getAdAttribution && window.getAdAttribution()) || {};
    return {
      ad_source: a.utm_source || (a.gclid || a.wbraid || a.gbraid ? 'google-ads' : 'direct/organic'),
      ad_campaign: a.utm_campaign || '—',
      ad_keyword: a.utm_term || '—',
      ad_click_id: a.gclid || a.wbraid || a.gbraid || '—',
    };
  }

  // Per-site EmailJS hook. No-op if the site config doesn't have publicKey/serviceId/templateId.
  async function sendViaEmailJS(payload) {
    const ej = window.__SITE__ && window.__SITE__.config && window.__SITE__.config.integrations && window.__SITE__.config.integrations.emailjs;
    if (!ej || !ej.publicKey || !ej.serviceId || !ej.templateId) return false;
    if (!window.emailjs) throw new Error('EmailJS SDK not loaded');
    await window.emailjs.send(ej.serviceId, ej.templateId, payload, { publicKey: ej.publicKey });
    return true;
  }

  async function handleWidgetSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('.form-submit');
    const original = btn.innerHTML;
    const isMaintenance = form.dataset.cwForm === 'maintenance';

    // Tour/leasing path → EmailJS (when configured). Maintenance stays a stub for now.
    if (!isMaintenance) {
      const cfg = (window.__SITE__ && window.__SITE__.config) || {};
      const ej = cfg.integrations && cfg.integrations.emailjs;
      if (ej && ej.publicKey && ej.serviceId && ej.templateId) {
        const fd = new FormData(form);
        const payload = {
          to_email: ej.toEmail || '',
          property_name: cfg.name || '',
          property_site_id: (window.__SITE__ && window.__SITE__.id) || '',
          lead_first_name: fd.get('fname') || '',
          lead_last_name: fd.get('lname') || '',
          lead_email: fd.get('email') || '',
          lead_phone: fd.get('phone') || '—',
          beds_interest: fd.get('beds') || '—',
          move_in_date: fd.get('movein') || '—',
          tour_date: '(no specific date)',
          tour_time: fd.get('tour-time') || '(no preference)',
          unit_interest: '—',
          source: 'floating widget',
          message: fd.get('msg') || '',
          page_url: location.href,
          ...adAttributionFields(),
        };
        btn.disabled = true;
        btn.innerHTML = 'Sending…';
        try {
          await sendViaEmailJS(payload);
        } catch (err) {
          console.error('[emailjs] leasing form send failed', err);
          btn.disabled = false;
          btn.innerHTML = "Couldn't send — try again";
          setTimeout(() => { btn.innerHTML = original; }, 3000);
          return;
        }
        btn.disabled = false;
      }
    }

    // Success animation (also the stub when EmailJS isn't configured).
    btn.innerHTML = isMaintenance ? 'Request received — we\'ll be in touch ✓' : 'Thanks — leasing will reach out ✓';
    btn.style.background = isMaintenance ? 'var(--accent-2)' : 'var(--accent)';
    setTimeout(() => {
      form.reset();
      btn.innerHTML = original;
      btn.style.background = '';
    }, 2800);
  }