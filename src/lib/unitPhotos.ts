// Photography for the per-unit-type galleries.
//
// A caveat worth stating plainly, because it shapes everything below: there is
// no interior unit photography in this repo. Every interior we have is a shared
// space — clubroom, lobby, vestibule, elevator hall, fitness room. So these
// sets are honest about what they show. A studio's grid is the studio's
// building, not the studio, and every caption names the real room.
//
// When unit interiors do arrive, drop them in src/assets/gallery, add them to
// photos.json, and list their slugs here. Nothing else has to change: the grid
// pattern is fixed and independent of the photo count, so the layout does not
// shift underneath the new pictures.

import { photo, type Photo } from './photos';

export type Cell =
  | { kind: 'photo'; photo: Photo }
  | { kind: 'note'; label: string; body: string };

// The grid is a fixed rhythm rather than per-photo spans, so adding or removing
// a picture can never leave a hole. Eight cells tile a six-column grid across
// five rows exactly:
//
//   ┌───────────┬─────┐   A 4x2   E 3x1
//   │     A     │  B  │   B 2x1   F 2x2
//   │           ├─────┤   C 2x1   G 4x1
//   │           │  C  │   D 3x1   H 4x1
//   ├──────┬────┴─────┤
//   │  D   │    E     │
//   ├───┬──┴──────────┤
//   │ F │      G      │
//   │   ├─────────────┤
//   │   │      H      │
//   └───┴─────────────┘
//
// 4·2 + 2·1 + 2·1 + 3·1 + 3·1 + 2·2 + 4·1 + 4·1 = 30 = 6 columns × 5 rows.
export const SPANS: Array<[number, number]> = [
  [4, 2], [2, 1], [2, 1], [3, 1], [3, 1], [2, 2], [4, 1], [4, 1],
];

// Seven photos and one note per type — eight cells, one whole tile of the
// pattern. The orders differ so the three galleries do not read as one gallery
// shown three times.
const SETS: Record<string, string[]> = {
  studio: [
    'interior-lobby', 'interior-vestibule', 'interior-elevator-hall',
    'interior-clubroom', 'interior-clubroom-kitchen',
    'exterior-rooftop-terrace', 'interior-fitness-room',
  ],
  '1br': [
    'interior-clubroom', 'interior-clubroom-kitchen', 'interior-clubroom-terrace',
    'exterior-rooftop-terrace', 'interior-lobby',
    'interior-fitness-room', 'exterior-paseo',
  ],
  '2br': [
    'interior-clubroom-terrace', 'exterior-rooftop-terrace', 'interior-clubroom',
    'interior-lobby', 'interior-elevator-hall',
    'interior-fitness-room', 'exterior-entrance',
  ],
};

// The note cell earns its place by carrying what the pictures cannot. Every
// photograph in these grids is a shared space, so the note says so plainly and
// points at the walkthrough, which is the only look inside a home we can
// currently offer. It also must not repeat the paragraph in the left rail —
// the two sit on screen together.
const NOTES: Record<string, { label: string; body: string }> = {
  studio: {
    label: 'The rest of it',
    body: 'Lobby, clubroom, rooftop and gym — the parts of the building every studio shares. For the home itself, take the walkthrough below.',
  },
  '1br': {
    label: 'The rest of it',
    body: 'The shared rooms a one bedroom opens onto: clubroom, kitchen, terrace and the walk along the paseo. The home itself is in the walkthrough below.',
  },
  '2br': {
    label: 'The rest of it',
    body: 'Terrace, clubroom, lobby and gym — what a two bedroom shares with the rest of the building. For the home itself, take the walkthrough below.',
  },
};

export function unitCells(key: string): Cell[] {
  const slugs = SETS[key] ?? SETS.studio;
  const note = NOTES[key] ?? NOTES.studio;
  const cells: Cell[] = slugs.map((s) => ({ kind: 'photo' as const, photo: photo(s) }));
  // The note lands in the F slot — the 2x2 — where a tall block of text sits
  // comfortably and gives the eye somewhere to rest between pictures.
  cells.splice(5, 0, { kind: 'note', ...note });
  return cells;
}
