// email-gifs.mjs: record click-through GIFs of a running app, for update emails.
//
// Usage:
//   node email-gifs.mjs <clips.mjs> [outDir] [clip-name-prefix ...]
//   python email-gif.py <outDir>/<clip> [...]          (one GIF per clip folder)
//
// <clips.mjs> exports CLIPS, and optionally BASES, TAG and CONTEXT:
//
//   export const BASES = { agm: 'http://localhost:8791', owner: 'http://localhost:8792' };
//   export const TAG = 'Sample data';      // the label on the right of every caption bar
//   export const CONTEXT = { timezoneId: 'America/Los_Angeles' }; // browser settings for every clip
//   export const CLIPS = {
//     'calendar-add': {
//       who: 'agm',                        // or base: 'http://localhost:8788'
//       path: '/portal/calendar',
//       start: [1000, 190],                // where the pointer rests on the opening frame
//       setup: async (d) => {},            // optional: before filming (dismiss a pop-up)
//       run: async (d) => {
//         d.say('AGM adds an event by clicking the day');   // caption from here on
//         await d.click('.cal-hit[data-day="2026-10-06"]');
//         await d.fill('input[name=title]', 'Window washing');
//         await d.clickNav('button[type=submit]');
//       },
//     },
//   };
//
// What it makes, and why (references/email-gifs.md has the full rules):
//
//   1440 x 900, a standard desktop screen: the page at 1440 x 844 under a
//   56 pixel caption bar. Full screen, nothing cropped.
//   A drawn pointer and a ripple on every click, because a headless browser
//   paints no pointer and a click-through without one is a slideshow.
//   Every move is a glide the eye can follow, and every caption names the
//   step before it happens.
//   The first frame is held, because older Outlook shows only that frame,
//   and the last is held before the loop.
//   About 14 frames a second, sampled from the frames the browser actually
//   painted, so the GIF plays at real speed.
//
// Output: <outDir>/<clip>/ holds the frames, manifest.json and one caption
// strip per caption, rendered in the page's font (DM Sans unless FONT says
// otherwise). email-gif.py turns each folder into <outDir>/<clip>.gif.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { launchBrowser } from "./browser.mjs";
import { CURSOR, driver, settle } from "./email-driver.mjs";

const [clipsArg, outArg, ...wanted] = process.argv.slice(2);
if (!clipsArg) {
  console.error("usage: node email-gifs.mjs <clips.mjs> [outDir] [clip-name-prefix ...]");
  process.exit(2);
}
const spec = await import(pathToFileURL(path.resolve(clipsArg)).href);
const CLIPS = spec.CLIPS || {};
const BASES = spec.BASES || {};
const TAG = spec.TAG ?? "Sample data";
const CONTEXT = spec.CONTEXT || {}; // a clip's own `context` wins over it
const FONT = process.env.FONT || "DM Sans";
const OUT = path.resolve(outArg || ".pr-shots/email");

const VIEW = { width: 1440, height: 844 };
const STRIP = 56;
const STEP = 70; // ms per GIF frame: about 14 a second, and never under the 20ms browsers stretch

