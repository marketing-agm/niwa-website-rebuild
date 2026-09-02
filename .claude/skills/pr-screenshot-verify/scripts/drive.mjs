// drive.mjs — launch the Astro dev server, drive the real page to each shot,
// and capture screenshots.
//
// Usage:
//   node .claude/skills/pr-screenshot-verify/scripts/drive.mjs <scenario.mjs> [outDir]
//
// Scenario default export:
//   { viewport?: {width,height},   // default 1280x900
//     shots: [ { name, caption?, path?, action?, settleMs?, fullPage? } ] }
//
//   action(page) — Playwright, runs after the page has loaded. Use the helpers in
//                  scenarios/_common.mjs to reach a section or open an overlay.
//   settleMs     — pause between action() and the shot; default 500. Raise it to let
//                  a transition finish, drop it to 0 to catch a mid-animation frame.
//   fullPage     — capture the whole scroll height instead of the viewport.
//
// This is the Astro port of the skill originally written for the Next.js deposits
// app. Everything that made that version complicated is gone, because this site
// does not have it: no sessionStorage session to seed, no password gate, no intro
// overlay, no redirect-on-null-session (so a shot CAN deep-link to a hash).
//
// playwright-core is resolved from the repo root; install it once with:
//   npm i --no-save playwright-core
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { spawn, execSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import http from "node:http";

const CHROME_CANDIDATES = [
  process.env.PLAYWRIGHT_CHROMIUM ?? "",
  "/opt/pw-browsers/chromium/chrome-linux/chrome",
  "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].filter(Boolean);

const repoRoot = execSync("git rev-parse --show-toplevel").toString().trim();
const require = createRequire(path.join(repoRoot, "package.json"));
const { chromium } = require("playwright-core");

const scenarioArg = process.argv[2];
const outDir = path.resolve(process.argv[3] || path.join(repoRoot, ".pr-shots"));
if (!scenarioArg) { console.error("usage: drive.mjs <scenario.mjs> [outDir]"); process.exit(2); }

let chrome = CHROME_CANDIDATES.find(existsSync);
if (!chrome) {
  // The pre-installed browser location varies; fall back to a glob before giving up.
  try {
    chrome = execSync("ls -d /opt/pw-browsers/*/chrome-linux/chrome 2>/dev/null | head -1")
      .toString().trim() || "";
  } catch { chrome = ""; }
}
if (!chrome || !existsSync(chrome)) {
  console.error("No Chrome/Chromium found. Set PLAYWRIGHT_CHROMIUM to the binary path.");
  process.exit(2);
}

const get = (url) => new Promise((res) => {
  const req = http.get(url, (r) => { r.resume(); res(r.statusCode || 0); });
  req.on("error", () => res(0));
  req.setTimeout(1500, () => { req.destroy(); res(0); });
});
async function waitForUrl(url, tries = 80) {
  for (let i = 0; i < tries; i++) {
    const code = await get(url);
    if (code === 200) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

/**
 * Kill the dev server AND everything it spawned. `npm run dev` runs astro under an
 * npm wrapper, so killing the child alone leaves astro holding the port — the next
 * run then picks 4322, finds nothing there, and reports a server that never became
 * ready. `detached` puts the whole tree in one process group so it dies together.
 */
function stopDev(dev) {
  try {
    if (process.platform === "win32") execSync(`taskkill /pid ${dev.pid} /T /F`, { stdio: "ignore" });
    else process.kill(-dev.pid, "SIGTERM");
  } catch { /* already gone */ }
}

async function main() {
  const scenario = (await import(pathToFileURL(path.resolve(scenarioArg)).href)).default;
  mkdirSync(outDir, { recursive: true });

  // 1) Start the dev server. Astro prints e.g. "┃ Local    http://localhost:4321/"
  const dev = spawn("npm", ["run", "dev"], {
    cwd: repoRoot,
    shell: true,
    detached: process.platform !== "win32",
  });
  let base = "";
  const sniff = (b) => {
    const m = String(b).match(/Local\s+(?:\x1b\[[\d;]*m)*\s*(http:\/\/localhost:\d+)/);
    if (m && !base) base = m[1];
  };
  dev.stdout.on("data", sniff);
  dev.stderr.on("data", sniff);
  for (let i = 0; i < 80 && !base; i++) await new Promise((r) => setTimeout(r, 250));
  if (!base) base = "http://localhost:4321";
  console.log("dev server URL:", base);

  if (!await waitForUrl(base + "/")) {
    console.error("dev server never became ready at " + base);
    stopDev(dev); process.exit(1);
  }
  console.log("dev server ready");

  const browser = await chromium.launch({ executablePath: chrome, headless: true });
  const ctx = await browser.newContext({
    viewport: scenario.viewport || { width: 1280, height: 900 },
    deviceScaleFactor: 2,          // retina — screenshots are read by a human
  });

  // Anything the page complains about is worth knowing before the PR is called
  // verified. A 404 on a hero video or a missing font shows up here, not in the
  // picture.
  const errors = [];
  ctx.on("weberror", (e) => errors.push(String(e.error())));
  // Astro's dev toolbar is a fixed pill at the bottom of every dev-server page.
  // It is not in the production build, so leaving it in the shots puts a
  // control bar in front of the thing being reviewed that no visitor will ever
  // see. Hidden here rather than disabled in astro.config, which would take it
  // away from anyone actually developing.
  await ctx.addInitScript(() => {
    const hide = () => {
      const s = document.createElement("style");
      s.textContent = "astro-dev-toolbar{display:none!important}";
      (document.head || document.documentElement).appendChild(s);
    };
    if (document.head) hide();
    else document.addEventListener("DOMContentLoaded", hide, { once: true });
  });

  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("requestfailed", (r) => errors.push(`${r.failure()?.errorText} ${r.url()}`));

  const manifest = { shots: [], errors: [] };
  for (const shot of scenario.shots) {
    const url = base + (shot.path || "/");
    // `networkidle` is the right default for a static page, but it never
    // settles on one that is streaming video — the arrival film keeps the
    // network busy for its whole 30 seconds. A shot on such a page sets
    // `waitUntil: "load"` and does its own waiting in action().
    await page.goto(url, { waitUntil: shot.waitUntil || "networkidle" });
    if (shot.action) await shot.action(page);
    await page.waitForTimeout(shot.settleMs ?? 500);
    const file = `${shot.name}.png`;
    await page.screenshot({ path: path.join(outDir, file), fullPage: !!shot.fullPage });
    manifest.shots.push({ name: file, caption: shot.caption || shot.name });
    console.log("shot:", file);
  }

  manifest.errors = errors;
  writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  await browser.close();
  stopDev(dev);

  console.log(`\n${manifest.shots.length} shot(s) -> ${outDir}`);
  console.log(`page errors: ${errors.length}`);
  for (const e of errors.slice(0, 10)) console.log("  !", e);
}

main().catch((e) => { console.error(e); process.exit(1); });
