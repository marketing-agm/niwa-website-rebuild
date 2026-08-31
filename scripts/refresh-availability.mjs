// Refresh a site's units.json from the AGM availabilities feed.
//
// Source of truth is the AppFolio public listings, already parsed into a clean
// feed by the agm-availabilities app (listings.json). This script pulls that
// feed, filters to the property (or properties) the site markets, and MERGES it
// into the site's units.json:
//
//   • AppFolio drives:   beds, baths, sqft, rent, available, availType, address
//   • Curated, preserved: floor, floorNum, features, featured, plan  (by uid)
//   • New units:          created with derived floor/plan + empty features, FLAGGED
//   • Vanished units:     dropped (no longer listed)
//
// It never overwrites hand-written marketing copy, and prints a change report.
// Deterministic: same input → same output, so it's safe to run on a schedule.
//
// Usage:
//   npm run refresh
//   npm run refresh -- --source-file /tmp/listings.json   # offline/test
//   npm run refresh -- --dry-run                          # report only, no write

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// ---- args ----------------------------------------------------------------
const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};
const sourceFile = getArg('source-file', null);
const dryRun = args.includes('--dry-run');

// One property in this repo, so no --site to pick between them.
const siteDir = join(root, 'src/site');
const configPath = join(siteDir, 'site.config.json');
const unitsPath = join(siteDir, 'units.json');

const config = JSON.parse(readFileSync(configPath, 'utf8'));
const av = config.availability || {};
// A site can market more than one AppFolio property — e.g. Magnolia lists both
// "Magnolia Crestview" and "Magnolia Vista & Manor". Accepts a string or an
// array; the first entry is treated as the site's original property for the
// purpose of migrating pre-multi-property units.json records (see findCurrent).
const propertyNames = (Array.isArray(av.appfolioProperty) ? av.appfolioProperty : [av.appfolioProperty])
  .filter(Boolean)
  .map(String);
const legacyProperty = propertyNames[0];
const propertyLabel = propertyNames.join(' + ');
const sourceUrl = av.source;
if (!propertyNames.length) throw new Error(`[refresh] src/site/site.config.json is missing availability.appfolioProperty`);

// ---- derivations ---------------------------------------------------------
const ORDINALS = ['', 'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth'];
const floorNumFromId = (id) => {
  const digits = String(id).replace(/\D/g, '');
  return digits ? (parseInt(digits[0], 10) || null) : null;
};
const floorLabelFromId = (id) => {
  const n = floorNumFromId(id);
  if (!n) return '';
  return (ORDINALS[n] || `Floor ${n}`) + ' floor';
};
const normBeds = (b) => (String(b).toLowerCase() === 'studio' ? 0 : Number(b));
const availTypeOf = (s) => (/^now$/i.test(String(s).trim()) ? 'now' : 'soon');
// plan keys are curated + tied to the UI (PLAN_LABELS / floorPlans). Only used
// for brand-new units, which get flagged for human review anyway.
const derivePlan = (beds, baths) => {
  if (beds === 0) return 'studio';
  if (beds === 1) return '1br';
  if (beds === 2 && baths === 2) return '2br2ba';
  return `${beds}br${String(baths).replace(/\.0$/, '')}ba`;
};

// ---- load feed -----------------------------------------------------------
async function loadFeed() {
  if (sourceFile) return JSON.parse(readFileSync(sourceFile, 'utf8'));
  if (!sourceUrl) throw new Error(`[refresh] src/site/site.config.json is missing availability.source (or pass --source-file)`);
  const res = await fetch(sourceUrl, { headers: { 'accept': 'application/json' } });
  if (!res.ok) throw new Error(`[refresh] feed fetch failed: ${res.status} ${res.statusText} for ${sourceUrl}`);
  return res.json();
}

const feed = await loadFeed();
const feedListings = Array.isArray(feed) ? feed : feed.listings || [];
const mine = feedListings.filter((l) => propertyNames.includes(l.property));

// A name that matches nothing is almost always a typo or a renamed property in
// AppFolio, and it fails silently — the site just quietly stops listing that
// building. Call it out even when other properties did match.
const matchedNames = new Set(mine.map((l) => l.property));
propertyNames.filter((n) => !matchedNames.has(n)).forEach((n) => {
  console.error(`[refresh] WARNING: "${n}" matched 0 listings — check the exact name in the feed.`);
});

