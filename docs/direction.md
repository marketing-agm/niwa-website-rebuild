# Direction — the dark rebuild

Notes from the 3 Sep session, plus the answers that settled them. This is the
working brief, not a changelog: it says what was decided and what is still
open, so the next session does not re-litigate settled things or guess at
unsettled ones.

Nothing in here is built yet except where it says **done**.

---

## Settled

### 1. The site goes dark

Not a toggle, not a system-preference follow. One art-directed dark page.
Reference given: *dark, moody, sushi restaurant, Nobu*.

Starting palette, to be argued with once it is on screen:

| Token | Value | Job |
|---|---|---|
| ground | `#0E0D0C` | near-black, warm rather than blue |
| surface | `#161412` | panels, cards, the lattice cells |
| rule | `#2A2724` | the lattice itself |
| type | `#EDE8E0` | warm off-white |
| accent | `#F1E249` | the bright yellow |

The reason this unlocks the rest of the list: **on near-black the bright yellow
finally measures as an ink.**

| | on white | on `#0E0D0C` |
|---|---|---|
| `#F1E249` bright | 1.34:1 — unusable | ~11:1 |
| `#FFFCCC` pale | 1.05:1 — fill only | ~17:1 |

Every argument this project has had about yellow type came from trying to set
it on white. That argument goes away.

### 2. Both yellows come back, everywhere

`#F1E249` bright and `#FFFCCC` pale, as a two-yellow system rather than the one
we consolidated to. Bright for the loud things, pale for the quiet ones — to be
specified properly once the dark ground exists, because the roles only make
sense against it.

### 3. The arrival film — **done**

- **Cut at 21.3s.** The "NOW LEASING · 206-622-9991 / LEASING@NIWAAPARTMENTS.COM"
  end card fades up between 21.3s and 21.6s and then flashes for the remaining
  eight seconds. 21.3s keeps the clean aerial as the last shot and ends before
  the card.
- **Slowed to 0.6×.** 21.3s of source becomes ~35.5s on screen.
- Net: longer than the 30s it was, with a third less footage, held much longer.
  The skip control is on screen from the first frame, as before.

### 4. The offer goes in the moving bar — **done**

"One month free" is in the marquee band under the hero, as the first item.

It is set as a **black chip with pale-yellow type**, not in the band's italic
serif. A rent concession is not an amenity: set identically to "24-hour fitness
center" it scrolls past as the fourth feature in a list of features — the one
line a renter would stop for, dressed as the one they would not.

A marquee item may now be a plain string or `{ "text": "…", "offer": true }`.

> **Needs Helen:** the fine print. The band this markup replaced said "One month
> free · 12-month lease", but that was *Magnolia's* concession rendering on
> Niwa's page, which is why it was removed. Niwa's terms — what lease length,
> when it expires — have not been supplied, so the page currently advertises
> "One month free" bare.

---

## Understood, not yet specified

### 5. "Apply the grid thing to everything"

The shoji lattice becomes the layout system for the whole page rather than two
sections of it — **while keeping normal scrolling and normal flow**. Explicitly
not the pinned/hijacked scroll.

Open: whether every section becomes a lattice, or the lattice becomes the
underlying grid that sections align to. The second is likelier to survive.

### 6. "Walk the building line thing"

Identified by screenshot: the **hairline rule above the "Walk the building"
block**, at the foot of the gallery.

Open: what to do with it. Two readings — make it a drawn route joining the
three walkthrough buttons (clubroom → deck → fitness) so they read as a path
through the building, or the rule itself is the problem and wants removing.

### 7. Interactive map

Open: which map. Two candidates —

- **The neighbourhood map** renders with zero places and zero bus stops.
  `places.json` and `bus-stops.json` are both empty files. That is issue #12 and
  it needs a list of what to pin.
- **SightMap**, the building map, is embedded and working but sits low on the
  page in a modest frame.

Helen said she can show which one.

---

## Blocked on files or facts

### 8. Floor plan drawings

The floor-plan tab still shows "Floor Plans Coming Soon" for all three layouts.
Helen has a zip of the drawings. **The zip has not been sent** — nothing to
work from yet.

### 9. Matterport, only where it is honest

Rule as given: **do not attach a Matterport tour to a specific unit unless the
tour is of that exact unit type.** If the tour is not the same thing as what
the renter is looking at, it should not be presented as that unit's tour.

**Checked, and the site already complies.** Tours are attached per *layout* —
studio, 1 bed (furnished and unfurnished), 2 bed — and never per unit. The only
"tour" on a unit card or in the unit drawer is `<a href="#tour">Schedule a
tour</a>`, which goes to the booking form, not to Matterport. Nothing on the
page presents a walkthrough as being of a particular unit.

So this is a rule to hold to rather than a bug to fix — it matters the moment
someone is tempted to hang a tour off an availability row.

---

## Standing constraints

- Nothing reaches `main` except a merge. Stop at the preview URL and hand it
  over.
- Cloudflare deploys from git. Never `wrangler deploy` by hand, and do not touch
  Cloudflare settings.
- Production branch is `claude/niwa-website-rebuild-setup-4i1y68`, not `main`.
  Shipping is: merge the PR to `main`, then fast-forward that branch.
- Nothing happens to the Magnolia repo.
- Keys placed in `site.config.json` ship to the browser in `window.__SITE__` and
  are public. Never a private key.

## Still open from before, unrelated to this list

- **#11** — the tour form silently discards submissions. Needs EmailJS keys.
- **#12** — the neighbourhood map has no data (see 7 above).
- **#10** — ~18MB of video in git.
- **#16** — the rent range on the page and the range in the feed disagree.
