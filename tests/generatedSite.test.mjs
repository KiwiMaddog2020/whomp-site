/** DRIFT TESTS: read the files that were actually written and check them.
 *
 *  Every other suite in this repo tests a function. This one tests the OUTPUT,
 *  for the same reason the game repo's wiki-visuals pipeline verifies its own
 *  rendered PNGs rather than trusting the code that made them: the failure this
 *  site actually has is not a function returning the wrong value, it is a page
 *  quietly becoming untrue while every function keeps returning what it always
 *  did. A date passes. A brief ships. Nothing throws.
 *
 *  So these read index.html, log.html, wiki.html and built-in-the-open.html off
 *  disk, in the committed state a visitor would be served, and ask a reader's
 *  questions of them. They
 *  need no game checkout. bin/regenerate-and-verify.sh runs them immediately
 *  after regenerating, which is what turns "the build passed" into "the page is
 *  still true".
 *
 *  A missing file is a SKIP rather than a failure: a fresh clone that has not
 *  generated yet has nothing to drift from, and a suite that is red on checkout
 *  is a suite people learn to ignore.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { windowDates } from '../bin/devlog.mjs';
import { PITCH_PINS } from '../bin/pitch.mjs';
import { isExpiredSchedule, localDay, trailsOff } from '../bin/landing.mjs';

const SITE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => (existsSync(join(SITE_ROOT, file)) ? readFileSync(join(SITE_ROOT, file), 'utf8') : null);

const index = read('index.html');
const log = read('log.html');
const wiki = read('wiki.html');
const pitch = read('built-in-the-open.html');
const generated = index && log && wiki && pitch;
const options = generated ? {} : { skip: 'the site has not been generated in this checkout' };

/** The four pages a stranger can land on directly from somebody else's link,
 *  which is exactly what makes them the four that have to carry a social card,
 *  the mark, and copy that holds house law. The wiki rosters are a fifth shape
 *  and bin/wiki-check.mjs owns them. */
const publicPages = () => [['index.html', index], ['log.html', log], ['wiki.html', wiki], ['built-in-the-open.html', pitch]];

/** Visible copy only: no CSS, no inline script, no markup, no comments. The
 *  house laws below are about what a reader sees, and `!important` is not a
 *  reader seeing an exclamation mark. */
const visibleText = (html) => html
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ');

/** Every paragraph inside a card, on every card track the landing page lays
 *  out: the arcs, the queued teasers and the kit. These are the sentences that
 *  trail off when a source doc wraps.
 *
 *  IT READS THE TRACK, NOT THE CARD, and that is a fix rather than a style
 *  choice. The old form matched a card div and stopped at the first `</div>`
 *  inside it, so an arc card (whose first child is its own `<div class="id">`)
 *  contributed nothing and only the flat fact cards were ever checked. The
 *  fact cards left with the run rework on 2026-08-07, which would have quietly
 *  emptied this pin altogether. Matching the container and taking every
 *  paragraph in it cannot be defeated by a card growing an element. */
