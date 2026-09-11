// Round two. Round one settled three of the four:
//
//   everout.com   403 on robots.txt and on the listing — the edge refuses
//                 automated clients outright.
//   do206.com     403 on both, the same.
//   events12.com  200, robots allows /seattle/, but the page carries no feed,
//                 no .ics and no JSON-LD. Hand-written HTML only.
//
// That leaves seattle.gov, which is the one worth another round trip: robots
// allows /event-calendar, the page is 25KB of shell with no listings in it —
// so the events arrive from somewhere — and /api/events answered 404 with
// application/json rather than an HTML error page, which means there is a
// JSON surface on that host. This looks for where.
//
// Seattle.gov runs Drupal, so the conventions are known: /jsonapi/ is the
// JSON:API root, ?_format=json is the REST format flag, and drupalSettings is
// the inline blob every Drupal page carries. Ask for those by name rather
// than guessing paths.
//
// events12 gets one more question too: whether its individual event pages
// carry the JSON-LD its index does not, and whether a sitemap lists them.

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

// ---------------------------------------------------------------- seattle.gov
line('='.repeat(70));
line('seattle.gov — where does the calendar get its events?');
line('='.repeat(70));

const page = await grab('https://www.seattle.gov/event-calendar', 'text/html');
line(`listing ${page.status} ${page.len}b`);

if (page.ok) {
  const scripts = [...page.text.matchAll(/<script[^>]+src\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]);
  line(`\nscripts on the page (${scripts.length}):`);
  scripts.slice(0, 25).forEach((s) => line(`   ${s}`));

  // Drupal hangs its client config here, including any REST/view endpoints.
  const ds = page.text.match(/<script[^>]*data-drupal-selector=["']drupal-settings-json["'][^>]*>([\s\S]*?)<\/script>/i);
  if (ds) {
    try {
      const cfg = JSON.parse(ds[1]);
      line(`\ndrupalSettings keys: ${Object.keys(cfg).join(', ')}`);
      if (cfg.views) line(`   views: ${JSON.stringify(cfg.views).slice(0, 600)}`);
      if (cfg.path) line(`   path: ${JSON.stringify(cfg.path).slice(0, 300)}`);
    } catch { line('\ndrupalSettings present but did not parse'); }
  } else line('\nno drupalSettings block — probably not Drupal, or not on this page');

  // Any absolute or root-relative URL in the markup that smells like data.
  const urls = new Set();
  for (const m of page.text.matchAll(/["'`](\/[^"'`\s]*(?:api|json|calendar|event)[^"'`\s]*)["'`]/gi)) urls.add(m[1]);
  for (const m of page.text.matchAll(/["'`](https?:\/\/[^"'`\s]*(?:api|json)[^"'`\s]*)["'`]/gi)) urls.add(m[1]);
  line(`\nURLs in the markup that look like data (${urls.size}):`);
  [...urls].slice(0, 30).forEach((u) => line(`   ${u}`));
}

line('\nDrupal conventions, asked by name:');
for (const p of ['/jsonapi/', '/jsonapi/node/event', '/event-calendar?_format=json', '/views/ajax', '/api/v1/events', '/calendar/events.json']) {
  const r = await grab('https://www.seattle.gov' + p, 'application/json');
  const hint = r.ok && /json/i.test(r.type) ? '  ← ANSWERS' : '';
  line(`   ${String(r.status || r.error).padEnd(5)} ${r.type.padEnd(30)} ${String(r.len).padStart(8)}b  ${p}${hint}`);
  if (r.ok && /json/i.test(r.type)) line(`         head: ${r.text.slice(0, 300)}`);
}

// Seattle publishes open data on Socrata; a calendar dataset there would be
// cleaner than anything scraped, and explicitly meant for reuse.
line('\nSeattle open-data portal:');
const soc = await grab('https://data.seattle.gov/api/catalog/v1?q=events&limit=8', 'application/json');
line(`   ${soc.status} ${soc.type} ${soc.len}b`);
if (soc.ok) {
  try {
    const j = JSON.parse(soc.text);
    (j.results ?? []).forEach((r) => line(`   • ${r.resource?.name} — ${r.resource?.id} (${r.resource?.type})`));
  } catch { line(`   did not parse: ${soc.text.slice(0, 200)}`); }
}

// ------------------------------------------------------------------ events12
line('\n' + '='.repeat(70));
line('events12 — is there anything structured behind the index?');
line('='.repeat(70));

const idx = await grab('https://www.events12.com/seattle/', 'text/html');
if (idx.ok) {
  const links = [...new Set([...idx.text.matchAll(/href\s*=\s*["'](\/seattle\/[^"'#?]+)["']/gi)].map((m) => m[1]))];
  line(`internal /seattle/ links: ${links.length}`);
  links.slice(0, 8).forEach((l) => line(`   ${l}`));
  if (links[0]) {
    const one = await grab('https://www.events12.com' + links[0], 'text/html');
    const ld = [...one.text.matchAll(/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
    line(`\nsample page ${links[0]} → ${one.status}, ${one.len}b, ${ld.length} JSON-LD block(s)`);
    if (ld.length) line(`   ${ld[0][1].trim().slice(0, 400)}`);
  }
}
const sm = await grab('https://www.events12.com/sitemap.xml', 'application/xml');
line(`sitemap.xml ${sm.status} ${sm.type} ${sm.len}b`);

line('\ndone');
