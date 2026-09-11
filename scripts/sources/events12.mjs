// events12.com — a hand-kept guide to what is on in Washington State.
//
// Added at the client's request, asked twice. It is the one of their three
// remaining suggestions that can be read at all: it answers 200 and its
// robots.txt allows /seattle/. It publishes no feed, no sitemap, no .ics and
// no JSON-LD — four rounds of probing found none — so the listing markup is
// the only way in, and this is the one source on the page parsed from HTML
// written for people rather than from a feed meant for syndication. Requests
// identify this project and link the repository, at two per weekly run.
//
// WHAT IT ACTUALLY IS, and why the filter does most of the work:
//
// "events12.com/seattle" is a guide to the state, not to the city. Its own
// listings include the Ellensburg Rodeo (108 miles east), the Evergreen State
// Fair (33 miles north-east) and an Olympia waterfront festival (62 south).
// That is presumably why every entry carries a distance, and that distance is
// what this reads: anything beyond the page's radius goes, which throws out
// most of the file and keeps the handful in Belltown, Lower Queen Anne, the
// Waterfront and Seattle Center.
//
// The distances are theirs, measured from their own downtown reference rather
// than from the building, so they are used as a coarse sieve and not quoted.
// Nothing here claims a precision it does not have: these listings carry no
// coordinates, so they appear in the list and not on the map.
//
// THE MARKUP, which the parser is written against:
//
//   <article id="100031">
//     <h3>Ellensburg Rodeo</h3>
//     <p class="date icon">September 3 - 7, 2026
//     <p class="miles">Ellensburg (108 miles E)
//     <p class="event"> <a href="https://…">…</a> description … </p>
//     <p><a class="b1" href="https://www.google.com/maps/search/?…query=ADDRESS">map</a>
//
// The <p> elements are unclosed, so each field runs to the next tag. The date
// carries its own year, which is the one thing that makes this safe to parse:
// nothing has to be inferred from position in the file.
import { getText, plain, utcFromLocal, DEFAULT_TZ } from './lib.mjs';

const BASE = 'https://www.events12.com/seattle/';
const MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'];

const HINTS = [
  [/festival|festal|fiesta|parade|celebration|fair\b|carnival/i, 'Festivals'],
  [/market|bazaar|craft show/i, 'Market'],
  [/film|cinema|movie|screening/i, 'Film'],
  [/theat(?:re|er)|play\b|musical|opera|ballet|dance|cirque|comedy/i, 'Arts & theatre'],
  [/concert|music|band|symphony|jazz|\bdj\b/i, 'Music'],
  [/museum|exhibit|gallery|sculpture|artist|\bart(?:s|work)?\b/i, 'Museums & galleries'],
  [/sport|rodeo|skate|game\b|\bvs\.?\b|marathon|\brun\b|race\b|kraken|storm|sounders|mariners/i, 'Sports'],
  [/family|kids|children|storytime|playground/i, 'Family'],
  [/\btour\b|\bwalk\b|\bstroll\b|garden|cruise/i, 'Tours'],
];

export const id = 'events12';
export const label = 'Events12';
export const probeUrls = [BASE];

const field = (block, cls) => {
  const m = block.match(new RegExp(`class=["'][^"']*\\b${cls}\\b[^"']*["'][^>]*>([\\s\\S]*?)(?:<p\\b|<img\\b|<div\\b|</article>)`, 'i'));
  return m ? plain(m[1]) : '';
};

/** "Downtown (0.2 miles E)" → 0.2. "Seattle parks" → null, and a listing with
 *  no distance is dropped rather than guessed at. */
