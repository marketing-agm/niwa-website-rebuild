// The Matterport walkthroughs: per-layout tours in the floor-plan section, and
// the shared-space tours under the gallery.
//
// Honest limitation, and it applies to every shot here that shows the 3D tab:
// this environment cannot reach my.matterport.com, so the iframe renders as an
// empty dark frame. What these shots verify is the plumbing around it — that
// the right picker is on screen for the right layout, that the chips switch,
// and that the "Coming Soon" placeholder is gone. Whether a tour itself loads
// has to be checked on the deploy preview.

import { settleReveals, freezeMotion, goToSection } from "./_common.mjs";

const prep = async (page) => {
  await freezeMotion(page);
  await settleReveals(page);
};

/** Open the floor-plan section on a layout, with the 3D tab selected. */
async function tourTab(page, planLabel) {
  await prep(page);
  await goToSection(page, "floor-plans");
  if (planLabel) {
    await page.locator(`.plan-tab:has-text("${planLabel}")`).first().click();
    await page.waitForTimeout(250);
  }
  await page.locator('.plan-view-tab[data-view="3d"]').click();
  await page.waitForTimeout(600);
}

export default {
  viewport: { width: 1440, height: 900 },
  shots: [
    {
      name: "01-studio-tour",
      caption: "**Studio, 3D tab** — one tour, so no picker is drawn. The frame is empty because this environment cannot reach Matterport; the chrome around it is what is being checked.",
      path: "/?intro=off",
      action: (page) => tourTab(page, "Studio"),
    },
    {
      name: "02-onebed-furnished",
      caption: "**1 Bedroom** — the only layout shot twice, so it gets a picker. Furnished is the default.",
      path: "/?intro=off",
      action: (page) => tourTab(page, "1 Bedroom"),
    },
    {
      name: "03-onebed-unfurnished",
      caption: "The same layout with **Unfurnished** selected — the chip switches the iframe without touching the layout tabs.",
      path: "/?intro=off",
      action: async (page) => {
        await tourTab(page, "1 Bedroom");
        await page.locator('.plan-tour-chip:has-text("Unfurnished")').click();
        await page.waitForTimeout(500);
      },
    },
    {
      name: "04-amenity-tours",
      caption: "**Walk the building** — the roof and the gym belong to no layout tab, so they sit under the gallery, which is already the part of the page about looking around.",
      path: "/?intro=off",
      action: async (page) => {
        await prep(page);
        await page.locator(".amenity-tours").scrollIntoViewIfNeeded();
        await page.waitForTimeout(400);
      },
    },
    {
      name: "05-amenity-tours-mobile",
      caption: "Phone width — the three tours wrap rather than scroll.",
      path: "/?intro=off",
      action: async (page) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await prep(page);
        await page.locator(".amenity-tours").scrollIntoViewIfNeeded();
        await page.waitForTimeout(400);
      },
    },
    {
      name: "06-plan-tab-mobile",
      caption: "The picker on a phone, over a 4:3 frame.",
      path: "/?intro=off",
      action: async (page) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await tourTab(page, "1 Bedroom");
      },
    },
  ],
};
