// Refresh src/site/events.json from every configured events source.
//
// The events page is only as good as this file, and this file is only ever
// written by this script — nothing on that page is typed by hand, because a
// leasing site inventing an event is worse than a leasing site with no events
// page at all.
//
// Sources live in scripts/sources/ and each returns records in one shape:
//
//   ticketmaster         the ticketed rooms — Climate Pledge Arena, Seattle
//                        Center's halls, the Paramount, the Moore, the
//                        Crocodile. Needs a free key. Carries coordinates,
//                        which is what the map is plotted from.
//   visit-seattle        the neighbourhood's cultural calendar, filtered to
//                        their own "Queen Anne / Seattle Center" region — the
//                        Festal festivals, the museums, the theatres. No key.
//                        This is the half that makes the page about Queen Anne
//                        rather than about arenas. No coordinates, so these
//                        list on the page and not on the map.
//   queen-anne-chamber    the best listings there are, and unreachable: see
//                        the note at the top of that file.
//
// A source that fails or is unconfigured is reported and skipped; the others
// still run. Deterministic for a given response, so it is safe on a schedule
// and a no-op diff means nothing changed.
//
// Usage:
//   npm run events                                   # every source
//   npm run events -- --dry-run                      # report only, no write
//   npm run events -- --only queen-anne-chamber      # one source
//   npm run events -- --source-file f.json --source ticketmaster
//   npm run events -- --fixtures test/fixtures        # all sources, offline
//   npm run events -- --radius 5 --days 45           # widen the net
//   npm run events -- --probe                        # what is each site serving?

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as ticketmaster from './sources/ticketmaster.mjs';
import * as queenAnneChamber from './sources/queen-anne-chamber.mjs';
import * as visitSeattle from './sources/visit-seattle.mjs';
import * as seattleGov from './sources/seattle-gov.mjs';

const SOURCES = [visitSeattle, seattleGov, queenAnneChamber, ticketmaster];

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const configPath = join(root, 'src/site/site.config.json');
const eventsPath = join(root, 'src/site/events.json');

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};
const dryRun = args.includes('--dry-run');
const probe = args.includes('--probe');
const only = arg('only', null);
const sourceFile = arg('source-file', null);
const sourceFileFor = arg('source', null);
// A directory of saved responses named <source-id>.json. The offline way to
// exercise the merge across sources, which one --source-file cannot do.
const fixtures = arg('fixtures', null);

const config = JSON.parse(readFileSync(configPath, 'utf8'));
const home = { lat: Number(config.geo?.latitude), lng: Number(config.geo?.longitude) };
if (!Number.isFinite(home.lat) || !Number.isFinite(home.lng)) {
  throw new Error('[events] src/site/site.config.json has no geo.latitude / geo.longitude to search around');
}

const radiusMiles = Number(arg('radius', 3));
const days = Number(arg('days', 30));
const MAX = Number(arg('max', 60));

// ---- probe -----------------------------------------------------------------
// Two of the three calendars worth having publish a documented JSON endpoint.
// The third — Visit Seattle — has a filterable events index but no API this
// script can rely on sight unseen, so rather than guess at one, `--probe`
// asks all of them what they actually serve and prints the answers.
const PROBE = {
  'queen-anne-chamber': { base: 'https://www.queenannechamber.org', extra: queenAnneChamber.probeUrls },
  'visit-seattle': { base: 'https://visitseattle.org', extra: visitSeattle.probeUrls },
  'seattle-gov': { base: 'https://www.trumba.com', extra: seattleGov.probeUrls },
};

const grab = async (url, accept = 'application/json') => {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 15000);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { accept } });
    return { ok: res.ok, status: res.status, type: (res.headers.get('content-type') || '').split(';')[0], text: await res.text() };
  } catch (err) {
    return { ok: false, status: 0, type: '-', text: '', error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(t);
  }
};

