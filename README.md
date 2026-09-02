# Niwa Apartments — website

The marketing site for **Niwa Apartments**, 513 1st Ave N, Seattle WA 98109.

This is a standalone, single-property Astro site. Everything about how it looks
and works lives here and can be changed freely.

## Where this came from, and what that means

Forked from AGM's shared apartment template
(`marketing-agm/magnolia-apartments-agm`), which renders many properties from
one codebase. That template was flattened here to a single site: no
`src/sites/` folder, no `SITE` environment variable, one property.

**This is a clean break.** Changes to the shared template no longer reach Niwa,
and changes here never touch Magnolia. Two independent codebases.

The upside is total freedom — restructure the page, change the fonts, add
sections, rewrite the JavaScript. None of it can affect another property.
The cost is that a bug fixed in the template stays broken here unless someone
ports it across by hand.

## Layout

```
src/
  site/                  ← everything specific to Niwa
    site.config.json     ← identity, address, geo, theme colors, SEO, analytics
    units.json           ← availability / pricing / floor plans (from AppFolio)
    places.json          ← neighborhood map pins
    photos.json          ← gallery
    bus-stops.json       ← transit points for the map
    faq.json
  layouts/BaseLayout.astro   ← <head>: SEO, Open Graph, JSON-LD, theme
  components/            ← FloorPlans, Faq, StickyCta, Analytics
  styles/global.css      ← all styling
  generated/body.html    ← the page markup
  lib/site.ts            ← loads the JSON above
  pages/                 ← index + robots.txt / sitemap.xml / site.webmanifest
public/                  ← static files served as-is
  app.js                 ← all client-side behavior
  images/                ← hero, gallery, floor plans
  llms.txt               ← for AI crawlers
  admin/                 ← Sveltia CMS (see below)
```

## Run locally

```bash
npm install
npm run dev          # http://localhost:4321
npm run build        # static site into dist/
npm run preview      # serve the built dist/
```

## Availability

`units.json` is generated from AGM's AppFolio feed — don't hand-edit it.

```bash
npm run refresh                             # update from the live feed
npm run refresh -- --dry-run                # report only, no write
```

It merges: AppFolio drives beds, baths, sqft, rent and dates, while
hand-written marketing copy on a unit is preserved.

## Deploying

Cloudflare **Pages**, one project.

| Setting | Value |
|---|---|
| Repository | `marketing-agm/niwa-website-rebuild` |
| Project name | `niwa-website-rebuild` — must match `name` in `wrangler.toml` |
| Production branch | `claude/niwa-website-rebuild-setup-4i1y68` |
| Build command | `npm run build` |
| Output directory | `dist` (also pinned in `wrangler.toml`) |
| Environment variables | none |

Pages deploys the built output itself, so there is **no deploy command**.

Cloudflare's "create an app" flow now produces a *Worker* instead. To get a
Pages project, use the **"Continue to Pages"** link at the bottom of that
screen, or go straight to `/pages/new` in the dashboard.

⚠️ `wrangler.toml` must stay in its Pages form (`pages_build_output_dir`). The
Workers form (`[assets] directory`, `workers_dev`) belongs to a different kind
of project — a Worker deploy against Pages config fails with "Missing
entry-point to Worker script or to assets directory".

**A push to the production branch changes the live site.** Preview elsewhere first.

## The domain

`site.config.json → domain` drives the canonical URL, Open Graph, sitemap,
robots and `llms.txt`. Never hardcode the host anywhere else — in `public/`,
write `{{SITE_DOMAIN}}` and the build substitutes it.

Currently `https://niwa-website-rebuild.pages.dev` with **`seo.noindex: true`**,
which emits `noindex, nofollow` and a `Disallow: /` robots.txt. That is
deliberate: the site is live and shareable but invisible to search, so it
doesn't accumulate SEO history on a hostname you intend to throw away.

When the real domain is live, it's two lines:

```json
"domain": "https://<the-real-domain>",
"seo": { "noindex": false }
```

Change it **after** the domain resolves, not before — a canonical pointing at a
host that doesn't exist tells Google the live page isn't authoritative.

## Still to do

- [ ] `geo` — no coordinates set, so the map has no "you are here" pin and
      there is no `GeoCoordinates` in the structured data
- [ ] `places.json`, `bus-stops.json`, `faq.json` are empty
- [ ] No photos yet — `public/images/` is scaffolded but empty, so the gallery
      and hero fall back to placeholders
