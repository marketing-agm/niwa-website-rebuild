// Derive the grid for a flyer or postcard source.
//
//   node scripts/grid-lines.mjs flyer/leasing-flyer-d.html
//
// A real grid, on both axes, at a regular pitch taken from the layout module —
// so the mat seams fall on grid lines and the whole thing reads as one system
// rather than as marks placed by hand. Legibility is preserved by subtraction:
// each line is drawn only over the spans where it touches nothing. It never
// crosses a word, a photograph or the gold.
//
// Rather than guess where the type is, this measures it in Chromium: every run
// of text via its Range rects, so the box hugs the glyphs rather than the
// element. Then each line of the grid is walked, the blocked spans removed,
// and what survives is written back into the source as real 1px elements.
//
// Gradients are not an option: Chromium's PDF backend does not tile a
// repeating-linear-gradient, so a mesh built that way renders on screen and is
// silently absent from print. These are divs, so they print.
//
// Tuned per source on <html>: data-grid-x / data-grid-y are the pitch,
// data-grid-y0 anchors the horizontals (so they land on the seams), and
// data-grid-min is the shortest run worth drawing.
//
// Re-run after any layout change. The lines are generated, not authored — edit
// between the GRID markers by hand and the next run wins.
//
import { chromium } from 'playwright';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Generous on purpose: a rule 4px from a cap-height reads as cutting the word,
// so keep every line a clear ~12px off any glyph.
const H_CLEAR = 14;
const V_CLEAR = 12;

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = resolve(root, process.argv[2] ?? 'flyer/leasing-flyer-d.html');
if (!existsSync(src)) throw new Error(`Missing ${src}`);

const CHROME = [
  process.env.CHROME_PATH,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/chromium',
].find((p) => p && existsSync(p));

const html = readFileSync(src, 'utf8');
const attr = (name, fallback) => Number(html.match(new RegExp(`data-grid-${name}="([\\d.]+)"`))?.[1] ?? fallback);
const cfg = { x: attr('x', 136), y: attr('y', 108.889), y0: attr('y0', 0), min: attr('min', 20), H_CLEAR, V_CLEAR };

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 1200 } });
await page.goto(`file://${src}`);
await page.waitForTimeout(1400);   // let the woff2 land before measuring

const perCard = await page.evaluate((cfg) => {
  // Subtract the blocked spans from [0, end] and keep the runs worth drawing.
  const runs = (blocked, end, min) => {
    const merged = [];
    for (const s of blocked.sort((a, b) => a[0] - b[0])) {
      const last = merged[merged.length - 1];
      if (last && s[0] <= last[1]) last[1] = Math.max(last[1], s[1]);
      else merged.push([...s]);
    }
    const out = [];
    let cursor = 0;
    for (const [a, b] of merged) {
      if (a - cursor >= min) out.push([cursor, a]);
      cursor = Math.max(cursor, b);
    }
    if (end - cursor >= min) out.push([cursor, end]);
    return out;
  };

  return [...document.querySelectorAll('.page, .card')].map((card) => {
    const cb = card.getBoundingClientRect();
    const W = Math.round(cb.width), H = Math.round(cb.height);

    const blocks = [];
    const push = (r, hc, vc) => {
      if (r.width <= 0 || r.height <= 0) return;
      blocks.push({
        x1: r.left - cb.left - hc, x2: r.right - cb.left + hc,
        y1: r.top - cb.top - vc,  y2: r.bottom - cb.top + vc,
      });
    };

    const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.nodeValue.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) push(r, cfg.H_CLEAR, cfg.V_CLEAR);
    }
    // The wordmark and the housing mark are artwork, not text.
    card.querySelectorAll('svg').forEach((el) => push(el.getBoundingClientRect(), cfg.H_CLEAR, cfg.V_CLEAR));
    // Photographs and the gold are solid; inclusive of the edge, where a line
    // would only double the seam already drawn there.
    card.querySelectorAll('.mat--photo, .gold-ground').forEach((el) => push(el.getBoundingClientRect(), 1, 1));

    const lines = [];
    for (let x = cfg.x; x < W; x += cfg.x) {
      const cut = blocks.filter((b) => x > b.x1 && x < b.x2).map((b) => [Math.max(0, b.y1), Math.min(H, b.y2)]);
      for (const [a, b] of runs(cut, H, cfg.min)) lines.push({ v: true, x, y: a, len: b - a });
    }
    for (let y = cfg.y0 + cfg.y; y < H; y += cfg.y) {
      const cut = blocks.filter((b) => y > b.y1 && y < b.y2).map((b) => [Math.max(0, b.x1), Math.min(W, b.x2)]);
      for (const [a, b] of runs(cut, W, cfg.min)) lines.push({ v: false, y, x: a, len: b - a });
    }
    return { W, H, lines };
  });
}, cfg);

await browser.close();

const blocks = perCard.map(({ lines }) => lines.map((l) => (l.v
  ? `    <i class="gline" style="left:${l.x}px; top:${Math.round(l.y)}px; height:${Math.round(l.len)}px"></i>`
  : `    <i class="gline gline--h" style="left:${Math.round(l.x)}px; top:${l.y}px; width:${Math.round(l.len)}px"></i>`)).join('\n'));

let i = 0;
const out = html.replace(/(<!-- GRID:START -->)[\s\S]*?(<!-- GRID:END -->)/g,
  (_m, a, b) => `${a}\n${blocks[i++] ?? ''}\n    ${b}`);
writeFileSync(src, out);

perCard.forEach((c, n) => {
  const v = c.lines.filter((l) => l.v).length;
  console.log(`card ${n + 1}: ${c.W}x${c.H}  ${v} vertical + ${c.lines.length - v} horizontal segments`);
});
console.log(`pitch ${cfg.x} x ${cfg.y}px, anchored y0=${cfg.y0}, min run ${cfg.min}px → ${basename(src)}`);
