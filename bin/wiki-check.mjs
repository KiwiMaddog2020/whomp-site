#!/usr/bin/env node
/** Fail-closed contract for the generated public wiki.
 *
 * This checks the consumer side of the pipeline after bin/generate.mjs writes a
 * candidate release. The game repo owns artifact freshness; this file proves
 * that every artifact domain, route, card, anchor and search edge actually made
 * it into the site output. It also mutation-checks the model guard so a green
 * contract is known to fail for the drift classes it claims to catch.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, join, relative, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildWiki,
  DISPLAY_CONDITIONAL_FIELD_PATHS,
  DISPLAY_FIELD_PATHS,
  DISPLAY_REF_FIELD_PATHS,
  DISPLAY_ROOT_FIELD_PATHS,
  EXPLAINER_FILE,
  rosterSpecs,
  SEARCH_TYPE,
  visualOutputPath,
} from './wiki.mjs';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const REPO = resolve(arg('--repo', '../whomp'));
const OUTDIR = resolve(arg('--outdir', '.'));
const SITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const clone = (value) => JSON.parse(JSON.stringify(value));
const esc = (value) => String(value).replace(/[&<>"]/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
}[char]));
const num = (value, places = 2) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return '?';
  if (Number.isInteger(number)) return String(number);
  const rounded = Number(number.toFixed(places));
  return String(rounded === 0 ? Number(number.toPrecision(1)) : rounded);
};
const pct = (value) => `${value >= 0 ? '+' : ''}${num(value * 100, 1)}%`;
const mmss = (seconds) => {
  const value = Math.max(0, Math.round(Number(seconds) || 0));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
};
const fail = (message) => { throw new Error(`WIKI CONTRACT: ${message}`); };
const requireThat = (condition, message) => { if (!condition) fail(message); };
const safeGeneratedPath = (path) => typeof path === 'string' && path.length > 0
  && path.split('/').every((part) => /^[a-z0-9][a-z0-9._-]*$/.test(part) && part !== '.' && part !== '..');
const portable = (path) => path.split(sep).join('/');
const walkFiles = (root, current = root) => {
  if (!existsSync(current)) return [];
  const files = [];
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    const path = join(current, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(root, path));
    else if (entry.isFile()) files.push(portable(relative(OUTDIR, path)));
  }
  return files.sort();
};
const sha256Bytes = (bytes) => createHash('sha256').update(bytes).digest('hex');
const pngDimensions = (bytes, label) => {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  requireThat(bytes.length >= 24 && bytes.subarray(0, 8).equals(signature)
    && bytes.subarray(12, 16).toString('ascii') === 'IHDR', `${label} is not a PNG envelope`);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
};

const D = readJson(join(REPO, 'data/game-data.json'));
const T = readJson(join(REPO, 'data/tier-rankings.json'));
const V = readJson(join(REPO, 'data/wiki-visuals.json'));
const generatorSource = readFileSync(join(SITE_ROOT, 'bin/generate.mjs'), 'utf8');
const generatedOutputGitSource = readFileSync(join(SITE_ROOT, 'bin/generated-output-git.mjs'), 'utf8');
const liveVersionSource = readFileSync(join(SITE_ROOT, 'bin/live-version.mjs'), 'utf8');
requireThat(/verifyGameArtifact\('wiki-visuals\.mjs', '--verify', 'data\/wiki-visuals\.json'\)/.test(generatorSource),
  'site generator does not require the full visual rerender verification gate');
requireThat(/const ENTRY_HASH_PATTERN = \/\^#e-\[A-Za-z0-9\._-\]\+\$\//.test(generatorSource)
  && /window\.addEventListener\('hashchange', focusSearchEntryHash\)/.test(generatorSource)
  && /queueMicrotask\(focusSearchEntryHash\)/.test(generatorSource)
  && /target\?\.matches\('\[id\^="e-"\]\[tabindex="-1"\]'\)/.test(generatorSource)
  && /target\.focus\(\{ preventScroll: true \}\)/.test(generatorSource),
'search focus does not restrict load/hashchange focus to valid programmatically focusable #e-* entry targets');
requireThat(/destination\.pathname === location\.pathname && destination\.search === location\.search/.test(generatorSource),
  'same-page search reveal/focus does not prove that the destination is the current document');
requireThat(/live = normalizeSuppliedLiveVersion\(SHA_ARG, VERSION_ARG \|\| pkg\.version\);/.test(generatorSource)
  && /live = await fetchStableLiveVersion\(`\$\{LIVE_URL\}\/version\.json`\);/.test(generatorSource)
  && /if \(payload\.schema !== 1\) fail\('schema must be 1'\);/.test(liveVersionSource)
  && /sha: payload\.sourceSha\.slice\(0, 8\)/.test(liveVersionSource)
  && /version,\s*builtAt: payload\.publishedAt/.test(liveVersionSource)
  && /if \(!response\.ok\) return null;/.test(liveVersionSource)
  && /fail\('HTTP 200 body is not valid JSON'/.test(liveVersionSource)
  && /timer = setTimeout\(\(\) => \{\s*controller\.abort\(\);\s*resolve\(timedOut\);/.test(liveVersionSource)
  && /await Promise\.race\(\[request, deadline\]\)/.test(liveVersionSource)
  && /finally \{\s*clearTimeout\(timer\);/.test(liveVersionSource),
'generator does not distinguish unreachable Stable metadata from a malformed HTTP-200 release contract');
requireThat(/const trackedGeneratedFiles = listTrackedGeneratedFiles\(OUTDIR\);/.test(generatorSource)
  && /if \(!gitWorktreeRoot\(root\)\) return \[\];/.test(generatedOutputGitSource)
  && /'git', \['-C', root, 'ls-files', '--', 'wiki\*\.html', 'wiki-assets'\]/.test(generatedOutputGitSource)
  && /stdio: \['ignore', 'pipe', 'pipe'\]/.test(generatedOutputGitSource)
  && /catch \(cause\) \{\s*throw new Error\(`Unable to enumerate tracked generated outputs in Git worktree/.test(generatedOutputGitSource)
  && /trackedRetiredWikiFiles = trackedGeneratedWikiFiles\.filter/.test(generatorSource)
  && /trackedRetiredVisualFiles = trackedGeneratedVisualFiles\.filter/.test(generatorSource),
'generator/helper do not safely enumerate missing tracked routes/assets when building the retirement staging manifest');
const declaredRosters = rosterSpecs(D, esc, T, V);
const chrome = {
  AUTHBAR: '',
  wordmark: () => '',
  liveChip: () => '',
  searchMarkup: () => '<input role="combobox">',
  SEARCH_SCRIPT: () => '',
  SEARCH_PLACEHOLDER: '',
  wikiBrand: '',
  wikiNav: () => '',
  NAV_SCRIPT: '',
  headSha: 'contract',
  buildStamp: 'contract',
};

// Positive model check. buildWiki validates before rendering and returns the
// same route declaration the real generator consumes.
const model = buildWiki({ D, T, V, esc, chrome, page: ({ body }) => body });
const rosters = model.rosters;
// The hub and the build explainer are the two non-roster routes.
requireThat(model.pages.length === rosters.length + 2, `model emitted ${model.pages.length} pages for ${rosters.length} guides`);
requireThat(model.pages.some((page) => page.file === EXPLAINER_FILE), `the wiki emits no ${EXPLAINER_FILE} build explainer`);
const coreRosterCopy = rosters.find((roster) => roster.domain === 'coreWeapons');
const enemyRosterCopy = rosters.find((roster) => roster.domain === 'enemies');
requireThat(coreRosterCopy?.lede.includes('locks in that aimed-weapon slot') && !/only decision that shapes a whole run/i.test(coreRosterCopy.lede),
  'core guide overstates the aimed-weapon choice as the only pre-run decision');
// The tagline must promise a complete roster AND must not describe the roster as
// things that come and touch you: snipers, bombers, strafers and spitters keep
// their distance deliberately. The wording moved; both halves of the guard did
// not. The forbidden phrase is the exact wrong claim this page carried before,
// so it stays forbidden whatever the true sentence sounds like.
requireThat(enemyRosterCopy?.tagline === 'Every kind in the game. Several of them never come near you.'
  && !/everything that wants to touch you/i.test(enemyRosterCopy.tagline),
  'bestiary tagline misclassifies ranged or kiting enemies as contact threats');
requireThat(
  JSON.stringify(rosters.map((roster) => roster.slug)) === JSON.stringify(declaredRosters.map((roster) => roster.slug)),
  'buildWiki route declarations differ from rosterSpecs',
);

const expectedSourceEntries = D.domainOrder.reduce((sum, domain) => sum + D.domains[domain].count, 0);
requireThat(D.coverage.domains === D.domainOrder.length, `artifact covers ${D.coverage.domains} domains but declares ${D.domainOrder.length}`);
requireThat(D.coverage.entries === expectedSourceEntries, `artifact covers ${D.coverage.entries} entries but its domain counts total ${expectedSourceEntries}`);

const expectedCards = rosters.reduce((sum, roster) => sum + roster.entries.length, 0);
// One entry per landable route (the hub and the explainer), one per guide, one per card.
const expectedModelSearchEntries = 2 + rosters.length + expectedCards;
requireThat(
  model.searchEntries.length === expectedModelSearchEntries,
  `model emitted ${model.searchEntries.length} search entries, expected ${expectedModelSearchEntries} from its routes and cards`,
);
for (const roster of rosters.filter((candidate) => candidate.domain)) {
  const expectedType = SEARCH_TYPE[roster.domain];
  const entries = model.searchEntries.filter((entry) => entry.href.startsWith(`wiki-${roster.slug}.html#e-`));
  requireThat(entries.length === roster.entries.length, `${roster.slug} search type check does not cover every card`);
  requireThat(entries.every((entry) => entry.type === expectedType), `${roster.slug} leaks a raw artifact domain instead of search type ${expectedType}`);
}

// These are the schema-expanded catalogs this release is integrating. Their
// counts stay artifact-derived: this list identifies contracts, never copies a
// source magnitude from the game repo.
const EXPANDED_DOMAINS = ['quests', 'shop', 'worldEvents', 'ambientEvents', 'shipSystems'];
const expandedRosters = [];
for (const domain of EXPANDED_DOMAINS) {
  requireThat(D.domainOrder.includes(domain) && D.domains[domain], `expanded source domain ${domain} is missing`);
  const roster = rosters.find((candidate) => candidate.domain === domain);
  requireThat(roster, `expanded source domain ${domain} has no model roster`);
  expandedRosters.push(roster);
}
const expectedExpandedCards = EXPANDED_DOMAINS.reduce((sum, domain) => sum + D.domains[domain].count, 0);
const actualExpandedCards = expandedRosters.reduce((sum, roster) => sum + roster.entries.length, 0);
requireThat(actualExpandedCards === expectedExpandedCards, `expanded routes emit ${actualExpandedCards} cards for ${expectedExpandedCards} source entries`);
const expandedFiles = new Set(expandedRosters.map((roster) => `wiki-${roster.slug}.html`));
const expandedModelSearchEntries = model.searchEntries.filter((entry) => expandedFiles.has(entry.href.split('#')[0]));
requireThat(
  expandedModelSearchEntries.length === expandedRosters.length + expectedExpandedCards,
  `expanded routes emit ${expandedModelSearchEntries.length} search entries, expected ${expandedRosters.length + expectedExpandedCards}`,
);

// These catalogs include the old hub's explicit "Not built yet" list plus the
// schema-9 Shrine movement domain.
// Keep their ids as a release contract, but never copy their magnitudes here:
// every count below remains derived from the freshly verified game artifact.
const FORMERLY_DEFERRED_DOMAINS = [
  'relics', 'characters', 'innates', 'signatures', 'levels', 'expeditions', 'runModes',
  'shipCores', 'shipFragments', 'legendaries', 'passives', 'ultimates', 'evolutions',
  'shrineBlessings', 'utilities', 'wearables', 'achievements', 'cosmetics', 'jumpAugments',
  'shrineMovement',
];
const formerlyDeferredRosters = [];
for (const domain of FORMERLY_DEFERRED_DOMAINS) {
  requireThat(D.domainOrder.includes(domain) && D.domains[domain], `formerly deferred source domain ${domain} is missing`);
  const roster = rosters.find((candidate) => candidate.domain === domain);
  requireThat(roster, `formerly deferred source domain ${domain} has no generated route`);
  requireThat(roster.entries.length === D.domains[domain].count, `formerly deferred route ${domain} renders ${roster.entries.length} of ${D.domains[domain].count} source entries`);
  formerlyDeferredRosters.push(roster);
}

// Mutation verification. A guard that has never failed on purpose is not known
// to work, so each major completeness promise is broken in a copy and named.
function expectModelFailure(label, mutate, pattern) {
  const d = clone(D);
  const t = clone(T);
  const v = clone(V);
  mutate(d, t, v);
  let error = null;
  try {
    buildWiki({ D: d, T: t, V: v, esc, chrome, page: ({ body }) => body });
  } catch (caught) {
    error = caught;
  }
  requireThat(error, `mutation "${label}" did not fail`);
  requireThat(pattern.test(String(error.message)), `mutation "${label}" failed without naming the contract: ${error.message}`);
}

expectModelFailure('unclassified public domain', (d) => {
  d.domainOrder.push('__contractProbe');
  d.domains.__contractProbe = { source: 'probe', count: 1, order: ['probe'], entries: { probe: { id: 'probe', name: 'Probe' } }, refs: {}, notes: {} };
  d.coverage.domains += 1;
  d.coverage.entries += 1;
}, /__contractProbe has no declared wiki route/);

expectModelFailure('unknown group classification', (d) => {
  const id = d.domains.relics.order[0];
  d.domains.relics.entries[id].rarity = '__contractProbe';
}, /group classification|__contractProbe/);

expectModelFailure('expanded public domain disappears', (d) => {
  // Leave the table present but remove it from the canonical public order. A
  // model that silently keeps rendering this dangling domain is also stale.
  d.domainOrder = d.domainOrder.filter((domain) => domain !== 'shipSystems');
  d.coverage.domains = d.domainOrder.length;
  d.coverage.entries -= d.domains.shipSystems.count;
}, /shipSystems|undeclared domain|public domain/);

expectModelFailure('declared domain count diverges', (d) => { d.domains.relics.count += 1; }, /relics declares/);
expectModelFailure('tier coverage loses a weapon', (_d, t) => { t.coverage.measured -= 1; }, /tier coverage/);
expectModelFailure('volatile row loses its span', (_d, t) => {
  const row = t.weapons.find((entry) => Object.values(entry.axes).some((axis) => axis.volatile));
  const axis = Object.values(row.axes).find((entry) => entry.volatile);
  delete axis.tierAtP10;
}, /volatile tier row/);
expectModelFailure('competition rank uses an id tiebreak', (_d, t) => {
  const reading = t.weapons[0].axes[t.metric.axes[0].key];
  reading.rankInCohort += 1;
}, /competition ranks|tie percentiles/);
expectModelFailure('measurement axis loses its player-facing job', (_d, t) => {
  delete t.metric.axes[0].job;
}, /metric axes|jobs/);
expectModelFailure('enemy speed profile loses a field', (d) => {
  const id = d.domains.enemies.order[0];
  delete d.domains.enemies.refs[id].speedProfile.liveRunBaseMps;
}, /speed profile/);
expectModelFailure('core forgiveness profile loses a field', (d) => {
  const id = d.domains.coreWeapons.selectOrder[0];
  delete d.domains.coreWeapons.refs[id].forgiveness.minQuality;
}, /nine-field aim and forgiveness profile/);
expectModelFailure('core selection order loses an id', (d) => {
  d.domains.coreWeapons.selectOrder.pop();
}, /selectOrder/);
expectModelFailure('aim policy loses an assist scale', (d) => {
  delete d.domains.coreWeapons.aimPolicy.assistScale.light;
}, /aimPolicy/);
expectModelFailure('power ceiling loses a dial', (d) => {
  delete d.powerCeiling.config.critFactor;
}, /powerCeiling|four-dial/);
expectModelFailure('power ceiling dial becomes non-numeric', (d) => {
  d.powerCeiling.config.critFactor = '0.45';
}, /powerCeiling|four-dial/);

expectModelFailure('ultimate owner drifts to boss', (d) => {
  d.domains.ultimates.runtime.owner = 'boss';
}, /ultimate runtime|player-owned/);
expectModelFailure('ultimate availability loses run-start arming', (d) => {
  d.domains.ultimates.runtime.availability.fromRunStart = false;
}, /ultimate runtime|scoped player-owned/);
expectModelFailure('ultimate availability loses standard-player scope', (d) => {
  delete d.domains.ultimates.runtime.availability.scope;
}, /ultimate runtime|scoped player-owned/);
expectModelFailure('ultimate provenance loses runtime ownership source', (d) => {
  delete d.domains.ultimates.runtime.provenance.ownershipAndSlot;
}, /ultimate runtime|player-owned/);
expectModelFailure('ultimate preview semantics disappear', (d) => {
  d.domains.ultimates.runtime.semantics = d.domains.ultimates.runtime.semantics
    .map((line) => line.replace(/hub/gi, 'lobby').replace(/preview/gi, 'showcase'));
}, /ultimate runtime|preview/);

expectModelFailure('visual schema moves', (_d, _t, v) => { v.schema += 1; }, /wiki-visuals\.json schema/);
expectModelFailure('visual source fingerprint disappears', (_d, _t, v) => { delete v.sourceFingerprint; }, /visual manifest source fingerprint/);
expectModelFailure('visual renderer loses transparent capture', (_d, _t, v) => { v.renderer.clearAlpha = 1; }, /visual renderer|transparent deterministic/);
expectModelFailure('visual content fingerprint drifts', (_d, _t, v) => { v.contentFingerprint = '0'.repeat(64); }, /contentFingerprint/);
expectModelFailure('visual association disappears', (_d, _t, v) => { v.entries.pop(); }, /visual entry coverage|canonical associations/);
expectModelFailure('visual path traverses output root', (_d, _t, v) => {
  v.entries[0].variants[0].path = 'data/wiki-visuals/../probe.png';
}, /unsafe visual asset path/);
expectModelFailure('visual variant path is duplicated', (_d, _t, v) => {
  v.entries[1].variants[0].path = v.entries[0].variants[0].path;
}, /duplicate path/);
expectModelFailure('visual dimensions disappear', (_d, _t, v) => { delete v.entries[0].variants[0].width; }, /invalid dimensions/);
expectModelFailure('visual alt semantics disappear', (_d, _t, v) => { v.entries[0].alt.text = ''; }, /visual entry .* alt/);
expectModelFailure('runtime visual loses neutral camera context', (_d, _t, v) => {
  const entry = v.entries.find((candidate) => candidate.kind === 'runtime-render');
  entry.renderContext.camera.verticalFovDeg = 35;
}, /isolated runtime render context/);
expectModelFailure('trailing wearable loses its rear camera', (d, _t, v) => {
  const id = d.domains.wearables.order.find((entryId) => d.domains.wearables.entries[entryId].trails === true);
  const entry = v.entries.find((candidate) => candidate.domain === 'wearables' && candidate.id === id);
  entry.renderContext.camera.view = 'front';
}, /isolated runtime render context|rear camera for a trailing wearable/);
expectModelFailure('trailing wearable loses rear alt semantics', (d, _t, v) => {
  const id = d.domains.wearables.order.find((entryId) => d.domains.wearables.entries[entryId].trails === true);
  const entry = v.entries.find((candidate) => candidate.domain === 'wearables' && candidate.id === id);
  entry.alt.text = entry.alt.text.replace(/\brear\b/ig, 'canonical');
}, /rear camera for a trailing wearable/);
expectModelFailure('cosmetic palette loses its limitation', (_d, _t, v) => {
  const entry = v.entries.find((candidate) => candidate.domain === 'cosmetics');
  delete entry.limitation;
}, /cosmetic palette limitation/);

const deletePath = (object, path) => {
  const parts = path.split('.');
  const last = parts.pop();
  let cursor = object;
  for (const part of parts) cursor = cursor[part];
  delete cursor[last];
};
requireThat(Object.keys(DISPLAY_FIELD_PATHS).sort().join('|') === [...D.domainOrder].sort().join('|'),
  'displayed entry-field contracts do not exactly cover the public domain order');
requireThat(DISPLAY_ROOT_FIELD_PATHS.length > 0 && Object.keys(DISPLAY_REF_FIELD_PATHS).length > 0
  && Object.keys(DISPLAY_CONDITIONAL_FIELD_PATHS).length > 0,
'displayed root, relation and conditional contracts must all be active');

expectModelFailure('displayed weapon scalar disappears', (d) => {
  delete d.domains.weapons.entries.energyBolt.baseDamage;
}, /renderable displayed field baseDamage/);
expectModelFailure('displayed run-mode scalar disappears', (d) => {
  delete d.domains.runModes.entries[d.domains.runModes.order[0]].openingHpBonusPct;
}, /renderable displayed field openingHpBonusPct/);
expectModelFailure('displayed Aegis conditional scalar disappears', (d) => {
  delete d.domains.passives.entries.aegisTome.shieldRegenPerLevel;
}, /conditional displayed field shieldRegenPerLevel/);
expectModelFailure('displayed Shrine stack ceiling disappears', (d) => {
  const id = d.domains.shrineMovement.order.find((entryId) => entryId !== 'extraJump');
  delete d.domains.shrineMovement.entries[id].maxStacks;
}, /conditional displayed field maxStacks/);
expectModelFailure('displayed enemy conditional health disappears', (d) => {
  const id = d.domains.enemies.order.find((entryId) => ['basic', 'special'].includes(d.domains.enemies.entries[entryId].tier));
  delete d.domains.enemies.entries[id].hp;
}, /conditional displayed field hp/);
expectModelFailure('weapon quest backlink disappears', (d) => {
  delete d.domains.weapons.refs.blackSquirrel.unlockedByQuests;
}, /displayed ref field unlockedByQuests|acquisition backlinks/);
expectModelFailure('weapon achievement backlink disappears', (d) => {
  delete d.domains.weapons.refs.blackSquirrel.unlockedByAchievements;
}, /displayed ref field unlockedByAchievements|acquisition backlinks/);
expectModelFailure('Aegis runtime relation disappears', (d) => {
  delete d.domains.passives.refs.aegisTome.runtimeUnlock;
}, /displayed ref field runtimeUnlock|Aegis Tome/);
expectModelFailure('legacy jump alias relation disappears', (d) => {
  const id = d.domains.jumpAugments.order[0];
  delete d.domains.jumpAugments.refs[id].shrineMovementOffering;
}, /displayed ref field shrineMovementOffering|legacy jump augment aliases/);
expectModelFailure('character suggested-weapon relation disappears', (d) => {
  const id = d.domains.characters.order[0];
  delete d.domains.characters.refs[id].suggestedWeapon;
}, /displayed ref field suggestedWeapon|suggested-weapon relation/);
expectModelFailure('weapon suggested-by backlink disappears', (d) => {
  const id = d.domains.weapons.order.find((weaponId) => d.domains.weapons.refs[weaponId]?.suggestedByCharacters?.length);
  delete d.domains.weapons.refs[id].suggestedByCharacters;
}, /displayed ref field suggestedByCharacters|character-suggestion relations/);
expectModelFailure('character runtime speed reference disappears', (d) => {
  deletePath(d, 'domains.characters.runtime.baseStats.speed.reference');
}, /displayed root field|character runtime/);
expectModelFailure('character base-stat provenance anchor disappears', (d) => {
  delete d.domains.characters.runtime.baseStats.speed.provenance.movementSink;
}, /character runtime|provenance/);
expectModelFailure('character weapon provenance anchor disappears', (d) => {
  delete d.domains.characters.runtime.weaponIdentity.provenance.coopConsumer;
}, /character weapon identity|provenance/);
expectModelFailure('encounter reservation semantics disappear', (d) => {
  d.world.encounterSchedule.semantics = d.world.encounterSchedule.semantics.map((line) => line.replace(/reserv\w*/gi, 'scheduled').replace(/no auto(?:matic)?/gi, 'cadence'));
}, /encounterSchedule|reservation/);

