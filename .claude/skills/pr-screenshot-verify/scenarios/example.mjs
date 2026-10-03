// Example scenario. Copy it, rename it, and edit `fixtures` and `shots` for the
// surface your change touched. Run with:
//   node .claude/skills/pr-screenshot-verify/scripts/drive.mjs <thisFile> .pr-shots
//
// The whole format:
//   viewport   { width, height }. Use the reviewer's own window width when you know it.
//   context    Playwright options for the whole run: colorScheme "dark", reducedMotion
//              "reduce", deviceScaleFactor 2 with isMobile and hasTouch for a phone.
//   baseUrl    an app that is already running (otherwise drive.mjs starts `npm run dev`).
//   path       where the first page opens, default "/".
//   mock       false to leave /api/* alone (a real backend).
//   fixtures   the mocked /api/* replies (see scripts/mock-api.mjs).
//   routes     stubs for outside hosts: [{ match, body, contentType? }].
//   shots      the captures, in order. Each one:
//     name       file name, no extension. Number them: "1-overview", "2-dialog".
//     title      the heading in the comment, in plain words.
//     how        "How to get here": the clicks from sign-in, in plain words.
//     look       "What to look at": what changed and which edge case this shows.
//     action     async (page, { wait }) => {}. Drive the real interface; the capture is taken
//                after it. wait(ms) pauses in real time, also while filming slowed.
//     path       open this page first.
//     selector   capture one element instead of the window (a close-up).
//     fullPage   capture the whole scrolling page.
//     details    true folds this shot into the one above it, collapsed.
//     record     film the action for a GIF instead: true, or { slow: 10 } for motion inside
//                a page. Then run scripts/frames-to-gif.py on the <name>-frames folder.
//
// This example reproduces the issue-#80 folder-governance verification.
const ISO = "2026-06-20T10:00:00.000Z";

const folders = [
  // The sidebar tree needs a parentId:null root; the content grid lists its parentId:"root" children.
  { id: "root", name: "Corporate Library", parentId: null, folderClass: "general", isRestricted: false },
  { id: "f1", name: "Property A, Maple St", parentId: "root", folderClass: "general", isRestricted: false },
  { id: "f2", name: "Brand Templates", parentId: "root", folderClass: "master_template", isRestricted: false },
  { id: "f3", name: "Legal, Confidential", parentId: "root", folderClass: "restricted", isRestricted: true },
  { id: "f4", name: "Drafts, Intake", parentId: "root", folderClass: "working", isRestricted: false },
];
const documents = [
  { id: "d1", name: "2025 Maple Lease", folderId: "root", type: "application/pdf", tags: ["Lease"], description: "Signed.", uploadedAt: ISO, uploadedBy: "jdoe@agm.com", size: 1200000, approvalStatus: "approved" },
  { id: "d2", name: "Vendor W9 form", folderId: "root", type: "application/pdf", tags: ["Vendor"], description: "", uploadedAt: ISO, uploadedBy: "akim@agm.com", size: 50000, approvalStatus: "pending" },
  { id: "d3", name: "Roof Inspection", folderId: "root", type: "application/pdf", tags: ["Inspection"], description: "", uploadedAt: ISO, uploadedBy: "akim@agm.com", size: 90000, approvalStatus: "rejected", rejectReason: "Wrong property." },
];

/** Closes whatever pop-up is open and waits until it has really gone. A fixed
 *  wait races the page redrawing; waiting for the element to leave does not. */
async function closeModal(page) {
  await page.keyboard.press("Escape");
  await page.locator(".modal").first().waitFor({ state: "detached" }).catch(() => {});
}

export default {
  viewport: { width: 1300, height: 950 },
  fixtures: {
    me: { email: "admin@agm.com", isAdmin: true },
    folders,
    documents,
    activity: [],
    approvals: { items: [], total: 0 },
    onPost: () => ({ id: "dNew", name: "Uploaded Doc", approvalStatus: "approved" }),
  },
  // These shots target UI present on `main`, so the example runs green on any branch.
  // Adapt them, and the selectors, to YOUR change.
  shots: [
    {
      name: "1-library",
      title: "The library",
      how: "sign in. The library is the first screen.",
      look: "each folder shows what kind it is, and the two documents that are waiting or were turned down carry a label.",
    },
    {
      name: "2-new-folder",
      title: "Making a folder",
      how: "click New Folder at the top of the library.",
      look: "the pop-up that opens and the kinds of folder it offers.",
      action: async (page) => { await page.locator('button:has-text("New Folder")').first().click(); },
    },
    {
      name: "3-upload",
      title: "The Upload pop-up",
      details: true, // folds under shot 2 as a collapsed section
      action: async (page) => {
        await closeModal(page);
        await page.locator('button:has-text("Upload")').first().click();
      },
    },
    {
      name: "4-new-folder-motion",
      title: "Opening New Folder, at real speed",
      how: "click New Folder.",
      look: "how the pop-up arrives.",
      path: "/", // start from a fresh page, so the film has nothing else open
      record: { slow: 10 },
      action: async (page) => { await page.locator('button:has-text("New Folder")').first().click(); },
    },
  ],
};
