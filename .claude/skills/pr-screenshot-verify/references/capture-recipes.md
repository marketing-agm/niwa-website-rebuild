# Capture recipes

How to get each kind of picture the comment needs, and the checks worth running before posting. Paths assume the skill lives in `.claude/skills/pr-screenshot-verify`.

## Plan the shot list

Write it down before capturing. For each flow:

| Step | Start | Action | What should show | Before/after? | States | Moves? |
|---|---|---|---|---|---|---|
| 1 | Calendar, this month | click an entry | the details pop-up | no | light, dark | yes, the pop-up fades |
| 2 | Calendar | click an empty day (admin) | Add an Event, date filled in | no | admin only | no |

Then add the edge cases: empty and busy data, the smallest screen (390 pixels wide), dark mode, an admin next to an owner, reduce motion, JavaScript off. Number the files in comment order: `01-month.png`, `02-entry.png`, `03-phone.png`.

## Window sizes

- **The reviewer's own width first.** If they sent a recording or a screenshot, measure it and use that width (the HOA portal review used 1224 pixels). Their layout, not yours, is the one being judged.
- **A phone:** `viewport: { width: 390, height: 844 }, context: { deviceScaleFactor: 2, isMobile: true, hasTouch: true }`.
- **Breakpoints the layout changes at** (for example 768, 1024, 1280, 1440) when the change is about layout.

## Dark mode, phone and other states

`context` applies to the whole run, so run the scenario again for each state. A second scenario file can reuse the first:

```js
// scenario-dark.mjs
import base from "./scenario.mjs";
export default {
  ...base,
  context: { ...(base.context || {}), colorScheme: "dark" },
  shots: base.shots.map((s) => ({ ...s, name: s.name + "-dark" })),
};
```

If the app keeps its theme in `localStorage` rather than following the system setting, set it in the first shot's action: `await page.evaluate(() => localStorage.setItem("theme", "dark")); await page.reload();`.

Reduce motion: `context: { reducedMotion: "reduce" }`. JavaScript off: `context: { javaScriptEnabled: false }`.

## Before and after

Render the base commit with the same scenario and data, in a second checkout, then pair the pictures.

```bash
git fetch origin main
git worktree add ../before origin/main          # a second checkout of main, in a sibling folder
cd ../before && npm ci && npm i --no-save playwright-core
node /path/to/repo/.claude/skills/pr-screenshot-verify/scripts/drive.mjs /path/to/scenario.mjs /path/to/repo/.pr-shots/before
cd - && git worktree remove ../before --force

node .claude/skills/pr-screenshot-verify/scripts/compose.mjs pair .pr-shots/before/01-month.png .pr-shots/01-month.png .pr-shots/01-month-pair.png --labels "Before,After"
```

The scenario's selectors must exist on both commits. If the change adds the thing being clicked, capture the before at the step just ahead of it. Say in the comment which side is which.

## Spreads

Any number of images in a grid, for options or states side by side:

```bash
node .claude/skills/pr-screenshot-verify/scripts/compose.mjs sheet .pr-shots/00-directions.png a.png b.png c.png --cols 3 --labels "1,2,3" --scale 0.5
```

`--scale 0.5` suits 2x phone captures. Keep a spread to what one comparison needs; three to six images reads well.

## GIFs

A shot with `record` is filmed instead of photographed:

```js
{ name: "06-month-and-popup", title: "Moving between months, at real speed",
  how: "click the arrows next to Today, then click an entry.",
  look: "the new month slides in from the side you are moving toward.",
  record: { slow: 10 },
  action: async (page, { wait }) => {
    await page.click("[data-cal-go='1']");
    await wait(700);                  // real time, even while filming slowed
    await page.click(".cal-chip");
  } }
```

Then build the GIF and the frame strip:

```bash
python .claude/skills/pr-screenshot-verify/scripts/frames-to-gif.py .pr-shots/06-month-and-popup-frames
```

How it works and when to change it:

- `slow: 10` plays every CSS animation and transition ten times slower while filming, then picks frames back out at real-speed times. A 200 ms fade gives about 120 frames instead of 11, so the GIF shows the motion properly and still plays at real speed.
- `slow` only works within one page. A move to another page loads a new document at normal speed, so film page changes with `record: true` (slow 1).
- Keep films short, under about six seconds, and the window modest. GitHub shows images up to 10 MB; the script warns past 9 MB.
- Inside a filmed action, pause with the `wait(ms)` helper, not `page.waitForTimeout`. While filming slowed, animations run `slow` times longer in wall-clock time; `wait` stretches to match, so what it waits for really finishes. A plain timeout would end ten times too early.
- Without Pillow, ffmpeg can make the GIF from the frames: `ffmpeg -framerate 25 -i f%03d.png -vf "split[a][b];[a]palettegen[p];[b][p]paletteuse" out.gif` (frame timing becomes even). `pip install imageio-ffmpeg` provides a full ffmpeg binary without admin rights.

## Frames from a reviewer's screen recording

When a reviewer records the preview, the recording is the best evidence. With ffmpeg (see above):

```bash
ffmpeg -i audit.mp4 -vf "fps=2,scale=640:-1" frames/%04d.png          # two frames a second, to scan
ffmpeg -ss 39.6 -i audit.mp4 -frames:v 1 at-39.6s.png                 # one exact moment, full size
```

To find flashes, extract every frame at a small size in greyscale and look for frames whose average brightness jumps (an all-white frame between two pages stands out). Quote the times in the comment ("the jump at 39.6 seconds in your recording").

## Checks worth running

**Shared pieces across pages.** When a piece of UI (a menu, a switcher, a label) starts appearing on pages it was not designed on, compare its computed styles on every page against its home page. A page's own stylesheet can reach it: a copied `.pill` rule gave it two dots on one page, and a page's `input:focus-visible` rule turned its border blue on another. In the scenario, or a scratch script:

```js
const props = ["font-size", "padding", "color", "background-color", "border", "gap"];
const read = (sel) => page.evaluate(({ sel, props }) => {
  const el = document.querySelector(sel); const cs = getComputedStyle(el);
  return Object.fromEntries(props.map((p) => [p, cs.getPropertyValue(p)]));
}, { sel, props });
// Read it on the home page, then on every other page, and print any property that differs.
```

**Before and after of every page, with animations off.** For a layout fix, capture every page before and after with `context: { reducedMotion: "reduce" }` and, in the first action, `await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important}" })`. Compare the pairs pixel by pixel (Pillow: `ImageChops.difference(a, b).getbbox()`). Only the pages you meant to change should differ; a scatter of single pixels in form fields is rendering noise.

**Which font drew the text.** If a screenshot's type looks off, ask Chrome which font actually rendered an element before trusting the picture:

```js
const cdp = await page.context().newCDPSession(page);
await cdp.send("DOM.enable"); await cdp.send("CSS.enable");
const { root } = await cdp.send("DOM.getDocument");
const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: "h1" });
console.log((await cdp.send("CSS.getPlatformFontsForNode", { nodeId })).fonts);
```

**Errors.** `manifest.json` lists every console error and failed shot. Zero is the bar; if an error is expected (a scenario that forces a failure to show the error state), list it in `allowConsoleErrors`.

## Privacy

Use test accounts and example addresses (`manager@example.com`). Before posting, look for real names, emails and phone numbers in every image, including sidebar footers and account menus. If one appears, change the fixture and capture again rather than blurring.
