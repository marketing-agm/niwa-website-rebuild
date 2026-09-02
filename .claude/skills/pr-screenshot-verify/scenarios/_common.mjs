// Helpers for driving the Niwa page in a scenario's action().
//
// The deposits app needed session builders here because its screens were
// unreachable without seeded state. Niwa is a single static page, so what is
// useful instead is: get to a section, wait for the things that load late, and
// hold still long enough for a screenshot to be worth looking at.

/** Section anchors that exist on the page. Keep in sync with generated/body.html. */
export const SECTIONS = ["top", "floor-plans", "availability", "gallery", "neighborhood", "tour", "faq"];

/**
 * Scroll to a section and wait for it to settle.
 *
 * Uses the in-page anchor rather than a raw scroll so the same smooth-scroll
 * behaviour a visitor gets is what gets photographed.
 */
export async function goToSection(page, id) {
  await page.evaluate((sel) => {
    document.querySelector(sel)?.scrollIntoView({ behavior: "instant", block: "start" });
  }, `#${id}`);
  await page.waitForTimeout(300);
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
