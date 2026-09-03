// The sheet numbers and the rules, across the range of widths the site has to
// hold: 320 (iPhone SE) through 2560 (a wide desktop).
//
// Every shot sets its own viewport — a scenario runs in one page, and a shot
// that inherits the previous one's width photographs a layout nobody asked for.
import { settleReveals, freezeMotion, goToSection } from "./_common.mjs";

const prep = async (p) => { await freezeMotion(p); await settleReveals(p); };
const at = (w, h, id) => async (p) => {
  await p.setViewportSize({ width: w, height: h });
  await prep(p);
  await goToSection(p, id);
  await p.waitForTimeout(350);
};

export default {
  viewport: { width: 1440, height: 900 },
  shots: [
    { name: "01-gallery-1440", caption: "**01 · Gallery.** The sequence starts at one now — it used to start at 02, because the counter ticked on every `<section>` while only four of them showed it.", path: "/?intro=off", action: at(1440, 900, "gallery") },
    { name: "02-building-1440", caption: "**02 · Inside.** The shoji panel was never numbered at all. It is a section head in every sense but its class name, so it joins the sequence.", path: "/?intro=off", action: at(1440, 900, "the-building") },
    { name: "03-floorplans-1440", caption: "**03 · Floor plans.** Was 04.", path: "/?intro=off", action: at(1440, 900, "floor-plans") },
    { name: "04-buildingmap-1440", caption: "**04 · The building.** Was 05.", path: "/?intro=off", action: at(1440, 900, "building-map") },
    { name: "05-availability-1440", caption: "**05 · Available homes.** Was 06.", path: "/?intro=off", action: at(1440, 900, "availability") },
    { name: "06-marumado-1440", caption: "**06 · Come and see.** The other head that was silently unnumbered, now closing the sequence inside its own pane.", path: "/?intro=off", action: at(1440, 900, "marumado") },

    { name: "07-filter-320-before-after", caption: "**320px, the availability filter.** The bedroom pills came to 296px inside a 248px measure, so the whole document scrolled sideways — 333px of page in a 320px window, every section paying for one control. The segmented control wraps now; all four options stay on screen.", path: "/?intro=off", action: at(320, 800, "availability") },
    { name: "08-availability-390", caption: "390px — the same bar with room to spare.", path: "/?intro=off", action: at(390, 844, "availability") },
    { name: "09-gallery-390", caption: "390px — the numbered eyebrow at phone width.", path: "/?intro=off", action: at(390, 844, "gallery") },
    { name: "10-marumado-390", caption: "390px — number and rule inside the marumado's pane.", path: "/?intro=off", action: at(390, 844, "marumado") },
    { name: "11-floorplans-768", caption: "768px — tablet.", path: "/?intro=off", action: at(768, 1024, "floor-plans") },
    { name: "12-gallery-1024", caption: "1024px.", path: "/?intro=off", action: at(1024, 768, "gallery") },
    { name: "13-availability-2560", caption: "2560px — the measure caps and the head keeps its position in the grid rather than drifting to the middle of a very wide screen.", path: "/?intro=off", action: at(2560, 1440, "availability") },
  ],
};
