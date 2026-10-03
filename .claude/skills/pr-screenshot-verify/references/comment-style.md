# Writing the screenshot comment

The comment is read by someone deciding whether the change is right: often a manager, sometimes a designer, rarely someone who reads code. Write it like a short update to a manager. `build-comment.mjs` produces the skeleton; the words in each shot's `title`, `how` and `look`, and in the intro and outro files, are yours.

## Rules

- **Plain words.** Say what a person sees and does. No file names, class names, CSS, "DOM", "viewport", "modal" or "component" unless the reader works in code.
- **Short sentences.** One idea each.
- **No em dashes, and no filler.** Not "seamless", "robust", "enhanced", "leverage". If a sentence says nothing a reviewer can check, cut it.
- **Numbers over adjectives.** "Ran 30 pixels off the left edge" rather than "overflowed slightly". "Fades in over a fifth of a second" rather than "smooth".
- **Name the edge case.** If a shot exists to show an edge case (an empty list, a phone, an admin-only screen, a busy day), "What to look at" says so.
- **Be straight about limits.** If something could not be checked, or a picture comes from a mock rather than live data, say so in one line.
- **One comment per round of changes**, linked from that round's section of the PR description.
- **Test accounts only.** No real names or email addresses in any picture. Crop or re-shoot if one slips in.
- A Claude Code session ends the comment with the attribution footer its instructions require.

## Words to swap

| Instead of | Write |
|---|---|
| modal, dialog component | pop-up |
| viewport | window, or screen on a phone |
| pill, badge, chip | label, status label |
| dropdown, popover | menu, list |
| rail, sidebar nav | sidebar, menu strip (on a phone) |
| toggle dark mode | switch to dark mode |
| hover state | when you point at it |
| regression | it broke again, or it no longer does X |

## The template

`build-comment.mjs` writes this shape. Keep it when writing by hand.

```markdown
## Screenshots for <what changed, in plain words>

<one or two sentences of intro, only if needed>

Captures at commit `abc1234`, taken in Chromium 141 in a window 1224 pixels wide. The GIFs play at real speed. The browser reported no errors.

---

### 1. <what this step is>

**How to get here:** <the clicks from sign-in, lowercase after the colon>

**What to look at:** <what changed, and the edge case this shows>

![<same title>](https://github.com/OWNER/REPO/raw/assets/pr-N-shots/verification/pr-N/abc1234/01-name.png)

<details><summary>A secondary view of the same step</summary>

![...](...)

</details>

### 2. <the next step>
...

---

**Edge cases checked in a browser:**

- **<the case>:** <what happens>.

**Also fixed while checking:**

- <what was wrong, what it does now>.
```

## Examples of good notes

From the HOA portal redesign (PR 55 in hoa-website-template):

> **How to get here:** signed in as AGM, open an association's Calendar and click an empty part of a day.
>
> **What to look at:** when you point at a day it lights up with a small plus. Clicking it opens Add an Event with that date already filled in, and after saving you land back on that month.

> **How to get here:** on a Windows computer, go from Overview to Payments. Overview is long enough to scroll and Payments is not.
>
> **What to look at:** the dashed line is where the avatar sits on Overview. Before, the scrollbar disappeared on short pages, so everything moved 15 pixels to the right.

> **How to get here:** this one is taken from your recording, not the portal.
>
> **What to look at:** each row is one of the seven switches that flashed, out of 31 switches in the recording.

## Pairs, spreads and GIFs in the text

- For a pair, say which side is which in "What to look at" ("The left side is before this round. The right side is now."), or print labels on the image with `compose.mjs --labels`.
- For a spread, say what is in each position ("1 is what was built. 2 keeps a box around every section.").
- For a GIF, say what to watch and how long it takes ("the new month slides in from the side you are moving toward, in a fifth of a second"). The strip of frames goes in a collapsed "Frame by frame" section under it.

## The PR description, per round

Each round adds a section at the top, newest first:

```markdown
## Part N: <what this round did> (commits abc1234 and def5678)

<what was asked, in one or two sentences>. Shot numbers in this part refer to the part N screenshot comment.

- **<change>.** <what it does now>. Shot 1.
- **<change>.** <what it does now>. Shot 2.

### Also fixed along the way

- <what was wrong, what it does now>.
```

Keep a **Testing** section (the suites and counts, and how it was checked in a browser) and a **Needs your decision** section, and update both each round.
