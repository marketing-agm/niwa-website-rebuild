// Queen Anne Chamber of Commerce — the neighbourhood's own calendar.
//
// This is the source that makes the page about Queen Anne rather than about
// arenas: the Farmers Market, Trick or Treat on the Ave, the Fall Wine Walk,
// the Grand Tree Lighting, story time at the branch library. Ticketmaster does
// not carry any of it, because none of it is ticketed through Ticketmaster.
//
// The site runs The Events Calendar (the "Yearly / Monthly / Weekly / Daily /
// List" bar and the /events/<slug>/ permalinks are its signature), which
// publishes a documented read-only REST endpoint at
// /wp-json/tribe/events/v1/events. No key, no account, no rate limit worth
// worrying about at one call a week.
//
// If that endpoint is switched off the source reports itself unavailable and
// the run carries on with whatever else answered — run `npm run events --
// --probe` to see what the site is actually serving.
import { getJson, milesBetween, plain, splitStamp, utcFromLocal, DEFAULT_TZ } from './lib.mjs';

const BASE = 'https://www.queenannechamber.org';
const ENDPOINT = `${BASE}/wp-json/tribe/events/v1/events`;
const PER_PAGE = 50;

// Everything the Chamber lists is in the neighbourhood, so a record with no
// venue geography still belongs on the page — it simply gets no pin. What it
// must not do is claim a distance it cannot support.
const CATEGORY_HINTS = [
  [/farmers? market|harvest market/i, 'Market'],
  [/wine walk|beer|tasting|brew/i, 'Food & drink'],
  [/trick or treat|tree lighting|parade|festival|holiday/i, 'Community'],
  [/story ?time|library|kids|family|children/i, 'Family'],
  [/volunteer|day of service|clean ?up|garden/i, 'Volunteering'],
  [/concert|music|band|live/i, 'Music'],
  [/art|gallery|theatre|theater|dance/i, 'Arts & theatre'],
];

function categorise(ev) {
  const named = (ev?.categories ?? []).map((c) => plain(c?.name)).filter(Boolean);
  if (named.length) return named[0];
  const hay = `${plain(ev?.title)} ${plain(ev?.excerpt || ev?.description)}`;
  for (const [re, label] of CATEGORY_HINTS) if (re.test(hay)) return label;
  return 'Community';
}

/** The plugin gives UTC stamps alongside the local ones. Prefer the UTC pair. */
function startOf(ev) {
  const allDay = ev?.all_day === true;
  const zone = ev?.timezone || DEFAULT_TZ;
  const utc = splitStamp(ev?.utc_start_date);
  if (utc && !allDay) return { start: `${utc.date}T${utc.time}Z`, allDay };
  const local = splitStamp(ev?.start_date);
  if (!local) return null;
  // An all-day event's UTC stamp is midnight-to-midnight in UTC, which is the
  // wrong day here; resolve the local date in the venue's zone instead.
  const start = utcFromLocal(zone, local.date, allDay ? '00:00:00' : local.time)
    ?? utcFromLocal(DEFAULT_TZ, local.date, allDay ? '00:00:00' : local.time);
  return start ? { start, allDay } : null;
}

function endOf(ev) {
  const utc = splitStamp(ev?.utc_end_date);
  return utc ? `${utc.date}T${utc.time}Z` : null;
}

export const id = 'queen-anne-chamber';
export const label = 'Queen Anne Chamber of Commerce';

export async function fetchEvents({ home, radiusMiles, days, log }) {
  const now = new Date();
  const end = new Date(now.getTime() + days * 864e5);
  const day = (d) => d.toISOString().slice(0, 10);

  const url = new URL(ENDPOINT);
  url.searchParams.set('start_date', day(now));
  url.searchParams.set('end_date', day(end));
  url.searchParams.set('per_page', String(PER_PAGE));
  url.searchParams.set('status', 'publish');
  log(`GET ${url}`);

  const body = await getJson(url);
  const raw = Array.isArray(body?.events) ? body.events : [];
  return { events: normalise(raw, { home, radiusMiles }) };
}

export function normalise(raw, { home, radiusMiles }) {
  const events = [];
  for (const ev of raw) {
    const title = plain(ev?.title);
    const when = startOf(ev);
    if (!title || !when) continue;

    // `venue` is an object when set and an empty array when not.
    const v = Array.isArray(ev?.venue) ? null : ev?.venue;
    const lat = Number(v?.geo_lat);
    const lng = Number(v?.geo_lng);
    const hasGeo = Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0);
    // A Chamber listing is in Queen Anne by definition, so a record without
    // coordinates is kept and simply carries no pin. One that *has*
    // coordinates and is somehow miles away is not the neighbourhood's.
    if (hasGeo && milesBetween(home.lat, home.lng, lat, lng) > radiusMiles + 0.25) continue;

    events.push({
      id: `qac-${ev?.id ?? title.toLowerCase().replace(/\W+/g, '-').slice(0, 40)}`,
      title,
      start: when.start,
      end: endOf(ev),
      allDay: when.allDay,
      venue: {
        name: plain(v?.venue) || 'Queen Anne',
        address: plain(v?.address) || null,
        lat: hasGeo ? Number(lat.toFixed(6)) : null,
        lng: hasGeo ? Number(lng.toFixed(6)) : null,
      },
      category: categorise(ev),
      url: typeof ev?.url === 'string' ? ev.url : null,
      image: typeof ev?.image?.url === 'string' ? ev.image.url : null,
      priceFrom: null,
      source: id,
    });
  }
  return events;
}

/** Offline path: a saved response from the endpoint above. */
export function fromSaved(body) {
  return Array.isArray(body?.events) ? body.events : [];
}

/** Candidates the --probe run tries, best first. */
export const probeUrls = [
  `${ENDPOINT}?per_page=1`,
  `${BASE}/wp-json/wp/v2/tribe_events?per_page=1`,
  `${BASE}/events/?ical=1`,
  `${BASE}/events/feed/`,
];
