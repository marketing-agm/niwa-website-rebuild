// The arrival film, and the handover to the hero underneath.
//
// The film plays full-screen with nothing on top of it, then fades out to the
// split hero. That handover is the whole point of the change, so it is shot on
// both sides: the film holding the screen, and the page it reveals.
//
// `?intro=on` replays it (it is otherwise once per tab, and a screenshot run
// opens several pages in one context), `?intro=off` is the returning visitor.

import { settleReveals, freezeMotion, videoReady } from "./_common.mjs";

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

export default {
  viewport: { width: 1440, height: 900 },
  shots: [
    {
      name: "01-film-open",
      caption: "**The arrival film** — full screen, nothing layered on it, so the film's own captions read as they were cut",
      path: "/?intro=on",
      action: (page) => filmAt(page, 2),
    },
    {
      name: "02-film-mid",
      caption: "Fifteen seconds in, with the skip control that is visible from the first frame",
      path: "/?intro=on",
      action: (page) => filmAt(page, 15),
    },
    {
      name: "03-film-mobile",
      caption: "iPhone width — the 16:9 frame is fitted, not cropped, so the captions keep both their ends",
      path: "/?intro=on",
      action: async (page) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await filmAt(page, 8);
      },
    },
    {
      name: "04-after-the-film",
      caption: "**What it fades to** — skip pressed, film gone, the split hero underneath with its loop running",
      path: "/?intro=on",
      action: async (page) => {
        await page.waitForSelector(".arrival-film:not([hidden])", { timeout: 15000 });
        await page.click(".arrival-film-skip");
        await page.waitForSelector("#arrival-film", { state: "detached", timeout: 5000 });
        await freezeMotion(page);
        await settleReveals(page);
        await videoReady(page);
      },
    },
    {
      name: "05-second-visit",
      caption: "`?intro=off` — a visitor who already watched it lands straight on the hero, no film, no delay",
      path: "/?intro=off",
      action: async (page) => {
        await freezeMotion(page);
        await settleReveals(page);
        await videoReady(page);
      },
    },
  ],
};