expectModelFailure('tier source fingerprint disappears', (_d, t) => {
  delete t.sourceContract.files[0].sha256;
}, /sourceContract|file fingerprints/);
expectModelFailure('controlled fixture enables runtime behavior', (_d, t) => {
  t.fixtureContract.boss.runtimeBehavior = true;
}, /fixture|runtimeBehavior/);
expectModelFailure('worker count becomes measurement evidence', (_d, t) => {
  t.executionContract.executionOnly = false;
}, /executionContract|execution-only/);
expectModelFailure('greedy selection bias loses holdout disclosure', (_d, t) => {
  t.limits = t.limits.map((line) => line.replace(/same(?:[- ]| deterministic seed )cohort/gi, 'selection cohort').replace(/holdout/gi, 'secondary'));
}, /same-cohort greedy selection bias|holdout/);
expectModelFailure('pair sample seed count drifts', (_d, t) => {
  t.sample.builds.seedList.pop();
}, /pair\/build sample|deterministic seeds/);
expectModelFailure('build sample accounting drifts', (_d, t) => {
  t.sample.builds.totalCandidateLoadouts += 1;
}, /sample accounting|candidate loadouts/);
expectModelFailure('measured pair is duplicated', (_d, t) => {
  t.measuredBuilds.pairs[1].ids = [...t.measuredBuilds.pairs[0].ids];
}, /measured pair|duplicated/);
expectModelFailure('pair loses weapon attribution', (_d, t) => {
  const pair = t.measuredBuilds.pairs[0];
  delete pair.axes[t.metric.axes[0].key].byWeapon[pair.ids[0]];
}, /pair .*attribution|per-weapon attribution/);
expectModelFailure('pair attribution fails open', (_d, t) => {
  const pair = t.measuredBuilds.pairs[0];
  pair.axes[t.metric.axes[0].key].unattributed.max = 1;
}, /unattributed controlled-sink damage/);
expectModelFailure('build duplicates an equipped weapon', (_d, t) => {
  const build = t.measuredBuilds.builds[0];
  build.ids[1] = build.ids[0];
}, /build.*legal loadout|violates/);
expectModelFailure('build chain no longer starts from a top solo', (_d, t) => {
  const build = t.measuredBuilds.builds[0];
  build.seededFrom = [t.loadoutContract.eligibleIds.find((id) => id !== build.seededFrom[0])];
}, /top-solo starts|build chains/);
expectModelFailure('build step loses its measured marginal', (_d, t) => {
  const step = t.measuredBuilds.builds[0].steps.find((candidate) => candidate.marginal);
  delete step.marginal.p10;
}, /marginal|distribution/);

