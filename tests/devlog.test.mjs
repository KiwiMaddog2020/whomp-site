/** The story composer, tested directly.
 *
 *  tests/generatedSite.test.mjs reads the rendered page and is the guarantee
 *  that matters, but it can only ever see the shapes that happened to occur in
 *  the last seven days of one repo. A day of exactly one change, a day of one
 *  kind, a week with no release in it and a night whose every line names a
 *  branch are all real states this page has to survive, and none of them is
 *  reliably present on any given Tuesday. So they are constructed here.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildStory, composedSentences, dayShape, NIGHTLY_LINES_SHOWN, parseNightly, readableNights,
  shapeSentence, summarySentences, unreadableReason, windowDates,
} from '../bin/devlog.mjs';
import { trailsOff } from '../bin/landing.mjs';

const change = (kind, sha = 'aaaaaaa') => ({ kind, sha, scope: '', text: 'something' });

/* -------------------------------------------------------------- the day shape */

test('the tally is largest first, and ties keep a fixed order', () => {
  const shape = dayShape([change('fix'), change('feat'), change('fix'), change('style'), change('feat'), change('fix')]);
  assert.deepEqual(shape, [{ kind: 'fix', count: 3 }, { kind: 'feat', count: 2 }, { kind: 'style', count: 1 }]);
  // Equal counts must not swap between runs: a diff that means nothing is worse
  // than no diff, because somebody has to read it before deciding that.
  const tied = dayShape([change('style'), change('feat'), change('perf'), change('balance')]);
  assert.deepEqual(tied.map((k) => k.kind), ['feat', 'balance', 'perf', 'style']);
});

test('every shape of day produces one finished sentence', () => {
  const cases = [
    [[], 'Nothing player-visible landed.'],
    [[change('fix')], 'One change landed, and it was a fix.'],
    [[change('feat')], 'One change landed, and it was new.'],
    [[change('style')], 'One change landed, and it was polish.'],
    [[change('fix'), change('fix')], '2 changes landed, all of them fixes.'],
    [[change('feat'), change('feat'), change('feat')], '3 changes landed, all of them new work.'],
    [[change('fix'), change('feat'), change('fix')], '3 changes landed: 2 fixed, 1 new.'],
  ];
  for (const [changes, expected] of cases) {
    const sentence = shapeSentence(dayShape(changes));
    assert.equal(sentence, expected);
    assert.equal(trailsOff(sentence), false, `"${sentence}" trails off`);
  }
});

test('a single-kind day never restates its own total', () => {
  // "12 changes landed: 12 fixed" is true, and reads as a stutter. The form
  // exists to avoid exactly that.
  const sentence = shapeSentence(dayShape(Array.from({ length: 12 }, () => change('fix'))));
  assert.equal(sentence, '12 changes landed, all of them fixes.');
  assert.equal(/12[^.]*12/.test(sentence), false, 'the sentence says the total twice');
});

test('a kind the generator has never emitted still renders as a sentence', () => {
  // The feed's own regex admits five kinds today. If a sixth is ever added
  // there, this file must degrade to the raw word rather than print undefined.
  const sentence = shapeSentence(dayShape([change('revert'), change('fix')]));
  assert.equal(sentence, '2 changes landed: 1 fixed, 1 revert.');
  assert.equal(/undefined/.test(sentence), false);
});

/* ---------------------------------------------------------------- the calendar */

test('the window is a run of calendar days, newest first, with no gaps', () => {
  assert.deepEqual(windowDates('2026-08-06', 7), [
    '2026-08-06', '2026-08-05', '2026-08-04', '2026-08-03', '2026-08-02', '2026-08-01', '2026-07-31',
  ]);
});

