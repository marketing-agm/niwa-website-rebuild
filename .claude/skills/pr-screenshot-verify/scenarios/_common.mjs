// Helpers for driving the Niwa page in a scenario's action().
//
// The deposits app needed session builders here because its screens were
// unreachable without seeded state. Niwa is a single static page, so what is
// useful instead is: get to a section, wait for the things that load late, and
// hold still long enough for a screenshot to be worth looking at.

/**
 * Anchors on the page, split by what they actually are.
 *
 * Not everything with an anchor is a section. `tour`, `faq` and `neighborhood`
 * used to be sections and are now dialogs (`#<name>-overlay`, role="dialog"),
 * with the old hashes kept working as deep links. Scrolling to `#faq` therefore
 * finds nothing and does nothing — which is how a "tour form" shot ended up
 * being a photograph of the top of the page.
 */
export const SECTIONS = ["top", "floor-plans", "availability", "gallery"];
export const SHEETS = ["tour", "faq", "neighborhood"];

/**
 * Scroll to a section and wait for it to settle.
 *
 * Uses the in-page anchor rather than a raw scroll so the same smooth-scroll
 * behaviour a visitor gets is what gets photographed.
 *
 * Throws if the target isn't there. A missing anchor used to scroll nowhere and
 * return happily, so the shot silently captured whatever was already on screen —
 * a failure mode that looks like a successful run and has cost several rounds.
 */
export async function goToSection(page, id) {
  const found = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return false;
    el.scrollIntoView({ behavior: "instant", block: "start" });
    return true;
  }, `#${id}`);
  if (!found) {
    throw new Error(
      `goToSection("${id}"): no #${id} on the page. ` +
      (SHEETS.includes(id) ? `It is a dialog — use openSheet(page, "${id}").` : "Check the anchor name.")
    );
  }
  await page.waitForTimeout(300);
}

/**
 * Open one of the dialog sheets (tour, faq, neighborhood).
 *
 * app.js opens these from the matching hash, on load or on an in-page link, so
 * navigating to `/#faq` is the same path a visitor takes from the footer.
 */
export async function openSheet(page, name) {
  await page.evaluate((n) => {
    const link = document.querySelector(`a[href="#${n}"]`);
    if (link) link.click();
    else window.location.hash = `#${n}`;
  }, name);
  await page.waitForSelector(`#${name}-overlay.is-open`, { timeout: 5000 });
  await page.waitForTimeout(500);
}

/**
 * Wait for scroll-reveal animations to have run.
 *
 * The template reveals blocks with IntersectionObserver on scroll. Screenshot too
 * early and you photograph a page of invisible elements — which looks exactly like
 * a broken build. This forces every reveal to its final state.
 */
export async function settleReveals(page) {
  await page.evaluate(() => {
    document.querySelectorAll(".reveal, [data-reveal]").forEach((el) => {
      el.classList.add("is-visible", "revealed");
      el.style.opacity = "1";
      el.style.transform = "none";
    });
  });
  await page.waitForTimeout(200);
}

/**
 * Wait for the hero media to actually be showing something.
 *
 * A hero video that has not reached its first frame photographs as a black
 * rectangle, which is indistinguishable from a video that failed to load. Waits
 * for the poster or first frame, and gives up rather than hanging.
 */
export async function heroReady(page, timeout = 6000) {
  await page.waitForFunction(() => {
    const v = document.querySelector(".hero video, video[data-hero]");
    if (v) return v.readyState >= 2;                 // HAVE_CURRENT_DATA
    const img = document.querySelector(".hero img, [class*='hero'] img");
    return !img || img.complete;
  }, { timeout }).catch(() => {});
}

/** Dismiss anything overlaying the page, so it does not eat the first click. */
export async function dismissOverlays(page) {
  await page.evaluate(() => {
    document.querySelectorAll("[data-overlay], .modal.is-open, .lightbox.is-open")
      .forEach((el) => el.remove());
    document.body.style.overflow = "";
  });
}

/** Open the photo gallery lightbox on the Nth photo (0-indexed). */
export async function openGallery(page, n = 0) {
  await goToSection(page, "gallery");
  const tiles = page.locator(".gallery-card, .gallery-item, [data-gallery-index]");
  if (await tiles.count() > n) {
    await tiles.nth(n).click();
    await page.waitForTimeout(500);
  }
}

/** Select a floor-plan tab by its label, e.g. "Studio", "1 Bed", "2 Bed". */
export async function selectPlan(page, label) {
  await goToSection(page, "floor-plans");
  const tab = page.getByRole("button", { name: new RegExp(label, "i") }).first();
  if (await tab.count()) { await tab.click(); await page.waitForTimeout(400); }
}

/** Freeze CSS animation so repeated runs produce comparable images. */
export async function freezeMotion(page) {
  await page.addStyleTag({
    content: `*, *::before, *::after {
      animation-duration: 0s !important; animation-delay: 0s !important;
      transition-duration: 0s !important; transition-delay: 0s !important;
    }`,
  });
}

/**
 * Wait for the hero background loop to be showing real frames.
 *
 * `heroReady()` covers a still hero. This is the stricter check the video needs:
 * app.js only adds `video-ready` once the element has decoded data, so waiting on
 * that class is what separates "the loop is playing" from "the poster is showing
 * because the file 404'd" — two things that photograph almost identically.
 *
 * Note for anyone reading a run: this environment's headless Chromium has no
 * H.264 decoder. The loop ships VP9/WebM first so it plays here, but the full
 * film is MP4 only and will photograph as its poster frame, not as video.
 */
export async function videoReady(page, timeout = 8000) {
  await page.waitForFunction(() => {
    const v = document.querySelector(".hero-video");
    if (!v) return true;                              // mode is modal or off
    return v.readyState >= 2 && document.querySelector(".hero-visual.video-ready");
  }, { timeout }).catch(() => {});
  // Land on a frame with something in it rather than the first dark frame.
  await page.evaluate(() => {
    const v = document.querySelector(".hero-video");
    if (v && Number.isFinite(v.duration)) { v.pause(); v.currentTime = 1.2; }
  });
  await page.waitForTimeout(350);
}

/** Open the expanded film from the hero control and wait for the dialog. */
export async function openVideoModal(page) {
  await page.click(".hero-video-btn");
  await page.waitForSelector(".video-modal:not([hidden])", { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(600);
}
