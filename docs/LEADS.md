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

There are two ways. The workflow is less work and less to get wrong.

### The quick way: run the setup workflow

Add these as **repository secrets** (Settings -> Secrets and variables ->
Actions), then run **Actions -> Leads setup -> Run workflow**:

| Secret | Where it comes from |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare -> My Profile -> API Tokens -> Create. Custom token with **Account · D1 · Edit** and **Account · Cloudflare Pages · Edit**. |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard sidebar, or the account URL. |
| `RESEND_API_KEY` | resend.com, after verifying the domain (below). |
| `LEAD_TO` | `leasing@niwaapartments.com` |
| `LEAD_FROM` | A verified sender on the domain, e.g. `site@niwaapartments.com` |
| `LEADS_TOKEN` | A long random string. Guards the admin page. |
| `LEAD_WEBHOOK_URL` | Optional. A Teams or Slack webhook — see below. |

It creates the database, creates the table and sets every value on the Pages
project, then prints the database id you need for the binding step. It is safe
to run twice.

**One step it cannot do for you:** binding the database to the Pages project.
Cloudflare dashboard -> Workers & Pages -> the project -> Settings -> Bindings
-> D1 database -> variable name `DB`, database `niwa-leads`. Then redeploy.
That binding is what makes `env.DB` exist inside the function.

### The manual way

#### 1. The database

```sh
npx wrangler d1 create niwa-leads
```

Note the id it prints — you need it for the binding below. It does **not** go
into `wrangler.toml`: Cloudflare reads that file at build time and a Pages
project takes its D1 binding from the project settings, not from the file. Then
create the table:

```sh
npx wrangler d1 execute niwa-leads --remote --file=migrations/0001_leads.sql
```

#### 2. Resend

Sign up, add **niwaapartments.com** as a domain and complete the DNS records it
asks for. That is what makes the mail authenticated rather than sent from a
shared pool — the difference between the inbox and the spam folder, which for a
leasing enquiry is the difference between a tour and nothing.

#### 3. Environment variables

Cloudflare dashboard, the Pages project, **Settings -> Environment variables**.
Set these for Production, and for Preview if you want the preview URLs working.
None of them belong in the repository.

| Name | What it is |
| --- | --- |
| `RESEND_API_KEY` | **Secret.** From Resend. |
| `LEAD_TO` | Where leasing reads it, e.g. `leasing@niwaapartments.com` |
| `LEAD_FROM` | A verified sender on the domain, e.g. `site@niwaapartments.com` |
| `LEAD_WEBHOOK_URL` | Optional. A Teams or Slack webhook — see below. |
| `LEADS_TOKEN` | **Secret.** Guards the admin page. Generate a long random one. |

Mark `RESEND_API_KEY` and `LEADS_TOKEN` as encrypted.

#### 4. Lock the admin page down properly

The token is a backstop, not the lock. Put **Cloudflare Access** in front of
`/admin/*`: Zero Trust -> Access -> Applications -> Add, self-hosted, the
site's domain, path `/admin`, with a policy allowing the leasing team's email
addresses. Then there is no shared secret to circulate or rotate and people
sign in as themselves.

It is free on the Zero Trust plan, and it also covers the Sveltia CMS at
`/admin/`, which is worth doing regardless.

## The team channel (optional, and the most useful part)

`LEAD_WEBHOOK_URL` posts each enquiry into a channel as it arrives. Worth
setting up: an inbox is one person, and a channel is everyone who is in it. It
is the difference between an enquiry waiting for someone to come back from
leave and being seen in a minute.

The endpoint sends the right shape for whichever service the URL belongs to,
picked off the hostname — Slack and Google Chat take a plain message, Teams
needs an Adaptive Card and rejects the plain one.

### Slack

1. api.slack.com/apps -> **Create New App** -> From scratch, pick the workspace.
2. **Incoming Webhooks** -> turn it on -> **Add New Webhook to Workspace**.
3. Choose the channel (`#leasing`, say) and allow it.
4. Copy the `https://hooks.slack.com/services/...` URL into `LEAD_WEBHOOK_URL`.

### Microsoft Teams

Microsoft has been retiring the old "Incoming Webhook" connector, so which
route you have depends on the tenant. Both work here.

**Workflows (current).** In Teams, right-click the channel -> **Workflows** ->
search for *"Post to a channel when a webhook request is received"* -> pick the
team and channel -> it gives you a URL on `logic.azure.com`. That is the one.

**Incoming Webhook (older tenants).** Channel -> **...** -> Connectors ->
Incoming Webhook -> Configure -> name it -> Create. The URL is on
`webhook.office.com`.

Either way, paste it into `LEAD_WEBHOOK_URL` and the card shape is chosen for
you.

### Checking the channel works

Send a test enquiry (below). If the channel stays quiet but the lead appears in
the admin page, the webhook is the part that failed and the `webhook_error`
column on that row says why — the enquiry itself is safe either way, which is
the whole point of the order things happen in.

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
npx wrangler pages dev dist --d1 DB=niwa-leads \
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
