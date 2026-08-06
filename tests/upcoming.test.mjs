/** WHAT THIS SUITE IS PROTECTING: the landing page's Upcoming section is the
 *  one place on the site that makes a claim about the FUTURE, and the failure
 *  mode is not a crash. It is a public page quietly promising a feature that
 *  nobody is building, or announcing that nothing is coming during a run that
 *  could not measure what is live.
 *
 *  So every case below is a wrong sentence this selection would otherwise let
 *  through, not a shape check.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { UPCOMING_CAP, compareVersions, parseArcs, selectUpcomingReleases } from '../bin/upcoming.mjs';

const EM_DASH = String.fromCharCode(8212);
const EN_DASH = String.fromCharCode(8211);
const cleanDoc = (s) => String(s)
  .replace(/\*\*/g, '').replace(/`([^`]*)`/g, '$1').replace(/\s+/g, ' ').trim()
  .split(EM_DASH).join(', ')
  .split(EN_DASH).join('-');

const release = (version, over = {}) => ({
  version,
  date: '2026-08-05',
  headline: `headline for ${version}`,
  keyChanges: [`a change in ${version}`],
  bugFixes: [],
  ...over,
});

// ── the compare, because "newest first" is a claim about the file and the live
//    version does not come out of the file ──────────────────────────────────
test('compareVersions orders by number, not by string', () => {
  assert.equal(compareVersions('0.6.10', '0.6.9'), 1, '0.6.10 is newer than 0.6.9 even though it sorts before it as text');
  assert.equal(compareVersions('0.10.0', '0.9.9'), 1);
  assert.equal(compareVersions('1.0.0', '0.99.99'), 1);
  assert.equal(compareVersions('0.6.2', '0.6.2'), 0);
  assert.equal(compareVersions('0.6.1', '0.6.2'), -1);
});

test('compareVersions refuses anything that is not strict semver', () => {
  assert.throws(() => compareVersions('0.6', '0.6.2'), /strict major\.minor\.patch/);
  assert.throws(() => compareVersions('v0.6.2', '0.6.2'), /strict major\.minor\.patch/);
  assert.throws(() => compareVersions('0.6.2-rc1', '0.6.2'), /strict major\.minor\.patch/);
});

// ── the four states ────────────────────────────────────────────────────────
test('a cut release newer than live is what the section shows', () => {
  const r = selectUpcomingReleases({
    releases: [release('0.6.2'), release('0.6.1'), release('0.6.0')],
    liveVersion: '0.6.1',
  });
  assert.equal(r.state, 'waiting');
  assert.deepEqual(r.shown.map((x) => x.version), ['0.6.2']);
  assert.equal(r.dropped, 0);
});

test('live on the newest cut release means nothing is coming, and says so as its own state', () => {
  const r = selectUpcomingReleases({
    releases: [release('0.6.2'), release('0.6.1')],
    liveVersion: '0.6.2',
  });
  assert.equal(r.state, 'current');
  assert.deepEqual(r.shown, []);
});

test('an UNREACHABLE live build is never reported as "nothing is coming"', () => {
  // The distinction this whole module exists for. An offline generation run
  // knows nothing about the live build, and "nothing is coming" is a claim
  // about the live build.
  for (const liveVersion of [null, undefined, '']) {
    const r = selectUpcomingReleases({ releases: [release('0.6.2')], liveVersion });
    assert.equal(r.state, 'unknown', `liveVersion ${JSON.stringify(liveVersion)} must not resolve to current`);
    assert.deepEqual(r.shown, []);
  }
});

test('a live build newer than every written release is its own state, not "current"', () => {
  // The shape a missed release-notes entry takes. The page says the same
  // neutral thing either way, but the two are not the same fact and a future
  // guard should be able to tell them apart.
  const r = selectUpcomingReleases({
    releases: [release('0.6.1'), release('0.6.0')],
    liveVersion: '0.7.0',
  });
  assert.equal(r.state, 'ahead');
  assert.deepEqual(r.shown, []);
});

test('older releases never leak into the section', () => {
  const r = selectUpcomingReleases({
    releases: [release('0.6.2'), release('0.6.1'), release('0.5.0')],
    liveVersion: '0.6.1',
  });
  assert.equal(r.shown.length, 1);
  assert.equal(r.shown[0].version, '0.6.2');
});

// ── no silent caps ─────────────────────────────────────────────────────────
test('more waiting releases than the cap are counted, never dropped in silence', () => {
  const releases = ['0.7.3', '0.7.2', '0.7.1', '0.7.0', '0.6.9'].map((v) => release(v));
  const r = selectUpcomingReleases({ releases, liveVersion: '0.6.9' });
  assert.equal(r.state, 'waiting');
  assert.equal(r.shown.length, UPCOMING_CAP);
  assert.equal(r.dropped, 4 - UPCOMING_CAP);
  assert.equal(r.shown.length + r.dropped, 4, 'every waiting release is either shown or counted');
});

test('the shown releases are newest first even when the source order is wrong', () => {
  const r = selectUpcomingReleases({
    releases: [release('0.7.0'), release('0.7.2'), release('0.7.1')],
    liveVersion: '0.6.9',
  });
  assert.deepEqual(r.shown.map((x) => x.version), ['0.7.2', '0.7.1', '0.7.0']);
});

// ── refusals ───────────────────────────────────────────────────────────────
test('a bad release version stops the build rather than being skipped quietly', () => {
  assert.throws(
    () => selectUpcomingReleases({ releases: [release('0.6')], liveVersion: '0.5.0' }),
    /strict major\.minor\.patch/,
  );
});

test('a bad live version stops the build too', () => {
  assert.throws(
    () => selectUpcomingReleases({ releases: [release('0.6.2')], liveVersion: 'latest' }),
    /strict major\.minor\.patch/,
  );
});

test('the inputs have to be the shape they claim', () => {
  assert.throws(() => selectUpcomingReleases({ releases: null, liveVersion: '0.6.1' }), /must be an array/);
  assert.throws(() => selectUpcomingReleases({ releases: [], liveVersion: '0.6.1', cap: 0 }), /positive integer/);
});

// ── the further-out half ───────────────────────────────────────────────────
const CAMPAIGN = `# CAMPAIGN

