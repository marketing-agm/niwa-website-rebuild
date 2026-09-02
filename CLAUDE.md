# CLAUDE.md — Niwa Apartments website

Standalone single-property Astro site for **Niwa Apartments**, 513 1st Ave N,
Seattle WA 98109. See `README.md` for layout, commands and deploy settings; this
file is about how to work in it without repeating mistakes already made.

## Working agreement

**Any change with a visual surface gets a screenshot pass before it is handed
over** — not after someone asks. Use the `pr-screenshot-verify` skill.

| Change | Screenshot pass? |
|---|---|
| `src/styles/`, `src/generated/body.html`, `src/components/`, `public/app.js` | Yes |
| `src/site/*.json` — colours, copy, photos, units | Yes |
| Images added or swapped | Yes |
| Skills, README, CI, `wrangler.toml` | No visual surface — `npm run build` passing is the check |

**Work in small PRs against a preview.** The workflow is: branch → push → PR →
screenshot pass posted to the PR → look at the Cloudflare preview → adjust.
Production is only updated once something has been looked at.

## Brand

Niwa's brand guidelines give exact values. These are not suggestions.

| Token | Value | Role |
|---|---|---|
| `--accent` | `#F1E249` | PRIMARY · visual highlights |
| `--warm` | `#FFFCCC` | SECONDARY · support colouring |
| `--ink` | `#000000` | PRIMARY · secondary visual |
| `--bg-2` | `#EDEDED` | background |
| `--on-accent` | `#000000` | type that sits ON the yellow |

**Yellow is a fill; black is the type colour.** `#F1E249` with white text measures
1.34:1 — invisible. With black, 15.71:1. Every place the accent is a *background*
must use `--on-accent`, never `--paper` or `#fff`. This is also how
niwaseattle.com behaves: every yellow button there carries black type.

Yellow as *text on white* is ~1.4:1 and fails contrast. It is currently used that
way in ~44 places by explicit decision, to see the full effect. If you are
tightening this, that is the list to work through.

## Content rules

**Never hardcode property copy in `src/generated/body.html`.** It shipped
Magnolia's "One month free · 12-month lease" onto Niwa's page, and Magnolia's
phone number went out the same way. Copy belongs in `src/site/site.config.json`
and reaches the markup through a `{{TOKEN}}`. The token map is in
`src/pages/index.astro`.

**Do not lead with the offer.** Stakeholder direction is explicit: a visitor
should get a feel for the apartment before being pushed toward price, and selling
on price alone is not the approach. `hero.offer` is deliberately empty. The
concession is real and can appear lower down, after the homes have done the work.

**`units.json` is generated** from the AppFolio feed by `npm run refresh`. Do not
hand-edit it.

**Unresolved:** the feed tags all 17 units "On-site laundry"; niwaseattle.com says
apartments have "in-unit washer and dryers" and its gallery shows a stacked W/D
inside a home. Those cannot both be true. No building-level laundry claim is made
until someone confirms which. Do not resolve it by guessing.

## Traps this repo has already sprung

**Theme tokens are overridden unless the selector out-specifies `global.css`.**
`BaseLayout.astro` injects `:root:root{…}` from config. The doubled selector is
deliberate: Astro hoists the bundled stylesheet *after* that inline block, and
`global.css` opens with its own `:root` fallbacks, so at equal specificity the
stylesheet wins. For weeks the site rendered Magnolia blue no matter what
`site.config.json` said.

**A grep of the built HTML does not prove a colour applied.** The token was
present in `dist/index.html` and looked correct; the page was still blue, because
a later rule won. Screenshot it, or check which rule actually applies.

**Grepping for a hex will not find a colour written as `rgb`.** Seventeen blues
were spelled `rgba(18, 154, 229, …)` — focus rings, tint fills, the tour-wizard
pulse. Source looked clean; the minifier folded them into `#129ae51f` in the
bundle. Search both spellings, and confirm against `dist/`.

**Screenshot-reveal timing.** Blocks fade in on scroll via `IntersectionObserver`.
Capture before they fire and you photograph a page of invisible elements, which
looks exactly like a broken build. `settleReveals()` handles it.

**Sort deployments by content, not time.** `post-to-pr.mjs` pushes screenshots to
an `assets/pr-N-shots` branch, which is production's code plus PNGs. Cloudflare
builds it, so the newest deployment in the list is often the *least* current
site. Exclude `assets/*` under Settings → Builds → branch control.

**`wrangler.toml` must stay in its Pages form** (`pages_build_output_dir`). The
Workers form (`[assets] directory`, `workers_dev`) belongs to a different kind of
project; a Workers deploy against Pages config fails with "Missing entry-point to
Worker script or to assets directory".

**This repo has no `main`.** The default branch is
`claude/niwa-website-rebuild-setup-4i1y68`. Anything assuming `origin/main`
breaks — `post-to-pr.mjs` resolves it from `origin/HEAD` for that reason.

## Relationship to Magnolia

Forked from `marketing-agm/magnolia-apartments-agm` and flattened to one site.
**A clean break:** template fixes do not reach here, and changes here cannot
affect Magnolia. Magnolia remains the reference for *what a leasing site should
have* — structure and features — not for Niwa's look.

**Never modify the Magnolia repo from this project.** It renders a live site.

## Design direction

`niwaseattle.com` is the source of Niwa's facts and brand, not the structural
model. The moodboard direction is Japanese-garden minimalism — *niwa* (庭) means
garden — clean wood lines and symmetry, editorial restraint, photography-led,
yellow as the pop rather than the field.

Stakeholders want a **video-forward homepage** (reference: Vibrant Cities, video
playing on arrival) over the current static hero, "more dynamic and interactive",
and the current hero image called out as looking grainy. Video placement —
autoplaying behind the hero and expandable, versus a pop-up on arrival — is
undecided and meant to be tested both ways.

The interior wayfinding and Japanese-artwork concepts in the design deck are
**not approved** for the website. Treat them as mood, not spec.

## Fair housing

Niwa has income-restricted MFTE homes. Describe the homes and the building; avoid
copy or images implying who does or does not live here.
