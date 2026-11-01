/** bin/site-copy.mjs: the landing page's and the dev log's own words, and the log's window.
 *
 *  These moved out of bin/generate.mjs so the kit's site module can import them
 *  (game-sites-s1-r2). The move changed no output: a plain generate run before
 *  and after writes the same bytes, and the lane report quotes that diff. What
 *  this suite holds is the other half: that the pieces are the ones the pages
 *  print, that they keep the house voice, and that bin/generate.mjs reads them
 *  from here rather than keeping a second copy.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  cleanDoc, conciseModel, dayByDay, FEED_WINDOW_DAYS, feedDays, feedLogArgs, feedWindow, FOOTER_LEAD,
  indexDescription, indexTitle, LANDING_COPY, LANDING_LOG_ENTRIES, LOG_COPY, noEmDash, parseBody, parseNote, plain,
  slug, TAGLINE,
} from '../bin/site-copy.mjs';

const GENERATE = readFileSync(new URL('../bin/generate.mjs', import.meta.url), 'utf8');

test('the title and description are built from the one tagline', () => {
  assert.equal(indexTitle(), `WHOMP: ${TAGLINE}`);
  assert.equal(indexDescription(15), `${TAGLINE} A 15 minute run in a browser tab, built in the open with the dev log public.`);
});

test('every piece of copy keeps the house voice: finished, no em dash, no exclamation', () => {
  const strings = [
    TAGLINE, FOOTER_LEAD, ...LANDING_COPY.run.ledes, LANDING_COPY.run.tallyNote, LANDING_COPY.kit.lede(3),
    LANDING_COPY.shipped.lede(LANDING_LOG_ENTRIES), LANDING_COPY.next.lede, LANDING_COPY.pipeline.lede(9, 6),
    LOG_COPY.subtag, LOG_COPY.description, LOG_COPY.shipped.lede, LOG_COPY.flight.lede, LOG_COPY.story.link.text,
  ];
  for (const s of strings) {
    assert.doesNotMatch(s, /[—–!]/, s);
    if (s !== FOOTER_LEAD) assert.match(plain(s), /[.?]$/, s);
  }
  assert.equal(plain(LANDING_COPY.kit.lede(3)), 'Every level up offers 3. You keep one, the other 2 are gone for good.');
  assert.equal(LOG_COPY.stat({ total: 4, windowDays: 7, activeDays: 2, filtered: 9 }), '4 player-visible changes in the last 7 days, across 2 active days, 9 internal-only commits filtered out');
});

test('plain collapses the wrapped source strings', () => {
  assert.equal(plain(LANDING_COPY.run.ledes[1]), 'Nothing to download, nothing to install, and nobody here wants your email address. Click it and you are already being chased.');
});

test('bin/generate.mjs reads the copy from here and keeps no second copy of it', () => {
  assert.match(GENERATE, /from '\.\/site-copy\.mjs'/);
  for (const s of [TAGLINE, LOG_COPY.subtag, LOG_COPY.description, LANDING_COPY.next.lede, 'Fifteen minutes, and every one']) {
    assert.equal(GENERATE.includes(s), false, `generate.mjs still carries "${s.slice(0, 40)}"`);
  }
  assert.doesNotMatch(GENERATE, /const FEED_WINDOW_DAYS = /);
  assert.doesNotMatch(GENERATE, /function parseNote\(/);
});

test('the window is calendar days and the feed reads it from its first day', () => {
  const { dates, start } = feedWindow('2026-03-02', FEED_WINDOW_DAYS);
  assert.equal(dates.length, 7);
  assert.equal(start, '2026-02-24');
  assert.deepEqual(feedLogArgs(start).slice(-1), ['--since=2026-02-24 00:00:00']);
});

test('feedDays keeps the five player kinds, counts the noise and strips em dashes', () => {
  const { days, filtered } = feedDays([
    'aaa1111\x1f2026-03-02\x1ffeat(hub): a new door — at last',
    'bbb2222\x1f2026-03-02\x1fdocs: notes',
    'ccc3333\x1f2026-03-01\x1ffix: the gate',
    'ddd4444\x1f2026-03-01\x1fwip on things',
    '',
  ]);
  assert.equal(filtered, 1);
  assert.deepEqual([...days.keys()], ['2026-03-02', '2026-03-01']);
  assert.deepEqual(days.get('2026-03-02')[0], { sha: 'aaa1111', kind: 'feat', scope: 'hub', text: 'a new door, at last' });
});

test('notes, the concise merge and the story', () => {
  const note = parseNote('---\nversion: 0.2.0\ndate: 2026-03-01\ntitle: Doors\n---\nIntro line.\n\n## New\n- A door.\n', '2026-03-01');
  assert.equal(note.title, 'Doors');
  const { intro, buckets } = parseBody(note.body);
  assert.deepEqual(intro, ['Intro line.']);
  assert.deepEqual(buckets, [{ name: 'New', blocks: ['- A door.'] }]);
  const releases = [
    { version: '0.2.0', date: '2026-03-01', headline: 'Doors **open**', keyChanges: ['a'], bugFixes: [], additions: [{ date: '2026-03-02', headline: 'More doors', changes: ['b'] }] },
    { version: '0.1.0', date: '2026-02-20', headline: 'First', keyChanges: ['c'], bugFixes: ['d'], additions: [] },
  ];
  const model = conciseModel({ releases, notes: [] });
  assert.deepEqual(model.conciseShown.map((e) => e.anchor), ['release-0-2-0-2026-03-02', 'release-0-2-0', 'release-0-1-0']);
  assert.equal(model.conciseShown[1].title, 'Doors open');
  const authored = conciseModel({ releases, notes: [{ ...note, intro, buckets }] });
  assert.deepEqual(authored.conciseShown.map((e) => e.anchor), ['release-0-2-0-2026-03-02', 'note-2026-03-01', 'release-0-1-0']);
  const story = dayByDay({ referenceDay: '2026-03-02', windowDays: 3, days: feedDays(['aaa1111\x1f2026-03-01\x1ffix: x']).days, releases, conciseShown: model.conciseShown });
  assert.deepEqual(story.days.map((d) => d.date), ['2026-03-02', '2026-03-01', '2026-02-28']);
  assert.deepEqual(story.days[1].releases.map((r) => [r.anchor, r.cut]), [['release-0-2-0', true]]);
  assert.deepEqual(story.days[0].releases.map((r) => [r.anchor, r.cut]), [['release-0-2-0-2026-03-02', false]]);
});

test('the helpers moved with the copy', () => {
  assert.equal(slug('0.7.3'), '0-7-3');
  assert.equal(noEmDash('a — b'), 'a, b');
  assert.equal(cleanDoc('**bold** `code`'), 'bold code');
});
