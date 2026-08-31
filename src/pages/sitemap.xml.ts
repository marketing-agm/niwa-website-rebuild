import type { APIRoute } from 'astro';
import { getSite } from '../lib/site';

type SitemapPage = { path: string; changefreq?: string; priority?: number };

export const GET: APIRoute = () => {
  const { config } = getSite();
  const base = config.domain.replace(/\/$/, '');
  const today = new Date().toISOString().slice(0, 10);

  // Homepage first, then any per-site extra pages (guides, etc.) from config.
  const entries: SitemapPage[] = [
    { path: '/', changefreq: 'weekly', priority: 1.0 },
    ...((config.sitemap?.pages as SitemapPage[]) ?? []),
  ];

  const urls = entries
    .map((p) => `  <url>
    <loc>${base}/${p.path.replace(/^\//, '')}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${p.changefreq ?? 'monthly'}</changefreq>
    <priority>${(p.priority ?? 0.7).toFixed(1)}</priority>
  </url>`)
    .join('\n');

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
