// browser.mjs: the browser helpers the other scripts in this skill share.
//
//   launchBrowser() start the browser the right way on a laptop or in the cloud
//   loadChromium()  find Playwright's library, wherever this machine keeps it
//   findChrome()    find a Chrome, Edge or Chromium program to drive
//   settle(page)    wait until the page has finished drawing, before a screenshot
//
// Kept in one file so every script launches and uses the browser the same way.
// Filming for GIFs is in record.mjs.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { X509Certificate, createHash } from "node:crypto";
import { execSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Where a system browser usually lives on Windows, Linux and macOS.
const CHROME_CANDIDATES = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];

/**
 * Loads Playwright's `chromium` launcher.
 * A laptop usually has it in the repo (`npm i --no-save playwright-core`); a
 * cloud sandbox often has a global copy instead. Trying each place in turn
 * means the scripts work in both without editing.
 */
export async function loadChromium() {
  const tries = ["playwright-core", "playwright"];
  try {
    const globalRoot = execSync("npm root -g", { encoding: "utf8" }).trim();
    tries.push(path.join(globalRoot, "playwright-core", "index.mjs"), path.join(globalRoot, "playwright", "index.mjs"));
  } catch { /* npm is not on the PATH; the local tries may still work */ }
  for (const spec of tries) {
    try {
      // A full path has to be turned into a file:// URL, which also handles Windows drive letters.
      const mod = await import(path.isAbsolute(spec) ? pathToFileURL(spec).href : spec);
      if (mod.chromium) return mod.chromium;
    } catch { /* not installed there, try the next place */ }
  }
  throw new Error("Playwright not found. Run `npm i --no-save playwright-core` in the repo.");
}

/**
 * Returns the path of a browser program to drive, or null.
 * Order: CHROME_PATH if set, then a system Chrome or Edge, then the Chromium
 * that Playwright installs. Claude Code on the web keeps that one under
 * PLAYWRIGHT_BROWSERS_PATH (usually /opt/pw-browsers), in a folder named with a
 * build number that changes, so it is searched for rather than hardcoded.
 */
export function findChrome() {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  return CHROME_CANDIDATES.find(existsSync) || playwrightChromium()[0] || null;
}

function playwrightChromium() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
  if (!existsSync(root)) return [];
  const found = [];
  for (const dir of readdirSync(root)) {
    if (!dir.startsWith("chromium")) continue;
    // headless_shell cannot open a visible window, so the full browser comes first.
    for (const rel of ["chrome-linux/chrome", "chrome-linux/headless_shell"]) {
      const p = path.join(root, dir, rel);
      if (existsSync(p)) found.push(p);
    }
  }
  return found.sort((a, b) => Number(b.includes("chrome-linux/chrome")) - Number(a.includes("chrome-linux/chrome")) || b.localeCompare(a));
}

/**
 * Chrome settings for Claude Code on the web.
 * There, every HTTPS request goes through a proxy that re-signs it with its own
 * certificate authority. Node, curl and git are set up to trust that authority,
 * but Chromium's certificate store is empty, so outside files such as Google
 * Fonts fail to load and every screenshot silently falls back to a system font.
 * This trusts the proxy's own authorities, and only those, by their public key.
 * The public authorities in the same file are left to normal checks. On a
 * normal machine the file does not exist and nothing changes.
 */
function sandboxTrustArgs(bundle = "/root/.ccr/ca-bundle.crt") {
  if (!existsSync(bundle)) return [];
  const pems = readFileSync(bundle, "utf8").match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) || [];
  const keys = pems
    .map((pem) => new X509Certificate(pem))
    .filter((cert) => /O=Anthropic/.test(cert.subject)) // the proxy's authorities
    .map((cert) => createHash("sha256").update(cert.publicKey.export({ type: "spki", format: "der" })).digest("base64"));
  return keys.length ? ["--ignore-certificate-errors-spki-list=" + keys.join(",")] : [];
}

/** Starts the browser: Playwright's library, a browser program, and the cloud settings above. */
export async function launchBrowser({ headless = true } = {}) {
  const chromium = await loadChromium();
  return chromium.launch({ executablePath: findChrome() || undefined, headless, args: sandboxTrustArgs() });
}

/**
 * Waits until the page has finished drawing, so a screenshot never catches a
 * font still loading or a panel halfway through fading in. That kind of
 * screenshot looks like a bug to a reviewer even when the page is fine.
 */
export async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    for (const a of document.getAnimations()) {
      try { a.finish(); } catch { /* an endless animation (a spinner) cannot finish; leave it */ }
    }
  });
  await page.waitForTimeout(50); // one more frame, so the finished state is what gets painted
}
