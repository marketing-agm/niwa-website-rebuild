// post-to-pr.mjs — host screenshots on an assets branch and post them to a PR comment.
//
// Usage:
//   node .claude/skills/pr-screenshot-verify/scripts/post-to-pr.mjs <prNumber> <shotsDir> [introFile]
//
// Why an assets branch: GitHub's image proxy (camo) cannot fetch raw images from a PRIVATE
// repo, so inline ![](raw) embeds won't render if the files live only in a normal branch the
// viewer isn't on. Committing them to a dedicated branch and linking the in-repo blob URL lets
// authenticated collaborators view them; we embed AND link so it degrades gracefully.
//
// Auth: no gh CLI and no token env var. Two setups both work:
//   - a local checkout, where `git credential fill` returns the token `git push` uses;
//   - a hosted session behind an egress proxy, which injects GitHub credentials itself. There is no
//     credential helper there, and `git credential fill` does not fail quietly — it tries to prompt
//     for a username and dies with "terminal prompts disabled" — so the call is guarded.
// Do NOT reach for GITHUB_TOKEN as a substitute: in a proxied session that variable can be set and
// still not be a valid GitHub API token, so it turns a working request into a 401.
import { readFileSync, existsSync, mkdirSync, copyFileSync, readdirSync } from "node:fs";
import { execSync, execFileSync } from "node:child_process";
import path from "node:path";

const prNumber = process.argv[2];
const shotsDir = path.resolve(process.argv[3] || ".pr-shots");
const introFile = process.argv[4];
if (!prNumber || !/^\d+$/.test(prNumber)) { console.error("usage: post-to-pr.mjs <prNumber> <shotsDir> [introFile]"); process.exit(2); }

const sh = (cmd, opts = {}) => execSync(cmd, { encoding: "utf8", ...opts }).trim();
const repoRoot = sh("git rev-parse --show-toplevel");

// owner/repo from the origin remote.
const remote = sh("git remote get-url origin");
const m = remote.match(/github\.com[:/]([^/]+)\/([^/.]+)(?:\.git)?/);
if (!m) { console.error("Could not parse owner/repo from: " + remote); process.exit(1); }
const owner = m[1], repo = m[2];

// Read the manifest for captions + error summary (written by drive.mjs).
const manifestPath = path.join(shotsDir, "manifest.json");
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : { shots: [], errors: [] };
const shots = manifest.shots.length
  ? manifest.shots
  : readdirSync(shotsDir).filter((f) => /\.(png|jpe?g)$/i.test(f)).map((name) => ({ name, caption: "" }));
if (!shots.length) { console.error("No screenshots found in " + shotsDir); process.exit(1); }

const proxy = process.env.HTTPS_PROXY || process.env.https_proxy || "";

// Token, never printed. Optional: behind an egress proxy that injects GitHub
// credentials there is nothing to find and nothing needed.
function readToken() {
  try {
    return sh("git credential fill", { input: "protocol=https\nhost=github.com\n\n", stdio: ["pipe", "pipe", "pipe"] })
      .split("\n").find((l) => l.startsWith("password="))?.slice("password=".length);
  } catch {
    return undefined;   // no helper configured, or it tried to prompt for a username
  }
}
const token = readToken();
if (!token && !proxy) {
  console.error("No GitHub credential: configure a git credential helper (the one `git push` uses).");
  process.exit(2);
}

const startBranch = sh("git rev-parse --abbrev-ref HEAD");
if (sh("git status --porcelain")) { console.error("Working tree is dirty — commit/stash before posting."); process.exit(1); }

