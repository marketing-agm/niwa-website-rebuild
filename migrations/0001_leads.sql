-- Every tour request, kept.
--
-- The point of storing these rather than only emailing them is that an email
-- is a notification, not a record: it lands in one inbox, and if that inbox
-- filters it, or the person watching it is away, the enquiry is gone with no
-- trace that it ever arrived. A row survives all of that and can be audited
-- later — "did anyone ever reply to this one" is answerable.
--
-- Written by functions/api/tour.ts. Nothing else writes here.
CREATE TABLE IF NOT EXISTS leads (
  id            TEXT PRIMARY KEY,
  received_at   TEXT NOT NULL,          -- ISO 8601, UTC

  first_name    TEXT NOT NULL,
  last_name     TEXT,
  email         TEXT NOT NULL,
  phone         TEXT,

  beds          TEXT,
  move_in       TEXT,
  tour_date     TEXT,
  tour_time     TEXT,
  message       TEXT,

  source        TEXT,                   -- which form on the site
  page_url      TEXT,
  attribution   TEXT,                   -- the ad/campaign fields, as JSON

  -- How the notifications went. Recorded per attempt so a silent failure is
  -- visible in the data rather than only in a log that rolls over: a row with
  -- email_ok = 0 is an enquiry nobody was told about.
  email_ok      INTEGER NOT NULL DEFAULT 0,
  email_error   TEXT,
  webhook_ok    INTEGER,
  webhook_error TEXT,

  -- Set from the admin view when someone has dealt with it.
  handled_at    TEXT,
  handled_note  TEXT
);

-- The two ways this table is read: newest first in the admin view, and
-- "everything still outstanding".
CREATE INDEX IF NOT EXISTS leads_received_idx ON leads (received_at DESC);
CREATE INDEX IF NOT EXISTS leads_unhandled_idx ON leads (handled_at, received_at DESC);
