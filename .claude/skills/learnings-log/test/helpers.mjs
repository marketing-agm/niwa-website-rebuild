// helpers.mjs — test utilities. Spin up a throwaway git repo in a temp dir so we
// can run the scripts exactly as they run in a real project (they locate
// docs/learnings via `git rev-parse --show-toplevel`).
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const scriptsDir = path.join(here, "..", "scripts");

// Create a temp git repo with an identity (commits need a name/email).
export function makeRepo() {
  const dir = mkdtempSync(path.join(tmpdir(), "learnlog-"));
  const g = (args) =>
    execFileSync("git", ["-C", dir, ...args], {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
  g(["init", "-q"]);
  g(["config", "core.autocrlf", "false"]);
  g(["config", "user.email", "test@example.com"]);
  g(["config", "user.name", "Test"]);
  return { dir, g };
}

// Remove a temp repo.
export function cleanup(dir) {
  rmSync(dir, { recursive: true, force: true });
}

// Run one of the skill's scripts inside `cwd`, feeding `input` on stdin.
// Returns { status, stdout, stderr } instead of throwing, so tests can assert
// on non-zero exits.
export function runScript(name, { cwd, input = "", env = {} } = {}) {
  try {
    const stdout = execFileSync("node", [path.join(scriptsDir, name)], {
      cwd, input, encoding: "utf8",
      env: { ...process.env, ...env },
      stdio: ["pipe", "pipe", "pipe"],  // capture stderr too; never inherit to parent
    });
    return { status: 0, stdout, stderr: "" };
  } catch (err) {
    return {
      status: err.status ?? 1,
      stdout: err.stdout?.toString() ?? "",
      stderr: err.stderr?.toString() ?? "",
    };
  }
}

// Write docs/learnings/config.json into a repo without running init.
export function writeConfig(dir, config) {
  const ld = path.join(dir, "docs", "learnings");
  mkdirSync(ld, { recursive: true });
  writeFileSync(path.join(ld, "config.json"), JSON.stringify(config, null, 2));
}

export const SAMPLE_CONFIG = {
  areas: { frontend: "Frontend / UI", infra: "Infra / tooling / devex", misc: "Misc" },
  appCodePaths: ["src/", "backend/"],
};
