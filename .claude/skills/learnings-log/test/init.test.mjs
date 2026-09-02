import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { makeRepo, cleanup, runScript } from "./helpers.mjs";

test("init scaffolds config.json, README index, and template", () => {
  const { dir } = makeRepo();
  try {
    const cfg = { areas: { frontend: "Frontend / UI", misc: "Misc" }, appCodePaths: ["src/"] };
    const r = runScript("init.mjs", { cwd: dir, input: JSON.stringify(cfg) });
    assert.equal(r.status, 0, r.stderr);
    const ld = path.join(dir, "docs", "learnings");
    assert.ok(existsSync(path.join(ld, "config.json")));
    const written = JSON.parse(readFileSync(path.join(ld, "config.json"), "utf8"));
    assert.deepEqual(written.areas, cfg.areas);
    const index = readFileSync(path.join(ld, "README.md"), "utf8");
    assert.match(index, /## frontend/);
    assert.match(index, /## misc/);
    assert.ok(existsSync(path.join(ld, "_template.md")));
  } finally { cleanup(dir); }
});

test("init refuses to overwrite an existing config.json", () => {
  const { dir } = makeRepo();
  try {
    const cfg = { areas: { misc: "Misc" }, appCodePaths: ["src/"] };
    runScript("init.mjs", { cwd: dir, input: JSON.stringify(cfg) });
    const second = runScript("init.mjs", {
      cwd: dir, input: JSON.stringify({ areas: { other: "Other" }, appCodePaths: [] }),
    });
    assert.equal(second.status, 0);
    assert.match(second.stdout, /SKIP/);
    const written = JSON.parse(readFileSync(path.join(dir, "docs", "learnings", "config.json"), "utf8"));
    assert.deepEqual(written.areas, cfg.areas);  // original preserved
  } finally { cleanup(dir); }
});

test("init fails on a config with no areas", () => {
  const { dir } = makeRepo();
  try {
    const r = runScript("init.mjs", { cwd: dir, input: JSON.stringify({ appCodePaths: [] }) });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /areas/);
  } finally { cleanup(dir); }
});

test("init fails on empty stdin", () => {
  const { dir } = makeRepo();
  try {
    const r = runScript("init.mjs", { cwd: dir, input: "" });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /no config JSON on stdin/);
  } finally { cleanup(dir); }
});

test("init fails on unparseable JSON", () => {
  const { dir } = makeRepo();
  try {
    const r = runScript("init.mjs", { cwd: dir, input: "not json" });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /invalid JSON/);
  } finally { cleanup(dir); }
});
