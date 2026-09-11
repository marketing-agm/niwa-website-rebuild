// Round three. Round two found the thing that matters: seattle.gov's event
// calendar is not hand-built and is not Drupal — it loads
// https://www.trumba.com/scripts/spuds.js, which means the City publishes its
// calendar through Trumba.
//
// That changes the question entirely. Trumba is a calendar publishing
// platform whose whole purpose is syndication: every calendar it hosts serves
// .rss, .ics, .xml and .json off a stable path, and those feeds exist to be
// consumed. So there is nothing to scrape here — there is a feed to subscribe
// to, if the calendar's web name can be read off the page that embeds it.
//
// A Trumba embed configures itself with $Trumba.addSpud({ webName: '...' }),
// so this pulls the inline script out of the page and reads it, then asks the
// feed for that name in each format.

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

line('='.repeat(70));
line('seattle.gov runs on Trumba — find the calendar name');
line('='.repeat(70));

const page = await grab('https://www.seattle.gov/event-calendar', 'text/html');
line(`listing ${page.status} ${page.len}b`);

// Every inline script, so nothing about the embed is missed.
const inline = [...page.text.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1].trim()).filter(Boolean);
line(`\ninline scripts: ${inline.length}`);
const trumbaBits = inline.filter((s) => /trumba|spud|webName/i.test(s));
line(`mentioning Trumba: ${trumbaBits.length}`);
trumbaBits.forEach((s, i) => line(`\n--- inline #${i + 1} ---\n${s.slice(0, 1200)}`));

// Whatever the markup says, collect every candidate name.
const names = new Set();
for (const m of page.text.matchAll(/webName\s*:\s*["']([^"']+)["']/gi)) names.add(m[1]);
for (const m of page.text.matchAll(/trumba\.com\/calendars\/([A-Za-z0-9_.-]+)/gi)) names.add(m[1]);
for (const m of page.text.matchAll(/["']([A-Za-z0-9_-]*seattle[A-Za-z0-9_-]*)["']\s*[,}]/gi)) names.add(m[1]);
line(`\ncandidate calendar names: ${[...names].join(', ') || '(none found in the markup)'}`);

// Trumba serves each calendar in four formats off one path.
const FORMATS = ['.rss', '.ics', '.xml', '.json'];
const tryName = async (name) => {
  line(`\n${name}`);
  for (const f of FORMATS) {
    const r = await grab(`https://www.trumba.com/calendars/${name}${f}`, '*/*');
    const good = r.ok && r.len > 400;
    line(`   ${String(r.status || r.error).padEnd(5)} ${r.type.padEnd(26)} ${String(r.len).padStart(9)}b  ${f}${good ? '  ← SERVES' : ''}`);
    if (good && f === '.json') line(`        head: ${r.text.slice(0, 500)}`);
    if (good && f === '.rss') {
      const titles = [...r.text.matchAll(/<title>([\s\S]*?)<\/title>/gi)].slice(1, 4).map((m) => m[1].trim());
      line(`        first items: ${titles.join(' | ').slice(0, 240)}`);
    }
  }
};

for (const n of [...names].slice(0, 6)) await tryName(n);
// The City's calendar is conventionally named for the publisher if nothing
// was found in the markup.
if (!names.size) for (const n of ['cityofseattle', 'seattlegov', 'seattle']) await tryName(n);

line('\ndone');
