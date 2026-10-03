// build-comment.mjs: write the PR comment from a shots folder's manifest.json.
//
// Usage (preview the text before posting; post-to-pr.mjs calls buildComment itself):
//   node build-comment.mjs <shotsDir> [--title "the calendar month view"] [--intro file] [--outro file]
//
// The comment follows references/comment-style.md:
//   ## Screenshots for <title>
//   one line saying which commit, which browser and how wide the window was
//   ### 1. <shot title>  then  **How to get here:**  **What to look at:**  and the image
//   GIFs get their frame strip in a collapsed "Frame by frame" section
//   a shot with `details: true` folds into the section above it, collapsed
//   the outro file (edge cases checked, anything else fixed) at the end
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/** A readable title for a shot that has none, from its caption or file name. */
const titleOf = (s) => s.title || s.caption || s.name.replace(/\.(png|gif)$/, "").replace(/^\d+[a-z]?-/, "").replace(/-/g, " ");

/** One image, with its alt text. */
const img = (alt, src) => `![${alt.replace(/[[\]]/g, "")}](${src})`;

/** A collapsed section, as used for secondary images and frame strips. */
const fold = (summary, body) => `<details><summary>${summary}</summary>\n\n${body}\n\n</details>`;

/** The line under the title: where and how the captures were taken, and any browser errors. */
function takenLine(m) {
  // Each piece only when the manifest has it (older manifests have none of them).
  const where = [m.commit && ` at commit \`${m.commit}\``, m.browser && `, taken in ${m.browser}`, m.width && ` in a window ${m.width} pixels wide`];
  const parts = where.some(Boolean) ? [`Captures${where.filter(Boolean).join("")}.`] : [];
  if (m.shots.some((s) => s.kind === "gif")) parts.push("The GIFs play at real speed.");
  const errs = m.errors || [];
  parts.push(errs.length
    ? `The browser reported ${errs.length} error${errs.length > 1 ? "s" : ""}: ${errs.slice(0, 3).map((e) => "`" + e.slice(0, 120).replace(/`/g, "'") + "`").join("; ")}.`
    : "The browser reported no errors.");
  return parts.join(" ");
}

/**
 * Builds the comment markdown.
 * manifest: what drive.mjs wrote. url(file): the address an image will have once posted.
 * title, intro, outro: optional text. Returns a string.
 */
export function buildComment({ manifest, url, title = "this change", intro = "", outro = "" }) {
  const out = [`## Screenshots for ${title}`, ""];
  if (intro.trim()) out.push(intro.trim(), "");
  out.push(takenLine(manifest), "", "---");
  let n = 0;
  for (const s of manifest.shots) {
    const t = titleOf(s);
    if (s.details && n > 0) { out.push("", fold(t, img(t, url(s.name)))); continue; }
    n += 1;
    out.push("", `### ${n}. ${t}`, "");
    if (s.how) out.push(`**How to get here:** ${s.how}`, "");
    if (s.look) out.push(`**What to look at:** ${s.look}`, "");
    if (!s.how && !s.look && s.caption && s.caption !== t) out.push(s.caption, "");
    out.push(img(t, url(s.name)));
    if (s.kind === "gif" && s.strip) out.push("", fold("Frame by frame", img(`${t}, frame by frame`, url(s.strip))));
  }
  out.push("", "---");
  if (outro.trim()) out.push("", outro.trim());
  return out.join("\n").trim() + "\n";
}

// Run on its own: print the comment with local file names as the image addresses.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const flag = (name) => { const i = args.indexOf("--" + name); return i >= 0 ? args[i + 1] : ""; };
  const dir = args[0];
  if (!dir || !existsSync(path.join(dir, "manifest.json"))) {
    console.error('usage: build-comment.mjs <shotsDir> [--title "..."] [--intro file] [--outro file]');
    process.exit(2);
  }
  const read = (f) => (f && existsSync(f) ? readFileSync(f, "utf8") : "");
  const manifest = JSON.parse(readFileSync(path.join(dir, "manifest.json"), "utf8"));
  process.stdout.write(buildComment({ manifest, url: (f) => f, title: flag("title") || undefined, intro: read(flag("intro")), outro: read(flag("outro")) }));
}