// Source text is untrusted at the rendering boundary even though the artifact
// itself is generated in-repo. Keep a mutation pin here so a future refactor
// cannot turn an authored registry string into executable wiki markup.
const injectionData = clone(D);
const injectionId = injectionData.domains.weapons.order[0];
const injectionProbe = '\"><img src=x onerror="contractProbe()">';
injectionData.domains.weapons.entries[injectionId].name = injectionProbe;
injectionData.domains.weapons.entries[injectionId].desc = injectionProbe;
const injectionModel = buildWiki({ D: injectionData, T, V, esc, chrome, page: ({ body }) => body });
const injectionHtml = injectionModel.pages.find((page) => page.file === 'wiki-weapons.html')?.html || '';
requireThat(!injectionHtml.includes(injectionProbe), 'source text reaches generated wiki markup without escaping');
requireThat(injectionHtml.includes(esc(injectionProbe)), 'escaped source-text mutation is missing from its generated card');

// A source roster can grow without a schema bump. Prove visible magnitudes
// follow that growth instead of leaving a stale English number in page copy.
const countData = clone(D);
const countDomain = countData.domains.achievements;
const countSeed = countDomain.entries[countDomain.order[0]];
const countProbeId = '__countProbe';
countDomain.entries[countProbeId] = { ...clone(countSeed), id: countProbeId, name: 'Count probe', unlocks: {} };
countDomain.order.push(countProbeId);
countDomain.count += 1;
countData.coverage.entries += 1;
const countModel = buildWiki({ D: countData, T, V, esc, chrome, page: ({ body }) => body });
const countHtml = countModel.pages.find((page) => page.file === 'wiki-achievements.html')?.html || '';
requireThat(countHtml.includes(`${countDomain.count} entries`), 'displayed achievement count does not follow the canonical roster');
requireThat(countHtml.includes(`id="e-${countProbeId}"`), 'expanded achievement roster does not emit its source-id anchor');

