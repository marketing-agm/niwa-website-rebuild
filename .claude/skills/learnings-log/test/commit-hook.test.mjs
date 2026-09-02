import { test } from "node:test";
import assert from "node:assert/strict";
import { runScript } from "./helpers.mjs";

function hookInput(command) {
  return JSON.stringify({ tool_input: { command } });
}

test("commit-hook reminds after a git commit", () => {
  const r = runScript("commit-hook.mjs", { input: hookInput('git commit -m "fix: x"') });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /learnings-log/);
});

test("commit-hook reminds after gh pr create", () => {
  const r = runScript("commit-hook.mjs", { input: hookInput("gh pr create --fill") });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /learnings-log/);
});

test("commit-hook reminds after git push", () => {
  const r = runScript("commit-hook.mjs", { input: hookInput("git push origin main") });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /learnings-log/);
});

test("commit-hook stays silent for unrelated commands", () => {
  const r = runScript("commit-hook.mjs", { input: hookInput("npm run build") });
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), "");
});

test("commit-hook does not fire when 'git commit' only appears inside an echo", () => {
  const r = runScript("commit-hook.mjs", { input: hookInput('echo "remember to git commit"') });
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), "");
});
