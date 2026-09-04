# Leasing flyer

A one-page, print-ready leasing flyer built on the same design system as the
site: the dark ground, the hairline 12-column grid, Inter Tight, and the one
gold held back for the end of the page.

Four variants of the same system, all US Letter portrait (8.5 × 11 in), full
bleed, one page:

- **A** — `leasing-flyer.html` / `niwa-leasing-flyer.pdf`. Type-led. The hero
  runs at 112px over open ground, and the building sits in an eight-column cell
  beside the 庭 idea. The homes are three cells of big rent figures.
- **B** — `leasing-flyer-b.html` / `niwa-leasing-flyer-b.pdf`. Image-led. The
  headline holds the left eight columns over two rows, with the numbers set
  against the first line and the lede beside the second, so neither top corner
  is left empty. The building then runs edge to edge at the height the
  photograph needs, and the homes take the site's own display rows — name left,
  size, rent and availability in fixed columns — with the idea cell beside them.

- **C · Tatami** — `leasing-flyer-c.html` / `niwa-leasing-flyer-c.pdf`. No
  photography at all. The sheet is a room: a fine shoji lattice across the whole
  page, and over it five mats laid in the pinwheel of a 4½-mat tatami room, so
  no four corners ever meet. Each mat holds one pocket of information and
  nothing else, and the gold is the last mat on the page.

- **Jisoo** — `leasing-flyer-jisoo.html` / `niwa-leasing-flyer-jisoo.pdf`. C's
  room with the photography laid back into it. Seven mats on a module of twelve
  bays by nine, still arranged so no four corners meet: four hold a pocket of
  information, three hold a photograph, and the last is the gold. No Japanese
  characters. Every word on the sheet comes from the site — see below.

A and B read the site's fonts (`public/fonts/`) and photography
(`src/assets/gallery/`) straight off disk, so they and the site cannot drift
apart on type or imagery. C uses the fonts only.

### Where Jisoo's copy comes from

Nothing on that sheet is written for it. The mapping, so it can be re-checked:

| On the flyer                  | Source                                        |
|-------------------------------|-----------------------------------------------|
| Iconically, / Seattle.        | `hero.title` + `hero.titleItalic`             |
| The lede                      | `hero.intro`                                  |
| Address, phone, email         | `address`, `contact`                          |
| Rents, sizes, "N available"   | `units.json`, aggregated per plan             |
| "Nineteen layouts across…"    | `homes.lede`, first sentence + the 3D mention |
| Everything, in its place.     | `building.title` + `building.titleItalic`     |
| The amenity list              | `featureLists`, shortened to fit the column   |
| Walk / Bike / Transit         | `walkScores`                                  |
| The offer and its note        | `special.eyebrow`, `.title`, `.note`          |
| Schedule a tour               | `tour.eyebrow`                                |
| See it in person this week    | `tour.title` + `tour.titleItalic`             |
| Managed by AGM…               | `footerBlurb`                                 |
| Equal Housing Opportunity…    | `Footer.astro`                                |

The amenity lines are the only ones trimmed — `featureLists` is written for a
wide page and the mat is four bays across.

### Sharing in Slack

Slack's PDF previewer shifts the colour of these dark pages badly (it comes out
pink). The PDF itself is correct — rasterise it and the greys and gold are
exactly right. `niwa-leasing-flyer-jisoo.png` is a true 2× raster of the PDF,
kept next to it for posting in Slack.

### How variant C is built

The room is set by five custom properties — `--col`, `--y0`…`--y3` — and every
seam, mat and lattice step is derived from them, so the whole composition moves
together if the proportions change. Three line weights carry the hierarchy, and
they must stay in this order or the sheet flattens out:

| Token       | Weight | What it draws                                |
|-------------|--------|----------------------------------------------|
| `--lattice` | 0.13   | the shoji ground, behind everything           |
| `--rule`    | 0.18   | rules inside a pocket                         |
| `--frame`   | 0.32   | the mat seams — the wooden frame of the room  |

The seams are drawn as six positioned 1px elements rather than borders on the
mats, so no edge is ever painted twice where two mats abut.

## Build

```
node scripts/build-flyer.mjs                              # variant A
node scripts/build-flyer.mjs flyer/leasing-flyer-b.html   # variant B
node scripts/build-flyer.mjs flyer/leasing-flyer-c.html   # variant C
node scripts/build-flyer.mjs flyer/leasing-flyer-jisoo.html  # Jisoo
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

## A note on the page grid

`.page` sets `grid-template-columns: minmax(0, 1fr)`. Without it the implicit
column is auto-sized, a single nowrap row can push the track past 8.5in, and
every band stretches with it — the sheet silently loses its right edge. Leave
it pinned.

## Printing

The page bleeds to all four edges. Desktop printers will add a white margin;
for a commercial run, ask the printer for 0.125 in bleed and supply this PDF
scaled to their trim box.
