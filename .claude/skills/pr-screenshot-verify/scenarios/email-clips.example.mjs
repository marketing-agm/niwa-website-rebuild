// An example clips file for email-gifs.mjs. Copy it next to your scenario,
// point BASES at the running app, and write one clip per flow the change adds
// or changes. The rules are in references/email-gifs.md.
//
//   node .claude/skills/pr-screenshot-verify/scripts/email-gifs.mjs clips.mjs .pr-shots/email
//   python .claude/skills/pr-screenshot-verify/scripts/email-gif.py .pr-shots/email/*/
//
// Test accounts only: whoever the app shows as signed in is in every frame.

export const BASES = {
  admin: 'http://localhost:5173',
};

// The label on the right of every caption bar. Keep it while the data is
// invented, so nobody reads a recording as a real account.
export const TAG = 'Sample data';

export const CLIPS = {
  'library-upload': {
    who: 'admin',
    path: '/library',
    start: [1100, 220], // empty space: the opening frame should not light anything up
    // Before filming: anything a person would already have dismissed.
    setup: async (d) => {
      const tour = d.page.locator('button:has-text("Skip tour")');
      if (await tour.count()) await tour.click();
    },
    run: async (d) => {
      // Each caption names the step, before it happens, in plain words.
      d.say('Upload a document into any folder');
      await d.wait(800);
      await d.click('button:has-text("Upload")');
      await d.choose('select[name=folder]', 'policies');
      await d.upload('input[type=file]', 'fixtures/Leave Policy 2026.pdf',
        () => /Uploaded/.test(document.body.textContent));
      d.say('It is in the folder straight away, waiting for approval');
      await d.wait(2000);
    },
  },
};
