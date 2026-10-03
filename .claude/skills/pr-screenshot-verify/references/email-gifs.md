# Email GIFs

Every round of screenshots also gets a click-through GIF of each flow the change adds or changes. They go to whoever asked for the change, for update emails to people who will never open the PR. A GIF is the only moving picture that plays inside an email: no email program plays video.

## What a good one looks like

- **1440 x 900, a standard desktop screen.** The page is recorded at 1440 x 844 and a 56 pixel caption bar sits on top. The whole screen, sidebar and all; nothing cropped.
- **A caption for every step,** said before the step happens, in plain words: "AGM adds an event by clicking the day", not "Click .cal-hit". Short enough for one line at 20 pixels.
- **A label for invented data.** `TAG` puts "Sample data" on the right of every caption bar. Real names with made-up statuses ("Le Parc: 3 overdue") are exactly what somebody forwards and gets alarmed by.
- **A pointer you can follow.** Headless browsers paint none, so the recorder draws one, glides it to each target, and rings every click. A click-through with no pointer is a slideshow of screens changing by themselves.
- **An opening frame that works alone.** Older Outlook shows only the first frame. It is held for about two seconds and carries the first caption, so start on the screen the story is about, with the pointer in empty space (not hovering something, which lights it up).
- **10 to 25 seconds, and under 5 MB.** Most land at 0.5 to 1.5 MB. Scrolling is what makes them heavy, because every scrolled frame repaints the whole screen: scroll less, or faster.
- **Test identities only.** Whoever the app shows as signed in is in every frame.

## Making them

```bash
node .claude/skills/pr-screenshot-verify/scripts/email-gifs.mjs clips.mjs .pr-shots/email
python .claude/skills/pr-screenshot-verify/scripts/email-gif.py .pr-shots/email/*/
```

`scenarios/email-clips.example.mjs` shows the clips file. Each clip is a `path` to open, a `start` for the pointer, an optional `setup`, and a `run` that calls `d.say(...)` and then drives the page with the helpers: `click`, `clickNav` (anything that loads a page), `fill`, `type`, `choose` (a native select), `upload`, `scroll`, `glide`, `wait`, `ripple`.

Look at every GIF before sending it. Make a sheet of the frames at each caption change and the last frame, and read it: the pointer should be where the caption says, and the last frame should show the result, not a pop-up covering it.

## Things that went wrong, and the fix

- **Native select lists do not record.** The open list is drawn by the operating system, outside the page. `choose()` shows the click and sets the value.
- **Pages that forward somewhere else.** A confirmation that forwards to another company's site after a few seconds ends the GIF on "This site can't be reached" when that site is not reachable. Clear the page's timers after the click, and stop on the confirmation.
- **Pop-ups on arrival** (a notice, a tour) cover the first frame. Dismiss them in `setup`, the way a person would have already.
- **Order matters when clips write.** A clip that marks something complete changes what the next clip opens on. Reseed before a batch and record in story order, or reseed before each clip.
- **A drawn pointer in a sandboxed frame.** The pointer keeps its position in sessionStorage, which a sandboxed frame refuses; the recorder guards it.
- **Frames under 20ms** are stretched to 100ms by browsers. The recorder samples every 70ms.
- **"Good evening" in one recording, "Good morning" in the rest.** A page that greets by time of day follows the browser's clock, and the cloud sandbox runs on UTC, so a clip redone later in the day did not match its batch. `CONTEXT` in the clips file sets browser options for every clip: give it the app's own time zone, such as `{ timezoneId: 'America/Los_Angeles' }`.

## Sending them

Say this to whoever gets them, once:

- **In Gmail,** drag the file into the message, or use Insert photo, then Upload, then Inline. Copying and pasting the picture can paste a still image. If Gmail shrinks it, click the image and choose Original size.
- **In Outlook,** they play in Outlook for Microsoft 365 on Windows and Mac, the new Outlook, Outlook on the web and phones. Outlook 2019 and earlier on Windows show the first frame only, which is why it carries the caption.
- **Size:** Gmail's limit is 25 MB a message, so four or five fit. Some company mail servers stop lower.
- **Width:** most reading panes are narrower than 1440, so the picture is shrunk to fit. The caption bar stays readable; the smallest text in the app does not. Offer a 1280 x 800 version if that matters (change `VIEW` in `email-gifs.mjs`).

In Claude Code on the web, send them with the file tool. They also go in the PR's screenshot comment when a flow is easier to judge moving than still.
