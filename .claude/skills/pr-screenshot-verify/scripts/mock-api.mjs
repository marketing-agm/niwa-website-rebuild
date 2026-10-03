// mock-api.mjs: answer the app's /api/* calls from the scenario's fixtures.
//
// The app under test asks its backend for data over fetch. In a screenshot run
// there is no backend, so these handlers reply with whatever the scenario
// provides. That puts the UI in exactly the state a shot needs.
//
// Two ways to provide data, both in scenario.fixtures:
//   api: { "<url piece>": body | (url) => body }   any route, longest match wins
//   me, folders, documents, activity, approvals    corporate library shortcuts
// A POST to /api/* gets fixtures.onPost(url), or a generic success.
//
// scenario.routes stubs outside hosts the sandbox cannot reach (a map style, a
// font, an embed), so a shot shows the working state instead of an offline error.

/** Finds the longest `api` key that appears in the URL, so a detail route
 *  ("/api/crm/deals/") beats its list route ("/api/crm/deals"). */
function apiMatch(map, url) {
  const keys = Object.keys(map).filter((k) => url.includes(k)).sort((a, b) => b.length - a.length);
  return keys.length ? keys[0] : null;
}

/** The reply for one GET, from the scenario's fixtures. */
function getBody(fx, url) {
  const key = fx.api ? apiMatch(fx.api, url) : null;
  if (key != null) return typeof fx.api[key] === "function" ? fx.api[key](url) : fx.api[key];
  if (url.includes("/api/me")) return fx.me ?? { email: "user@agm.com", isAdmin: false };
  if (url.includes("/api/folders")) return fx.folders ?? [];
  if (url.includes("/api/documents")) return fx.documents ?? [];
  if (url.includes("/api/activity")) return fx.activity ?? [];
  if (url.includes("/api/approvals")) return fx.approvals ?? { items: [], total: 0 };
  return {};
}

/** Installs the handlers on a browser context. Call before opening the page. */
export async function installMocks(ctx, scenario) {
  const fx = scenario.fixtures || {};
  await ctx.route("**/api/**", (route) => {
    const req = route.request();
    const url = req.url();
    const body = req.method() === "POST"
      ? (fx.onPost && fx.onPost(url)) || { id: "mock", approvalStatus: "approved" }
      : getBody(fx, url);
    // A file fixture: { __base64, contentType }, for example a real PDF, so a
    // preview renders instead of choking on JSON.
    if (body && typeof body === "object" && body.__base64) {
      return route.fulfill({ status: 200, contentType: body.contentType || "application/octet-stream", body: Buffer.from(body.__base64, "base64") });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });

  // Registered after /api/** so a stub for an outside host cannot shadow it.
  for (const r of scenario.routes || []) {
    await ctx.route((u) => String(u).includes(r.match), (route) => route.fulfill({
      status: r.status || 200,
      contentType: r.contentType || "application/json",
      body: typeof r.body === "string" ? r.body : JSON.stringify(r.body),
    }));
  }
}
