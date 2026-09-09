// Ticketmaster Discovery API — the ticketed rooms around the building.
//
// Climate Pledge Arena is at the end of the block; Seattle Center's halls, the
// Paramount, the Moore and the Crocodile are all inside a three-mile circle.
// Every record carries a venue latitude and longitude, which is what the map
// is plotted from.
//
// Free, one key. https://developer-acct.ticketmaster.com/user/register
// Limits: 5,000 calls a day, 5 a second, and deep paging only to the 1000th
// item (size × page < 1000). This makes at most two calls a week.
import { geohash, getJson, milesBetween, utcFromLocal, DEFAULT_TZ } from './lib.mjs';

const PAGE_SIZE = 100;
const ENDPOINT = 'https://app.ticketmaster.com/discovery/v2/events.json';

// Discovery's own segments, in words a person reading a leasing site would use.
const SEGMENTS = {
  Music: 'Music',
  Sports: 'Sports',
  'Arts & Theatre': 'Arts & theatre',
  Film: 'Film',
  Miscellaneous: 'Community',
};

/** Widest landscape image that isn't enormous. */
function pickImage(images) {
  const usable = (images ?? [])
    .filter((i) => i?.url && i.width && i.height && i.width / i.height > 1.3 && i.width <= 1200)
    .sort((a, b) => b.width - a.width);
  return usable[0]?.url ?? null;
}

/** Discovery splits the date and the time, and marks TBA/TBD explicitly. */
function startOf(ev) {
  const d = ev?.dates?.start;
  if (!d?.localDate) return null;
  if (d.dateTBA || d.dateTBD) return null;
  if (ev?.dates?.status?.code === 'cancelled') return null;
  if (d.dateTime) return { start: d.dateTime, allDay: false };
  const zone = ev?.dates?.timezone || ev?._embedded?.venues?.[0]?.timezone || DEFAULT_TZ;
  const allDay = !!d.timeTBA || !d.localTime;
  const wall = allDay ? '00:00:00' : d.localTime;
  const start = utcFromLocal(zone, d.localDate, wall) ?? utcFromLocal(DEFAULT_TZ, d.localDate, wall);
  return start ? { start, allDay } : null;
}

export const id = 'ticketmaster';
export const label = 'Ticketmaster';
export const keyEnv = 'TICKETMASTER_API_KEY';

export async function fetchEvents({ home, radiusMiles, days, log }) {
  const key = process.env[keyEnv];
  if (!key) return { skipped: `${keyEnv} is not set`, events: [] };

  const now = new Date();
  const end = new Date(now.getTime() + days * 864e5);
  const iso = (d) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const raw = [];

  for (let page = 0; page < 2; page++) {
    const url = new URL(ENDPOINT);
    url.searchParams.set('apikey', key);
    // `latlong` is deprecated in the reference; geoPoint takes a geohash.
    url.searchParams.set('geoPoint', geohash(home.lat, home.lng));
    url.searchParams.set('radius', String(Math.ceil(radiusMiles)));
    url.searchParams.set('unit', 'miles');
    url.searchParams.set('countryCode', 'US');
    url.searchParams.set('startDateTime', iso(now));
    url.searchParams.set('endDateTime', iso(end));
    // Defaults once a date range is sent, but a page that prints a date cannot
    // carry an event whose date is a question mark.
    url.searchParams.set('includeTBA', 'no');
    url.searchParams.set('includeTBD', 'no');
    url.searchParams.set('includeTest', 'no');
    url.searchParams.set('size', String(PAGE_SIZE));
    url.searchParams.set('page', String(page));
    url.searchParams.set('sort', 'date,asc');

    if (page === 0) log(`GET ${String(url).replace(/apikey=[^&]*/, 'apikey=…')}`);
    const body = await getJson(url);
    const batch = body?._embedded?.events ?? [];
    raw.push(...batch);
    const totalPages = body?.page?.totalPages ?? 1;
    if (batch.length < PAGE_SIZE || page + 1 >= totalPages) break;
  }

  return { events: normalise(raw, { home, radiusMiles }) };
}

export function normalise(raw, { home, radiusMiles }) {
  const events = [];
  for (const ev of raw) {
    if (ev?.test === true) continue;
    const when = startOf(ev);
    if (!when) continue;
    const v = ev?._embedded?.venues?.[0];
    const lat = Number(v?.location?.latitude);
    const lng = Number(v?.location?.longitude);
    const hasGeo = Number.isFinite(lat) && Number.isFinite(lng);
    // Discovery's radius is generous at the edge; hold it to the circle asked
    // for so "near the building" stays true.
    if (hasGeo && milesBetween(home.lat, home.lng, lat, lng) > radiusMiles + 0.25) continue;

    const seg = ev?.classifications?.[0]?.segment?.name;
    const prices = (ev?.priceRanges ?? []).map((p) => Number(p.min)).filter((n) => Number.isFinite(n) && n > 0);

    events.push({
      id: `tm-${ev.id}`,
      title: String(ev.name || '').trim(),
      start: when.start,
      end: ev?.dates?.end?.dateTime ?? null,
      allDay: when.allDay,
      venue: {
        name: v?.name ? String(v.name).trim() : 'Venue to be announced',
        address: v?.address?.line1 ? String(v.address.line1).trim() : null,
        lat: hasGeo ? Number(lat.toFixed(6)) : null,
        lng: hasGeo ? Number(lng.toFixed(6)) : null,
      },
      category: seg ? (SEGMENTS[seg] ?? seg) : null,
      url: ev?.url ?? null,
      image: pickImage(ev?.images),
      priceFrom: prices.length ? Math.min(...prices) : null,
      source: id,
    });
  }
  return events;
}

/** Offline path: a saved Discovery response. */
export function fromSaved(body) {
  return body?._embedded?.events ?? [];
}
