// compose.mjs: lay screenshots side by side: before-and-after pairs and spreads.
//
// Usage:
//   node compose.mjs pair  <before.png> <after.png> <out.png> [--labels "Before,After"] [--scale 0.5]
//   node compose.mjs sheet <out.png> <a.png> <b.png> ...      [--cols 3] [--labels "A,B,C"] [--scale 0.5]
//
// A pair is two images with a gap: say which side is which in the comment, or
// pass --labels to print it above each image. A sheet (a "spread") is any
// number of images in a grid: three design options, light and dark, desktop
// and phone. --scale shrinks the result, for example 0.5 for 2x phone shots.
//
// It draws a small page of the images in the same browser the other scripts
// use and screenshots it, so it needs no image library. PNG inputs only.
import { readFileSync } from "node:fs";
import path from "node:path";
import { launchBrowser } from "./browser.mjs";

/** Reads a PNG's width and height from its header (bytes 16 to 23). */
function pngSize(file) {
  const b = readFileSync(file);
  if (b.toString("ascii", 1, 4) !== "PNG") throw new Error(file + " is not a PNG");
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

/** Splits the arguments into plain values and --flags. */
function parseArgs(argv) {
  const flags = {}; const rest = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) flags[argv[i].slice(2)] = argv[++i];
    else rest.push(argv[i]);
  }
  return { flags, rest };
}

/** The page that lays the images out. Images go in as data URLs, so no file access rules apply. */
function layoutHtml(images, cols, labels, scale) {
  const cells = images.map((img, i) => `<figure>
      ${labels[i] ? `<figcaption>${labels[i].replace(/</g, "&lt;")}</figcaption>` : ""}
      <img src="data:image/png;base64,${readFileSync(img.file).toString("base64")}" width="${Math.round(img.w * scale)}">
    </figure>`).join("");
  return `<!doctype html><style>
    html,body{margin:0;background:#e2e5e9}
    #sheet{display:inline-grid;grid-template-columns:repeat(${cols},auto);gap:${Math.round(40 * scale)}px;
      padding:${Math.round(40 * scale)}px;align-items:start;background:#e2e5e9}
    figure{margin:0} img{display:block;height:auto}
    figcaption{font:600 ${Math.max(12, Math.round(28 * scale))}px/1.4 system-ui,sans-serif;color:#1f2328;margin:0 0 8px}
  </style><div id="sheet">${cells}</div>`;
}

async function main() {
  const { flags, rest } = parseArgs(process.argv.slice(2));
  const mode = rest.shift();
  let out; let files;
  if (mode === "pair" && rest.length === 3) { files = rest.slice(0, 2); out = rest[2]; }
  else if (mode === "sheet" && rest.length >= 2) { out = rest[0]; files = rest.slice(1); }
  else {
    console.error('usage: compose.mjs pair <before.png> <after.png> <out.png> [--labels "Before,After"] [--scale 0.5]\n' +
      '       compose.mjs sheet <out.png> <a.png> <b.png> ... [--cols 3] [--labels "A,B"] [--scale 0.5]');
    process.exit(2);
  }
  const images = files.map((f) => ({ file: path.resolve(f), ...pngSize(f) }));
  const cols = mode === "pair" ? 2 : Number(flags.cols) || images.length;
  const labels = flags.labels ? flags.labels.split(",").map((s) => s.trim()) : [];
  const scale = Number(flags.scale) || 1;

  // A window wide enough for the whole row, so nothing wraps.
  const widest = Math.max(...images.map((i) => i.w)) * scale;
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage({ viewport: { width: Math.ceil(widest * cols + 200), height: 800 } });
    await page.setContent(layoutHtml(images, cols, labels, scale), { waitUntil: "load" });
    await page.locator("#sheet").screenshot({ path: path.resolve(out) });
    console.log("wrote", out);
  } finally {
    await browser.close();
  }
}
main().catch((e) => { console.error("FATAL", e.message); process.exit(1); });
