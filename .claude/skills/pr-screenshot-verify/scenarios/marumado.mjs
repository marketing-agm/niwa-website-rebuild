import { settleReveals, freezeMotion, goToSection } from "./_common.mjs";
const prep = async (p) => { await freezeMotion(p); await settleReveals(p); };
export default {
  viewport: { width: 1440, height: 900 },
  shots: [
    { name: "01-marumado", caption: "**The marumado is the screen now.** One lattice spans the band and the copy lives inside its panes — label top-left, a lit pane, the heading top-right, the round opening cut through the lower-left quarter, then lede, action and address along the base.",
      path: "/?intro=off", action: async (p) => {
        await p.setViewportSize({ width: 1440, height: 900 });
        await prep(p); await goToSection(p, "marumado"); await p.waitForTimeout(500); } },
    { name: "02-marumado-wide", caption: "1920 — the weave holds at desk width.",
      path: "/?intro=off", action: async (p) => {
        await p.setViewportSize({ width: 1920, height: 1080 });
        await prep(p); await goToSection(p, "marumado"); await p.waitForTimeout(500); } },
    { name: "03-marumado-phone", caption: "Phone — the twelve-column weave becomes a stack, and the lit pane goes last and thin: a strip of light at the base of the screen.",
      path: "/?intro=off", action: async (p) => {
        await p.setViewportSize({ width: 390, height: 844 });
        await prep(p); await goToSection(p, "marumado"); await p.waitForTimeout(500); } },
    { name: "04-headline-black", caption: "**The outlined headline is reverted.** No yellow fill, no ink shadow — the italic is plain black and carries its own emphasis.",
      path: "/?intro=off", action: async (p) => {
        await p.setViewportSize({ width: 1440, height: 900 });
        await prep(p); await p.evaluate(() => window.scrollTo({top: 0, behavior: 'instant'})); await p.waitForTimeout(400); } },
  ],
};
