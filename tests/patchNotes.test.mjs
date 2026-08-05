/** The concise dev log's source reader, tested against fixture text rather than
 *  against whichever game checkout happens to sit beside this repo, so the
 *  suite is deterministic and runs with no game present.
 *
 *  WHAT THIS SUITE IS ACTUALLY PROTECTING: the concise view is the default view
 *  and its old failure mode was silence. Every refusal below exists because the
 *  alternative is a generator that exits zero and publishes a page that says
 *  nothing shipped. The empty-parse case is not hypothetical: the first draft of
 *  sliceArrayLiteral anchored on the name PATCH_RELEASES and found the "[" in
 *  `readonly PatchRelease[]`, parsed a perfectly valid empty array, and would
 *  have shipped a blank view had the refusal not been there to catch it.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { KEY_CHANGE_CAP, parsePatchReleases } from '../bin/patch-notes.mjs';

const release = (over = {}) => ({
  version: '0.6.2',
  date: '2026-08-05',
  headline: 'A headline.',
  keyChanges: ['One.'],
  bugFixes: ['Fixed one.'],
  fullChanges: ['Ledger one.', 'Ledger two.'],
  pleaseTest: ['Test one.'],
  ...over,
});

/** Renders release objects back into the TypeScript source shape the reader
 *  consumes, single quotes and trailing commas included. */
const source = (releases, { annotation = ': readonly PatchRelease[]' } = {}) => {
  const quote = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  const field = (key, value) => (Array.isArray(value)
    ? `    ${key}: [\n${value.map((v) => `      ${quote(v)},`).join('\n')}\n    ],`
    : `    ${key}: ${quote(value)},`);
  const body = releases.map((r) => `  {\n${Object.entries(r).map(([k, v]) => field(k, v)).join('\n')}\n  },`).join('\n');
  return `export interface PatchRelease { version: string; }\n\nexport const PATCH_RELEASES${annotation} = [\n${body}\n];\n`;
};

test('a well-formed source yields every release, newest first, with the concise fields only', () => {
  const parsed = parsePatchReleases(source([
    release({ version: '0.6.2', date: '2026-08-05' }),
    release({ version: '0.6.1', date: '2026-08-04' }),
  ]));

  assert.equal(parsed.length, 2);
  assert.deepEqual(parsed.map((r) => r.version), ['0.6.2', '0.6.1']);
  assert.deepEqual(Object.keys(parsed[0]).sort(), ['bugFixes', 'date', 'headline', 'keyChanges', 'version']);
});

/* fullChanges is the exhaustive shipped ledger. Pouring it into the concise view
 * would rebuild the full log with fewer words, which is the one outcome that
 * kills this view, so the reader must not hand it downstream even by accident. */
test('the exhaustive ledger and the tester checklist never reach the concise view', () => {
  const [parsed] = parsePatchReleases(source([release()]));
  assert.equal('fullChanges' in parsed, false);
  assert.equal('pleaseTest' in parsed, false);
});

/* The type annotation contains an empty array literal. A reader that anchors on
 * the export NAME finds it, parses it happily, and returns zero releases. */
test('the type annotation is not mistaken for the array literal', () => {
  const parsed = parsePatchReleases(source([release()], { annotation: ': readonly PatchRelease[]' }));
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].version, '0.6.2');
});

test('an empty release list is refused rather than published as an empty view', () => {
  assert.throws(
    () => parsePatchReleases('export const PATCH_RELEASES: readonly PatchRelease[] = [\n];\n'),
    /parsed to zero releases/,
  );
});

test('a missing export is refused rather than treated as no releases', () => {
  assert.throws(() => parsePatchReleases('export const SOMETHING_ELSE = [];\n'), /no "export const PATCH_RELEASES"/);
});

/* THE NOISE GUARD, owned on this side. The game's own suite pins keyChanges to
 * four, but that test protects the title screen's What's New panel. If the game
 * repo ever raises its cap, the concise view refuses to publish rather than
 * quietly growing a fifth and sixth highlight per release. */
test(`more than ${KEY_CHANGE_CAP} highlights on one release stops the build`, () => {
  const tooMany = release({ keyChanges: ['One.', 'Two.', 'Three.', 'Four.', 'Five.'] });
  assert.throws(() => parsePatchReleases(source([tooMany])), /publishes at most 4 per release/);
});