const cardSentences = (html) => [
  ...html.matchAll(/<div class="(?:arcs|kits)">([\s\S]*?)<\/section>/g),
].flatMap((track) => [...track[1].matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map((m) => m[1].trim()));

const scheduleChips = (html) => [...html.matchAll(/<div class="id">([\s\S]*?)<\/div>/g)]
  .map((m) => m[1].replace(/&middot;/g, ',').replace(/<[^>]+>/g, '').trim());

/* ------------------------------------------------------------------- the rot */

test('no card on the landing page ends mid-sentence', options, () => {
  const sentences = cardSentences(index);
  assert.ok(sentences.length >= 4, 'the landing page rendered no cards at all');
  for (const sentence of sentences) {
    assert.equal(trailsOff(sentence), false, `a card trails off: "${sentence}"`);
  }
});

test('no schedule on the landing page has already happened', options, () => {
  const today = localDay();
  for (const chip of scheduleChips(index)) {
    assert.equal(isExpiredSchedule(chip, today), false, `a card still advertises "${chip}"`);
  }
});

test('the landing page never prints the name of a file in the repo', options, () => {
  const offender = /\b[A-Za-z0-9_.-]+\.(?:md|ts|mjs|tsx)\b/.exec(visibleText(index));
  assert.equal(offender, null, `the page names ${offender?.[0]}`);
});

test('house law holds in the visible copy: no dashes, no exclamations', options, () => {
  for (const [file, html] of publicPages()) {
    const text = visibleText(html);
    assert.equal(/[—–]/.test(text), false, `${file} carries an em or en dash`);
  }
  // The exclamation check is scoped to the two surfaces whose copy is written
  // in THIS repo. log.html and the wiki republish the game's own strings, and a
  // gate that goes red for a sentence this repo may not edit is the permanent
  // warning that teaches everyone to ignore the gate.
  for (const [file, html] of [['index.html', index], ['built-in-the-open.html', pitch]]) {
    assert.equal(/!/.test(visibleText(html)), false, `${file} carries an exclamation mark`);
  }
});

/* --------------------------------------------------------------- the two tracks */

/* THE HERO IS A TRIO NOW, NOT TWO TRACK BUTTONS (director, 2026-08-07 00:57 and
 * 01:03). Stable stopped being a button and became the link inside the tracks
 * line; Wiki and Dev log left the nav and became the two quiet buttons beside
 * Play. This test shipped pinned to the old two-button hero and had been failing
 * on main ever since. What it guards is unchanged: exactly one loud button, it
 * is Preview, it points at the Preview origin, and Stable is still reachable
 * from the hero by its own real link. */
/* SINGLE CHANNEL (director, 2026-08-07 15:57: "we can just use one deploy for
 * a while... turn the feature off and not remove it entirely"). The game's
 * flag is src/core/channelMode.ts, the site reads it at generation, and in
 * single mode no page names a track: one loud PLAY WHOMP button, one Live
 * chip, one colophon sentence. The dual rendering is parked in
 * bin/generate.mjs behind the same flag; flipping the game's constant and
 * regenerating restores it, and these assertions get re-pointed then. */
test('the hero leads with the one play button, and no page names a track', options, () => {
  const buttons = [...index.matchAll(/<a class="play (loud|quiet)" href="([^"]+)">\s*([^<\n]+)/g)]
    .map((m) => ({ kind: m[1], href: m[2], label: m[3].trim() }));
  assert.equal(buttons.length, 3, 'the hero does not carry exactly three buttons');
  assert.equal(buttons.filter((b) => b.kind === 'loud').length, 1, 'the hero has more than one loud button');
  assert.equal(buttons[0].kind, 'loud');
  assert.match(buttons[0].label, /PLAY WHOMP/);
  assert.match(buttons[0].href, /^https:\/\/whomp-preview\.pages\.dev\//);
  assert.deepEqual(buttons.slice(1).map((b) => b.label), ['WIKI', 'DEV LOG']);
  assert.deepEqual(buttons.slice(1).map((b) => b.href), ['wiki.html', 'log.html']);
  const chips = /<div class="chips">([\s\S]*?)<\/div>/.exec(index);
  assert.ok(chips, 'the hero has no live chips row');
  assert.match(chips[1], /Live/, 'the chip no longer says Live');
  assert.doesNotMatch(chips[1], /Preview|Stable/, 'the chips still name a track');
});

test('one line says what the game is serving, and it names no track', options, () => {
  assert.match(visibleText(index), /The game is serving/);
  assert.doesNotMatch(visibleText(index), /Preview is serving|Stable is serving/);
});

test('the live chip states in words what is serving, on every surface', options, () => {
  for (const [file, html] of publicPages()) {
    assert.match(html, /Live <b>(?:unverified|\d+\.\d+\.\d+)<\/b>/,
      `${file} does not say what the game is serving`);
    assert.doesNotMatch(html, /(?:Preview|Stable) <b>(?:unverified|\d+\.\d+\.\d+)<\/b>/,
      `${file} still labels a chip with a track name`);
  }
});

test('the permanent "a deploy is pending" dot is gone from every surface', options, () => {
  for (const [file, html] of publicPages()) {
    assert.equal(/a deploy is pending/.test(html), false, `${file} still claims a deploy is pending`);
    assert.equal(/class="dot stale"/.test(html), false, `${file} still lights the stale dot`);
  }
});

/* ------------------------------------------------------------------ the chrome */

test('the mark sits at the left end of the nav bar, and only once, on every page that has one', options, () => {
  // The bar is one shared template now (landingTopBar in bin/generate.mjs), so
  // this holds on both pages that carry it or on neither.
  for (const [file, html] of [['index.html', index], ['built-in-the-open.html', pitch]]) {
    const bar = /<div class="topbar">([\s\S]*?)<\/div>\s*<\/div>/.exec(html);
    assert.ok(bar, `${file} has no top bar`);
    const markAt = bar[1].indexOf('class="brandmark"');
    const navAt = bar[1].indexOf('class="navlinks"');
    assert.ok(markAt >= 0, `${file} nav bar carries no mark`);
    assert.ok(navAt > markAt, `${file} draws the mark to the right of the nav links`);
    assert.equal((html.match(/class="brandmark"/g) || []).length, 1, `${file} draws the mark more than once`);
    // THE WORDMARK LAW, both halves. The bar's mark is the canonical icon file
    // read out of the game at build time, never a second inline drawing of the
    // W; bin/wiki-check.mjs pins the same rule on the wiki side.
    assert.match(bar[1], /<img src="whomp-icon\.svg" alt="" width="34" height="34">/, `${file} bar does not use the canonical icon`);
    assert.equal(/<svg class="wm"/.test(bar[1]), false, `${file} redraws the mark inside the bar`);
  }
  // It moved OUT of the header. A second drawing of the same W two sizes apart
  // is what the director asked to be rid of.
  const header = /<header>([\s\S]*?)<\/header>/.exec(index);
  assert.equal(/<svg class="wm"/.test(header[1]), false, 'the header still draws the mark above the wordmark');
});

test('every nav destination exists, from every page that carries the nav', options, () => {
  for (const [from, html] of [['index.html', index], ['built-in-the-open.html', pitch], ['log.html', log]]) {
    const strip = /<nav class="(?:navlinks|side)"[\s\S]*?<\/nav>/.exec(html);
    assert.ok(strip, `${from} has no navigation`);
    const hrefs = [...strip[0].matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    assert.ok(hrefs.length >= 4, `${from} nav is nearly empty`);
    for (const href of hrefs) {
      const [file, anchor] = href.split('#');
      if (file) assert.ok(existsSync(join(SITE_ROOT, file)), `${from} nav points at missing ${file}`);
      if (anchor) {
        const target = file ? read(file) : html;
        assert.ok(new RegExp(`\\sid="${anchor}"`).test(target), `${from} nav points at missing #${anchor}`);
      }
    }
  }
  // Every page that carries the bar links to every other one, so a reader who
  // landed on the pitch from somebody else's link can reach the game and the log.
  for (const [file, html] of [['index.html', index], ['built-in-the-open.html', pitch]]) {
    for (const destination of ['log.html', 'wiki.html', 'built-in-the-open.html', 'index.html']) {
      assert.ok(html.includes(`href="${destination}`) || file === destination,
        `${file} does not link to ${destination}`);
    }
  }
});

/* --------------------------------------------------------------- the log feed */

test('the landing page carries the newest log entries and every one of them lands', options, () => {
  const lines = [...index.matchAll(/<a class="logline" href="log\.html#([^"]+)">([\s\S]*?)<\/a>/g)];
  assert.ok(lines.length >= 1 && lines.length <= 5, `the feed rendered ${lines.length} lines`);
  for (const [, anchor, body] of lines) {
    assert.ok(new RegExp(`\\sid="${anchor}"`).test(log), `the feed links log.html#${anchor}, which does not exist`);
    const what = /<span class="logline-what">([\s\S]*?)<\/span>/.exec(body)?.[1].trim();
    // A headline, not a sentence: an authored note is titled "A week of
    // releases, caught up in one entry" and a full stop on that would be wrong.
    // What is checked is that the line HAS one, in full, and not a fragment of
    // one, which is what a silent cap would leave behind.
    assert.ok(what && what.length > 12, 'a feed line has no headline on it');
    assert.equal(/(?:\.\.\.|…|,)$/.test(what), false, `a feed line was cut short: "${what}"`);
  }
  // Newest first, same order the concise view renders in.
  const dates = [...index.matchAll(/<span class="logline-when">(\d{4}-\d{2}-\d{2})/g)].map((m) => m[1]);
  assert.deepEqual(dates, [...dates].sort().reverse(), 'the feed is not newest first');
});

/* ---------------------------------------------------------------- the card tags */

test('every page a stranger can land on unfurls as something, not as a bare URL', options, () => {
  for (const [file, html] of publicPages()) {
    for (const tag of [
      /<meta property="og:type" content="website">/,
      /<meta property="og:title" content="[^"]+">/,
      /<meta property="og:description" content="[^"]{20,}">/,
      /<meta property="og:image" content="https:\/\/[^"]+\/whomp-icon-512\.png">/,
      /<meta name="twitter:card" content="summary">/,
      /<link rel="canonical" href="https:\/\/[^"]+">/,
    ]) {
      assert.match(html, tag, `${file} is missing ${tag}`);
    }
    const url = /<meta property="og:url" content="([^"]+)">/.exec(html)?.[1];
    assert.ok(url, `${file} has no og:url`);
    assert.equal(url.endsWith(file === 'index.html' ? '/' : file), true, `${file} claims og:url ${url}`);
  }
  assert.ok(existsSync(join(SITE_ROOT, 'whomp-icon-512.png')), 'the social card image was never written');
});

