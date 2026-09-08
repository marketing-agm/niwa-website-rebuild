// Photography for the per-unit-type galleries.
//
// Only the homes themselves. The shared rooms used to fill these grids out —
// lobby, clubroom, gym — were standing in while there was no unit photography,
// and a placeholder that has outlived its reason is just a wrong picture. They
// are still in the page gallery and the building section, where they belong.
//
// The pictures are virtually staged: the rooms and finishes are real, the
// furniture is not.
//
// Two of them are the same shell staged twice: interior-2br-kitchen and
// interior-studio-kitchen are one camera position, with a sofa behind it in
// one and a bed behind it in the other. That is what the staging was made for,
// so both are used, in different sets.

import { photo, type Photo } from './photos';

export type Cell = { photo: Photo };

// The composition is chosen for the number of pictures rather than repeating
// one tile, because with two or three frames there is no repetition to hide
// behind — each one has to be placed.
//
// It stays irregular: unequal widths, unequal heights, cells beside each other
// rather than a column of full-width bands. That asymmetry is the whole look,
// and it is worth a crop. A bento is not a contact sheet — a tall cell showing
// a slice of a room, next to a wide one showing all of it, is the point. What
// it must not do is stack, which is what a set of one-per-row frames does.
//
//   one          two              three
//   ┌───────┐    ┌──────┬───┐     ┌──────────┐
//   │       │    │  A   │ B │     │    A     │   A 6x3
//   │   A   │    └──────┴───┘     ├──────┬───┤
//   │       │    A 4x2, B 2x2     │  B   │ C │   B 4x2, C 2x2
//   └───────┘                     └──────┴───┘
//
// The small cell is two rows, not three. Three made it a sliver: rows are
// sized in vh and columns in a share of the panel, so as the panel narrows the
// cells grow taller relative to their width, and a 2x3 that measures 0.73 on a
// 1440 falls to 0.50 by 700px — a vertical strip of wall. At 2x2 the same cell
// holds between 0.76 and 1.21 across the whole range.
//
// Two tiles two rows, three tiles five, one tiles four — no holes at any
// count. Anything larger falls back to the original eight-cell tile.
const TILE: Array<[number, number]> = [
  [4, 2], [2, 1], [2, 1], [3, 1], [3, 1], [2, 2], [4, 1], [4, 1],
];
const PATTERNS: Record<number, Array<[number, number]>> = {
  1: [[6, 4]],
  2: [[4, 2], [2, 2]],
  3: [[6, 3], [4, 2], [2, 2]],
};

export function spansFor(count: number): Array<[number, number]> {
  return PATTERNS[count] ?? TILE;
}

const SETS: Record<string, string[]> = {
  studio: ['interior-studio-main', 'interior-studio-kitchen'],
  '1br': ['interior-1br-living', 'interior-1br-bedroom'],
  '2br': ['interior-2br-living', 'interior-2br-bedroom', 'interior-2br-kitchen'],
};

export function unitCells(key: string): Cell[] {
  const slugs = SETS[key] ?? SETS.studio;
  return slugs.map((s) => ({ photo: photo(s) }));
}
