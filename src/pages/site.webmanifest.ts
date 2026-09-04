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
      // 'any' only. Android crops a maskable icon to a circle of radius 40% —
      // r = 25.6 on the favicon's 64-unit grid — and the mark is now a
      // full-bleed circle at r = 32, so declaring it maskable would have the
      // platform shave the disc's edge off. The N itself clears the safe zone
      // with 2.3 units to spare; it is the ground that does not. A dedicated
      // maskable icon drawn inside r = 25.6 could be added back later.
      { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  };
  return new Response(JSON.stringify(manifest, null, 2), {
    headers: { 'Content-Type': 'application/manifest+json; charset=utf-8' },
  });
};
