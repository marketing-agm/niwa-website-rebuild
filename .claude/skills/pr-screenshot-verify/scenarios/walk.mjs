// The pinned walk (landonorris.com's mechanic), the mountain, and plain white.
// No freezeMotion on the pinned shots — the travel IS the subject.
import { settleReveals, freezeMotion, goToSection } from "./_common.mjs";
const prep = async (p) => { await freezeMotion(p); await settleReveals(p); };

/** Scroll to a fraction of the way through the pinned gallery band. */
const pinnedAt = (frac) => async (p) => {
  await p.setViewportSize({ width: 1440, height: 900 });
  await settleReveals(p);
  await p.waitForTimeout(400);
  await p.evaluate((f) => {
    const pin = document.querySelector('.walk-pin');
    const stick = document.querySelector('.walk-pin-stick');
    // Document coordinates, not offsetTop — .walk-pin's offsetParent is the
    // positioned section, so offsetTop is a section-relative number.
    const top = pin.getBoundingClientRect().top + window.scrollY;
    const hold = pin.offsetHeight - stick.offsetHeight;
    window.scrollTo({ top: top + hold * f, behavior: 'instant' });
  }, frac);
  await p.waitForTimeout(600);
};

export default {
  viewport: { width: 1440, height: 900 },
  shots: [
    { name: "01-pin-start", caption: "**The band takes the screen.** Same mechanic as landonorris.com — the gallery pins and your scroll starts pulling the strip right-to-left instead of moving down the page. The yellow rail at the base is how far along the walk you are.",
      path: "/?intro=off", action: pinnedAt(0.02) },
    { name: "02-pin-third", caption: "A third of the way across. The band holds for about two screens of scrolling, not the strip's full 7,400px \u2014 honest one-to-one mapping would mean eight screens to get past the gallery.",
      path: "/?intro=off", action: pinnedAt(0.34) },
    { name: "03-pin-two-thirds", caption: "Two thirds. Drag, the arrow buttons and the keyboard all still work — it's the same scroller underneath, just driven rather than dragged.",
      path: "/?intro=off", action: pinnedAt(0.72) },
    { name: "04-pin-release", caption: "Run out of strip, and vertical scrolling hands back. Below it: plain white, no raked arcs, no dashed grid.",
      path: "/?intro=off", action: pinnedAt(1.0) },
    { name: "05-rainier", caption: "**Mount Rainier**, its own band before the marumado. Generated from a height profile — hence the flat offset summit dome and the shoulder on the right, which is Little Tahoma.",
      path: "/?intro=off", action: async (p) => {
        await p.setViewportSize({ width: 1440, height: 900 });
        await prep(p); await goToSection(p, "rainier"); await p.waitForTimeout(500); } },
    { name: "06-walk-off", caption: "**Switched off** from the nav. The gallery goes back to a strip you drag yourself, nothing pins, and the path layer is gone. This is also what a visitor with reduced motion gets without touching anything.",
      path: "/?intro=off", action: async (p) => {
        await p.setViewportSize({ width: 1440, height: 900 });
        await settleReveals(p);
        await p.locator('.walk-toggle--nav').click();
        await p.waitForTimeout(500);
        await goToSection(p, "gallery"); await p.waitForTimeout(500); } },
    { name: "07-phone", caption: "Phone — the band never pins and the path never draws. A pinned horizontal section and a touch scroll fight over the same gesture.",
      path: "/?intro=off", action: async (p) => {
        await p.setViewportSize({ width: 390, height: 844 });
        await prep(p); await goToSection(p, "gallery"); await p.waitForTimeout(500); } },
  ],
};