function milesOf(text) {
  const m = String(text).match(/([\d.]+)\s*miles?/i);
  const n = m ? Number(m[1]) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** "September 5, 2026" → one day. "September 3 - 7, 2026" → a range.
 *  The year is on the string, so nothing is inferred. */
function datesOf(text) {
  const s = String(text).replace(/–|—/g, '-');
  const m = s.match(/([A-Za-z]+)\s+(\d{1,2})\s*(?:-\s*(?:([A-Za-z]+)\s+)?(\d{1,2})\s*)?,\s*(\d{4})/);
  if (!m) return null;
  const mi = MONTHS.indexOf(m[1].toLowerCase());
  if (mi < 0) return null;
  const year = Number(m[5]);
  const day = (mo, d) => `${year}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const start = day(mi, Number(m[2]));
  if (!m[4]) return { start, end: start };
  const endMonth = m[3] ? MONTHS.indexOf(m[3].toLowerCase()) : mi;
  if (endMonth < 0) return { start, end: start };
  return { start, end: day(endMonth, Number(m[4])) };
}

/** The map link carries the full postal address in its query. */
function addressOf(block) {
  const href = block.match(/class=["'][^"']*\bb1\b[^"']*["'][^>]*href=["']([^"']+)["']/i)?.[1]
    ?? block.match(/href=["'](https:\/\/www\.google\.com\/maps\/search\/[^"']+)["']/i)?.[1];
  if (!href) return null;
  const q = href.match(/[?&]query=([^&"']+)/i)?.[1];
  if (!q) return null;
  try { return decodeURIComponent(q.replace(/\+/g, ' ')).trim() || null; } catch { return null; }
}

function categorise(hay) {
  for (const [re, name] of HINTS) if (re.test(hay)) return name;
  return null;
}

/** The page covers a month. The window runs 30 days, so the next month's page
 *  is fetched too — a 404 there is normal near the end of the year and is not
 *  an error. */
function monthUrls(days) {
  const now = new Date();
  const urls = [BASE];
  const ahead = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  if (days > 20) urls.push(`${BASE}${MONTHS[ahead.getUTCMonth()]}.html`);
  return urls;
}

export async function fetchEvents({ radiusMiles = 3, days = 30, log } = {}) {
  const pages = [];
  for (const url of monthUrls(days)) {
    log?.(`GET ${url}`);
    try { pages.push(await getText(url)); }
    catch (err) { log?.(`${url}: ${err instanceof Error ? err.message : err} — skipped`); }
  }
  log?.(`${pages.length} page(s) fetched`);
  return { events: normalise(pages, { radiusMiles, days }) };
}

export function normalise(pages, { radiusMiles = 3, days = 30 } = {}) {
  const today = new Date();
  const day0 = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const cutoff = day0 + days * 864e5;
  const todayLocal = new Date(day0).toISOString().slice(0, 10);

  const events = [];
  const seen = new Set();

  for (const html of String(pages).length && !Array.isArray(pages) ? [pages] : pages) {
    for (const m of String(html).matchAll(/<article\b([^>]*)>([\s\S]*?)<\/article>/gi)) {
      const attrs = m[1], block = m[2];
      const title = plain(block.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)?.[1] ?? '');
      if (!title) continue;

      // Distance first: it throws out most of the file, and a listing with no
      // distance cannot be placed, so it goes too.
      const where = field(block, 'miles');
      const away = milesOf(where);
      if (away === null || away > radiusMiles) continue;

      const span = datesOf(field(block, 'date'));
      if (!span) continue;
      const startMs = Date.parse(`${span.start}T00:00:00Z`);
      const endMs = Date.parse(`${span.end}T00:00:00Z`);
      if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) continue;
      if (endMs < day0 || startMs > cutoff) continue;

      // A run already under way lists on today, on a day someone could go,
      // rather than at a start date in the past.
      const showDay = startMs < day0 ? todayLocal : span.start;
      const key = `${title.toLowerCase()}|${showDay}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const start = utcFromLocal(DEFAULT_TZ, showDay, '00:00:00');
      if (!start) continue;

      const body = field(block, 'event');
      const url = block.match(/class=["'][^"']*\bevent\b[^"']*["'][^>]*>[\s\S]*?<a[^>]*href=["'](https?:\/\/[^"']+)["']/i)?.[1] ?? null;
      const place = String(where).split('(')[0].trim() || 'Seattle';

      events.push({
        id: `e12-${attrs.match(/id=["']([^"']+)["']/i)?.[1] ?? title.toLowerCase().replace(/\W+/g, '-').slice(0, 40)}`,
        title,
        start,
        end: span.end !== showDay ? utcFromLocal(DEFAULT_TZ, span.end, '00:00:00') : null,
        allDay: true,
        venue: {
          name: place,
          address: addressOf(block),
          // No coordinates anywhere on the page, so no pin — the same as
          // Visit Seattle, and the map note already says so.
          lat: null,
          lng: null,
        },
        category: categorise(`${title} ${body}`),
        url: url && !/google\.com\/maps/.test(url) ? url : null,
        image: null,
        // "FREE" is marked on the entry; a price is not, so none is invented.
        priceFrom: /\bfree\b/i.test(`${attrs} ${title}`) ? 0 : null,
        source: id,
      });
    }
  }
  return events;
}

export function fromSaved(body) {
  return Array.isArray(body) ? body : [String(body ?? '')];
}
