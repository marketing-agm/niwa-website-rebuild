import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { makeRepo, cleanup, runScript, writeConfig, SAMPLE_CONFIG } from "./helpers.mjs";

// Helper: make a commit touching the given repo-relative file path.
function commitFile(g, dir, relPath, message) {
  const full = path.join(dir, relPath);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, "x");
  g(["add", "-A"]);
  g(["commit", "-q", "-m", message]);
}

test("stop-hook stays silent when no config exists", () => {
  const { dir, g } = makeRepo();
  try {
    commitFile(g, dir, "src/a.js", "feat: add a");
    const r = runScript("stop-hook.mjs", { cwd: dir });
    assert.equal(r.status, 0);
    assert.equal(r.stdout.trim(), "");
  } finally { cleanup(dir); }
});

test("stop-hook nudges after a recent app-code commit that isn't logged", () => {
  const { dir, g } = makeRepo();
  try {
    writeConfig(dir, SAMPLE_CONFIG);            // appCodePaths includes "src/"
    commitFile(g, dir, "src/a.js", "fix: a");
    const r = runScript("stop-hook.mjs", { cwd: dir });
    assert.equal(r.status, 0);
    assert.match(r.stdout, /learnings-log backstop/);
  } finally { cleanup(dir); }
});

test("stop-hook stays silent when the commit only touches non-app paths", () => {
  const { dir, g } = makeRepo();
  try {
    writeConfig(dir, SAMPLE_CONFIG);
    commitFile(g, dir, "notes.txt", "docs: notes");
    const r = runScript("stop-hook.mjs", { cwd: dir });
    assert.equal(r.status, 0);
    assert.equal(r.stdout.trim(), "");
  } finally { cleanup(dir); }
});

test("stop-hook stays silent once the commit SHA is already logged", () => {
  const { dir, g } = makeRepo();
  try {
    writeConfig(dir, SAMPLE_CONFIG);              // appCodePaths includes "src/"
    commitFile(g, dir, "src/a.js", "fix: a");
    const sha = g(["rev-parse", "--short", "HEAD"]).trim();
    const ld = path.join(dir, "docs", "learnings");
    mkdirSync(ld, { recursive: true });
    writeFileSync(path.join(ld, "frontend.md"), `<!-- log-id: ${sha} :: already logged -->\n`);
    const r = runScript("stop-hook.mjs", { cwd: dir });
    assert.equal(r.status, 0);
    assert.equal(r.stdout.trim(), "");            // silent because the SHA is already logged
  } finally { cleanup(dir); }
});