async function film(browser, name, clip) {
  const dir = path.join(OUT, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const base = clip.base || BASES[clip.who];
  if (!base) throw new Error(`${name} has no base address (set base, or who and BASES)`);
  const ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 1, ...CONTEXT, ...(clip.context || {}) });
  await ctx.addInitScript(CURSOR);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(base + clip.path, { waitUntil: "networkidle" });
  await settle(page);
  const pos = { x: clip.start[0], y: clip.start[1] };
  await page.mouse.move(pos.x, pos.y);
  const captions = [];
  const say = (text) => captions.push({ t: Date.now(), text });
  const d = driver(page, pos, say);
  if (clip.setup) { await clip.setup(d); await settle(page); await page.mouse.move(pos.x, pos.y); }

  // Chrome's screencast: the frames it actually painted, with their times.
  const cdp = await ctx.newCDPSession(page);
  const raw = [];
  cdp.on("Page.screencastFrame", async (f) => {
    raw.push({ t: f.metadata.timestamp * 1000, data: f.data });
    try { await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }); } catch { /* stopped */ }
  });
  await cdp.send("Page.startScreencast", { format: "png", maxWidth: VIEW.width, maxHeight: VIEW.height, everyNthFrame: 1 });
  await page.waitForTimeout(400);
  const start = Date.now();
  await clip.run(d);
  await page.waitForTimeout(500);
  const end = Date.now();
  await cdp.send("Page.stopScreencast").catch(() => {});
  await ctx.close();
  if (!raw.length) throw new Error("the screencast returned no frames");

  // Real speed: the last frame painted by each moment, and the caption
  // showing then. A frame that repeats is shown longer instead.
  const at = (t) => raw.reduce((best, f) => (f.t <= t ? f : best), raw[0]).data;
  const captionAt = (t) => captions.reduce((best, c, i) => (c.t <= t ? i : best), 0);
  const frames = [];
  for (let ms = 0; ms <= end - start; ms += STEP) {
    const data = at(start + ms), caption = captionAt(start + ms);
    const last = frames[frames.length - 1];
    if (last && last.data === data && last.caption === caption) last.ms += STEP;
    else frames.push({ data, caption, ms: STEP });
  }
  frames[0].ms += 1800; // older Outlook shows only this frame
  frames[frames.length - 1].ms += 2600; // rest on the result before looping
  frames.forEach((f, i) => writeFileSync(path.join(dir, `f${String(i).padStart(4, "0")}.png`), Buffer.from(f.data, "base64")));
  const texts = captions.length ? captions.map((c) => c.text) : [name];
  writeFileSync(path.join(dir, "manifest.json"), JSON.stringify({
    name, width: VIEW.width, height: VIEW.height, cropLeft: 0, captions: texts,
    frames: frames.map((f, i) => ({ file: `f${String(i).padStart(4, "0")}.png`, ms: f.ms, caption: f.caption })),
    errors,
  }, null, 2));
  console.log(`${name}: ${frames.length} frames, ${((end - start) / 1000).toFixed(1)} s, ${errors.length} browser errors${errors.length ? ": " + errors.slice(0, 2).join(" | ") : ""}`);
  return { dir, captions: texts };
}

/** One caption strip per caption, as wide as the frame, in the page's font. */
async function strips(browser, { dir, captions }) {
  const page = await (await browser.newContext({ viewport: { width: VIEW.width, height: STRIP }, deviceScaleFactor: 1 })).newPage();
  const family = FONT.replace(/ /g, "+");
  for (const [i, text] of captions.entries()) {
    await page.setContent(`<!doctype html><html><head>
      <link href="https://fonts.googleapis.com/css2?family=${family}:wght@500;600&display=block" rel="stylesheet">
      <style>html,body{margin:0}
      body{width:${VIEW.width}px;height:${STRIP}px;box-sizing:border-box;padding:0 24px;display:flex;align-items:center;justify-content:space-between;gap:16px;
        background:#1b2430;color:#fff;font:600 20px/1 '${FONT}',sans-serif}
      .tag{flex:none;font:500 14px/1 '${FONT}',sans-serif;color:#c3ccd6;border:1px solid #475466;border-radius:999px;padding:6px 12px}</style></head>
      <body><span>${text.replace(/</g, "&lt;")}</span>${TAG ? `<span class="tag">${TAG.replace(/</g, "&lt;")}</span>` : ""}</body></html>`,
      { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    const ok = await page.evaluate((f) => document.fonts.check(`600 20px '${f}'`), FONT);
    if (!ok) console.warn(`warning: ${FONT} did not load for the caption bar; it fell back to a system font`);
    await page.screenshot({ path: path.join(dir, `caption-${i}.png`) });
  }
}

const browser = await launchBrowser();
let failed = 0;
try {
  for (const [name, clip] of Object.entries(CLIPS)) {
    if (wanted.length && !wanted.some((w) => name.startsWith(w))) continue;
    try { await strips(browser, await film(browser, name, clip)); }
    catch (err) { failed++; console.log(`${name}: FAILED ${String(err.message).split("\n")[0]}`); }
  }
} finally {
  await browser.close();
}
process.exitCode = failed ? 1 : 0;
