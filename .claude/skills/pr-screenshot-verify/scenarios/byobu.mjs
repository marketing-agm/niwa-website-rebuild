// The byobu door: closed, mid-fold, and what it reveals.
//
// A one-second fold cannot be photographed while it runs, so `?door=hold`
// leaves the screen standing for the closed shot, and the mid-fold shots drive
// the `is-open` class directly rather than letting the component's own timer
// run — that timer also removes the element, which would take the subject away
// before the shutter.

import { settleReveals, freezeMotion, videoReady } from "./_common.mjs";

/** Start the fold by hand and hold it partway through.
 *
 * Every shot using this sets `settleMs: 0`. The driver otherwise waits its own
 * 500ms after the action, which on a 980ms fold is the difference between
 * photographing the middle of the movement and photographing the end of it —
 * the first version of these shots was all end. */
async function foldTo(page, ms) {
  await page.waitForSelector(".byobu:not([hidden])", { timeout: 10000 });
  await page.evaluate(() => document.getElementById("byobu").classList.add("is-open"));
  await page.waitForTimeout(ms);
}

export default {
  viewport: { width: 1440, height: 900 },
  shots: [
    {
      name: "01-door-closed",
      caption: "**The screen, standing.** One artwork across six leaves — the branch runs unbroken and only breaks as it folds. Hinges are the dark edges between leaves.",
      path: "/?intro=on&door=hold",
      waitUntil: "load",
      action: async (page) => {
        await page.waitForSelector(".byobu:not([hidden])", { timeout: 10000 });
        await page.waitForTimeout(700);
      },
    },
    {
      name: "02-door-folding",
      caption: "**Mid-fold**, about a third through. Alternate leaves turn opposite ways — that alternation is what makes it a concertina rather than a curtain — and the shading is light falling on leaves turning away.",
      path: "/?intro=on&door=hold",
      waitUntil: "load",
      settleMs: 0,
      action: (page) => foldTo(page, 300),
    },
    {
      name: "03-door-nearly-open",
      caption: "Two thirds through, gathering at the right, with the film already running behind it.",
      path: "/?intro=on&door=hold",
      waitUntil: "load",
      settleMs: 0,
      action: (page) => foldTo(page, 620),
    },
    {
      name: "04-door-phone",
      caption: "Phone width, mid-fold — six leaves is too many at 390px, which is what this shot is for.",
      path: "/?intro=on&door=hold",
      waitUntil: "load",
      settleMs: 0,
      action: async (page) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await foldTo(page, 420);
      },
    },
    {
      name: "05-film-behind",
      caption: "**What the door opens onto** — the film, full screen, nothing layered on it.",
      path: "/?intro=on",
      waitUntil: "load",
      action: async (page) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.waitForFunction(() => !document.getElementById("byobu"), { timeout: 10000 });
        await page.waitForFunction(() => {
          const v = document.querySelector(".arrival-film-video");
          return v && v.readyState >= 2;
        }, { timeout: 15000 });
        await page.evaluate(() => {
          const v = document.querySelector(".arrival-film-video");
          v.pause(); v.currentTime = 6;
        });
        await page.waitForTimeout(600);
      },
    },
    {
      name: "06-marumado",
      caption: "**The round window that closes the page.** You come in through a screen and leave looking out. Everything but the photograph is drawn — the lattice, the centre post crossing the opening, the wood reveal.",
      path: "/?intro=off",
      action: async (page) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await freezeMotion(page);
        await settleReveals(page);
        await page.locator(".marumado").scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
      },
    },
    {
      name: "07-marumado-phone",
      caption: "The window at phone width — the screen squares up and the copy drops below it.",
      path: "/?intro=off",
      action: async (page) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await freezeMotion(page);
        await settleReveals(page);
        await page.locator(".marumado").scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
      },
    },
    {
      name: "08-landing",
      caption: "And the landing screen it fades to.",
      path: "/?intro=off",
      action: async (page) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await freezeMotion(page);
        await settleReveals(page);
        await videoReady(page);
      },
    },
  ],
};