const manifestPath = join(OUTDIR, '.site-outputs');
requireThat(existsSync(manifestPath), `${manifestPath} is missing`);
const manifest = readFileSync(manifestPath, 'utf8').trim().split('\n').filter(Boolean);
requireThat(new Set(manifest).size === manifest.length, 'output manifest contains duplicate filenames');
requireThat(manifest.every(safeGeneratedPath), 'output manifest contains an unsafe relative path');
const expectedWikiFiles = new Set(model.pages.map((page) => page.file));
requireThat(expectedWikiFiles.size === model.pages.length, 'model emits duplicate wiki filenames');
const expectedVisualFiles = new Set(V.entries.flatMap((entry) => entry.variants.map((variant) => visualOutputPath(variant.path))));
requireThat(expectedVisualFiles.size === V.coverage.variants, `visual output paths cover ${expectedVisualFiles.size} variants, artifact declares ${V.coverage.variants}`);
const retiredManifestFiles = manifest.filter((file) => !existsSync(join(OUTDIR, file)));
for (const file of retiredManifestFiles) {
  const retiredWiki = /^wiki.*\.html$/.test(file) && !expectedWikiFiles.has(file);
  const retiredVisual = /^wiki-assets\/(?:[a-z0-9][a-z0-9._-]*\/)*[a-z0-9][a-z0-9._-]*\.png$/.test(file)
    && !expectedVisualFiles.has(file);
  requireThat(retiredWiki || retiredVisual, `manifest output ${file} is missing without being a retired generated route or visual`);
}
const actualWikiFiles = new Set(manifest.filter((file) => existsSync(join(OUTDIR, file)) && file.startsWith('wiki') && file.endsWith('.html')));
requireThat(
  JSON.stringify([...actualWikiFiles].sort()) === JSON.stringify([...expectedWikiFiles].sort()),
  `wiki routes differ from the manifest; expected ${[...expectedWikiFiles].sort().join(', ')}, got ${[...actualWikiFiles].sort().join(', ')}`,
);

const diskWikiFiles = new Set(readdirSync(OUTDIR, { withFileTypes: true })
  .filter((entry) => entry.isFile() && /^wiki.*\.html$/.test(entry.name))
  .map((entry) => entry.name));
const staleWikiFiles = [...diskWikiFiles].filter((file) => !actualWikiFiles.has(file)).sort();
requireThat(staleWikiFiles.length === 0, `stale on-disk wiki routes are absent from the output manifest: ${staleWikiFiles.join(', ')}`);
const missingDiskWikiFiles = [...actualWikiFiles].filter((file) => !diskWikiFiles.has(file)).sort();
requireThat(missingDiskWikiFiles.length === 0, `manifest wiki routes are absent on disk: ${missingDiskWikiFiles.join(', ')}`);

