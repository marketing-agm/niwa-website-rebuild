// Derive the vertical grid lines for a flyer or postcard source.
//
//   node scripts/grid-lines.mjs flyer/leasing-flyer-d.html
//
// The lines are a page grid drawn only where it cannot touch anything: never
// across a word, never over a photograph, never on the gold. Rather than
// guess, this measures the real thing in Chromium — every run of text via its
// Range rects, so the box is tight around the glyphs rather than the element —
// then walks each candidate column subtracting the blocked spans, and writes
// what survives back into the source as real 1px elements.
//
// Gradients are not an option: Chromium's PDF backend does not tile a
// repeating-linear-gradient, so a mesh built that way renders on screen and is
// silently absent from print. These are divs, so they print.
//
// Re-run it after any layout change. The lines are generated, not authored —
// edit the source between the GRID markers by hand and the next run wins.
//
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const H_CLEAR = 11;   // a line must clear a glyph by this much, horizontally
const V_CLEAR = 9;    // and stop this far short of it, vertically
const MIN_RUN = 40;   // shorter than this reads as a stub, so drop it

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = resolve(root, process.argv[2] ?? 'flyer/leasing-flyer-d.html');
if (!existsSync(src)) throw new Error(`Missing ${src}`);

const CHROME = [
  process.env.CHROME_PATH,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/chromium',
].find((p) => p && existsSync(p));

const html = readFileSync(src, 'utf8');
const step = Number(html.match(/data-grid-step="(\d+)"/)?.[1] ?? 68);
const minRun = Number(html.match(/data-grid-min="(\d+)"/)?.[1] ?? MIN_RUN);

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 1200 } });
await page.goto(`file://${src}`);
await page.waitForTimeout(1400);   // let the woff2 land before measuring

const perCard = await page.evaluate(({ step, H_CLEAR, V_CLEAR, minRun }) => {
  const cards = [...document.querySelectorAll('.page, .card')];

  return cards.map((card) => {
    const cb = card.getBoundingClientRect();
    const W = Math.round(cb.width), H = Math.round(cb.height);

    // Everything a line must not touch, in card coordinates.
    const blocks = [];
    const push = (r, hc, vc) => {
      if (r.width <= 0 || r.height <= 0) return;
      blocks.push({
        x1: r.left - cb.left - hc, x2: r.right - cb.left + hc,
        y1: r.top - cb.top - vc,  y2: r.bottom - cb.top + vc,
      });
    };

    // Text, measured per line via Range rects so the box hugs the glyphs.
    const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.nodeValue.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) push(r, H_CLEAR, V_CLEAR);
    }
    // The wordmark and the housing logo are artwork, not text.
    card.querySelectorAll('svg').forEach((el) => push(el.getBoundingClientRect(), H_CLEAR, V_CLEAR));
    // Photographs and the gold are solid: no line crosses them at all.
    // Inclusive of the edge: a line sitting exactly on a photo or gold border
    // only doubles the seam already drawn there.
    card.querySelectorAll('.mat--photo, .gold-ground').forEach((el) => push(el.getBoundingClientRect(), 1, 0));

    const lines = [];
    for (let x = step; x < W; x += step) {
      // Collect the y spans this column is blocked in, then merge them.
      const spans = blocks
        .filter((b) => x > b.x1 && x < b.x2)
        .map((b) => [Math.max(0, b.y1), Math.min(H, b.y2)])
        .sort((a, b) => a[0] - b[0]);
      const merged = [];
      for (const s of spans) {
        const last = merged[merged.length - 1];
        if (last && s[0] <= last[1]) last[1] = Math.max(last[1], s[1]);
        else merged.push([...s]);
      }
      // What is left between them is where the line may run.
      let cursor = 0;
      for (const [a, b] of merged) {
        if (a - cursor >= minRun) lines.push({ x, y: Math.round(cursor), h: Math.round(a - cursor) });
        cursor = Math.max(cursor, b);
      }
      if (H - cursor >= minRun) lines.push({ x, y: Math.round(cursor), h: Math.round(H - cursor) });
    }
    return { W, H, lines };
  });
}, { step, H_CLEAR, V_CLEAR, minRun });

await browser.close();

// Write the segments back between the markers, one block per card.
let out = html;
const blocks = perCard.map(({ lines }) =>
  lines.map((l) => `    <i class="gline" style="left:${l.x}px; top:${l.y}px; height:${l.h}px"></i>`).join('\n'));

let i = 0;
out = out.replace(/(<!-- GRID:START -->)[\s\S]*?(<!-- GRID:END -->)/g, (_m, a, b) => {
  const body = blocks[i++] ?? '';
  return `${a}\n${body}\n    ${b}`;
});

writeFileSync(src, out);
const total = perCard.reduce((n, c) => n + c.lines.length, 0);
perCard.forEach((c, n) => console.log(`card ${n + 1}: ${c.W}x${c.H}  ${c.lines.length} segments`));
console.log(`step ${step}px, min run ${minRun}px, ${total} segments written to ${src}`);
