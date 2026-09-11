// Motion and behaviour for the page. GSAP + Lenis; one file, no globals.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger, SplitText, DrawSVGPlugin);

const html = document.documentElement;
html.classList.add('js');
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = window.matchMedia('(pointer: coarse)').matches;
if (reduce) html.classList.add('no-motion');
const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s);
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => Array.from(r.querySelectorAll<T>(s));
const navH = () => parseFloat(getComputedStyle(html).getPropertyValue('--nav-h')) || 64;

/* ---------- Smooth scroll ---------- */
let lenis: Lenis | null = null;
if (!reduce) {
  lenis = new Lenis({ lerp: 0.09, smoothWheel: true, wheelMultiplier: 0.95, touchMultiplier: 1.4 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis!.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
function scrollToHash(hash: string) {
  const target = hash === '#top' ? document.body : $(hash);
  if (!target) return false;
  const offset = hash === '#top' ? 0 : -(navH() - 1);
  if (lenis) lenis.scrollTo(target as HTMLElement, { offset, duration: 1.4, easing: (t) => 1 - Math.pow(1 - t, 4) });
  else {
    const y = hash === '#top' ? 0 : (target as HTMLElement).getBoundingClientRect().top + window.scrollY + offset;
    window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
  }
  return true;
}
document.addEventListener('click', (e) => {
  const a = (e.target as Element).closest<HTMLAnchorElement>('a[href^="#"]');
  if (!a) return;
  const hash = a.getAttribute('href')!;
  if (hash.length < 2) return;
  e.preventDefault();
  closeMenu();
  // A link inside an open dialog has to close it before it can scroll.
  // openDialog stops Lenis to lock the page behind the modal, and a scrollTo
  // issued while Lenis is stopped is dropped on the floor. Both this listener
  // and the dialog one are on document, and this one is registered first, so
  // "Schedule a tour" in a home type was asking a stopped scroller to move and
  // only then closing the dialog: the modal shut and the page stayed put.
  const dlg = a.closest('dialog') as HTMLDialogElement | null;
  if (dlg?.open) closeDialog(dlg);
  revealHashTarget(hash);
  const go = () => { if (scrollToHash(hash)) history.replaceState(null, '', hash); };
  // One frame for the close to land and Lenis to be running again.
  if (dlg) requestAnimationFrame(go); else go();
});

/* ---------- Tabs (the homes / availability) ---------- */
function activateTab(name: string) {
  const list = $('[data-tabs]');
  if (!list) return;
  $$<HTMLButtonElement>('[data-tab]', list).forEach((t) => {
    const on = t.dataset.tab === name;
    t.classList.toggle('is-active', on);
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
  });
  $$('[data-tab-panel]').forEach((panel) => {
    const on = panel.dataset.tabPanel === name;
    if (on && panel.hidden) {
      panel.hidden = false;
      // The map only loads once someone asks for it.
      $$<HTMLIFrameElement>('iframe[data-src]', panel).forEach((f) => { f.src = f.dataset.src!; f.removeAttribute('data-src'); });
      if (!reduce) gsap.fromTo(panel, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out', clearProps: 'all' });
    } else if (!on) panel.hidden = true;
  });
  ScrollTrigger.refresh();
}
$$('[data-tabs] [data-tab]').forEach((t) => t.addEventListener('click', () => activateTab(t.dataset.tab!)));
// A link into a hidden tab panel switches to that tab first.
function revealHashTarget(hash: string) {
  const target = hash.length > 1 ? $(hash) : null;
  const panel = target?.closest<HTMLElement>('[data-tab-panel]');
  if (panel && panel.hidden) activateTab(panel.dataset.tabPanel!);
}
if (location.hash) revealHashTarget(location.hash);

/* ---------- Nav ---------- */
const nav = $('[data-nav]');

const menu = $('[data-menu]');
const burger = $<HTMLButtonElement>('[data-menu-toggle]');
function openMenu() {
  if (!menu || !burger) return;
  menu.hidden = false;
  burger.setAttribute('aria-expanded', 'true');
  nav?.classList.add('is-menu-open');
  lenis?.stop();
  html.style.overflow = 'hidden';
  if (!reduce) gsap.fromTo($$('[data-menu-item]', menu), { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, stagger: 0.05, ease: 'power3.out', clearProps: 'all' });
}
function closeMenu() {
  if (!menu || !burger || menu.hidden) return;
  menu.hidden = true;
  burger.setAttribute('aria-expanded', 'false');
  nav?.classList.remove('is-menu-open');
  lenis?.start();
  html.style.overflow = '';
}
burger?.addEventListener('click', () => (menu?.hidden ? openMenu() : closeMenu()));
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
window.matchMedia('(min-width: 721px)').addEventListener('change', (e) => { if (e.matches) closeMenu(); });

// The nav turns gold-on-gold over the tour section
const tourSec = $('[data-tour-section]');
if (tourSec) ScrollTrigger.create({ trigger: tourSec, start: () => `top ${navH()}px`, end: () => `bottom ${navH()}px`, onToggle: (s) => nav?.classList.toggle('is-gold', s.isActive) });

// Active section in the nav. An href is only a selector when it is a bare
// hash: off the homepage the same links read "/#about", and on a route with no
// sections at all some of them point at another page entirely.
const navLinks = $$<HTMLAnchorElement>('.nav-link');
navLinks.forEach((a) => {
  const href = a.getAttribute('href') || '';
  if (!href.startsWith('#')) return;
  const sec = $(href);
  if (!sec) return;
  ScrollTrigger.create({
    trigger: sec, start: () => `top ${navH() + 40}px`, end: () => `bottom ${navH() + 40}px`,
    onToggle: (self) => a.classList.toggle('is-active', self.isActive),
  });
});

/* ---------- 3D tour dialog ---------- */
const dlg = $<HTMLDialogElement>('[data-tour-dialog]');
const frame = $<HTMLIFrameElement>('[data-tour-frame]');
const dlgTitle = $('[data-tour-title]');
document.addEventListener('click', (e) => {
  const b = (e.target as Element).closest<HTMLElement>('[data-tour]');
  if (!b || !dlg || !frame) return;
  frame.src = b.dataset.tour!;
  if (dlgTitle) dlgTitle.textContent = b.dataset.tourLabel || '3D tour';
  dlg.showModal();
  lenis?.stop();
});
function closeDlg() { if (!dlg || !frame) return; if (dlg.open) dlg.close(); frame.src = 'about:blank'; lenis?.start(); }
$('[data-tour-close]')?.addEventListener('click', closeDlg);
dlg?.addEventListener('close', closeDlg);
dlg?.addEventListener('click', (e) => { if (e.target === dlg) closeDlg(); });

/* ---------- Home-type dialogs ---------- */
function openDialog(id: string) {
  const d = document.getElementById(id) as HTMLDialogElement | null;
  if (!d) return;
  const f = $<HTMLIFrameElement>('[data-frame]', d);
  const first = $<HTMLElement>('[data-frame-src]', d);
  if (f && first && !f.src.startsWith('http')) f.src = first.dataset.frameSrc!;
  d.showModal();
  // A dialog keeps its scroll position while closed, so reopening one that was
  // left at the walkthrough would skip the gallery it is supposed to open on.
  // This has to run after showModal(): a display:none element has no scroll box
  // to write to, and the browser restores the old offset when it gets one.
  const main = $<HTMLElement>('.hdlg-main', d);
  if (main) main.scrollTop = 0;
  syncJump(d);
  lenis?.stop();
}
function closeDialog(d: HTMLDialogElement) {
  if (d.open) d.close();
  const f = $<HTMLIFrameElement>('[data-frame]', d);
  if (f) f.src = 'about:blank';
  lenis?.start();
}
/* The right pane holds two blocks — the gallery and the walkthrough — and the
   rail navigates between them. Offsets are measured against the scroll
   container's own rect rather than offsetTop, which resolves against whichever
   ancestor happens to be positioned; inside a modal dialog that is not the one
   you would guess. */
function paneOf(d: Element) {
  return {
    main: $<HTMLElement>('.hdlg-main', d),
    tour: $<HTMLElement>('.hdlg-tour', d),
  };
}
function tourOffset(main: HTMLElement, tour: HTMLElement) {
  return tour.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop;
}
function jumpTo(d: Element, which: 'gallery' | 'tour') {
  const { main, tour } = paneOf(d);
  if (!main) return;
  const top = which === 'tour' && tour ? tourOffset(main, tour) : 0;
  main.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' });
}
function syncJump(d: Element) {
  const { main, tour } = paneOf(d);
  if (!main || !tour) return;
  // Switch once the walkthrough owns most of the view, not the instant it
  // peeks in — otherwise the marker flickers on a short scroll.
  //
  // The viewport-relative rule alone broke when the galleries shrank to two or
  // three pictures. A one bedroom grid is about 308px against a 836px pane, so
  // "a screen-and-a-bit before the tour" landed at a negative scroll position
  // and the dialog opened with Walkthrough already lit while you were looking
  // at the photos. The floor at 60% of the distance keeps Photos marked until
  // you have actually travelled most of the way there, whatever the grid's
  // height, and leaves the old behaviour untouched on a tall one.
  const to = tourOffset(main, tour);
  const atTour = main.scrollTop >= Math.max(to - main.clientHeight * 0.45, to * 0.6);
  $$('[data-jump]', d).forEach((b) => {
    const on = ((b as HTMLElement).dataset.jump === 'tour') === atTour;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-current', String(on));
  });
}
$$<HTMLElement>('.hdlg-main').forEach((main) => {
  const d = main.closest('dialog');
  if (!d) return;
  let queued = false;
  main.addEventListener('scroll', () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; syncJump(d); });
  }, { passive: true });
});

document.addEventListener('click', (e) => {
  const el = e.target as Element;
  const opener = el.closest<HTMLElement>('[data-open-dialog]');
  if (opener) { openDialog(opener.dataset.openDialog!); return; }
  const closer = el.closest<HTMLElement>('[data-dialog-close]');
  if (closer) { const d = closer.closest('dialog') as HTMLDialogElement | null; if (d) closeDialog(d); return; }
  const src = el.closest<HTMLElement>('[data-frame-src]');
  if (src) {
    const d = src.closest('dialog')!;
    $$('[data-frame-src]', d).forEach((b) => { b.classList.toggle('is-active', b === src); b.setAttribute('aria-selected', String(b === src)); });
    const f = $<HTMLIFrameElement>('[data-frame]', d);
    if (f) f.src = src.dataset.frameSrc!;
    // The walkthrough sits below the gallery, so switching tours would
    // otherwise change something off screen.
    jumpTo(d, 'tour');
  }
  const jump = el.closest<HTMLElement>('[data-jump]');
  if (jump) {
    const d = jump.closest('dialog');
    if (d) jumpTo(d, jump.dataset.jump === 'tour' ? 'tour' : 'gallery');
  }
});
$$<HTMLDialogElement>('dialog.hdlg').forEach((d) => {
  d.addEventListener('close', () => closeDialog(d));
  d.addEventListener('click', (e) => { if (e.target === d) closeDialog(d); });
});

/* ---------- Hero video: slower, and never for reduced motion ---------- */
const heroVideo = $<HTMLVideoElement>('[data-hero-video]');
if (heroVideo) {
  const rate = parseFloat(heroVideo.dataset.rate || '0.6') || 0.6;
  const apply = () => { heroVideo.playbackRate = rate; heroVideo.defaultPlaybackRate = rate; };
  apply();
  heroVideo.addEventListener('play', apply);
  heroVideo.addEventListener('loadedmetadata', apply);
  const conn = (navigator as any).connection;
  if (reduce || conn?.saveData || /2g/.test(conn?.effectiveType || '')) { heroVideo.removeAttribute('autoplay'); heroVideo.pause(); }
  else heroVideo.play().catch(() => {});
}

/* ---------- FAQ ---------- */
/* The whole list folds behind one button. Collapsed, not removed — the
   answers stay in the markup for the FAQ structured data and for anyone
   searching the page — and the individual question toggles below are
   untouched. */
const faqAll = $('[data-faq-all]');
const faqList = document.getElementById('faq-list');
const faqAllLabel = $('[data-faq-all-label]');
if (faqAll && faqList) {
  faqAll.addEventListener('click', () => {
    const open = faqAll.getAttribute('aria-expanded') === 'true';
    faqAll.setAttribute('aria-expanded', String(!open));
    if (faqAllLabel) faqAllLabel.textContent = open ? 'Read the questions' : 'Hide the questions';
    if (reduce) { faqList.hidden = open; ScrollTrigger.refresh(); return; }
    if (!open) {
      faqList.hidden = false;
      gsap.fromTo(faqList, { height: 0, opacity: 0 }, { height: 'auto', opacity: 1, duration: 0.6, ease: 'power3.out', clearProps: 'height', onComplete: () => ScrollTrigger.refresh() });
    } else {
      gsap.to(faqList, { height: 0, opacity: 0, duration: 0.45, ease: 'power3.inOut', onComplete: () => { faqList.hidden = true; gsap.set(faqList, { clearProps: 'height,opacity' }); ScrollTrigger.refresh(); } });
    }
  });
}

$$('[data-faq-toggle]').forEach((btn) => {
  const panel = document.getElementById(btn.getAttribute('aria-controls')!);
  if (!panel) return;
  btn.addEventListener('click', () => {
    const open = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!open));
    if (reduce) { panel.hidden = open; ScrollTrigger.refresh(); return; }
    if (!open) {
      panel.hidden = false;
      gsap.fromTo(panel, { height: 0, opacity: 0 }, { height: 'auto', opacity: 1, duration: 0.6, ease: 'power3.out', clearProps: 'height', onComplete: () => ScrollTrigger.refresh() });
    } else {
      gsap.to(panel, { height: 0, opacity: 0, duration: 0.45, ease: 'power3.inOut', onComplete: () => { panel.hidden = true; gsap.set(panel, { clearProps: 'height,opacity' }); ScrollTrigger.refresh(); } });
    }
  });
});

