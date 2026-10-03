---
name: pr-screenshot-verify
description: After a UI change is committed, pushed and opened as a PR, capture what changed in a real browser (whole user flows, before and after pairs, spreads of states, GIFs for anything that moves), check every capture, and post them to the PR as one plain-English comment with "How to get here" and "What to look at" under each image. Every round also records a 1440 x 900 click-through GIF of each new or changed flow, with a caption bar and a visible pointer, for update emails. Optionally lay the same shots out in a Figma file for annotated review. This copy is set up for the Niwa site (static Astro on Cloudflare Pages): it starts the Astro dev server itself, and its email clips cover every homepage section. Use whenever a change touches what users see and a PR exists. Triggers: "screenshot the PR", "verify the PR visually", "post screenshots to the PR", or after opening a PR for a front-end change.
---

# PR screenshot verification

The goal: a reviewer can judge the change from the PR comment alone, without pulling the branch or opening the app. That means showing the path a person takes, not one screen; showing what it looked like before; and saying in plain words where each picture comes from and what to look at.

**Prerequisite:** the change is committed and pushed, and the PR exists. This skill is the verification step, not the commit step. Backend-only or docs-only changes have nothing to see; skip it.

## What a good screenshot comment has

1. **Whole flows, not single screens.** Where the person starts, what they click, what they see next. One numbered section per step that matters.
2. **Before and after** for anything that changed, side by side, the before rendered from the base commit with the same data.
3. **A spread** when comparing states or options: light and dark, desktop and phone, three design directions, all on one image.
4. **GIFs at real speed** for anything that moves (menus, dialogs, page changes), with the frames laid out underneath in a collapsed "Frame by frame" section.
5. **Plain notes under every image:** "How to get here" (the clicks from sign-in) and "What to look at" (what changed, and the edge case the picture shows).
6. **An edge cases list** at the end, plus anything else found and fixed while checking.

And every round, alongside the comment: **email GIFs**, one click-through of each flow the change adds or changes, for whoever reports the work to people who will never open the PR (step 8).

