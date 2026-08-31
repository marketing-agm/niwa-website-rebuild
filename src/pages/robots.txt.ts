import type { APIRoute } from 'astro';
import { getSite } from '../lib/site';

export const GET: APIRoute = () => {
  const { config } = getSite();
  const base = config.domain.replace(/\/$/, '');
  // A site running on its temporary *.pages.dev hostname shouldn't be indexed:
  // anything Google learns there has to be migrated later with a change of
  // address, and in the meantime the throwaway host can outrank the real one.
  // seo.noindex keeps the site fully usable and shareable while invisible to
  // search. Flip it off in the same commit that sets the real domain.
  const body = config.seo?.noindex
    ? `# ${config.name} — staging host, not for indexing\nUser-agent: *\nDisallow: /\n`
    : `# ${config.name} — allow all crawlers\nUser-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