/* ---------- Mobile rails advance as the page scrolls ----------

   On a phone the feature cards, the neighbourhood tiles and the amenity lists
   are horizontal strips. Asking for a sideways swipe in the middle of a
   vertical read is a gear change nobody makes, so the strip is driven by the
   page instead: scrolling down walks it to the right, the way the gallery is
   driven on desktop.

   It steps between whole cards rather than scrubbing a fraction of one. A
   scrub would leave the strip parked mid-card whenever you stopped, which is
   the sliced-sentence problem again — "Stainless st / range and". Stepping
   means the strip is only ever between cards while it is moving. The card
   scroll is the rail's own scrollLeft, a different scroller from the page, so
   it never argues with Lenis. Swiping by hand still works and the next
   vertical scroll picks the strip back up.

   gsap.matchMedia builds these only at the widths where the rails exist, and
   tears them down again above: at desktop width .rail-x is display:contents,
   which has no box to measure or scroll. */
function scrollRail(
  rail: HTMLElement,
  cards: HTMLElement[],
  opts: { start?: string; end?: string; onIndex?: (i: number) => void } = {},
) {
  if (cards.length < 2) return null;
  let index = -1;
  const originOf = (i: number) => cards[i].offsetLeft - cards[0].offsetLeft;
  const live = () => rail.clientWidth > 0 && rail.scrollWidth > rail.clientWidth;
  const goto = (i: number) => {
    if (!live() || i === index) return;
    index = Math.max(0, Math.min(cards.length - 1, i));
    rail.scrollTo({ left: originOf(index), behavior: reduce ? 'auto' : 'smooth' });
    opts.onIndex?.(index);
  };
  const step = (self: { progress: number }) =>
    goto(Math.round(self.progress * (cards.length - 1)));
  const st = ScrollTrigger.create({
    trigger: rail,
    // Not pinned. Pinning is what the gallery does, but the gallery viewport is
    // most of a screen tall; the feature strip is 134px, so pinning it put one
    // small card in the middle of an otherwise empty screen for 1,500px of
    // scroll, and added 3,400px to the document.
    start: opts.start ?? 'top 95%',
    end: opts.end ?? 'bottom 20%',
    invalidateOnRefresh: true,
    onRefresh: (self) => { index = -1; step(self); },
    onUpdate: step,
  });
  return { st, goto };
}

