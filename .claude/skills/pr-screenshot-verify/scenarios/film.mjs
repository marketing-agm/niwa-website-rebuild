// The re-cut arrival film: 21.3s of source at 0.6x, no end card.
import { settleReveals } from "./_common.mjs";

/** Hold the film at a given fraction of its (new) duration. */
const filmAt = (frac) => async (p) => {
  await p.setViewportSize({ width: 1440, height: 900 });
  await p.waitForFunction(() => {
    const v = document.querySelector('.arrival-film-video');
    return v && v.readyState >= 2 && isFinite(v.duration) && v.duration > 0;
  }, { timeout: 25000 });
  await p.evaluate((f) => {
    const v = document.querySelector('.arrival-film-video');
    v.pause();
    v.currentTime = Math.max(0, v.duration * f - 0.05);
  }, frac);
  await p.waitForFunction(() => {
    const v = document.querySelector('.arrival-film-video');
    return v && v.readyState >= 2 && !v.seeking;
  }, { timeout: 15000 }).catch(() => {});
  await p.waitForTimeout(500);
};

export default {
  viewport: { width: 1440, height: 900 },
  shots: [
    { name: "01-film-mid", caption: "Mid-film. 35.5 seconds now — 21.3s of footage at 0.6×, so a third less film held much longer.",
      path: "/?intro=on", waitUntil: "load", action: filmAt(0.5) },
    { name: "02-film-last-second", caption: "**The last second.** The old cut ran to 30.2s and spent its final eight on a flashing \"NOW LEASING · 206-622-9991 / LEASING@NIWAAPARTMENTS.COM\" card. It fades up between 21.3s and 21.6s of source, so the cut lands at 21.3 — the clean rooftop shot is the last thing on screen.",
      path: "/?intro=on", waitUntil: "load", action: filmAt(0.995) },
  ],
};