test('the window crosses a month and a year boundary', () => {
  assert.deepEqual(windowDates('2026-03-02', 4), ['2026-03-02', '2026-03-01', '2026-02-28', '2026-02-27']);
  assert.deepEqual(windowDates('2027-01-01', 3), ['2027-01-01', '2026-12-31', '2026-12-30']);
  // 2028 is a leap year. A hand-rolled day subtraction is exactly where this
  // goes wrong, so it is pinned rather than assumed.
  assert.deepEqual(windowDates('2028-03-01', 2), ['2028-03-01', '2028-02-29']);
});

/* ------------------------------------------------------------------- the story */

const storyFixture = () => buildStory({
  lastDay: '2026-08-06',
  windowDays: 4,
  changesByDate: new Map([
    ['2026-08-06', [change('feat'), change('fix')]],
    ['2026-08-04', [change('fix')]],
  ]),
  releasesByDate: new Map([['2026-08-06', [{ version: '0.6.3', title: 'Snow, and what lives in it', anchor: 'release-0-6-3' }]]]),
  nightsByDate: new Map([['2026-08-05', ['The snow worlds got their own enemies.']]]),
});

test('the story carries every day in the window, including the quiet ones', () => {
  const story = storyFixture();
  assert.deepEqual(story.days.map((d) => d.date), ['2026-08-06', '2026-08-05', '2026-08-04', '2026-08-03']);
  assert.deepEqual(story.days.map((d) => d.quiet), [false, true, false, true]);
  // The quiet day still says something, because a card with nothing in it is
  // the failure this replaces.
  assert.equal(story.days[1].shape, 'Nothing player-visible landed.');
});

test('a quiet day still carries the night that was written on it', () => {
  const story = storyFixture();
  assert.deepEqual(story.days[1].nightly, ['The snow worlds got their own enemies.']);
});

test('the story reports a commit dated outside its own window', () => {
  const story = buildStory({
    lastDay: '2026-08-06',
    windowDays: 2,
    changesByDate: new Map([['2026-08-06', [change('fix')]], ['2026-07-30', [change('fix')]]]),
  });
  assert.deepEqual(story.outside, ['2026-07-30']);
  assert.equal(story.days.length, 2, 'the outside day was rendered anyway');
});

test('every sentence the story composes is finished', () => {
  for (const sentence of composedSentences(storyFixture())) {
    assert.equal(trailsOff(sentence), false, `"${sentence}" trails off`);
    assert.equal(/[—–!]/.test(sentence), false, `"${sentence}" breaks house law`);
  }
});

test('the summary states the window, the days in it, and whether anything shipped', () => {
  assert.deepEqual(summarySentences({ total: 899, active: 7, windowDays: 7, releaseCount: 3, releaseDays: 2 }), [
    '899 player-visible changes landed in the last 7 days, across 7 of them.',
    '3 releases were cut across 2 of those days, and that is the part a player can already play.',
  ]);
  assert.deepEqual(summarySentences({ total: 12, active: 2, windowDays: 7, releaseCount: 1, releaseDays: 1 }), [
    '12 player-visible changes landed in the last 7 days, across 2 of them.',
    'One release was cut on one of those days, and that is the part a player can already play.',
  ]);
  assert.match(summarySentences({ total: 12, active: 2, windowDays: 7, releaseCount: 0, releaseDays: 0 })[1],
    /None of those days ended in a release/);
});

test('a week where nothing player-visible landed is a real week and says so', () => {
  const [first, second] = summarySentences({ total: 0, active: 0, windowDays: 7, releaseCount: 0, releaseDays: 0 });
  assert.equal(first, 'Nothing player-visible landed in the last 7 days.');
  assert.equal(/0 /.test(first), false, 'the empty week is reported as a row of zeroes');
  assert.equal(trailsOff(second), false);
});

/* ---------------------------------------------------------------- the nights */

const NIGHTLY = `# Nightly

## 2026-08-06 04:45 autoland
- The snow worlds got their own enemies.
- Landed \`claude/coop-host-connect\`.

## 2026-08-06 04:56 autoland
- The tailor screen got its coat.

## 2026-08-05
Two bosses now telegraph before they swing.
- Fixed a crash in
- Rebased the branch onto main.
`;

