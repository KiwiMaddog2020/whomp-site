/** The pitch page's claims, and the machinery that keeps them earned.
 *
 *  This page is the only one on the site whose copy is written rather than
 *  derived, so it is the only one that can go quietly wrong when the studio
 *  changes how it works. Every sentence names the file that makes it true. This
 *  suite proves three things: the sentences obey house law before anybody
 *  publishes them, the pins still match the game repo as it stands right now,
 *  and the verifier actually fires when a rule moves.
 *
 *  The last one is the one that matters. A guard that has never failed on
 *  purpose is not known to work, which is itself one of the pinned claims.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { malformedPins, pinWarning, PITCH_PINS, trainScale, verifyPins } from '../bin/pitch.mjs';

const SITE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GAME_REPO = join(SITE_ROOT, '..', 'whomp');
const readGame = (path) => {
  const at = join(GAME_REPO, path);
  return existsSync(at) ? readFileSync(at, 'utf8') : null;
};
const hasGameRepo = existsSync(join(GAME_REPO, '.git'));
const needsGame = hasGameRepo ? {} : { skip: 'no game repo beside this checkout' };

/* ------------------------------------------------------------ the copy itself */

test('every claim is a finished sentence and holds house law', () => {
  assert.deepEqual(malformedPins(), []);
  assert.ok(PITCH_PINS.length >= 8, 'the pitch shrank to almost nothing');
});

test('no claim names the machinery to the reader', () => {
  // docs/VOICE.md rule 12, applied to the one page on the site that is about
  // the machinery. It may describe the process; it may not print a path, a
  // branch, a file or a word only somebody working here would know.
  for (const pin of PITCH_PINS) {
    assert.equal(/[\w.-]+\.(?:md|ts|mjs|json|sh)\b/.test(pin.claim), false, `${pin.id} names a file`);
    assert.equal(/`/.test(pin.claim), false, `${pin.id} quotes code`);
    assert.equal(/\b(?:repo|repository|worktree|schema|registry|artifact|semantics|typecheck|vitest|sha)\b/i.test(pin.claim),
      false, `${pin.id} names the machinery`);
  }
});

test('every claim is pinned to a source and at least one pattern', () => {
  const ids = new Set();
  for (const pin of PITCH_PINS) {
    assert.equal(ids.has(pin.id), false, `two pins share the id ${pin.id}`);
    ids.add(pin.id);
    assert.match(pin.source, /^(?:AGENTS\.md|docs\/[A-Z_]+\.md)$/, `${pin.id} pins to an unexpected file`);
    assert.ok(pin.evidence.length >= 1, `${pin.id} is pinned to nothing`);
  }
});

/* ----------------------------------------------------- against the real source */

test('every claim is still earned by the game repo as it stands', needsGame, () => {
  const { verified, missingSource, missingEvidence } = verifyPins(readGame);
  assert.deepEqual(missingSource.map((p) => `${p.id} -> ${p.source}`), [], 'a pinned file has moved');
  assert.deepEqual(missingEvidence.map((p) => `${p.id}: ${p.unmatched.join(', ')}`), [], 'a pinned rule has changed');
  assert.equal(verified.length, PITCH_PINS.length);
});

test('the pins are matched across line breaks, not line by line', needsGame, () => {
  // Both source docs wrap prose at about eighty-eight characters, so several of
  // these quotations straddle a break in the file. A per-line matcher reports
  // them missing, which is the same defect that ended two campaign arcs on a
  // comma. This is the regression guard for the fold.
  const rules = readGame('docs/CLOUD_LANE_RULES.md');
  const wrapped = /a law without a mechanism is a note/gi;
  // 2026-08-07: the game repo's ROUTING section now also quotes the aphorism on a
  // single line, so "no line contains it" stopped being true without the straddling
  // occurrence going anywhere. The property this guard needs is narrower: at least
  // one occurrence must straddle a break, which is exactly when a folded match
  // finds MORE occurrences than a per-line match does.
  const foldedCount = (rules.replace(/\s+/g, ' ').match(wrapped) ?? []).length;
  const perLineCount = rules.split('\n')
    .reduce((n, line) => n + ((line.match(wrapped) ?? []).length), 0);
  assert.ok(foldedCount >= 1, 'the quotation vanished from the source doc entirely');
  assert.ok(foldedCount > perLineCount,
    'no occurrence straddles a line break anymore, so this guard proves nothing now');
});

/* ------------------------------------------------------- the guard, fired hard */

test('a pinned rule that moved is reported, and the warning names the file', () => {
  const pin = PITCH_PINS.find((p) => p.id === 'tests-ran');
  const gutted = (path) => (path === pin.source ? 'This file no longer says anything of the kind.' : readGame(path));
  const { missingEvidence } = verifyPins(gutted, [pin]);
  assert.equal(missingEvidence.length, 1, 'the verifier passed a claim the source no longer makes');
  const warning = pinWarning(missingEvidence[0], '../whomp');
  assert.match(warning, /docs\/CLOUD_LANE_RULES\.md/);
  assert.match(warning, /bin\/pitch\.mjs/, 'the warning does not say where to go and fix it');
});

test('a pinned file that vanished is reported separately from a rule that changed', () => {
  const pin = PITCH_PINS.find((p) => p.id === 'approval');
  const { missingSource, missingEvidence } = verifyPins(() => null, [pin]);
  assert.equal(missingSource.length, 1);
  assert.equal(missingEvidence.length, 0, 'a missing file was reported as a changed rule');
  assert.match(pinWarning(missingSource[0], '../whomp'), /there is no such file/);
});

test('a claim that trails off is caught before it is ever published', () => {
  const bad = malformedPins([{ id: 'x', claim: 'A lane writes down which files it may touch,', evidence: [/x/] }]);
  assert.deepEqual(bad, [{ id: 'x', reason: 'the sentence does not finish' }]);
  const dashed = malformedPins([{ id: 'y', claim: 'A lane writes it down — first.', evidence: [/x/] }]);
  assert.deepEqual(dashed, [{ id: 'y', reason: 'the sentence breaks house law on dashes and exclamations' }]);
});

/* ------------------------------------------------------------------- the scale */

test('the scale sentence states a count and a date, and no relative anchor', () => {
  const scale = trainScale({ landedLanes: 337, firstDay: '2026-07-11' });
  assert.equal(scale.ok, true);
  assert.equal(scale.sentence, '337 of them have landed since the first commit, on 2026-07-11.');
  assert.equal(/\b(?:ago|today|so far this|this week|last week)\b/.test(scale.sentence), false,
    'the scale carries a relative anchor, which is wrong the day after it is generated');
});

test('an unreadable scale reports rather than stopping the site', () => {
  for (const input of [{ landedLanes: 0, firstDay: '2026-07-11' }, { landedLanes: 12, firstDay: 'sometime' }, {}]) {
    const scale = trainScale(input);
    assert.equal(scale.ok, false);
    assert.match(scale.reason, /will not print/);
  }
});
