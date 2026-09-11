// What shape is the Seattle Center events page?
//
// Round two settled the four sites the client listed: seattle.gov is wired
// up and serving, everout and do206 return 403 to every path including their
// own robots.txt, and events12 serves only prose. That leaves one page worth
// reading properly — seattlecenter.com/events, the venue across the street,
// whose listings are all inside the ring the map draws.
//
// It serves 57KB of HTML at 200 with no robots.txt at all, no feed and no
// JSON-LD, so the question is whether that HTML is the listings or an empty
// shell that fetches them afterwards. If there is a JSON blob in the page or
// an endpoint it calls, that is what to read. Parsing the markup is the last
// resort and only worth it if the listings are really in there and really
// structured.
//
// Usage: node scripts/sources/probe-structure.mjs

// /events turned out to be a landing page — three nav links, no dates, no
// listings. The calendar itself is a level down. Seattle Center is a City of
// Seattle department, and the City publishes through Trumba, so that is the
// first thing to look for on the real page.
const PAGES = ['https://www.seattlecenter.com/events/event-calendar'];
const UA = 'niwa-website-rebuild events probe (+https://github.com/marketing-agm/niwa-website-rebuild)';

for (const URL_ of PAGES) {
console.log(`\n${'='.repeat(70)}\n${URL_}\n${'='.repeat(70)}`);
const res = await fetch(URL_, { headers: { accept: 'text/html', 'user-agent': UA }, redirect: 'follow' });
const html = await res.text();
console.log(`${res.status} ${res.url}  ${html.length}b\n`);

// Trumba first: it is how every City of Seattle property publishes, and it
// is invisible in the markup — the calendar arrives from a third party after
// the page loads, so only the spud's webName is in the HTML.
const spud = html.match(/webName\s*:\s*["']([^"']+)["']/i)?.[1]
  ?? html.match(/trumba\.com\/calendars\/([A-Za-z0-9_-]+)/i)?.[1];
console.log(`Trumba calendar:   ${spud ? `${spud}  → https://www.trumba.com/calendars/${spud}.json` : 'absent'}`);
const iframes = [...html.matchAll(/<iframe[^>]*src=["']([^"']+)["']/gi)].map((m) => m[1]);
console.log(`iframes:           ${iframes.length}`);
iframes.slice(0, 6).forEach((f) => console.log(`   ${f}`));

// 1. Embedded state blobs, the best case.
for (const [label, re] of [
  ['__NEXT_DATA__', /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i],
  ['__NUXT__', /window\.__NUXT__\s*=\s*([\s\S]*?)<\/script>/i],
  ['drupalSettings', /drupalSettings\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/i],
  ['Apollo/初期state', /window\.__(?:APOLLO_STATE|INITIAL_STATE)__\s*=\s*([\s\S]*?)<\/script>/i],
]) {
  const m = html.match(re);
  console.log(`${label.padEnd(18)} ${m ? `FOUND, ${m[1].length}b` : 'absent'}`);
}

// 2. Any endpoint the page names, which is what a client-rendered list calls.
const endpoints = [...new Set([...html.matchAll(/["'](\/(?:api|jsonapi|views|rest|wp-json|umbraco|sitefinity)\/[^"'\s<>]{2,90})["']/gi)].map((m) => m[1]))];
console.log(`\nendpoints named in the page: ${endpoints.length}`);
endpoints.slice(0, 25).forEach((e) => console.log(`   ${e}`));

// 3. Is the listing in the markup? Count repeated structures and date-ish text.
const timeTags = (html.match(/<time\b[^>]*datetime=/gi) ?? []).length;
const isoDates = new Set((html.match(/\b20\d{2}-\d{2}-\d{2}\b/g) ?? []));
console.log(`\n<time datetime> tags: ${timeTags}`);
console.log(`distinct ISO dates:   ${isoDates.size}  ${[...isoDates].slice(0, 8).join(' ')}`);

// The class names that repeat most are the listing's row, if there is one.
const classes = {};
for (const m of html.matchAll(/class=["']([^"']+)["']/g))
  for (const c of m[1].split(/\s+/)) if (/event|card|listing|tile|item|calendar/i.test(c)) classes[c] = (classes[c] ?? 0) + 1;
const top = Object.entries(classes).sort((a, b) => b[1] - a[1]).slice(0, 18);
console.log(`\nrepeating event-ish classes:`);
top.forEach(([c, n]) => console.log(`   ${String(n).padStart(4)}  .${c}`));

// 4. Links that look like individual event pages.
const links = [...new Set([...html.matchAll(/href=["'](\/events?\/[^"'#?]{3,120})["']/gi)].map((m) => m[1]))];
console.log(`\ndistinct /event links: ${links.length}`);
links.slice(0, 12).forEach((l) => console.log(`   ${l}`));

// 5. The event-list rows themselves. The calendar page carries .event-list__*
// classes, so the listings are server-rendered after all — this prints two of
// them whole, which is what an adapter has to be written against. What matters
// is whether a row carries a date in any parseable form: there is no <time>
// tag and no ISO date anywhere on the page, so if the date is only prose like
// "Sat, Sep 13" then the year is inferred and the whole thing is guesswork.
const rows = [...html.matchAll(/<(article|div|li)[^>]*class=["'][^"']*event-list__item[^"']*["'][\s\S]{0,2600}?<\/\1>/gi)];
console.log(`\n.event-list__item rows: ${rows.length}`);
if (!rows.length) {
  const at = html.indexOf('event-list__');
  console.log('--- 3000 chars from the first event-list__ ---');
  console.log(html.slice(Math.max(0, at - 700), at + 2300).replace(/\s+/g, ' '));
} else {
  rows.slice(0, 2).forEach((m, i) => console.log(`\n--- row ${i + 1} ---\n` + m[0].replace(/\s+/g, ' ')));
}

// 5b. A slice around the first one, so the row's real shape is visible.
if (links.length > 1) {
  const at = html.indexOf(`href="${links[1]}"`);
  if (at > 0) {
    console.log(`\n--- markup around ${links[1]} ---`);
    console.log(html.slice(Math.max(0, at - 900), at + 900).replace(/\s+/g, ' '));
  }
}
}