test('a night is read by date, and two runs on one night are one night', () => {
  const nights = parseNightly(NIGHTLY);
  assert.deepEqual(nights.map((n) => n.date), ['2026-08-06', '2026-08-05']);
  assert.equal(nights[0].lines.length, 3, 'the second heading of the same date was dropped');
  // Bullets and plain paragraphs both count as lines.
  assert.equal(nights[1].lines[0], 'Two bosses now telegraph before they swing.');
});

test('a missing nightly file yields nothing and refuses nothing', () => {
  for (const empty of [undefined, null, '', '# Nightly\n\nNothing yet.\n']) {
    const { byDate, refused } = readableNights(empty);
    assert.equal(byDate.size, 0);
    assert.equal(refused.length, 0);
  }
});

test('a night line reaches the page only if a stranger could read it', () => {
  const { byDate, refused } = readableNights(NIGHTLY);
  assert.deepEqual([...byDate.keys()].sort(), ['2026-08-05', '2026-08-06']);
  assert.deepEqual(byDate.get('2026-08-06'), ['The snow worlds got their own enemies.', 'The tailor screen got its coat.']);
  assert.deepEqual(byDate.get('2026-08-05'), ['Two bosses now telegraph before they swing.']);
  assert.deepEqual(refused.map((r) => r.reason).sort(), [
    'it does not finish its sentence', 'it names the machinery ("branch")', 'it quotes code',
  ]);
});

test('every refusal fires on purpose, and names what has to change', () => {
  const cases = [
    ['Landed `claude/x`.', 'it quotes code'],
    ['Landed claude/coop-host-connect today.', 'it names a branch'],
    ['See docs/CAMPAIGN.md for the arc.', 'it names a file'],
    ['Shipped as a1b2c3d today.', 'it names a commit'],
    ['The registry grew a new entry.', 'it names the machinery ("registry")'],
    ['Two bosses telegraph now!', 'it breaks house law on dashes and exclamations'],
    ['Two bosses telegraph now, and', 'it does not finish its sentence'],
    ['   ', 'it is empty'],
  ];
  for (const [line, reason] of cases) assert.equal(unreadableReason(line), reason, `"${line}"`);
  // And the negative of the negative: a line written for a reader passes.
  assert.equal(unreadableReason('The snow worlds got their own enemies.'), null);
  assert.equal(unreadableReason('Does the tailor screen have a coat yet?'), null);
});

test('the words the pitch page teaches are not refused as machinery', () => {
  // lane, gate, track, build, release, preview and stable are the vocabulary
  // built-in-the-open.html exists to explain, and the site already prints them
  // in public copy. Refusing them here would refuse the only nightly lines
  // worth publishing.
  assert.equal(unreadableReason('Two lanes went through the gate and one of them stopped.'), null);
  assert.equal(unreadableReason('The preview track moved twice, and stable did not.'), null);
});

test('a night with more readable lines than the cap says so out loud', () => {
  const source = ['## 2026-08-06', 'One. ', 'Two. ', 'Three. ', 'Four. '].join('\n');
  const { byDate, trimmed } = readableNights(source);
  assert.equal(byDate.get('2026-08-06').length, NIGHTLY_LINES_SHOWN);
  assert.deepEqual(trimmed, [{ date: '2026-08-06', held: 4 - NIGHTLY_LINES_SHOWN }]);
});

test('a night whose every line is engineering publishes nothing rather than something', () => {
  const source = '## 2026-08-06\n- Merged `claude/x` at a1b2c3d.\n- Ran the suite against docs/TRAIN.md.\n';
  const { byDate, refused } = readableNights(source);
  assert.equal(byDate.size, 0, 'an unreadable night still reached the page');
  assert.equal(refused.length, 2);
});
