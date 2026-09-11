// The neighbourhood filter is not the problem: 52 of 200 records pass it. So
// something after it is dropping all 52, and the way to find out which stage
// is to walk them with the adapter's own code rather than a copy of it.
//
// Leading suspicion: 134 of the 200 records carry seriesID and repeats, which
// means a recurring series is expressed as one record spanning the whole run.
// If endDateTime is the last occurrence months out, the 90-day run limit —
// which exists to keep standing arrangements off a page about things that
// start — would take every one of them.

import * as sg from './seattle-gov.mjs';
import { plain } from './lib.mjs';

const UA = 'niwa-website-rebuild events probe (+https://github.com/marketing-agm/niwa-website-rebuild)';
const res = await fetch('https://www.trumba.com/calendars/seattlegov-city-wide.json?startdate=today', {
  headers: { accept: 'application/json', 'user-agent': UA },
});
const rows = await res.json();
const line = (s) => console.log(s);
line(`feed: ${rows.length} records`);

const field = (ev, label) => (ev?.customFields ?? []).find((f) => String(f?.label ?? '').toLowerCase() === label.toLowerCase())?.value ?? '';
const NEAR = /queen\s*anne|uptown|seattle\s*center|belltown|south\s*lake\s*union|denny\s*triangle|interbay|magnolia|downtown/i;
const near = rows.filter((r) => !r.canceled
  && !/^(online|virtual)$/i.test(String(r.locationType ?? ''))
  && (NEAR.test(plain(field(r, 'Neighborhoods'))) || NEAR.test(plain(r.location))));
line(`near and live: ${near.length}`);

const now = new Date();
const day0 = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
const cutoff = day0 + 30 * 864e5;
const inst = (l, o) => {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(String(l ?? ''))) return null;
  const off = /^[+-]\d{4}$/.test(String(o ?? '')) ? `${o.slice(0, 3)}:${o.slice(3)}` : 'Z';
  const ms = Date.parse(`${l}${off}`);
  return Number.isFinite(ms) ? ms : null;
};

let badStamp = 0, ended = 0, tooFar = 0, tooLong = 0, ok = 0;
const runs = [];
for (const r of near) {
  const s = inst(r.startDateTime, r.startTimeZoneOffset);
  if (s == null) { badStamp++; continue; }
  const e = inst(r.endDateTime, r.endTimeZoneOffset) ?? s;
  const runDays = (e - s) / 864e5;
  runs.push(runDays);
  if (e < day0) { ended++; continue; }
  if (s > cutoff) { tooFar++; continue; }
  if (runDays > 90) { tooLong++; continue; }
  ok++;
}
line(`\nof those ${near.length}:`);
line(`   unparseable timestamp : ${badStamp}`);
line(`   already ended         : ${ended}`);
line(`   starts past the window: ${tooFar}`);
line(`   runs over 90 days     : ${tooLong}   ← the suspicion`);
line(`   survive               : ${ok}`);

runs.sort((a, b) => a - b);
const at = (p) => runs.length ? runs[Math.min(runs.length - 1, Math.floor(p * runs.length))].toFixed(1) : '-';
line(`\nrun length in days across the near records — min ${at(0)}, median ${at(0.5)}, 90th ${at(0.9)}, max ${runs.length ? runs[runs.length-1].toFixed(1) : '-'}`);
line(`carrying seriesID: ${near.filter((r) => r.seriesID).length} of ${near.length}`);

line('\nfive near records, as the adapter sees them:');
near.slice(0, 5).forEach((r) => {
  const s = inst(r.startDateTime, r.startTimeZoneOffset), e = inst(r.endDateTime, r.endTimeZoneOffset);
  line(`   ${plain(r.title).slice(0, 44).padEnd(46)} ${r.startDateTime} → ${r.endDateTime}  run ${(((e ?? s) - s) / 864e5).toFixed(1)}d  series:${r.seriesID ? 'y' : 'n'}`);
});

line(`\nand what the adapter itself returns: ${sg.normalise(rows, { days: 30 }).length} event(s)`);
line('\ndone');
