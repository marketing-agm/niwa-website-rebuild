import type { APIRoute } from 'astro';
import { getSite } from '../lib/site';

export const GET: APIRoute = () => {
  const { config } = getSite();
  const manifest = {
    name: config.name,
    short_name: config.shortName,
    description: config.manifest?.description || config.seo.description,
    start_url: '/',
    display: 'standalone',
    background_color: config.theme.backgroundColor,
    theme_color: config.theme.themeColor,
    icons: [
      { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
    ],
  };
  return new Response(JSON.stringify(manifest, null, 2), {
    headers: { 'Content-Type': 'application/manifest+json; charset=utf-8' },
  });
};