const actualVisualFiles = new Set(manifest.filter((file) => existsSync(join(OUTDIR, file)) && file.startsWith('wiki-assets/')));
requireThat(
  JSON.stringify([...actualVisualFiles].sort()) === JSON.stringify([...expectedVisualFiles].sort()),
  `visual outputs differ from the manifest artifact; expected ${expectedVisualFiles.size}, got ${actualVisualFiles.size}`,
);
const diskVisualFiles = new Set(walkFiles(join(OUTDIR, 'wiki-assets')));
requireThat(
  JSON.stringify([...diskVisualFiles].sort()) === JSON.stringify([...expectedVisualFiles].sort()),
  `wiki-assets contains missing or orphaned generated files`,
);
for (const entry of V.entries) {
  for (const variant of entry.variants) {
    const output = visualOutputPath(variant.path);
    const outputBytes = readFileSync(join(OUTDIR, ...output.split('/')));
    const sourceBytes = readFileSync(join(REPO, ...variant.path.split('/')));
    const dimensions = pngDimensions(outputBytes, output);
    requireThat(outputBytes.equals(sourceBytes), `${output} differs byte-for-byte from its canonical generated game asset`);
    requireThat(outputBytes.length === variant.byteSize && sha256Bytes(outputBytes) === variant.sha256,
      `${output} differs from its manifest byte size or SHA-256`);
    requireThat(dimensions.width === variant.width && dimensions.height === variant.height,
      `${output} differs from its manifest intrinsic dimensions`);
  }
}

const search = readJson(join(OUTDIR, 'search-index.json'));
const hrefCounts = new Map();
for (const entry of search) hrefCounts.set(entry.href, (hrefCounts.get(entry.href) || 0) + 1);
requireThat(hrefCounts.get('wiki.html') === 1, 'wiki hub needs exactly one search entry');

const wikiSearchEntries = search.filter((entry) => expectedWikiFiles.has(entry.href.split('#')[0]));
requireThat(
  wikiSearchEntries.length === model.searchEntries.length,
  `output has ${wikiSearchEntries.length} wiki search entries, model emits ${model.searchEntries.length}`,
);
const searchSignature = (entry) => JSON.stringify([entry.href, entry.anchor, entry.type, entry.title, entry.text]);
requireThat(
  JSON.stringify(wikiSearchEntries.map(searchSignature).sort()) === JSON.stringify(model.searchEntries.map(searchSignature).sort()),
  'output wiki search entries differ from the generated model',
);

const hub = readFileSync(join(OUTDIR, 'wiki.html'), 'utf8');
const iconSourcePath = join(REPO, 'public/icons/icon.svg');
const iconOutputPath = join(OUTDIR, 'whomp-icon.svg');
requireThat(existsSync(iconSourcePath) && existsSync(iconOutputPath), 'canonical WHOMP desktop icon is absent from the source or generated output');
requireThat(readFileSync(iconOutputPath, 'utf8') === readFileSync(iconSourcePath, 'utf8'), 'generated WHOMP icon differs from the canonical desktop asset');

function requireWikiIconContract(html, file) {
  requireThat((html.match(/class="wiki-home"/g) || []).length === 1, `${file} does not emit exactly one leading wiki-home link`);
  requireThat(/<a class="wiki-home" href="wiki\.html" aria-label="WHOMP wiki home">/.test(html), `${file} wiki icon is not an accessible hub link`);
  requireThat((html.match(/<img class="wiki-home-icon" src="whomp-icon\.svg" alt="" width="46" height="46">/g) || []).length === 1, `${file} does not use exactly one canonical wiki navigation icon`);
  requireThat(!/<svg class="wm"/.test(html), `${file} duplicates the WHOMP mark in page-header content`);
}
function requireSkipTarget(html, file) {
  const targets = [...html.matchAll(/<a class="skip-link" href="#([^"]+)">/g)].map((match) => match[1]);
  requireThat(targets.length === 1, `${file} must emit exactly one skip link`);
  for (const target of targets) requireThat(new RegExp(`\\sid="${target}"`).test(html), `${file} skip link points at missing #${target}`);
}
requireWikiIconContract(hub, 'wiki.html');
requireSkipTarget(hub, 'wiki.html');
requireThat(/(?:current wiki source|different from wiki source|offline provenance)/.test(hub), 'wiki live-build state is conveyed only by color');
const entryCountLabel = (count) => `${count} ${count === 1 ? 'entry' : 'entries'}`;
const hubCards = [...hub.matchAll(/<a\s+class="whubcard"\s+href="([^"]+)">([\s\S]*?)<\/a>/g)]
  .map((match) => ({ href: match[1], body: match[2] }));
requireThat(hubCards.length === rosters.length, `wiki hub emits ${hubCards.length} cards for ${rosters.length} rosters`);

const visualByKey = new Map(V.entries.map((entry) => [entry.assetKey, entry]));
const visualPolicyDomains = new Set(V.policies.map((policy) => policy.domain));
const renderedVisualAssociations = new Map();
const cardSlice = (html, id) => {
  const start = html.indexOf(`id="e-${esc(id)}"`);
  if (start < 0) return '';
  const articleStart = html.lastIndexOf('<article', start);
  const end = html.indexOf('</article>', start);
  return articleStart >= 0 && end >= 0 ? html.slice(articleStart, end + '</article>'.length) : '';
};

