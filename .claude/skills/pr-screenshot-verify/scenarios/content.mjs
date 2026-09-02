// Content population: the gallery and the FAQ.
//
// Both were empty before — the gallery had a single photo and faq.json was `[]`,
// so the FAQ section rendered nothing at all. These shots exist to check that
// real content sits properly in layouts that had only ever been seen holding
// placeholders.

import { goToSection, settleReveals, freezeMotion, openGallery, openSheet } from "./_common.mjs";

const prep = async (page) => {
  await freezeMotion(page);
  await settleReveals(page);
};

export default {
  viewport: { width: 1440, height: 900 },
  shots: [
    {
      name: "01-gallery",
      caption: "Gallery — eight photographs where there was one",
      path: "/?video=off",
      action: async (page) => { await prep(page); await goToSection(page, "gallery"); },
    },
    {
      name: "02-gallery-lightbox",
      caption: "A photo opened — checks the caption and description carry through",
      path: "/?video=off",
      action: async (page) => { await prep(page); await openGallery(page, 1); },
    },
    {
      name: "03-faq",
      caption: "FAQ — seven answers, where the section previously rendered empty",
      path: "/?video=off",
      action: async (page) => { await prep(page); await openSheet(page, "faq"); },
    },
    {
      name: "04-gallery-mobile",
      caption: "Gallery at iPhone width",
      path: "/?video=off",
      action: async (page) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await prep(page);
        await goToSection(page, "gallery");
      },
    },
    {
      name: "05-faq-mobile",
      caption: "FAQ at iPhone width",
      path: "/?video=off",
      action: async (page) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await prep(page);
        await openSheet(page, "faq");
      },
    },
    {
      name: "06-full-page",
      caption: "Whole page with the video hero and the populated sections",
      path: "/?video=background",
      fullPage: true,
      action: async (page) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await prep(page);
      },
    },
  ],
};
