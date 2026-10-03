// email-driver.mjs: what email-gifs.mjs puts in the page, and the helpers a
// clip drives it with. Kept apart so a clips file can be read next to it.

// The pointer and the click ripple, in every document the clip visits. The
// position survives page loads in sessionStorage, which a sandboxed frame
// refuses, hence the guard.
export const CURSOR = `(() => {
  const K = '__demo';
  const store = (() => { try { return window.sessionStorage; } catch (e) { return null; } })();
  let x = Number(store && store.getItem(K + 'x')) || 640, y = Number(store && store.getItem(K + 'y')) || 380, cur;
  const place = () => { if (cur) cur.style.transform = 'translate(' + (x - 3) + 'px,' + (y - 2) + 'px)'; };
  const install = () => {
    if (document.getElementById(K + 'cur')) return;
    const st = document.createElement('style');
    st.textContent = '#' + K + 'cur{position:fixed;left:0;top:0;width:24px;height:28px;z-index:2147483647;pointer-events:none}'
      + '.' + K + 'rip{position:fixed;z-index:2147483646;pointer-events:none;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;'
      + 'border:3px solid #1b6ec2;background:rgba(27,110,194,.16);animation:' + K + 'rip .55s ease-out forwards}'
      + '@keyframes ' + K + 'rip{from{transform:scale(.3);opacity:1}to{transform:scale(1.2);opacity:0}}';
    document.documentElement.appendChild(st);
    cur = document.createElement('div');
    cur.id = K + 'cur';
    cur.innerHTML = '<svg width="24" height="28" viewBox="0 0 24 28" xmlns="http://www.w3.org/2000/svg"><path d="M3 2.5v19.2l4.9-4.6 3.4 7.9 3.3-1.4-3.3-7.7h6.8z" fill="#111" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/></svg>';
    document.documentElement.appendChild(cur);
    place();
  };
  window[K + 'ripple'] = (px, py) => {
    const r = document.createElement('div');
    r.className = K + 'rip';
    r.style.left = (px == null ? x : px) + 'px';
    r.style.top = (py == null ? y : py) + 'px';
    document.documentElement.appendChild(r);
    setTimeout(() => r.remove(), 800);
  };
  addEventListener('mousemove', (e) => {
    x = e.clientX; y = e.clientY;
    if (store) { store.setItem(K + 'x', x); store.setItem(K + 'y', y); }
    place();
  }, true);
  addEventListener('mousedown', (e) => window[K + 'ripple'](e.clientX, e.clientY), true);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
})();`;

/** Waits for web fonts and the page's own arrival motion. */
export async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(450);
}

/** The helpers a clip drives the page with. */
export function driver(page, pos, say) {
  const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
  const moveTo = async (x, y, ms = 600) => {
    const n = Math.max(6, Math.round(ms / 22));
    const [x0, y0] = [pos.x, pos.y];
    for (let i = 1; i <= n; i++) {
      const e = ease(i / n);
      await page.mouse.move(x0 + (x - x0) * e, y0 + (y - y0) * e);
      await page.waitForTimeout(ms / n);
    }
    pos.x = x; pos.y = y;
  };
  const target = async (sel, at = "center") => {
    const el = page.locator(sel).first();
    await el.waitFor({ state: "visible", timeout: 8000 });
    await el.scrollIntoViewIfNeeded();
    const b = await el.boundingBox();
    if (!b) throw new Error("not on screen: " + sel);
    const x = at === "left" ? b.x + Math.min(90, b.width / 2) : b.x + b.width / 2;
    return [Math.round(x), Math.round(b.y + b.height / 2)];
  };
  const glide = async (sel, { at, ms } = {}) => { const [x, y] = await target(sel, at); await moveTo(x, y, ms); };
  const press = async () => { await page.waitForTimeout(160); await page.mouse.down(); await page.waitForTimeout(90); await page.mouse.up(); };
  const d = {
    page, say, glide, moveTo,
    wait: (ms) => page.waitForTimeout(ms),
    /** Glide to it and click. `at: 'left'` aims at the start of a wide row, where the words are. */
    click: async (sel, opts) => { await glide(sel, opts); await press(); },
    /** Click something that loads a new page, and wait for it. */
    clickNav: async (sel, opts) => {
      await glide(sel, opts);
      const nav = page.waitForNavigation({ waitUntil: "networkidle" });
      await press();
      await nav;
      await settle(page);
    },
    pressNav: async (key) => {
      const nav = page.waitForNavigation({ waitUntil: "networkidle" });
      await page.keyboard.press(key);
      await nav;
      await settle(page);
    },
    type: (text, delay = 90) => page.keyboard.type(text, { delay }),
    fill: async (sel, text, opts) => { await d.click(sel, opts); await page.keyboard.type(text, { delay: 45 }); },
    /** A smooth scroll by `dy` pixels under the pointer. Scrolling repaints everything, so it is the heaviest thing in a GIF: keep it short. */
    scroll: async (dy, ms = 1000) => {
      const n = Math.max(8, Math.round(ms / 25));
      for (let i = 0; i < n; i++) { await page.mouse.wheel(0, dy / n); await page.waitForTimeout(ms / n); }
      await page.waitForTimeout(250);
    },
    /** A native select: its list is drawn by the system, outside the page, so no recording can show it. Show the click, then set it. */
    choose: async (sel, value) => {
      await glide(sel);
      await page.waitForTimeout(160);
      await page.evaluate(() => window.__demoripple());
      await page.waitForTimeout(350);
      await page.selectOption(sel, value);
    },
    /** A file input or a button that opens the file chooser. `done` is a page function that is true once the upload has landed. */
    upload: async (sel, file, done) => {
      const chooser = page.waitForEvent("filechooser");
      await d.click(sel);
      await (await chooser).setFiles(file);
      if (done) await page.waitForFunction(done, null, { timeout: 8000 });
    },
    /** A ripple where the pointer is, for a change made without a click (a date typed into a field). */
    ripple: () => page.evaluate(() => window.__demoripple()),
  };
  return d;
}

