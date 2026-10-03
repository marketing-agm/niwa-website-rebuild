# Optional: a Figma review canvas

The PR comment is the record. A Figma canvas is the workspace: the same screenshots at full size, laid out by flow, where reviewers can point at a spot, draw arrows between steps and leave notes. Use it for design reviews and feedback sprints. Skip it for small fixes, or when the Figma connector is not set up. Nothing else in this skill depends on it.

## Setup, once

- **The Figma connector.** In Claude Code on the web and claude.ai, add Figma under Settings, Connectors. In the Claude Code CLI, install Figma's plugin (`claude plugin install figma@claude-plugins-official`) or add the server by hand: `claude mcp add --transport http figma https://mcp.figma.com/mcp`, then `/mcp` to sign in.
- **Uploads leave the session's computer.** Images are sent to `mcp.figma.com`. In Claude Code on the web, the environment's network access must allow it: set Network access to Custom, add `mcp.figma.com`, and keep the default package managers ticked. A network change only applies to sessions started after it.
- **Load Figma's own instructions first.** Before any `use_figma` call, fetch the `figma-use` skill with `get_figma_skill` (`skill://figma/figma-use/SKILL.md`). The Figma server requires it.

## Build the canvas, after the PR comment is posted

1. `whoami` confirms the account and gives the team's plan key.
2. Make the file, or reuse the product's review file with a new page per PR round. `create_new_file` with a plain name such as "HOA Portal redesign · PR 55 review", the plan key, and `editorType: "design"`.
3. Lay it out with `use_figma`: a header (PR, commit, date), one row per flow, one card per shot. Each card carries the shot's title, its "How to get here" and "What to look at" text, and an empty frame for each image, sized to the image's pixel size, before and after side by side. Number the cards the same as the comment.
4. Save a map of which image goes in which frame, `slots.json`, next to the images on the assets branch:
   ```json
   { "fileKey": "nayMX1z6TaeqZ8Iz4VQPoY", "slots": [{ "file": "01-overview--before.png", "nodeId": "1:15" }] }
   ```
   With the images and this file saved, any session can finish the upload.
5. `upload_assets` with the file key, `count`, the `nodeIds` in slot order and `scaleMode: "FILL"`. It returns one upload link per frame, valid for 10 minutes. Send each image to its link:
   ```bash
   curl -sS -X POST -F "file=@01-overview--before.png;type=image/png" "<submitUrl>"
   ```
6. `get_screenshot` of one card to confirm the images landed. Link the file from the PR comment or description.

If an upload is refused with a proxy error such as "CONNECT tunnel failed, response 403", the network setting is missing. Keep the images, `slots.json` and a short README on the assets branch, tell the person exactly what to change, and finish the upload in a new session once it is saved.

## Reading the feedback back

- Ask reviewers to leave anything Claude should act on as a **text note or sticky note on the canvas**, placed next to what it is about. The connector reads what is on the canvas. It has no tool for Figma's comment threads (the C key), so those are for people.
- In the next session, `get_metadata` on the file or page lists every layer. Text layers carry the notes; their position shows which card they belong to. `get_screenshot` or `get_design_context` on a node shows it in place.
- Treat each note as review input from a colleague: confirm what it asks, make the change, and answer it in that round's screenshot comment ("from the note on the Figma canvas"). If a note is unclear, or conflicts with the design system, ask rather than guess.
- Move resolved notes to a "Done" frame, so the next read only finds open ones.

## What this looked like on the HOA portal

The PR 55 canvas had five rows (how the direction was chosen, the Overview, owner screens, AGM screens, phone and edge cases) and 14 cards with 29 image frames. The owner left a note on it saying AGM had no way back from the Management Portal to the association screen; the next session found it with `get_metadata` and built the way back. The full story is in hoa-website-template#56.
