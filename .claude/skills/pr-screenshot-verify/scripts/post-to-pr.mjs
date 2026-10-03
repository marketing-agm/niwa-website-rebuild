// post-to-pr.mjs: put the captures on an assets branch and post the PR comment.
//
// Usage:
//   node post-to-pr.mjs <prNumber> <shotsDir> [introFile] [--title "..."] [--outro file] [--body-only] [--dry-run]
//
//   --title      what the comment is about, as in "## Screenshots for <title>"
//   --outro      a file with the closing part: edge cases checked, anything else fixed
//   --body-only  upload the images and write comment.md, but do not post. Read it
//                through, then post it yourself (in Claude Code on the web, with the
//                GitHub tool) and link it from the PR description.
//   --dry-run    change nothing: no upload, no post. Writes comment.md with the
//                addresses the images would have.
//
// WHERE THE IMAGES GO. A branch named assets/pr-<n>-shots, in the folder
// verification/pr-<n>/<commit>/. The branch is not part of the code changes, so
// the images never show in "Files changed". Each run adds a folder, so posting
// again on a later commit never breaks what an earlier comment shows. The branch
// is written through a temporary git worktree (a second checkout in another
// folder), so your own checkout never switches branch.
//
// HOW THE IMAGES ARE LINKED. https://github.com/OWNER/REPO/raw/BRANCH/PATH. In a
// private repo that is the only form that shows inline. raw.githubusercontent.com
// (and blob/...?raw=true, which redirects there) is a different site that gets no
// GitHub sign-in, so GitHub's image proxy receives a 404 and shows a broken image.
//
// SIGN-IN. GITHUB_TOKEN or GH_TOKEN when set, otherwise the stored git credential
// (the same one `git push` uses). Never printed.
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, mkdtempSync } from "node:fs";
import { execSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { buildComment } from "./build-comment.mjs";

// ---- Arguments: three plain values, two flags with a value, two switches. ----
const args = process.argv.slice(2);
const valueOf = (name) => { const i = args.indexOf("--" + name); return i >= 0 ? args[i + 1] : ""; };
const plain = args.filter((a, i) => !a.startsWith("--") && !["--title", "--outro"].includes(args[i - 1]));
const [prNumber, shotsArg, introFile] = plain;
const dryRun = args.includes("--dry-run");
const bodyOnly = dryRun || args.includes("--body-only");
if (!/^\d+$/.test(prNumber || "")) {
  console.error('usage: post-to-pr.mjs <prNumber> <shotsDir> [introFile] [--title "..."] [--outro file] [--body-only] [--dry-run]');
  process.exit(2);
}
const shotsDir = path.resolve(shotsArg || ".pr-shots");

const sh = (cmd, opts = {}) => execSync(cmd, { encoding: "utf8", ...opts }).trim();
const read = (f) => (f && existsSync(f) ? readFileSync(f, "utf8") : "");

// owner/repo from the origin remote.
const m = sh("git remote get-url origin").match(/github\.com[:/]([^/]+)\/([^/.]+)(?:\.git)?/);
if (!m) { console.error("Could not read owner/repo from the origin remote."); process.exit(1); }
const [owner, repo] = [m[1], m[2]];

// ---- What to upload: every file the manifest names that exists. ----
const manifestPath = path.join(shotsDir, "manifest.json");
if (!existsSync(manifestPath)) { console.error("No manifest.json in " + shotsDir + ". Run drive.mjs first."); process.exit(1); }
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const files = manifest.shots.flatMap((s) => [s.name, s.strip].filter(Boolean)).filter((f) => {
  if (existsSync(path.join(shotsDir, f))) return true;
  console.warn(`warning: ${f} is missing${f.endsWith(".gif") ? " (run frames-to-gif.py on its -frames folder)" : ""}; skipped`);
  return false;
});
manifest.shots = manifest.shots.filter((s) => files.includes(s.name));
if (!files.length) { console.error("Nothing to upload in " + shotsDir); process.exit(1); }
if (sh("git status --porcelain --untracked-files=no")) console.warn("warning: uncommitted changes; the captures may not match the commit named in the comment.");

/** Commits the files to the assets branch through a temporary worktree and pushes it. */
function publish(branch, destRel) {
  const hasBranch = !!sh(`git ls-remote --heads origin ${branch}`);
  sh(`git fetch --quiet origin ${hasBranch ? branch : "main"}`);
  const wt = mkdtempSync(path.join(os.tmpdir(), "pr-shots-"));
  try {
    sh(`git worktree add --quiet --detach "${wt}" FETCH_HEAD`);
    mkdirSync(path.join(wt, destRel), { recursive: true });
    for (const f of files) copyFileSync(path.join(shotsDir, f), path.join(wt, destRel, f));
    sh(`git -C "${wt}" add "${destRel}"`);
    // [CF-Pages-Skip] stops Cloudflare building this branch. Without it every post
    // makes a deployment of old code plus PNGs, listed as the newest deployment.
    sh(`git -C "${wt}" commit -q -m "chore: PR #${prNumber} verification screenshots (${destRel}) [CF-Pages-Skip]"`);
    sh(`git -C "${wt}" push -q origin HEAD:refs/heads/${branch}`);
  } finally {
    try { sh(`git worktree remove --force "${wt}"`); } catch { /* already removed */ }
  }
}

/** The GitHub token, or "" when there is none. */
function token() {
  if (process.env.GITHUB_TOKEN || process.env.GH_TOKEN) return process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  try {
    return sh("git credential fill", { input: "protocol=https\nhost=github.com\n\n" })
      .split("\n").find((l) => l.startsWith("password="))?.slice(9) || "";
  } catch { return ""; }
}

async function main() {
  const commit = sh("git rev-parse --short HEAD");
  const branch = `assets/pr-${prNumber}-shots`;
  const destRel = `verification/pr-${prNumber}/${commit}`;
  if (!dryRun) publish(branch, destRel);

  const url = (f) => `https://github.com/${owner}/${repo}/raw/${branch}/${destRel}/${f}`;
  const body = buildComment({ manifest, url, title: valueOf("title") || undefined, intro: read(introFile), outro: read(valueOf("outro")) });
  const out = path.join(shotsDir, "comment.md");
  writeFileSync(out, body);
  console.log(`${dryRun ? "dry run, nothing uploaded" : `uploaded ${files.length} file(s) to ${branch}/${destRel}`}`);
  if (bodyOnly) { console.log("COMMENT_FILE=" + out); return; }

  const t = token();
  if (!t) { console.error("No GitHub token found. comment.md is ready to post by hand: " + out); process.exit(2); }
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`, {
    method: "POST",
    headers: { Authorization: "token " + t, Accept: "application/vnd.github+json", "User-Agent": "pr-screenshot-verify", "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
  const data = await res.json();
  if (!res.ok) { console.error("HTTP " + res.status + ": " + (data.message || "")); process.exit(1); }
  console.log("COMMENT_URL=" + data.html_url);
}
main().catch((e) => { console.error("FATAL", e.message); process.exit(1); });