if (!reduce) {
  const mm = gsap.matchMedia();

  // The feature strip used to be driven from here, stepping itself along as
  // the page scrolled. It doesn't any more: each card now carries its own
  // photograph, so a card that walks on its own is a photograph sliding out
  // from under the sentence about it. You flip it, and the dots below it say
  // where you are. See the b-pairs block further down.
  //
  // The neighbourhood tiles are deliberately not driven either: they are
  // photographs, they keep their peek, and a driven strip on one phone page is
  // a lot of thumb.

  // The amenity lists rail one breakpoint wider, where its chip row lives.
  mm.add('(max-width: 1024px)', () => {
    const rail = $('[data-lists]');
    const chips = $$<HTMLButtonElement>('[data-list-jump]');
    if (!rail || !chips.length) return;
    const cards = $$<HTMLElement>('.list', rail);
    const paint = (i: number) => chips.forEach((chip, n) => {
      const on = n === i;
      chip.classList.toggle('is-active', on);
      chip.setAttribute('aria-current', String(on));
    });
    // A tighter run than the feature strip gets. The default window walks a
    // strip from entering at the bottom to leaving past the top, which is fine
    // for a 134px band and wrong for a 418px one: the last card only arrived
    // once the list was 40% off the top of the screen. Between 'top 55%' and
    // 'top 8%' the whole walk happens with the list fully in view.
    const railed = scrollRail(rail, cards, { start: 'top 55%', end: 'top 8%', onIndex: paint });

    // A chip scrolls the strip. It used to scroll the page instead — to the
    // point in the run that maps to that card — which meant tapping "Parking
    // & storage" threw the page 525px down and left the list 249px above the
    // top edge, and "Community" threw it 1,051px up with a tenth of the list
    // showing. Nobody taps a label to be taken away from the thing it labels:
    // you are already looking at the list, so only the list should move.
    chips.forEach((chip) => chip.addEventListener('click', () => {
      railed?.goto(Number(chip.dataset.listJump));
    }));
  });
}