/* ------------------------------------------------------------------- the run */

test('the page says how long a run is, and agrees with the wiki about it', options, () => {
  const claimed = /(\d+) minutes, one weapon you aim yourself/.exec(visibleText(index));
  assert.ok(claimed, 'the landing page never says how long a run is');
  const minutes = Number(claimed[1]);
  assert.ok(minutes > 0 && minutes < 120, `a run of ${minutes} minutes is not a run`);
  // The wiki derives the same figure from the same artifact and prints it as a
  // clock. Two surfaces disagreeing about the length of a run is the exact class
  // of drift this repo exists to make impossible.
  const modes = read('wiki-modes.html');
  if (modes) {
    assert.match(modes, new RegExp(`>${minutes}:00<`), `the wiki does not carry a ${minutes}:00 bank`);
  }
});

test('the run section states what it is made of, in numbers it read somewhere', options, () => {
  const text = visibleText(index);
  for (const noun of ['worlds', 'enemies', 'characters', 'aimed cores', 'weapons']) {
    assert.match(text, new RegExp(`\\d+ ${noun}`), `the page never counts ${noun}`);
  }
  // The no-friction claim, re-voiced 2026-08-07 ("this sounds way too sterile
  // to appeal to gamers"). The pin follows the sentence, not the old wording:
  // what it guards is that the page still states there is nothing to install
  // and no account to make, which is the one hard promise in this section.
  assert.match(text, /Nothing to download, nothing to install, and nobody here wants your email address/);
});