if (!mine.length) {
  console.error(`[refresh] WARNING: 0 listings for "${propertyLabel}" in the feed (updatedAt: ${feed.updatedAt || 'n/a'}).`);
  console.error('[refresh] Refusing to wipe units.json on an empty result — check the property name / source. No changes written.');
  // Same trailer shape as the normal path so the Routine's parser doesn't have
  // to special-case the bail-out. Nothing was written, so nothing changed.
  console.log('CHANGED=false');
  console.log('BEDROOM_MIX_CHANGED=false');
  console.log('BEDS_GAINED=');
  console.log('BEDS_LOST=');
  console.log('PRICE_FLOOR_CHANGED=false');
  console.log('PRICE_FLOOR=');
  console.log('PRICE_FLOOR_WAS=');
  process.exit(0);
}

// ---- build merged units --------------------------------------------------
const current = JSON.parse(readFileSync(unitsPath, 'utf8'));
const currentUnits = current.units || [];

// Unit numbers are only unique WITHIN a property — Crestview and Vista & Manor
// both have a 307. Keying anything on the bare unit number silently merges two
// different homes into one, so every unit carries a `uid` scoped by property.
const slug = (s) => String(s).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const uidFor = (property, unit) => `${slug(property)}-${slug(unit)}`;

const byUid = new Map();
const legacyById = new Map();
for (const u of currentUnits) {
  if (u.uid) byUid.set(String(u.uid), u);
  // Records written before multi-property support have no uid. They can only
  // have belonged to the site's original property, so match them by bare id —
  // but ONLY for that property, or a second building's 307 would inherit the
  // first building's curated features.
  else legacyById.set(String(u.id), u);
}
const findCurrent = (uid, id, property) =>
  byUid.get(uid) || (property === legacyProperty ? legacyById.get(String(id)) : undefined) || null;

const skipped = [];
const flagged = [];

const numeric = (id) => {
  const n = parseInt(String(id).replace(/\D/g, ''), 10);
  return Number.isNaN(n) ? Number.POSITIVE_INFINITY : n;
};