/* ---------- Gallery: pinned horizontal scroll on desktop, native on touch ----

   Both modes live here, and the choice is made once, because two scripts
   deciding this separately can disagree and leave the strip pinned with a
   scrollbar under it, or scrollable with nothing driving it.

   Pinned is the desktop behaviour and the one the page was designed around:
   the section holds still while the vertical wheel drives the strip sideways,
   and the hairline underneath fills as you travel. It is deliberately not
   used on touch, on a narrow window, or under prefers-reduced-motion — pinning
   takes over the page's only scroll axis, which is the wrong thing to do to a
   phone and the wrong thing to do to a reader who has asked motion to stop.
   Those get an ordinary scroll container with a draggable bar. */
const galSection = $('[data-gallery]');
const galTrack = $('[data-gallery-track]');
const galVp = $('[data-gal-vp]');
const galBarEl = $('[data-gal-bar]');
const galThumb = $('[data-gal-thumb]');
const galProgress = $('[data-gallery-progress]');

if (galSection && galTrack && galVp) {
  const pin = !coarse && !reduce && innerWidth >= 1024;

  if (pin) {
    galSection.classList.add('is-pinned');
    const dist = () => Math.max(0, galTrack.scrollWidth - galVp.clientWidth);
    gsap.to(galTrack, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: {
        trigger: galVp, pin: true, scrub: 0.6, anticipatePin: 1, invalidateOnRefresh: true,
        start: () => (galVp.offsetHeight < innerHeight ? 'center center' : 'top top'),
        end: () => '+=' + dist(),
        onUpdate: (self) => { if (galProgress) galProgress.style.transform = `scaleX(${self.progress})`; },
      },
    });
  } else if (galBarEl && galThumb) {
    // The bar reflects the scroll and can drive it. One source of truth,
    // scrollLeft: a wheel, a flick, an arrow key and a drag all end there.
    const max = () => Math.max(1, galVp.scrollWidth - galVp.clientWidth);
    const draw = () => {
      const frac = Math.min(1, galVp.clientWidth / galVp.scrollWidth);
      const travel = galBarEl.clientWidth * (1 - frac);
      galThumb.style.width = `${frac * 100}%`;
      galThumb.style.transform = `translateX(${(galVp.scrollLeft / max()) * travel}px)`;
      galThumb.setAttribute('aria-valuenow', String(Math.round((galVp.scrollLeft / max()) * 100)));
    };

    // Lenis takes the wheel for the whole document, which left a sideways
    // trackpad gesture over the strip moving it 48px out of 1320. Stopping the
    // event here — before it reaches the window Lenis listens on — hands a
    // horizontal gesture back to the browser. A vertical one is left alone, so
    // the page still scrolls with the pointer over the photographs.
    galVp.addEventListener('wheel', (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) e.stopPropagation();
    }, { passive: true });

    galVp.addEventListener('scroll', draw, { passive: true });
    addEventListener('resize', draw);
    draw();

    let from = 0, at = 0;
    const move = (e: PointerEvent) => {
      const frac = Math.min(1, galVp.clientWidth / galVp.scrollWidth);
      const travel = galBarEl.clientWidth * (1 - frac);
      if (travel <= 0) return;
      galVp.scrollLeft = at + ((e.clientX - from) / travel) * max();
    };
    const up = (e: PointerEvent) => {
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
      galBarEl.classList.remove('is-dragging');
      galThumb.releasePointerCapture?.(e.pointerId);
    };
    galThumb.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      from = e.clientX; at = galVp.scrollLeft;
      galBarEl.classList.add('is-dragging');
      galThumb.setPointerCapture?.(e.pointerId);
      addEventListener('pointermove', move);
      addEventListener('pointerup', up);
    });
    galBarEl.addEventListener('pointerdown', (e) => {
      if (e.target === galThumb) return;
      const ahead = e.clientX > galThumb.getBoundingClientRect().right;
      galVp.scrollBy({ left: (ahead ? 1 : -1) * galVp.clientWidth * 0.9, behavior: 'smooth' });
    });
    galThumb.addEventListener('keydown', (e) => {
      const step = { ArrowLeft: -1, ArrowRight: 1, Home: -Infinity, End: Infinity }[e.key];
      if (step === undefined) return;
      e.preventDefault();
      if (!Number.isFinite(step)) galVp.scrollTo({ left: step < 0 ? 0 : max(), behavior: 'smooth' });
      else galVp.scrollBy({ left: step * galVp.clientWidth * 0.6, behavior: 'smooth' });
    });
  }
}

