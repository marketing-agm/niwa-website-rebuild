// How does the Seattle Center calendar paginate?
//
// The rows are server-rendered and well formed — a date-bar__date heading per
// day, then event-list__title / __time / __location / __price / __tags / __text
// per event, and the location link is a Google Maps URL with the coordinates
// in it, which means these listings can go on the map rather than only in the
// list. So the adapter is worth writing. What is still unknown is how to ask
// for more than the default page: without that this source would only ever
// carry today.
//
// This tries the conventional shapes and reports which one actually moves the
// calendar, by reading back the day headings each response contains.
//
// Usage: node scripts/sources/probe-structure.mjs

const BASE = 'https://www.seattlecenter.com/events/event-calendar';
const UA = 'niwa-website-rebuild events probe (+https://github.com/marketing-agm/niwa-website-rebuild)';

const d = new Date(Date.now() + 12 * 864e5);
const iso = d.toISOString().slice(0, 10);
const us = `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}`;

const TRIES = [
  ['base', BASE],
  ['?date= iso', `${BASE}?date=${iso}`],
  ['?date= us', `${BASE}?date=${encodeURIComponent(us)}`],
  ['?start_date=', `${BASE}?start_date=${iso}`],
  ['?from=', `${BASE}?from=${iso}`],
  ['?page=2', `${BASE}?page=2`],
  ['?p=2', `${BASE}?p=2`],
  ['/iso path', `${BASE}/${iso}`],
  ['?view=month', `${BASE}?view=month`],
  ['?range=month', `${BASE}?range=month`],
];

console.log(`today is ${new Date().toISOString().slice(0, 10)}, asking for ${iso} (${us})\n`);
console.log('what'.padEnd(14), 'status'.padEnd(7), 'bytes'.padStart(8), ' days'.padEnd(6), 'evts'.padStart(5), '  day headings');

for (const [what, url] of TRIES) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 20000);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { accept: 'text/html', 'user-agent': UA }, redirect: 'follow' });
    const html = await res.text();
    const days = [...html.matchAll(/class=["']date-bar__date["'][^>]*>\s*([^<]+?)\s*</gi)].map((m) => m[1]);
    const evts = (html.match(/class=["']event-list__title["']/gi) ?? []).length;
    console.log(what.padEnd(14), String(res.status).padEnd(7), String(html.length).padStart(8),
      String(days.length).padStart(5), ' ', String(evts).padStart(4), '  ' + days.slice(0, 6).join(' | '));
  } catch (err) {
    console.log(what.padEnd(14), String(err?.message ?? err).slice(0, 40));
  } finally { clearTimeout(t); }
}

// And one full row, to lock the field positions down before writing the parser.
const res = await fetch(BASE, { headers: { accept: 'text/html', 'user-agent': UA } });
const html = await res.text();
const i = html.indexOf('event-list__title');
console.log('\n--- one row, whole ---\n' + html.slice(Math.max(0, i - 1400), i + 1400).replace(/\s+/g, ' '));
