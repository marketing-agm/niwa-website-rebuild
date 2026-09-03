// The three layouts, described from the live feed.
//
// units.json is refreshed from AppFolio; nothing here is hand-maintained.
// Square footage and "from" rent are ranges over every home currently
// listed for the layout, and the availability counts are what the feed says
// today. Tours come from site.config.json -> floorPlans.
export type Home = {
  key: string;
  name: string;
  beds: number;
  baths: number;
  sqftMin: number;
  sqftMax: number;
  rentMin: number;
  rentMax: number;
  now: number;
  soon: number;
  tours: { label: string; url: string }[];
};

const NAMES: Record<string, string> = { studio: 'Studio', '1br': 'One bedroom', '2br': 'Two bedroom' };
const keyOf = (plan: string) => {
  const m = String(plan || '').match(/^(studio|\d+br)/);
  return m ? m[1] : String(plan || '');
};
const bedsOf = (key: string) => (key === 'studio' ? 0 : parseInt(key, 10) || 0);
const mode = (vals: number[]) => {
  const c = new Map<number, number>();
  vals.forEach((v) => c.set(v, (c.get(v) || 0) + 1));
  let best = 0, n = 0;
  c.forEach((k, v) => { if (k > n) { n = k; best = v; } });
  return best;
};

export function getHomes(config: any, units: any[]): Home[] {
  const fp: Record<string, any> = config.floorPlans ?? {};
  const keys = Array.from(new Set([...Object.keys(fp), ...units.map((u) => keyOf(u.plan))]))
    .filter(Boolean)
    .sort((a, b) => bedsOf(a) - bedsOf(b));
  return keys.map((key) => {
    const mine = units.filter((u) => keyOf(u.plan) === key);
    const sqft = mine.map((u) => Number(u.sqft)).filter((n) => n > 0);
    const rent = mine.map((u) => Number(u.rent)).filter((n) => n > 0);
    return {
      key,
      name: NAMES[key] ?? key,
      beds: mine.length ? mode(mine.map((u) => Number(u.beds))) : bedsOf(key),
      baths: mine.length ? mode(mine.map((u) => Number(u.baths))) : Number(fp[key]?.baths ?? 1),
      sqftMin: sqft.length ? Math.min(...sqft) : 0,
      sqftMax: sqft.length ? Math.max(...sqft) : 0,
      rentMin: rent.length ? Math.min(...rent) : 0,
      rentMax: rent.length ? Math.max(...rent) : 0,
      now: mine.filter((u) => u.availType === 'now').length,
      soon: mine.filter((u) => u.availType !== 'now').length,
      tours: fp[key]?.tours ?? [],
    };
  });
}

export const money = (n: number) => '$' + Number(n).toLocaleString('en-US');
export const int = (n: number) => Number(n).toLocaleString('en-US');
