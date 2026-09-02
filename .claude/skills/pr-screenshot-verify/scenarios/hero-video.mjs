// The hero video, photographed in both placements.
//
// Stakeholders left the placement undecided — autoplaying behind the hero, or a
// pop-up on arrival — so both are built and `?video=` switches between them on
// one deploy. This scenario shoots both, plus the fallbacks, because the whole
// point of the round is to compare them side by side.

import {
  settleReveals, freezeMotion, videoReady, openVideoModal,
} from "./_common.mjs";

const prep = async (page) => {
  await freezeMotion(page);
  await settleReveals(page);
  await videoReady(page);
};

export default {
  viewport: { width: 1440, height: 900 },
  shots: [
    {
      name: "01-loop-background",
      caption: "**Variant A** — the loop autoplaying behind the hero (`?video=background`)",
      path: "/?video=background",
      action: prep,
    },
    {
      name: "02-loop-expanded",
      caption:
        "Variant A expanded — the centred control opens the full 30s film. " +
        "The player shows its poster here because this headless Chromium has no " +
        "H.264 decoder; the dialog chrome, sizing and backdrop are what this shot verifies.",
      path: "/?video=background",
      action: async (page) => { await prep(page); await openVideoModal(page); },
    },
    {
      name: "03-popup-on-arrival",
      caption: "**Variant B** — the film opens over the page on arrival, once per session (`?video=modal`)",
      path: "/?video=modal",
      settleMs: 1600,
      action: async (page) => { await freezeMotion(page); await settleReveals(page); },
    },
    {
      name: "04-loop-mobile",
      caption: "Variant A at iPhone width — where most leasing traffic actually is",
      path: "/?video=background",
      action: async (page) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await prep(page);
      },
    },
    {
      name: "05-fallback-off",
      caption:
        "`?video=off` — the still hero the video sits on top of. This is also what " +
        "reduced-motion, Save-Data and a failed video request all fall back to.",
      path: "/?video=off",
      // The viewport is per-page, not per-shot, so a shot that narrows it leaves
      // every later shot narrow. 04 does exactly that; these two set their own
      // width back rather than depending on running before it.
      action: async (page) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await freezeMotion(page);
        await settleReveals(page);
      },
    },
    {
      // These two panels are yellow fills that were carrying white type — 1.34:1,
      // invisible. No anchor reaches them, so scroll by selector.
      name: "07-yellow-panels",
      caption:
        "`.move-in-cost` and `.mc-summary` — both were a saturated yellow fill with " +
        "white type on it. Pale fill, black type now.",
      path: "/?video=off",
      action: async (page) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await freezeMotion(page);
        await settleReveals(page);
        // These panels are two layers deep: inside the unit-detail modal, on its
        // "Rental terms" tab. Neither exists in the static HTML — the units are
        // rendered by app.js — so the path is open a unit, then open the tab.
        // Scrolling straight to the selector silently no-ops instead.
        await page.locator(".unit-card").first().scrollIntoViewIfNeeded();
        await page.locator(".unit-card").first().click();
        await page.waitForTimeout(700);
        await page.click('[data-ud-tab="terms"]');
        await page.waitForTimeout(500);
        // Now that the tab is open the panel has a box, so this scrolls the
        // modal's own overflow container rather than the page.
        await page.locator(".move-in-cost").first().scrollIntoViewIfNeeded();
        await page.waitForTimeout(400);
      },
    },
    {
      name: "06-full-page",
      caption: "Whole page with the loop in place, for proportion and rhythm",
      path: "/?video=background",
      fullPage: true,
      action: async (page) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await prep(page);
      },
    },
  ],
};