// Per-commit subdir + accumulate on the existing assets branch, so posting again
// (a later commit, a follow-up comment) never clobbers screenshots that earlier
// PR comments still embed.
const runTag = sh("git rev-parse --short HEAD");
const assetsBranch = `assets/pr-${prNumber}-shots`;
const destRel = `verification/pr-${prNumber}/${runTag}`;
const remoteHasAssets = (() => { try { return !!sh(`git ls-remote --heads origin ${assetsBranch}`); } catch { return false; } })();
try {
  if (remoteHasAssets) {
    sh(`git fetch origin ${assetsBranch} --quiet`);
    sh(`git checkout -B ${assetsBranch} origin/${assetsBranch}`);
  } else {
    // Base the assets branch on the repo's ACTUAL default branch, resolved from
    // origin/HEAD. Hardcoding "main" broke here: this repo's default branch is
    // claude/niwa-website-rebuild-setup-4i1y68 and origin/main does not exist,
    // so the fetch failed and no screenshots were ever posted.
    const defaultBranch = (() => {
      try {
        return sh("git symbolic-ref --short refs/remotes/origin/HEAD").replace(/^origin\//, "");
      } catch {
        try {
          const m = sh("git remote show origin").match(/HEAD branch:\s*(\S+)/);
          if (m) return m[1];
        } catch {}
        return "main";
      }
    })();
    sh(`git fetch origin ${defaultBranch} --quiet`);
    sh(`git checkout -B ${assetsBranch} origin/${defaultBranch}`);
  }
  const destAbs = path.join(repoRoot, destRel);
  mkdirSync(destAbs, { recursive: true });
  for (const s of shots) copyFileSync(path.join(shotsDir, s.name), path.join(destAbs, s.name));
  sh(`git add ${destRel}`);
  // [CF-Pages-Skip] stops Cloudflare building this branch.
  //
  // Without it every screenshot post creates a deployment: this branch is the
  // production code plus a folder of PNGs, so Cloudflare builds it and it lands
  // at the top of the deployment list — the newest deployment by time, carrying
  // the oldest code on the list. That is what made the site look like it was
  // flip-flopping between palettes; it was really alternating between real
  // preview branches and these.
  //
  // The dashboard fix is to exclude assets/* under branch control, but this
  // belongs in the repo where it cannot be un-set by accident. Cloudflare also
  // honours [CI Skip], [Skip CI] and [CF Pages Skip] — any one of them is enough.
  sh(`git commit -q -m "chore: PR #${prNumber} verification screenshots (${runTag}) [CF-Pages-Skip]"`);
  sh(`git push -u origin ${assetsBranch}`);
} finally {
  sh(`git checkout ${startBranch}`);
}

// Build the comment.
const blob = (name) => `https://github.com/${owner}/${repo}/blob/${assetsBranch}/${destRel}/${name}`;
const intro = introFile && existsSync(introFile) ? readFileSync(introFile, "utf8").trim() + "\n\n" : "";
let md = `## 🧪 Runtime verification — screenshots\n\n${intro}`;
md += `Captured by driving the running app in a headless browser with a seeded session. `;
md += manifest.errors?.length
  ? `⚠️ **${manifest.errors.length} console/page error(s):** ${manifest.errors.slice(0, 5).map((e) => "`" + e.slice(0, 120) + "`").join("; ")}\n\n`
  : `**0 console/page errors.**\n\n`;
md += `> Screenshots live on the \`${assetsBranch}\` branch (kept out of the code diff). If an image doesn't render inline (GitHub proxies private-repo images), use the **view** link.\n\n`;
for (const s of shots) {
  md += `**${s.name.replace(/\.(png|jpe?g)$/i, "")}**${s.caption ? " — " + s.caption : ""} &nbsp; <sub>([view](${blob(s.name)}))</sub>\n`;
  md += `![${s.name}](${blob(s.name)}?raw=true)\n\n`;
}

const apiUrl = `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`;
const payload = JSON.stringify({ body: md });

/**
 * POST the comment. Two transports, because Node's built-in fetch ignores
 * HTTPS_PROXY: behind an egress proxy it would connect direct, get rejected, and
 * report "Bad credentials" — an auth error for what is actually a routing
 * problem. curl honours the proxy, so use it whenever one is configured.
 */
async function postComment() {
  if (proxy) {
    const args = ["-sS", "-X", "POST", apiUrl,
      "-H", "Accept: application/vnd.github+json",
      "-H", "User-Agent: pr-screenshot-verify",
      "-H", "Content-Type: application/json",
      "--data-binary", "@-"];
    // Only send a token if we have one; a proxy that injects credentials will
    // reject a request that arrives with a competing Authorization header.
    if (token) args.push("-H", "Authorization: token " + token);
    const out = execFileSync("curl", args, { input: payload, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
    return JSON.parse(out);
  }
  const res = await fetch(apiUrl, {
    method: "POST",
    headers: { Authorization: "token " + token, Accept: "application/vnd.github+json", "User-Agent": "pr-screenshot-verify", "Content-Type": "application/json" },
    body: payload,
  });
  return res.json();
}

const data = await postComment();
if (!data?.html_url) { console.error("Comment not created:"); console.error(JSON.stringify(data, null, 2)); process.exit(1); }
console.log("COMMENT_URL=" + data.html_url);
console.log("ASSETS_BRANCH=" + assetsBranch);
