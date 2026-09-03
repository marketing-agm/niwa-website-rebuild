// The SightMap building map, and the availability section under it.
//
// The frame itself will be empty here: this environment cannot reach
// sightmap.com, so what these shots verify is the shape reserved for it, the
// copy around it, and the two fixes underneath — the availability lede and the
// studio filter that was missing from a building whose smallest homes are
// studios. Whether the map loads has to be checked on the preview.

import { settleReveals, freezeMotion, goToSection } from "./_common.mjs";

const prep = async (page) => {
  await freezeMotion(page);
  await settleReveals(page);
};

export default {
  viewport: { width: 1440, height: 900 },
  shots: [
    {
      name: "01-building-map",
      caption: "**The building map**, sitting above the list it indexes. The frame is empty because this environment cannot reach sightmap.com — the shape and the copy are what these shots check.",
      path: "/?intro=off",
      action: async (page) => {
        await prep(page);
        await goToSection(page, "building-map");
        await page.waitForTimeout(400);
      },
    },
    {
      name: "02-availability-filters",
      caption: "**Studio is now a filter.** It was 1 BR / 2 BR only — inherited from a property that had no studios, in a building where they are the smallest homes. The lede above it was Magnolia's too, and claimed every home has a private deck.",
      path: "/?intro=off",
      action: async (page) => {
        await prep(page);
        await goToSection(page, "availability");
        await page.waitForTimeout(400);
      },
    },
    {
      name: "03-studio-filtered",
      caption: "Studio selected — the filter works against the live feed, so this is what a renter looking for the smallest home now sees.",
      path: "/?intro=off",
      action: async (page) => {
        await prep(page);
        await goToSection(page, "availability");
        await page.locator('.pill-tab[data-filter="beds"][data-value="0"]').click();
        await page.waitForTimeout(600);
      },
    },
    {
      name: "04-map-phone",
      caption: "Phone — the frame turns portrait, because a 16:10 map on a 390px screen is a sliver and this one is meant to be pinched and panned.",
      path: "/?intro=off",
      action: async (page) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await prep(page);
        await goToSection(page, "building-map");
        await page.waitForTimeout(400);
      },
    },
  ],
};
