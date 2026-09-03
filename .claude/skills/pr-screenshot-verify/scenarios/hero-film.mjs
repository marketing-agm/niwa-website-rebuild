// The hero film, as the dark rebuild actually ships it.
//
// Not to be confused with `hero-video.mjs`, which photographs an earlier and now
// removed design: that round put the film behind a `?video=` switch with a modal
// variant, and its helpers still look for `.hero-visual.video-ready` and
// `.hero-video-btn`. Neither exists any more. The film is now simply the hero
// media — one autoplaying, muted, looping element where the still used to be —
// so there are no variants to compare, and what needs verifying instead is that
// it decodes, that the crop holds at both widths, and that reduced motion parks
// it on its poster.

import { settleReveals, freezeMotion } from "./_common.mjs";

/**
 * Wait for the film to have real frames, then hold it on a chosen second.
 *
 * A hero that has not decoded photographs as a black rectangle, which looks
 * exactly like a 404. `readyState >= 2` is the difference. Pausing on a fixed
 * timestamp is what makes two runs comparable — otherwise every run catches the
 * loop at a different moment and the diff is all footage and no code.
 *
 * The element is paused rather than left playing because motion.ts pauses it
 * off-screen and plays it back on; a shot mid-scroll would otherwise race that.
 */
const filmAt = (seconds) => async (page) => {
  await freezeMotion(page);
  await settleReveals(page);
  await page.waitForFunction(() => {
    const v = document.querySelector(".hero-video");
    return v && v.readyState >= 2;
  }, { timeout: 10000 }).catch(() => {});
  await page.evaluate((t) => {
    const v = document.querySelector(".hero-video");
    if (v && Number.isFinite(v.duration)) { v.pause(); v.currentTime = t; }
  }, seconds);
  await page.waitForTimeout(400);
};

/** Bring the film into frame, since at most widths it starts below the fold. */
const scrollToFilm = async (page) => {
  await page.evaluate(() => {
    document.querySelector(".hero-media").scrollIntoView({ behavior: "instant", block: "center" });
  });
  await page.waitForTimeout(250);
};

export default {
  viewport: { width: 1440, height: 900 },
  shots: [
    {
      name: "01-hero-desktop",
      caption:
        "The hero as a visitor first sees it — the headline over black, the film " +
        "beginning below it. Held at 1.5s so the run is repeatable.",
      waitUntil: "load",
      action: async (page) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await filmAt(1.5)(page);
      },
    },
    {
      name: "02-film-desktop",
      caption:
        "The film in frame at a wide interior shot (8s). This is the shot that " +
        "verifies the crop: centred now rather than biased to 40%, and the caption " +
        "rail sitting on its hairline underneath.",
      waitUntil: "load",
      action: async (page) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await filmAt(8)(page);
        await scrollToFilm(page);
      },
    },
    {
      name: "03-film-endcard",
      caption:
        "The last seconds (27s), where the reel's own burned-in `NOW LEASING` card " +
        "fills the frame. Nothing is clipped — but this is the content question " +
        "raised in the PR description, and it is easier to judge from a picture.",
      waitUntil: "load",
      action: async (page) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await filmAt(27)(page);
        await scrollToFilm(page);
      },
    },
    {
      name: "04-hero-phone",
      caption:
        "iPhone width — where most leasing traffic is. The 16:9 film cropped into a " +
        "tall frame, which is the case most likely to go wrong.",
      waitUntil: "load",
      action: async (page) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await filmAt(8)(page);
        await scrollToFilm(page);
      },
    },
    {
      name: "05-reduced-motion",
      caption:
        "`prefers-reduced-motion: reduce` — the `autoplay` attribute is dropped and " +
        "the film sits on its poster. The poster is frame one, so this is the same " +
        "picture playback would have started from: nothing jumps when it is switched off.",
      waitUntil: "load",
      action: async (page) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        // motion.ts reads the media query once, at execution, so the preference
        // has to be in place before the document runs again.
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.reload({ waitUntil: "load" });
        await settleReveals(page);
        await scrollToFilm(page);
        await page.waitForTimeout(600);
      },
    },
    {
      name: "06-full-page",
      caption: "The whole page, for proportion — the film against the sections below it.",
      waitUntil: "load",
      fullPage: true,
      action: async (page) => {
        await page.emulateMedia({ reducedMotion: null });
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.reload({ waitUntil: "load" });
        await filmAt(8)(page);
      },
    },
  ],
};
