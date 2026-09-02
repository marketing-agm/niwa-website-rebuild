import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { makeRepo, cleanup, runScript, writeConfig, SAMPLE_CONFIG } from "./helpers.mjs";

const ENTRY = {
  area: "frontend", type: "ux", title: "Badge clipped on long names",
  key: "abc1234", summary: "keep must-see elements out of clamped boxes",
  symptom: "badge missing", rootCause: "inside line-clamp box",
  fix: "moved badge out", lesson: "never clamp a must-see element",
};

test("log appends an entry and updates the index", () => {
  const { dir } = makeRepo();
  try {
    writeConfig(dir, SAMPLE_CONFIG);
    const r = runScript("log.mjs", { cwd: dir, input: JSON.stringify(ENTRY) });
    assert.equal(r.status, 0, r.stderr);
    const ld = path.join(dir, "docs", "learnings");
    const area = readFileSync(path.join(ld, "frontend.md"), "utf8");
    assert.match(area, /Badge clipped on long names/);
    assert.match(area, /<!-- log-id: abc1234 :: Badge clipped on long names -->/);
    const index = readFileSync(path.join(ld, "README.md"), "utf8");
    assert.match(index, /keep must-see elements out of clamped boxes/);
  } finally { cleanup(dir); }
});

test("log is idempotent on the same key+title (SKIP, no duplicate)", () => {
  const { dir } = makeRepo();
  try {
    writeConfig(dir, SAMPLE_CONFIG);
    runScript("log.mjs", { cwd: dir, input: JSON.stringify(ENTRY) });
    const second = runScript("log.mjs", { cwd: dir, input: JSON.stringify(ENTRY) });
    assert.match(second.stdout, /SKIP/);
    const area = readFileSync(path.join(dir, "docs", "learnings", "frontend.md"), "utf8");
    const count = (area.match(/<!-- log-id: abc1234 :: Badge clipped on long names -->/g) || []).length;
    assert.equal(count, 1);
  } finally { cleanup(dir); }
});

test("log rejects an area not in config", () => {
  const { dir } = makeRepo();
  try {
    writeConfig(dir, SAMPLE_CONFIG);
    const r = runScript("log.mjs", { cwd: dir, input: JSON.stringify({ ...ENTRY, area: "governance" }) });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /area must be one of/);
  } finally { cleanup(dir); }
});

test("log errors clearly when no config exists", () => {
  const { dir } = makeRepo();
  try {
    const r = runScript("log.mjs", { cwd: dir, input: JSON.stringify(ENTRY) });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /run the learnings-log setup first/);
  } finally { cleanup(dir); }
});

test("UPDATE=1 replaces the existing entry (no duplicate block or index line)", () => {
  const { dir } = makeRepo();
  try {
    writeConfig(dir, SAMPLE_CONFIG);
    // First log — establishes the entry
    runScript("log.mjs", { cwd: dir, input: JSON.stringify(ENTRY) });
    // Second log with UPDATE=1 — must replace, not duplicate
    const r = runScript("log.mjs", { cwd: dir, input: JSON.stringify(ENTRY), env: { UPDATE: "1" } });
    assert.equal(r.status, 0, r.stderr);

    const ld = path.join(dir, "docs", "learnings");
    const area = readFileSync(path.join(ld, "frontend.md"), "utf8");

    // Exactly one id-marker block
    const markerCount = (area.match(/<!-- log-id: abc1234 :: Badge clipped on long names -->/g) || []).length;
    assert.equal(markerCount, 1, `expected 1 log-id marker, got ${markerCount}`);

    // Exactly one ### heading line for this title
    const headingCount = (area.match(/### .*Badge clipped on long names/g) || []).length;
    assert.equal(headingCount, 1, `expected 1 heading, got ${headingCount}`);

    // Exactly one matching index line in README
    const index = readFileSync(path.join(ld, "README.md"), "utf8");
    const indexCount = (index.match(/keep must-see elements out of clamped boxes/g) || []).length;
    assert.equal(indexCount, 1, `expected 1 index line, got ${indexCount}`);
  } finally { cleanup(dir); }
});

test("log rejects an invalid type", () => {
  const { dir } = makeRepo();
  try {
    writeConfig(dir, SAMPLE_CONFIG);
    const r = runScript("log.mjs", { cwd: dir, input: JSON.stringify({ ...ENTRY, type: "oops" }) });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /type must be one of/);
  } finally { cleanup(dir); }
});

test("UPDATE=1 replaces cleanly even when a field has an internal blank line", () => {
  const { dir } = makeRepo();
  try {
    writeConfig(dir, SAMPLE_CONFIG);
    const multi = {
      area: "frontend", type: "bug", title: "Multi-paragraph lesson entry",
      key: "def5678", summary: "handles blank lines in fields",
      lesson: "first paragraph\n\nsecond paragraph after a blank line",
    };
    runScript("log.mjs", { cwd: dir, input: JSON.stringify(multi) });
    runScript("log.mjs", { cwd: dir, input: JSON.stringify(multi), env: { UPDATE: "1" } });
    const area = readFileSync(path.join(dir, "docs", "learnings", "frontend.md"), "utf8");
    const markers = (area.match(/<!-- log-id: def5678 :: Multi-paragraph lesson entry -->/g) || []).length;
    const headings = (area.match(/### .*Multi-paragraph lesson entry/g) || []).length;
    assert.equal(markers, 1, "exactly one log-id marker after update");
    assert.equal(headings, 1, "exactly one heading after update");
    assert.match(area, /second paragraph after a blank line/);
  } finally { cleanup(dir); }
});