// Guessing endpoint paths is a waste of a round trip when WordPress will simply
// say what it has: /wp-json/ lists the REST namespaces a site has switched on,
// and /wp-json/wp/v2/types names every post type and the path it answers on.
// Between them there is no guessing left to do.
async function discover(name, base) {
  const root = await grab(`${base}/wp-json/`);
  if (root.ok) {
    try {
      const ns = JSON.parse(root.text)?.namespaces ?? [];
      console.log(`  namespaces: ${ns.length ? ns.join(', ') : '(none)'}`);
    } catch {
      console.log(`  /wp-json/ answered ${root.status} ${root.type}, but not with JSON`);
    }
  } else {
    console.log(`  /wp-json/ → ${root.status || root.error} — the REST API looks switched off`);
  }

  // A namespace is a plugin's front door. Listing its routes says exactly what
  // that plugin will answer, which beats guessing at paths under it.
  if (root.ok) {
    let ns = [];
    try { ns = JSON.parse(root.text)?.namespaces ?? []; } catch { /* handled above */ }
    for (const one of ns.filter((n) => /event|mec|calendar|tribe|visitseattle|spc|visitwidget/i.test(n))) {
      const r = await grab(`${base}/wp-json/${one}`);
      if (!r.ok) { console.log(`  ${one} → ${r.status || r.error}`); continue; }
      try {
        const routes = Object.keys(JSON.parse(r.text)?.routes ?? {}).filter((x) => x !== `/${one}`);
        console.log(`  ${one} routes: ${routes.length ? routes.join(', ') : '(none)'}`);
      } catch {
        console.log(`  ${one} answered ${r.status} ${r.type}, but not with JSON`);
      }
    }
  }

  const types = await grab(`${base}/wp-json/wp/v2/types`);
  if (types.ok) {
    try {
      const t = JSON.parse(types.text);
      const rows = Object.entries(t).map(([slug, v]) => ({ slug, name: v?.name, rest: v?.rest_base, ns: v?.rest_namespace }));
      const interesting = rows.filter((r) => /event|calendar|thing|attraction/i.test(`${r.slug} ${r.name} ${r.rest}`));
      console.log(`  post types: ${rows.map((r) => r.slug).join(', ')}`);
      for (const r of (interesting.length ? interesting : [])) {
        console.log(`    → ${r.slug}: rest_base="${r.rest}" namespace="${r.ns ?? 'wp/v2'}"  ${base}/wp-json/${r.ns ?? 'wp/v2'}/${r.rest}`);
      }
      // And actually call the ones that look like events.
      for (const r of interesting) {
        const url = `${base}/wp-json/${r.ns ?? 'wp/v2'}/${r.rest}?per_page=1`;
        const hit = await grab(url);
        console.log(`    ${String(hit.status).padEnd(4)} ${hit.type.padEnd(20)} ${url}`);
        if (hit.ok) {
          try {
            const first = JSON.parse(hit.text)?.[0] ?? JSON.parse(hit.text);
            console.log(`         fields: ${Object.keys(first).join(', ')}`);
            if (first?.meta && typeof first.meta === 'object') {
              const m = Object.keys(first.meta);
              console.log(`         meta: ${m.length ? m.join(', ') : '(empty — dates are not exposed here)'}`);
            }
            // Whatever carries the date is the field this whole thing turns on.
            for (const k of Object.keys(first)) {
              if (/date|time|start|end/i.test(k)) console.log(`         ${k} = ${JSON.stringify(first[k]).slice(0, 120)}`);
            }
          } catch {
            console.log(`         ${hit.text.slice(0, 200).replace(/\s+/g, ' ')}`);
          }
        }
      }
    } catch {
      console.log('  /wp-json/wp/v2/types did not parse');
    }
  } else {
    console.log(`  /wp-json/wp/v2/types → ${types.status || types.error}`);
  }
}

