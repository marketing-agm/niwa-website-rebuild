import { defineConfig } from 'astro/config';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Files in public/ that reference the site's own absolute URL (guide
// canonicals, og:url, JSON-LD breadcrumbs, llms.txt) write it as the token
// {{SITE_DOMAIN}} rather than a literal host.
//
// Astro templates read site.config.json directly, but public/ is copied
// byte-for-byte, so without substitution a literal host would silently survive
// a custom-domain migration — leaving canonicals that tell Google the OLD host
// is the authoritative one. Changing the domain should be a one-line config
// edit, and this is what makes that true.
const SUBSTITUTABLE = new Set(['.html', '.htm', '.txt', '.xml', '.json', '.css', '.js', '.md']);

function substituteDomain(rootDir, domain) {
  let count = 0;
  for (const entry of readdirSync(rootDir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !SUBSTITUTABLE.has(extname(entry.name).toLowerCase())) continue;
    const file = join(entry.parentPath || entry.path || rootDir, entry.name);
    const before = readFileSync(file, 'utf8');
    if (!before.includes('{{SITE_DOMAIN}}')) continue;
    writeFileSync(file, before.replaceAll('{{SITE_DOMAIN}}', domain));
    count++;
  }
  return count;
}

function resolveSiteDomain() {
  return {
    name: 'resolve-site-domain',
    hooks: {
      'astro:build:done': ({ dir }) => {
        const configPath = fileURLToPath(new URL('./src/site/site.config.json', import.meta.url));
        const domain = String(JSON.parse(readFileSync(configPath, 'utf8')).domain || '').replace(/\/$/, '');
        // Loud rather than silent: an unresolved {{SITE_DOMAIN}} would ship a
        // literal token into a canonical tag.
        if (!domain) throw new Error('[resolve-site-domain] src/site/site.config.json has no "domain"');
        const n = substituteDomain(fileURLToPath(dir), domain);
        if (n) console.log(`[resolve-site-domain] resolved {{SITE_DOMAIN}} → ${domain} in ${n} file(s)`);
      },
    },
  };
}

// Static output — no server runtime. One Cloudflare Pages project builds this
// repo straight to dist/.
export default defineConfig({
  output: 'static',
  build: { format: 'file' },
  integrations: [resolveSiteDomain()],
});
