// What does one events12 entry look like?
//
// The first pass found the spine: 143 blocks each carrying .event, .date and
// .miles, inside <article> elements, with the title in an <h3> and a .free
// marker on some. That is far more structure than expected and enough to
// parse — but it also showed what the page really is. The headings include
// Ellensburg Rodeo, the Evergreen State Fair, an Olympia waterfront festival
// and acoustic music in Eastern Washington. events12.com/seattle is a guide
// to Washington State, not to Seattle, which is presumably why it carries a
// distance on every entry.
//
// So the parser needs the date and the distance, and the distance is what
// will do most of the work: almost everything here is outside the three miles
// this page promises. This prints three entries whole.
//
// Usage: node scripts/sources/probe-structure.mjs

const URL_ = 'https://www.events12.com/seattle/';
const UA = 'niwa-website-rebuild events probe (+https://github.com/marketing-agm/niwa-website-rebuild)';

const res = await fetch(URL_, { headers: { accept: 'text/html', 'user-agent': UA }, redirect: 'follow' });
const html = await res.text();
console.log(`${res.status} ${res.url}  ${html.length}b`);

const arts = [...html.matchAll(/<article\b[\s\S]{0,3000}?<\/article>/gi)];
console.log(`\n<article> blocks: ${arts.length}`);
for (const [i, m] of arts.slice(0, 3).entries()) {
  console.log(`\n--- article ${i + 1} ---`);
  console.log(m[0].replace(/\s+/g, ' '));
}

// Every distinct .date and .miles value, which is what the filter runs on.
const dates = [...html.matchAll(/class=["'][^"']*\bdate\b[^"']*["'][^>]*>([\s\S]{0,90}?)</gi)].map((m) => m[1].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
const miles = [...html.matchAll(/class=["'][^"']*\bmiles\b[^"']*["'][^>]*>([\s\S]{0,60}?)</gi)].map((m) => m[1].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
console.log(`\n.date values (${dates.length}), first 14:`);
dates.slice(0, 14).forEach((d) => console.log(`   ${JSON.stringify(d)}`));
console.log(`\n.miles values (${miles.length}), first 14:`);
miles.slice(0, 14).forEach((d) => console.log(`   ${JSON.stringify(d)}`));

// How many are actually near? That decides whether this source is worth having.
const near = miles.filter((m) => { const n = parseFloat(m); return Number.isFinite(n) && n <= 3; });
console.log(`\nentries within 3 miles by their own figure: ${near.length} of ${miles.length}`);
const near10 = miles.filter((m) => { const n = parseFloat(m); return Number.isFinite(n) && n <= 10; });
console.log(`within 10 miles: ${near10.length}`);
