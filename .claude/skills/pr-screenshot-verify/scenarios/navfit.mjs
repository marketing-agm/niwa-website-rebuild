// Two fixes: the sticky nav actually sticks, and the nav row fits at 861 and
// 1100 without eating the wordmark.
import { settleReveals, freezeMotion } from "./_common.mjs";
const prep = async (p) => { await freezeMotion(p); await settleReveals(p); };

const at = (w, y) => async (p) => {
  await p.setViewportSize({ width: w, height: 900 });
  await prep(p);
  await p.evaluate((yy) => window.scrollTo({ top: yy, behavior: 'instant' }), y);
  await p.waitForTimeout(400);
};

export default {
  viewport: { width: 1440, height: 900 },
  shots: [
    { name: "01-nav-861", caption: "**861px** — one pixel above the old mobile breakpoint, and the width that was setting the wordmark as \"Niw / a / nts\". The desktop row measured 897px in an 861px window; the hamburger takes over below 901 now.",
      path: "/?intro=off", action: at(861, 0) },
    { name: "02-nav-1100", caption: "**1100px** — the other one. The secondary \"Resident Login\" link now stays hidden to 1180 instead of 1080, and the menu tightens its own padding below 1000.",
      path: "/?intro=off", action: at(1100, 0) },
    { name: "03-nav-960", caption: "960px — desktop row, tightened padding, wordmark intact.",
      path: "/?intro=off", action: at(960, 0) },
    { name: "04-sticky-held", caption: "**The sticky nav actually sticks.** Scrolled 2,500px in: the bar is held at the top of the viewport. `body { overflow-x: hidden }` had been making body a scroll container, so every sticky element on the site was sticking to body's scrollport rather than the screen — i.e. travelling with the page.",
      path: "/?intro=off", action: at(1440, 2500) },
    { name: "05-sticky-held-deep", caption: "Same at 6,000px. Measured, not eyeballed: nav position `sticky`, `getBoundingClientRect().top` = 0 at every scroll offset tested.",
      path: "/?intro=off", action: at(1440, 6000) },
    { name: "06-nav-phone", caption: "390px — unchanged, and the wordmark keeps its italic down to 380 as before.",
      path: "/?intro=off", action: at(390, 0) },
  ],
};
