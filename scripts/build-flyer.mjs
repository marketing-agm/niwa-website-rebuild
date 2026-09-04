// Render flyer/leasing-flyer.html to a print-ready one-page PDF (and a PNG
// proof) with the Chromium that ships with Playwright. No dev server, no
// dependencies — the flyer references the site's own fonts and photography
// from disk, so what prints is the same design system the site ships.
//
//   node scripts/build-flyer.mjs
//
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = resolve(root, 'flyer/leasing-flyer.html');
const pdf = resolve(root, 'flyer/niwa-leasing-flyer.pdf');   // the deliverable
const proofDir = resolve(root, 'flyer/dist');                // proofs, git-ignored
const png = resolve(proofDir, 'proof.png');

const CHROME = [
  process.env.CHROME_PATH,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
].find((p) => p && existsSync(p));

if (!CHROME) throw new Error('No Chromium found. Set CHROME_PATH.');
if (!existsSync(src)) throw new Error(`Missing ${src}`);
mkdirSync(proofDir, { recursive: true });

const base = [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  '--hide-scrollbars',
  '--force-color-profile=srgb',
  '--allow-file-access-from-files',   // the flyer loads its fonts over file://
  '--virtual-time-budget=8000',       // let the woff2 and the photography land
];

const run = (args) => execFileSync(CHROME, [...base, ...args, `file://${src}`], { stdio: 'inherit' });

// US Letter portrait, full bleed: the page paints its own dark ground.
run([`--print-to-pdf=${pdf}`, '--no-pdf-header-footer']);
// A 2x proof. The window is taller than the page on purpose — the screen
// pipeline lays out a few pixels differently from the print one, so give it
// room to show any overrun instead of cropping it away. The PDF is the truth.
run([`--screenshot=${png}`, '--window-size=816,1160', '--force-device-scale-factor=2']);

console.log(`\nPDF  ${pdf}\nPNG  ${png}`);
