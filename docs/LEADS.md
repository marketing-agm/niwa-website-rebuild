# Tour requests: where they go, and how to be sure none are missed

The form on the front page posts to `/api/tour`, a Cloudflare Pages Function
running on the site's own domain. For each enquiry it does three things, in
this order:

1. **Writes it to the `leads` table** in Cloudflare D1. This is the record.
2. **Emails leasing** through Resend, from an address on niwaapartments.com.
3. **Posts to a Teams or Slack channel**, if a webhook is configured.

The order matters. An email is a notification, not a record: it lands in one
inbox, and if that inbox filters it or the person watching is away, the enquiry
is gone with nothing to show it ever arrived. The write happens first and the
notifications are allowed to fail, because a stored lead nobody was emailed
about is recoverable — it sits in the table with `email_ok = 0`, and the admin
page counts those in red. An email that failed and was never stored is not.

If **both** the write and the email fail, the endpoint returns an error and the
form hands the visitor a prepared email to send themselves, rather than telling
them leasing has their details when nobody does.

## Seeing them

**/admin/leads.html**

Every enquiry, newest first. Filter to what is still outstanding, mark things
handled as they are dealt with, download the lot as CSV. The third counter —
*arrived with no email sent* — should be zero. If it is not, those enquiries
reached the table but nobody was told, and they need working through by hand.

## Setting it up

### 1. The database

```sh
npx wrangler d1 create niwa-leads
```

Put the id it prints into `wrangler.toml` under `[[d1_databases]]`, then create
the table:

```sh
npx wrangler d1 execute niwa-leads --remote --file=migrations/0001_leads.sql
```

### 2. Resend

Sign up, add **niwaapartments.com** as a domain and complete the DNS records it
asks for. That is what makes the mail authenticated rather than sent from a
shared pool — the difference between the inbox and the spam folder, which for a
leasing enquiry is the difference between a tour and nothing.

### 3. Environment variables

Cloudflare dashboard, the Pages project, **Settings -> Environment variables**.
Set these for Production, and for Preview if you want the preview URLs working.
None of them belong in the repository.

| Name | What it is |
| --- | --- |
| `RESEND_API_KEY` | **Secret.** From Resend. |
| `LEAD_TO` | Where leasing reads it, e.g. `leasing@niwaapartments.com` |
| `LEAD_FROM` | A verified sender on the domain, e.g. `site@niwaapartments.com` |
| `LEAD_WEBHOOK_URL` | Optional. A Teams or Slack incoming webhook. |
| `LEADS_TOKEN` | **Secret.** Guards the admin page. Generate a long random one. |

Mark `RESEND_API_KEY` and `LEADS_TOKEN` as encrypted.

### 4. Lock the admin page down properly

The token is a backstop, not the lock. Put **Cloudflare Access** in front of
`/admin/*`: Zero Trust -> Access -> Applications -> Add, self-hosted, the
site's domain, path `/admin`, with a policy allowing the leasing team's email
addresses. Then there is no shared secret to circulate or rotate and people
sign in as themselves.

It is free on the Zero Trust plan, and it also covers the Sveltia CMS at
`/admin/`, which is worth doing regardless.

## Checking it works

After deploying, send yourself one:

```sh
curl -X POST https://niwaapartments.com/api/tour \
  -H 'content-type: application/json' \
  -d '{"lead_first_name":"Test","lead_email":"you@example.com","message":"ignore me"}'
```

`{"ok":true,"stored":true,"emailed":true}` is the answer you want.
`stored:false` means the D1 binding is wrong; `emailed:false` means Resend is
not configured or the domain is not verified yet. Delete the row from the admin
page afterwards.

## If something goes wrong later

- **Nothing arriving at all.** Check the Pages Function logs in the dashboard.
  The form falls back to a mailto, so enquiries are not being lost outright, but
  nobody is being notified.
- **Leads in the table but no email.** `RESEND_API_KEY` has expired or the
  sending domain has fallen out of verification. The `email_error` column on
  each row says which.
- **Spam.** The honeypot catches the ordinary kind. If something gets past it,
  Cloudflare's own bot rules on the `/api/tour` route are the next step, rather
  than a captcha, which costs every real visitor something.

## Running it locally

```sh
npm run build
npx wrangler d1 execute niwa-leads --local --file=migrations/0001_leads.sql
npx wrangler pages dev dist \
  --binding LEAD_TO=you@example.com LEAD_FROM=site@example.com LEADS_TOKEN=dev-token
```

Without `RESEND_API_KEY` the endpoint stores and reports `emailed:false`, which
is the case the admin page's red counter exists for.

## What was verified

Against a real local D1, seventeen assertions on the endpoints: a submission
stored and reported; GET, PUT, PATCH and DELETE each answered 405; a missing
name and a malformed email each 422; malformed JSON 400; a honeypot submission
accepted with a plain success and never written; the admin read refused without
a token and with a wrong one; ad attribution captured; marking handled recorded
and reflected in the filters.

Nine more in a browser against the admin page: the gate before a token, a wrong
token bounced, the table after a good one, the red counter, the rows, and
marking one handled.
