// Two things: the light-yellow italics, and the handover out of the arrival
// film.
//
// The handover shots deliberately do NOT call freezeMotion() — the whole point
// is the 1.2s transition, and zeroing durations would photograph the end state
// four times. They fire the same wheel gesture a visitor uses to scroll out of
// the film, then hold at points along the fade.
import { settleReveals, freezeMotion, goToSection } from "./_common.mjs";

const prep = async (p) => { await freezeMotion(p); await settleReveals(p); };

/** Wait for the film to be showing frames, then hold on a chosen second. */
async function filmPlaying(page) {
  await page.waitForFunction(() => {
    const v = document.querySelector(".arrival-film-video");
    return v && v.readyState >= 2;
  }, { timeout: 20000 });
  await page.waitForTimeout(600);
}

/** Scroll out of the film the way a visitor does, then hold for `ms`. */
const scrollOutAt = (ms) => async (page) => {
  await filmPlaying(page);
  await page.evaluate(() => window.dispatchEvent(new WheelEvent("wheel", { deltaY: 120 })));
  await page.waitForTimeout(ms);
};

export default {
  viewport: { width: 1440, height: 900 },
  shots: [
    { name: "01-italic-hero", caption: "**Italics are light yellow.** The hero's emphasis word in `#FFFCCC` on white.",
      path: "/?intro=off", action: async (p) => { await p.setViewportSize({width:1440,height:900}); await prep(p); } },
    { name: "02-italic-floor-plans", caption: "Floor plans — the section heading and the plan heading.",
      path: "/?intro=off", action: async (p) => { await p.setViewportSize({width:1440,height:900}); await prep(p); await goToSection(p, "floor-plans"); await p.waitForTimeout(400); } },
    { name: "03-italic-marumado", caption: "The marumado — same yellow on the paper panes.",
      path: "/?intro=off", action: async (p) => { await p.setViewportSize({width:1440,height:900}); await prep(p); await goToSection(p, "marumado"); await p.waitForTimeout(400); } },
    { name: "04-italic-gallery", caption: "And on the dark scope, where the same yellow reads at about 17:1.",
      path: "/?intro=off", action: async (p) => { await p.setViewportSize({width:1440,height:900}); await prep(p); await goToSection(p, "gallery"); await p.waitForTimeout(400); } },

    { name: "05-handover-000", caption: "**Scrolling out of the film — 0ms.** The gesture has just landed; the film is still playing, not frozen on its last frame.",
      path: "/?intro=on", waitUntil: "load", action: scrollOutAt(30) },
    { name: "06-handover-400", caption: "400ms — the frame is easing down and drifting right, toward the half-screen panel it is handing over to.",
      path: "/?intro=on", waitUntil: "load", action: scrollOutAt(400) },
    { name: "07-handover-800", caption: "800ms — the hero is coming up underneath, and its loop is already running rather than waiting to start loading.",
      path: "/?intro=on", waitUntil: "load", action: scrollOutAt(800) },
    { name: "08-handover-done", caption: "Landed. The split hero, video live in the right-hand panel.",
      path: "/?intro=on", waitUntil: "load", action: scrollOutAt(1600) },
  ],
};
