/** THE GAME SITES HUB (bin/hub.mjs, plan step S3).
 *
 *  Four things are held here: the three routes exist for every game that ships
 *  an export, a game that is not cleared is hidden two ways (noindex meta on
 *  every page, a robots.txt Disallow for its folder) and a cleared one is not,
 *  a fixture never ships without the preview flag, and WHOMP's own pages come
 *  out of a hub run exactly as main has them.
 *
 *  The games are the fixtures under tests/fixtures/game-sites/: no real export
 *  exists yet (Pinball's is step S2), so nothing here is any game's facts.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  applyRobots, buildHub, interimRenderer, isNameCleared, loadGame, loadKitRenderer, mergeSearchIndex,
  NOINDEX_META, resolveHref, robotsTxt, ROUTES, siteDataProblems,
} from '../bin/hub.mjs';

const SITE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURES = join(SITE_ROOT, 'tests/fixtures/game-sites');
const PINBALL = join(FIXTURES, 'pinball');
const CLEARED = join(FIXTURES, 'cleared-demo');
const load = (dir) => loadGame(dir, { allowFixture: true });
const NOINDEX = /<meta\s+name=["']?robots["']?\s+content=["']?noindex["']?\s*\/?>/i;
const headOf = (html) => html.slice(0, html.indexOf('</head>'));
const clone = (v) => JSON.parse(JSON.stringify(v));
const pinballData = () => JSON.parse(readFileSync(join(PINBALL, 'site/site-data.json'), 'utf8'));

// ---------------------------------------------------------------- routes
test('every game that ships an export gets /<game>/, /<game>/wiki/ and /<game>/log/', () => {
  const hub = buildHub([load(PINBALL), load(CLEARED)]);
  assert.deepEqual(hub.pages.map((p) => p.file).sort(), [
    'cleared-demo/index.html', 'cleared-demo/log/index.html', 'cleared-demo/wiki/index.html',
    'pinball/index.html', 'pinball/log/index.html', 'pinball/wiki/index.html',
  ]);
  assert.deepEqual(ROUTES, { landing: 'index.html', wiki: 'wiki/index.html', log: 'log/index.html' });
  for (const p of hub.pages) assert.match(p.html, /^<!doctype html>/);
});

test('a checkout with no site/site-data.json is refused by name, not skipped', () => {
  assert.throws(() => loadGame(SITE_ROOT, { allowFixture: true }), /site-data\.json does not exist/);
});

test('the pages link to each other and the CLI writes them as folders a static host serves', () => {
  const out = mkdtempSync(join(tmpdir(), 'hub-cli-'));
  try {
    execFileSync(process.execPath, [join(SITE_ROOT, 'bin/hub.mjs'), '--game', PINBALL, '--outdir', out, '--allow-fixture']);
    for (const route of Object.values(ROUTES)) assert.ok(existsSync(join(out, 'pinball', route)), route);
    const landing = readFileSync(join(out, 'pinball/index.html'), 'utf8');
    assert.match(landing, /href="wiki\/"/);
    assert.match(landing, /href="log\/"/);
    const wiki = readFileSync(join(out, 'pinball/wiki/index.html'), 'utf8');
    assert.match(wiki, /href="\.\.\/"/);
    assert.match(wiki, /href="\.\.\/log\/"/);
  } finally { rmSync(out, { recursive: true, force: true }); }
});

test('href resolution: folders mean index.html, ../ climbs, bare anchors stay on the page', () => {
  assert.deepEqual(resolveHref('wiki/', 'pinball/index.html'), { file: 'pinball/wiki/index.html', anchor: '' });
  assert.deepEqual(resolveHref('../', 'pinball/wiki/index.html'), { file: 'pinball/index.html', anchor: '' });
  assert.deepEqual(resolveHref('../log/#x', 'pinball/wiki/index.html'), { file: 'pinball/log/index.html', anchor: 'x' });
  assert.deepEqual(resolveHref('#a', 'pinball/wiki/index.html'), { file: 'pinball/wiki/index.html', anchor: 'a' });
  assert.equal(resolveHref('https://example.com/', 'pinball/index.html'), null);
});

test('a dead internal link fails the hub build (negative: a renderer that links nowhere)', () => {
  const broken = {
    name: 'broken',
    renderSitePages: (g, o) => {
      const pages = interimRenderer.renderSitePages(g, o);
      return { ...pages, landing: pages.landing.replace('href="wiki/"', 'href="nowhere/"') };
    },
  };
  assert.throws(() => buildHub([load(PINBALL)], { renderer: broken }), /no such file pinball\/nowhere\/index\.html/);
});

test('a link out of the game folder into WHOMP or another game fails', () => {
  const leaky = {
    name: 'leaky',
    renderSitePages: (g, o) => {
      const pages = interimRenderer.renderSitePages(g, o);
      return { ...pages, landing: pages.landing.replace('href="log/"', 'href="../log.html"') };
    },
  };
  assert.throws(() => buildHub([load(PINBALL)], { renderer: leaky }), /leaves the game's folder/);
});

test('two games with one id, or an id that is a root name, are refused', () => {
  assert.throws(() => buildHub([load(PINBALL), load(PINBALL)]), /two games export the id "pinball"/);
  const d = pinballData();
  d.id = 'wiki';
  assert.ok(siteDataProblems(d).some((p) => /reserved root name/.test(p)));
});

// ---------------------------------------------------------------- hidden until cleared
test('a game that is not cleared carries noindex in <head> on all three pages', () => {
  const hub = buildHub([load(PINBALL)]);
  assert.equal(hub.pages.length, 3);
  for (const p of hub.pages) {
    assert.match(headOf(p.html), NOINDEX, p.file);
    assert.equal(p.html.match(/name="robots"/g).length, 1, `${p.file} carries exactly one robots meta`);
  }
});

test('a cleared game (nameCleared: true) carries no noindex anywhere', () => {
  const hub = buildHub([load(CLEARED)]);
  for (const p of hub.pages) assert.doesNotMatch(p.html, /noindex/i, p.file);
});

test('robots.txt disallows each uncleared game folder and nothing else', () => {
  const txt = robotsTxt([load(PINBALL), load(CLEARED)]);
  const rules = txt.split('\n').filter((l) => l && !l.startsWith('#'));
  assert.deepEqual(rules, ['User-agent: *', 'Disallow: /pinball/']);
  assert.deepEqual(robotsTxt([load(CLEARED)]).split('\n').filter((l) => l && !l.startsWith('#')), ['User-agent: *', 'Disallow:']);
  assert.match(robotsTxt([load(PINBALL)], { base: '/whomp-site' }), /^Disallow: \/whomp-site\/pinball\/$/m);
});

test('only a literal true clears a name: false, "true", 1, a missing key or no game.kit.json all stay hidden', () => {
  assert.equal(isNameCleared({ nameCleared: true }), true);
  for (const kit of [null, undefined, {}, { nameCleared: false }, { nameCleared: 'true' }, { nameCleared: 1 }, []]) {
    assert.equal(isNameCleared(kit), false, JSON.stringify(kit));
  }
  const dir = mkdtempSync(join(tmpdir(), 'hub-nokit-'));
  try {
    cpSync(join(PINBALL, 'site'), join(dir, 'site'), { recursive: true });
    const g = load(dir);
    assert.equal(g.kit, null);
    assert.equal(g.cleared, false);
    for (const p of buildHub([g]).pages) assert.match(headOf(p.html), NOINDEX);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('the hub adds noindex even when the renderer forgot it, and refuses a cleared page that carries one', () => {
  const forgetful = { name: 'forgetful', renderSitePages: (g) => interimRenderer.renderSitePages(g, { robots: '' }) };
  for (const p of buildHub([load(PINBALL)], { renderer: forgetful }).pages) assert.match(headOf(p.html), NOINDEX);
  const stale = { name: 'stale', renderSitePages: (g) => interimRenderer.renderSitePages(g, { robots: NOINDEX_META }) };
  assert.throws(() => buildHub([load(CLEARED)], { renderer: stale }), /cleared \(nameCleared: true\) but its renderer emitted noindex/);
  assert.throws(() => applyRobots('<html><body></body></html>', false, 'x'), /no <head>/);
});

test('flipping nameCleared in the game.kit.json flips both hiding rules (mutation)', () => {
  const g = load(PINBALL);
  const cleared = { ...g, kit: { ...g.kit, nameCleared: true }, cleared: isNameCleared({ nameCleared: true }) };
  const hub = buildHub([cleared]);
  for (const p of hub.pages) assert.doesNotMatch(p.html, /noindex/i);
  assert.doesNotMatch(hub.robots, /Disallow: \/pinball\//);
});

// ---------------------------------------------------------------- fixtures and facts
test('a fixture export is refused without --allow-fixture, and carries a FIXTURE banner with it', () => {
  assert.throws(() => loadGame(PINBALL), /is a fixture/);
  const out = mkdtempSync(join(tmpdir(), 'hub-refuse-'));
  try {
    assert.throws(() => execFileSync(process.execPath, [join(SITE_ROOT, 'bin/hub.mjs'), '--game', PINBALL, '--outdir', out], { stdio: 'pipe' }));
    assert.deepEqual(readdirSync(out), [], 'a refused run writes nothing');
  } finally { rmSync(out, { recursive: true, force: true }); }
  for (const p of buildHub([load(PINBALL)]).pages) assert.match(p.html, /class="fixture"[^>]*>FIXTURE:/);
});

test('every committed export under tests/fixtures says fixture: true, so none can pass for a game', () => {
  for (const id of readdirSync(FIXTURES, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)) {
    const data = JSON.parse(readFileSync(join(FIXTURES, id, 'site/site-data.json'), 'utf8'));
    assert.equal(data.fixture, true, id);
    assert.match(data.name, /\(fixture\)$/, id);
  }
});

test('the wiki shows every exported value and only exported values (every cell is derived)', () => {
  const g = load(PINBALL);
  const wiki = buildHub([g]).pages.find((p) => p.file === 'pinball/wiki/index.html').html;
  const cells = [...wiki.matchAll(/<td data-field="([^"]+)">([^<]*)<\/td>/g)].map((m) => [m[1], m[2]]);
  const expected = g.data.catalogs.flatMap((c) => c.rows.flatMap((r) => c.fields.map((f) => {
    const id = typeof f === 'string' ? f : f.id;
    return [id, r[id] === undefined ? '' : String(r[id])];
  })));
  assert.deepEqual(cells, expected);
});

test('the contract refuses what the plan does not allow (negative cases)', () => {
  assert.deepEqual(siteDataProblems(pinballData()), []);
  const cases = [
    ['no name', (d) => { delete d.name; }, /name is required/],
    ['http play URL', (d) => { d.playUrl = 'http://x'; }, /playUrl/],
    ['no catalogs', (d) => { d.catalogs = []; }, /catalogs must be a non-empty array/],
    ['duplicate row', (d) => { d.catalogs[0].rows.push(clone(d.catalogs[0].rows[0])); }, /duplicated/],
    ['object cell', (d) => { d.catalogs[0].rows[0].value = { x: 1 }; }, /must be a string, number or boolean/],
    ['bad palette', (d) => { d.palette.ink = 'url(x)'; }, /palette\.ink/],
    ['bad log date', (d) => { d.log[0].date = 'Oct 24'; }, /log must be/],
    ['traversing icon', (d) => { d.icon = '../secret.png'; }, /icon/],
  ];
  for (const [name, mutate, pattern] of cases) {
    const d = pinballData();
    mutate(d);
    assert.ok(siteDataProblems(d).some((p) => pattern.test(p)), name);
  }
});

test('the dev log reads the exported entries newest first and invents none when there are none', () => {
  const g = load(PINBALL);
  const log = buildHub([g]).pages.find((p) => p.file === 'pinball/log/index.html').html;
  assert.ok(log.indexOf('Fixture log entry two') < log.indexOf('Fixture log entry one'));
  const bare = buildHub([load(CLEARED)]).pages.find((p) => p.file === 'cleared-demo/log/index.html').html;
  assert.match(bare, /No entries exported yet\./);
  assert.doesNotMatch(bare, /<article/);
});

test('art named by a row must exist in site-visuals.json, and is copied under the game folder', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hub-art-'));
  try {
    cpSync(PINBALL, dir, { recursive: true });
    const d = pinballData();
    d.catalogs[0].rows[0].art = 'ball';
    writeFileSync(join(dir, 'site/site-data.json'), JSON.stringify(d));
    assert.throws(() => load(dir), /names art "ball" with no \{file, alt\}/);
    mkdirSync(join(dir, 'site/art'));
    writeFileSync(join(dir, 'site/art/ball.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    writeFileSync(join(dir, 'site/site-visuals.json'), JSON.stringify({ ball: { file: 'art/ball.png', alt: 'fixture art' } }));
    const hub = buildHub([load(dir)]);
    assert.deepEqual(hub.assets.map((a) => a.file), ['pinball/assets/ball.png']);
    assert.match(hub.pages.find((p) => p.file === 'pinball/wiki/index.html').html, /src="\.\.\/assets\/ball\.png" alt="fixture art"/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('the kit renderer seam: absent kit site/ falls back to null, a kit renderSitePages is used when present', async () => {
  assert.equal(await loadKitRenderer(''), null);
  assert.equal(await loadKitRenderer(join(SITE_ROOT, 'no-such-kit')), null);
  const kit = mkdtempSync(join(tmpdir(), 'hub-kit-'));
  try {
    mkdirSync(join(kit, 'site'));
    writeFileSync(join(kit, 'site/index.mjs'), `export function renderSitePages(game) {
      const p = (b, ids = '') => '<!doctype html><html><head><title>k</title></head><body><a href="' + b + '">x</a>' + ids + '</body></html>';
      return { landing: p('wiki/'), wiki: p('../'), log: p('../wiki/') };
    }`);
    const renderer = await loadKitRenderer(kit);
    /* The search rows' anchors are the hub's contract with any renderer: a kit
     * page that drops them is refused rather than shipping dead search hits. */
    assert.throws(() => buildHub([load(PINBALL)], { renderer }), /search-index: pinball\/wiki\/index\.html#tables/);
    writeFileSync(join(kit, 'site/index.mjs'), `export function renderSitePages(game) {
      const p = (b, ids = '') => '<!doctype html><html><head><title>k</title></head><body><a href="' + b + '">x</a>' + ids + '</body></html>';
      const wikiIds = game.data.catalogs.map((c) => '<i id="' + c.id + '"></i>' + c.rows.map((r) => '<i id="' + c.id + '-' + r.id + '"></i>').join('')).join('');
      const logIds = (game.data.log || []).map((e) => '<i id="log-' + e.date + '-' + e.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') + '"></i>').join('');
      return { landing: p('wiki/'), wiki: p('../', wikiIds), log: p('../wiki/', logIds) };
    }`);
    const compliant = await import(`${pathToFileURL(join(kit, 'site/index.mjs')).href}?v2`);
    assert.equal(typeof compliant.renderSitePages, 'function');
    const renderer2 = { name: 'kit (fixture)', renderSitePages: compliant.renderSitePages };
    assert.match(renderer.name, /^kit/);
    const hub = buildHub([load(PINBALL)], { renderer: renderer2 });
    assert.match(hub.renderer, /^kit/);
    for (const p of hub.pages) assert.match(headOf(p.html), NOINDEX, 'the hub, not the renderer, owns noindex');
  } finally { rmSync(kit, { recursive: true, force: true }); }
});

