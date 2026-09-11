// Seattle Center — the campus across the street.
//
// The building is at 513 1st Ave N. Seattle Center's grounds start about two
// blocks north of it, and nearly everything on this calendar is a five-minute
// walk: the Armory, the Mural Amphitheatre, the International Fountain lawn,
// Fisher Pavilion, the fountain plaza. Ticketmaster sells the arena and the
// halls; this is everything else on the same campus — the free stuff, the
// sculpture walks, the festivals, the skate nights — and it is the source
// whose listings sit most squarely inside the ring the map draws.
//
// HOW IT IS READ, and why that is the last resort rather than the plan:
//
// There is no feed. Round after round of probing found no RSS, no .ics, no
// JSON-LD, no sitemap and no embedded state blob; unlike seattle.gov, which is
// a City department publishing through Trumba, Seattle Center builds its own
// calendar page and serves the listings in the HTML. There is also no
// robots.txt at all — the host answers 404 for it — so nothing on the site
// asks automated clients to stay away. Requests go out with a user-agent that
// names this project and links the repository, at a handful per weekly run.
//
// The markup is better than most:
//
//   <p class="date-bar__date">September 11</p>        a heading per day
//   <div class="event-list__time">All Day</div>       or "7:00 PM"
//   <h2 class="event-list__title"><a href="…">…</a>   title and permalink
//   <div class="event-list__location"><a href="…google.com/maps/…@lat,lng…">
//   <div class="event-list__price"><span>Free Event</span>
//   <div class="event-list__tags"><span>Grounds / Public Space</span>
//   <div class="event-list__text">…</div>             the description
//
// The location link is a Google Maps URL with the coordinates in it, which
// makes this the only keyless source that can put a pin on the map rather
// than only a row in the list.
//
// Pagination is ?page=N, established by probe: the bare page carried Sept
// 11-13 and ?page=2 carried Sept 13-17. Pages are walked until one runs past
// the window or comes back empty, with a hard ceiling so a layout change can
// never turn this into an unbounded crawl.
//
// The one inference is the year: the day headings say "September 11" and
// never a year. Because a calendar runs forward, the year is carried along
// and incremented the moment a heading goes backwards — a December page
// followed by a January one is next year. Nothing else here is guessed.
import { getText, plain, milesBetween, utcFromLocal, DEFAULT_TZ } from './lib.mjs';

const BASE = 'https://www.seattlecenter.com/events/event-calendar';

// Twelve pages at three to five days each covers a month and a half. The
// ceiling exists so that a markup change which stops the stop-condition from
// firing costs twelve requests rather than an afternoon of them.
const MAX_PAGES = 12;

const MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'];

// The page's chips are a small closed set. Seattle Center's own tags are
// close to it but not it — "Grounds / Public Space", "Festivals & Celebrations"
// — so they are read for the hint and then thrown away. An unrecognised tag
// becomes no category rather than a new chip, the same rule the other sources
// follow.
const HINTS = [
  [/festival|festal|parade|celebration|fair\b/i, 'Festivals'],
  [/market/i, 'Market'],
  [/museum|exhibit|gallery|sculpture|artist|art\b/i, 'Museums & galleries'],
  [/theatre|theater|play\b|musical|opera|ballet|dance/i, 'Arts & theatre'],
  [/concert|music|band|symphony|jazz|dj\b/i, 'Music'],
  [/tour\b|walk\b/i, 'Tours'],
  [/skate|game|match|marathon|fitness|yoga|run\b|kraken/i, 'Sports'],
  [/film|cinema|movie|screening/i, 'Film'],
  [/family|kids|children|storytime/i, 'Family'],
];

export const id = 'seattle-center';
export const label = 'Seattle Center';
export const probeUrls = [BASE, `${BASE}?page=2`];

const tagOf = (html, cls) =>
  plain(html.match(new RegExp(`class=["'][^"']*${cls}[^"']*["'][^>]*>([\\s\\S]*?)</`, 'i'))?.[1] ?? '');

