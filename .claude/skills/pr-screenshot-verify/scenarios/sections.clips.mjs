// Clips for a tour of the Niwa site, one short GIF per section.
// Start the site first (npm run dev), then:
//   node .claude/skills/pr-screenshot-verify/scripts/email-gifs.mjs .claude/skills/pr-screenshot-verify/scenarios/sections.clips.mjs .pr-shots/email
//   python .claude/skills/pr-screenshot-verify/scripts/email-gif.py .pr-shots/email/*/
// Each clip jumps straight to its section, then shows it the way a visitor would.

export const BASES = { site: 'http://localhost:4321' };
export const TAG = 'Local preview';
export const CONTEXT = { timezoneId: 'America/Los_Angeles' };

// Put a section's top just under the fixed nav bar, instantly, before filming.
const jump = (sel) => async (d) => {
  await d.page.evaluate((s) => {
    const el = document.querySelector(s);
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 64);
  }, sel);
  await d.wait(1200); // let the scroll-in reveals finish
};

export const CLIPS = {
  '01-hero': {
    who: 'site', path: '/', start: [760, 300],
    run: async (d) => {
      d.say('The first screen: Iconically, Seattle.');
      await d.wait(2200);
      d.say('Scroll a little: the intro, the quick facts and the photo');
      await d.scroll(480, 500);
      await d.wait(1200);
      await d.glide('.hero .btn', {});
      await d.wait(1200);
    },
  },
  '02-the-idea': {
    who: 'site', path: '/', start: [1100, 300], setup: jump('#about'),
    run: async (d) => {
      d.say('The idea: Niwa means garden');
      await d.wait(2000);
      d.say('Scroll down to the neighborhood scores');
      await d.scroll(420, 500);
      await d.wait(2200);
    },
  },
  '03-the-building': {
    who: 'site', path: '/', start: [1150, 300], setup: jump('#building'),
    run: async (d) => {
      d.say('The building: everything, in its place');
      await d.wait(2000);
      d.say('Amenities, each with a photo');
      await d.scroll(420, 500);
      await d.wait(2400);
    },
  },
  '04-the-homes': {
    who: 'site', path: '/', start: [1150, 260], setup: jump('#floor-plans'),
    run: async (d) => {
      d.say('The homes: studios to two bedrooms, with live prices');
      await d.wait(1800);
      await d.glide('.home-row >> nth=0');
      await d.wait(900);
      await d.glide('.home-row >> nth=1');
      await d.wait(900);
      await d.glide('.home-row >> nth=2');
      await d.wait(900);
      await d.wait(1200);
    },
  },
  '05-gallery': {
    who: 'site', path: '/', start: [1150, 200], setup: jump('#gallery'),
    run: async (d) => {
      d.say('The gallery: scroll and the photos slide sideways');
      await d.wait(1200);
      for (let i = 0; i < 3; i++) { await d.scroll(300, 350); await d.wait(1100); }
    },
  },
  '06-schedule-a-tour': {
    who: 'site', path: '/', start: [1150, 200], setup: jump('#tour'),
    run: async (d) => {
      d.say('Schedule a tour: the form reads as one sentence');
      await d.wait(1600);
      d.say('Fill it in like you would talk');
      await d.fill('#tf-first', 'Sam');
      await d.click('.tf-chips[aria-label="Home type"] .chip >> nth=1');
      await d.click('.tf-chips[aria-label="Move-in window"] .chip >> nth=1');
      await d.click('[data-tour-days] .chip >> nth=1');
      await d.wait(1600);
    },
  },
  '07-whats-on': {
    who: 'site', path: '/events', start: [1150, 200],
    setup: jump('#events'),
    run: async (d) => {
      d.say("What's on: events within a few miles, on a map");
      await d.wait(1800);
      d.say('Each yellow pin is a venue with events on');
      await d.glide('.ev-pin >> nth=0');
      await d.wait(1400);
      await d.glide('.ev-pin >> nth=2');
      await d.wait(1400);
      await d.glide('.ev-pin >> nth=4');
      await d.wait(1600);
    },
  },
  '08-footer': {
    who: 'site', path: '/', start: [1150, 300], setup: jump('#contact'),
    run: async (d) => {
      d.say('The footer: the big wordmark, address, hours and contacts');
      await d.wait(1600);
      await d.scroll(600, 500);
      await d.wait(2200);
    },
  },
};
