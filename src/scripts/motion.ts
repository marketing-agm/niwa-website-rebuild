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
  revealHashTarget(hash);
  if (scrollToHash(hash)) history.replaceState(null, '', hash);
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

// Active section in the nav
const navLinks = $$<HTMLAnchorElement>('.nav-link');
navLinks.forEach((a) => {
  const sec = $(a.getAttribute('href')!);
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
  lenis?.stop();
}
function closeDialog(d: HTMLDialogElement) {
  if (d.open) d.close();
  const f = $<HTMLIFrameElement>('[data-frame]', d);
  if (f) f.src = 'about:blank';
  lenis?.start();
}
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
    // The walkthrough sits below the gallery now, so switching tours changed
    // something off screen. Carry the reader down to it. Measured against the
    // scroll container rather than offsetTop, which depends on whichever
    // ancestor happens to be positioned.
    const tour = $<HTMLElement>('.hdlg-tour', d);
    const main = $<HTMLElement>('.hdlg-main', d);
    if (tour && main) {
      const top = tour.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop;
      main.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' });
    }
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

/* ---------- Gallery: pinned horizontal scroll on desktop, native on touch ---------- */
const gal = $('[data-gallery]');
const track = $('[data-gallery-track]');
const galBar = $('[data-gallery-progress]');
if (gal && track) {
  const useNative = coarse || reduce || innerWidth < 1024;
  if (useNative) {
    gal.classList.add('is-native');
    const vp = track.parentElement!;
  } else {
    const vp = track.parentElement!;
    const dist = () => Math.max(0, track.scrollWidth - vp.clientWidth);
    gsap.to(track, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: {
        trigger: vp, pin: true, scrub: 0.6, anticipatePin: 1, invalidateOnRefresh: true,
        start: () => (vp.offsetHeight < innerHeight ? 'center center' : 'top top'),
        end: () => '+=' + dist(),
        onUpdate: (self) => { if (galBar) galBar.style.transform = `scaleX(${self.progress})`; },
      },
    });
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
    gsap.to(strokes, { drawSVG: '100%', duration: 1.6, stagger: 0.18, ease: 'power2.inOut', scrollTrigger: { trigger: mark, start: 'top 85%', once: true } });
  }

  // The gold section lifts into view
  const tour = $('[data-tour-section]');
  if (tour) gsap.from(tour, { y: 60, ease: 'none', scrollTrigger: { trigger: tour, start: 'top bottom', end: 'top 60%', scrub: true } });
}

// Layout can shift as web fonts and lazy images arrive.
document.fonts?.ready.then(() => ScrollTrigger.refresh());
window.addEventListener('load', () => ScrollTrigger.refresh());

/* ---------- The leasing special: a small panel beside the cursor ---------- */
const specialBtn = $<HTMLButtonElement>('[data-special-toggle]');
const specialPop = $('[data-special-pop]');
if (specialBtn && specialPop) {
  const close = () => {
    if (specialPop.hidden) return;
    specialPop.hidden = true;
    specialBtn.setAttribute('aria-expanded', 'false');
  };
  const open = (x: number, y: number) => {
    specialPop.hidden = false;
    specialBtn.setAttribute('aria-expanded', 'true');
    const pad = 12;
    const w = specialPop.offsetWidth, h = specialPop.offsetHeight;
    const small = innerWidth < 720;
    let left = small ? (innerWidth - w) / 2 : x + pad;
    let top = small ? Math.min(y + pad, innerHeight - h - pad) : y + pad;
    if (left + w > innerWidth - pad) left = x - w - pad;
    if (left < pad) left = pad;
    if (top + h > innerHeight - pad) top = Math.max(pad, y - h - pad);
    specialPop.style.left = `${Math.round(left)}px`;
    specialPop.style.top = `${Math.round(top)}px`;
    if (!reduce) gsap.fromTo(specialPop, { opacity: 0, y: 8, scale: 0.98 }, { opacity: 1, y: 0, scale: 1, duration: 0.35, ease: 'power3.out', clearProps: 'scale' });
    (specialPop.querySelector('a, button') as HTMLElement | null)?.focus({ preventScroll: true });
  };
  specialBtn.addEventListener('click', (e) => {
    if (!specialPop.hidden) return close();
    const r = specialBtn.getBoundingClientRect();
    // Keyboard activation has no pointer position; anchor to the label instead.
    const x = e.clientX || r.left, y = e.clientY || r.bottom;
    open(x, y);
  });
  specialPop.addEventListener('click', (e) => { if ((e.target as Element).closest('[data-special-close]')) close(); });
  document.addEventListener('click', (e) => { if (!specialPop.hidden && !specialPop.contains(e.target as Node) && e.target !== specialBtn) close(); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  window.addEventListener('scroll', close, { passive: true });
  lenis?.on('scroll', close);
}
