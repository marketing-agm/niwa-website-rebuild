import { settleReveals, freezeMotion, goToSection } from "./_common.mjs";
const prep = async (p) => { await p.setViewportSize({ width: 1440, height: 900 }); await freezeMotion(p); await settleReveals(p); };
export default {
  viewport: { width: 1440, height: 900 },
  shots: [
    { name: "01-hero", caption: "**The yellow is back on the headline** — pale yellow fill with a hard ink offset, so the glyph is read from the black and the colour from the yellow. `#FFFCCC` alone is 1.07:1 on white and cannot carry a letterform.",
      path: "/?intro=off", action: async (p) => { await prep(p); await p.waitForTimeout(400); } },
    { name: "02-floor-plans", caption: "**The vertical 04 is gone.** It repeated the number already in the eyebrow beside it, was unreadable rotated at 12px, and on this head the two collided. The rule stays — that was doing the architectural work.",
      path: "/?intro=off", action: async (p) => { await prep(p); await goToSection(p, "floor-plans"); await p.waitForTimeout(400); } },
    { name: "03-marumado", caption: "**The marumado in brand colours.** Same composition — screen, lattice, centre post, round opening, the view as the brightest thing — rebuilt in white, black and the one yellow instead of timber.",
      path: "/?intro=off", action: async (p) => { await prep(p); await p.evaluate(() => document.querySelector('.marumado').scrollIntoView({block:'center'})); await p.waitForTimeout(500); } },
    { name: "04-koshi", caption: "The footer rail was the same brown, one band lower. Ink with a yellow hairline now.",
      path: "/?intro=off", action: async (p) => { await prep(p); await p.evaluate(() => { const f=document.querySelector('footer'); scrollTo({top:f.offsetTop-200,behavior:'instant'}); }); await p.waitForTimeout(400); } },
  ],
};
