# Niwa Apartments — photo & asset store

Heavy assets for **Niwa Apartments**, 513 1st Ave N, Seattle WA 98109: photos,
floor-plan drawings, and the social preview image.

Binaries only. No site code lives here.

## Where the actual website lives

**`marketing-agm/magnolia-apartments-agm` → `src/sites/niwa/`**

One Astro template renders every AGM property; Niwa is a folder of config and
content inside it. A change to the template reaches every site, which is why the
Niwa site is *not* a separate codebase.

This repo exists so those photos don't bloat the template repo as it grows
toward 45 properties — the pattern the template's own README recommends:

> Heavy assets (photos, 3D tours) should point at object storage, not be
> committed here.

## ⚠️ Uploading a photo here does not put it on the site

Nothing in this repo is read by the build. A file here is a stored original
until it is either copied into the site repo or served from a URL the site
points at. Two routes:

**Route A — copy into the site repo.** Put the file in
`src/sites/niwa/public/images/` in `magnolia-apartments-agm`, using the exact
filename from the tables below. Every slot is pre-wired, so no config change is
needed. Simplest, works today, and is how Magnolia runs.

**Route B — Cloudflare R2.** Upload to object storage and point the `src` in
`src/sites/niwa/photos.json` at the R2 URL instead of a local path. Better at
scale; needs the bucket set up first.

Either way this repo stays the source of truth for the originals — full-size,
un-optimised, before any cropping for the web.

## What Niwa needs

Nothing is supplied yet. Every unfilled slot shows a "Photography coming soon"
placeholder, so partial uploads are fine — add what exists and fill the rest in
later.

### Standalone

| File | Used by | Notes |
|---|---|---|
| `images/hero.jpg` | Hero visual | Landscape, ≥2000px wide. Currently `hero.image` is empty, so the hero renders without a photo. |
| `images/og.jpg` | Social share preview | 1200×630. Set `seo.ogImage` to `/images/og.jpg` once added. |

### Floor plans

Niwa's live layouts, from the AppFolio feed — 17 units across three plans:

| File | Plan | Units in feed |
|---|---|---|
| `images/floorplans/studio.png` | Studio · 1 bath | 11 |
| `images/floorplans/1br.png` | 1 bed · 1 bath | 2 |
| `images/floorplans/2br1ba.png` | 2 bed · 1 bath | 4 |

The plan keys (`studio`, `1br`, `2br1ba`) come from the feed and must match —
they're how a drawing attaches to its layout.

### Plan photos

Representative photos per layout, shown in the unit detail modal so a studio
shows studio photos. Name them `images/plans/<plan>-<room>.jpg`, e.g.
`studio-living.jpg`, `1br-bedroom.jpg`, `2br1ba-kitchen.jpg`.

Where a room is identical across layouts, use one file and reference it from
both rather than duplicating it.

### Gallery

Filenames are referenced by `photos.json` → `src`, in the form
`images/gallery/<category>-<slug>.jpg`. Four categories:

| Category | For Niwa, that means |
|---|---|
| `interior` | Kitchens, living areas, bedrooms, bathrooms |
| `exterior` | Building facade, entrance, the 1st Ave N approach |
| `units` | Specific units worth showing — name them `units-unit-204.jpg` etc. |
| `neighborhood` | Seattle Center, Uptown, Queen Anne, the walk to the Sound |

Niwa's selling points, per its site config, are on-site laundry, studio-to-2BR
range, and walking distance to Seattle Center — the gallery should carry those.

## Naming and format rules

- Keep filenames **exactly** as listed; they're referenced by config, not
  discovered by scanning.
- Landscape crops best — gallery cards are 4:3.
- Upload whatever you have (PNG, HEIC, large originals). They get optimised
  before they reach the site.
- To change a caption, edit `title`/`desc` in `photos.json` in the site repo —
  not the filename here.

## Fair-housing note

Niwa has income-restricted MFTE homes. Photograph the building and the homes;
avoid images that imply who does or doesn't live here.
