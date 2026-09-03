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
  if (scrollToHash(hash)) history.replaceState(null, '', hash);
});

/* ---------- Nav ---------- */
const nav = $('[data-nav]');
let lastY = 0;
function onScroll(y: number) {
  if (!nav) return;
  nav.classList.toggle('is-scrolled', y > 12);
  const down = y > lastY && y > innerHeight * 0.6;
  nav.classList.toggle('is-hidden', down && Math.abs(y - lastY) > 2);
  lastY = y;
}
if (lenis) lenis.on('scroll', (e: any) => onScroll(e.scroll));
else window.addEventListener('scroll', () => onScroll(window.scrollY), { passive: true });

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
const galCount = $('[data-gallery-count]');
const galBar = $('[data-gallery-progress]');
const galItems = track ? $$('.gal-item', track) : [];
function setGalCount(p: number) {
  if (!galCount) return;
  const i = Math.min(galItems.length, Math.max(1, Math.round(p * (galItems.length - 1)) + 1));
  galCount.textContent = String(i).padStart(2, '0');
}
if (gal && track) {
  const useNative = coarse || reduce || innerWidth < 1024;
  if (useNative) {
    gal.classList.add('is-native');
    const vp = track.parentElement!;
    vp.addEventListener('scroll', () => setGalCount(vp.scrollLeft / Math.max(1, vp.scrollWidth - vp.clientWidth)), { passive: true });
  } else {
    const vp = track.parentElement!;
    const dist = () => Math.max(0, track.scrollWidth - vp.clientWidth);
    gsap.to(track, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: {
        trigger: vp, pin: true, scrub: 0.6, anticipatePin: 1, invalidateOnRefresh: true,
        start: () => (vp.offsetHeight < innerHeight ? 'center center' : 'top top'),
        end: () => '+=' + dist(),
        onUpdate: (self) => { setGalCount(self.progress); if (galBar) galBar.style.transform = `scaleX(${self.progress})`; },
      },
    });
  }
}

/* ---------- Hero film ---------- */
// The poster is the first frame, so a paused video and the still are the same
// picture — nothing jumps when playback is refused or switched off.
const heroVideo = $<HTMLVideoElement>('[data-hero-video]');
if (heroVideo) {
  if (reduce) {
    heroVideo.autoplay = false;
    heroVideo.removeAttribute('autoplay');
    heroVideo.pause();
  } else {
    // Some browsers ignore the autoplay attribute but honour a play() call.
    const play = () => heroVideo.play().catch(() => {});
    play();
    // Don't decode 1080p for a hero nobody is looking at.
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(
        (entries) => entries.forEach((e) => (e.isIntersecting ? play() : heroVideo.pause())),
        { rootMargin: '200px' },
      ).observe(heroVideo);
    }
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) heroVideo.pause();
      else if (heroVideo.getBoundingClientRect().bottom > 0) play();
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
