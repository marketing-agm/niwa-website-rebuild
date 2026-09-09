// Refresh src/site/events.json from the Ticketmaster Discovery API.
//
// The events page is only as good as this file, and this file is only ever
// written by this script — nothing on that page is typed by hand, because a
// leasing site inventing an event is worse than a leasing site with no events
// page at all.
//
// Source: Ticketmaster Discovery API. It is free, it needs one key, and it is
// the only feed that covers the venues this building actually sits between —
// Climate Pledge Arena is at the end of the block, and Seattle Center's halls,
// the Paramount, the Neptune, the Moore and the Crocodile are all inside a
// three-mile circle. It returns a venue latitude and longitude with every
// event, which is what the map is plotted from.
//
// Deterministic for a given response: same input, same output, so it is safe on
// a schedule and a no-op diff means nothing changed.
//
// Usage:
//   TICKETMASTER_API_KEY=… npm run events
//   npm run events -- --dry-run                        # report only, no write
//   npm run events -- --source-file /tmp/tm.json       # offline, from a saved response
//   npm run events -- --radius 5 --days 45             # widen the net
//
// A free key: https://developer-acct.ticketmaster.com/user/register

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const configPath = join(root, 'src/site/site.config.json');
const eventsPath = join(root, 'src/site/events.json');

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};
const dryRun = args.includes('--dry-run');
const sourceFile = arg('source-file', null);

const config = JSON.parse(readFileSync(configPath, 'utf8'));
const HOME = { lat: Number(config.geo?.latitude), lng: Number(config.geo?.longitude) };
if (!Number.isFinite(HOME.lat) || !Number.isFinite(HOME.lng)) {
  throw new Error('[events] src/site/site.config.json has no geo.latitude / geo.longitude to search around');
}

const RADIUS = Number(arg('radius', 3));      // miles
const DAYS = Number(arg('days', 30));         // how far ahead to look
const MAX = Number(arg('max', 60));           // how many to keep
const PAGE_SIZE = 100;                        // Discovery API's cap per page

// ---- fetch ----------------------------------------------------------------
const iso = (d) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');

async function fetchPages(key) {
  const start = new Date();
  const end = new Date(start.getTime() + DAYS * 864e5);
  const out = [];
  // Two pages is 200 events before filtering, which has always been more than a
  // three-mile circle produces in a month. The loop stops early when it can.
  for (let page = 0; page < 2; page++) {
    const url = new URL('https://app.ticketmaster.com/discovery/v2/events.json');
    url.searchParams.set('apikey', key);
    url.searchParams.set('latlong', `${HOME.lat},${HOME.lng}`);
    url.searchParams.set('radius', String(Math.ceil(RADIUS)));
    url.searchParams.set('unit', 'miles');
    url.searchParams.set('startDateTime', iso(start));
    url.searchParams.set('endDateTime', iso(end));
    url.searchParams.set('size', String(PAGE_SIZE));
    url.searchParams.set('page', String(page));
    url.searchParams.set('sort', 'date,asc');

    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`[events] Ticketmaster returned ${res.status} ${res.statusText}`);
    const body = await res.json();
    const batch = body?._embedded?.events ?? [];
    out.push(...batch);
    const totalPages = body?.page?.totalPages ?? 1;
    if (batch.length < PAGE_SIZE || page + 1 >= totalPages) break;
  }
  return out;
}

// ---- normalise -------------------------------------------------------------
const R_MILES = 3958.7613;
const rad = (d) => (d * Math.PI) / 180;
const milesBetween = (aLat, aLng, bLat, bLng) => {
  const dLat = rad(bLat - aLat), dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
};

// The API's own segments, mapped to words a person reading a leasing site would
// use. Anything unrecognised keeps the segment name rather than being dropped.
const SEGMENTS = {
  Music: 'Music',
  Sports: 'Sports',
  'Arts & Theatre': 'Arts & theatre',
  Film: 'Film',
  Miscellaneous: 'Other',
};

/** Widest image that is landscape and not enormous. Null if none qualifies. */
function pickImage(images) {
  const usable = (images ?? [])
    .filter((i) => i?.url && i.width && i.height && i.width / i.height > 1.3 && i.width <= 1200)
    .sort((a, b) => b.width - a.width);
  return usable[0]?.url ?? null;
}

