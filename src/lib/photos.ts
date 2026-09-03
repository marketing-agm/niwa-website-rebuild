// Photography, resolved at build time.
//
// photos.json keeps its public-style `src` ("/images/gallery/<file>.jpg") so
// the CMS contract is unchanged, but the files themselves now live in
// src/assets/gallery so Astro can emit responsive WebP sets instead of shipping
// a 2000px JPEG to a phone. A reference to a file that isn't there is a build
// error, not a broken image.
import type { ImageMetadata } from 'astro';
import photosJson from '../site/photos.json';

const files = import.meta.glob<ImageMetadata>('../assets/gallery/*.jpg', { eager: true, import: 'default' });
const byName: Record<string, ImageMetadata> = {};
for (const [path, meta] of Object.entries(files)) {
  byName[path.split('/').pop()!.replace(/\.jpg$/i, '')] = meta;
}

export type Photo = {
  id: number;
  cat: string;
  slug: string;
  title: string;
  desc: string;
  alt: string;
  img: ImageMetadata;
};

export const photos: Photo[] = (photosJson as any).photos.map((p: any) => {
  const slug = String(p.src).split('/').pop()!.replace(/\.jpg$/i, '');
  const img = byName[slug];
  if (!img) throw new Error(`photos.json references ${p.src}, but src/assets/gallery/${slug}.jpg does not exist`);
  return { id: p.id, cat: p.cat, slug, title: p.title, desc: p.desc, alt: `${p.title} — ${p.desc}`, img };
});

export function photo(slug: string): Photo {
  const p = photos.find((x) => x.slug === slug);
  if (!p) throw new Error(`No photo with slug "${slug}"`);
  return p;
}
