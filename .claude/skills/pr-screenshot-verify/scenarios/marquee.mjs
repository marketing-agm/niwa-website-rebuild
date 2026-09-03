import { settleReveals, freezeMotion } from "./_common.mjs";
export default {
  viewport: { width: 1440, height: 900 },
  shots: [
    { name: "01-marquee-offer", caption: "**\"One month free\" in the moving bar.** Set as a black chip rather than in the band's italic serif — a rent concession is not an amenity, and set identically to \"24-hour fitness center\" it scrolls past as the fourth feature in a list of features.",
      path: "/?intro=off", action: async (p) => {
        await p.setViewportSize({ width: 1440, height: 900 });
        await freezeMotion(p); await settleReveals(p);
        await p.evaluate(() => {
          const m = document.querySelector('.marquee');
          window.scrollTo({ top: m.getBoundingClientRect().top + window.scrollY - 620, behavior: 'instant' });
        });
        await p.waitForTimeout(400); } },
    { name: "02-marquee-phone", caption: "Phone.",
      path: "/?intro=off", action: async (p) => {
        await p.setViewportSize({ width: 390, height: 844 });
        await freezeMotion(p); await settleReveals(p);
        await p.evaluate(() => {
          const m = document.querySelector('.marquee');
          window.scrollTo({ top: m.getBoundingClientRect().top + window.scrollY - 500, behavior: 'instant' });
        });
        await p.waitForTimeout(400); } },
  ],
};