/** Ticketmaster splits the date and the time, and marks TBA/TBD explicitly. */
function startOf(ev) {
  const d = ev?.dates?.start;
  if (!d?.localDate) return null;
  if (d.dateTBA || d.dateTBD) return null;
  if (ev?.dates?.status?.code === 'cancelled') return null;
  // dateTime is already UTC with a Z; localTime is the venue's wall clock.
  if (d.dateTime) return { start: d.dateTime, allDay: false };
  if (d.timeTBA || !d.localTime) return { start: `${d.localDate}T00:00:00`, allDay: true };
  return { start: `${d.localDate}T${d.localTime}`, allDay: false };
}

function normalise(raw) {
  const seen = new Set();
  const out = [];
  for (const ev of raw) {
    const when = startOf(ev);
    if (!when) continue;
    const v = ev?._embedded?.venues?.[0];
    const lat = Number(v?.location?.latitude);
    const lng = Number(v?.location?.longitude);
    const hasGeo = Number.isFinite(lat) && Number.isFinite(lng);
    // The API's radius is generous at the edge; hold it to the circle we asked
    // for so "near the building" stays true.
    if (hasGeo && milesBetween(HOME.lat, HOME.lng, lat, lng) > RADIUS + 0.25) continue;

    // One entry per show. A run of the same production on the same night at the
    // same room comes back more than once when tickets are sold in tiers.
    const key = `${ev.name}|${when.start}|${v?.name ?? ''}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const seg = ev?.classifications?.[0]?.segment?.name;
    const prices = (ev?.priceRanges ?? []).map((p) => Number(p.min)).filter((n) => Number.isFinite(n) && n > 0);

    out.push({
      id: String(ev.id),
      title: String(ev.name).trim(),
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
    });
  }
  // Sorted by start, then trimmed — a month of one venue's season should not
  // crowd out everything else, so no single venue takes more than a fifth.
  out.sort((a, b) => Date.parse(a.start) - Date.parse(b.start) || a.title.localeCompare(b.title));
  const cap = Math.max(3, Math.ceil(MAX / 5));
  const perVenue = new Map();
  const kept = [];
  for (const e of out) {
    const n = perVenue.get(e.venue.name) ?? 0;
    if (n >= cap) continue;
    perVenue.set(e.venue.name, n + 1);
    kept.push(e);
    if (kept.length >= MAX) break;
  }
  return kept;
}

// ---- run -------------------------------------------------------------------
const key = process.env.TICKETMASTER_API_KEY;
let raw;
if (sourceFile) {
  const body = JSON.parse(readFileSync(sourceFile, 'utf8'));
  raw = body?._embedded?.events ?? (Array.isArray(body) ? body : []);
  console.log(`[events] reading ${raw.length} event(s) from ${sourceFile}`);
} else {
  if (!key) {
    console.error('[events] TICKETMASTER_API_KEY is not set.');
    console.error('[events] Get a free key at https://developer-acct.ticketmaster.com/user/register');
    console.error('[events] and add it to the repository as a secret named TICKETMASTER_API_KEY.');
    process.exit(78); // EX_CONFIG — "not configured", not "broken"
  }
  raw = await fetchPages(key);
  console.log(`[events] fetched ${raw.length} event(s) within ${RADIUS} miles over the next ${DAYS} days`);
}

const events = normalise(raw);

const before = JSON.parse(readFileSync(eventsPath, 'utf8'));
const beforeIds = new Set((before.events ?? []).map((e) => e.id));
const afterIds = new Set(events.map((e) => e.id));
const added = events.filter((e) => !beforeIds.has(e.id));
const gone = (before.events ?? []).filter((e) => !afterIds.has(e.id));

console.log(`[events] ${events.length} kept — ${added.length} new, ${gone.length} dropped`);
for (const e of added.slice(0, 10)) console.log(`  + ${e.start.slice(0, 10)}  ${e.title} — ${e.venue.name}`);
if (added.length > 10) console.log(`  + …and ${added.length - 10} more`);

// `updated` only moves when the events themselves do, so a week with no change
// produces no diff and no deploy.
const sameEvents = JSON.stringify(before.events ?? []) === JSON.stringify(events);
const next = {
  updated: sameEvents ? (before.updated ?? new Date().toISOString()) : new Date().toISOString(),
  source: 'Ticketmaster Discovery API',
  window: { days: DAYS, radiusMiles: RADIUS },
  events,
};

if (dryRun) {
  console.log('[events] --dry-run: nothing written');
} else if (sameEvents && before.window?.days === DAYS && before.window?.radiusMiles === RADIUS) {
  console.log('[events] no change');
} else {
  writeFileSync(eventsPath, JSON.stringify(next, null, 2) + '\n');
  console.log(`[events] wrote ${eventsPath}`);
}