// ---------------------------------------------------------------- one search index
test('one search index: game rows append after WHOMP\'s, every href resolves, re-runs replace rather than duplicate', () => {
  const hub = buildHub([load(PINBALL), load(CLEARED)]);
  const whompRows = JSON.parse(readFileSync(join(SITE_ROOT, 'search-index.json'), 'utf8'));
  const merged = mergeSearchIndex(whompRows, hub.searchEntries, ['pinball', 'cleared-demo']);
  assert.deepEqual(merged.slice(0, whompRows.length), whompRows, 'WHOMP rows unchanged and in order');
  assert.equal(merged.length, whompRows.length + hub.searchEntries.length);
  assert.deepEqual(mergeSearchIndex(merged, hub.searchEntries, ['pinball', 'cleared-demo']), merged);
  for (const e of hub.searchEntries) {
    assert.deepEqual(Object.keys(e), ['type', 'title', 'text', 'anchor', 'href'], 'same row shape as WHOMP');
    const t = resolveHref(e.href, 'index.html');
    assert.ok(hub.anchors.has(t.file) && (!t.anchor || hub.anchors.get(t.file).has(t.anchor)), e.href);
  }
  const pinRows = hub.searchEntries.filter((e) => e.href.startsWith('pinball/'));
  assert.equal(pinRows.length, 1 + 2 + 3 + 2, 'landing + 2 catalogs + 3 rows + 2 log entries');
});

