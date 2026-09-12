// The tour request endpoint.
//
// A Cloudflare Pages Function, so it runs on the site's own domain with no
// extra vendor and no Astro adapter — Pages serves the static build and these
// functions side by side.
//
// It does three things with every request, in this order of importance:
//
//   1. writes it to D1, because that is the record. An email is a
//      notification: it lands in one inbox and if that inbox filters it, or
//      the person watching is away, the enquiry is gone with nothing to show
//      it ever arrived. A row survives that.
//   2. emails leasing through Resend, over the building's own authenticated
//      domain rather than a shared sender, because a leasing email in a spam
//      folder is a lost lease.
//   3. posts to a Teams or Slack webhook if one is configured, so it also
//      appears where the team already looks.
//
// The write comes first and the notifications are allowed to fail. A stored
// lead nobody was emailed about is recoverable — it is sitting in the table
// with email_ok = 0. An email that failed to send and was never stored is not.
//
// Configure in the Cloudflare dashboard (Settings → Environment variables),
// never in the repository:
//   RESEND_API_KEY    secret. From resend.com, with niwaapartments.com verified.
//   LEAD_TO           where leasing reads it, e.g. leasing@niwaapartments.com
//   LEAD_FROM         a verified sender on the domain, e.g. site@niwaapartments.com
//   LEAD_WEBHOOK_URL  optional. A Teams or Slack incoming webhook.
//   LEADS_TOKEN       secret. Guards the admin read in functions/api/leads.ts.
// And bind the D1 database as DB (Settings → Bindings → D1).

interface Env {
  DB?: D1Database;
  RESEND_API_KEY?: string;
  LEAD_TO?: string;
  LEAD_FROM?: string;
  LEAD_WEBHOOK_URL?: string;
}

type Json = Record<string, unknown>;

const str = (v: unknown, max = 2000) =>
  typeof v === 'string' ? v.trim().slice(0, max) : '';

