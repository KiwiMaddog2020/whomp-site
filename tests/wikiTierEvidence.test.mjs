import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { tierEvidenceViolations } from '../bin/wiki.mjs';

// Like the generator's --repo, this accepts an external canonical game checkout.
// A site-only clone cannot fabricate controlled-simulation evidence.
const game = resolve(process.env.WHOMP_REPO || '../whomp');
const artifacts = ['game-data.json', 'tier-rankings.json'].map((name) => resolve(game, 'data', name));
const available = artifacts.every(existsSync);
const options = available ? {} : { skip: 'canonical game artifacts unavailable; set WHOMP_REPO' };
const [D, T] = available ? artifacts.map((path) => JSON.parse(readFileSync(path, 'utf8'))) : [];
const coreFaces = () => D.domains.weapons.order.filter((id) => D.domains.weapons.refs[id]?.evolvesFromCore);

test('canonical automatic evidence remains exhaustive while core faces stay unmeasured', options, () => {
  assert.deepEqual(tierEvidenceViolations(D, T), []);
  const eligible = T.loadoutContract.eligibleIds;
  assert.equal(T.measuredBuilds.pairs.length, eligible.length * (eligible.length - 1) / 2);
  assert.ok(coreFaces().length > 0);
  for (const id of coreFaces()) {
    assert.equal(eligible.includes(id), false);
    assert.ok(T.coverage.unmeasured.includes(id));
  }
});

test('a core face injected into the automatic loadout is refused', options, () => {
  const broken = structuredClone(T);
  broken.loadoutContract.eligibleIds.push(coreFaces()[0]);
  assert.ok(tierEvidenceViolations(D, broken).some((message) => message.startsWith('tier loadoutContract')));
});

test('removing a valid base-weapon pair remains a coverage failure', options, () => {
  const broken = structuredClone(T);
  const removed = broken.measuredBuilds.pairs.pop();
  assert.ok(removed.ids.every((id) => broken.loadoutContract.eligibleIds.includes(id)));
  assert.ok(tierEvidenceViolations(D, broken).some((message) => message.startsWith('measured pair coverage')));
});

test('a core face omitted from the explicit unmeasured ledger is refused', options, () => {
  const broken = structuredClone(T);
  broken.coverage.unmeasured = broken.coverage.unmeasured.filter((id) => id !== coreFaces()[0]);
  assert.ok(tierEvidenceViolations(D, broken).some((message) => message.startsWith('tier coverage')));
});

test('an invalid core relation cannot silently exempt a weapon from evidence', options, () => {
  const broken = structuredClone(D);
  broken.domains.weapons.refs[coreFaces()[0]].evolvesFromCore = 'missing-core';
  assert.ok(tierEvidenceViolations(broken, T).some((message) => message.startsWith('tier coverage')));
});
