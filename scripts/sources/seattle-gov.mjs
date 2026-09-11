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

// The whole city publishes to this calendar and most of it is nowhere near
// the building, so the hard part of this source is deciding what is close.
//
// The Neighborhoods field looked like the answer and is not, on its own: a
// record can carry twenty of them. A fire-station story time in West Seattle
// arrived tagged with Downtown among a dozen others and passed a test that
// only asked whether any tag was near.
//
// The postcode is better, because there is one of it and it is in the
// address. These are the codes within about three miles of 1st Ave N —
// Uptown and South Lake Union, Queen Anne and Interbay, Belltown, the
// downtown core, Pioneer Square and the International District, Eastlake,
// Capitol Hill, Magnolia. Anything else is a bus ride.
const NEAR_ZIPS = new Set(['98109', '98119', '98121', '98101', '98104', '98102', '98112', '98199']);
// 98122 was in this set and came out again: it runs from Capitol Hill all the
// way to Leschi, and a lakeside park four and a half miles east arrived on a
// page that promises three. A postcode is only a good proxy for distance
// while it stays small.

// Used only where no postcode appears anywhere in the record, which is most
// of the park programmes — "Freeway Park" carries no address at all.
// "Citywide" is deliberately absent: it is on most park records and means
// "we run this everywhere", which is not a claim that anything is happening
// near this building.
const NEAR_NAMES = /queen\s*anne|uptown|seattle\s*center|belltown|south\s*lake\s*union|denny\s*(?:park|triangle)|interbay|magnolia|downtown|freeway\s*park|pioneer\s*square|international\s*district|westlake|myrtle\s*edwards|olympic\s*sculpture/i;

// Virtual sessions are real events and not ones you can walk to, and this
// page's whole argument is walking distance. locationType alone missed them:
// a Teams workshop came through typed "In-Person" with "Virtual Teams
// Meeting" as its location.
const VIRTUAL = /\bvirtual\b|\bonline\b|\bwebinar\b|\bzoom\b|\bteams meeting\b|\bremote\b/i;

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
  const where = `${plain(ev?.location)} ${String(ev?.location ?? '')}`;
  const zips = [...where.matchAll(/\b(98\d{3})\b/g)].map((m) => m[1]);
  // A postcode is a single claim about one place, so where there is one it
  // decides — including when it decides against.
  if (zips.length) return zips.some((z) => NEAR_ZIPS.has(z));
  return NEAR_NAMES.test(plain(field(ev, 'Neighborhoods'))) || NEAR_NAMES.test(plain(ev?.location));
}

function isVirtual(ev) {
  if (/^(online|virtual|hybrid)$/i.test(String(ev?.locationType ?? ''))) return true;
  return VIRTUAL.test(plain(ev?.title)) || VIRTUAL.test(plain(ev?.location));
}

// The page's category chips are a small closed set, and Trumba's own words
// are not in it: categoryCalendar carries things like "Seattle.Gov|City-Wide"
// and "Seattle Fire Department", which are publishers rather than kinds of
// evening. So the feed's words are read for the hints and then thrown away —
// an unrecognised one becomes no category rather than a new chip.
function categorise(ev) {
  const hay = `${ev?.title ?? ''} ${plain(field(ev, 'Parks Event Category'))} ${plain(ev?.categoryCalendar)}`;
  for (const [re, name] of HINTS) if (re.test(hay)) return name;
  return null;
}

// location arrives as an anchor whose text is the venue and whose href is a
// Google Maps search carrying the full address in q. Both are worth having:
// the anchor text is what a reader recognises, the q is what they would put
// in a phone.
function venueOf(ev) {
  const html = String(ev?.location ?? '');
  // The anchor text often runs the place and its address together — "Council
  // Chambers 600 4th Ave., Floor 2". The address belongs in the address, so
  // the name is cut at the house number.
  //
  // Some records have no place name at all and the anchor is the address
  // itself, which put "2061 15th Ave. W., Seattle, WA 98119" on the page as a
  // venue. The cut above cannot fire on those because the number is at the
  // front rather than in the middle, so a name that begins with a house
  // number is cut at its first comma instead — the street is at least
  // recognisable, and the full address is still carried underneath.
  let name = plain(html).replace(/\s+\d{2,5}\s+\w.*$/, '').trim() || plain(html) || 'Seattle';
  if (/^\d{2,6}\s+\S/.test(name)) name = name.split(/\s*,\s*/)[0].trim() || name;
  if (name.length > 48) name = name.slice(0, 47).replace(/\s+\S*$/, '') + '…';
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
    if (isVirtual(ev)) continue;
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
