/** DRIFT TESTS: read the files that were actually written and check them.
 *
 *  Every other suite in this repo tests a function. This one tests the OUTPUT,
 *  for the same reason the game repo's wiki-visuals pipeline verifies its own
 *  rendered PNGs rather than trusting the code that made them: the failure this
 *  site actually has is not a function returning the wrong value, it is a page
 *  quietly becoming untrue while every function keeps returning what it always
 *  did. A date passes. A brief ships. Nothing throws.
 *
 *  So these read index.html, log.html and wiki.html off disk, in the committed
 *  state a visitor would be served, and ask a reader's questions of them. They
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

import { isExpiredSchedule, localDay, trailsOff } from '../bin/landing.mjs';

const SITE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => (existsSync(join(SITE_ROOT, file)) ? readFileSync(join(SITE_ROOT, file), 'utf8') : null);

const index = read('index.html');
const log = read('log.html');
const wiki = read('wiki.html');
const generated = index && log && wiki;
const options = generated ? {} : { skip: 'the site has not been generated in this checkout' };

/** Visible copy only: no CSS, no inline script, no markup, no comments. The
 *  house laws below are about what a reader sees, and `!important` is not a
 *  reader seeing an exclamation mark. */
const visibleText = (html) => html
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ');

/** Every paragraph inside a card, on any of the three card shapes the landing
 *  page uses. These are the sentences that trail off when a source doc wraps. */
const cardSentences = (html) => [
  ...html.matchAll(/<div class="(?:arc|fact)"[^>]*>([\s\S]*?)<\/div>/g),
].flatMap((block) => [...block[1].matchAll(/<p>([\s\S]*?)<\/p>/g)].map((m) => m[1].trim()));

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
  for (const [file, html] of [['index.html', index], ['log.html', log], ['wiki.html', wiki]]) {
    const text = visibleText(html);
    assert.equal(/[—–]/.test(text), false, `${file} carries an em or en dash`);
  }
  assert.equal(/!/.test(visibleText(index)), false, 'index.html carries an exclamation mark');
});

/* --------------------------------------------------------------- the two tracks */

test('both release tracks have a real button, Preview first', options, () => {
  const buttons = [...index.matchAll(/<a class="play (loud|quiet)" href="([^"]+)">\s*([^<\n]+)/g)]
    .map((m) => ({ kind: m[1], href: m[2], label: m[3].trim() }));
  assert.equal(buttons.length, 2, 'the hero does not carry exactly two play buttons');
  assert.equal(buttons[0].kind, 'loud');
  assert.match(buttons[0].label, /PLAY THE PREVIEW/);
  assert.match(buttons[0].href, /^https:\/\/whomp-preview\.pages\.dev\//);
  assert.equal(buttons[1].kind, 'quiet');
  assert.match(buttons[1].label, /PLAY STABLE/);
  assert.match(buttons[1].href, /^https:\/\/kiwimaddog2020\.github\.io\/whomp-play\//);
});

test('one line explains what the two tracks are', options, () => {
  assert.match(visibleText(index), /Preview is the newest build that went green/);
  assert.match(visibleText(index), /Stable is the weekly one/);
});

test('each track states in words what it is serving, on every surface', options, () => {
  for (const [file, html] of [['index.html', index], ['log.html', log], ['wiki.html', wiki]]) {
    for (const label of ['Preview', 'Stable']) {
      assert.match(html, new RegExp(`${label} <b>(?:unverified|\\d+\\.\\d+\\.\\d+)</b>`),
        `${file} does not say what ${label} is serving`);
    }
  }
});

test('the permanent "a deploy is pending" dot is gone from every surface', options, () => {
  for (const [file, html] of [['index.html', index], ['log.html', log], ['wiki.html', wiki]]) {
    assert.equal(/a deploy is pending/.test(html), false, `${file} still claims a deploy is pending`);
    assert.equal(/class="dot stale"/.test(html), false, `${file} still lights the stale dot`);
  }
});

/* ------------------------------------------------------------------ the chrome */

test('the mark sits at the left end of the nav bar, and only once', options, () => {
  const bar = /<div class="topbar">([\s\S]*?)<\/div>\s*<\/div>/.exec(index);
  assert.ok(bar, 'index.html has no top bar');
  const markAt = bar[1].indexOf('class="brandmark"');
  const navAt = bar[1].indexOf('class="navlinks"');
  assert.ok(markAt >= 0, 'the nav bar carries no mark');
  assert.ok(navAt > markAt, 'the mark is not to the left of the nav links');
  // It moved OUT of the header. A second drawing of the same W two sizes apart
  // is what the director asked to be rid of.
  const header = /<header>([\s\S]*?)<\/header>/.exec(index);
  assert.equal(/<svg class="wm"/.test(header[1]), false, 'the header still draws the mark above the wordmark');
  assert.equal((index.match(/class="brandmark"/g) || []).length, 1, 'the mark is drawn more than once');
});

test('every nav destination exists', options, () => {
  const bar = /<nav class="navlinks"[\s\S]*?<\/nav>/.exec(index)[0];
  const hrefs = [...bar.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(hrefs.length >= 4, 'the nav is nearly empty');
  for (const href of hrefs) {
    const [file, anchor] = href.split('#');
    if (file) assert.ok(existsSync(join(SITE_ROOT, file)), `the nav points at missing ${file}`);
    if (anchor) {
      const target = file ? read(file) : index;
      assert.ok(new RegExp(`\\sid="${anchor}"`).test(target), `the nav points at missing #${anchor}`);
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

test('all three surfaces unfurl as something, not as a bare URL', options, () => {
  for (const [file, html] of [['index.html', index], ['log.html', log], ['wiki.html', wiki]]) {
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
  assert.match(text, /No download, no launcher, and no account to make/);
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
