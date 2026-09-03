// Where the Matterport tours live on the page — two places.
import { settleReveals, freezeMotion, goToSection } from "./_common.mjs";
const prep = async (p) => { await freezeMotion(p); await settleReveals(p); };

export default {
  viewport: { width: 1440, height: 900 },
  shots: [
    { name: "01-floor-plans-tab-closed", caption: "**Place one: Floor plans.** The toggle above the drawing — `Floor plan` / `3D tour`. It opens on the 2D drawing, so the tours are one click away rather than on screen.",
      path: "/?intro=off", action: async (p) => {
        await p.setViewportSize({ width: 1440, height: 900 });
        await prep(p); await goToSection(p, "floor-plans"); await p.waitForTimeout(400); } },
    { name: "02-floor-plans-1br-tour", caption: "Click **3D tour**, with **1 Bedroom** selected — that layout was shot twice, so it gets a Furnished / Unfurnished picker over the frame. The frame is empty here only because this sandbox cannot reach my.matterport.com.",
      path: "/?intro=off", action: async (p) => {
        await p.setViewportSize({ width: 1440, height: 900 });
        await prep(p); await goToSection(p, "floor-plans");
        await p.locator('.plan-tab:has-text("1 Bedroom")').first().click();
        await p.waitForTimeout(250);
        await p.locator('.plan-view-tab[data-view="3d"]').click();
        await p.waitForTimeout(600); } },
    { name: "03-gallery-walk-the-building", caption: "**Place two: the bottom of the Gallery** — \"Walk the building\", the three shared spaces. These belong to no layout tab, and the gallery is already the part of the page about looking around. They open Matterport in a new tab.",
      path: "/?intro=off", action: async (p) => {
        await p.setViewportSize({ width: 1440, height: 900 });
        await prep(p);
        await p.evaluate(() => {
          const el = document.querySelector('.amenity-tours');
          window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 200, behavior: 'instant' });
        });
        await p.waitForTimeout(500); } },
  ],
};