// ---------------------------------------------------------------- WHOMP stays as main has it
const BIG = { maxBuffer: 1 << 28 };
const git = (...a) => execFileSync('git', ['-C', SITE_ROOT, ...a], { encoding: 'utf8', ...BIG });
const showMain = (f) => execFileSync('git', ['-C', SITE_ROOT, 'show', `origin/main:${f}`], BIG);
const hasMain = (() => { try { git('rev-parse', '--verify', '-q', 'origin/main'); return true; } catch { return false; } })();
const whompOutputs = () => git('ls-tree', '-r', '--name-only', 'origin/main').split('\n')
  .filter((f) => /^(?:[^/]+\.html|search-index\.json|whomp-icon\.svg|whomp-icon-512\.png|wiki-assets\/.+)$/.test(f));

test('a hub run into the site leaves every WHOMP page byte-identical to main, and WHOMP\'s search rows fact-identical', { skip: !hasMain && 'no origin/main ref in this checkout' }, () => {
  const out = mkdtempSync(join(tmpdir(), 'hub-whomp-'));
  try {
    const files = whompOutputs().filter((f) => !f.startsWith('wiki-assets/'));
    assert.ok(files.includes('index.html') && files.includes('log.html') && files.includes('wiki.html'));
    for (const f of files) {
      mkdirSync(dirname(join(out, f)), { recursive: true });
      writeFileSync(join(out, f), showMain(f));
    }
    execFileSync(process.execPath, [join(SITE_ROOT, 'bin/hub.mjs'), '--game', PINBALL, '--game', CLEARED, '--outdir', out, '--allow-fixture']);
    let identical = 0;
    for (const f of files.filter((x) => x !== 'search-index.json')) {
      assert.ok(readFileSync(join(out, f)).equals(showMain(f)), `${f} changed`);
      identical += 1;
    }
    assert.equal(identical, files.length - 1, 'every WHOMP output but the search index compared');
    assert.ok(identical >= 39, `checked ${identical} WHOMP outputs`);
    const mainRows = JSON.parse(git('show', 'origin/main:search-index.json'));
    const after = JSON.parse(readFileSync(join(out, 'search-index.json'), 'utf8'));
    assert.deepEqual(after.filter((e) => !/^(?:pinball|cleared-demo)\//.test(e.href)), mainRows);
  } finally { rmSync(out, { recursive: true, force: true }); }
});

test('this branch changes no WHOMP output file against main', { skip: !hasMain && 'no origin/main ref in this checkout' }, () => {
  const changed = git('diff', '--name-only', 'origin/main', '--', ...whompOutputs().filter((f) => !f.startsWith('wiki-assets/')), 'wiki-assets').trim();
  assert.equal(changed, '');
});

test('bin/generate.mjs runs the hub only when --game is passed, so a plain run writes what it wrote before', () => {
  const src = readFileSync(join(SITE_ROOT, 'bin/generate.mjs'), 'utf8');
  assert.match(src, /const hub = HUB_GAMES\.length\s*\?\s*buildHub\(/);
  assert.match(src, /if \(hub\) searchIndex\.push\(\.\.\.hub\.searchEntries\);/);
  assert.match(src, /\.\.\.\(hub \? \[[\s\S]*?\{ file: 'robots\.txt', body: hub\.robots \},\s*\] : \[\]\),/);
  assert.match(src, /if \(hub\) for \(const \[file, ids\] of hub\.anchors\)/);
});
