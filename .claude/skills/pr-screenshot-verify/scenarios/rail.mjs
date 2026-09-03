import { settleReveals, freezeMotion, goToSection } from "./_common.mjs";
const prep = async (p) => { await freezeMotion(p); await settleReveals(p); };
const at = (id) => async (p) => {
  await p.setViewportSize({ width: 1440, height: 900 });
  await prep(p); await goToSection(p, id); await p.waitForTimeout(400);
};
export default {
  viewport: { width: 1440, height: 900 },
  shots: [
    { name: "01-gallery", caption: "**The line is gone.** It ran down through the middle of the \"All 18\" chip, because the gallery's tab row starts further left than the rest of the page. The numbered eyebrow stays — that was never the line.", path: "/?intro=off", action: at("gallery") },
    { name: "02-floor-plans", caption: "Floor plans — same margin, no mark in it.", path: "/?intro=off", action: at("floor-plans") },
    { name: "03-availability", caption: "Availability.", path: "/?intro=off", action: at("availability") },
    { name: "04-the-building", caption: "The shoji panel. This is where the architecture the rail was reaching for actually lives.", path: "/?intro=off", action: at("the-building") },
  ],
};
