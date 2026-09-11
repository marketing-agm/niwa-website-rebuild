// The City of Seattle's calendar — the civic half of what is on.
//
// seattle.gov does not build this page itself. It embeds Trumba, a calendar
// publishing platform, as "seattlegov-city-wide", and Trumba serves every
// calendar it hosts as .rss, .ics, .xml and .json off a stable path. Those
// feeds exist to be syndicated, so there is nothing here that has to be read
// off a page: this subscribes to the JSON the City already publishes.
//
// No key. Like Visit Seattle, the records carry an address but no
// coordinates, so these listings appear on the page and not on the map, which
// the map note already says out loud.
import { getJson, plain, utcFromLocal, DEFAULT_TZ } from './lib.mjs';

export const id = 'seattle-gov';
export const label = 'City of Seattle';

// No parameters. Trumba accepts ?startdate= and ?days= without complaint and
// honours neither: startdate=today silently returns an archive slice — the
// first run of this adapter came back with public hearings from 2013, all of
// which were correctly dropped as already ended, which is why it produced
// nothing at all. The bare feed returns the current 200, which measured a
// month out. The window is enforced below, where it can be checked.
const ENDPOINT = 'https://www.trumba.com/calendars/seattlegov-city-wide.json';

export const probeUrls = [ENDPOINT];

// The whole city publishes to this calendar, and most of it is nowhere near
// the building. Every record carries a Neighborhoods field, which is the
// City's own answer to "where is this", so that is what gets read — and the
// location text as a fallback, because a handful of records name the
// neighbourhood only in the address.
//
// "Citywide" is deliberately not in here. It is on most park-programme
// records and means "we run this everywhere", which is not a claim that
// anything is happening within three miles of 1st Ave N.
const NEAR = /queen\s*anne|uptown|seattle\s*center|belltown|south\s*lake\s*union|denny\s*triangle|interbay|magnolia|downtown/i;

// Trumba's own taxonomy is a mix of calendar names and per-department custom
// fields, so it is read where it exists and inferred from the title where it
// does not — the same fallback the other sources use.
const HINTS = [
  [/festival|parade|fair\b|celebration/i, 'Festivals'],
  [/market/i, 'Market'],
  [/museum|exhibit|gallery|art\b|mural|sculpture/i, 'Museums & galleries'],
  [/theatre|theater|play\b|musical|opera|ballet|dance/i, 'Arts & theatre'],
  [/concert|music|band|symphony|jazz|choir/i, 'Music'],
  [/tour\b|walk\b|stroll/i, 'Tours'],
  [/game|match|marathon|run\b|swim|yoga|fitness/i, 'Sports'],
  [/film|cinema|screening|movie/i, 'Film'],
  [/meeting|hearing|board|commission|council|forum|budget/i, 'Public meetings'],
  [/volunteer|work\s*party|clean\s*up|restoration|planting/i, 'Volunteering'],
  [/class|workshop|clinic|training|lesson/i, 'Classes'],
];

const field = (ev, label) =>
  (ev?.customFields ?? []).find((f) => String(f?.label ?? '').toLowerCase() === label.toLowerCase())?.value ?? '';

function isNear(ev) {
  const hoods = plain(field(ev, 'Neighborhoods'));
  const where = plain(ev?.location);
  return NEAR.test(hoods) || NEAR.test(where);
}

function categorise(ev) {
  const cat = plain(field(ev, 'Parks Event Category')) || plain(ev?.categoryCalendar);
  const hay = `${ev?.title ?? ''} ${cat}`;
  for (const [re, name] of HINTS) if (re.test(hay)) return name;
  return cat || null;
}