test(`exactly ${KEY_CHANGE_CAP} highlights is allowed`, () => {
  const atCap = release({ keyChanges: ['One.', 'Two.', 'Three.', 'Four.'] });
  assert.equal(parsePatchReleases(source([atCap]))[0].keyChanges.length, KEY_CHANGE_CAP);
});

for (const [name, over] of [
  ['a non-semver version', { version: '0.6' }],
  ['a malformed date', { date: '05-08-2026' }],
  ['an empty headline', { headline: '   ' }],
  ['an empty keyChanges list', { keyChanges: [] }],
  ['an empty bugFixes list', { bugFixes: [] }],
  ['a whitespace-only highlight', { keyChanges: ['   '] }],
]) {
  test(`${name} stops the build`, () => {
    assert.throws(() => parsePatchReleases(source([release(over)])));
  });
}

/* A missing fullChanges is not a concise-view problem in itself, but it means
 * the source shape moved, and a reader that shrugs at a moved shape is how a
 * view goes quietly wrong. */
test('a release missing the exhaustive ledger stops the build', () => {
  const missing = release();
  delete missing.fullChanges;
  assert.throws(() => parsePatchReleases(source([missing])), /no non-empty fullChanges list/);
});

/* One release is one concise entry. Two deploys on one Vancouver date share a
 * version by design (whomp/bin/release-channel.mjs returns the live version
 * unchanged for a same-date publication), so a duplicate version here would put
 * the same release on the page twice. */
test('a duplicated version stops the build', () => {
  assert.throws(
    () => parsePatchReleases(source([release({ version: '0.6.2' }), release({ version: '0.6.2', date: '2026-08-04' })])),
    /appears more than once/,
  );
});

/* Newest-first is the source's own documented contract. An entry appended to the
 * wrong end would bury the newest release at the bottom of the default view. */
test('a release dated after the one above it stops the build', () => {
  assert.throws(
    () => parsePatchReleases(source([release({ version: '0.6.1', date: '2026-08-04' }), release({ version: '0.6.2', date: '2026-08-05' })])),
    /newest-first by contract/,
  );
});

/* Two releases really do share 2026-07-17 in the shipped history, from before
 * the current one-release-per-Vancouver-date cadence. Equal dates are ordered,
 * not out of order. */
test('two releases on the same date are accepted', () => {
  const parsed = parsePatchReleases(source([
    release({ version: '0.2.1', date: '2026-07-17' }),
    release({ version: '0.2.0', date: '2026-07-17' }),
  ]));
  assert.deepEqual(parsed.map((r) => r.version), ['0.2.1', '0.2.0']);
});

/* Release prose is prose: it contains escaped apostrophes ("Lucio\'s boop"),
 * brackets, braces and colons. A regex sweep gets these wrong confidently,
 * which is why the reader is a real literal parser. */
test('escaped apostrophes and structural characters inside prose survive intact', () => {
  const prose = "Boop lands like Lucio's boop should [finally], and {the crowd} is satisfied: yes.";
  const [parsed] = parsePatchReleases(source([release({ keyChanges: [prose] })]));
  assert.equal(parsed.keyChanges[0], prose);
});

test('a bracket at the start of a prose line does not close the array early', () => {
  const parsed = parsePatchReleases(source([
    release({ version: '0.6.2', date: '2026-08-05', keyChanges: ['], and then more text.'] }),
    release({ version: '0.6.1', date: '2026-08-04' }),
  ]));
  assert.equal(parsed.length, 2);
});

test('line and block comments between releases are skipped', () => {
  const withComments = source([release({ version: '0.6.2', date: '2026-08-05' }), release({ version: '0.6.1', date: '2026-08-04' })])
    .replace('  {\n    version: \'0.6.1\'', '  // a note about the release below\n  /* and a block one */\n  {\n    version: \'0.6.1\'');
  assert.equal(parsePatchReleases(withComments).length, 2);
});

/* Surrounding text is trimmed at parse time so the renderer never has to. */
test('surrounding whitespace is trimmed off every string', () => {
  const [parsed] = parsePatchReleases(source([release({ headline: '  A headline.  ', keyChanges: ['  One.  '] })]));
  assert.equal(parsed.headline, 'A headline.');
  assert.equal(parsed.keyChanges[0], 'One.');
});
