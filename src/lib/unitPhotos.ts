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
// Every cell is sized to stay near the 3:2 of the source. Measured on a 1440
// desktop the panel is 1008px across, so a column is 168px and a row 154px:
//
//   6x4 -> 1.64   3x2 -> 1.64      the two shapes used
//   6x3 -> 2.18   a third of the height cropped off a room
//   2x2 -> 1.09   2x3 -> 0.73      would cut the sides off one
//
// So both shapes sit just above the source ratio and crop a sliver of ceiling,
// nothing more. The hierarchy comes from scale instead of from stretching one
// frame into a letterbox: one picture at full width, the rest at half.
//
//   one            two              three
//   ┌─────────┐    ┌─────────┐      ┌─────────┐
//   │    A    │    │    A    │      │    A    │   A 6x4
//   │         │    ├─────────┤      ├────┬────┤
//   └─────────┘    │    B    │      │ B  │ C  │   B, C 3x2
//                  └─────────┘      └────┴────┘
//
// Three tiles six columns by six rows exactly. Two runs to eight: a pair of
// landscapes at a size worth looking at costs that much height, and squeezing
// them into one screen would be the wrong economy — the Photos / Walkthrough
// rail is there so nobody has to scroll past them to reach the tour.
// Anything larger falls back to the original eight-cell tile.
const TILE: Array<[number, number]> = [
  [4, 2], [2, 1], [2, 1], [3, 1], [3, 1], [2, 2], [4, 1], [4, 1],
];
const PATTERNS: Record<number, Array<[number, number]>> = {
  1: [[6, 4]],
  2: [[6, 4], [6, 4]],
  3: [[6, 4], [3, 2], [3, 2]],
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
