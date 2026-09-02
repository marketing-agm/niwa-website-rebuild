// Stop hook — low-noise backstop. Reminds to log ONLY when the latest commit is
// recent (< 20 min), touched app code (per config.appCodePaths), and its SHA is
// not yet in docs/learnings. Stays completely silent if the project has not run
// setup yet (no config.json), so an un-configured drop-in never nags. Always
// non-blocking (exit 0) so it can never create a stop loop.
import { readdirSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { repoRoot, learnDir, loadConfig } from "./config.mjs";

try {
  const root = repoRoot();
  const config = loadConfig(root);
  // No config yet, or no configured app-code paths -> stay silent.
  if (!config || !Array.isArray(config.appCodePaths) || config.appCodePaths.length === 0)
    process.exit(0);

  const git = (a) => execSync(`git -C "${root}" ${a}`, { encoding: "utf8" }).trim();
  const sha = git("rev-parse --short HEAD");
  // Skip merge commits (>1 parent) — a merge isn't a fix and can't be "logged".
  if (git("rev-list --parents -n 1 HEAD").split(/\s+/).length > 2) process.exit(0);
  const ageMin = (Date.now() - parseInt(git("log -1 --format=%ct"), 10) * 1000) / 60000;
  if (ageMin > 20) process.exit(0);                                  // only nudge about a fresh commit

  // Build the "is this app code?" test from the project's configured path prefixes.
  // Escape regex-special characters so a literal prefix like "src/" matches as text.
  const escaped = config.appCodePaths.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const appCodeRe = new RegExp(`(^|\\n)(${escaped.join("|")})`);
  const files = git("show --name-only --format= HEAD");
  if (!appCodeRe.test(files)) process.exit(0);                       // not app code

  // Self-silence once the commit's SHA already appears in a learnings file.
  let logged = false;
  try {
    const ldir = learnDir(root);
    for (const f of readdirSync(ldir)) {
      if (f.endsWith(".md") && readFileSync(path.join(ldir, f), "utf8").includes(sha)) { logged = true; break; }
    }
  } catch { /* no learnings dir yet */ }
  if (logged) process.exit(0);

  const reminder =
    `📓 learnings-log backstop: commit ${sha} touched app code and isn't in docs/learnings yet. ` +
    `If it fixed a bug/UX issue or carries a reusable lesson, log it ` +
    `(node .claude/skills/learnings-log/scripts/log.mjs, key ${sha}). If it's a pure feature/chore, ignore this.`;
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: "Stop", additionalContext: reminder },
  }));
} catch { /* never block stop */ }
process.exit(0);
