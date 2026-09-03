// Roundness back on the controls, and the shoji that opens as each section
// arrives. NOT freezeMotion for the transition shots — the transition is the
// subject; zeroing durations photographs the end state four times.
import { settleReveals, freezeMotion, goToSection } from "./_common.mjs";
const prep = async (p) => { await freezeMotion(p); await settleReveals(p); };

/** Scroll a section into view and hold `ms` into its screen opening. */
const opening = (id, ms) => async (p) => {
  await p.setViewportSize({ width: 1440, height: 900 });
  await settleReveals(p);
  await p.evaluate((sid) => {
    const s = document.getElementById(sid);
    // Park it below the fold first so the observer has not fired yet.
    window.scrollTo({ top: s.getBoundingClientRect().top + window.scrollY - window.innerHeight * 1.4, behavior: 'instant' });
  }, id);
  await p.waitForTimeout(500);
  await p.evaluate((sid) => {
    const s = document.getElementById(sid);
    window.scrollTo({ top: s.getBoundingClientRect().top + window.scrollY - 60, behavior: 'instant' });
  }, id);
  await p.waitForTimeout(ms);
};

export default {
  viewport: { width: 1440, height: 900 },
  shots: [
    { name: "01-screen-closed", caption: "**The screen, part way open.** Four leaves parting from the centre as the section arrives — the two inner ones lead, the outer two follow, so it reads as one screen opening rather than four things moving.",
      // settleMs 0: drive.mjs otherwise waits 500ms between action and shot,
      // which is most of the transition. The hold belongs in the action.
      path: "/?intro=off", settleMs: 0, action: opening("floor-plans", 120) },
    { name: "02-screen-opening", caption: "Further through the same opening.",
      path: "/?intro=off", settleMs: 0, action: opening("floor-plans", 480) },
    { name: "03-screen-open", caption: "Landed. The panel removes itself once it has opened, so a section that has been seen costs nothing afterwards.",
      path: "/?intro=off", settleMs: 0, action: opening("floor-plans", 1800) },
    { name: "04-round-controls", caption: "**Roundness is back on the controls.** Two radii — 10px on things you press, 18px on the surfaces they sit on — so a chip inside a card is not a smaller copy of the card's own corner. The segmented controls stay stadiums.",
      path: "/?intro=off", action: async (p) => {
        await p.setViewportSize({ width: 1440, height: 900 });
        await prep(p); await goToSection(p, "availability"); await p.waitForTimeout(500); } },
    { name: "05-round-hero", caption: "The hero's buttons, and the nav. The lattice keeps its corners — a shoji with rounded panes is a bento box.",
      path: "/?intro=off", action: async (p) => {
        await p.setViewportSize({ width: 1440, height: 900 });
        await prep(p); await p.evaluate(() => window.scrollTo({top:0,behavior:'instant'})); await p.waitForTimeout(400); } },
    { name: "06-round-shoji", caption: "The shoji panel — square lattice, rounded things inside it.",
      path: "/?intro=off", action: async (p) => {
        await p.setViewportSize({ width: 1440, height: 900 });
        await prep(p); await goToSection(p, "the-building"); await p.waitForTimeout(500); } },
  ],
};
