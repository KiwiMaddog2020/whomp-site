#!/usr/bin/env node
/** Fail-closed contract for the generated public wiki.
 *
 * This checks the consumer side of the pipeline after bin/generate.mjs writes a
 * candidate release. The game repo owns artifact freshness; this file proves
 * that every artifact domain, route, card, anchor and search edge actually made
 * it into the site output. It also mutation-checks the model guard so a green
 * contract is known to fail for the drift classes it claims to catch.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { buildWiki, rosterSpecs } from './wiki.mjs';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const REPO = resolve(arg('--repo', '../whomp'));
const OUTDIR = resolve(arg('--outdir', '.'));
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const clone = (value) => JSON.parse(JSON.stringify(value));
const esc = (value) => String(value).replace(/[&<>"]/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
}[char]));
const fail = (message) => { throw new Error(`WIKI CONTRACT: ${message}`); };
const requireThat = (condition, message) => { if (!condition) fail(message); };

const D = readJson(join(REPO, 'data/game-data.json'));
const T = readJson(join(REPO, 'data/tier-rankings.json'));
const declaredRosters = rosterSpecs(D, esc, T);
const chrome = {
  AUTHBAR: '',
  wordmark: () => '',
  liveChip: () => '',
  searchMarkup: () => '<input role="combobox">',
  SEARCH_SCRIPT: () => '',
  SEARCH_PLACEHOLDER: '',
  wikiNav: () => '',
  headSha: 'contract',
  buildStamp: 'contract',
};

// Positive model check. buildWiki validates before rendering and returns the
// same route declaration the real generator consumes.
const model = buildWiki({ D, T, esc, chrome, page: ({ body }) => body });
const rosters = model.rosters;
requireThat(model.pages.length === rosters.length + 1, `model emitted ${model.pages.length} pages for ${rosters.length} guides`);
requireThat(
  JSON.stringify(rosters.map((roster) => roster.slug)) === JSON.stringify(declaredRosters.map((roster) => roster.slug)),
  'buildWiki route declarations differ from rosterSpecs',
);

const expectedSourceEntries = D.domainOrder.reduce((sum, domain) => sum + D.domains[domain].count, 0);
requireThat(D.coverage.domains === D.domainOrder.length, `artifact covers ${D.coverage.domains} domains but declares ${D.domainOrder.length}`);
requireThat(D.coverage.entries === expectedSourceEntries, `artifact covers ${D.coverage.entries} entries but its domain counts total ${expectedSourceEntries}`);

const expectedCards = rosters.reduce((sum, roster) => sum + roster.entries.length, 0);
const expectedModelSearchEntries = 1 + rosters.length + expectedCards;
requireThat(
  model.searchEntries.length === expectedModelSearchEntries,
  `model emitted ${model.searchEntries.length} search entries, expected ${expectedModelSearchEntries} from its routes and cards`,
);

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

// These nineteen catalogs were the old hub's explicit "Not built yet" list.
// Keep their ids as a release contract, but never copy their magnitudes here:
// every count below remains derived from the freshly verified game artifact.
const FORMERLY_DEFERRED_DOMAINS = [
  'relics', 'characters', 'innates', 'signatures', 'levels', 'expeditions', 'runModes',
  'shipCores', 'shipFragments', 'legendaries', 'passives', 'ultimates', 'evolutions',
  'shrineBlessings', 'utilities', 'wearables', 'achievements', 'cosmetics', 'jumpAugments',
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
  mutate(d, t);
  let error = null;
  try {
    buildWiki({ D: d, T: t, esc, chrome, page: ({ body }) => body });
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

// Source text is untrusted at the rendering boundary even though the artifact
// itself is generated in-repo. Keep a mutation pin here so a future refactor
// cannot turn an authored registry string into executable wiki markup.
const injectionData = clone(D);
const injectionId = injectionData.domains.weapons.order[0];
const injectionProbe = '\"><img src=x onerror="contractProbe()">';
injectionData.domains.weapons.entries[injectionId].name = injectionProbe;
injectionData.domains.weapons.entries[injectionId].desc = injectionProbe;
const injectionModel = buildWiki({ D: injectionData, T, esc, chrome, page: ({ body }) => body });
const injectionHtml = injectionModel.pages.find((page) => page.file === 'wiki-weapons.html')?.html || '';
requireThat(!injectionHtml.includes(injectionProbe), 'source text reaches generated wiki markup without escaping');
requireThat(injectionHtml.includes(esc(injectionProbe)), 'escaped source-text mutation is missing from its generated card');

const manifestPath = join(OUTDIR, '.site-outputs');
requireThat(existsSync(manifestPath), `${manifestPath} is missing`);
const manifest = readFileSync(manifestPath, 'utf8').trim().split('\n').filter(Boolean);
requireThat(new Set(manifest).size === manifest.length, 'output manifest contains duplicate filenames');
for (const file of manifest) requireThat(existsSync(join(OUTDIR, file)), `manifest output ${file} is missing`);

const expectedWikiFiles = new Set(model.pages.map((page) => page.file));
requireThat(expectedWikiFiles.size === model.pages.length, 'model emits duplicate wiki filenames');
const actualWikiFiles = new Set(manifest.filter((file) => file.startsWith('wiki') && file.endsWith('.html')));
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
const entryCountLabel = (count) => `${count} ${count === 1 ? 'entry' : 'entries'}`;
const hubCards = [...hub.matchAll(/<a\s+class="whubcard"\s+href="([^"]+)">([\s\S]*?)<\/a>/g)]
  .map((match) => ({ href: match[1], body: match[2] }));
requireThat(hubCards.length === rosters.length, `wiki hub emits ${hubCards.length} cards for ${rosters.length} rosters`);

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
  requireThat(!/(?:undefined|NaN|\[object Object\])/.test(html), `${file} contains an unrenderable JavaScript value`);
  requireThat(!/Not built yet/i.test(html), `${file} still carries the retired deferred-section copy`);
  requireThat(/class="wprov"/.test(html), `${file} has no provenance block`);
  requireThat(/aria-live="polite"/.test(html), `${file} has no live result count`);
  requireThat(/role="combobox"/.test(html), `${file} search is not an accessible combobox`);
  requireThat(/aria-current="page"/.test(html), `${file} navigation does not identify the current page`);

  const navigation = html.match(/<nav class="wside">([\s\S]*?)<\/nav>/)?.[1] || '';
  requireThat(/class="wside-section"/.test(navigation), `${file} has no categorized wiki navigation`);
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
    const href = `${file}#${anchor}`;
    requireThat(hrefCounts.get(href) === 1, `${href} does not have exactly one search entry`);
    renderedCards += 1;
  }
}

requireThat(!/Not built yet/i.test(hub), 'wiki hub still renders the retired deferred-domain section');
for (const domain of D.domainOrder) requireThat(hub.includes(`>${D.domains[domain].count} entries<`) || rosters.some((r) => r.domain === domain), `hub has no coverage path for ${domain}`);

const tierHtml = readFileSync(join(OUTDIR, 'wiki-tiers.html'), 'utf8');
const buildsHtml = readFileSync(join(OUTDIR, 'wiki-builds.html'), 'utf8');
const bestiaryHtml = readFileSync(join(OUTDIR, 'wiki-bestiary.html'), 'utf8');
requireThat(tierHtml.includes(T.fingerprint) && buildsHtml.includes(T.fingerprint), 'measured pages do not expose the artifact fingerprint');
for (const enemy of Object.values(D.domains.enemies.entries)) {
  if (!['boss', 'miniboss'].includes(enemy.tier)) continue;
  const openingTag = bestiaryHtml.match(new RegExp(`<article class="wcard" id="e-${esc(enemy.id)}"[^>]*>`))?.[0] || '';
  requireThat(openingTag, `wiki-bestiary.html has no card for contextual enemy ${enemy.id}`);
  requireThat(!/data-s-(?:hp|damage|xp)=/.test(openingTag), `contextual enemy ${enemy.id} leaks unpublished combat stats into sort data`);
}
for (const row of T.weapons) {
  for (const axis of T.metric.axes) {
    const reading = row.axes[axis.key];
    if (!reading.volatile) continue;
    const id = `e-${row.id}-${row.form}-l${row.level}`;
    const start = tierHtml.indexOf(`id="${id}"`);
    const end = tierHtml.indexOf('</article>', start);
    const card = tierHtml.slice(start, end);
    requireThat(card.includes(reading.tierAtP10) && card.includes(reading.tierAtP90), `${id}/${axis.key} hides its volatile tier span`);
  }
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
  const profile = D.domains.enemies.refs[id].speedProfile;
  requireThat(bestiaryHtml.includes(`id="e-${id}"`) && bestiaryHtml.includes(String(profile.liveRunBaseMps)), `bestiary does not expose ${id} live-run speed base`);
}

requireThat(renderedCards === expectedCards, `checked ${renderedCards} cards, expected ${expectedCards}`);

console.log('WIKI CONTRACT OK');
console.log(`  ${D.coverage.domains} source domains, ${D.coverage.entries} canonical entries`);
console.log(`  ${model.pages.length} routes, ${renderedCards} cards, ${wikiSearchEntries.length} wiki search entries (${search.length} site-wide)`);
console.log(`  ${expandedRosters.length} expanded domains, ${expectedExpandedCards} cards, ${expandedModelSearchEntries.length} search entries`);
console.log(`  ${formerlyDeferredRosters.length} formerly deferred domains are routed, navigable and source-count complete`);
console.log(`  ${T.coverage.rows} tier rows, ${T.meta.pairs.length} measured pairs, fingerprint ${T.fingerprint}`);