/* -------------------------------------------------------------- the pipeline */

test('what is coming is on the page, and it is honest about the size of the queue', options, () => {
  const section = /<section id="pipeline">([\s\S]*?)<\/section>/.exec(index);
  if (!section) return; // an empty queue renders no section at all, by design
  const cards = [...section[1].matchAll(/<h4>([\s\S]*?)<\/h4>/g)].map((m) => m[1].trim());
  assert.ok(cards.length >= 1, 'the pipeline section rendered no teasers');
  const claim = /(\d+) things are in that queue and these are\s+(\d+) of them/.exec(visibleText(index));
  assert.ok(claim, 'the pipeline section does not say how big the queue is');
  assert.equal(Number(claim[2]), cards.length, 'the pipeline miscounts what it is showing');
  assert.ok(Number(claim[1]) >= cards.length, 'the pipeline shows more than it claims is queued');
});

/* ------------------------------------------------------------------- the story */

/** Every day card the story rendered, in the order it rendered them. */
const storyDays = (html) => [...html.matchAll(/<article class="storyday([^"]*)" id="day-(\d{4}-\d{2}-\d{2})">([\s\S]*?)<\/article>/g)]
  .map((m) => ({ quiet: m[1].includes('is-quiet'), date: m[2], body: m[3] }));

test('the story covers a run of calendar days, newest first, with no gaps', options, () => {
  const days = storyDays(log);
  assert.ok(days.length >= 2, 'the story rendered almost nothing');
  const dates = days.map((d) => d.date);
  assert.deepEqual(dates, windowDates(dates[0], dates.length),
    'the story skipped a day, repeated one, or ran the wrong way round');
});

test('the story shows exactly the window its own lede claims', options, () => {
  // The sentence and the markup are derived from one number in the generator.
  // This is the check that they still agree, which is the only way a reader can
  // trust either of them.
  const claimed = /landed in the last (\d+) days/.exec(visibleText(log))
    || /Nothing player-visible landed in the last (\d+) days/.exec(visibleText(log));
  assert.ok(claimed, 'the story never says what window it covers');
  assert.equal(storyDays(log).length, Number(claimed[1]),
    'the story shows a different number of days than the number it claims');
});

test('the committed story still describes a window that includes today', options, () => {
  // THE DAILY GATE. A story generated a week ago says "the last 7 days" over
  // seven days that have all since passed, which is the same rot the landing
  // page's expired schedules were. Inside the window, a stale checkout is
  // merely behind; outside it, the page's central sentence is false.
  const days = storyDays(log);
  assert.ok(windowDates(days[0].date, days.length).includes(localDay()),
    `the newest day in the story is ${days[0].date} and the window no longer reaches today. Run bin/regenerate-and-verify.sh.`);
});