/** "September 11" plus a carried year → "2026-09-11". */
function dayOf(heading, year) {
  const m = String(heading).trim().match(/^([A-Za-z]+)\s+(\d{1,2})$/);
  if (!m) return null;
  const mi = MONTHS.indexOf(m[1].toLowerCase());
  const d = Number(m[2]);
  if (mi < 0 || !(d >= 1 && d <= 31)) return null;
  return `${year}-${String(mi + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** "All Day" → null. "7:00 PM" or "7:00 PM - 9:00 PM" → "19:00:00". */
function timeOf(text) {
  const m = String(text).match(/(\d{1,2}):(\d{2})\s*([ap])\.?m\.?/i);
  if (!m) return null;
  let h = Number(m[1]) % 12;
  if (m[3].toLowerCase() === 'p') h += 12;
  return `${String(h).padStart(2, '0')}:${m[2]}:00`;
}

/** The maps href carries the place twice: @lat,lng is the map centre and
 *  !3d…!4d… is the pin. The pin is the more exact of the two. */
function placeOf(href) {
  if (!href) return { name: null, lat: null, lng: null };
  const pin = href.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  const centre = href.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  const hit = pin ?? centre;
  let name = null;
  const slug = href.match(/\/maps\/place\/([^/@?]+)/);
  if (slug) { try { name = decodeURIComponent(slug[1].replace(/\+/g, ' ')).trim() || null; } catch { name = null; } }
  return { name, lat: hit ? Number(hit[1]) : null, lng: hit ? Number(hit[2]) : null };
}

function categorise(hay) {
  for (const [re, name] of HINTS) if (re.test(hay)) return name;
  return null;
}

/** Split one page into { day, block } pairs: each day heading owns the markup
 *  that follows it, up to the next heading. */
function sections(html) {
  const heads = [...html.matchAll(/class=["']date-bar__date["'][^>]*>\s*([^<]+?)\s*</gi)];
  return heads.map((h, i) => ({
    heading: h[1],
    block: html.slice(h.index, i + 1 < heads.length ? heads[i + 1].index : html.length),
  }));
}

export async function fetchEvents({ home, radiusMiles = 3, days = 30, log } = {}) {
  const pages = [];
  for (let p = 1; p <= MAX_PAGES; p++) {
    const url = p === 1 ? BASE : `${BASE}?page=${p}`;
    log?.(`GET ${url}`);
    let html;
    try { html = await getText(url); }
    catch (err) { log?.(`page ${p}: ${err instanceof Error ? err.message : err} — stopping here`); break; }
    const found = (html.match(/class=["']event-list__title["']/gi) ?? []).length;
    pages.push(html);
    if (!found) { log?.(`page ${p} carried no events — stopping`); break; }
    // Stop as soon as a page's last heading is past the window. Parsed cheaply
    // here with this year, which is all the stop condition needs.
    const heads = sections(html);
    const last = heads.length ? dayOf(heads[heads.length - 1].heading, new Date().getUTCFullYear()) : null;
    if (last && Date.parse(`${last}T00:00:00Z`) > Date.now() + days * 864e5) {
      log?.(`page ${p} reaches ${last}, past the window — stopping`);
      break;
    }
  }
  log?.(`${pages.length} page(s) fetched`);
  return { events: normalise(pages, { home, radiusMiles, days }) };
}

export function normalise(pages, { home, radiusMiles = 3, days = 30 } = {}) {
  const today = new Date();
  const day0 = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const cutoff = day0 + days * 864e5;

  const events = [];
  const seen = new Set();
  // The year is carried across pages, not reset per page, because the walk is
  // one continuous run forward through the calendar.
  let year = today.getUTCFullYear();
  let prev = -1;

  for (const html of pages) {
    for (const { heading, block } of sections(html)) {
      const m = String(heading).trim().match(/^([A-Za-z]+)\s+\d{1,2}$/);
      const mi = m ? MONTHS.indexOf(m[1].toLowerCase()) : -1;
      if (mi < 0) continue;
      if (prev >= 0 && mi < prev) year += 1;   // December → January
      prev = mi;

      const day = dayOf(heading, year);
      if (!day) continue;
      const dayMs = Date.parse(`${day}T00:00:00Z`);
      if (!Number.isFinite(dayMs) || dayMs < day0 || dayMs > cutoff) continue;

      // One row per title anchor, each owning the markup up to the next.
      const anchors = [...block.matchAll(/class=["']event-list__title["'][^>]*>\s*<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
      for (let i = 0; i < anchors.length; i++) {
        const a = anchors[i];
        const row = block.slice(a.index, i + 1 < anchors.length ? anchors[i + 1].index : block.length);
        const title = plain(a[2]);
        if (!title) continue;

        // The time sits in the column before the title, so it is read from the
        // markup preceding this row rather than from the row itself.
        const before = block.slice(i === 0 ? 0 : anchors[i - 1].index, a.index);
        const clock = timeOf(tagOf(before, 'event-list__time') || before.match(/event-list__time[^>]*>\s*([^<]+)/i)?.[1] || '');

        const href = row.match(/class=["'][^"']*event-list__location-link[^"']*["'][^>]*href=["']([^"']+)["']/i)?.[1]
          ?? row.match(/href=["'](https:\/\/www\.google\.com\/maps\/[^"']+)["']/i)?.[1]
          ?? null;
        const place = placeOf(href);

        // Everything on this calendar is on the campus, but the coordinates
        // are checked rather than assumed — a listing that is genuinely
        // elsewhere should be dropped like any other out-of-range record.
        if (home && place.lat != null && place.lng != null) {
          const away = milesBetween(home.lat, home.lng, place.lat, place.lng);
          if (away > radiusMiles) continue;
        }

        const start = utcFromLocal(DEFAULT_TZ, day, clock ?? '00:00:00');
        if (!start) continue;

        const key = `${title.toLowerCase()}|${day}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const slug = String(a[1]).replace(/^\/+/, '');
        const tag = tagOf(row, 'event-list__tags');
        const price = tagOf(row, 'event-list__price');

        events.push({
          id: `sc-${slug.match(/-x(\d+)$/)?.[1] ?? title.toLowerCase().replace(/\W+/g, '-').slice(0, 40)}`,
          title,
          start,
          end: null,
          allDay: !clock,
          venue: {
            name: place.name || 'Seattle Center',
            address: null,
            lat: place.lat,
            lng: place.lng,
          },
          category: categorise(`${title} ${tag}`),
          url: /^https?:/.test(slug) ? slug : `https://www.seattlecenter.com/${slug}`,
          image: null,
          // "Free Event" is worth carrying; a dollar figure is theirs to quote
          // and changes without notice, so only the free case is kept.
          priceFrom: /free/i.test(price) ? 0 : null,
          source: id,
        });
      }
    }
  }
  return events;
}

export function fromSaved(body) {
  return Array.isArray(body) ? body : [String(body ?? '')];
}
