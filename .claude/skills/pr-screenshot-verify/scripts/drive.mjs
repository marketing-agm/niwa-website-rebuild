// drive.mjs: start the app, mock its API, walk the scenario, save the captures.
//
// Usage:
//   node .claude/skills/pr-screenshot-verify/scripts/drive.mjs <scenario.mjs> [outDir]
//
// The scenario format is documented in scenarios/example.mjs. In short:
//   { viewport?, context?, baseUrl?, path?, mock?, fixtures, routes?, shots: [...] }
// Each shot is a screenshot taken after its action, or, with `record`, a film
// of the action for a GIF (turned into a .gif by frames-to-gif.py).
//
// Output in outDir: the PNGs, a <name>-frames/ folder per recorded shot, and
// manifest.json, which build-comment.mjs and post-to-pr.mjs read.
//
// Set HEADFUL=1 to watch the browser, STRICT=1 to fail on any error.
import { spawn, execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { launchBrowser, settle } from "./browser.mjs";
import { recordFlow } from "./record.mjs";
import { installMocks } from "./mock-api.mjs";

// Arguments are checked before anything slow, so a wrong call fails fast.
const scenarioArg = process.argv[2];
if (!scenarioArg) { console.error("usage: drive.mjs <scenario.mjs> [outDir]"); process.exit(2); }
const repoRoot = execSync("git rev-parse --show-toplevel").toString().trim();
const outDir = path.resolve(process.argv[3] || path.join(repoRoot, ".pr-shots"));

/** Resolves with the HTTP status of a GET, or 0 if nothing answered. */
const get = (url) => new Promise((res) => {
  const req = http.get(url, (r) => { r.resume(); res(r.statusCode || 0); });
  req.on("error", () => res(0));
  req.setTimeout(1500, () => { req.destroy(); res(0); });
});

/**
 * Kill the dev server AND everything it spawned. `npm run dev` runs astro under an
 * npm wrapper, so killing the child alone leaves astro holding the port: the next
 * run then picks 4322, finds nothing there, and reports a server that never became
 * ready. `detached` puts the whole tree in one process group so it dies together.
 */
function stopDev(dev) {
  try {
    if (process.platform === "win32") execSync(`taskkill /pid ${dev.pid} /T /F`, { stdio: "ignore" });
    else process.kill(-dev.pid, "SIGTERM");
  } catch { /* already gone */ }
}

/** Starts `npm run dev` and returns { base, dev }. Astro prints its address as "┃ Local    http://localhost:4321/". */
async function startDevServer() {
  const dev = spawn("npm", ["run", "dev"], { cwd: repoRoot, shell: true, detached: process.platform !== "win32" });
  let base = "";
  // The colon is optional and colour codes may sit between "Local" and the address.
  const sniff = (b) => { const m = String(b).match(/Local:?\s+(?:\x1b\[[\d;]*m)*\s*(http:\/\/localhost:\d+)/); if (m && !base) base = m[1]; };
  dev.stdout.on("data", sniff);
  dev.stderr.on("data", sniff);
  for (let i = 0; i < 80 && !base; i++) await new Promise((r) => setTimeout(r, 250));
  base = base || "http://localhost:4321";
  for (let i = 0; i < 40; i++) {
    if (await get(base + "/") === 200) return { base, dev };
    await new Promise((r) => setTimeout(r, 500));
  }
  stopDev(dev);
  throw new Error("The dev server never answered at " + base);
}

/** The words that go under a shot in the PR comment (see references/comment-style.md). */
const words = (s) => ({ title: s.title || "", how: s.how || "", look: s.look || "", caption: s.caption || "", details: !!s.details });

/** Saves a recorded flow as numbered PNGs plus frames.json, which frames-to-gif.py reads. */
function writeFrames(stem, frames) {
  const dir = path.join(outDir, `${stem}-frames`);
  mkdirSync(dir, { recursive: true });
  const list = frames.map((f, i) => {
    const file = `f${String(i).padStart(3, "0")}.png`;
    writeFileSync(path.join(dir, file), Buffer.from(f.data, "base64"));
    return { file, ms: f.ms };
  });
  writeFileSync(path.join(dir, "frames.json"), JSON.stringify({ gif: `${stem}.gif`, strip: `${stem}-strip.png`, frames: list }, null, 2));
  return list.length;
}

/** Takes one shot: a screenshot, or a film when the shot has `record`. Returns its manifest entry. */
async function takeShot(page, s) {
  const stem = s.name.replace(/\.(png|gif)$/, "");
  if (s.record) {
    const frames = await recordFlow(page, s.action || (async () => {}), s.record === true ? {} : s.record);
    const count = writeFrames(stem, frames);
    console.log(`film: ${stem} (${count} frames; run frames-to-gif.py to make the GIF)`);
    return { ...words(s), name: `${stem}.gif`, strip: `${stem}-strip.png`, kind: "gif" };
  }
  if (s.action) await s.action(page, { wait: (ms) => page.waitForTimeout(ms) });
  await page.waitForTimeout(250);
  if (s.settle !== false) await settle(page);
  const file = `${stem}.png`;
  // `selector` shoots one element (a crop); `fullPage` shoots the whole scrolling page.
  if (s.selector) await page.locator(s.selector).first().screenshot({ path: path.join(outDir, file) });
  else await page.screenshot({ path: path.join(outDir, file), fullPage: !!s.fullPage });
  console.log("shot:", file);
  return { ...words(s), name: file, kind: "png" };
}

async function main() {
  const scenario = (await import(pathToFileURL(path.resolve(scenarioArg)).href)).default;
  mkdirSync(outDir, { recursive: true });

  // 1) The app: one that is already running (baseUrl or BASE_URL), or Vite's dev server.
  const given = scenario.baseUrl || process.env.BASE_URL;
  const { base, dev } = given ? { base: given.replace(/\/$/, ""), dev: null } : await startDevServer();

  // 2) The browser. `context` passes Playwright options through: colorScheme ("dark"),
  //    reducedMotion ("reduce"), deviceScaleFactor, isMobile, hasTouch, and so on.
  const browser = await launchBrowser({ headless: process.env.HEADFUL !== "1" });
  const viewport = scenario.viewport || { width: 1300, height: 950 };
  const ctx = await browser.newContext({ viewport, ...(scenario.context || {}) });
  if (scenario.mock !== false) await installMocks(ctx, scenario);

  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push("PAGEERROR " + e.message));
  await page.goto(base + (scenario.path || "/"), { waitUntil: "networkidle" });
  await settle(page);

  // 3) Walk the shot list. A shot may first open a page of its own with `path`.
  const manifest = {
    base, commit: execSync("git rev-parse --short HEAD").toString().trim(),
    browser: "Chromium " + browser.version().split(".")[0], width: viewport.width, shots: [], errors,
  };
  for (const s of scenario.shots || []) {
    try {
      if (s.path) { await page.goto(base + s.path, { waitUntil: "networkidle" }); await settle(page); }
      manifest.shots.push(await takeShot(page, s));
    } catch (e) {
      console.error("shot FAILED:", s.name, "-", e.message);
      errors.push("SHOT " + s.name + ": " + e.message);
    }
  }

  writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  await browser.close();
  if (dev) stopDev(dev);
  console.log("\nconsole/page errors:", errors.length);
  for (const e of errors) console.log("  -", e);
  console.log("manifest:", path.join(outDir, "manifest.json"));

  // Screenshot runs do not fail on a console warning. STRICT=1 turns the run into a
  // pass/fail test. `allowConsoleErrors` (regexes) lists errors a scenario causes on
  // purpose, such as a 503 that proves the error state renders. A failed shot never counts as allowed.
  const allowed = scenario.allowConsoleErrors || [];
  const unexpected = errors.filter((e) => /^SHOT /.test(e) || !allowed.some((re) => re.test(e)));
  if (process.env.STRICT === "1") console.log(`STRICT: ${unexpected.length} unexpected error(s)`);
  // Give the npm/vite process tree a moment to exit, then exit explicitly.
  setTimeout(() => process.exit(process.env.STRICT === "1" && unexpected.length ? 1 : 0), 300);
}
main().catch((e) => { console.error("FATAL", e); process.exit(1); });
