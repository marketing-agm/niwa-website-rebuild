// Visit Seattle — the neighbourhood's cultural calendar.
//
// Their site publishes a custom REST endpoint, /wp-json/visitseattle/v1/events,
// and every record carries a `region`. One of those regions is, exactly,
// "Queen Anne / Seattle Center" — the building's own. That is what this source
// filters to, and it is why the source is worth having: it carries the Festal
// festivals at Seattle Center, MoPOP and the theatres, none of which
// Ticketmaster sells and none of which the arena feed knows about.
//
// No key. The records give dates but no coordinates, so these listings appear
// on the page and not on the map, which the map note says out loud.
import { getJson, plain, utcFromLocal, DEFAULT_TZ } from './lib.mjs';

const ENDPOINT = 'https://visitseattle.org/wp-json/visitseattle/v1/events';

// Longer than this and it is an attraction, not an event. The line is drawn at
// three months because that is where the two kinds actually separate: a
// touring exhibition or a theatre season runs weeks, the permanent galleries
// run years — "Nirvana: Taking Punk To the Masses" has been up since 2011. Six
// weeks was the first attempt and it threw out a two-month play with them.
const RUN_LIMIT_DAYS = 90;

// The region the building is in, as Visit Seattle spells it.
const REGION = /queen\s*anne|seattle\s*center/i;

// Their taxonomy is Live / Hybrid / Virtual, which is a delivery format rather
// than a kind of evening, so the category is read off the title where the feed
// carries no better word.
const HINTS = [
  [/festival|festal|parade|fair\b/i, 'Festivals'],
  [/market/i, 'Market'],
  [/museum|exhibit|gallery|art\b|sculpture/i, 'Museums & galleries'],
  [/theatre|theater|play\b|musical|opera|ballet|dance/i, 'Arts & theatre'],
  [/concert|music|band|symphony|jazz/i, 'Music'],
  [/tour\b|walk\b/i, 'Tours'],
  [/game|match|marathon|run\b/i, 'Sports'],
  [/film|cinema|screening/i, 'Film'],
];

function categorise(ev) {
  for (const key of ['event_categories', 'events_categories', 'categories']) {
    const named = (ev?.[key] ?? []).map?.((c) => plain(c?.name ?? c)).filter(Boolean);
    if (named?.length) return named[0];
  }
  const hay = `${plain(ev?.title)} ${plain(ev?.description)}`;
  for (const [re, label] of HINTS) if (re.test(hay)) return label;
  return 'Community';
}

const inRegion = (ev) => {
  if (REGION.test(String(ev?.region ?? ''))) return true;
  return (ev?.event_regions ?? []).some?.((r) => REGION.test(String(r?.name ?? r?.slug ?? '')));
};

export const id = 'visit-seattle';
export const label = 'Visit Seattle';

export async function fetchEvents({ home, radiusMiles, days, log }) {
  log(`GET ${ENDPOINT}`);
  const body = await getJson(ENDPOINT);
  const raw = Array.isArray(body) ? body : (body?.events ?? body?.data ?? []);
  log(`${raw.length} record(s) before filtering`);
  return { events: normalise(raw, { home, radiusMiles, days }) };
}

export function normalise(raw, { days = 30 } = {}) {
  const today = new Date();
  const day0 = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const cutoff = new Date(day0.getTime() + days * 864e5);

  const events = [];
  const seen = new Set();
  for (const ev of raw) {
    if (!inRegion(ev)) continue;
    const title = plain(ev?.title);
    const startDay = String(ev?.start_date ?? '').slice(0, 10);
    if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(startDay)) continue;

    const endDay = /^\d{4}-\d{2}-\d{2}$/.test(String(ev?.end_date ?? '').slice(0, 10))
      ? String(ev.end_date).slice(0, 10) : null;
    const startMs = Date.parse(`${startDay}T00:00:00Z`);
    const endMs = endDay ? Date.parse(`${endDay}T00:00:00Z`) : startMs;
    if (endMs < day0.getTime()) continue;
    if (startMs > cutoff.getTime()) continue;

    // Most of what this feed carries is not an event. "Guitar Gallery",
    // "Chihuly Garden and Glass", "Nirvana: Taking Punk To the Masses" — these
    // are standing exhibitions with a run measured in years, and the first run
    // put fourteen of them on today's date in a row, burying the two festivals
    // that were actually on. A page called What's on is about things that
    // start; the museums themselves are already on the neighbourhood section.
    if ((endMs - startMs) / 864e5 > RUN_LIMIT_DAYS) continue;

    // A limited run already under way is clamped to today, so it lists once, on
    // a day someone could go, rather than at a start date in the past.
    const showDay = startMs < day0.getTime() ? day0.toISOString().slice(0, 10) : startDay;

    const key = `${title.toLowerCase()}|${showDay}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // Dates only, no clock — so these are all-day, resolved in Seattle's zone
    // rather than the runner's.
    const start = utcFromLocal(DEFAULT_TZ, showDay, '00:00:00');
    if (!start) continue;

    events.push({
      id: `vs-${ev?.event_id ?? title.toLowerCase().replace(/\W+/g, '-').slice(0, 40)}`,
      title,
      start,
      end: endDay && endDay !== showDay ? utcFromLocal(DEFAULT_TZ, endDay, '00:00:00') : null,
      allDay: true,
      venue: {
        name: plain(ev?.venue) || plain(ev?.event_venues?.[0]?.name) || 'Seattle Center',
        address: plain(ev?.address) || null,
        // The feed carries no coordinates, so no pin — and the page says so
        // rather than inventing one.
        lat: null,
        lng: null,
      },
      category: categorise(ev),
      url: typeof ev?.website_url === 'string' && /^https?:/.test(ev.website_url) ? ev.website_url : null,
      image: null,
      priceFrom: null,
      source: id,
    });
  }
  return events;
}

export function fromSaved(body) {
  return Array.isArray(body) ? body : (body?.events ?? body?.data ?? []);
}

export const probeUrls = [ENDPOINT];
