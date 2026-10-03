// record.mjs: film the screen while an action runs, for a GIF.
//
// drive.mjs calls recordFlow() for a shot with `record`, saves the frames, and
// frames-to-gif.py turns them into the GIF and the frame strip.

/**
 * Films the screen while `action(page)` runs, and returns the frames for a GIF.
 *
 * It uses Chrome's screencast, the stream of frames Chrome actually paints,
 * rather than screenshots in a loop, so fast motion is caught as it happened.
 *
 * `slow` plays every CSS animation and transition that many times slower while
 * filming. A 200 ms fade filmed at normal speed gives about 11 frames; slowed
 * 10 times it gives about 120. Frames are then picked back out at real-speed
 * times, so the GIF still plays at real speed. `slow` only affects motion
 * inside one page (menus, dialogs, a month changing). For a move from one page
 * to another, film at slow 1.
 *
 * The action gets a helper, `wait(ms)`, that pauses in real time: while
 * filming slowed, it waits `slow` times longer, so an animation it waits for
 * really finishes. A plain page.waitForTimeout would cut it short.
 *
 * Returns [{ data, ms }]: a base64 PNG and how long to show it, in order.
 */
export async function recordFlow(page, action, { slow = 1, stepMs = 40, holdStartMs = 700, holdEndMs = 1200, tailMs = 900, maxWidth = 1280 } = {}) {
  const cdp = await page.context().newCDPSession(page);
  const raw = [];
  cdp.on("Page.screencastFrame", async (f) => {
    raw.push({ t: f.metadata.timestamp * 1000, data: f.data });
    try { await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }); } catch { /* filming already stopped */ }
  });
  if (slow > 1) {
    await cdp.send("Animation.enable");
    await cdp.send("Animation.setPlaybackRate", { playbackRate: 1 / slow });
  }
  await cdp.send("Page.startScreencast", { format: "png", maxWidth, everyNthFrame: 1 });
  await page.waitForTimeout(300); // so the film opens on the "before" state
  const start = Date.now();
  await action(page, { wait: (ms) => page.waitForTimeout(ms * slow) });
  await page.waitForTimeout(tailMs * slow);
  const end = Date.now();
  await cdp.send("Page.stopScreencast").catch(() => {});
  if (slow > 1) await cdp.send("Animation.setPlaybackRate", { playbackRate: 1 }).catch(() => {});
  await cdp.detach().catch(() => {});
  if (!raw.length) throw new Error("The screencast returned no frames.");

  // The last frame painted at or before a moment of wall-clock time.
  const at = (t) => raw.reduce((best, f) => (f.t <= t ? f : best), raw[0]).data;
  const frames = [{ data: at(start), ms: holdStartMs }];
  const realLength = (end - start) / slow;
  for (let ms = stepMs; ms <= realLength; ms += stepMs) {
    const data = at(start + ms * slow);
    const last = frames[frames.length - 1];
    if (data === last.data) last.ms += stepMs; // nothing moved: show the last frame longer
    else frames.push({ data, ms: stepMs });
  }
  frames[frames.length - 1].ms += holdEndMs; // rest on the result before the GIF loops
  return frames;
}