let renderedCards = 0;
for (const roster of rosters) {
  const file = `wiki-${roster.slug}.html`;
  const matchingHubCards = hubCards.filter((card) => card.href === file);
  requireThat(matchingHubCards.length === 1, `wiki hub does not link exactly one card to ${file}`);
  const hubCard = matchingHubCards[0];
  const hubCount = esc(roster.countLabel || entryCountLabel(roster.entries.length));
  requireThat(hubCard.body.includes(`<h3>${esc(roster.title)}</h3>`), `${file} hub card does not carry the model title ${roster.title}`);
  requireThat(hubCard.body.includes(`<span class="n">${hubCount}</span>`), `${file} hub card does not carry the model count ${hubCount}`);
  requireThat(expectedWikiFiles.has(file) && existsSync(join(OUTDIR, file)), `${file} hub card points at no generated route`);
  requireThat(hrefCounts.get(file) === 1, `${file} does not have exactly one route-level search entry`);

  const html = readFileSync(join(OUTDIR, file), 'utf8');
  requireWikiIconContract(html, file);
  requireSkipTarget(html, file);
  requireThat(!/(?:undefined|NaN|\[object Object\])/.test(html), `${file} contains an unrenderable JavaScript value`);
  requireThat(!/Not built yet/i.test(html), `${file} still carries the retired deferred-section copy`);
  requireThat(/class="wprov"/.test(html), `${file} has no provenance block`);
  requireThat(/aria-live="polite"/.test(html), `${file} has no live result count`);
  requireThat(/role="combobox"/.test(html), `${file} search is not an accessible combobox`);
  requireThat(/aria-current="page"/.test(html), `${file} navigation does not identify the current page`);
  requireThat(/<nav class="wbreadcrumb" aria-label="Breadcrumb">/.test(html), `${file} has no accessible breadcrumb`);
  requireThat(/<main class="wmain" id="wiki-main" tabindex="-1">/.test(html), `${file} skip target is not programmatically focusable`);
  requireThat(html.indexOf('sortCards();') >= 0 && html.indexOf('sortCards();') < html.lastIndexOf('apply();'), `${file} does not apply its declared default sort before initial filtering`);
  const visualImages = [...html.matchAll(/<img\b[^>]*\bdata-pixelated="false"[^>]*>/g)].map((match) => match[0]);
  if (visualImages.length) {
    requireThat(visualImages.filter((image) => /\bloading="eager"/.test(image)).length === 1,
      `${file} must eagerly load exactly one primary visual`);
    requireThat(visualImages.filter((image) => /\bfetchpriority="high"/.test(image)).length === 1,
      `${file} must assign high fetch priority only to its primary visual`);
    requireThat(visualImages.slice(1).every((image) => /\bloading="lazy"/.test(image)),
      `${file} must lazy-load every visual after the primary`);
    requireThat(visualImages.every((image) => /\bdecoding="async"/.test(image)
      && /\bwidth="[1-9][0-9]*"/.test(image) && /\bheight="[1-9][0-9]*"/.test(image)),
    `${file} has a visual without async decoding or explicit intrinsic dimensions`);
  }
  for (const group of html.matchAll(/role="group" aria-labelledby="([^"]+)"/g)) {
    requireThat(new RegExp(`\\sid="${group[1]}"`).test(html), `${file} facet group references missing label #${group[1]}`);
  }

  const navigation = html.match(/<nav class="wside"[^>]*>([\s\S]*?)<\/nav>/)?.[1] || '';
  requireThat(/class="wside-section"/.test(navigation), `${file} has no categorized wiki navigation`);
  requireThat(/class="wside-section is-current-section"/.test(navigation), `${file} does not identify its current mobile navigation section`);
  for (const target of rosters) {
    const targetHref = `wiki-${target.slug}.html`;
    const linkCount = [...navigation.matchAll(new RegExp(`href="${targetHref}"`, 'g'))].length;
    requireThat(linkCount === 1, `${file} navigation links ${linkCount} times to ${targetHref}, expected exactly one`);
  }

  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  requireThat(new Set(ids).size === ids.length, `${file} contains duplicate element ids`);
  for (const entry of roster.entries) {
    const anchor = `e-${entry.id}`;
    requireThat(ids.filter((id) => id === anchor).length === 1, `${file} does not emit exactly one #${anchor}`);
    const entryCard = cardSlice(html, entry.id);
    requireThat(new RegExp(`<article class="wcard" id="${anchor}" tabindex="-1"`).test(entryCard),
      `${file}#${anchor} is not a programmatically focusable search destination`);
    const href = `${file}#${anchor}`;
    requireThat(hrefCounts.get(href) === 1, `${href} does not have exactly one search entry`);
    if (roster.domain && visualPolicyDomains.has(roster.domain)) {
      const key = `${roster.domain}:${entry.id}`;
      const visual = visualByKey.get(key);
      requireThat(visual, `${file} entry ${entry.id} has no canonical visual association`);
      const card = cardSlice(html, entry.id);
      const marker = `data-visual-key="${esc(key)}" data-visual-use="entry"`;
      const count = card.split(marker).length - 1;
      requireThat(count === 1, `${file}#e-${entry.id} renders ${count} canonical entry visuals, expected one`);
      renderedVisualAssociations.set(key, (renderedVisualAssociations.get(key) || 0) + count);
      const firstVariant = visual.variants[0];
      requireThat(card.includes(`src="${esc(visualOutputPath(firstVariant.path))}"`)
        && card.includes(`width="${firstVariant.width}" height="${firstVariant.height}"`)
        && card.includes(`alt="${esc(visual.alt.text)}"`)
        && card.includes('data-pixelated="false"'), `${file}#e-${entry.id} renders the wrong source, dimensions, alt text or pixel-rendering policy`);
      requireThat(card.includes(esc(visual.source)) && card.toLocaleLowerCase().includes(visual.provenanceClass.toLocaleLowerCase()),
        `${file}#e-${entry.id} does not expose visual source/provenance`);
      if (visual.kind === 'runtime-render') {
        for (const variant of visual.variants) {
          requireThat(card.includes(`${esc(visualOutputPath(variant.path))} ${variant.width}w`),
            `${file}#e-${entry.id} omits responsive variant ${variant.label}`);
        }
        // Same four disclosures as before the voice pass, in plain words: the
        // render is isolated, it is not live play, and the artifact's own
        // limitation string is reproduced verbatim rather than paraphrased.
        requireThat(/\bsizes="[^"]+"/.test(card) && card.includes('The game drew this on its own, alone')
          && card.includes('It is not a screenshot, and it is not how it looks in a live world')
          && card.includes(esc(visual.renderContext.limitation)),
        `${file}#e-${entry.id} does not disclose its isolated neutral render context and limitation`);
        requireThat(card.includes('<b>Drawn by the game</b>') && !/<b>[^<]*(?:sprite|screenshot)/i.test(card),
          `${file}#e-${entry.id} mislabels a deterministic runtime render as a sprite or screenshot`);
        const expectedCameraView = roster.domain === 'wearables' && D.domains.wearables.entries[entry.id]?.trails === true ? 'rear' : 'front';
        requireThat(card.includes(`seen from the ${expectedCameraView}`),
          `${file}#e-${entry.id} hides or mislabels its ${expectedCameraView} presentation camera`);
        if (expectedCameraView === 'rear') {
          requireThat(/\brear\b/i.test(visual.alt.text) && /\brear\b/i.test(visual.renderContext.limitation)
            && /\btrail\b/i.test(visual.renderContext.limitation),
          `${file}#e-${entry.id} rear trailing-wearable render lacks truthful alt and limitation semantics`);
        }
      } else {
        requireThat(!/\bsrcset=|\bsizes=/.test(card), `${file}#e-${entry.id} gives an intrinsic visual a false responsive portrait set`);
      }
      if (visual.limitation) requireThat(card.includes(esc(visual.limitation)), `${file}#e-${entry.id} hides its visual limitation`);
    }
    renderedCards += 1;
  }
}

for (const entry of V.entries) {
  requireThat(renderedVisualAssociations.get(entry.assetKey) === 1,
    `canonical visual ${entry.assetKey} is not rendered exactly once on its source entry route`);
}

requireThat(!/Not built yet/i.test(hub), 'wiki hub still renders the retired deferred-domain section');
for (const domain of D.domainOrder) requireThat(hub.includes(`>${D.domains[domain].count} entries<`) || rosters.some((r) => r.domain === domain), `hub has no coverage path for ${domain}`);

const tierHtml = readFileSync(join(OUTDIR, 'wiki-tiers.html'), 'utf8');
const buildsHtml = readFileSync(join(OUTDIR, 'wiki-builds.html'), 'utf8');
const bestiaryHtml = readFileSync(join(OUTDIR, 'wiki-bestiary.html'), 'utf8');
const ultimateHtml = readFileSync(join(OUTDIR, 'wiki-ultimates.html'), 'utf8');
const tomesHtml = readFileSync(join(OUTDIR, 'wiki-tomes.html'), 'utf8');
const weaponsHtml = readFileSync(join(OUTDIR, 'wiki-weapons.html'), 'utf8');
const blessingsHtml = readFileSync(join(OUTDIR, 'wiki-blessings.html'), 'utf8');
const shrineMovementHtml = readFileSync(join(OUTDIR, 'wiki-shrine-movement.html'), 'utf8');
const jumpAliasesHtml = readFileSync(join(OUTDIR, 'wiki-jump-augments.html'), 'utf8');
const charactersHtml = readFileSync(join(OUTDIR, 'wiki-characters.html'), 'utf8');
const worldsHtml = readFileSync(join(OUTDIR, 'wiki-worlds.html'), 'utf8');
const expeditionsHtml = readFileSync(join(OUTDIR, 'wiki-expeditions.html'), 'utf8');
const modesHtml = readFileSync(join(OUTDIR, 'wiki-modes.html'), 'utf8');
requireThat(tierHtml.includes(T.fingerprint) && buildsHtml.includes(T.fingerprint), 'controlled-simulation pages do not expose the fixture fingerprint');
requireThat(tierHtml.includes(T.sourceContract.digest) && buildsHtml.includes(T.sourceContract.digest), 'controlled-simulation pages do not expose the source-contract digest');
for (const limit of T.limits.filter((line) => /same(?:[- ]| deterministic seed )cohort|holdout/i.test(line))) {
  requireThat(buildsHtml.includes(esc(limit)), `controlled build route hides selection-bias limit: ${limit}`);
}
requireThat(/<h2 class="chroma">WHOMP Ultimate<\/h2>/.test(ultimateHtml), 'ultimate route does not use the source-supported WHOMP Ultimate title');
requireThat(/<title>WHOMP Ultimate<\/title>/.test(ultimateHtml) && /<h1 class="chroma">WHOMP Ultimate<\/h1>/.test(ultimateHtml)
  && !/WHOMP whomp ultimate/i.test(ultimateHtml), 'ultimate document title or heading duplicates the WHOMP qualifier');
requireThat(ultimateHtml.includes('id="e-whomp"'), 'ultimate route lost its stable #e-whomp deep link');
requireThat(ultimateHtml.includes('Standard player run') && ultimateHtml.includes('Ultimate availability contract'),
  'ultimate route does not expose its scoped availability contract');
