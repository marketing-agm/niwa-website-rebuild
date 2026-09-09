// The tour request: one sentence, filled in. Sends through EmailJS when the
// site is configured for it; otherwise it hands the visitor a prepared email so
// a request is never silently dropped.
type SiteRuntime = { id: string; config: any };
const site: SiteRuntime = (window as any).__SITE__ || { id: 'niwa', config: {} };
const form = document.querySelector<HTMLFormElement>('[data-tour-form]');

if (form) {
  const status = form.querySelector<HTMLElement>('[data-tour-status]')!;
  const submitBtn = form.querySelector<HTMLButtonElement>('[data-tour-submit]')!;
  const submitLbl = form.querySelector<HTMLElement>('[data-tour-submit-label]')!;
  const done = document.querySelector<HTMLElement>('[data-tour-done]')!;

  // Inputs size to their content so the sentence reads as a sentence.
  const size = (i: HTMLInputElement) => { i.size = Math.max(4, Math.max(i.value.length, i.placeholder.length)); };
  form.querySelectorAll<HTMLInputElement>('[data-autosize]').forEach((i) => { size(i); i.addEventListener('input', () => { size(i); i.classList.remove('is-invalid'); status.textContent = ''; }); });
  form.querySelectorAll<HTMLTextAreaElement>('[data-autogrow]').forEach((t) => {
    const grow = () => { t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; };
    t.addEventListener('input', grow); grow();
  });

  // Dates. Local throughout: toISOString would hand back the UTC day, which
  // west of Greenwich is tomorrow for part of every evening.
  const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const openDays: string[] = site.config?.contact?.officeHours?.[0]?.days ?? [];
  const isOpenDay = (d: Date) => !openDays.length || openDays.includes(DOW[d.getDay()]);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const fromIso = (v: string) => { const [y, m, d] = v.split('-').map(Number); return new Date(y, m - 1, d); };
  const fmtDay = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  // The next six open days, offered as chips because most people want one of
  // them and a chip is one tap.
  const days = form.querySelector<HTMLElement>('[data-tour-days]');
  const dateWrap = form.querySelector<HTMLElement>('[data-tour-date-wrap]');
  const dateInput = form.querySelector<HTMLInputElement>('[data-tour-date]');
  const dayHint = form.querySelector<HTMLElement>('[data-tour-day-hint]');
  let firstOpen = '';
  if (days) {
    const d = new Date(); d.setHours(12, 0, 0, 0);
    let n = 0;
    while (n < 6) {
      d.setDate(d.getDate() + 1);
      if (!isOpenDay(d)) continue;
      const value = iso(d);
      if (!firstOpen) firstOpen = value;
      const el = document.createElement('label');
      el.className = 'chip';
      el.innerHTML = `<input type="radio" name="day" value="${value}"><span>${fmtDay(d)}</span>`;
      days.appendChild(el);
      n++;
    }
  }

  // And any other date, for the week the six chips don't cover. Bounded at
  // tomorrow — leasing confirms by email, usually within a business day, so
  // today is a promise the form can't make — and at six months, which is
  // further out than any lease conversation starts.
  if (dateInput) {
    const lo = new Date(); lo.setHours(12, 0, 0, 0); lo.setDate(lo.getDate() + 1);
    const hi = new Date(lo); hi.setDate(hi.getDate() + 180);
    dateInput.min = iso(lo);
    dateInput.max = iso(hi);
  }

  // Nothing here refuses a date. A Saturday is a real thing to ask for; the
  // office simply isn't open on one, and saying so is more use than a field
  // that won't take the answer.
  const pickedDate = () => {
    const on = !!form.querySelector<HTMLInputElement>('input[name="day"][value="pick"]:checked');
    return on && dateInput?.value ? fromIso(dateInput.value) : null;
  };
  // `entering` is true only when the chip itself was just chosen. The default
  // date and the focus belong to that moment; on a later keystroke they would
  // mean the field refuses to be cleared and steals the caret back.
  const syncDay = (entering = false) => {
    const on = !!form.querySelector<HTMLInputElement>('input[name="day"][value="pick"]:checked');
    if (dateWrap) dateWrap.hidden = !on;
    if (on && dateInput) {
      if (entering) {
        if (!dateInput.value && firstOpen) dateInput.value = firstOpen;
        dateInput.focus();
      }
      dateInput.classList.remove('is-invalid');
    }
    const d = pickedDate();
    if (dayHint) {
      const off = d && !isOpenDay(d);
      dayHint.hidden = !off;
      if (off) dayHint.textContent = `${DOW[d!.getDay()]} is outside the office's hours — ask anyway, and leasing will say what they can do.`;
    }
  };
  // On the form, not on the strip: "another date" sits outside it, so that the
  // one chip a phone visitor might actually need is not the last stop on a
  // sideways scroll.
  form.addEventListener('change', (e) => {
    if ((e.target as HTMLElement)?.matches?.('input[name="day"]')) syncDay(true);
  });
  dateInput?.addEventListener('change', () => { status.textContent = ''; syncDay(); });
  dateInput?.addEventListener('input', () => { status.textContent = ''; syncDay(); });

  const val = (name: string) => (form.elements.namedItem(name) as HTMLInputElement | RadioNodeList | null);
  const text = (name: string) => { const e = val(name) as HTMLInputElement | null; return e && 'value' in e ? String(e.value || '').trim() : ''; };
  const pickedLabel = (name: string) => {
    const checked = form.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`);
    return checked ? (checked.nextElementSibling?.textContent || checked.value) : '';
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const first = form.querySelector<HTMLInputElement>('#tf-first')!;
    const email = form.querySelector<HTMLInputElement>('#tf-email')!;
    const bad: HTMLInputElement[] = [];
    if (!first.value.trim()) bad.push(first);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) bad.push(email);
    const wantsPick = !!form.querySelector<HTMLInputElement>('input[name="day"][value="pick"]:checked');
    if (wantsPick && dateInput && !dateInput.value) {
      dateInput.classList.add('is-invalid');
      if (!bad.length) { dateInput.focus(); status.textContent = 'Pick the date you would like to visit.'; return; }
    }
    if (bad.length) {
      bad.forEach((b) => b.classList.add('is-invalid'));
      bad[0].focus();
      status.textContent = bad.length === 1 && bad[0] === email ? 'A working email address, so leasing can confirm.' : 'Your first name and an email address are all we need.';
      return;
    }

    const bedsLabel = pickedLabel('beds') || 'not specified';
    const windowLabel = pickedLabel('movein') || 'not specified';
    const picked = pickedDate();
    const dayLabel = picked ? fmtDay(picked) : (pickedLabel('day') || 'any weekday');
    const slotLabel = pickedLabel('slot') || 'any time';
    const attribution = (window as any).adAttributionFields ? (window as any).adAttributionFields() : {};
    const payload = {
      to_email: site.config?.integrations?.emailjs?.toEmail || site.config?.contact?.email || '',
      property_name: site.config?.name || 'Niwa Apartments',
      property_site_id: site.id,
      lead_first_name: first.value.trim(),
      lead_last_name: text('lname'),
      lead_email: email.value.trim(),
      lead_phone: text('phone') || '—',
      beds_interest: bedsLabel,
      move_in_date: windowLabel,
      tour_date: dayLabel,
      tour_time: slotLabel,
      unit_interest: '—',
      source: 'tour sentence',
      message: text('msg'),
      page_url: location.href,
      ...attribution,
    };

    const ej = site.config?.integrations?.emailjs;
    const configured = !!(ej && ej.publicKey && ej.serviceId && ej.templateId && (window as any).emailjs);
    let sent = false;
    if (configured) {
      submitBtn.disabled = true;
      submitLbl.textContent = 'Sending';
      status.textContent = '';
      try {
        await (window as any).emailjs.send(ej.serviceId, ej.templateId, payload, { publicKey: ej.publicKey });
        sent = true;
      } catch (err) {
        console.error('[tour] send failed', err);
        submitBtn.disabled = false;
        submitLbl.textContent = 'Request this tour';
        status.textContent = "That didn't go through. Try again, or call the office.";
        return;
      }
    }

    (window as any).trackEvent?.('tour_requested', { source: 'tour sentence', beds: pickedLabel('beds') || null, move_in: pickedLabel('movein') || null });

    // Confirmation, in the same voice as the form.
    const phone = site.config?.contact?.phone || '';
    const leasingEmail = site.config?.contact?.email || '';
    const when = `${dayLabel}${slotLabel !== 'any time' ? `, ${slotLabel}` : ''}`;
    done.querySelector('[data-tour-done-title]')!.textContent = `Thanks, ${first.value.trim()}.`;
    const body = done.querySelector('[data-tour-done-body]')!;
    const actions = done.querySelector('[data-tour-done-actions]')!;
    actions.innerHTML = '';
    if (sent) {
      body.textContent = `Leasing has your request for ${when} and will confirm at ${email.value.trim()}, usually within a business day.`;
    } else {
      const subject = encodeURIComponent(`Tour request — ${payload.property_name}`);
      const lines = [
        `Hi, I'm ${[payload.lead_first_name, payload.lead_last_name].filter(Boolean).join(' ')}.`,
        `I'm looking for ${bedsLabel}, to move in ${windowLabel}.`,
        `I could visit ${when}.`,
        `Reach me at ${payload.lead_email}${payload.lead_phone !== '—' ? ` or ${payload.lead_phone}` : ''}.`,
        payload.message ? `\n${payload.message}` : '',
      ].filter(Boolean).join('\n');
      const mailto = `mailto:${leasingEmail}?subject=${subject}&body=${encodeURIComponent(lines)}`;
      body.textContent = `Your request is written up and ready to send to leasing for ${when}. One tap opens it in your mail app.`;
      actions.innerHTML = `<a class="btn btn--ink" href="${mailto}">Send the request <span class="arr" aria-hidden="true">→</span></a>`;
    }
    if (phone) actions.insertAdjacentHTML('beforeend', `<a class="btn btn--ghost" style="--btn-fg:var(--ink);--btn-line:var(--ink)" href="${site.config?.contact?.phoneHref || 'tel:' + phone.replace(/\D/g, '')}">Or call the office</a>`);
    form.hidden = true;
    done.hidden = false;
    done.scrollIntoView({ block: 'nearest' });
  });
}