const json = (body: Json, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

// The fields the form sends that are not lead data. Everything else that came
// in is kept as attribution rather than dropped, so a campaign parameter added
// to the form later still lands somewhere without a schema change.
const KNOWN = new Set([
  'lead_first_name', 'lead_last_name', 'lead_email', 'lead_phone',
  'beds_interest', 'move_in_date', 'tour_date', 'tour_time',
  'message', 'source', 'page_url', 'property_name', 'property_site_id',
  'unit_interest', 'to_email', 'company',
]);

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** Teams and Slack do not speak the same language, and the difference is not
 *  cosmetic — send Slack's shape to a modern Teams webhook and you get a
 *  rejection or an empty card.
 *
 *  Slack and Google Chat take `{ text }`. Teams used to as well, through the
 *  Office 365 connector, but Microsoft has been retiring those in favour of
 *  the Workflows app, and a Workflows webhook expects an Adaptive Card. The
 *  card shape below is accepted by both the old connectors and Workflows, so
 *  it is the safe thing to send anywhere that looks like Teams.
 *
 *  Picked off the hostname, because that is the only thing distinguishing them
 *  at the point of sending, and getting it wrong is silent: the enquiry is
 *  stored and emailed either way, and the channel simply stays quiet. */
function webhookBody(url: string, d: { name: string; when: string; lead: Record<string, string> }) {
  const { name, when, lead } = d;
  let host = '';
  try { host = new URL(url).hostname.toLowerCase(); } catch { /* fall through to Slack's shape */ }
  const isTeams = /(^|\.)webhook\.office\.com$/.test(host)
    || /(^|\.)logic\.azure\.com$/.test(host)
    || host.includes('powerplatform')
    || host.includes('powerautomate');

  const facts: [string, string][] = [
    ['Email', lead.email],
    ['Phone', lead.phone || '—'],
    ['Looking for', lead.beds || '—'],
    ['Move in', lead.move_in || '—'],
    ['Wants to visit', when || '—'],
  ];

  if (isTeams) {
    return {
      type: 'message',
      attachments: [{
        contentType: 'application/vnd.microsoft.card.adaptive',
        contentUrl: null,
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.4',
          body: [
            { type: 'TextBlock', text: 'Tour request', weight: 'Bolder', size: 'Medium' },
            { type: 'TextBlock', text: name, size: 'Large', wrap: true },
            { type: 'FactSet', facts: facts.map(([title, value]) => ({ title, value })) },
            ...(lead.message ? [{ type: 'TextBlock', text: lead.message.slice(0, 500), wrap: true, isSubtle: true }] : []),
          ],
        },
      }],
    };
  }

  // Slack, Google Chat, and anything else that takes a plain message.
  return {
    text:
      `*Tour request* — ${name}${when ? ` · ${when}` : ''}\n` +
      `${lead.email}${lead.phone ? ` · ${lead.phone}` : ''}\n` +
      `${lead.beds || 'no preference'} · move in ${lead.move_in || 'not specified'}` +
      (lead.message ? `\n> ${lead.message.slice(0, 500)}` : ''),
  };
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: Json;
  try { body = (await request.json()) as Json; }
  catch { return json({ ok: false, error: 'bad_request' }, 400); }

  // Honeypot. A field no person can see and no person fills in; a bot fills
  // every field it finds. Answered with a plain success so a bot has nothing
  // to learn from the response and does not come back to try a different shape.
  if (str(body.company)) return json({ ok: true });

  const first = str(body.lead_first_name, 120);
  const email = str(body.lead_email, 254);
  if (!first) return json({ ok: false, error: 'name_required' }, 422);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ ok: false, error: 'email_required' }, 422);

  const lead = {
    id: crypto.randomUUID(),
    received_at: new Date().toISOString(),
    first_name: first,
    last_name: str(body.lead_last_name, 120),
    email,
    phone: str(body.lead_phone, 40).replace(/^—$/, ''),
    beds: str(body.beds_interest, 80),
    move_in: str(body.move_in_date, 80),
    tour_date: str(body.tour_date, 80),
    tour_time: str(body.tour_time, 80),
    message: str(body.message, 4000),
    source: str(body.source, 80) || 'tour form',
    page_url: str(body.page_url, 500),
    attribution: JSON.stringify(
      Object.fromEntries(Object.entries(body).filter(([k, v]) => !KNOWN.has(k) && typeof v === 'string' && v)),
    ),
  };

  const name = [lead.first_name, lead.last_name].filter(Boolean).join(' ');
  const when = [lead.tour_date, lead.tour_time].filter(Boolean).join(', ');

  // 1. The record, first and on its own, so a failure in either notification
  //    below cannot take the enquiry with it.
  let stored = false;
  let storeError = '';
  if (env.DB) {
    try {
      await env.DB.prepare(
        `INSERT INTO leads (id, received_at, first_name, last_name, email, phone,
           beds, move_in, tour_date, tour_time, message, source, page_url, attribution)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14)`,
      ).bind(
        lead.id, lead.received_at, lead.first_name, lead.last_name, lead.email, lead.phone,
        lead.beds, lead.move_in, lead.tour_date, lead.tour_time, lead.message,
        lead.source, lead.page_url, lead.attribution,
      ).run();
      stored = true;
    } catch (err) {
      storeError = err instanceof Error ? err.message : String(err);
      console.error('[tour] D1 write failed', storeError);
    }
  }

  // 2. The email.
  let emailOk = false;
  let emailError = '';
  const to = env.LEAD_TO;
  const from = env.LEAD_FROM;
  if (env.RESEND_API_KEY && to && from) {
    const rows: [string, string][] = [
      ['Name', name],
      ['Email', lead.email],
      ['Phone', lead.phone || '—'],
      ['Looking for', lead.beds || '—'],
      ['Move in', lead.move_in || '—'],
      ['Wants to visit', when || '—'],
      ['From', lead.page_url || '—'],
    ];
    const html =
      `<p style="margin:0 0 16px"><strong>${escapeHtml(name)}</strong> asked for a tour${when ? ` on ${escapeHtml(when)}` : ''}.</p>` +
      `<table style="border-collapse:collapse;font:14px/1.5 system-ui,sans-serif">` +
      rows.map(([k, v]) =>
        `<tr><td style="padding:4px 16px 4px 0;color:#666">${escapeHtml(k)}</td><td style="padding:4px 0">${escapeHtml(v)}</td></tr>`).join('') +
      `</table>` +
      (lead.message ? `<p style="margin:16px 0 0;white-space:pre-wrap">${escapeHtml(lead.message)}</p>` : '') +
      (stored ? '' : '<p style="margin:16px 0 0;color:#b00">This one could not be saved to the leads table — reply from this email, it is the only copy.</p>');

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          from, to: [to],
          // So hitting reply in the inbox answers the person, not the website.
          reply_to: lead.email,
          subject: `Tour request — ${name}${when ? `, ${when}` : ''}`,
          html,
        }),
      });
      if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 300)}`);
      emailOk = true;
    } catch (err) {
      emailError = err instanceof Error ? err.message : String(err);
      console.error('[tour] email failed', emailError);
    }
  } else {
    emailError = 'not configured';
  }

  // 3. The team channel, if there is one. Second pair of eyes, and a different
  //    failure mode from email — a channel nobody has muted beats an inbox
  //    with a rule on it.
  let webhookOk: number | null = null;
  let webhookError = '';
  if (env.LEAD_WEBHOOK_URL) {
    try {
      const res = await fetch(env.LEAD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(webhookBody(env.LEAD_WEBHOOK_URL, { name, when, lead })),
      });
      if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
      webhookOk = 1;
    } catch (err) {
      webhookOk = 0;
      webhookError = err instanceof Error ? err.message : String(err);
      console.error('[tour] webhook failed', webhookError);
    }
  }

  if (stored && env.DB) {
    try {
      await env.DB.prepare(
        `UPDATE leads SET email_ok = ?2, email_error = ?3, webhook_ok = ?4, webhook_error = ?5 WHERE id = ?1`,
      ).bind(lead.id, emailOk ? 1 : 0, emailError || null, webhookOk, webhookError || null).run();
    } catch (err) {
      console.error('[tour] status update failed', err);
    }
  }

  // Success to the visitor if the enquiry survives anywhere we can get at it.
  // If it is in neither the table nor an inbox, say so, and the form falls
  // back to handing them a prepared email rather than telling them a request
  // was received that nobody will ever see.
  if (!stored && !emailOk) {
    return json({ ok: false, error: 'not_delivered', detail: storeError || emailError }, 502);
  }
  return json({ ok: true, id: lead.id, stored, emailed: emailOk });
};

// Every other method, explicitly.
//
// Not left to the runtime: exporting only onRequestPost and assuming Pages
// answers 405 by itself is wrong, and measurably so — a GET to this path came
// back 200 from the static asset handler, which means a browser opening the
// URL would be told everything was fine. No onRequest catch-all either, since
// one alongside onRequestPost makes the routing ambiguous and next() from a
// leaf function falls through to an asset rather than answering.
const notAllowed = () => json({ ok: false, error: 'method_not_allowed' }, 405);
export const onRequestGet: PagesFunction<Env> = notAllowed;
export const onRequestPut: PagesFunction<Env> = notAllowed;
export const onRequestPatch: PagesFunction<Env> = notAllowed;
export const onRequestDelete: PagesFunction<Env> = notAllowed;
export const onRequestHead: PagesFunction<Env> = notAllowed;
