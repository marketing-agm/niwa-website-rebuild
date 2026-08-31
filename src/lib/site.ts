// Loads Niwa's content at build time.
//
// This repo forked from the shared AGM apartment template, which rendered many
// properties from one codebase and picked between them with a SITE environment
// variable and an import.meta.glob over src/sites/*. There is one property
// here, so that indirection is gone: the JSON is imported directly, which means
// a typo in a filename is a build error rather than a "site not found" thrown
// at runtime.

import config from '../site/site.config.json';
import unitsJson from '../site/units.json';
import placesJson from '../site/places.json';
import photosJson from '../site/photos.json';
import busStopsJson from '../site/bus-stops.json';
import faqJson from '../site/faq.json';

export type SiteConfig = typeof config;

/** "+1-206-694-1713" -> "(206) 694-1713". Non-10-digit numbers pass through. */
export function formatPhone(raw: string | undefined): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
  return digits.length === 10
    ? `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
    : raw;
}

export function getSite() {
  return {
    id: 'niwa',
    config: config as any,
    data: {
      units: (unitsJson as any).units,
      places: (placesJson as any).places,
      photos: (photosJson as any).photos,
      busStops: busStopsJson as any,
    },
    // Optional — an empty list simply renders no FAQ section.
    faq: (faqJson as any).faq || [],
  };
}
