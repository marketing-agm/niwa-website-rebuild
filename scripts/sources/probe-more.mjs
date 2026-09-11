// Round four, and the last one. The City's calendar is Trumba, published as
// "seattlegov-city-wide", and all four formats answer:
//
//   .json   498KB   .rss   402KB   .xml   988KB   .ics  1.1MB
//
// JSON is the one to take. What is left is the record shape — every field the
// adapter will read has to be one the feed actually sends — and whether the
// feed can be asked for a date range, because pulling half a megabyte every
// Monday to keep thirty days of it is rude to a public server and slow here.

const UA = 'niwa-website-rebuild events probe (+https://github.com/marketing-agm/niwa-website-rebuild)';
const BASE = 'https://www.trumba.com/calendars/seattlegov-city-wide.json';

async function grab(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 25000);
  try {
    const res = await fetch(url, { signal: ctl.signal, redirect: 'follow', headers: { accept: 'application/json', 'user-agent': UA } });
    const text = await res.text();
    return { ok: res.ok, status: res.status, type: (res.headers.get('content-type') || '-').split(';')[0], len: text.length, text };
  } catch (err) { return { ok: false, status: 0, type: '-', len: 0, text: '', error: String(err) }; }
  finally { clearTimeout(t); }
}
const line = (s) => console.log(s);

const full = await grab(BASE);
line(`full feed  ${full.status} ${full.type} ${full.len}b`);
let rows = [];
try { rows = JSON.parse(full.text); } catch (e) { line(`did not parse: ${e}`); }
line(`records: ${Array.isArray(rows) ? rows.length : '(not an array)'}`);

if (rows.length) {
  // Every key any record uses, not just the first — feeds are ragged.
  const keys = new Map();
  for (const r of rows) for (const k of Object.keys(r)) keys.set(k, (keys.get(k) ?? 0) + 1);
  line(`\nkeys across all ${rows.length} records (name × how many carry it):`);
  [...keys.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, n]) => line(`   ${k.padEnd(26)} ${n}`));

  const trim = (r) => {
    const o = {};
    for (const [k, v] of Object.entries(r)) {
      o[k] = typeof v === 'string' && v.length > 120 ? v.slice(0, 120) + '…' : v;
    }
    return o;
  };
  line(`\nfirst record:\n${JSON.stringify(trim(rows[0]), null, 1).slice(0, 2000)}`);
  const withLoc = rows.find((r) => r.location || r.customFields?.length);
  if (withLoc && withLoc !== rows[0]) line(`\na record carrying a location:\n${JSON.stringify(trim(withLoc), null, 1).slice(0, 1800)}`);

  // How far ahead does an unfiltered pull reach?
  const dates = rows.map((r) => r.startDateTime ?? r.startDate ?? r.start).filter(Boolean).sort();
  line(`\ndate range in the feed: ${dates[0]} → ${dates[dates.length - 1]}`);
}

// Trumba documents a date window on its feeds. Worth knowing: pulling half a
// megabyte weekly to keep thirty days of it is rude to a public server.
line('\ncan the feed be asked for a window?');
for (const q of ['?days=30', '?startdate=today&days=30', '?filterview=&days=30']) {
  const r = await grab(BASE + q);
  let n = '-';
  try { const j = JSON.parse(r.text); n = Array.isArray(j) ? j.length : 'not an array'; } catch { n = 'unparsed'; }
  line(`   ${String(r.status).padEnd(5)} ${String(r.len).padStart(8)}b  ${String(n).padStart(6)} records  ${q}`);
}

line('\ndone');
