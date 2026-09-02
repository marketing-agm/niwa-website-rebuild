// log.mjs — append a learnings entry to its per-area file and update the index.
// Reads the project's areas from docs/learnings/config.json (created by init.mjs).
//
// Usage (JSON on stdin):
//   node .claude/skills/learnings-log/scripts/log.mjs <<'JSON'
//   { "area": "frontend", "type": "ux", "title": "...", "key": "<short sha>",
//     "summary": "...", "symptom": "...", "rootCause": "...", "fix": "...", "lesson": "..." }
//   JSON
//
// Idempotent: an entry whose key+title already exists is skipped (UPDATE=1 to replace).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { repoRoot, learnDir, loadConfig } from "./config.mjs";

const TYPES = ["bug", "ux", "regression", "gotcha"];

function readStdin() {
  try { return readFileSync(0, "utf8"); } catch { return ""; }
}
function fail(msg) { console.error("ERROR: " + msg); process.exit(2); }

const root = repoRoot();
const config = loadConfig(root);
if (!config)
  fail("No learnings config found at docs/learnings/config.json — run the learnings-log setup first.");

const AREA_TITLES = config.areas;        // slug -> human title
const AREAS = Object.keys(AREA_TITLES);

const raw = readStdin().trim();
if (!raw) fail("no JSON on stdin");
let e;
try { e = JSON.parse(raw); } catch (err) { fail("invalid JSON: " + err.message); }

for (const f of ["area", "type", "title", "key", "summary"])
  if (!e[f]) fail(`missing required field: ${f}`);
if (!AREAS.includes(e.area)) fail(`area must be one of: ${AREAS.join(", ")}`);
if (!TYPES.includes(e.type)) fail(`type must be one of: ${TYPES.join(", ")}`);
const date = e.date || new Date().toISOString().slice(0, 10);

const dir = learnDir(root);
mkdirSync(dir, { recursive: true });
const indexPath = path.join(dir, "README.md");
const areaPath = path.join(dir, `${e.area}.md`);
const update = !!process.env.UPDATE;

// ── Area file ────────────────────────────────────────────────────────────────
const MARKER = "<!-- newest first -->";
let areaDoc = existsSync(areaPath)
  ? readFileSync(areaPath, "utf8")
  : `# ${AREA_TITLES[e.area]} — learnings\n\nFixes and gotchas for this area, newest first. Index: [README.md](./README.md).\n\n${MARKER}\n`;

// Idempotency: a precise per-entry marker (key + title), so logging at commit-time
// and again at PR-time does not double-log.
const id = `${e.key} :: ${e.title}`;
const idMarker = `<!-- log-id: ${id} -->`;
if (areaDoc.includes(idMarker) && !update) {
  console.log(`SKIP — already logged: "${e.title}" (key ${e.key}) in ${e.area}.md. Set UPDATE=1 to re-log.`);
  process.exit(0);
}
const ref = e.ref || e.key;  // human-readable provenance; key stays the stable id

const block = [
  idMarker,
  `### ${date} · ${e.area} · ${e.type} · ${e.title}`,
  `- **Ref:** ${ref}`,
  ...(e.symptom ? [`- **Symptom:** ${e.symptom}`] : []),
  ...(e.rootCause ? [`- **Root cause:** ${e.rootCause}`] : []),
  ...(e.fix ? [`- **Fix:** ${e.fix}`] : []),
  ...(e.lesson ? [`- **Lesson:** ${e.lesson}`] : []),
  "",
].join("\n");

if (!areaDoc.includes(MARKER)) areaDoc = areaDoc.trimEnd() + `\n\n${MARKER}\n`;

// On UPDATE=1, remove the existing block for this entry so we replace it
// instead of writing a second copy with the same log-id marker.
if (update && areaDoc.includes(idMarker)) {
  const esc = idMarker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Remove the whole existing block: from its log-id marker up to (but not
  // including) the next entry's log-id marker, or to end of file. Robust even
  // when a field value contains an internal blank line.
  areaDoc = areaDoc.replace(new RegExp(esc + "[\\s\\S]*?(?=<!-- log-id:|$)"), "");
}

areaDoc = areaDoc.replace(MARKER, `${MARKER}\n\n${block}`);
writeFileSync(areaPath, areaDoc);

// ── Index ────────────────────────────────────────────────────────────────────
const indexLine = `- [${date}] ${e.type} — ${e.summary} (${ref})`;
let index = existsSync(indexPath) ? readFileSync(indexPath, "utf8") : "";
if (!index) {
  index = "# Learnings index\n\n" +
    "Cross-session record of fixes and gotchas. Full entries live in the per-area " +
    "files; one line per entry below, newest first.\n\n" +
    AREAS.map((a) => `## ${a}\n_(none yet)_\n`).join("\n");
}
const header = `## ${e.area}`;
const lines = index.split("\n");
let hi = lines.findIndex((l) => l.trim() === header);
if (hi === -1) { lines.push("", header, "_(none yet)_"); hi = lines.length - 2; }
// drop a "(none yet)" placeholder in this section, then insert newest-first
if ((lines[hi + 1] || "").includes("(none yet)")) lines.splice(hi + 1, 1);
// guard against an exact duplicate line on UPDATE=1 re-log
if (!lines.includes(indexLine)) lines.splice(hi + 1, 0, indexLine);
writeFileSync(indexPath, lines.join("\n"));

console.log(`LOGGED ${e.area}/${e.type} "${e.title}" → docs/learnings/${e.area}.md + index`);