test('every day in the story carries one finished sentence about its shape', options, () => {
  for (const day of storyDays(log)) {
    const shape = /<p class="storyday-shape">([\s\S]*?)<\/p>/.exec(day.body)?.[1].trim();
    assert.ok(shape, `${day.date} has no sentence on it at all`);
    assert.equal(trailsOff(shape), false, `${day.date} trails off: "${shape}"`);
    assert.equal(/[—–!]/.test(shape), false, `${day.date} breaks house law: "${shape}"`);
    assert.equal(/undefined|NaN/.test(shape), false, `${day.date} rendered a hole: "${shape}"`);
  }
});

test('a day tallies the same number it says in words', options, () => {
  for (const day of storyDays(log)) {
    const shape = /<p class="storyday-shape">([\s\S]*?)<\/p>/.exec(day.body)[1];
    const chips = [...day.body.matchAll(/<span class="storyday-kind"[^>]*>[^<]*?(\d+)<\/span>/g)]
      .map((m) => Number(m[1]));
    const tallied = chips.reduce((sum, n) => sum + n, 0);
    if (day.quiet) {
      assert.equal(tallied, 0, `${day.date} is marked quiet and carries ${tallied} changes`);
      assert.match(shape, /Nothing player-visible landed\./);
      continue;
    }
    const said = Number(/^(\d+) changes landed/.exec(shape.trim())?.[1] ?? (/^One change landed/.test(shape.trim()) ? 1 : NaN));
    assert.equal(said, tallied, `${day.date} says ${said} and tallies ${tallied}`);
  }
});

test('every release named on a day links to an entry that is really on the page', options, () => {
  const links = [...log.matchAll(/<a class="storyday-release" href="#([^"]+)">([\s\S]*?)<\/a>/g)];
  assert.ok(links.length >= 1, 'not one day in the window names what was cut on it');
  for (const [, anchor, body] of links) {
    assert.ok(new RegExp(`\\sid="${anchor}"`).test(log), `a day links #${anchor}, which is not on the page`);
    const headline = /<span>([\s\S]*?)<\/span>/.exec(body)?.[1].trim();
    assert.ok(headline && headline.length > 12, `the link to #${anchor} carries no headline`);
    assert.equal(/(?:\.\.\.|…|,)$/.test(headline), false, `a headline was cut short: "${headline}"`);
  }
});

test('the story is the first thing on the dev log, and the pitch is one click away', options, () => {
  assert.ok(log.indexOf('id="story"') < log.indexOf('id="shipped"'),
    'the two lists still come before the story a stranger arrived for');
  assert.match(log, /<a href="built-in-the-open\.html">/);
});

/* ------------------------------------------------------------------- the pitch */

test('the pitch prints the claims it is pinned to, and prints them whole', options, () => {
  const text = visibleText(pitch);
  const printed = PITCH_PINS.filter((pin) => text.includes(pin.claim));
  assert.ok(printed.length >= 8,
    `only ${printed.length} of ${PITCH_PINS.length} pinned claims reached the page; the rest lost their evidence`);
});

test('every paragraph on the pitch is a finished sentence in the house voice', options, () => {
  const paragraphs = [...pitch.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)]
    .map((m) => m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  assert.ok(paragraphs.length >= 12, `the pitch rendered ${paragraphs.length} paragraphs`);
  for (const paragraph of paragraphs) {
    assert.equal(trailsOff(paragraph), false, `a paragraph trails off: "${paragraph}"`);
  }
});

test('the pitch never names the machinery to the reader', options, () => {
  // docs/VOICE.md rule 12, on the one page that is ABOUT the machinery. It may
  // describe the work; it may not print a path, a branch, a sha or a word only
  // somebody working here would know.
  const text = visibleText(pitch);
  for (const offender of [
    /\b[A-Za-z0-9_.-]+\.(?:md|ts|mjs|tsx|sh|json)\b/,
    /\b(?:claude|codex|origin)\/[A-Za-z0-9._-]+/,
    /\b(?:worktree|typecheck|vitest|registry|artifact|semantics|schema)\b/i,
  ]) {
    assert.equal(offender.test(text), false, `the pitch prints ${offender.exec(text)?.[0]}`);
  }
});

test('the pitch states the scale, and states it without a relative anchor', options, () => {
  const text = visibleText(pitch);
  assert.match(text, /\d+ of them have landed since the first commit, on \d{4}-\d{2}-\d{2}\./);
  assert.equal(/\b(?:days ago|weeks ago|so far this week|last week|next week)\b/.test(text), false,
    'the pitch carries a relative anchor, which is wrong the day after it is generated');
});

test('the pitch sends a reader to the log and to the game', options, () => {
  assert.match(pitch, /href="log\.html#story"/);
  assert.match(pitch, /href="index\.html"/);
});
