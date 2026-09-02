import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadConfig, learnDir, configPath } from "../scripts/config.mjs";

test("loadConfig returns null when no config file exists", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cfg-"));
  try {
    assert.equal(loadConfig(dir), null);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("loadConfig parses an existing config.json", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cfg-"));
  try {
    mkdirSync(learnDir(dir), { recursive: true });
    writeFileSync(configPath(dir),
      JSON.stringify({ areas: { misc: "Misc" }, appCodePaths: ["src/"] }));
    const cfg = loadConfig(dir);
    assert.deepEqual(cfg.areas, { misc: "Misc" });
    assert.deepEqual(cfg.appCodePaths, ["src/"]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
