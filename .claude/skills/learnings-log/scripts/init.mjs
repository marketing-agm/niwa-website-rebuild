// init.mjs — one-time scaffolder for the learnings-log skill.
// Reads the agreed config (areas + appCodePaths) as JSON on stdin and writes:
//   docs/learnings/config.json   the only project-specific file
//   docs/learnings/README.md     the one-line-per-entry index, seeded with areas
//   docs/learnings/_template.md  field reference for a log entry
// Refuses to overwrite an existing config.json, so re-running setup never
// destroys a project's chosen buckets.
import { writeFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { repoRoot, learnDir, configPath } from "./config.mjs";

// Read everything piped to stdin (file descriptor 0).
function readStdin() {
  try { return readFileSync(0, "utf8"); } catch { return ""; }
}
function fail(msg) { console.error("ERROR: " + msg); process.exit(2); }

const raw = readStdin().trim();
if (!raw) fail("no config JSON on stdin");
let cfg;
try { cfg = JSON.parse(raw); } catch (err) { fail("invalid JSON: " + err.message); }

// Validate the shape every other script depends on.
if (!cfg.areas || typeof cfg.areas !== "object" || Array.isArray(cfg.areas))
  fail('config must have an "areas" object (slug -> title)');
if (Object.keys(cfg.areas).length === 0) fail("config.areas must have at least one area");
if (!Array.isArray(cfg.appCodePaths)) fail('config must have an "appCodePaths" array');

const root = repoRoot();
const dir = learnDir(root);
const cfgPath = configPath(root);

// Safety: never clobber an existing config.
if (existsSync(cfgPath)) {
  // SKIP is unconditional: if a config already exists, stay out of the way.
  // List its areas as a convenience, but never crash if it was hand-corrupted.
  let areasNote = "";
  try {
    const existing = JSON.parse(readFileSync(cfgPath, "utf8"));
    areasNote = " Areas: " + Object.keys(existing.areas || {}).join(", ") + ".";
  } catch { /* malformed existing config — still skip, just without the areas list */ }
  console.log("SKIP — config already exists at docs/learnings/config.json." + areasNote +
    " Edit that file directly to change buckets.");
  process.exit(0);
}

mkdirSync(dir, { recursive: true });
const areaSlugs = Object.keys(cfg.areas);

// 1) config.json — pretty-printed so a human can edit it later.
writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + "\n");

// 2) README.md index — one empty section per area, newest-first within each.
const indexHeader =
  "# Learnings index\n\n" +
  "Cross-session record of fixes and gotchas. **Before fixing in an area, grep its " +
  "file for prior lessons; after fixing, add an entry** via the `learnings-log` skill " +
  "(`scripts/log.mjs`). Full entries live in the per-area files; one line per entry " +
  "below, newest first.\n\n";
const indexBody = areaSlugs.map((a) => `## ${a}\n_(none yet)_\n`).join("\n");
writeFileSync(path.join(dir, "README.md"), indexHeader + indexBody);

// 3) _template.md — field reference for whoever writes an entry by hand.
const template = [
  "# Learnings entry — field reference",
  "",
  "Entries are appended by `scripts/log.mjs` (do not hand-edit the hidden",
  "`<!-- log-id: ... -->` markers). Fields:",
  "",
  "- **area** — one of the slugs in config.json: " + areaSlugs.join(", "),
  "- **type** — bug | ux | regression | gotcha",
  "- **title** — short, specific",
  "- **key** — the fixing commit's short SHA (idempotency identity)",
  "- **ref** — human-readable provenance shown in the entry (defaults to key)",
  "- **summary** — the one-line lesson that goes in the index",
  "- **symptom** — what was observed",
  "- **rootCause** — why it happened",
  "- **fix** — what changed (files + PR/commit)",
  "- **lesson** — the imperative rule a future session should follow",
  "",
].join("\n");
writeFileSync(path.join(dir, "_template.md"), template);

console.log("INIT — wrote docs/learnings/{config.json, README.md, _template.md} with areas: " +
  areaSlugs.join(", "));
