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
  /** Which calendar this came from — see scripts/sources/. */
  source?: string | null;
};

export type SiteEvent = RawEvent & {
  /** Miles from the building, great-circle. Null when the feed has no location. */
  miles: number | null;
  /** Minutes on foot at 3 mph, rounded to 5. Null when miles is null. */
  walkMinutes: number | null;
  /** Position on the plotted map, in miles east and north of the building. */
  east: number | null;
  north: number | null;
  /** The day the page shows it on: its start, or today if the run is already under way. */
  day: string;        // 2026-09-12
  dayLabel: string;   // Saturday, September 12
  shortDay: string;   // Sat
  dayNum: string;     // 12
  monthAbbr: string;  // Sep
  timeLabel: string;  // 7:30 PM  ·  '' when all-day
  /** First local day of the run — what the feed said, unclamped. */
  startDay: string;
  /** Last local day of the run. Same as startDay unless the feed gives a later end. */
  lastDay: string;
  /** Began before today and has not finished. */
  ongoing: boolean;
  /** 'Sep 26' when the run spans more than one day, else ''. */
  untilLabel: string;
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

// Noon UTC lands on the same calendar day in Seattle whether the city is on
// PDT or PST, so a bare YYYY-MM-DD can be handed back to the formatter without
// sliding into the day before.
const atNoon = (day: string) => `${day}T12:00:00Z`;

/** YYYY-MM-DD in the venue's zone, so grouping by day matches the printed date. */
export function localDay(iso: string): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date(iso));
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

// Number(null) is 0, not NaN, so a feed that gives no coordinates would place
// the event at 0°N 0°E — the Gulf of Guinea, 7,679 miles from Queen Anne, with
// a pin to match. A missing coordinate has to read as missing.
const coord = (v: unknown) => (v === null || v === undefined || v === '' ? NaN : Number(v));

// Today in Seattle, not on the build machine. A build that runs at 01:00 UTC is
// still on the previous evening here, and that evening's events have not
// happened yet.
const TODAY = localDay(new Date().toISOString());

function decorate(e: RawEvent): SiteEvent {
  const lat = coord(e.venue?.lat);
  const lng = coord(e.venue?.lng);
  // 0,0 is the other way a feed says "I don't know": a real venue is never there.
  const hasGeo = Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
  const miles = hasGeo ? milesBetween(HOME.lat, HOME.lng, lat, lng) : null;
  const en = hasGeo ? eastNorth(lat, lng) : null;
  const startDay = localDay(e.start);
  // A feed that gives no end, or an end that parses to nothing, is a single day.
  const lastDay = e.end && !Number.isNaN(Date.parse(e.end)) ? localDay(e.end) : startDay;
  // A run already under way is on today, and today is the date to print: a
  // fortnight-long installation labelled with the Friday it opened reads as an
  // event that has been and gone. The record keeps its real start either way —
  // only the date the page shows is moved.
  const ongoing = startDay < TODAY && lastDay >= TODAY;
  const onDay = ongoing ? TODAY : startDay;
  const shown = atNoon(onDay);
  return {
    ...e,
    miles,
    walkMinutes: miles == null ? null : Math.max(5, Math.round((miles / 3) * 60 / 5) * 5),
    east: en?.east ?? null,
    north: en?.north ?? null,
    day: onDay,
    dayLabel: fmt(shown, { weekday: 'long', month: 'long', day: 'numeric' }),
    shortDay: fmt(shown, { weekday: 'short' }),
    dayNum: fmt(shown, { day: 'numeric' }),
    monthAbbr: fmt(shown, { month: 'short' }),
    timeLabel: e.allDay ? '' : fmt(e.start, { hour: 'numeric', minute: '2-digit' }),
    startDay,
    lastDay,
    ongoing,
    // Only worth saying when there is more than one day to it. Without this a
    // run shows a single date and reads as a one-off you have already missed
    // the start of.
    untilLabel: lastDay > startDay ? fmt(atNoon(lastDay), { month: 'short', day: 'numeric' }) : '',
  };
}

export type EventsFeed = {
  updated: string | null;
  /** The calendars that contributed, for the credit line. */
  sources: string[];
  window: { days: number; radiusMiles: number };
  events: SiteEvent[];
  categories: string[];
  /** Farthest event, in miles — what the map has to fit. */
  maxMiles: number;
  /** Events the feed gave no coordinates for, so they carry no pin. */
  unpinned: number;
};

export function getEvents(): EventsFeed {
  const feed = eventsJson as any;
  const raw: RawEvent[] = Array.isArray(feed.events) ? feed.events : [];
  const events = raw
    .filter((e) => e && e.title && e.start && !Number.isNaN(Date.parse(e.start)))
    .map(decorate)
    // The feed is a snapshot, so by the end of its week most of what is in it
    // has happened. Anything finished comes out here rather than on the page —
    // which also keeps the Event records in the page's JSON-LD to things a
    // search engine can still send someone to.
    .filter((e) => e.lastDay >= TODAY)
    // By the day it is shown on, so a run under way sorts into today rather
    // than back at the date it opened.
    .sort((a, b) => a.day.localeCompare(b.day) || Date.parse(a.start) - Date.parse(b.start));
  const categories = [...new Set(events.map((e) => e.category).filter(Boolean) as string[])].sort();
  const maxMiles = events.reduce((m, e) => Math.max(m, e.miles ?? 0), 0);
  return {
    updated: feed.updated ?? null,
    sources: Array.isArray(feed.sources) ? feed.sources : (feed.source ? [feed.source] : []),
    window: feed.window ?? { days: 30, radiusMiles: 3 },
    events,
    categories,
    maxMiles,
    unpinned: events.filter((e) => e.miles == null).length,
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