/* ---------- The building strip: dots track the card you're on ----------

   Below 640px the six amenities are a swipe strip, each card its heading, its
   blurb and its photograph. The dots are the only thing that says there are six
   and which one is showing, so they are wired here rather than inside the GSAP
   block: reduced motion removes the animation, not the navigation. Above 640
   the strip is display:contents and has no scroller, so scrollWidth never
   exceeds clientWidth and nothing here does anything. */
{
  const pairs = $('[data-b-pairs]');
  const dots = $$<HTMLButtonElement>('[data-b-dot]');
  if (pairs && dots.length) {
    const cards = $$<HTMLElement>(':scope > .b-pair', pairs);
    let at = -1;
    const paint = (i: number) => {
      if (i === at) return;
      at = i;
      dots.forEach((d, n) => {
        const on = n === i;
        d.classList.toggle('is-on', on);
        d.setAttribute('aria-current', String(on));
      });
    };
    // Nearest card origin to the current scroll position; snap keeps it exact
    // in practice, and rounding covers the moment between two cards.
    const read = () => {
      if (pairs.scrollWidth <= pairs.clientWidth) return;
      const x = pairs.scrollLeft;
      let best = 0, gap = Infinity;
      cards.forEach((card, i) => {
        const d = Math.abs(card.offsetLeft - cards[0].offsetLeft - x);
        if (d < gap) { gap = d; best = i; }
      });
      paint(best);
    };
    pairs.addEventListener('scroll', () => requestAnimationFrame(read), { passive: true });
    dots.forEach((dot, i) => dot.addEventListener('click', () => {
      pairs.scrollTo({ left: cards[i].offsetLeft - cards[0].offsetLeft, behavior: reduce ? 'auto' : 'smooth' });
      paint(i);
    }));
    read();
  }
}

