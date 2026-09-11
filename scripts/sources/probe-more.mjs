// What do the four candidate calendars actually serve?
//
// None of them is reachable from a development sandbox, so this runs on a
// GitHub runner and prints what it finds. It guesses nothing: for each site it
// reads robots.txt, then the listing page, and reports the feeds the page
// itself advertises — <link rel="alternate">, .ics links, and JSON-LD Event
// blocks — before trying a short list of conventional paths.
//
// The order matters. A published feed is something a site has chosen to hand
// out; parsing its HTML is not, and robots.txt is where it says which it
// wants. So the first two answers decide whether the third is even worth
// looking at.
//
// Usage: node scripts/sources/probe-more.mjs

const SITES = [
  { id: 'events12',    base: 'https://www.events12.com', listing: 'https://www.events12.com/seattle/' },
  { id: 'everout',     base: 'https://everout.com',      listing: 'https://everout.com/seattle/events/' },
  { id: 'do206',       base: 'https://do206.com',        listing: 'https://do206.com/' },
  { id: 'seattle-gov', base: 'https://www.seattle.gov',  listing: 'https://www.seattle.gov/event-calendar' },
];

// Conventional paths, tried only after the page has had its say.
const GUESSES = ['/feed', '/feed/', '/rss', '/rss.xml', '/atom.xml', '/events.rss', '/events.json', '/events.ics', '/api/events', '/wp-json/'];

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

function feedsAdvertised(html, base) {
  const out = [];
  const re = /<link\b[^>]*>/gi;
  for (const tag of html.match(re) ?? []) {
    if (!/rel\s*=\s*["']?alternate/i.test(tag)) continue;
    const type = tag.match(/type\s*=\s*["']([^"']+)["']/i)?.[1] ?? '';
    const href = tag.match(/href\s*=\s*["']([^"']+)["']/i)?.[1] ?? '';
    if (!href || !/rss|atom|json|calendar/i.test(type)) continue;
    out.push({ type, href: new URL(href, base).href });
  }
  return out;
}

function icsLinks(html, base) {
  const out = new Set();
  for (const m of html.matchAll(/href\s*=\s*["']([^"']*\.ics(?:\?[^"']*)?)["']/gi)) out.add(new URL(m[1], base).href);
  for (const m of html.matchAll(/href\s*=\s*["']([^"']*(?:ical|icalendar|calendar\/export)[^"']*)["']/gi)) out.add(new URL(m[1], base).href);
  return [...out].slice(0, 6);
}

function jsonLd(html) {
  const blocks = [];
  for (const m of html.matchAll(/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { blocks.push(JSON.parse(m[1].trim())); } catch { /* a broken block tells us nothing */ }
  }
  const events = [];
  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== 'object') return;
    const t = node['@type'];
    const types = Array.isArray(t) ? t : [t];
    if (types.some((x) => typeof x === 'string' && /Event/i.test(x))) events.push(node);
    Object.values(node).forEach(walk);
  };
  blocks.forEach(walk);
  return events;
}

function robotsVerdict(txt, path) {
  // Only the lines that apply to everyone; a site that names a specific agent
  // is talking to that agent, not to us.
  const lines = txt.split(/\r?\n/).map((l) => l.trim());
  let inStar = false, rules = [];
  for (const l of lines) {
    const m = l.match(/^user-agent:\s*(.*)$/i);
    if (m) { inStar = m[1].trim() === '*'; continue; }
    if (!inStar) continue;
    const d = l.match(/^(disallow|allow):\s*(.*)$/i);
    if (d) rules.push({ kind: d[1].toLowerCase(), path: d[2].trim() });
  }
  const hits = rules.filter((r) => r.path && path.startsWith(r.path));
  const blocking = hits.filter((r) => r.kind === 'disallow');
  return { rules: rules.length, hits, blocked: blocking.length > 0 && !hits.some((r) => r.kind === 'allow' && r.path.length >= blocking[0].path.length) };
}

for (const site of SITES) {
  line(`\n${'='.repeat(70)}\n${site.id}  ${site.listing}\n${'='.repeat(70)}`);

  const robots = await grab(`${site.base}/robots.txt`, 'text/plain');
  if (robots.ok) {
    const path = new URL(site.listing).pathname;
    const v = robotsVerdict(robots.text, path);
    line(`robots.txt   ${robots.status}, ${v.rules} rule(s) for *`);
    line(`             ${path} → ${v.blocked ? 'DISALLOWED for everyone' : 'not disallowed'}`);
    if (v.hits.length) v.hits.forEach((h) => line(`             matched: ${h.kind}: ${h.path}`));
    const sitemaps = [...robots.text.matchAll(/^sitemap:\s*(\S+)/gim)].map((m) => m[1]).slice(0, 3);
    if (sitemaps.length) line(`             sitemaps: ${sitemaps.join(', ')}`);
  } else {
    line(`robots.txt   ${robots.status || robots.error} — none served`);
  }

  const page = await grab(site.listing, 'text/html');
  line(`listing      ${page.status} ${page.type} ${page.len} bytes${page.url !== site.listing ? ` (→ ${page.url})` : ''}`);
  if (!page.ok) { if (page.error) line(`             ${page.error}`); continue; }

  const feeds = feedsAdvertised(page.text, page.url);
  line(`feeds the page advertises: ${feeds.length || 'none'}`);
  feeds.forEach((f) => line(`   ${f.type}  ${f.href}`));

  const ics = icsLinks(page.text, page.url);
  line(`calendar links: ${ics.length || 'none'}`);
  ics.forEach((h) => line(`   ${h}`));

  const ld = jsonLd(page.text);
  line(`JSON-LD Event objects on the listing: ${ld.length}`);
  if (ld.length) {
    const e = ld[0];
    line(`   keys: ${Object.keys(e).join(', ')}`);
    line(`   sample: ${JSON.stringify({ name: e.name, startDate: e.startDate, endDate: e.endDate, url: e.url, location: e.location?.name ?? e.location }).slice(0, 400)}`);
  }

  // Only worth a round trip if nothing above answered.
  if (!feeds.length && !ics.length && !ld.length) {
    line('nothing advertised — trying conventional paths:');
    for (const g of GUESSES) {
      const r = await grab(site.base + g);
      const looks = /xml|json|calendar/i.test(r.type) ? '  ← usable content type' : '';
      line(`   ${String(r.status || r.error).padEnd(5)} ${r.type.padEnd(28)} ${String(r.len).padStart(8)}b  ${g}${looks}`);
    }
  }
}

line('\ndone');
