// Reading the leads back.
//
// This is the visibility half: the table is only useful if someone can look
// at it without a database client. GET returns the most recent enquiries as
// JSON; POST marks one handled, so "has anyone dealt with this" is a question
// the data answers rather than a thing people remember.
//
// GUARDING IT. Lead data is people's names, emails and phone numbers, so this
// is not public. Two layers, and the first is the one to rely on:
//
//   1. Cloudflare Access in front of /admin/* — the right answer. It puts the
//      leasing team's own logins in front of the page, with no shared secret
//      to leak or rotate, and it is free on the Zero Trust plan. Set it up at
//      Zero Trust → Access → Applications, with a policy on the site's domain
//      and path /admin.
//   2. LEADS_TOKEN, a bearer token checked here, so the endpoint is not open
//      even before Access is configured or if a policy is ever removed. With
//      no token set the endpoint refuses everything rather than defaulting to
//      open — an unconfigured deployment should leak nothing.
//
// The token is compared in constant time. A plain === leaks the position of
// the first wrong byte through timing, which over enough requests is enough to
// recover a secret.

interface Env {
  DB?: D1Database;
  LEADS_TOKEN?: string;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

function tokenOk(given: string, expected: string) {
  const a = new TextEncoder().encode(given);
  const b = new TextEncoder().encode(expected);
  // Compare every byte of a fixed-length digest rather than the raw strings,
  // so neither the length nor the first difference is observable.
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

const authed = (request: Request, env: Env) => {
  if (!env.LEADS_TOKEN) return false;
  const header = request.headers.get('authorization') || '';
  const given = header.startsWith('Bearer ') ? header.slice(7) : '';
  return !!given && tokenOk(given, env.LEADS_TOKEN);
};

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!authed(request, env)) return json({ ok: false, error: 'unauthorized' }, 401);
  if (!env.DB) return json({ ok: false, error: 'no_database' }, 503);

  const url = new URL(request.url);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit')) || 100));
  const only = url.searchParams.get('state');   // 'open' | 'handled' | null

  const where = only === 'open' ? 'WHERE handled_at IS NULL'
    : only === 'handled' ? 'WHERE handled_at IS NOT NULL' : '';

  const { results } = await env.DB.prepare(
    `SELECT id, received_at, first_name, last_name, email, phone, beds, move_in,
            tour_date, tour_time, message, source, page_url, attribution,
            email_ok, email_error, webhook_ok, handled_at, handled_note
       FROM leads ${where} ORDER BY received_at DESC LIMIT ?1`,
  ).bind(limit).all();

  // Counts worth seeing at a glance: what is outstanding, and — the reason
  // any of this exists — anything that arrived without a notification going
  // out, which is exactly the case that used to vanish silently.
  const counts = await env.DB.prepare(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN handled_at IS NULL THEN 1 ELSE 0 END) AS open,
            SUM(CASE WHEN email_ok = 0 THEN 1 ELSE 0 END) AS unnotified
       FROM leads`,
  ).first();

  return json({ ok: true, counts, leads: results });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!authed(request, env)) return json({ ok: false, error: 'unauthorized' }, 401);
  if (!env.DB) return json({ ok: false, error: 'no_database' }, 503);

  let body: { id?: string; handled?: boolean; note?: string };
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'bad_request' }, 400); }
  if (!body.id) return json({ ok: false, error: 'id_required' }, 422);

  await env.DB.prepare(`UPDATE leads SET handled_at = ?2, handled_note = ?3 WHERE id = ?1`)
    .bind(body.id, body.handled === false ? null : new Date().toISOString(), (body.note ?? '').slice(0, 500) || null)
    .run();

  return json({ ok: true });
};
