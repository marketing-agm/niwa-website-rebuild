---
name: pr-screenshot-verify
description: After a front-end change is committed, pushed, and opened as a PR on the niwa-website-rebuild repo (static Astro site), run a browser screenshot-verification pass and post the screenshots into the PR as a comment. Starts the Astro dev server, drives the real page in headless Chromium, captures the surface the change touches at desktop and phone width, and comments on the PR via the stored git credential (no gh CLI). Use whenever a PR touches src/**, public/app.js, or public/images/** and a PR is already open. Triggers: "screenshot the PR", "verify the PR visually", "post screenshots to the PR", or after opening a front-end PR.
---

# PR Screenshot Verification

Turn a freshly opened PR into a visually-verified one: start the site, drive the
**real** page in a headless browser, screenshot what your change touched, and post
those screenshots as a PR comment.

**Prerequisite:** the change is committed, pushed, and a PR exists (you have its
number). This is the *verification* step, not the commit step.

**Surface check:** for things you can see — the hero, floor plans, availability,
gallery, the tour form, anything in `src/styles/`, `src/generated/body.html`,
`src/components/` or `public/app.js`. A config-only or docs-only change has no
visual surface; skip it and note that `npm run build` passed.

## How this site is driven

Simpler than it looks, and much simpler than the deposits app this skill was
ported from:

- **Static Astro, one page.** Everything is `/` plus hash anchors: `#top`,
  `#floor-plans`, `#availability`, `#gallery`, `#neighborhood`, `#tour`, `#faq`.
- **No session, no auth, no API.** Nothing to seed. A shot can deep-link to a hash
  and it will land — unlike the deposits app, which bounced to `/`.
- **Content is build-time.** `src/site/*.json` is read when Astro builds, so to
  photograph a different state (a sold-out unit, an empty gallery) you edit the
  JSON and re-run — there is no runtime state to poke.
- **Reveal animations are the trap.** Blocks fade in on scroll via
  IntersectionObserver. Screenshot before they fire and you get a page of invisible
  elements, which looks identical to a broken build. `settleReveals()` in
  `scenarios/_common.mjs` forces them visible; every shot should call it.

## Steps

1. **Ensure the browser driver is available** (kept out of `package.json`):
   ```bash
   [ -d node_modules/playwright-core ] || npm i --no-save playwright-core
   ```
   Chromium is pre-installed in this environment; the driver finds it, or you can
   point at one with `PLAYWRIGHT_CHROMIUM=/path/to/chrome`.

2. **Pick or write a scenario.** `scenarios/homepage.mjs` walks the whole page and
   is the right starting point for most changes — copy it, then **delete the shots
   that have nothing to do with your change.** Four relevant screenshots get read;
   twelve get scrolled past.

   Each shot is `{ name, caption?, path?, action?, settleMs?, fullPage? }`.
   `action(page)` is Playwright and runs after load; use the helpers in
   `_common.mjs` (`goToSection`, `selectPlan`, `openGallery`, `freezeMotion`,
   `settleReveals`, `heroReady`).

3. **Run the driver** — it starts `npm run dev`, runs the shots, records console
   and network errors, and tears the server down:
   ```bash
   node .claude/skills/pr-screenshot-verify/scripts/drive.mjs \
     .claude/skills/pr-screenshot-verify/scenarios/homepage.mjs .pr-shots
   ```
   Output: PNGs (2x, retina) + `manifest.json` in `.pr-shots/`, plus an error
   count. **Look at the screenshots** — reading each PNG *is* the verification; the
   post is only delivery. If a shot shows the bug, fix it and re-run before
   posting.

4. **(optional) Intro file** — a short markdown blurb (verdict + what was
   exercised) prepended to the comment.

5. **Post to the PR:**
   ```bash
   node .claude/skills/pr-screenshot-verify/scripts/post-to-pr.mjs <prNumber> .pr-shots [intro.md]
   ```
   Commits the PNGs to an `assets/pr-<n>-shots` branch (kept out of the code diff),
   then comments on the PR with each image embedded. Needs a clean working tree
   (`.pr-shots/` is gitignored) and restores your branch afterward. Prints the
   comment URL.

6. **Report** the comment URL and the error count. A non-empty `manifest.errors`
   means not-yet-verified — investigate before saying it looks good.

## Gotchas

- **Free port 4321** if a stale dev server is holding it, or you may photograph the
  wrong thing. The driver parses the real port from Astro's output and only falls
  back to 4321.
- **The hero can photograph black.** A video that has not decoded its first frame
  looks exactly like one that failed to load. `heroReady()` waits for
  `readyState >= 2`; keep it in the hero shot.
- **Always keep the phone-width shot.** Most traffic to a leasing site is mobile. A
  layout that only works at 1440 mostly does not work.
- **`main` is production**, but GitHub's default branch may still be
  `claude/niwa-website-rebuild-setup-4i1y68`. `post-to-pr.mjs` resolves it from
  `origin/HEAD` rather than assuming — if that ever fails, run
  `git remote set-head origin -a` once.
- **The assets branch must not deploy.** `post-to-pr.mjs` puts `[CF-Pages-Skip]`
  in its commit message for this reason. Take it out and every screenshot post
  builds a deployment made of production's code plus PNGs, which then sits at the
  top of the Cloudflare list as the newest deployment carrying the oldest code —
  and the site reads as though it is flip-flopping between designs. Sort
  deployments by content, not by time.
- **Motion makes runs incomparable.** `freezeMotion()` zeroes animation and
  transition durations so two runs differ only where the code differs.
