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
  site/                  ← everything specific to Niwa (content, not design)
    site.config.json     ← identity, address, geo, copy, SEO, integrations
    units.json           ← availability / pricing (from AppFolio) — drives the
                           per-layout "from" rents and counts in The homes
    photos.json          ← gallery captions; `src` names a file in src/assets/gallery
    faq.json
    places.json, bus-stops.json  ← unused by the current design, kept for the CMS
  assets/                ← photography. Astro emits responsive WebP from these.
  layouts/BaseLayout.astro   ← <head>: SEO, Open Graph, JSON-LD, runtime config
  components/            ← one file per section, in page order:
                           Nav, Hero, Marquee, Manifesto, Building, Homes,
                           SiteMap, Neighborhood, Gallery, Faq, Tour, Footer,
                           plus Wordmark, TourDialog (Matterport) and Analytics
  scripts/motion.ts      ← Lenis smooth scroll + GSAP (reveals, hero, pinned
                           gallery, counters, footer wordmark, menu, FAQ, dialog)
  scripts/tour.ts        ← the tour-request sentence: validation, EmailJS, mailto fallback
  styles/global.css      ← design tokens, fluid type scale, hairline grid, buttons
  lib/site.ts            ← loads the JSON above
  lib/photos.ts, lib/homes.ts  ← resolve photos to assets; describe layouts from the feed
  pages/                 ← index + robots.txt / sitemap.xml / site.webmanifest
public/                  ← static files served as-is
  fonts/                 ← self-hosted Inter Tight + Geist Mono (latin subsets)
  images/og.jpg, favicon.svg, llms.txt, admin/ (Sveltia CMS)
```

## The design

One system, dark and monochrome, full-bleed with a hairline grid. Type is
Inter Tight (display and body) and Geist Mono (labels and data), all sizes on a
fluid `clamp()` scale so the composition holds from a 360px phone to a 2560px
monitor. The only colour is Niwa's own cladding yellow (`--gold`), reserved for
the tour section at the end of the page and the hover state of buttons.

Motion is GSAP with Lenis smooth scroll: masked line reveals in the hero, a
clip-path reveal on the hero photograph with a slow parallax, scroll-scrubbed
words in the manifesto, a horizontally pinned gallery on desktop (native swipe
on touch), counters, and the footer wordmark drawing itself with DrawSVG.
Everything respects `prefers-reduced-motion`, which turns Lenis and the
decoration off and leaves the page fully usable.

The tour request is a sentence — "Hi, I'm ___. I'm looking for [a studio]…" —
with chips for the choices and the next six weekdays offered as visit dates.
It sends through EmailJS when `integrations.emailjs` is configured; when it is
not, it hands the visitor a prepared `mailto:` so a request is never silently
dropped.

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

- [ ] Photography of individual homes — the gallery is the building, roof and
      neighborhood only
- [ ] `integrations.emailjs` keys are blank — until they are set the tour form
      falls back to a prepared `mailto:` link for the visitor to send themselves.
- [ ] Analytics IDs (`analytics.google`, `posthog`, `clarity`) are blank
- [ ] `seo.ogImage` is empty, so link previews have no image

## Photos

Photography lives in `src/assets/gallery/` and is referenced from
`src/site/photos.json` by filename (`src` keeps the `/images/gallery/<file>.jpg`
form). Astro resizes and converts to WebP at build time, so commit full-size
originals (landscape, ≥2000px wide). A `photos.json` entry that points at a
missing file fails the build rather than shipping a broken image.

`src/assets/hero.jpg` is the hero; `public/images/og.jpg` (1200×630) is the
social preview.

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

## External dependencies

Bundled: GSAP and Lenis (npm). Embedded at runtime: SightMap (the interactive
availability map) and Matterport (3D tours, loaded only when a tour is opened).
EmailJS loads from its CDN only when configured. Fonts are self-hosted.

## Fair-housing note

Niwa has income-restricted MFTE homes. Describe the homes and the building;
avoid copy or images that imply who does or doesn't live here.