const merged = mine
  .filter((l) => {
    const id = String(l.unit ?? '').trim();
    if (!id || /^not specified$/i.test(id)) { skipped.push(l); return false; }
    return true;
  })
  .map((l) => {
    const id = String(l.unit).trim();
    const property = String(l.property);
    const uid = uidFor(property, id);
    const beds = normBeds(l.bedrooms);
    const baths = Number(l.bathrooms);
    const sqft = Number(l.sqft) || 0;
    const rent = l.rent ? Number(l.rent) : null;
    const available = String(l.available || 'Now');
    const availType = availTypeOf(available);
    // "2701 W Manor Pl, Apt 301, Seattle, WA 98199" -> "2701 W Manor Pl".
    // Vista & Manor spans two streets, so the building name alone doesn't
    // locate a home; the street does.
    const address = String(l.address || '').split(/,\s*(?:Apt|Unit|#)\b/i)[0].trim();
    const cur = findCurrent(uid, id, property);
    if (cur) {
      // preserve curated fields, refresh AppFolio-driven ones, keep key order stable
      const next = {
        uid, id, property, address,
        beds, baths, sqft, rent,
        floor: cur.floor,
        floorNum: cur.floorNum,
        available, availType,
        features: cur.features,
        plan: cur.plan,
      };
      if (cur.featured) next.featured = cur.featured;
      return next;
    }
    // brand-new unit — derive best guesses, flag for review
    flagged.push(`${property} ${id}`);
    return {
      uid, id, property, address,
      beds, baths, sqft, rent,
      floor: floorLabelFromId(id),
      floorNum: floorNumFromId(id),
      available, availType,
      features: [],
      plan: derivePlan(beds, baths),
    };
  })
  // Group by property so the file (and the change report) reads building by
  // building, then by unit number within each.
  .sort((a, b) =>
    propertyNames.indexOf(a.property) - propertyNames.indexOf(b.property) ||
    numeric(a.id) - numeric(b.id) ||
    String(a.id).localeCompare(String(b.id)));

// ---- change report -------------------------------------------------------
// Diffed by uid, not unit number — two buildings can both have a 307, and
// comparing those to each other would report phantom rent changes every run.
const newByUid = new Map(merged.map((u) => [u.uid, u]));
const added = merged.filter((u) => !findCurrent(u.uid, u.id, u.property));
const removed = currentUnits.filter((u) => {
  const uid = u.uid || uidFor(legacyProperty, u.id);
  return !newByUid.has(String(uid));
});
const dataFields = ['beds', 'baths', 'sqft', 'rent', 'available', 'availType'];
const updated = [];
const unchanged = [];
for (const u of merged) {
  const prev = findCurrent(u.uid, u.id, u.property);
  if (!prev) continue;
  const diffs = dataFields.filter((f) => (prev[f] ?? null) !== (u[f] ?? null))
    .map((f) => ({ f, from: prev[f] ?? null, to: u[f] ?? null }));
  if (diffs.length) updated.push({ u, diffs }); else unchanged.push(u);
}

const money = (r) => (r == null ? 'Inquire' : `$${Number(r).toLocaleString()}/mo`);
const line = (u) => `  ${u.property || propertyLabel} — Unit ${u.id}: ${money(u.rent)} | ${u.beds === 0 ? 'Studio' : u.beds + ' bd'} / ${u.baths} ba | ${u.sqft.toLocaleString()} sqft | Avail: ${u.available}`;

// ---- bedroom-mix signal --------------------------------------------------
// The site self-updates from this feed, but the Google Ads account and the
// hand-written SEO prose do not. When the set of *available* bedroom counts
// changes — the last 1BR leases, or the first one opens — paid campaigns start
// advertising inventory that doesn't exist, or miss inventory that does. Both
// cost money silently, so surface it loudly here rather than hoping someone
// notices in the diff.
const bedsLabel = (b) => (b === 0 ? 'Studio' : `${b} bd`);
// How the count reads as a Google Ads negative keyword, so the action lines can
// be copy-pasted into the shared list rather than translated by hand.
const WORDS = ['', 'one', 'two', 'three', 'four', 'five', 'six'];
const bedsKeywords = (b) => (b === 0
  ? '"studio"'
  : `"${b} bedroom"/"${WORDS[b] || b} bedroom"`);

// Lowest rent per bedroom count, so the report can quote a real "from" price.
function mixOf(units) {
  const m = new Map();
  for (const u of units) {
    const beds = normBeds(u.beds);
    if (!Number.isFinite(beds)) continue;
    const rent = u.rent == null ? null : Number(u.rent);
    const prev = m.get(beds);
    if (prev === undefined) m.set(beds, rent);
    else if (rent != null && (prev == null || rent < prev)) m.set(beds, rent);
  }
  return m;
}

const mixBefore = mixOf(currentUnits);
const mixAfter = mixOf(merged);
const bedsGained = [...mixAfter.keys()].filter((b) => !mixBefore.has(b)).sort((a, b) => a - b);
const bedsLost = [...mixBefore.keys()].filter((b) => !mixAfter.has(b)).sort((a, b) => a - b);
const mixChanged = bedsGained.length > 0 || bedsLost.length > 0;

// The "from $X" price quoted in seo.description is also hand-written prose, so
// a moved price floor needs the same human follow-up even when the mix holds.
const floorOf = (units) => {
  const rents = units.map((u) => Number(u.rent)).filter((n) => Number.isFinite(n) && n > 0);
  return rents.length ? Math.min(...rents) : null;
};
const floorBefore = floorOf(currentUnits);
const floorAfter = floorOf(merged);
const floorChanged = floorBefore !== floorAfter;

const R = [];
R.push('============================================================');
R.push(`AVAILABILITY REFRESH — ${propertyLabel}  (feed updated ${feed.updatedAt || 'n/a'})`);
R.push('============================================================');
R.push(`Active units: ${merged.length} (was ${currentUnits.length})`);
R.push('');
R.push(`NEW UNITS (${added.length})`);
added.forEach((u) => R.push(`${line(u)}   ⚠ review plan/features/floor`));
R.push('');
R.push(`REMOVED UNITS (${removed.length})`);
removed.forEach((u) => R.push(`  ${u.property || legacyProperty} — Unit ${u.id}: was ${money(u.rent)} | ${u.beds} bd / ${u.baths} ba`));
R.push('');
R.push(`UPDATED UNITS (${updated.length})`);
updated.forEach(({ u, diffs }) => {
  R.push(`  ${u.property || legacyProperty} — Unit ${u.id}`);
  diffs.forEach((d) => R.push(`    ${d.f}: ${d.f === 'rent' ? money(d.from) + ' → ' + money(d.to) : d.from + ' → ' + d.to}`));
});
R.push('');
R.push(`UNCHANGED UNITS (${unchanged.length})`);
unchanged.forEach((u) => R.push(line(u)));
if (skipped.length) {
  R.push('');
  R.push(`SKIPPED (no unit number in address) (${skipped.length})`);
  skipped.forEach((l) => R.push(`  ${l.address} — ${l.title}`));
}

if (mixChanged || floorChanged) {
  R.push('');
  R.push('------------------------------------------------------------');
  R.push(mixChanged
    ? '⚠  BEDROOM MIX CHANGED — Google Ads + SEO copy need a human'
    : '⚠  PRICE FLOOR MOVED — SEO copy needs a human');
  R.push('------------------------------------------------------------');
  const avail = [...mixAfter.keys()].sort((a, b) => a - b)
    .map((b) => `${bedsLabel(b)} (from ${money(mixAfter.get(b))})`).join(', ') || '(none)';
  R.push(`  Available mix now:   ${avail}`);
  if (bedsGained.length) {
    R.push(`  NEWLY available:     ${bedsGained.map((b) => `${bedsLabel(b)} from ${money(mixAfter.get(b))}`).join(', ')}`);
  }
  if (bedsLost.length) {
    R.push(`  NO LONGER available: ${bedsLost.map((b) => bedsLabel(b)).join(', ')}`);
  }
  if (floorChanged) {
    R.push(`  Price floor:         ${money(floorBefore)} → ${money(floorAfter)}`);
  }
  R.push('');
  R.push('  These do NOT update themselves:');
  if (bedsGained.length) {
    R.push(`    • Ads → drop ${bedsGained.map(bedsKeywords).join(', ')} from the conditional negative list`);
    R.push(`    • Ads → unpause the matching ad group; quote the real rent above`);
  }
  if (bedsLost.length) {
    R.push(`    • Ads → ADD ${bedsLost.map(bedsKeywords).join(', ')} to the conditional negative list`);
    R.push(`    • Ads → pause the matching ad group (you'd be buying clicks for nothing)`);
  }
  if (floorChanged) {
    R.push('    • site.config.json → seo.description / seo.twitterDescription price sentence');
    R.push('    • Ads → any headline quoting a "from" price');
  }
  R.push('    See docs/plans/2026-08-07-magnolia-google-ads-playbook.md § Phase 0a');
  R.push('------------------------------------------------------------');
}

R.push('============================================================');
console.log(R.join('\n'));

// ---- write ---------------------------------------------------------------
const nextJson = JSON.stringify({ units: merged }, null, 2) + '\n';
const changed = nextJson !== readFileSync(unitsPath, 'utf8');

if (changed && !dryRun) {
  writeFileSync(unitsPath, nextJson);
  console.error(`\n[refresh] wrote ${unitsPath}`);
} else if (changed) {
  console.error('\n[refresh] changes detected (dry-run: not written)');
} else {
  console.error('\n[refresh] no changes');
}
if (flagged.length) console.error(`[refresh] NEW units need human review: ${flagged.join(', ')}`);
if (mixChanged) console.error('[refresh] BEDROOM MIX CHANGED — see the action block above; Google Ads needs a manual update');

// Machine-readable trailer. Always emitted, including the false cases, so the
// Routine can parse it unconditionally instead of inferring from absence.
console.log(`CHANGED=${changed}`);
console.log(`BEDROOM_MIX_CHANGED=${mixChanged}`);
console.log(`BEDS_GAINED=${bedsGained.join(',')}`);
console.log(`BEDS_LOST=${bedsLost.join(',')}`);
console.log(`PRICE_FLOOR_CHANGED=${floorChanged}`);
console.log(`PRICE_FLOOR=${floorAfter ?? ''}`);
console.log(`PRICE_FLOOR_WAS=${floorBefore ?? ''}`);
