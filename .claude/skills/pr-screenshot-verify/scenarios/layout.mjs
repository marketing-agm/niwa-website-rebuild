import { settleReveals, freezeMotion, goToSection } from "./_common.mjs";
const prep = async (p) => { await freezeMotion(p); await settleReveals(p); };
const at = (id, cap) => ({
  name: id, caption: cap, path: "/?intro=off",
  action: async (p) => { await p.setViewportSize({ width: 1440, height: 900 }); await prep(p); await goToSection(p, id.replace(/^\d+-/, "")); await p.waitForTimeout(450); },
});
export default {
  viewport: { width: 1440, height: 900 },
  shots: [
    at("gallery", "**Head treatment 1** — title left, lede pushed to the far right. Note the sheet number set vertically down the left margin, the way a drawing is labelled."),
    at("the-building", "The shoji panel between them, unchanged."),
    at("floor-plans", "**Floor plans: the switcher is a rail now.** Tabs across the top is the shape every listing site uses; down the side it reads as an index and the plan viewer gets the width it wants."),
    at("availability", "**Head treatment 2** — the title runs as a banner across the full measure and the lede drops beneath it, right-aligned."),
  ],
};