async function runProbe() {
  for (const [name, { base, extra }] of Object.entries(PROBE)) {
    console.log(`\n=== ${name}  (${base})`);
    await discover(name, base);
    console.log('  other candidates:');
    for (const url of extra) {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 15000);
      try {
        const res = await fetch(url, { signal: ctl.signal, headers: { accept: 'application/json, text/calendar, application/rss+xml, */*' } });
        const type = (res.headers.get('content-type') || '').split(';')[0];
        const text = await res.text();
        let shape = '';
        if (type.includes('json')) {
          try {
            const j = JSON.parse(text);
            const first = Array.isArray(j) ? j[0]
              : (Array.isArray(j?.events) ? j.events[0]
              : (Array.isArray(j?.data) ? j.data[0] : j));
            shape = `\n${JSON.stringify(first, null, 1).slice(0, 1600)}`;
          } catch { shape = ` starts: ${text.slice(0, 120).replace(/\s+/g, ' ')}`; }
        } else {
          shape = ` starts: ${text.slice(0, 120).replace(/\s+/g, ' ')}`;
        }
        console.log(`    ${String(res.status).padEnd(4)} ${type.padEnd(26)} ${url}`);
        if (res.ok) console.log(`         ${shape.trim()}`);
      } catch (err) {
        console.log(`    ERR  ${'-'.padEnd(26)} ${url}`);
        console.log(`         ${err instanceof Error ? err.message : err}`);
      } finally {
        clearTimeout(t);
      }
    }
  }
  console.log('\nAn endpoint that answers 200 with JSON can be wired up as a source in scripts/sources/.');
}

// ---- merge -----------------------------------------------------------------
const localDay = (iso) => {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date(iso));
  const get = (t) => p.find((x) => x.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
};

// The same festival can appear in two calendars. Match on the title and the
// day, and keep the fuller record — the one that can be pinned on the map and
// priced beats the one that cannot.
const dedupeKey = (e) => `${e.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()}|${localDay(e.start)}`;
const richness = (e) => (e.venue?.lat != null ? 4 : 0) + (e.url ? 2 : 0) + (e.priceFrom != null ? 1 : 0);

function merge(all) {
  const best = new Map();
  for (const e of all) {
    const k = dedupeKey(e);
    const prev = best.get(k);
    if (!prev || richness(e) > richness(prev)) best.set(k, e);
  }
  const out = [...best.values()]
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start) || a.title.localeCompare(b.title));

  // Two caps, because a feed of sixty is easily forty of the same thing.
  //
  // A venue with a season on gets a tenth of the page at most: the first live
  // run gave T-Mobile Park twelve of the sixty slots, and a homestand 2.6 miles
  // away is not what someone reads this page for.
  //
  // And a repeated title gets two. "Seattle Mariners Ballpark Tour" runs every
  // day the team is home and appeared on nine consecutive cards; a run of the
  // same show is worth knowing about once or twice, not nine times.
  const venueCap = Math.max(3, Math.ceil(MAX / 10));
  const TITLE_CAP = 2;
  const perVenue = new Map();
  const perTitle = new Map();

  // Filling sixty slots in date order hands the page to whichever source has
  // the earliest events. Adding the City calendar showed it: thirty-one
  // Ticketmaster, twenty-eight City, and Visit Seattle — the source chosen
  // precisely because it carries the neighbourhood's own cultural listings —
  // down to one of its six.
  //
  // So every source gets a guaranteed share first, and only then is what is
  // left filled by date. A source with fewer events than its share simply
  // contributes all of them and hands the rest back. Date order holds within
  // each pass and the result is sorted by date at the end, so the reader sees
  // a calendar, not a rotation.
  const sources = [...new Set(out.map((e) => e.source))];
  const share = Math.max(1, Math.floor(MAX / Math.max(1, sources.length)));
  const perSource = new Map();
  const kept = [];
  const takeable = (e) => {
    const title = e.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if ((perTitle.get(title) ?? 0) >= TITLE_CAP) return false;
    const venue = `${e.source}|${e.venue.name.toLowerCase()}`;
    return (perVenue.get(venue) ?? 0) < venueCap;
  };
  const take = (e) => {
    const title = e.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const venue = `${e.source}|${e.venue.name.toLowerCase()}`;
    perTitle.set(title, (perTitle.get(title) ?? 0) + 1);
    perVenue.set(venue, (perVenue.get(venue) ?? 0) + 1);
    perSource.set(e.source, (perSource.get(e.source) ?? 0) + 1);
    kept.push(e);
  };

  const taken = new Set();
  for (const e of out) {
    if (kept.length >= MAX) break;
    if ((perSource.get(e.source) ?? 0) >= share) continue;
    if (!takeable(e)) continue;
    take(e); taken.add(e);
  }
  for (const e of out) {
    if (kept.length >= MAX) break;
    if (taken.has(e) || !takeable(e)) continue;
    take(e);
  }
  return kept.sort((a, b) => Date.parse(a.start) - Date.parse(b.start) || a.title.localeCompare(b.title));
}

