// What are the candidate calendars serving, and are they usable?
//
// None of them is reachable from a development sandbox, so this runs on a
// runner. It changes nothing: it reads four public pages and prints what it
// finds, in an order that matters. robots.txt first, then the listing page,
// then what the page itself advertises — <link rel="alternate"> feeds, .ics
// links, JSON-LD — before any conventional path is tried. A published feed is
// something a site has chosen to hand out; parsing its HTML is not, and
// robots.txt is where it says which it wants.
//
// WHAT IT FOUND, September 2026 — re-run it before trusting any of this:
//
//   seattle.gov   USABLE, and now wired up. The City does not build its
//                 calendar page: it embeds Trumba as "seattlegov-city-wide",
//                 and Trumba serves every calendar it hosts as .rss, .ics,
//                 .xml and .json off a stable path. See seattle-gov.mjs.
//                 Note that ?startdate= and ?days= are accepted and not
//                 honoured — startdate=today returns an archive slice, which
//                 cost an afternoon.
//
//   events12.com  NOT USABLE. robots allows /seattle/, but the index carries
//                 no feed, no .ics and no JSON-LD; its event pages carry none
//                 either; there is no sitemap. The only way in is parsing
//                 prose, which breaks on any layout change and lifts someone
//                 else's editorial work wholesale.
//
//   everout.com   REFUSES. 403 on the listing and on robots.txt — an edge
//                 rule against non-browser clients. Not something to route
//                 around. Ask them: they run a partner programme.
//
//   do206.com     REFUSES, the same. DoStuff Media, their parent, has an API
//                 for partners.
//
// Usage: node scripts/sources/probe-more.mjs

const SITES = [
  { id: 'events12',      base: 'https://www.events12.com',    listing: 'https://www.events12.com/seattle/' },
  { id: 'everout',       base: 'https://everout.com',         listing: 'https://everout.com/seattle/events/' },
  { id: 'do206',         base: 'https://do206.com',           listing: 'https://do206.com/' },
  { id: 'seattle-gov',   base: 'https://www.seattle.gov',     listing: 'https://www.seattle.gov/event-calendar' },
  // Added in the second round. Not on the original list, but it is the
  // venue across the street from the building and the one calendar whose
  // listings are all inside the ring the map draws, so if it publishes a
  // feed it is worth more to this page than any of the aggregators.
  { id: 'seattlecenter', base: 'https://www.seattlecenter.com', listing: 'https://www.seattlecenter.com/events' },
];

// Round two. A 403 on a listing page is an edge rule about HTML, and it does
// not follow that every path on the host refuses — a feed is often served by
// a different handler with no such rule. So before concluding that a site
// refuses us, ask it for the feeds it would plausibly publish, by name. Same
// honest user-agent throughout: the point is to find what a site is willing
// to hand an automated client, not to pass as something else.
const TARGETED = {
  everout: [
    '/seattle/events/feed/', '/seattle/feed/', '/feed/', '/seattle/events.rss',
    '/seattle/events/?format=json', '/api/events/', '/api/v1/events/', '/sitemap.xml',
  ],
  do206: [
    '/events.rss', '/events.json', '/feed', '/rss', '/api/v2/events',
    '/api/events', '/events.ics', '/sitemap.xml',
  ],
  events12: ['/seattle/index.rss', '/sitemap.xml', '/seattle/seattle.ics'],
  seattlecenter: ['/events/feed', '/api/events', '/events.rss', '/sitemap.xml'],
};
const GUESSES = ['/feed', '/rss', '/rss.xml', '/atom.xml', '/events.json', '/events.ics', '/api/events'];
const UA = 'niwa-website-rebuild events probe (+https://github.com/marketing-agm/niwa-website-rebuild)';

