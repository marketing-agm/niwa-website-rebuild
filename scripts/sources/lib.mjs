// Shared machinery for the event sources.
//
// Every source is a module exporting { id, label, needsKey?, fetchEvents(ctx) }
// and returning records in one shape, so refresh-events.mjs can merge them
// without knowing anything about where they came from.

export const R_MILES = 3958.7613;
const rad = (d) => (d * Math.PI) / 180;

export function milesBetween(aLat, aLng, bLat, bLng) {
  const dLat = rad(bLat - aLat), dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Ticketmaster's geoPoint wants a geohash rather than a pair of decimals.
// Nine characters is a box about five metres across.
const B32 = '0123456789bcdefghjkmnpqrstuvwxyz';
export function geohash(lat, lng, precision = 9) {
  let idx = 0, bit = 0, even = true, hash = '';
  let latMin = -90, latMax = 90, lngMin = -180, lngMax = 180;
  while (hash.length < precision) {
    if (even) {
      const m = (lngMin + lngMax) / 2;
      if (lng >= m) { idx = idx * 2 + 1; lngMin = m; } else { idx *= 2; lngMax = m; }
    } else {
      const m = (latMin + latMax) / 2;
      if (lat >= m) { idx = idx * 2 + 1; latMin = m; } else { idx *= 2; latMax = m; }
    }
    even = !even;
    if (++bit === 5) { hash += B32[idx]; bit = 0; idx = 0; }
  }
  return hash;
}

export const DEFAULT_TZ = 'America/Los_Angeles';

// A wall-clock time in a named zone, resolved to the actual instant.
//
// Most feeds hand back a local date and time with no offset. Emitting that
// verbatim gets it read as UTC, which in Seattle is seven hours early — an
// event at midnight lands on the previous evening and the page prints the
// wrong day. So the zone's offset is measured at that date rather than
// assumed, which also makes it right on both sides of the March and November
// changes.
//
// Two passes. Each measures the offset at the instant it is refining, not at
// the naive one: reusing the naive instant in the second pass cancels the
// first and hands back the original bad value.
const zoneCache = new Map();
export function utcFromLocal(zone, localDate, localTime) {
  let dtf = zoneCache.get(zone);
  if (!dtf) {
    try {
      dtf = new Intl.DateTimeFormat('en-US', {
        timeZone: zone, hour12: false,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      });
    } catch {
      return null;
    }
    zoneCache.set(zone, dtf);
  }
  const [y, mo, d] = String(localDate).split('-').map(Number);
  const [h = 0, mi = 0, sec = 0] = String(localTime || '00:00:00').split(':').map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  const naive = Date.UTC(y, mo - 1, d, h, mi, sec);
  const readBack = (ms) => {
    const p = Object.fromEntries(dtf.formatToParts(ms).map((x) => [x.type, x.value]));
    const hh = p.hour === '24' ? 0 : Number(p.hour);
    return Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), hh, Number(p.minute), Number(p.second));
  };
  let ts = naive - (readBack(naive) - naive);
  ts = naive - (readBack(ts) - ts);
  return Number.isFinite(ts) ? new Date(ts).toISOString().replace(/\.\d{3}Z$/, 'Z') : null;
}

/** "2026-10-31 15:30:00" → { date, time }. Tolerates a T and a trailing Z. */
export function splitStamp(s) {
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)/.exec(String(s ?? '').trim());
  return m ? { date: m[1], time: m[2].length === 5 ? `${m[2]}:00` : m[2] } : null;
}

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  '#039': "'", '#8217': '’', '#8216': '‘', '#8220': '“',
  '#8221': '”', '#8211': '–', '#8212': '—', '#8230': '…',
};

/** Feed titles arrive as HTML. The page renders text. */
export function plain(html, limit = 0) {
  let s = String(html ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, name) => {
      const key = name.toLowerCase();
      if (ENTITIES[key] !== undefined) return ENTITIES[key];
      if (key[0] === '#') {
        const code = key[1] === 'x' ? parseInt(key.slice(2), 16) : parseInt(key.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : m;
      }
      return m;
    })
    .replace(/\s+/g, ' ')
    .trim();
  if (limit && s.length > limit) s = s.slice(0, limit - 1).replace(/\s+\S*$/, '') + '…';
  return s;
}

/** The same, for a source that publishes HTML rather than a feed.
 *
 *  Sent with a user-agent that says who this is and links the repository. A
 *  site that would rather not be read by a script is entitled to say so, and
 *  it can only say so to a client that identifies itself. */
export async function getText(url, { timeoutMs = 20000, headers = {} } = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctl.signal,
      redirect: 'follow',
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'user-agent': 'niwa-website-rebuild events (+https://github.com/marketing-agm/niwa-website-rebuild)',
        ...headers,
      },
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

/** A fetch that times out rather than hanging a scheduled job. */
export async function getJson(url, { timeoutMs = 20000, headers = {} } = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { accept: 'application/json', ...headers } });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

/* ---------- The category chips ----------

   A closed set, and the only one. The page builds its filter chips from
   whichever distinct category strings come back, so any source that emits a
   word of its own invents a chip — which is how the page ended up offering
   both "Festivals" and "Festivals & Special Events", two chips for the same
   thing, split four listings to two. Visit Seattle passes its feed's own
   category names straight through; the other sources map into a list; nobody
   was reconciling the two.

   Applied centrally, over every event from every source, so this cannot
   happen again whatever an individual adapter does with its own taxonomy. */
export const CATEGORIES = [
  'Arts & theatre', 'Community', 'Family', 'Festivals', 'Film', 'Market',
  'Museums & galleries', 'Music', 'Public meetings', 'Sports', 'Tours', 'Volunteering',
];

// Ordered: first match wins, so the narrower kinds are asked before the
// broader ones. A film screening at a festival is Film; a festival is not Film.
const CATEGORY_ALIASES = [
  [/\bfilm\b|cinema|movie|screening/i, 'Film'],
  [/festival|festal|fiesta|parade|celebrat|special event|\bfair\b|carnival|winterfest/i, 'Festivals'],
  [/market|bazaar|craft show|farmers/i, 'Market'],
  [/theat(?:re|er)|\bplay\b|musical|opera|ballet|dance|cirque|comedy|performing/i, 'Arts & theatre'],
  [/concert|music|\bband\b|symphony|jazz|\bdj\b|nightlife/i, 'Music'],
  [/museum|exhibit|gallery|sculpture|artist|\bart(?:s|work)?\b/i, 'Museums & galleries'],
  [/sport|athletic|skate|\bgame\b|\bvs\.?\b|marathon|fitness|yoga|\brun\b|\brace\b/i, 'Sports'],
  [/family|kids|children|storytime|playground|youth/i, 'Family'],
  [/hearing|council|committee|board meeting|public meeting|civic/i, 'Public meetings'],
  [/volunteer|work party|clean\s?up|stewardship/i, 'Volunteering'],
  [/\btour\b|\bwalk\b|\bstroll\b|garden|cruise/i, 'Tours'],
  [/community|neighbou?rhood|social/i, 'Community'],
];

/** Any source's wording, reduced to one of CATEGORIES — or null, which the
 *  page renders as a card with no chip. Null beats a wrong chip: a reader can
 *  live without a label, but not with the wrong one. */
export function canonicalCategory(raw) {
  const s = plain(raw);
  if (!s) return null;
  const exact = CATEGORIES.find((c) => c.toLowerCase() === s.toLowerCase());
  if (exact) return exact;
  for (const [re, name] of CATEGORY_ALIASES) if (re.test(s)) return name;
  return null;
}