// ---- run -------------------------------------------------------------------
if (probe) {
  await runProbe();
  process.exit(0);
}

const chosen = only ? SOURCES.filter((s) => s.id === only) : SOURCES;
if (only && !chosen.length) {
  console.error(`[events] no source called "${only}". Known: ${SOURCES.map((s) => s.id).join(', ')}`);
  process.exit(2);
}

const collected = [];
const used = [];
const notes = [];

for (const src of chosen) {
  const log = (m) => console.log(`[${src.id}] ${m}`);
  try {
    let result;
    if (fixtures) {
      let body;
      try {
        body = JSON.parse(readFileSync(join(fixtures, `${src.id}.json`), 'utf8'));
      } catch {
        notes.push(`${src.label}: no fixture in ${fixtures}`);
        log(`no fixture — skipped`);
        continue;
      }
      const raw = src.fromSaved(body);
      log(`reading ${raw.length} record(s) from fixture`);
      result = { events: src.normalise(raw, { home, radiusMiles }) };
    } else if (sourceFile && (!sourceFileFor || sourceFileFor === src.id)) {
      const body = JSON.parse(readFileSync(sourceFile, 'utf8'));
      const raw = src.fromSaved(body);
      log(`reading ${raw.length} record(s) from ${sourceFile}`);
      // Every source exposes the same normalise(), so the offline path is the
      // live path with the network taken out — not a second implementation.
      result = { events: src.normalise(raw, { home, radiusMiles }) };
    } else if (sourceFile) {
      continue; // a saved file was named for a different source
    } else {
      result = await src.fetchEvents({ home, radiusMiles, days, log });
    }
    if (result.skipped) {
      notes.push(`${src.label}: skipped — ${result.skipped}`);
      log(`skipped — ${result.skipped}`);
      continue;
    }
    log(`${result.events.length} event(s)`);
    collected.push(...result.events);
    if (result.events.length) used.push(src.label);
  } catch (err) {
    // One calendar being down is not a reason to publish nothing.
    notes.push(`${src.label}: failed — ${err instanceof Error ? err.message : err}`);
    console.error(`[${src.id}] failed — ${err instanceof Error ? err.message : err}`);
  }
}

const events = merge(collected);

const before = JSON.parse(readFileSync(eventsPath, 'utf8'));
const beforeIds = new Set((before.events ?? []).map((e) => e.id));
const added = events.filter((e) => !beforeIds.has(e.id));
const afterIds = new Set(events.map((e) => e.id));
const gone = (before.events ?? []).filter((e) => !afterIds.has(e.id));

console.log(`[events] ${events.length} kept — ${added.length} new, ${gone.length} dropped`);
for (const e of added.slice(0, 12)) console.log(`  + ${localDay(e.start)}  ${e.title} — ${e.venue.name}`);
if (added.length > 12) console.log(`  + …and ${added.length - 12} more`);
for (const n of notes) console.log(`  ! ${n}`);

if (!events.length && notes.length === chosen.length) {
  console.error('[events] every source was skipped or failed; leaving the feed as it was');
  process.exit(1);
}

// `updated` only moves when the events do, so a week with no change produces no
// diff and no deploy.
const sameEvents = JSON.stringify(before.events ?? []) === JSON.stringify(events);
const next = {
  updated: sameEvents ? (before.updated ?? new Date().toISOString()) : new Date().toISOString(),
  sources: used,
  window: { days, radiusMiles },
  events,
};

if (dryRun) {
  console.log('[events] --dry-run: nothing written');
} else if (sameEvents && before.window?.days === days && before.window?.radiusMiles === radiusMiles) {
  console.log('[events] no change');
} else {
  writeFileSync(eventsPath, JSON.stringify(next, null, 2) + '\n');
  console.log(`[events] wrote ${eventsPath}`);
}
