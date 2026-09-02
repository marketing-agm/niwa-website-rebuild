// The default scenario: walk the homepage top to bottom.
//
// Start here for most changes and delete the shots that have nothing to do with
// what you touched — a PR comment with four relevant screenshots is read, one with
// twelve is scrolled past.

import {
  goToSection, settleReveals, heroReady, freezeMotion, dismissOverlays, selectPlan, openSheet,
} from "./_common.mjs";

const prep = async (page) => {
  await freezeMotion(page);
  await dismissOverlays(page);
  await settleReveals(page);
};

export default {
  viewport: { width: 1440, height: 900 },
  shots: [
    {
      name: "01-hero",
      caption: "Hero — the first thing a visitor sees",
      action: async (page) => { await freezeMotion(page); await heroReady(page); },
    },
    {
      name: "02-floor-plans",
      caption: "Floor plans — tabs come from the live AppFolio feed",
      action: async (page) => { await prep(page); await goToSection(page, "floor-plans"); },
    },
    {
      name: "03-plan-studio",
      caption: "Studio plan selected (11 of the 17 units)",
      action: async (page) => { await prep(page); await selectPlan(page, "Studio"); },
    },
    {
      name: "04-availability",
      caption: "Availability — live units, pricing and dates",
      action: async (page) => { await prep(page); await goToSection(page, "availability"); },
    },
    {
      name: "05-gallery",
      caption: "Gallery",
      action: async (page) => { await prep(page); await goToSection(page, "gallery"); },
    },
    {
      name: "06-tour-form",
      caption: "Tour request form",
      action: async (page) => { await prep(page); await openSheet(page, "tour"); },
    },
    {
      name: "07-full-page",
      caption: "Whole page, for proportion and rhythm",
      fullPage: true,
      action: prep,
    },
    {
      // Always keep one narrow shot. Most of the traffic to a leasing site is on a
      // phone, and a layout that only works at 1440 is a layout that mostly does
      // not work.
      name: "08-mobile",
      caption: "iPhone-width — where most leasing traffic actually is",
      fullPage: true,
      action: async (page) => { await page.setViewportSize({ width: 390, height: 844 }); await prep(page); },
    },
  ],
};