- [ ] `integrations.emailjs` keys are blank — **the tour form silently sends
      nothing until these are set.** It shows "Thanks ✓" either way.
- [ ] Analytics IDs (`analytics.google`, `posthog`, `clarity`) are blank
- [ ] `seo.ogImage` is empty, so link previews have no image

## Photos

Drop files into `public/images/` and they serve at `/images/…`.

| Path | Used by |
|---|---|
| `images/hero.jpg` | Still hero visual. Landscape, ≥2000px wide. |
| `images/hero-poster.jpg` | Poster frame for the hero video — must be the loop's own first frame, or the handover to playback visibly jumps. |
| `video/niwa-hero-loop.webm` · `.mp4` | The 6.5s background loop. WebM first (smaller), MP4 for Safari. |
| `video/niwa-hero-film.mp4` | The full 30s marketing film, fetched only when someone expands it. |
| `images/og.jpg` | Social preview, 1200×630. Set `seo.ogImage` to `/images/og.jpg`. |
| `images/floorplans/studio.png` | Studio plan drawing (11 units in the feed) |
| `images/floorplans/1br.png` | 1 bed · 1 bath (2 units) |
| `images/floorplans/2br1ba.png` | 2 bed · 1 bath (4 units) |
| `images/gallery/<category>-<slug>.jpg` | Gallery — referenced by `photos.json` → `src` |
| `images/plans/<plan>-<room>.jpg` | Per-layout photos in the unit modal |

Gallery categories: `interior`, `exterior`, `units`, `neighborhood`.

Filenames are referenced by config, not discovered by scanning — keep them
exact. Landscape crops best; gallery cards are 4:3.

Once the set gets large, move them to object storage (Cloudflare R2) and point
`photos.json → src` at those URLs instead of committing binaries here.

## The hero video

`site.config.json → hero.video` drives it. `mode` picks the default placement and
a `?video=` query parameter overrides it at runtime, so one deploy can be shown
both ways:

| `?video=` | What happens |
|---|---|
| `background` | The 6.5s loop autoplays behind the hero; a centred control expands the full film |
| `modal` | The hero stays a still; the full film opens over the page on arrival, once per session |
| `off` | Still photography only |

The loop is **a re-cut, not the film**. The supplied 30s film has burned-in
captions — a "NOW ARRIVING / NIWA" title card, feature labels, and a "NOW LEASING"
end card carrying a phone number and email. Behind the hero those would sit
alongside the page's own headline and CTA and duplicate them, so the loop is
assembled from the only text-free stretches in the master: 15.70–17.35 (living
room), 20.95–21.90 (rooftop), 7.95–10.15 (gym, kitchen) and 13.70–15.40 (bedroom).
Order is deliberate — the living room and its view open the loop because that is
the frame sitting next to "Iconically, Seattle."

To re-cut it, work from `video/niwa-hero-film.mp4` and check any new in/out points
against those windows; a quarter-second either side catches a caption fading.

It never autoplays for `prefers-reduced-motion`, `Save-Data`, or a 2G connection —
those get the poster and a play button instead.

⚠️ **~15MB of video is committed here.** That is over the line the "Photos"
section draws: move these to Cloudflare R2 and point `hero.video` at the URLs
before the library grows further.

## Admin portal

A git-based CMS ([Sveltia](https://github.com/sveltia/sveltia-cms)) at
`/admin`. Editors log in with GitHub and get forms; saving commits back to the
JSON in `src/site/`.

⚠️ **It does not work yet.** `public/admin/config.yml` has
`base_url: https://REPLACE-WITH-YOUR-AUTH-WORKER.workers.dev` — a placeholder.
The CMS commits via the GitHub API, which needs an OAuth relay:

1. GitHub → Settings → Developer settings → OAuth Apps → New. Callback URL is
   the auth worker's `/callback`.
2. Deploy the [`sveltia-cms-auth`](https://github.com/sveltia/sveltia-cms-auth)
   Cloudflare Worker; set `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` as secrets.
3. Put the worker's URL in `base_url`.

## External dependencies (loaded from CDN at runtime)

Google Fonts, Leaflet 1.9.4, CartoDB map tiles, OpenStreetMap Nominatim
(commute geocoding), OpenRouteService (optional, via
`site.config.json → integrations.orsApiKey`).

## Fair-housing note

Niwa has income-restricted MFTE homes. Describe the homes and the building;
avoid copy or images that imply who does or doesn't live here.