for (const semantic of D.domains.ultimates.runtime.semantics) {
  requireThat(ultimateHtml.includes(esc(semantic)), `ultimate route does not expose runtime semantic ${semantic}`);
}
for (const source of Object.values(D.domains.ultimates.runtime.provenance)) {
  requireThat(ultimateHtml.includes(esc(source)), `ultimate route does not expose runtime provenance ${source}`);
}
requireThat(!/opening grace/i.test(bestiaryHtml)
  && /Health, contact damage and kill XP scale separately/.test(bestiaryHtml)
  && bestiaryHtml.includes(pct(D.domains.enemies.scaling.hpPer25s))
  && bestiaryHtml.includes(pct(D.domains.enemies.scaling.damagePer30s))
  && bestiaryHtml.includes(pct(D.domains.enemies.scaling.xpPer120s)),
'bestiary does not separate health, contact-damage and XP clocks or has restored a fictitious opening grace');
requireThat(/listed basic behaviour runs in live combat/.test(bestiaryHtml)
  && /listed special behaviour also runs in live combat/.test(bestiaryHtml)
  && /The Maw is a separate authored set-piece/.test(bestiaryHtml),
'bestiary behavior/cadence copy does not distinguish running basic/special behaviours from the Maw set-piece');

const aegisCard = cardSlice(tomesHtml, 'aegisTome');
requireThat(aegisCard.includes(esc(D.domains.passives.refs.aegisTome.runtimeUnlock.description))
  && Object.values(D.domains.passives.refs.aegisTome.runtimeUnlock.provenance).every((source) => aegisCard.includes(esc(source)))
  && !/Achievement|from the first run/i.test(aegisCard),
'Aegis Tome card does not exclusively present the runtime signature-boss milestone unlock');
const squirrelCard = cardSlice(weaponsHtml, 'blackSquirrel');
for (const id of D.domains.weapons.refs.blackSquirrel.unlockedByQuests) {
  requireThat(squirrelCard.includes(`wiki-quests.html#e-${esc(id)}`), `Black Squirrel card omits quest acquisition ${id}`);
}
for (const id of D.domains.weapons.refs.blackSquirrel.unlockedByAchievements) {
  requireThat(squirrelCard.includes(`wiki-achievements.html#e-${esc(id)}`), `Black Squirrel card omits achievement acquisition ${id}`);
}
requireThat(squirrelCard.includes('Either route independently makes it available.'),
  'Black Squirrel card does not state that quest and achievement acquisition routes are independent');

requireThat(/<title>WHOMP shrine movement<\/title>/.test(shrineMovementHtml)
  && /<h2 class="chroma">Shrine movement<\/h2>/.test(shrineMovementHtml)
  && D.domains.shrineMovement.order.every((id) => shrineMovementHtml.includes(`id="e-${esc(id)}"`)),
'Shrine movement route is missing, mistitled or source-incomplete');
for (const semantic of D.domains.shrineMovement.runtime.semantics) {
  requireThat(shrineMovementHtml.includes(esc(semantic)) && blessingsHtml.includes(esc(semantic)),
    `Shrine routes hide runtime semantic ${semantic}`);
}
for (const source of Object.values(D.domains.shrineMovement.runtime.provenance)) {
  requireThat(shrineMovementHtml.includes(esc(source)) && blessingsHtml.includes(esc(source)),
    `Shrine routes hide provenance ${source}`);
}
// Regression guard, reworded with the copy it guards. Both halves survive: the
// page must still say the blessing trio is a PART of what an activation does,
// and must still say it is not the whole set of outcomes. The first phrasing
// moved from "blessing-trio portion" to "only part of what a shrine can do" in
// the voice pass. The claim being forbidden did not move.
requireThat(/only part of what a shrine can do/.test(blessingsHtml) && /not the complete set of shrine outcomes/.test(blessingsHtml),
  'Shrine blessings route overstates its registry as the complete live outcome pool');
requireThat(/Legacy jump augment aliases/.test(jumpAliasesHtml) && !/chest-only|small and complete/i.test(jumpAliasesHtml),
  'legacy jump route has regressed to chest-only or complete-live-pool copy');
for (const id of D.domains.jumpAugments.order) {
  const offering = D.domains.jumpAugments.refs[id].shrineMovementOffering;
  requireThat(cardSlice(jumpAliasesHtml, id).includes(`wiki-shrine-movement.html#e-${esc(offering)}`),
    `legacy jump alias ${id} does not link its live Shrine movement offering ${offering}`);
}

for (const semantic of Object.values(D.domains.characters.runtime.baseStats).flatMap((contract) => contract.semantics)) {
  requireThat(charactersHtml.includes(esc(semantic)), `character route hides runtime base-input semantic ${semantic}`);
}
for (const source of Object.values(D.domains.characters.runtime.baseStats)
  .flatMap((contract) => Object.values(contract.provenance))) {
  requireThat(charactersHtml.includes(esc(source)), `character route hides base-input provenance ${source}`);
}
for (const semantic of D.domains.characters.runtime.weaponIdentity.semantics) {
  requireThat(charactersHtml.includes(esc(semantic)), `character route hides suggested-weapon semantic ${semantic}`);
}
for (const source of Object.values(D.domains.characters.runtime.weaponIdentity.provenance)) {
  requireThat(charactersHtml.includes(esc(source)), `character route hides suggested-weapon provenance ${source}`);
}
requireThat(/Run-start health base/.test(charactersHtml)
  && /Speed identity input \(relative to 6\)/.test(charactersHtml)
  && /Damage identity multiplier input/.test(charactersHtml)
  && /Suggested weapon/.test(charactersHtml) && !/Starting weapon/.test(charactersHtml)
  && /not m\/s/.test(charactersHtml) && /not final damage/.test(charactersHtml),
'character route mislabels authored health, speed or might identity inputs');
// Regression guard, reworded with the copy it guards. A character's listed
// weapon is a suggestion; the standard solo campaign starts with the aimed core
// and nothing else. The forbidden phrasings are the exact wrong claims this page
// carried before, so they stay forbidden whatever the true sentence sounds like.
requireThat(!/start(?:s|ing)? with it|ones a character brings with them/i.test(weaponsHtml)
  && /The weapon a character lists is a suggestion, not something they walk in holding/.test(weaponsHtml),
'weapon route has regressed from suggested identity to an unconditional character starting grant');
for (const html of [worldsHtml, expeditionsHtml]) {
  requireThat(html.includes(String(D.world.encounterSchedule.automaticMinibossCadenceSec))
    && html.includes(mmss(D.world.encounterSchedule.unifiedProfilePreBankIntervalElapsedSec))
    && html.includes(mmss(D.world.encounterSchedule.unifiedProfileEndlessIntervalElapsedSec))
    && D.world.encounterSchedule.semantics.every((semantic) => html.includes(esc(semantic)))
    && D.world.encounterSchedule.limits.every((limit) => html.includes(esc(limit)))
    && Object.values(D.world.encounterSchedule.provenance).every((source) => html.includes(esc(source)))
    && /Authored tables plus automatic-miniboss cadence context/i.test(html)
    && /elapsed before the pacing bank/.test(html) && /in endless play/.test(html)
    && /not exact encounter timestamps or miniboss identities/i.test(html),
  'world or expedition route does not expose limited cadence evidence and authored signature-slot reservations');
}
requireThat(/Opening enemy HP bonus/.test(modesHtml)
  && modesHtml.includes(`fade to <b>0%</b> by ${mmss(D.domains.runModes.openingEnemyHpBonus.fadesToZeroAtPaceSec)}`)
  && modesHtml.includes(`${mmss(D.domains.runModes.openingEnemyHpBonus.unifiedProfileElapsedSec)} real-play equivalent`)
  && D.domains.runModes.openingEnemyHpBonus.excludes.every((line) => modesHtml.includes(esc(line)))
  && !/Opening health bonus/.test(modesHtml),
'run-mode route does not label, scope and explain the canonical ordinary-wave opening enemy HP fade');
const wikiOutputText = [hub, ...rosters.map((roster) => readFileSync(join(OUTDIR, `wiki-${roster.slug}.html`), 'utf8'))].join('\n');
const renderedAssetRefs = new Set([...wikiOutputText.matchAll(/wiki-assets\/(?:[a-z0-9][a-z0-9._-]*\/)*[a-z0-9][a-z0-9._-]*\.png/g)]
  .map((match) => match[0]));
