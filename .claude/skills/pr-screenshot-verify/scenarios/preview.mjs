// The whole review surface on one branch: the arrival film, the handover to the
// hero, and both sets of Matterport tours.
//
// This exists because splitting work across branches split the preview links
// too, and a stakeholder cannot review two URLs and hold the difference in
// their head. One branch, one preview, one scenario that walks all of it.
//
// `?intro=on` replays the film (it is otherwise once per tab, and a run opens
// several pages in one context); `?intro=off` is the returning visitor and is
// what every non-film shot uses.

import { settleReveals, freezeMotion, videoReady, goToSection } from "./_common.mjs";

const prep = async (page) => {
  await freezeMotion(page);
  await settleReveals(page);
};

/** Wait for the film to be showing frames, then hold on a chosen second. */
async function filmAt(page, seconds) {
  await page.waitForFunction(() => {
    const v = document.querySelector(".arrival-film-video");
    return v && v.readyState >= 2;
  }, { timeout: 15000 });
  await page.evaluate((t) => {
    const v = document.querySelector(".arrival-film-video");
    v.pause();
    v.currentTime = t;
  }, seconds);
  await page.waitForFunction(() => {
    const v = document.querySelector(".arrival-film-video");
    return v && v.readyState >= 2 && !v.seeking;
  }, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(400);
}

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
      name: "01-film-opens",
      caption: "**Arrival.** The film full-screen with nothing layered on it, so its own title card reads as it was cut.",
      path: "/?intro=on",
      waitUntil: "load",
      action: (page) => filmAt(page, 2),
    },
    {
      name: "02-film-mid",
      caption: "Fifteen seconds in. The skip control is there from the first frame — thirty seconds is a long hold on someone who came to look at floor plans.",
      path: "/?intro=on",
      waitUntil: "load",
      action: (page) => filmAt(page, 15),
    },
    {
      name: "03-film-phone",
      caption: "**Phone.** A 16:9 frame is a quarter of a portrait screen and the captions run to both edges, so it cannot be cropped to fill. The letterbox is composed instead: wordmark, film, skip.",
      path: "/?intro=on",
      waitUntil: "load",
      action: async (page) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await filmAt(page, 8);
      },
    },
    {
      name: "04-handover",
      caption: "**What it fades to.** Skip pressed, film gone, the split hero underneath with its loop running — the layout that was already working.",
      path: "/?intro=on",
      waitUntil: "load",
      action: async (page) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.waitForSelector(".arrival-film:not([hidden])", { timeout: 15000 });
        await page.click(".arrival-film-skip");
        await page.waitForSelector("#arrival-film", { state: "detached", timeout: 5000 });
        await prep(page);
        await videoReady(page);
      },
    },
    {
      name: "05-second-visit",
      caption: "A visitor who already watched it lands straight on the hero — no film, no delay.",
      path: "/?intro=off",
      action: async (page) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await prep(page);
        await videoReady(page);
      },
    },
    {
      name: "06-tour-studio",
      caption: "**Floor plans, 3D tab — studio.** One tour, so no picker is drawn. Also note the tab strip: it was hardcoded to two columns, so the third layout used to wrap onto a second row.",
      path: "/?intro=off",
      action: (page) => tourTab(page, "Studio"),
    },
    {
      name: "07-tour-1br-furnished",
      caption: "**1 Bedroom** — the only layout shot twice, so it gets a picker. Furnished is the default.",
      path: "/?intro=off",
      action: (page) => tourTab(page, "1 Bedroom"),
    },
    {
      name: "08-tour-1br-unfurnished",
      caption: "The same layout, **Unfurnished** selected — the chip switches the source without touching the layout tabs. The frame is empty because this environment cannot reach Matterport.",
      path: "/?intro=off",
      action: async (page) => {
        await tourTab(page, "1 Bedroom");
        await page.locator('.plan-tour-chip:has-text("Unfurnished")').click();
        await page.waitForTimeout(500);
      },
    },
    {
      name: "09-walk-the-building",
      caption: "**Walk the building.** The roof and the gym belong to no layout tab, so they sit under the gallery.",
      path: "/?intro=off",
      action: async (page) => {
        await prep(page);
        await page.locator(".amenity-tours").scrollIntoViewIfNeeded();
        await page.waitForTimeout(400);
      },
    },
    {
      name: "10-walk-the-building-phone",
      caption: "The same three on a phone — they wrap rather than scroll.",
      path: "/?intro=off",
      action: async (page) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await prep(page);
        await page.locator(".amenity-tours").scrollIntoViewIfNeeded();
        await page.waitForTimeout(400);
      },
    },
  ],
};
