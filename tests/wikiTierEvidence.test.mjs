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

// Exercise the whole source contract before publication, not just the first
// evidence check that happens to throw. Chrome is inert; all data stays real.
import { buildWiki, parseRelicRarityInk } from '../bin/wiki.mjs';
const esc = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const context = (data = D, tiers = T) => ({
  D: data, T: tiers,
  V: JSON.parse(readFileSync(resolve(game, 'data/wiki-visuals.json'), 'utf8')),
  rarityInk: parseRelicRarityInk(readFileSync(resolve(game, 'src/data/relics.ts'), 'utf8')),
  esc, page: ({ body }) => body,
  chrome: { AUTHBAR: '', wikiBrand: '', headSha: 'contract-test', buildStamp: 'contract-test',
    SEARCH_PLACEHOLDER: '', NAV_SCRIPT: '', liveChip: () => '', searchMarkup: () => '',
    wikiNav: () => '', SEARCH_SCRIPT: () => '' },
});

test('all canonical wiki source contracts render, including every core evolution origin', options, () => {
  const wiki = buildWiki(context());
  const weapons = wiki.rosters.find((roster) => roster.domain === 'weapons');
  for (const id of coreFaces()) {
    const html = weapons.card(D.domains.weapons.entries[id]);
    assert.match(html, /Aimed-core evolution/);
    const recipe = Object.values(D.domains.evolutions.entries).find((row) => row.evolvedId === id);
    assert.ok(html.includes(`wiki-cores.html#e-${recipe.baseId}`));
    assert.doesNotMatch(html, /ticks every|ms between shots|Base damage/);
  }
  assert.ok(wiki.pages.length > 0);
});

test('every core evolution still requires its independently owned origin backlink', options, () => {
  for (const id of coreFaces()) {
    const broken = structuredClone(D);
    delete broken.domains.weapons.refs[id].evolvesFromCore;
    assert.throws(() => buildWiki(context(broken)), /Wiki (evidence|source) contract failed/);
  }
});

test('automatic tick weapons still require their actual tick interval', options, () => {
  const broken = structuredClone(D);
  const entry = Object.values(broken.domains.weapons.entries).find((row) => !row.disabled && row.fireRateMs === 0 && !coreFaces().includes(row.id));
  assert.ok(entry);
  delete entry.tickRateMs;
  assert.throws(() => buildWiki(context(broken)), /conditional displayed field tickRateMs/);
});


test('another existing core cannot replace the independently owned origin', options, () => {
  for (const id of coreFaces()) {
    const broken = structuredClone(D);
    const correct = broken.domains.weapons.refs[id].evolvesFromCore;
    broken.domains.weapons.refs[id].evolvesFromCore = Object.keys(broken.domains.coreWeapons.entries).find((key) => key !== correct);
    assert.throws(() => buildWiki(context(broken)), /origin does not match one unique valid evolution recipe/);
  }
});

test('missing, duplicate and unresolved evolution recipes are refused', options, () => {
  const id = coreFaces()[0];
  for (const fault of ['missing', 'duplicate', 'base']) {
    const broken = structuredClone(D);
    const recipes = broken.domains.evolutions.entries;
    const key = Object.keys(recipes).find((key) => recipes[key].evolvedId === id);
    if (fault === 'missing') delete recipes[key];
    if (fault === 'duplicate') recipes.duplicate = structuredClone(recipes[key]);
    if (fault === 'base') recipes[key].baseId = 'missing-core';
    assert.throws(() => buildWiki(context(broken)), /origin does not match one unique valid evolution recipe/);
  }
});


test('tome and evolution recipes link each base to its actual roster', options, () => {
  const wiki = buildWiki(context());
  const tomes = wiki.rosters.find((roster) => roster.domain === 'passives');
  const evolutions = wiki.rosters.find((roster) => roster.domain === 'evolutions');
  for (const recipe of Object.values(D.domains.evolutions.entries)) {
    const isCore = !!D.domains.coreWeapons.entries[recipe.baseId];
    const href = `wiki-${isCore ? 'cores' : 'weapons'}.html#e-${recipe.baseId}`;
    const evolution = evolutions.entries.find((entry) => entry.evolvedId === recipe.evolvedId);
    const tome = tomes.entries.find((entry) => entry.id === recipe.passiveId);
    for (const html of [evolutions.card(evolution), tomes.card(tome)]) {
      assert.ok(html.includes(href), `${recipe.evolvedId} must link ${href}`);
      if (isCore) assert.ok(!html.includes(`wiki-weapons.html#e-${recipe.baseId}"`));
    }
  }
});