Worked examples, from the HOA portal redesign: [GIFs with frame by frame](https://github.com/marketing-agm/hoa-website-template/pull/55#issuecomment-5838949534), [before and after, and frames from a screen recording](https://github.com/marketing-agm/hoa-website-template/pull/55#issuecomment-5840126080), [a spread of three directions](https://github.com/marketing-agm/hoa-website-template/pull/55#issuecomment-5827577878). The full process around them is in [hoa-website-template#56](https://github.com/marketing-agm/hoa-website-template/issues/56).

## Steps

1. **Plan the shots before capturing.** Write the list: each flow as start, clicks, end; which steps need a before and after; which states need a spread (dark mode, a phone at 390 pixels, an empty or busy state, an admin versus an owner); which moments move and need a GIF. Use the reviewer's own window width when you know it (from a screen recording, a screenshot they sent, or ask). See [references/capture-recipes.md](references/capture-recipes.md).

2. **Set up once.** Playwright drives the browser and stays out of `package.json`:
   ```bash
   [ -d node_modules/playwright-core ] || npm i --no-save playwright-core
   ```
   The scripts find a system Chrome or Edge, or the Chromium that Claude Code on the web provides. Add `.pr-shots/` and `.pr-shots-*/` to `.gitignore` so captures never land in a commit. GIFs also need Pillow, a Python image library:
   ```
   📦 Package: Pillow (Python)
   What it does: turns the recorded frames into a GIF and a frame strip
   Why we need it: browsers cannot write GIFs, and it is the smallest reliable way to
   Alternative: ffmpeg, if it is already installed (command in capture-recipes.md)
   ```

3. **Write a scenario.** Copy `scenarios/example.mjs`; its header documents every field. Mock the data the UI needs in `fixtures`, and for each shot give a `name`, a plain `title`, `how` and `look`, and an `action` that drives the real interface. `record: { slow: 10 }` films a shot for a GIF. `context: { colorScheme: "dark" }` or a phone setup covers the other states. `baseUrl` points at an app that is already running.

4. **Capture.**
   ```bash
   node .claude/skills/pr-screenshot-verify/scripts/drive.mjs <scenario.mjs> .pr-shots
   python .claude/skills/pr-screenshot-verify/scripts/frames-to-gif.py .pr-shots/<name>-frames   # per GIF shot
   ```
   For the before pictures, run the same scenario on the base commit in a git worktree ([capture-recipes.md](references/capture-recipes.md#before-and-after)). Then put pairs and spreads together:
   ```bash
   node .claude/skills/pr-screenshot-verify/scripts/compose.mjs pair before.png after.png pair.png
   node .claude/skills/pr-screenshot-verify/scripts/compose.mjs sheet spread.png light.png dark.png phone.png --cols 3
   ```

5. **Look at every image before posting.** Read each PNG and GIF strip. That is the verification; posting is only delivery. Check that each shows what its note says, that nothing personal is visible (use test accounts, never a real email), and that the browser reported no errors (`manifest.json`). If a shot shows a bug, fix it and capture again. For a piece of UI that now appears on more pages, compare its styles on every page ([capture-recipes.md](references/capture-recipes.md#checks-worth-running)). `STRICT=1` makes any browser error fail the run.

6. **Write the comment.** Follow [references/comment-style.md](references/comment-style.md): plain words, no jargon, no em dashes. Preview it:
   ```bash
   node .claude/skills/pr-screenshot-verify/scripts/build-comment.mjs .pr-shots --title "the calendar month view" --outro edge-cases.md
   ```

7. **Post.**
   ```bash
   node .claude/skills/pr-screenshot-verify/scripts/post-to-pr.mjs <prNumber> .pr-shots [intro.md] --title "..." --outro edge-cases.md
   ```
   This puts the images on the `assets/pr-<n>-shots` branch under `verification/pr-<n>/<commit>/` (never in the code changes) and posts the comment. In Claude Code on the web, where there is no stored token and GitHub goes through the GitHub tools, add `--body-only`: the images are uploaded and `comment.md` is written for you to post with the GitHub tool. `--dry-run` changes nothing. If the PR's earlier comments link to a different assets branch, upload there by hand instead: the script always writes to `assets/pr-<n>-shots`, and a second branch for one PR splits its pictures in two.

8. **Make the email GIFs. Every round, not only when asked.** For each flow the change adds or changes, write a clip and record it against the running app:
   ```bash
   node .claude/skills/pr-screenshot-verify/scripts/email-gifs.mjs clips.mjs .pr-shots/email
   python .claude/skills/pr-screenshot-verify/scripts/email-gif.py .pr-shots/email/*/
   ```
   Each GIF is 1440 x 900, a standard desktop screen, with a caption bar naming each step, a "Sample data" label, a drawn pointer and a ring on every click. Look at the frames at each caption change and the last frame before sending. Send them to whoever asked for the change (in Claude Code on the web, with the file tool) with the Gmail and Outlook notes, and add any that show a flow better than stills to the comment. If the repo keeps a walkthrough of every feature, add the new recordings to it. Clips file, rules and pitfalls: [references/email-gifs.md](references/email-gifs.md). The helpers a clip drives the page with are in `scripts/email-driver.mjs`.

9. **Update the PR description.** Each round of changes gets a short section at the top: what was asked, what changed, what was found along the way, what needs a decision, and a link to that round's screenshot comment.

10. **Optional: a Figma review canvas.** When the Figma MCP connector is available and the change is worth a design review, lay the same shots out in a Figma file so reviewers can annotate them, then read their notes back in the next session. Not required. See [references/figma-review.md](references/figma-review.md).

11. **Report** the comment link, the GIFs, and anything that failed.

## Gotchas (each one happened)

- **Image links in a private repo.** Only `https://github.com/OWNER/REPO/raw/BRANCH/PATH` shows inline. `raw.githubusercontent.com`, and `blob/...?raw=true` which redirects there, is a different site that gets no GitHub sign-in, so GitHub's image proxy receives a 404 and every reader sees a broken image. `post-to-pr.mjs` uses the right form.
- **You cannot check those links with curl.** A private repo answers 404 to anyone not signed in, even when the image is there. Check with `git ls-tree -r --name-only origin/assets/pr-<n>-shots` instead.
- **Fonts in Claude Code on the web.** Outside files such as Google Fonts failed to load in the sandbox's browser (its proxy's certificate was not trusted), so every screenshot silently used a stand-in font. `browser.mjs` now trusts the proxy's own certificate authority, and only that, so fonts load. If text looks wrong anyway, check which font drew it before trusting the picture.
- **A half-finished animation looks like a bug.** Captures wait for fonts and finish running animations first (`settle`). Set `settle: false` on a shot that is meant to catch motion mid-way.
- **Before and after comparisons need animations off**, or every screen "changes" because an entrance animation was caught at a different moment. See the pixel-diff recipe.
- **`page.click` scrolls the target into view.** When the scroll position is the point of the shot, click with `page.evaluate(() => el.click())` instead.
- **Run the scripts from inside the repo.** `playwright-core` is found through the repo's `node_modules`; a copy of the scripts outside the repo cannot see it.
- **Check the PR is still open before each round.** A session that carries on from earlier rounds can push and post to a PR that was merged in the meantime, and nothing in `git push` or the post step warns. Read the PR's state first. If it is merged, the new work needs a new PR, from a branch based on the latest main.
- **Re-posting adds, it does not replace.** Each run writes its own folder, so a later comment never breaks an earlier one's images. The branch is written through a temporary worktree, so your checkout never switches branch.
- **Headless and headed can differ.** Scrollbars, some fonts and pop-ups over the page render differently in a visible browser. `HEADFUL=1` shows the window; on a Linux server run it under a virtual display (`Xvfb`).

## Niwa site notes

This copy started from the shared skill in `marketing-agm/dev-resources` (`skills/agm/pr-screenshot-verify`). Three changes keep it working here; carry them over when you update from there:

- `drive.mjs` reads Astro's address line (`┃ Local    http://localhost:4321/`, no colon), falls back to port 4321, and stops the whole dev server process tree when done.
- `post-to-pr.mjs` puts `[CF-Pages-Skip]` in the screenshots branch commit, so Cloudflare does not build it.
- `scenarios/sections.clips.mjs` records one GIF per homepage section. Start the site first (`npm run dev`), then run it as in step 8.

How the site is driven:

- **Mostly one page.** `/` plus anchors: `#top`, `#about`, `#building`, `#floor-plans`, `#availability`, `#neighborhood`, `#gallery`, `#faq`, `#tour`, `#contact`. The events calendar and map are on `/events`.
- **No sign-in, little API.** The tour form posts to `/api/tour`, a Cloudflare Pages Function. The dev server does not run it, and `drive.mjs` mocks every `/api/*` call, so a screenshot run never sends a real tour request.
- **Content is build-time.** `src/site/*.json` is read when Astro builds. To photograph another state (a sold-out unit, an empty gallery), edit the JSON and run again.
- **Reveal animations.** Blocks fade in on scroll. Captured too early, a section looks empty, the same as a broken build. `settleReveals()` in `scenarios/_common.mjs` forces them visible, and the email clips wait a second after jumping to a section.
- **Older scenarios** (`homepage.mjs` and the rest) use the helpers in `_common.mjs` and still run on the new `drive.mjs`. `homepage.mjs`'s tour-form shot is out of date: it waits for a `#tour-overlay` pop-up, and the tour form is now a section on the page.

Niwa gotchas (each one happened):

- **The hero can photograph black.** A video that has not shown its first frame looks the same as one that failed. `heroReady()` waits for it.
- **Always keep a phone-width shot.** Most visits to a leasing site come from phones.
- **Outside embeds show as grey boxes in the sandbox.** The availability map (Matterport) and event photos come from hosts the cloud sandbox cannot reach. Leave them out of recordings, or stub them with `scenario.routes`, so nobody reads a grey box as a bug.
- **Photo-heavy GIFs get big.** Scrolling past photos repaints the whole screen every frame; the hero and gallery came out at 16 to 58 MB. Scroll in short, quick steps with pauses between, or record at 1280 x 800 (`VIEW` in `email-gifs.mjs`).
- **Turn off Astro's dev toolbar before recording** (`npx astro preferences disable devToolbar`, then restart the dev server), or its bar sits at the bottom of every frame.
- **`pkill -f "astro dev"` can kill your own shell**, because the shell's command line contains the same words. Stop the server by its process id, or let `drive.mjs` start and stop it.

## Composing with other skills

- `three-lens-review` runs before the change; this skill runs after the PR is open.
- `pr-plain-english` shapes the PR description; this skill's comment follows the same plain style.
- `learnings-log`: when a capture turns up a bug, log the fix.
