// The photo viewer behind the unit galleries.
//
// A group is any element with [data-lbx-group]; its [data-lbx-open] children
// are the sequence. The list is read at open time rather than cached at load,
// so a gallery rendered into a dialog that has not been opened yet still works.

const $ = <T extends Element>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);

const dlg = $<HTMLDialogElement>('[data-lbx]');
if (dlg) {
  const img = $<HTMLImageElement>('[data-lbx-img]', dlg)!;
  const elCount = $<HTMLElement>('[data-lbx-count]', dlg)!;
  const btnPrev = $<HTMLButtonElement>('[data-lbx-prev]', dlg)!;
  const btnNext = $<HTMLButtonElement>('[data-lbx-next]', dlg)!;

  let items: HTMLElement[] = [];
  let i = 0;

  const show = (n: number) => {
    if (!items.length) return;
    i = (n + items.length) % items.length;
    const el = items[i];
    img.src = el.dataset.lbxSrc || '';
    img.alt = el.dataset.lbxAlt || '';
    elCount.textContent = `${i + 1} / ${items.length}`;
    const solo = items.length < 2;
    btnPrev.hidden = solo;
    btnNext.hidden = solo;
  };

  const open = (trigger: HTMLElement) => {
    const group = trigger.closest<HTMLElement>('[data-lbx-group]');
    items = group ? Array.from(group.querySelectorAll<HTMLElement>('[data-lbx-open]')) : [trigger];
    show(items.indexOf(trigger));
    if (!dlg.open) dlg.showModal();
  };

  document.addEventListener('click', (e) => {
    const t = e.target as HTMLElement | null;
    if (!t) return;
    const trigger = t.closest<HTMLElement>('[data-lbx-open]');
    if (trigger) { e.preventDefault(); open(trigger); return; }
    if (t.closest('[data-lbx-close]')) { dlg.close(); return; }
    if (t.closest('[data-lbx-prev]')) { show(i - 1); return; }
    if (t.closest('[data-lbx-next]')) { show(i + 1); return; }
  });

  dlg.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); show(i + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); show(i - 1); }
  });

  // Swipe, since this is mostly going to be opened on a phone.
  let x0: number | null = null;
  dlg.addEventListener('touchstart', (e) => { x0 = e.changedTouches[0].clientX; }, { passive: true });
  dlg.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 45) show(dx < 0 ? i + 1 : i - 1);
    x0 = null;
  }, { passive: true });

  // Clicking the ground around the picture closes, the picture itself does not.
  dlg.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t === dlg || t.classList.contains('lbx-stage')) dlg.close();
  });
}
