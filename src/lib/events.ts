// What's on near the building, resolved at build time.
//
// events.json is machine-written: scripts/refresh-events.mjs replaces it from a
// live feed on a schedule (see .github/workflows/events.yml), so nothing in
// here is hand-maintained and nothing in here is invented. An empty file is a
// valid state — the page says so rather than filling the space.
import eventsJson from '../site/events.json';
import config from '../site/site.config.json';

export type RawEvent = {
  id: string;
  title: string;
  /** ISO 8601 with offset. */
  start: string;
  end?: string | null;
  allDay?: boolean;
  venue: { name: string; address?: string | null; lat?: number | null; lng?: number | null };
  category?: string | null;
  url?: string | null;
  image?: string | null;
  priceFrom?: number | null;
  note?: string | null;
};

export type SiteEvent = RawEvent & {
  /** Miles from the building, great-circle. Null when the feed has no location. */
  miles: number | null;
  /** Minutes on foot at 3 mph, rounded to 5. Null when miles is null. */
  walkMinutes: number | null;
  /** Position on the plotted map, in miles east and north of the building. */
  east: number | null;
  north: number | null;
  day: string;        // 2026-09-12
  dayLabel: string;   // Saturday, September 12
  shortDay: string;   // Sat
  dayNum: string;     // 12
  monthAbbr: string;  // Sep
  timeLabel: string;  // 7:30 PM  ·  '' when all-day
};

const HOME = {
  lat: Number(config.geo?.latitude),
  lng: Number(config.geo?.longitude),
};

const R_MILES = 3958.7613;
const rad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in miles. */
export function milesBetween(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Equirectangular offsets, in miles. Over the three or four miles this map
// covers the distortion is smaller than the pin, and it keeps north up and the
// spacing honest — which a slippy-map tile layer would also do, at the cost of
// a third-party key, a tile bill and a cookie banner.
const MI_PER_DEG_LAT = 69.0547;
const eastNorth = (lat: number, lng: number) => ({
  east: (lng - HOME.lng) * MI_PER_DEG_LAT * Math.cos(rad(HOME.lat)),
  north: (lat - HOME.lat) * MI_PER_DEG_LAT,
});

// The feed carries an offset on every timestamp, so the wall-clock time is the
// venue's own. Formatting in the venue's zone rather than the build machine's
// keeps a 7:30 PM show at 7:30 PM whoever runs the build.
const TZ = 'America/Los_Angeles';
const fmt = (v: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-US', { timeZone: TZ, ...opts }).format(new Date(v));

/** YYYY-MM-DD in the venue's zone, so grouping by day matches the printed date. */
export function localDay(iso: string): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date(iso));
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function decorate(e: RawEvent): SiteEvent {
  const hasGeo = Number.isFinite(Number(e.venue?.lat)) && Number.isFinite(Number(e.venue?.lng));
  const miles = hasGeo ? milesBetween(HOME.lat, HOME.lng, Number(e.venue.lat), Number(e.venue.lng)) : null;
  const en = hasGeo ? eastNorth(Number(e.venue.lat), Number(e.venue.lng)) : null;
  return {
    ...e,
    miles,
    walkMinutes: miles == null ? null : Math.max(5, Math.round((miles / 3) * 60 / 5) * 5),
    east: en?.east ?? null,
    north: en?.north ?? null,
    day: localDay(e.start),
    dayLabel: fmt(e.start, { weekday: 'long', month: 'long', day: 'numeric' }),
    shortDay: fmt(e.start, { weekday: 'short' }),
    dayNum: fmt(e.start, { day: 'numeric' }),
    monthAbbr: fmt(e.start, { month: 'short' }),
    timeLabel: e.allDay ? '' : fmt(e.start, { hour: 'numeric', minute: '2-digit' }),
  };
}

export type EventsFeed = {
  updated: string | null;
  source: string | null;
  window: { days: number; radiusMiles: number };
  events: SiteEvent[];
  categories: string[];
  /** Farthest event, in miles — what the map has to fit. */
  maxMiles: number;
};

export function getEvents(): EventsFeed {
  const feed = eventsJson as any;
  const raw: RawEvent[] = Array.isArray(feed.events) ? feed.events : [];
  const events = raw
    .filter((e) => e && e.title && e.start && !Number.isNaN(Date.parse(e.start)))
    .map(decorate)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const categories = [...new Set(events.map((e) => e.category).filter(Boolean) as string[])].sort();
  const maxMiles = events.reduce((m, e) => Math.max(m, e.miles ?? 0), 0);
  return {
    updated: feed.updated ?? null,
    source: feed.source ?? null,
    window: feed.window ?? { days: 30, radiusMiles: 3 },
    events,
    categories,
    maxMiles,
  };
}

/** Events in start order, grouped into the days they fall on. */
export function byDay(events: SiteEvent[]): Array<{ day: string; label: string; events: SiteEvent[] }> {
  const out: Array<{ day: string; label: string; events: SiteEvent[] }> = [];
  for (const e of events) {
    const last = out[out.length - 1];
    if (last && last.day === e.day) last.events.push(e);
    else out.push({ day: e.day, label: e.dayLabel, events: [e] });
  }
  return out;
}
