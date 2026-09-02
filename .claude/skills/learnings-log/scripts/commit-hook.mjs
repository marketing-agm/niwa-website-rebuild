// PostToolUse(Bash) hook — after a git commit/push/PR, remind to record the fix.
// Reads the hook payload on stdin; injects a non-blocking reminder (exit 0 + JSON).
// Stays silent for everything that isn't a commit/push/PR creation.
import { readFileSync } from "node:fs";

let input = {};
try { input = JSON.parse(readFileSync(0, "utf8")); } catch { process.exit(0); }
const cmd = String(input?.tool_input?.command || "");

// Match only when the verb is at a COMMAND position (start of string or after a
// shell separator) — so an echo/grep that merely *contains* "git commit" doesn't
// trigger a false reminder.
const atCmd = (verb) => new RegExp(`(^|[;&|(\\n])\\s*${verb}\\b`).test(cmd);
const isCommit = atCmd("git\\s+commit");
const isPush = atCmd("git\\s+push");
const isPR = atCmd("gh\\s+pr\\s+create");
if (!(isCommit || isPush || isPR)) process.exit(0);

const what = isCommit ? "commit" : isPush ? "push" : "PR";
const reminder =
  `📓 learnings-log: you just made a ${what}. If it FIXES a bug, UX/UI issue, or regression — ` +
  `or surfaced a reusable dev-experience gotcha — record it now via the learnings-log skill ` +
  `(node .claude/skills/learnings-log/scripts/log.mjs), keyed to the fixing commit's short SHA. ` +
  `It dedups, so re-logging at PR-time is safe. Skip for pure features / chores / docs.`;

process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: reminder },
}));
process.exit(0);
