// Render a flyer or postcard source to a print-ready PDF with the Chromium
// that ships with Playwright. No dev server, no dependencies — the sources
// reference the site's own fonts and photography from disk, so what prints is
// the same design system the site ships.
//
//   node scripts/build-flyer.mjs                              # variant A
//   node scripts/build-flyer.mjs flyer/leasing-flyer-d.html   # variant D
//   node scripts/build-flyer.mjs flyer/leasing-flyer-d.html bleed
//   node scripts/build-flyer.mjs flyer/leasing-flyer-d.html safe
//
// Modes
//   trim  (default)  the artwork at its trim size, edge to edge
//   bleed            trim + 0.125in on all four sides, for a commercial run
//   safe             trim size with a white margin, for a desktop printer
//
// A source declares its trim on <html data-trim="8.5x11">; the mode is passed
// to the page as an attribute on the same element and the @page size is
// rewritten to match. One source, three outputs — nothing is duplicated.
//
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const BLEED_IN = 0.125;      // per side
const SAFE_IN = 0.25;        // white margin per side on a desktop printer

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = resolve(root, process.argv[2] ?? 'flyer/leasing-flyer.html');
const mode = process.argv[3] ?? 'trim';
if (!['trim', 'bleed', 'safe'].includes(mode)) throw new Error(`Unknown mode: ${mode}`);

const stem = basename(src, '.html').replace(/^leasing-flyer/, 'niwa-leasing-flyer');
const name = mode === 'trim' ? stem : `${stem}-${mode}`;
const pdf = resolve(root, `flyer/${name}.pdf`);
const proofDir = resolve(root, 'flyer/dist');
const png = resolve(proofDir, `${name}-proof.png`);

const CHROME = [
  process.env.CHROME_PATH,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
].find((p) => p && existsSync(p));

if (!CHROME) throw new Error('No Chromium found. Set CHROME_PATH.');
if (!existsSync(src)) throw new Error(`Missing ${src}`);
mkdirSync(proofDir, { recursive: true });

// Read the trim off the source and work out the sheet this mode prints on.
const html = readFileSync(src, 'utf8');
const trim = html.match(/data-trim="([\d.]+)x([\d.]+)"/);
if (!trim) throw new Error(`${basename(src)} has no data-trim on <html>`);
const [w, h] = [Number(trim[1]), Number(trim[2])];
const sheet = mode === 'bleed' ? [w + BLEED_IN * 2, h + BLEED_IN * 2] : [w, h];

// Safe mode insets the artwork inside a white margin. CSS cannot divide a
// length by a length, so the scale and the centring offsets are worked out
// here and handed to the page as plain numbers.
const scale = (w - SAFE_IN * 2) / w;
const vars = [
  `--bleed: ${BLEED_IN * 96}px`,
  `--safe-scale: ${scale.toFixed(6)}`,
  `--safe-left: ${((w * 96) * (1 - scale) / 2).toFixed(2)}px`,
  `--safe-top: ${((h * 96) * (1 - scale) / 2).toFixed(2)}px`,
].join('; ');

// Print from a temp copy carrying the mode and the sheet size. A later @page
// rule wins, so the injected one overrides whatever the source declares.
let target = src;
if (mode !== 'trim') {
  target = resolve(dirname(src), `.build-${mode}-${basename(src)}`);
  writeFileSync(
    target,
    html
      .replace(/<html([^>]*)>/, `<html$1 data-mode="${mode}">`)
      .replace('</head>', `<style>@page { size: ${sheet[0]}in ${sheet[1]}in; margin: 0; }\n:root { ${vars} }</style>\n</head>`),
  );
}

const base = [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  '--hide-scrollbars',
  '--force-color-profile=srgb',
  '--allow-file-access-from-files',   // the sources load their fonts over file://
  '--virtual-time-budget=8000',       // let the woff2 and the photography land
];
const run = (args) => execFileSync(CHROME, [...base, ...args, `file://${target}`], { stdio: 'inherit' });

try {
  run([`--print-to-pdf=${pdf}`, '--no-pdf-header-footer']);
  // A 2x proof. The window is taller than the sheet on purpose — the screen
  // pipeline lays out a few pixels differently from the print one, so give it
  // room to show any overrun instead of cropping it away. The PDF is the truth.
  run([`--screenshot=${png}`, `--window-size=${Math.round(sheet[0] * 96)},${Math.round(sheet[1] * 96) + 104}`,
       '--force-device-scale-factor=2']);
} finally {
  if (target !== src) rmSync(target, { force: true });
}

console.log(`\n${mode.toUpperCase().padEnd(5)} ${sheet[0]} x ${sheet[1]} in\nPDF   ${pdf}\nPNG   ${png}`);