/* ---------- Everything below is decoration; skip it for reduced motion ---------- */
if (!reduce) {
  // Hero entrance
  const heroLines = $$('.hero-line-in');
  const heroFades = $$('[data-hero-fade]');
  const heroClip = $('.hero-media-clip');
  const heroImg = $('[data-hero-img]');
  gsap.set(heroLines, { yPercent: 110 });
  gsap.set(heroFades, { opacity: 0, y: 18 });
  if (heroClip) gsap.set(heroClip, { clipPath: 'inset(100% 0 0 0)' });
  if (heroImg) gsap.set(heroImg, { scale: 1.12 });
  const intro = gsap.timeline({ paused: true, defaults: { ease: 'expo.out' } });
  intro
    .to(heroLines, { yPercent: 0, duration: 1.3, stagger: 0.1 }, 0.1)
    .to(heroFades, { opacity: 1, y: 0, duration: 1, stagger: 0.07 }, 0.5)
    .to(heroClip || {}, { clipPath: 'inset(0% 0 0 0)', duration: 1.5 }, 0.55)
    .to(heroImg || {}, { scale: 1, duration: 1.9 }, 0.55);
  const start = () => intro.play();
  Promise.race([document.fonts?.ready ?? Promise.resolve(), new Promise((r) => setTimeout(r, 700))]).then(start);

  // Hero parallax
  if (heroImg) gsap.to(heroImg, { yPercent: 9, ease: 'none', scrollTrigger: { trigger: '.hero-media', start: 'top bottom', end: 'bottom top', scrub: true } });

  // Reveals
  $$('[data-reveal]').forEach((el) => {
    gsap.to(el, {
      opacity: 1, y: 0, duration: 1.1, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 90%', once: true },
      onStart: () => el.classList.add('is-in'),
    });
  });

  // The idea: words brighten as you read down
  $$('[data-words]').forEach((el) => {
    const split = SplitText.create(el, { type: 'words', wordsClass: 'word' });
    gsap.fromTo(split.words, { opacity: 0.16 }, {
      opacity: 1, stagger: 0.04, ease: 'none',
      scrollTrigger: { trigger: el, start: 'top 78%', end: 'bottom 45%', scrub: true },
    });
  });

  // Counters and bars
  $$('[data-count]').forEach((el) => {
    const v = Number(el.dataset.count || 0);
    const o = { n: 0 };
    gsap.to(o, { n: v, duration: 1.8, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 85%', once: true }, onUpdate: () => (el.textContent = String(Math.round(o.n))) });
  });
  $$('[data-bar]').forEach((el) => {
    const v = parseFloat(getComputedStyle(el).getPropertyValue('--v')) || 0;
    gsap.to(el, { '--p': v, duration: 1.8, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 85%', once: true } });
  });

  // Footer wordmark draws itself
  const mark = $('[data-footer-mark]');
  if (mark) {
    const strokes = $$('[data-stroke]', mark);
    gsap.set(strokes, { drawSVG: '0%' });
    // 95%, not 85%. The strokes are set to nothing the moment the page loads,
    // so until this fires the block is its full height of plain background —
    // and at 85% it began drawing only once a good part of that emptiness was
    // already on screen. Starting as the block crosses the bottom edge means
    // the mark is arriving the whole time you can see it.
    gsap.to(strokes, { drawSVG: '100%', duration: 1.6, stagger: 0.18, ease: 'power2.inOut', scrollTrigger: { trigger: mark, start: 'top 95%', once: true } });
  }

  // The gold section lifts into view
  const tour = $('[data-tour-section]');
    // 32, not 60. The lift is what makes the gold panel arrive rather than
  // appear, but it is also dark space that opens above it while you are
  // looking straight at the gap, and 60 of those on top of the layout's own
  // spacing was most of what read as a hole under the last question.
  if (tour) gsap.from(tour, { y: 32, ease: 'none', scrollTrigger: { trigger: tour, start: 'top bottom', end: 'top 60%', scrub: true } });
}

// Layout can shift as web fonts and lazy images arrive.
document.fonts?.ready.then(() => ScrollTrigger.refresh());
window.addEventListener('load', () => ScrollTrigger.refresh());

/* ---------- The leasing special: a panel hung under its label ---------- */
const specialBtn = $<HTMLButtonElement>('[data-special-toggle]');
const specialPop = $('[data-special-pop]');
if (specialBtn && specialPop) {
  // Pinned means the panel was clicked rather than hovered into view. A pinned
  // panel does not follow the pointer out of the room: it stays until the
  // close button, a click elsewhere, Escape or a scroll takes it away. That is
  // the whole point of clicking something that already opened on hover — the
  // click has to buy you something the hover did not.
  let pinned = false;

  const close = () => {
    if (specialPop.hidden) return;
    specialPop.hidden = true;
    specialBtn.setAttribute('aria-expanded', 'false');
    pinned = false;
  };

  // Anchored to the label, never to the cursor. A panel that opens wherever
  // the pointer happens to be reads as unrelated to the line that summoned it,
  // which is exactly how it looked: the offer sat top right and its card
  // floated in the middle of the hero.
  //
  // Edges line up with the label's. Left to left where there is room for it,
  // and right to right where there is not — at the wide end the label sits in
  // the right-hand gutter and a 620px card starting at the label's left edge
  // would run off the screen. Either way the card hangs off the label and
  // reads as belonging to it.
  const place = () => {
    const r = specialBtn.getBoundingClientRect();
    const pad = 16;
    // Clear air between the label and the card, so the two read as a label and
    // its panel rather than as one stack of text.
    const gap = 22;
    const w = specialPop.offsetWidth, h = specialPop.offsetHeight;
    const small = innerWidth < 720;

    let left = small ? (innerWidth - w) / 2 : r.left;
    if (!small && left + w > innerWidth - pad) left = r.right - w;   // right edge to right edge
    left = Math.min(Math.max(left, pad), Math.max(pad, innerWidth - w - pad));

    let top = r.bottom + gap;
    if (top + h > innerHeight - pad) top = Math.max(pad, r.top - h - gap);   // flip above

    specialPop.style.left = `${Math.round(left)}px`;
    specialPop.style.top = `${Math.round(top)}px`;
  };

  const open = (takeFocus = true) => {
    specialPop.hidden = false;
    specialBtn.setAttribute('aria-expanded', 'true');
    place();
    if (!reduce) gsap.fromTo(specialPop, { opacity: 0, y: 8, scale: 0.98 }, { opacity: 1, y: 0, scale: 1, duration: 0.35, ease: 'power3.out', clearProps: 'scale' });
    // Only when the panel was asked for. Hovering must not move the caret out
    // from under someone who is tabbing or typing elsewhere on the page.
    if (takeFocus) (specialPop.querySelector('a, button') as HTMLElement | null)?.focus({ preventScroll: true });
  };

  // A pointer arriving at the label opens the panel before the click lands, so
  // a plain toggle would read the panel as already open and shut it again —
  // the label would look broken to the one gesture everybody tries. A click on
  // a hovered-open panel pins it instead, and takes focus.
  specialBtn.addEventListener('click', () => {
    if (!specialPop.hidden) {
      if (pinned) return close();          // a second click on a pinned panel closes it
      pinned = true;
      (specialPop.querySelector('a, button') as HTMLElement | null)?.focus({ preventScroll: true });
      return;
    }
    pinned = true;
    open();
  });

  // Hovering the label is enough — nobody should have to guess that the line
  // is clickable. Only where there is a real pointer: on a touch screen
  // :hover latches onto whatever was last tapped, so the tap stays the way in.
  //
  // There is a gap between the label and the card for the pointer to cross, so
  // leaving either one starts a short grace period and entering either cancels
  // it, rather than shutting the card mid-crossing. A pinned card ignores all
  // of this.
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    let grace = 0;
    const hold = () => { clearTimeout(grace); };
    const release = () => {
      clearTimeout(grace);
      if (pinned) return;
      grace = window.setTimeout(close, 220);
    };
    specialBtn.addEventListener('mouseenter', () => {
      hold();
      if (specialPop.hidden) open(false);
    });
    specialBtn.addEventListener('mouseleave', release);
    specialPop.addEventListener('mouseenter', hold);
    specialPop.addEventListener('mouseleave', release);
  }

  specialPop.addEventListener('click', (e) => { if ((e.target as Element).closest('[data-special-close]')) close(); });
  document.addEventListener('click', (e) => { if (!specialPop.hidden && !specialPop.contains(e.target as Node) && e.target !== specialBtn) close(); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  // The panel is anchored to a label that scrolls away with the hero, so it
  // goes when the page moves. It does follow a resize, since the anchor is
  // still on screen and the card would otherwise be left behind.
  window.addEventListener('resize', () => { if (!specialPop.hidden) place(); });
  window.addEventListener('scroll', close, { passive: true });
  lenis?.on('scroll', close);
}
