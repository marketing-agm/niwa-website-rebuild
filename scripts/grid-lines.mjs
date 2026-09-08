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
// A grid line within this of a seam or a pocket rule is a double line. Exactly
// collinear it butts up against it; merely near it, it stands clear by PAD.
const DUP_TOL = 10;
const DUP_PAD = 8;

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = resolve(root, process.argv[2] ?? 'flyer/leasing-flyer-d.html');
if (!existsSync(src)) throw new Error(`Missing ${src}`);

const CHROME = [
  process.env.CHROME_PATH,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/chromium',
].find((p) => p && existsSync(p));

const html = readFileSync(src, 'utf8');

// `off` clears the grid without touching anything else. Re-run without it to
// derive the lines again.
if (process.argv[3] === 'off') {
  writeFileSync(src, html.replace(/(<!-- GRID:START -->)[\s\S]*?(<!-- GRID:END -->)/g, '$1\n    $2'));
  console.log(`grid cleared → ${basename(src)}`);
  process.exit(0);
}
const attr = (name, fallback) => Number(html.match(new RegExp(`data-grid-${name}="([\\d.]+)"`))?.[1] ?? fallback);
const cfg = { x: attr('x', 136), y: attr('y', 108.889), y0: attr('y0', 0), min: attr('min', 20),
              long: attr('long', 200), H_CLEAR, V_CLEAR, DUP_TOL, DUP_PAD };

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

    // Every line already on the sheet: the seams, and any CSS border. A grid
    // line must never double one of these.
    const already = { h: [], v: [] };
    const note = (r, src) => {
      if (r.width <= 2 && r.height > 2) already.v.push({ c: r.left - cb.left, a: r.top - cb.top, b: r.bottom - cb.top, src });
      else if (r.height <= 2 && r.width > 2) already.h.push({ c: r.top - cb.top, a: r.left - cb.left, b: r.right - cb.left, src });
    };
    card.querySelectorAll('.seam').forEach((el) => note(el.getBoundingClientRect(), 'seam'));
    card.querySelectorAll('*').forEach((el) => {
      const cs = getComputedStyle(el), r = el.getBoundingClientRect();
      if (r.width < 3 || r.height < 1) return;
      const t = r.top - cb.top, bo = r.bottom - cb.top, l = r.left - cb.left, ri = r.right - cb.left;
      if (parseFloat(cs.borderTopWidth) > 0)    already.h.push({ c: t,  a: l, b: ri, src: 'border' });
      if (parseFloat(cs.borderBottomWidth) > 0) already.h.push({ c: bo, a: l, b: ri, src: 'border' });
      if (parseFloat(cs.borderLeftWidth) > 0)   already.v.push({ c: l,  a: t, b: bo, src: 'border' });
      if (parseFloat(cs.borderRightWidth) > 0)  already.v.push({ c: ri, a: t, b: bo, src: 'border' });
    });
    // Spans where a grid line at `coord` would double an existing line.
    const dupes = (list, coord) => list.flatMap((L) => {
      const d = Math.abs(L.c - coord);
      if (d > cfg.DUP_TOL) return [];
      const pad = d < 1.5 ? 0 : cfg.DUP_PAD;   // collinear butts; near stands clear
      return [[L.a - pad, L.b + pad]];
    });

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

    // A line may only end at something you can see: a seam, the edge of a
    // photograph or the gold, or the edge of the sheet. Never in mid-air, and
    // never at a word — a run that text interrupts is trimmed back to the last
    // real boundary, and if nothing is left it simply is not drawn. That is
    // what removes the half lines.
    //
    // The horizontal members of this grid are the mat seams themselves, which
    // already sit on the module; the derived lines supply the verticals. Adding
    // horizontals inside a pocket is what produced the floating ticks.
    const bounds = { h: [{ c: 0, a: 0, b: W }, { c: H, a: 0, b: W }],
                     v: [{ c: 0, a: 0, b: H }, { c: W, a: 0, b: H }] };
    card.querySelectorAll('.seam').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width <= 2) bounds.v.push({ c: r.left - cb.left, a: r.top - cb.top, b: r.bottom - cb.top });
      else bounds.h.push({ c: r.top - cb.top, a: r.left - cb.left, b: r.right - cb.left });
    });
    card.querySelectorAll('.mat--photo, .gold-ground').forEach((el) => {
      const r = el.getBoundingClientRect();
      const [l, t, ri, bo] = [r.left - cb.left, r.top - cb.top, r.right - cb.left, r.bottom - cb.top];
      bounds.h.push({ c: t, a: l, b: ri }, { c: bo, a: l, b: ri });
      bounds.v.push({ c: l, a: t, b: bo }, { c: ri, a: t, b: bo });
    });
    // A run is kept when it reaches a real boundary at either end: then it
    // reads as one grid line passing behind the type, broken where the words
    // are. A run floating between two blocks of text, touching nothing, is the
    // "half line" — dropped. Long runs are kept regardless, since at that
    // length they read as a grid line whatever they end on.
    const keep = (a, b, list, at) => {
      if (b - a < cfg.min) return null;
      const cs = list.filter((L) => L.a - 1.5 <= at && at <= L.b + 1.5).map((L) => L.c);
      const anchored = cs.some((c) => Math.abs(c - a) < 2) || cs.some((c) => Math.abs(c - b) < 2);
      if (!anchored && b - a < cfg.long) return null;
      return [a, b];
    };

    const lines = [];
    for (let x = cfg.x; x < W; x += cfg.x) {
      const cut = blocks.filter((b) => x > b.x1 && x < b.x2).map((b) => [Math.max(0, b.y1), Math.min(H, b.y2)]);
      cut.push(...dupes(already.v, x));
      for (const [a, b] of runs(cut, H, cfg.min)) {
        const t = keep(a, b, bounds.h, x);
        if (t) lines.push({ v: true, x, y: t[0], len: t[1] - t[0] });
      }
    }
    for (let y = cfg.y0 + cfg.y; y < H; y += cfg.y) {
      const cut = blocks.filter((b) => y > b.y1 && y < b.y2).map((b) => [Math.max(0, b.x1), Math.min(W, b.x2)]);
      cut.push(...dupes(already.h, y));
      for (const [a, b] of runs(cut, W, cfg.min)) {
        const t = keep(a, b, bounds.v, y);
        if (t) lines.push({ v: false, y, x: t[0], len: t[1] - t[0] });
      }
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
