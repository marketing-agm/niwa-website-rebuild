// What shape is events12.com/seattle?
//
// It is the one calendar of the three still outstanding that answers at all:
// 200 on the listing, and its robots.txt allows /seattle/. Earlier probes
// established there is no feed, no sitemap, no .ics and no JSON-LD anywhere on
// it, so if this is to be a source the listing markup is the only way in and
// the parser has to be written against whatever structure is really there.
//
// This prints enough of it to write that parser: how the page is divided, what
// a single entry looks like, and whether dates are in attributes or only in
// prose.
//
// Usage: node scripts/sources/probe-structure.mjs

const URL_ = 'https://www.events12.com/seattle/';
const UA = 'niwa-website-rebuild events probe (+https://github.com/marketing-agm/niwa-website-rebuild)';

const res = await fetch(URL_, { headers: { accept: 'text/html', 'user-agent': UA }, redirect: 'follow' });
const html = await res.text();
console.log(`${res.status} ${res.url}  ${html.length}b\n`);

// Machine-readable dates, if any exist at all.
console.log(`<time> tags:        ${(html.match(/<time\b/gi) ?? []).length}`);
console.log(`ISO dates:          ${new Set(html.match(/\b20\d{2}-\d{2}-\d{2}\b/g) ?? []).size}`);
console.log(`itemprop/microdata: ${(html.match(/itemprop=/gi) ?? []).length}`);
console.log(`JSON-LD blocks:     ${(html.match(/application\/ld\+json/gi) ?? []).length}`);

// How is the page divided? Month headings are the likely spine.
const heads = [...html.matchAll(/<h([1-4])[^>]*>([\s\S]{0,120}?)<\/h\1>/gi)].map((m) => `h${m[1]}: ${m[2].replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim()}`);
console.log(`\nheadings (${heads.length}):`);
heads.slice(0, 24).forEach((h) => console.log('   ' + h));

// Which classes repeat? That is the entry container, if there is one.
const cls = {};
for (const m of html.matchAll(/class=["']([^"']+)["']/g)) for (const c of m[1].split(/\s+/)) if (c) cls[c] = (cls[c] ?? 0) + 1;
console.log('\nmost repeated classes:');
Object.entries(cls).sort((a,b)=>b[1]-a[1]).slice(0, 20).forEach(([c,n]) => console.log(`   ${String(n).padStart(4)}  .${c}`));

// Tag histogram in the body, to see whether entries are <p>, <li> or divs.
const tags = {};
for (const m of html.matchAll(/<([a-z][a-z0-9]*)\b/gi)) { const t=m[1].toLowerCase(); tags[t]=(tags[t]??0)+1; }
console.log('\ntag counts:');
Object.entries(tags).sort((a,b)=>b[1]-a[1]).slice(0, 16).forEach(([t,n]) => console.log(`   ${String(n).padStart(5)}  <${t}>`));

// A date written in prose is the thing to look for: "September 13", "Sep 13-14".
const MONTH = '(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*';
const proseDates = html.match(new RegExp(`${MONTH}\\\\.?\\\\s+\\\\d{1,2}`, 'g')) ?? [];
console.log(`\nprose dates like "September 13": ${proseDates.length}`);
console.log('   ' + [...new Set(proseDates)].slice(0, 12).join(' | '));

// And a slice around the first one, in context, which is what the parser must
// actually cope with.
const at = html.search(new RegExp(`${MONTH}\\\\.?\\\\s+\\\\d{1,2}`));
if (at > 0) {
  console.log('\n--- 2600 chars around the first prose date ---');
  console.log(html.slice(Math.max(0, at - 800), at + 1800).replace(/\s+/g, ' '));
}
