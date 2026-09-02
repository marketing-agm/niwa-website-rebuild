// The cinematic hero, against the layout it replaces.
//
// Stakeholder direction was a full-bleed film that plays on arrival, pointing at
// vibrantcities.com. `?hero=cinematic` and `?hero=split` switch between the new
// treatment and the original right-hand panel on one deploy, so the comparison
// is live rather than a pair of screenshots.

import { settleReveals, freezeMotion, videoReady } from "./_common.mjs";

const prep = async (page) => {
  await freezeMotion(page);
  await settleReveals(page);
  await videoReady(page);
};

export default {
  viewport: { width: 1440, height: 900 },
  shots: [
    {
      name: "01-cinematic",
      caption: "**The cinematic hero** — full-bleed film, copy over it, 85vh so the tour CTA stays on screen",
      path: "/?hero=cinematic",
      action: prep,
    },
    {
      name: "02-cinematic-mobile",
      caption: "iPhone width — 76vh here, because 85 of 16:9 footage crops to a letterbox sliver on a portrait phone",
      path: "/?hero=cinematic",
      action: async (page) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await prep(page);
      },
    },
    {
      name: "03-split-for-comparison",
      caption: "`?hero=split` — the layout it replaces, for side-by-side",
      path: "/?hero=split",
      action: async (page) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await prep(page);
      },
    },
    {
      name: "04-cinematic-full-page",
      caption: "Whole page — what sits under the film, and how the marquee closes the section",
      path: "/?hero=cinematic",
      fullPage: true,
      action: async (page) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await prep(page);
      },
    },
    {
      name: "05-laptop-1280",
      caption: "1280×800 — a small laptop, where a full-viewport hero would push everything off screen",
      path: "/?hero=cinematic",
      action: async (page) => {
        await page.setViewportSize({ width: 1280, height: 800 });
        await prep(page);
      },
    },
  ],
};
