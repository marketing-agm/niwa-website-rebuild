// #tour is not a section — it opens the booking dialog. app.js maps the hash to
// #tour-overlay and intercepts every href="#tour" on the page, so arriving at
// /#tour directly opens the wizard too.
import { settleReveals, freezeMotion } from "./_common.mjs";
const prep = async (p) => { await freezeMotion(p); await settleReveals(p); };
const openTour = (w) => async (p) => {
  await p.setViewportSize({ width: w, height: 1000 });
  await prep(p);
  await p.waitForTimeout(600);
};
export default {
  viewport: { width: 1440, height: 1000 },
  shots: [
    { name: "01-tour-desktop", caption: "Landing on /#tour at 1440 — step 1 of the booking wizard.", path: "/?intro=off#tour", action: openTour(1440) },
    { name: "02-tour-phone", caption: "Same on a phone.", path: "/?intro=off#tour", action: openTour(390) },
    { name: "03-tour-step3", caption: "Step 3 — the last step before submit.", path: "/?intro=off#tour",
      action: async (p) => {
        await p.setViewportSize({ width: 1440, height: 1000 });
        await prep(p); await p.waitForTimeout(500);
        for (let i = 0; i < 2; i++) {
          const chip = p.locator('#tour-overlay .tw-chip:not([disabled])').first();
          if (await chip.count()) { await chip.click().catch(() => {}); await p.waitForTimeout(250); }
          const next = p.locator('#tour-overlay .tw-continue').first();
          if (await next.count()) { await next.click().catch(() => {}); await p.waitForTimeout(400); }
        }
        await p.waitForTimeout(400);
      } },
  ],
};
