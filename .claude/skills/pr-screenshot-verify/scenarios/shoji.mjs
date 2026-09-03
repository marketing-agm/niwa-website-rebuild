import { settleReveals, freezeMotion, goToSection } from "./_common.mjs";
const prep = async (p) => { await freezeMotion(p); await settleReveals(p); };
export default {
  viewport: { width: 1440, height: 900 },
  shots: [
    { name: "01-shoji", caption: "**The shoji panel** — an even lattice of panes, three holding the amenity lists, one glazed onto the clubroom, two left blank because in a shoji the empty panes are the composition.",
      path: "/?intro=off", action: async (p) => { await prep(p); await goToSection(p, "the-building"); await p.waitForTimeout(500); } },
    { name: "02-shoji-phone", caption: "Phone — the lattice stacks and the blank panes drop out, because a pause you cannot see is wasted screen.",
      path: "/?intro=off", action: async (p) => { await p.setViewportSize({width:390,height:844}); await prep(p); await goToSection(p, "the-building"); await p.waitForTimeout(500); } },
    { name: "03-koshi", caption: "**The timber rail at the base.** The last band of a shoji is solid wood — one warm band, the only brown in the system, sitting where the timber sits in the screen. A rail rather than a wash, so it states the idea without putting a second warm colour against a palette that is one yellow, white and black.",
      path: "/?intro=off", action: async (p) => {
        // Explicit: the phone shot above changed the viewport on this same page.
        await p.setViewportSize({ width: 1440, height: 900 });
        await prep(p);
        // Frame the rail itself — scrollIntoView puts the footer's top edge at
        // the very top of the viewport, where the sticky nav covers it.
        await p.evaluate(() => {
          const f = document.querySelector('footer');
          window.scrollTo({ top: f.offsetTop - 220, behavior: 'instant' });
        });
        await p.waitForTimeout(500);
      } },
  ],
};
