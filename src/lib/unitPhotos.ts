// Photography for the per-unit-type galleries.
//
// The interiors arrived, so each set now opens with the home itself and falls
// back to the shared rooms to fill the tile. They are virtually staged — the
// rooms and finishes are real, the furniture is not — which the note cell says
// out loud rather than leaving a visitor to work out.
//
// Two of them are the same shell staged twice: interior-2br-kitchen and
// interior-studio-kitchen are one camera position, with a sofa behind it in
// one and a bed behind it in the other. That is what the staging was made for,
// so both are used, in different sets. An eighth frame that came with them was
// a second staging of the studio main room, identical but for the lamps, and
// is left out.

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
    'interior-studio-main', 'interior-studio-kitchen',
    'interior-lobby', 'interior-clubroom', 'interior-clubroom-kitchen',
    'exterior-rooftop-terrace', 'interior-fitness-room',
  ],
  '1br': [
    'interior-1br-living', 'interior-1br-bedroom',
    'interior-clubroom', 'interior-clubroom-terrace',
    'exterior-rooftop-terrace', 'interior-lobby', 'interior-fitness-room',
  ],
  '2br': [
    'interior-2br-living', 'interior-2br-bedroom', 'interior-2br-kitchen',
    'interior-clubroom-terrace', 'exterior-rooftop-terrace',
    'interior-lobby', 'interior-fitness-room',
  ],
};

// The note cell earns its place by carrying what the pictures cannot. Every
// photograph in these grids is a shared space, so the note says so plainly and
// points at the walkthrough, which is the only look inside a home we can
// currently offer. It also must not repeat the paragraph in the left rail —
// the two sit on screen together.
const NOTES: Record<string, { label: string; body: string }> = {
  studio: {
    label: 'About these rooms',
    body: 'The studio is virtually staged: the room, the finishes and the view are real, the furniture is not. Lobby, clubroom, rooftop and gym are photographs of the building as it stands. The walkthrough below is unstaged.',
  },
  '1br': {
    label: 'About these rooms',
    body: 'The one bedroom is virtually staged: the rooms, the finishes and the light are real, the furniture is not. Clubroom, terrace, lobby and gym are photographs of the building as it stands. The walkthrough below is unstaged.',
  },
  '2br': {
    label: 'About these rooms',
    body: 'The two bedroom is virtually staged: the rooms, the finishes and the glass are real, the furniture is not. Terrace, clubroom, lobby and gym are photographs of the building as it stands. The walkthrough below is unstaged.',
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
