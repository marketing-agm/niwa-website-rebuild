// PR #32 — the unit-type galleries.
//
// The dialogs are the whole change, so every shot opens one. A shot that
// forgets to close the previous dialog photographs it stacked under the next,
// so each action closes before it opens.
import { settleReveals, freezeMotion } from "./_common.mjs";

const prep = async (p) => { await freezeMotion(p); await settleReveals(p); };

const openUnit = (w, h, key, ms = 800) => async (p) => {
  await p.setViewportSize({ width: w, height: h });
  await prep(p);
  await p.evaluate((k) => {
    document.querySelectorAll("dialog[open]").forEach((d) => d.close());
    document.querySelector(`[data-open-dialog="home-${k}"]`)?.click();
  }, key);
  await p.waitForTimeout(ms);
};

const openLightbox = (w, h, key, idx) => async (p) => {
  await openUnit(w, h, key)(p);
  await p.evaluate(([k, i]) => {
    document.querySelectorAll(`#home-${k} [data-lbx-open]`)[i]?.click();
  }, [key, idx]);
  await p.waitForTimeout(700);
};

export default {
  viewport: { width: 1440, height: 900 },
  shots: [
    {
      name: "01-studio-grid-1440",
      caption: "**Studio, 1440px.** The dialog used to be a facts rail plus one full-height Matterport iframe. It opens on photography now. Eight cells of varying span tile six columns across five rows exactly, so plain auto-placement leaves no holes — hairlines are the 1px gap showing the line colour through, the same trick the page grid uses.",
      action: openUnit(1440, 900, "studio"),
    },
    {
      name: "02-onebed-grid-1440",
      caption: "**One bedroom, 1440px.** Same pattern, different set and different order — the three galleries should not read as one gallery shown three times. Note the cell at lower left: it carries what the pictures cannot.",
      action: openUnit(1440, 900, "1br"),
    },
    {
      name: "03-lightbox-1440",
      caption: "**The viewer.** A `<dialog>`, not a positioned div — the galleries sit inside a dialog that is already `showModal()`, and anything outside the top layer renders underneath it whatever its z-index. A second `showModal()` stacks above, which also means Escape closes the picture and returns you to the unit rather than out of it. Loads a build-time 1800px rendition, not a blown-up thumbnail.",
      action: openLightbox(1440, 900, "studio", 3),
    },
    {
      name: "04-studio-grid-390",
      caption: "**390px.** Six irregular columns are unreadable on a phone, so it folds to two — the wide cells keep the full row, which preserves the irregularity, and the same eight cells still tile exactly.",
      action: openUnit(390, 844, "studio"),
    },
    {
      name: "05-lightbox-390",
      caption: "**The viewer at 390px.** Swipe, arrows and a counter. This is where it will mostly be opened.",
      action: openLightbox(390, 844, "1br", 0),
    },
    {
      name: "06-twobed-grid-768",
      caption: "**Two bedroom, 768px** — tablet, where the dialog's rail moves above the gallery rather than beside it.",
      action: openUnit(768, 1024, "2br"),
    },
  ],
};