async function grab(url, accept = '*/*') {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 20000);
  try {
    const res = await fetch(url, { signal: ctl.signal, redirect: 'follow', headers: { accept, 'user-agent': UA } });
    const text = await res.text();
    return { ok: res.ok, status: res.status, url: res.url, type: (res.headers.get('content-type') || '-').split(';')[0], len: text.length, text };
  } catch (err) {
    return { ok: false, status: 0, url, type: '-', len: 0, text: '', error: err instanceof Error ? err.message : String(err) };
  } finally { clearTimeout(t); }
}
const line = (s) => console.log(s);

// Only the rules under User-agent: *. A site that names a specific crawler is
// talking to that crawler, not to us.
function robotsVerdict(txt, path) {
  let inStar = false; const rules = [];
  for (const l of txt.split(/\r?\n/).map((x) => x.trim())) {
    const ua = l.match(/^user-agent:\s*(.*)$/i);
    if (ua) { inStar = ua[1].trim() === '*'; continue; }
    if (!inStar) continue;
    const d = l.match(/^(disallow|allow):\s*(.*)$/i);
    if (d && d[2].trim()) rules.push({ kind: d[1].toLowerCase(), path: d[2].trim() });
  }
  const hits = rules.filter((r) => path.startsWith(r.path));
  return { count: rules.length, hits, blocked: hits.some((r) => r.kind === 'disallow') };
}

for (const site of SITES) {
  line(`\n${'='.repeat(70)}\n${site.id}  ${site.listing}\n${'='.repeat(70)}`);

  const robots = await grab(`${site.base}/robots.txt`, 'text/plain');
  if (robots.ok) {
    const v = robotsVerdict(robots.text, new URL(site.listing).pathname);
    line(`robots.txt   ${robots.status}, ${v.count} rule(s) for *  →  ${v.blocked ? 'DISALLOWED' : 'not disallowed'}`);
    v.hits.forEach((h) => line(`             matched ${h.kind}: ${h.path}`));
  } else line(`robots.txt   ${robots.status || robots.error} — none served`);

  const page = await grab(site.listing, 'text/html');
  line(`listing      ${page.status} ${page.type} ${page.len}b`);
  if (!page.ok) continue;

  const feeds = [...(page.text.match(/<link\b[^>]*>/gi) ?? [])]
    .filter((t) => /rel\s*=\s*["']?alternate/i.test(t) && /rss|atom|json|calendar/i.test(t))
    .map((t) => t.match(/href\s*=\s*["']([^"']+)["']/i)?.[1])
    .filter(Boolean);
  line(`feeds advertised: ${feeds.length || 'none'}`);
  feeds.forEach((f) => line(`   ${new URL(f, page.url).href}`));

  const ld = [...page.text.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].length;
  line(`JSON-LD blocks: ${ld}`);

  // Trumba is how seattle.gov publishes; worth naming because it is invisible
  // otherwise — the calendar arrives from a third party after the page loads.
  const trumba = page.text.match(/webName\s*:\s*["']([^"']+)["']/i)?.[1];
  if (trumba) line(`Trumba calendar: ${trumba}  → https://www.trumba.com/calendars/${trumba}.json`);

  if (!feeds.length && !ld && !trumba) {
    line('nothing advertised — conventional paths:');
    for (const g of GUESSES) {
      const r = await grab(site.base + g);
      line(`   ${String(r.status || r.error).padEnd(5)} ${r.type.padEnd(26)} ${String(r.len).padStart(8)}b  ${g}`);
    }
  }
}
// ---------- round two: ask by name ----------
for (const [id, paths] of Object.entries(TARGETED)) {
  const site = SITES.find((s) => s.id === id);
  line(`\n${'-'.repeat(70)}\n${id}: named feed paths\n${'-'.repeat(70)}`);
  for (const path of paths) {
    const r = await grab(site.base + path);
    const head = r.text.slice(0, 120).replace(/\s+/g, ' ');
    line(`   ${String(r.status || r.error).padEnd(5)} ${r.type.padEnd(26)} ${String(r.len).padStart(8)}b  ${path}`);
    if (r.ok && /xml|json|calendar/.test(r.type)) line(`         ↳ ${head}`);
  }
}

line('\ndone');
