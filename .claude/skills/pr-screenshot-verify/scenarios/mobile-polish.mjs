// PR #31 — mobile polish.
//
// Two jobs. The phone shots show the four things that were fixed; the 1440
// shots are the regression proof, because the rails work by being
// display:contents above 640px and the whole claim of this PR is that the
// twelve-column desktop bento did not move.
//
// Every shot sets its own viewport — a scenario runs in one page, and a shot
// that inherits the previous width photographs a layout nobody asked for.
import { settleReveals, freezeMotion, heroReady, dismissOverlays, goToSection } from "./_common.mjs";

const prep = async (p) => { await freezeMotion(p); await dismissOverlays(p); await settleReveals(p); };

const at = (w, h, id) => async (p) => {
  await p.setViewportSize({ width: w, height: h });
  await prep(p);
  if (id) await goToSection(p, id);
  await p.waitForTimeout(350);
};

// Some targets are elements rather than section anchors.
const atEl = (w, h, sel, offset = 90) => async (p) => {
  await p.setViewportSize({ width: w, height: h });
  await prep(p);
  await p.evaluate(([s, o]) => {
    const el = document.querySelector(s);
    if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - o);
  }, [sel, offset]);
  await p.waitForTimeout(350);
};

const hero = (w, h) => async (p) => {
  await p.setViewportSize({ width: w, height: h });
  await freezeMotion(p);
  await heroReady(p);
  await settleReveals(p);
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(350);
};

export default {
  viewport: { width: 390, height: 844 },
  shots: [
    {
      name: "01-hero-390",
      caption: "**Hero, 390px.** The italic second line carried a `14vw` indent, which left \"Seattle.\" almost no track at phone width. Indent dropped below 560px, rhythm restored, both CTAs full width. The video came down from `66vh` to `46vh` so the stat grid is not pushed off a short screen.",
      action: hero(390, 844),
    },
    {
      name: "02-tour-form-390",
      caption: "**The tour form, 390px.** It is still a sentence — that is the point of it. What changed is that each clause is its own line, so it reads top to bottom in order instead of \"to move in\" landing after \"not sure yet\". Every input and chip is now a 44px press target; they were 36–41. The seven day chips became a swipe strip.",
      action: atEl(390, 844, "#tour-form", 40),
    },
    {
      name: "03-building-rail-390",
      caption: "**Building features, 390px.** Six cells of 70–96 characters each, stacked full width, were most of why this section ran to 3,469px — over a quarter of the mobile page. They swipe now; the next card peeking at the right edge is the affordance. Section is 2,739px.",
      action: atEl(390, 844, ".b-feats", 150),
    },
    {
      name: "04-neighborhood-390",
      caption: "**Neighbourhood tiles, 390px.** Same treatment: 1,835px of stacked tiles becomes 981px of swipe strip. A bug caught while verifying this — `.hood-grid` stays twelve columns at every width, so the rail wrapper landed in one column and collapsed the tiles to 72×48px. It claims the full row explicitly now.",
      action: atEl(390, 844, ".hood-tiles", 120),
    },
    {
      name: "05-hero-320",
      caption: "**320px (iPhone SE).** The narrowest width the site has to hold. No horizontal document overflow here or at 390 or 430.",
      action: hero(320, 800),
    },
    {
      name: "06-hero-1440",
      caption: "**Hero, 1440px — unchanged.** The indent, the rhythm and the video height are all still the desktop values; every change is behind a `max-width` query.",
      action: hero(1440, 900),
    },
    {
      name: "07-building-1440",
      caption: "**The desktop bento, 1440px — unchanged.** This is the regression proof. The rail wrapper is `display: contents` above 640px, so the six feature cells stay direct grid items and keep their explicit placement. Measured: `b-img1` spans 0→840 (cols 1–7), `b-f1` 841→1440 (cols 8–12), `b-img2` 480→960 (cols 5–8), `b-tours` 600→1440 (cols 6–12).",
      action: at(1440, 900, "building"),
    },
    {
      name: "08-tour-1440",
      caption: "**The tour form, 1440px — unchanged.** The clause wrappers are `display: inline` at this width, so the sentence renders exactly as it did before.",
      action: at(1440, 1000, "tour"),
    },
  ],
};