## ARCS
- A1 QUALITY BAR (live): junction law, sprite bar. Rolling.
- A6 CHARACTER PROGRESSION (Fri+): starters trio, zone-gated new characters (7 themed),
  Whompus crown, pedestal rework, unlock ceremonies wired.
- A9 THE LAB ARC (pillar, rolling): dev tools graduate to player features. Photo mode +
  free roam, codex, gallery; L0 secret entry to L3 community pipeline per THE_LAB_ARC.md.

## STANDING DEBTS
- B1 NOT AN ARC: this block is past the ARCS section and must not be read.
`;

test('an arc whose description wraps publishes the whole sentence', () => {
  // The public failure this fixes: two cards shipped with text that stopped on a
  // comma and on a dangling plus, with nothing on the page saying it was cut.
  const arcs = parseArcs(CAMPAIGN, cleanDoc);
  const a6 = arcs.find((a) => a.id === 'A6');
  assert.match(a6.what, /unlock ceremonies wired\.$/);
  assert.doesNotMatch(a6.what, /themed\),$/, 'no card ends mid-sentence on a comma');
});

test('a trailing pointer at another document does not reach a reader', () => {
  const a9 = parseArcs(CAMPAIGN, cleanDoc).find((a) => a.id === 'A9');
  assert.doesNotMatch(a9.what, /\.md/);
  assert.match(a9.what, /community pipeline\.$/, 'the sentence in front of the pointer survives');
});

test('the id, name and when still come out where they always did', () => {
  const a1 = parseArcs(CAMPAIGN, cleanDoc).find((a) => a.id === 'A1');
  assert.equal(a1.name, 'QUALITY BAR');
  assert.equal(a1.when, 'live');
  assert.equal(a1.what, 'junction law, sprite bar. Rolling.');
});

test('only the ARCS block is read', () => {
  const arcs = parseArcs(CAMPAIGN, cleanDoc);
  assert.deepEqual(arcs.map((a) => a.id), ['A1', 'A6', 'A9']);
});

test('no ARCS block is an empty list, not a throw', () => {
  assert.deepEqual(parseArcs('# CAMPAIGN\n\n## OTHER\n- A1 X: y.\n', cleanDoc), []);
});
