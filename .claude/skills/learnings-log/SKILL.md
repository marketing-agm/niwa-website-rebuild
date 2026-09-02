---
name: learnings-log
description: Capture and recall cross-session engineering learnings for THIS project. SETUP — the first time in a repo, run setup to map the project's layout into learning "areas" and scaffold docs/learnings/. RECALL — before fixing a bug or UX/UI issue, grep docs/learnings/<area>.md for prior lessons and apply them. CAPTURE — after a commit/PR that FIXES a bug, UX/UI issue, or regression (or surfaces a reusable dev-experience gotcha), append a structured entry via scripts/log.mjs so future sessions and the team don't repeat it. Triggers: dropping this skill into a new repo; committing/opening a PR for a fix; the post-commit/Stop hooks reminding you to log; or starting a fix in a known area.
---

# Learnings Log

A durable, append-only record of fixes and gotchas in `docs/learnings/`, so future
Claude sessions **recall** past lessons before fixing and **capture** new ones
after, and the team gets a shared learnings trail. Per-area files hold full
entries; `README.md` is the one-line-per-entry index.

This skill is project-agnostic: the learning "areas" (buckets) and the paths that
count as app code live in `docs/learnings/config.json`, which setup generates for
the project you drop it into. The scripts read that config; nothing here is
hardcoded to a specific repo.

## SETUP — first time in a project (do this once)

If `docs/learnings/config.json` does not exist yet, set it up before anything else:

1. **Map the project.** Look at the repo's top-level layout, `CLAUDE.md`/`README`,
   and how the code is organized.
2. **Propose areas + app-code paths.** Draft a small set of buckets that match how
   THIS project is actually divided (e.g. `frontend`, `backend`, `parsers`,
   `worker`), plus the path prefixes that count as real app code (e.g.
   `frontend/src/`, `backend/`). Always include an `infra` bucket (build / tooling
   / git / devex gotchas are universal) and a `misc` catch-all.
3. **Get the user's approval** on the buckets. Do not auto-proceed; the areas are a
   judgment call.
4. **Scaffold** by piping the agreed config to the init script:

   ```bash
   node .claude/skills/learnings-log/scripts/init.mjs <<'JSON'
   {
     "areas": {
       "frontend": "Frontend / UI",
       "backend":  "Backend / API",
       "infra":    "Infra / tooling / devex",
       "misc":     "Misc"
     },
     "appCodePaths": ["frontend/src/", "backend/"]
   }
   JSON
   ```

   It writes `docs/learnings/config.json`, a seeded `README.md` index, and
   `_template.md`. It refuses to overwrite an existing config, so re-running is safe.

5. **Wire the reminder hooks.** Add these to the project's `.claude/settings.json`
   (show the user first, then merge — keep any hooks already there):

   ```json
   {
     "hooks": {
       "PostToolUse": [
         { "matcher": "Bash", "hooks": [
           { "type": "command", "command": "node \"${CLAUDE_PROJECT_DIR}/.claude/skills/learnings-log/scripts/commit-hook.mjs\"", "timeout": 15 } ] }
       ],
       "Stop": [
         { "hooks": [
           { "type": "command", "command": "node \"${CLAUDE_PROJECT_DIR}/.claude/skills/learnings-log/scripts/stop-hook.mjs\"", "timeout": 15 } ] }
       ]
     }
   }
   ```

   Note: the hook commands use the `${CLAUDE_PROJECT_DIR}/.claude/skills/...` absolute form because hooks do not run from the repo root; the one-off `node .claude/skills/learnings-log/scripts/...` commands elsewhere in this document are written to be run from the repo root.

   Then add a one-line pointer in the project's `CLAUDE.md` so every session knows
   the loop exists.

## RECALL — before you fix (do this first)

When you are about to fix a bug or UX/UI issue, **consult the log before editing**:

```bash
grep -ri "<keywords>" docs/learnings/<area>.md docs/learnings/README.md
```

Pick `<area>` from your project's `config.json`. If a prior entry's **Lesson**
applies, follow it. If you also use the `three-lens-review` skill, recall first,
then the three lenses, then implement.

## CAPTURE — after you fix

Log when a change **fixes** something or teaches something reusable: a bug fix,
UX/UI correction, regression, or a dev-experience **gotcha** (tooling, build, git,
verification, the harness). **Skip** pure feature additions, docs-only, and routine
chores unless they carry a reusable lesson.

Append with the helper (it keeps shape + index consistent and skips duplicates):

```bash
node .claude/skills/learnings-log/scripts/log.mjs <<'JSON'
{
  "area": "<one of the slugs in config.json>",
  "type": "ux",
  "title": "Short, specific title",
  "key": "<fixing commit short sha>",
  "ref": "#<PR> / <short-sha>",
  "summary": "the actionable lesson in one line (goes in the index)",
  "symptom": "what was observed / went wrong",
  "rootCause": "why it happened",
  "fix": "what changed (files + PR/commit)",
  "lesson": "the rule a future session should follow to avoid this"
}
JSON
```

- `type` = `bug | ux | regression | gotcha`. `area` must be one of the slugs in
  `config.json`.
- **`key` is the idempotency identity — use the fixing commit's short SHA** so
  logging at commit-time and again at PR-time (the hooks fire at both) does not
  double-log. For a session-only gotcha with no commit, use a short unique slug.
  `ref` is the human-readable provenance shown in the entry/index (defaults to `key`).
- Re-running the same `key`+`title` is a no-op (prints `SKIP`); set `UPDATE=1` to
  re-log. See `docs/learnings/_template.md` for the field reference.
- Write the **Lesson** as an imperative rule a future session can act on, not a
  description of the incident.

## When this runs

- **Hooks (automatic):** a `PostToolUse` hook on `git commit`/`git push`/PR
  creation reminds you to log the fix on every such command regardless of which files
  changed; a `Stop` hook reminds you before the session ends, but only when a recent
  commit touched configured app-code paths and is not yet logged. They prompt; you
  author the entry (only Claude has the root-cause + lesson). The Stop hook stays
  silent until setup has created `config.json`.
- **On demand:** invoke any time to recall or capture.

## Notes

- Entries carry a hidden `<!-- log-id: key :: title -->` marker for precise dedup;
  do not hand-edit it.
- Keep entries short and signal-dense; the index line is the lesson at a glance.
- Point the project's `CLAUDE.md` here so every session is aware of the loop.
