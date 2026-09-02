// config.mjs — shared helpers for the learnings-log scripts.
// Resolves the repo root and loads the per-project config that tells the scripts
// which learning "areas" (buckets) exist and which paths count as app code.
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

// Find the git repo root so docs/learnings always lives at the repo top,
// no matter which subfolder the skill was copied into.
export function repoRoot() {
  return execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
}

// The folder that holds the learnings index, config, and per-area files.
export function learnDir(root = repoRoot()) {
  return path.join(root, "docs", "learnings");
}

// Absolute path to the project's learnings config file.
export function configPath(root = repoRoot()) {
  return path.join(learnDir(root), "config.json");
}

// Load and parse config.json. Returns null if it does not exist yet (so callers
// can decide whether to error or stay silent). Throws only if the file exists
// but is not valid JSON.
export function loadConfig(root = repoRoot()) {
  const p = configPath(root);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8"));
}
