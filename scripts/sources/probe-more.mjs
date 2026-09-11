// Why did the City feed contribute nothing?
//
// The run fetched it — 2.8 seconds for half a megabyte — and the adapter kept
// none of the 200 records. Either the neighbourhood filter is wrong, or the
// feed is not carrying what the filter reads, or 200 records is a much
// smaller slice of the month than it looked. This tells them apart instead of
// guessing, by walking the same stages the adapter walks and counting what
// survives each one.

const UA = 'niwa-website-rebuild events probe (+https://github.com/marketing-agm/niwa-website-rebuild)';
const BASE = 'https://www.trumba.com/calendars/seattlegov-city-wide.json';

async function get(url) {
  const res = await fetch(url, { headers: { accept: 'application/json', 'user-agent': UA } });
  const t = await res.text();
  try { return { ok: res.ok, rows: JSON.parse(t), len: t.length }; }
  catch { return { ok: false, rows: [], len: t.length }; }
}
const line = (s) => console.log(s);
const plain = (h) => String(h ?? '').replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
const field = (ev, label) => (ev?.customFields ?? []).find((f) => String(f?.label ?? '').toLowerCase() === label.toLowerCase())?.value ?? '';
const NEAR = /queen\s*anne|uptown|seattle\s*center|belltown|south\s*lake\s*union|denny\s*triangle|interbay|magnolia|downtown/i;

for (const q of ['?startdate=today', '']) {
  const { rows, len } = await get(BASE + q);
  line(`\n${'='.repeat(66)}\n${q || '(no params)'} — ${rows.length} records, ${len}b\n${'='.repeat(66)}`);
  if (!rows.length) continue;

  const days = rows.map((r) => String(r.startDateTime ?? '').slice(0, 10)).filter(Boolean).sort();
  line(`date span: ${days[0]} → ${days[days.length - 1]}  (${new Set(days).size} distinct days)`);

  const withHood = rows.filter((r) => plain(field(r, 'Neighborhoods')));
  line(`records carrying a Neighborhoods field: ${withHood.length} of ${rows.length}`);

  // Every neighbourhood the feed actually names, most common first. If the
  // filter is wrong, the right words are in here.
  const hoods = new Map();
  for (const r of rows) for (const h of plain(field(r, 'Neighborhoods')).split(',').map((s) => s.trim()).filter(Boolean)) {
    hoods.set(h, (hoods.get(h) ?? 0) + 1);
  }
  line(`\ndistinct neighbourhoods named (${hoods.size}):`);
  [...hoods.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40).forEach(([h, n]) => line(`   ${String(n).padStart(4)}  ${h}`));

  // The adapter's stages, counted.
  let live = 0, inPerson = 0, near = 0;
  for (const r of rows) {
    if (r.canceled) continue; live++;
    if (/^(online|virtual)$/i.test(String(r.locationType ?? ''))) continue; inPerson++;
    if (NEAR.test(plain(field(r, 'Neighborhoods'))) || NEAR.test(plain(r.location))) near++;
  }
  line(`\nsurviving each stage:  not cancelled ${live}  →  in person ${inPerson}  →  near ${near}`);

  // What the location text says, for records with no Neighborhoods field —
  // that is the fallback, and it is worth knowing whether it carries anything.
  const noHood = rows.filter((r) => !plain(field(r, 'Neighborhoods'))).slice(0, 12);
  if (noHood.length) {
    line(`\nsample locations on records with no Neighborhoods field:`);
    noHood.forEach((r) => line(`   ${plain(r.location).slice(0, 70) || '(blank)'}  — ${plain(r.title).slice(0, 40)}`));
  }
}

line('\ndone');