// location arrives as an anchor whose text is the venue and whose href is a
// Google Maps search carrying the full address in q. Both are worth having:
// the anchor text is what a reader recognises, the q is what they would put
// in a phone.
function venueOf(ev) {
  const html = String(ev?.location ?? '');
  const name = plain(html) || 'Seattle';
  let address = null;
  const href = html.match(/href\s*=\s*["']([^"']+)["']/i)?.[1];
  if (href) {
    const q = href.match(/[?&]q=([^&"']+)/i)?.[1];
    if (q) { try { address = decodeURIComponent(q.replace(/\+/g, ' ')).trim() || null; } catch { address = null; } }
  }
  return { name, address, lat: null, lng: null };
}

// startDateTime is wall-clock with no zone, but the record carries the offset
// that applied on the day as startTimeZoneOffset ("-0700"). Together they are
// an exact instant, so none of the zone machinery the other sources need is
// wanted here — the feed has already done that work.
function instant(local, offset) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(String(local ?? ''))) return null;
  const off = /^[+-]\d{4}$/.test(String(offset ?? '')) ? `${offset.slice(0, 3)}:${offset.slice(3)}` : 'Z';
  const ms = Date.parse(`${local}${off}`);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

// Long enough and it is a programme, not an evening. Same line as Visit
// Seattle, and for the same reason: a season runs weeks, a standing
// arrangement runs years, and a page called What's on is about things that
// start.
const RUN_LIMIT_DAYS = 90;

export function fromSaved(body) {
  return Array.isArray(body) ? body : Array.isArray(body?.events) ? body.events : [];
}

export async function fetchEvents({ days = 30 } = {}) {
  const body = await getJson(ENDPOINT, { headers: { accept: 'application/json' } });
  const raw = fromSaved(body);
  return { events: normalise(raw, { days }), fetched: raw.length };
}

export function normalise(raw, { days = 30 } = {}) {
  const now = new Date();
  const day0 = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const cutoff = day0 + days * 864e5;
  // en-CA formats as YYYY-MM-DD, which is the shape the rest of this wants.
  const todayLocal = new Intl.DateTimeFormat('en-CA', { timeZone: DEFAULT_TZ }).format(now);

  const events = [];
  const seen = new Set();

  for (const ev of raw) {
    if (ev?.canceled) continue;
    // Online-only sessions are real events, but not ones you can walk to, and
    // this page's whole argument is walking distance.
    if (/^(online|virtual)$/i.test(String(ev?.locationType ?? ''))) continue;
    if (!isNear(ev)) continue;

    const title = plain(ev?.title);
    if (!title) continue;

    const start = instant(ev?.startDateTime, ev?.startTimeZoneOffset);
    if (!start) continue;
    const end = instant(ev?.endDateTime, ev?.endTimeZoneOffset);

    const startMs = Date.parse(start);
    const endMs = end ? Date.parse(end) : startMs;
    if (endMs < day0) continue;
    if (startMs > cutoff) continue;
    if ((endMs - startMs) / 864e5 > RUN_LIMIT_DAYS) continue;

    // A run already under way lists on today rather than at a start date in
    // the past, so it appears on a day someone could actually go.
    //
    // Today has to be today in Seattle, and the clock has to be the event's
    // own local clock. Doing this in UTC put a 6pm event on yesterday: a UTC
    // midnight is 5pm the previous afternoon on this coast, so the arithmetic
    // was a day out for everything scheduled after 5pm.
    const showStart = startMs < day0
      ? utcFromLocal(DEFAULT_TZ, todayLocal, String(ev.startDateTime).slice(11, 19)) ?? start
      : start;
    if (!showStart) continue;

    const key = `${title.toLowerCase()}|${showStart.slice(0, 10)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    events.push({
      id: `sg-${ev?.eventID ?? title.toLowerCase().replace(/\W+/g, '-').slice(0, 40)}`,
      title,
      start: showStart,
      end: end && end.slice(0, 10) !== showStart.slice(0, 10) ? end : null,
      allDay: !!ev?.allDay,
      venue: venueOf(ev),
      category: categorise(ev),
      url: typeof ev?.permaLinkUrl === 'string' && /^https?:/.test(ev.permaLinkUrl) ? ev.permaLinkUrl : null,
      image: typeof ev?.eventImage === 'string' && /^https?:/.test(ev.eventImage) ? ev.eventImage : null,
      priceFrom: null,
      source: id,
    });
  }
  return events;
}
