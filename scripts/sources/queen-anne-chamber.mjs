// Queen Anne Chamber of Commerce — the neighbourhood's own calendar, and the
// one source on this page that is not currently reachable.
//
// Their listings are the best content there is for a building on this block:
// the Farmers Market, Trick or Treat on the Ave, the Fall Wine Walk, the Grand
// Tree Lighting, story time at the branch library. None of it is ticketed
// through Ticketmaster and none of it is on Visit Seattle.
//
// What the probe found, over four rounds (`npm run events -- --probe`):
//
//   /wp-json/tribe/events/v1/events   404  — not The Events Calendar
//   /wp-json/wp/v2/tribe_events       404
//   /events/?ical=1                   200 text/html — the page, not iCal
//   /events/feed/                     200 text/html — the page, not RSS
//   /wp-json/wp/v2/mec-events         200 — but a WordPress *post*: its `date`
//                                     is when the listing was published, and
//                                     no event date is exposed at all
//   /wp-json/mec/v1/events            200 — and an empty array
//
// They run Modern Events Calendar, whose own endpoint exists and answers, but
// returns nothing to an anonymous caller. So there is no honest way to read
// their calendar today, and this source reports itself unavailable rather than
// scraping their HTML — which would break the first time they restyle a page,
// and would be taking content they have not published for the purpose.
//
// It is kept, and still called once a week, because the day that endpoint
// starts answering is the day this page gets much better. When it does, this
// logs the shape of the first record so the normaliser can be written against
// the real thing rather than guessed at.
import { getJson } from './lib.mjs';

const BASE = 'https://www.queenannechamber.org';
const ENDPOINT = `${BASE}/wp-json/mec/v1/events`;

export const id = 'queen-anne-chamber';
export const label = 'Queen Anne Chamber of Commerce';

export async function fetchEvents({ days, log }) {
  const now = new Date();
  const end = new Date(now.getTime() + days * 864e5);
  const url = new URL(ENDPOINT);
  url.searchParams.set('start_date', now.toISOString().slice(0, 10));
  url.searchParams.set('end_date', end.toISOString().slice(0, 10));

  const body = await getJson(url);
  const raw = Array.isArray(body) ? body : (body?.events ?? body?.data ?? []);
  if (!raw.length) {
    return { skipped: 'their calendar API returns nothing to an anonymous caller', events: [] };
  }

  // It answered. Say what it sent, so the normaliser can be written against a
  // real record instead of a guess — and return nothing until it has been.
  log(`the endpoint has started answering — ${raw.length} record(s)`);
  log(`fields: ${Object.keys(raw[0]).join(', ')}`);
  log(JSON.stringify(raw[0]).slice(0, 800));
  return { skipped: 'endpoint now returns data — see the fields above and write normalise()', events: [] };
}

export function normalise() {
  return [];
}

export function fromSaved(body) {
  return Array.isArray(body) ? body : (body?.events ?? body?.data ?? []);
}

export const probeUrls = [
  `${ENDPOINT}?per_page=1`,
  `${BASE}/wp-json/wp/v2/mec-events?per_page=1`,
];
