import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { visualManifestViolations } from '../bin/wiki.mjs';

const game = resolve(process.env.WHOMP_REPO || '../whomp');
const artifacts = ['game-data.json', 'wiki-visuals.json'].map((name) => resolve(game, 'data', name));
const available = artifacts.every(existsSync);
const options = available ? {} : { skip: 'canonical game artifacts unavailable; set WHOMP_REPO' };
const [D, V] = available ? artifacts.map((path) => JSON.parse(readFileSync(path, 'utf8'))) : [];
const coverage = (violations) => violations.filter((message) => message.includes('does not exactly cover'));
const enemies = (manifest) => manifest.policies.find((policy) => policy.domain === 'enemies');

test('current WHOMP data passes the coverage comparison with its declared exclusions', options, () => {
  assert.ok(enemies(V).excludedIds.length > 0);
  assert.deepEqual(coverage(visualManifestViolations(D, V)), []);
});

test('an id missing from expectedIds with no exclusion still fails', options, () => {
  const broken = structuredClone(V);
  enemies(broken).expectedIds.pop();
  assert.equal(coverage(visualManifestViolations(D, broken)).length, 1);
});

test('dropping a declared exclusion fails, so the id cannot go silently missing', options, () => {
  const broken = structuredClone(V);
  enemies(broken).excludedIds.pop();
  assert.equal(coverage(visualManifestViolations(D, broken)).length, 1);
});

test('an excluded id that is not in game data fails', options, () => {
  const broken = structuredClone(V);
  enemies(broken).excludedIds.push({ id: 'noSuchEnemy', reason: 'unfielded' });
  assert.equal(coverage(visualManifestViolations(D, broken)).length, 1);
});

test('an id both expected and excluded fails', options, () => {
  const broken = structuredClone(V);
  enemies(broken).expectedIds.push(enemies(broken).excludedIds[0].id);
  assert.equal(coverage(visualManifestViolations(D, broken)).length, 1);
});

test('an exclusion without a reason fails', options, () => {
  const broken = structuredClone(V);
  delete enemies(broken).excludedIds[0].reason;
  assert.equal(coverage(visualManifestViolations(D, broken)).length, 1);
});