requireThat(
  JSON.stringify([...renderedAssetRefs].sort()) === JSON.stringify([...expectedVisualFiles].sort()),
  `rendered visual URLs do not exactly cover the verified visual asset set`,
);
requireThat(!/boss ultimates?/i.test(wikiOutputText), 'generated wiki has regressed to the misleading boss-ultimate taxonomy');
requireThat(!/UNMEASURED:\s*UNMEASURED:/i.test(wikiOutputText), 'generated wiki duplicates an UNMEASURED label already carried by source evidence');
requireThat(!model.searchEntries.some((entry) => /boss ultimates?/i.test(`${entry.title} ${entry.text}`)), 'wiki search has regressed to the misleading boss-ultimate taxonomy');
for (const enemy of Object.values(D.domains.enemies.entries)) {
  if (!['boss', 'miniboss'].includes(enemy.tier)) continue;
  const openingTag = bestiaryHtml.match(new RegExp(`<article class="wcard" id="e-${esc(enemy.id)}"[^>]*>`))?.[0] || '';
  requireThat(openingTag, `wiki-bestiary.html has no card for contextual enemy ${enemy.id}`);
  requireThat(!/data-(?:behavior|s-(?:hp|damage|xp|speed))=/.test(openingTag), `contextual enemy ${enemy.id} leaks unpublished behavior, speed or combat stats into card data`);
  const start = bestiaryHtml.indexOf(openingTag);
  const end = bestiaryHtml.indexOf('</article>', start);
  const card = bestiaryHtml.slice(start, end);
  requireThat(!/(?:Speed profile|Profile speed|Base speed unchanged|Speed &times;)/.test(card), `contextual enemy ${enemy.id} publishes a partial speed surface`);
  requireThat(card.includes('health, damage, behavior and final chase speed are set through private, multi-stage runtime authority'), `contextual enemy ${enemy.id} lacks the exact UNMEASURED mechanics explanation`);
  const searchEntry = model.searchEntries.find((entry) => entry.href === `wiki-bestiary.html#e-${enemy.id}`);
  requireThat(searchEntry && !new RegExp(`\\b${enemy.behavior}\\b`, 'i').test(searchEntry.text), `contextual enemy ${enemy.id} leaks registry behavior into search`);
}
for (const row of T.weapons) {
  const id = `${row.id}-${row.form}-l${row.level}`;
  const card = cardSlice(tierHtml, id);
  const visualMarker = `data-visual-key="weapons:${row.id}" data-visual-use="reference"`;
  requireThat(card.split(visualMarker).length - 1 === 1, `wiki-tiers.html#e-${id} does not render exactly one canonical weapon glyph`);
  for (const axis of T.metric.axes) {
    const reading = row.axes[axis.key];
    if (!reading.volatile) continue;
    const anchor = `e-${id}`;
    const start = tierHtml.indexOf(`id="${anchor}"`);
    const end = tierHtml.indexOf('</article>', start);
    const volatileCard = tierHtml.slice(start, end);
    requireThat(volatileCard.includes(reading.tierAtP10) && volatileCard.includes(reading.tierAtP90), `${anchor}/${axis.key} hides its volatile tier span`);
  }
}
for (const pair of T.measuredBuilds.pairs) {
  const id = pair.ids.join('-');
  const card = cardSlice(buildsHtml, id);
  for (const weaponId of pair.ids) {
    const marker = `data-visual-key="weapons:${weaponId}" data-visual-use="reference"`;
    requireThat(card.split(marker).length - 1 === 1, `wiki-builds.html#e-${id} does not render exactly one ${weaponId} component glyph`);
  }
}
const expectedBuildFeatureGlyphs = T.measuredBuilds.builds.reduce((sum, build) => sum + build.ids.length, 0);
requireThat((buildsHtml.match(/data-visual-use="build-feature"/g) || []).length === expectedBuildFeatureGlyphs,
  `build feature does not render all ${expectedBuildFeatureGlyphs} canonical weapon components`);
const tierCharts = [...tierHtml.matchAll(/<div class="wrange" role="img" aria-label="([^"]+)">/g)];
const expectedTierCharts = T.weapons.reduce((sum, row) => sum
  + T.metric.axes.filter((axis) => row.axes[axis.key].status !== 'UNMEASURED').length, 0);
requireThat(tierCharts.length === expectedTierCharts, `tier route renders ${tierCharts.length} spread charts, expected ${expectedTierCharts}`);
const buildCharts = [...buildsHtml.matchAll(/<div class="wrange" role="img" aria-label="([^"]+)">/g)];
const expectedBuildCharts = T.measuredBuilds.pairs.length * T.metric.axes.length
  + T.measuredBuilds.builds.length
  + T.measuredBuilds.builds.reduce((sum, build) => sum + build.steps.filter((step) => step.marginal).length, 0);
requireThat(buildCharts.length === expectedBuildCharts, `build route renders ${buildCharts.length} spread charts, expected ${expectedBuildCharts}`);
for (const [label, html, charts] of [['tier', tierHtml, tierCharts], ['build', buildsHtml, buildCharts]]) {
  requireThat(charts.every((match) => /P10 .*median .*P90 .*; n=.*Local row scale/.test(match[1])),
    `${label} charts do not expose P10, median, P90, unit, n and local-scale limits to assistive technology`);
  requireThat((html.match(/class="wrange-limit"/g) || []).length === charts.length,
    `${label} charts do not expose a visible limitation for every range`);
}

const coresHtml = readFileSync(join(OUTDIR, 'wiki-cores.html'), 'utf8');
for (const id of D.domains.coreWeapons.selectOrder) {
  const profile = D.domains.coreWeapons.refs[id].forgiveness;
  for (const [field, value] of Object.entries(profile)) {
    requireThat(coresHtml.includes(field) && coresHtml.includes(String(value)), `core ${id} does not expose ${field}=${value}`);
  }
}
const powerHtml = readFileSync(join(OUTDIR, 'wiki-power-ceilings.html'), 'utf8');
for (const [field, value] of Object.entries(D.powerCeiling.config)) {
  requireThat(powerHtml.includes(field) && powerHtml.includes(String(value)), `power ceiling does not expose ${field}=${value}`);
}
for (const id of D.domains.enemies.order) {
  const enemy = D.domains.enemies.entries[id];
  if (['boss', 'miniboss'].includes(enemy.tier)) continue;
  const profile = D.domains.enemies.refs[id].speedProfile;
  const card = cardSlice(bestiaryHtml, id);
  requireThat(card && card.includes(String(profile.liveRunBaseMps)), `bestiary ${id} card does not expose its own live-run speed base`);
}

requireThat(renderedCards === expectedCards, `checked ${renderedCards} cards, expected ${expectedCards}`);

console.log('WIKI CONTRACT OK');
console.log(`  ${D.coverage.domains} source domains, ${D.coverage.entries} canonical entries`);
console.log(`  ${model.pages.length} routes, ${renderedCards} cards, ${wikiSearchEntries.length} wiki search entries (${search.length} site-wide)`);
console.log(`  ${expandedRosters.length} expanded domains, ${expectedExpandedCards} cards, ${expandedModelSearchEntries.length} search entries`);
console.log(`  ${formerlyDeferredRosters.length} formerly deferred domains are routed, navigable and source-count complete`);
console.log(`  ${T.coverage.rows} controlled-sim evidence rows, ${T.measuredBuilds.pairs.length} measured pairs, fingerprint ${T.fingerprint}`);
console.log(`  ${V.coverage.entries} canonical visual associations, ${V.coverage.variants} verified PNG variants, ${V.coverage.bytes} bytes`);
