# Leasing flyer

A one-page, print-ready leasing flyer built on the same design system as the
site: the dark ground, the hairline 12-column grid, Inter Tight, and the one
gold held back for the end of the page.

- `leasing-flyer.html` — the source. It reads the site's own fonts
  (`public/fonts/`) and photography (`src/assets/gallery/`) straight off disk,
  so the flyer and the site cannot drift apart on type or imagery.
- `niwa-leasing-flyer.pdf` — the built artifact, US Letter portrait (8.5 × 11 in),
  full bleed, one page.

## Build

```
node scripts/build-flyer.mjs
```

Renders the PDF with the Chromium that ships with Playwright — no dev server
and no install step. It also writes a 2× proof to `flyer/dist/proof.png`
(git-ignored). The proof window is taller than the page on purpose: the screen
pipeline lays out a few pixels differently from the print one, so an overrun
shows up rather than being cropped. The PDF is the artifact of record.

## Numbers on the page

Rents, square footage and the availability counts come from `src/site/units.json`
(the AppFolio feed), the Walk/Bike/Transit scores and the copy from
`src/site/site.config.json`. They are transcribed by hand, so re-check them
against the feed before a print run and update the "as of" date in the gold band.

## Printing

The page bleeds to all four edges. Desktop printers will add a white margin;
for a commercial run, ask the printer for 0.125 in bleed and supply this PDF
scaled to their trim box.
