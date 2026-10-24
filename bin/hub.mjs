#!/usr/bin/env node
/** THE GAME SITES HUB, step S3 of docs/studio-os/plans/GAME_SITES_2026-10-24.md
 *  in the game repo.
 *
 *  WHOMP keeps its own pages at the root (index.html, log.html, wiki*.html) and
 *  this file never touches them. Every OTHER game that ships a
 *  `site/site-data.json` export gets three routes under its own folder:
 *
 *    <game>/index.html        the landing page   (/<game>/)
 *    <game>/wiki/index.html   the wiki           (/<game>/wiki/)
 *    <game>/log/index.html    the dev log        (/<game>/log/)
 *
 *  plus one robots.txt for the host and its rows in the one shared
 *  search-index.json.
 *
 *  THE RENDERER IS THE KIT'S. The plan puts the page renderer in whomp-kit
 *  (`site/`, step S1). Until S1 lands, `interimRenderer` below draws the three
 *  pages from the same contract so the routes, the hiding rules and the search
 *  wiring can be built and tested now. Pass `--kit <whomp-kit checkout>` and the
 *  hub uses `<kit>/site/index.mjs` instead, when it exists and exports
 *  `renderSitePages(game) -> { landing, wiki, log }` (each a full HTML page).
 *  The hub owns everything that is not drawing: routes, noindex, robots, links,
 *  search. So swapping renderers cannot drop a hiding rule.
 *
 *  HIDDEN UNTIL CLEARED. Kevin's pick (desk chat, 2026-10-24): every game page
 *  ships `<meta name="robots" content="noindex">` and robots.txt disallows the
 *  game's folder, until that game's own `game.kit.json` carries
 *  `nameCleared: true`. Anything else (false, a string, the key missing, no
 *  game.kit.json at all) is NOT cleared. The flag is the game's, set on Kevin's
 *  word; this repo only reads it.
 *
 *  FIXTURES NEVER SHIP. An export that says `"fixture": true` is a stand-in
 *  (tests/fixtures/game-sites/), not a game's facts. The hub refuses it unless
 *  the caller passes `allowFixture`, which only the preview build and the tests
 *  do, and every page drawn from one carries a FIXTURE banner.
 *
 *  USAGE (preview build of the hub alone, into a scratch folder):
 *    node bin/hub.mjs --game <game checkout> [--game ...] --outdir <dir>
 *                     [--kit <whomp-kit checkout>] [--allow-fixture] [--base /]
 *  bin/generate.mjs takes the same --game / --kit / --allow-fixture flags and
 *  folds the hub into the full site run.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const ROUTES = Object.freeze({ landing: 'index.html', wiki: 'wiki/index.html', log: 'log/index.html' });
export const NOINDEX_META = '<meta name="robots" content="noindex">';
export const GAME_ID = /^[a-z][a-z0-9-]*$/;
/* A game folder sits next to WHOMP's own files, so it may not take a name the
 * site already uses at the root (or the arcade's, in the game repo). */
export const RESERVED_IDS = new Set([
  'arcade', 'bin', 'brand', 'docs', 'drafts', 'notes', 'tests', 'wiki', 'wiki-assets', 'log', 'whomp',
  'node_modules', 'search-index', 'robots',
]);

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'x';
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;
const safeRelative = (p) => typeof p === 'string' && p.length > 0
  && p.split('/').every((part) => /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(part) && part !== '..');
const CSS_COLOR = /^(#[0-9a-fA-F]{3,8}|rgba?\([0-9., %]+\)|hsla?\([0-9., %deg]+\))$/;

// ---------------------------------------------------------------- the contract
/** The plan's contract, as far as r1 states it: name, palette, icon, play URL
 *  and a list of catalogs `{id, title, fields[], rows[]}`, each row optionally
 *  naming its art by id in `site/site-visuals.json`. `log` and `next` are this
 *  hub's reading of "dev logs, automatic" until S1 writes them into the schema:
 *  the exporter supplies dated entries; the hub never writes a post. Returns a
 *  list of problems; empty means it conforms. */
export function siteDataProblems(data) {
  const problems = [];
  const need = (ok, message) => { if (!ok) problems.push(message); };
  if (!isObject(data)) return ['site-data.json is not an object'];
  need(typeof data.id === 'string' && GAME_ID.test(data.id), 'id must be a lowercase slug');
  need(!RESERVED_IDS.has(data.id), `id "${data.id}" is a reserved root name`);
  need(nonEmpty(data.name), 'name is required');
  need(typeof data.playUrl === 'string' && /^https:\/\//.test(data.playUrl), 'playUrl must be an https URL');
  need(data.icon === undefined || data.icon === null || safeRelative(data.icon), 'icon must be a relative path inside site/');
  need(data.fixture === undefined || typeof data.fixture === 'boolean', 'fixture must be a boolean');
  need(isObject(data.palette), 'palette must be an object');
  if (isObject(data.palette)) {
    for (const [key, value] of Object.entries(data.palette)) {
      need(/^[a-z][a-z0-9-]*$/.test(key) && typeof value === 'string' && CSS_COLOR.test(value),
        `palette.${key} must be a CSS colour under a lowercase name`);
    }
  }
  need(Array.isArray(data.catalogs) && data.catalogs.length > 0, 'catalogs must be a non-empty array');
  const catalogIds = new Set();
  for (const [i, c] of (Array.isArray(data.catalogs) ? data.catalogs : []).entries()) {
    const where = `catalogs[${i}]`;
    if (!isObject(c)) { problems.push(`${where} is not an object`); continue; }
    need(typeof c.id === 'string' && GAME_ID.test(c.id), `${where}.id must be a lowercase slug`);
    need(!catalogIds.has(c.id), `${where}.id "${c.id}" is duplicated`);
    catalogIds.add(c.id);
    need(nonEmpty(c.title), `${where}.title is required`);
    const fields = Array.isArray(c.fields) ? c.fields.map(normalizeField) : null;
    need(fields && fields.length > 0 && fields.every(Boolean), `${where}.fields must be field ids or {id, label}`);
    need(Array.isArray(c.rows), `${where}.rows must be an array`);
    const rowIds = new Set();
    for (const [j, r] of (Array.isArray(c.rows) ? c.rows : []).entries()) {
      const rw = `${where}.rows[${j}]`;
      if (!isObject(r)) { problems.push(`${rw} is not an object`); continue; }
      need(typeof r.id === 'string' && GAME_ID.test(r.id), `${rw}.id must be a lowercase slug`);
      need(!rowIds.has(r.id), `${rw}.id "${r.id}" is duplicated`);
      rowIds.add(r.id);
      need(r.art === undefined || nonEmpty(r.art), `${rw}.art must name an art id`);
      for (const f of fields || []) {
        if (!f || r[f.id] === undefined) continue;
        need(['string', 'number', 'boolean'].includes(typeof r[f.id]), `${rw}.${f.id} must be a string, number or boolean`);
      }
    }
  }
  need(data.log === undefined || (Array.isArray(data.log) && data.log.every((e) => isObject(e)
    && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && nonEmpty(e.title) && (e.text === undefined || typeof e.text === 'string'))),
  'log must be a list of {date: YYYY-MM-DD, title, text?}');
  need(data.next === undefined || (Array.isArray(data.next) && data.next.every(nonEmpty)), 'next must be a list of strings');
  return problems;
}

function normalizeField(f) {
  if (typeof f === 'string' && GAME_ID.test(f)) return { id: f, label: f };
  if (isObject(f) && typeof f.id === 'string' && GAME_ID.test(f.id) && nonEmpty(f.label)) return { id: f.id, label: f.label };
  return null;
}

/** True only for a literal `nameCleared: true` in the game's own game.kit.json. */
export const isNameCleared = (kit) => isObject(kit) && kit.nameCleared === true;

// ---------------------------------------------------------------- loading a game
/** Reads one game checkout: `site/site-data.json` (required), `site/site-visuals.json`
 *  (optional) and `game.kit.json` (optional; missing means not cleared). Loud on
 *  a malformed export: a hub that renders half a game is worse than one that stops. */
export function loadGame(gameDir, { allowFixture = false } = {}) {
  const root = resolve(gameDir);
  const dataPath = join(root, 'site', 'site-data.json');
  if (!existsSync(dataPath)) throw new Error(`HUB: ${dataPath} does not exist; a game joins the hub by shipping it.`);
  const data = JSON.parse(readFileSync(dataPath, 'utf8'));
  const problems = siteDataProblems(data);
  if (problems.length) throw new Error(`HUB: ${dataPath} does not match the site contract:\n  ${problems.join('\n  ')}`);
  if (data.fixture === true && !allowFixture) {
    throw new Error(`HUB: ${dataPath} is a fixture ("fixture": true). Fixtures are for previews and tests and never ship; pass --allow-fixture for a preview build.`);
  }
  const visualsPath = join(root, 'site', 'site-visuals.json');
  const visuals = existsSync(visualsPath) ? JSON.parse(readFileSync(visualsPath, 'utf8')) : {};
  const kitPath = join(root, 'game.kit.json');
  const kit = existsSync(kitPath) ? JSON.parse(readFileSync(kitPath, 'utf8')) : null;
  const assets = [];
  const art = {};
  for (const c of data.catalogs) {
    for (const r of c.rows) {
      if (!r.art) continue;
      const v = visuals[r.art];
      if (!isObject(v) || !safeRelative(v.file) || !nonEmpty(v.alt)) {
        throw new Error(`HUB: ${data.id} row ${c.id}/${r.id} names art "${r.art}" with no {file, alt} in site/site-visuals.json`);
      }
      if (!art[r.art]) {
        const file = `assets/${basename(v.file)}`;
        assets.push({ file: `${data.id}/${file}`, bytes: readFileSync(join(root, 'site', v.file)) });
        art[r.art] = { file, alt: v.alt };
      }
    }
  }
  let icon = null;
  if (data.icon) {
    icon = `icon${data.icon.slice(data.icon.lastIndexOf('.'))}`;
    assets.push({ file: `${data.id}/${icon}`, bytes: readFileSync(join(root, 'site', data.icon)) });
  }
  return { id: data.id, data, kit, cleared: isNameCleared(kit), fixture: data.fixture === true, art, icon, assets };
}

// ---------------------------------------------------------------- the interim renderer
/* Draws only what the export says. Every value in a wiki cell, a log line or a
 * landing fact is read from site-data.json; the only words this file writes are
 * the page chrome (headings like "Wiki", "Dev log", "Play") and the fixture
 * banner. tests/hub.test.mjs holds it to that. */
const paletteCss = (palette) => Object.entries(palette).map(([k, v]) => `--game-${k}:${v};`).join('');
const PAGE_CSS = `
body{margin:0;background:var(--game-ground,#06040e);color:var(--game-ink,#fff3cf);font:16px/1.5 system-ui,sans-serif}
main{max-width:60rem;margin:0 auto;padding:1.5rem 1rem 4rem}
a{color:var(--game-accent,#24f0ff)}
nav.hub{display:flex;gap:1rem;flex-wrap:wrap;padding:.75rem 1rem;border-bottom:1px solid rgba(255,255,255,.15)}
.fixture{background:#ffcf3f;color:#0a0714;padding:.5rem 1rem;font-weight:700}
.play{display:inline-block;padding:.6rem 1.2rem;border-radius:.5rem;background:var(--game-accent,#ff2f7e);color:var(--game-ground,#06040e);font-weight:700;text-decoration:none}
.table-wrap{overflow-x:auto}
table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:.35rem .6rem;border-bottom:1px solid rgba(255,255,255,.12);vertical-align:top}
img.art{max-width:6rem;height:auto}
`;

function page({ game, title, depth, body, robots }) {
  const up = '../'.repeat(depth);
  const d = game.data;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${robots}
<title>${esc(title)}</title>
${game.icon ? `<link rel="icon" href="${up}${esc(game.icon)}">` : ''}
<style>:root{${paletteCss(d.palette)}}${PAGE_CSS}</style>
</head>
<body>
${game.fixture ? '<div class="fixture" role="note">FIXTURE: placeholder data for a preview of the hub. None of this is the game\'s.</div>' : ''}
<nav class="hub" aria-label="${esc(d.name)}">
  <a href="${up || './'}">${esc(d.name)}</a>
  <a href="${up}wiki/">Wiki</a>
  <a href="${up}log/">Dev log</a>
  <a href="${esc(d.playUrl)}">Play</a>
</nav>
<main id="main">
${body}
</main>
</body>
</html>
`;
}

const cell = (v) => (v === undefined ? '' : esc(v));

export const interimRenderer = Object.freeze({
  name: 'interim (whomp-site bin/hub.mjs, until kit site/ lands)',
  renderSitePages(game, { robots = '' } = {}) {
    const d = game.data;
    const catalogs = d.catalogs.map((c) => ({ ...c, fields: c.fields.map(normalizeField) }));
    const landing = page({
      game, depth: 0, robots, title: d.name, body: `
<h1>${esc(d.name)}</h1>
${game.icon ? `<img class="icon" src="${esc(game.icon)}" alt="" width="96" height="96">` : ''}
<p><a class="play" href="${esc(d.playUrl)}">Play</a></p>
<h2>In the wiki</h2>
<ul>
${catalogs.map((c) => `  <li><a href="wiki/#${esc(c.id)}">${esc(c.title)}</a> (${c.rows.length})</li>`).join('\n')}
</ul>
${d.next?.length ? `<h2>Next</h2>\n<ul>\n${d.next.map((n) => `  <li>${esc(n)}</li>`).join('\n')}\n</ul>` : ''}
<p><a href="log/">Dev log</a></p>`,
    });
    const wiki = page({
      game, depth: 1, robots, title: `${d.name} wiki`, body: `
<h1>${esc(d.name)} wiki</h1>
<nav aria-label="Catalogs"><ul>
${catalogs.map((c) => `  <li><a href="#${esc(c.id)}">${esc(c.title)}</a></li>`).join('\n')}
</ul></nav>
${catalogs.map((c) => `<section id="${esc(c.id)}">
<h2>${esc(c.title)}</h2>
<div class="table-wrap"><table>
<thead><tr>${c.rows.some((r) => r.art) ? '<th></th>' : ''}${c.fields.map((f) => `<th>${esc(f.label)}</th>`).join('')}</tr></thead>
<tbody>
${c.rows.map((r) => `<tr id="${esc(c.id)}-${esc(r.id)}">${c.rows.some((x) => x.art) ? `<td>${r.art ? `<img class="art" src="../${esc(game.art[r.art].file)}" alt="${esc(game.art[r.art].alt)}">` : ''}</td>` : ''}${c.fields.map((f) => `<td data-field="${esc(f.id)}">${cell(r[f.id])}</td>`).join('')}</tr>`).join('\n')}
</tbody>
</table></div>
</section>`).join('\n')}`,
    });
    const entries = [...(d.log || [])].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    const log = page({
      game, depth: 1, robots, title: `${d.name} dev log`, body: `
<h1>${esc(d.name)} dev log</h1>
${entries.length ? entries.map((e) => `<article id="log-${esc(e.date)}-${slug(e.title)}">
<h2><time datetime="${esc(e.date)}">${esc(e.date)}</time> ${esc(e.title)}</h2>
${e.text ? `<p>${esc(e.text)}</p>` : ''}
</article>`).join('\n') : '<p>No entries exported yet.</p>'}
${d.next?.length ? `<h2>Next</h2>\n<ul>\n${d.next.map((n) => `  <li>${esc(n)}</li>`).join('\n')}\n</ul>` : ''}`,
    });
    return { landing, wiki, log };
  },
});

/** The kit's renderer when `<kit>/site/index.mjs` exports renderSitePages, else
 *  null. Never throws for a kit that has not built `site/` yet: that is the
 *  expected state until S1 lands, and the caller says which renderer drew. */
export async function loadKitRenderer(kitDir) {
  if (!kitDir) return null;
  const entry = join(resolve(kitDir), 'site', 'index.mjs');
  if (!existsSync(entry)) return null;
  const mod = await import(pathToFileURL(entry).href);
  if (typeof mod.renderSitePages !== 'function') return null;
  return { name: `kit (${entry})`, renderSitePages: mod.renderSitePages };
}

// ---------------------------------------------------------------- hiding rules
/** Puts the noindex meta into <head> when the game is not cleared, whichever
 *  renderer drew the page, and refuses a page that ends up without exactly the
 *  right state. A cleared game's page must NOT carry it (a stale noindex would
 *  keep a cleared game out of search forever, silently). */
export function applyRobots(html, cleared, where) {
  const has = (h) => /<meta\s+name=["']?robots["']?\s+content=["']?[^"'>]*noindex/i.test(h);
  let out = html;
  if (!cleared && !has(out)) {
    if (!/<head[^>]*>/i.test(out)) throw new Error(`HUB: ${where} has no <head> to carry noindex`);
    out = out.replace(/<head([^>]*)>/i, `<head$1>\n${NOINDEX_META}`);
  }
  if (!cleared && !has(out)) throw new Error(`HUB: ${where} is not cleared and still has no noindex`);
  if (cleared && has(out)) throw new Error(`HUB: ${where} is cleared (nameCleared: true) but its renderer emitted noindex`);
  return out;
}

/** One robots.txt for the host. WHOMP's own pages are never disallowed; each
 *  game that is not cleared is, by its folder. `base` is the path the site is
 *  served under ("/" on playwhomp.com). */
export function robotsTxt(games, { base = '/' } = {}) {
  const prefix = base.endsWith('/') ? base : `${base}/`;
  const hidden = games.filter((g) => !g.cleared).map((g) => g.id).sort();
  return [
    '# Generated by whomp-site bin/hub.mjs. A game folder is disallowed until its',
    '# game.kit.json carries "nameCleared": true.',
    'User-agent: *',
    ...(hidden.length ? hidden.map((id) => `Disallow: ${prefix}${id}/`) : ['Disallow:']),
    '',
  ].join('\n');
}

// ---------------------------------------------------------------- links
const withoutComments = (html) => html.replace(/<!--[\s\S]*?-->/g, '');
const idsOf = (html) => new Set([...withoutComments(html).matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));

/** Resolves a relative href from `fromFile` (a site-root path such as
 *  "pinball/wiki/index.html") to a site-root file plus anchor, or null for an
 *  external link. A trailing slash means that folder's index.html. */
export function resolveHref(href, fromFile) {
  if (/^(?:[a-z]+:|\/\/)/i.test(href)) return null;
  const [path, anchor = ''] = href.split('#');
  const parts = path ? fromFile.split('/').slice(0, -1) : fromFile.split('/');
  if (!path) return { file: fromFile, anchor };
  for (const seg of path.split('/')) {
    if (seg === '..') parts.pop();
    else if (seg !== '.' && seg !== '') parts.push(seg);
  }
  let file = parts.join('/');
  if (path.endsWith('/') || path === '.' || path === './' || /(^|\/)\.\.?$/.test(path)) file = file ? `${file}/index.html` : 'index.html';
  return { file, anchor };
}

// ---------------------------------------------------------------- the hub
/** Builds every game's three routes. Returns the pages, the binary assets,
 *  robots.txt, the search rows (root-relative hrefs, same shape as WHOMP's) and
 *  each page's anchors so bin/generate.mjs can check search hrefs against them.
 *  Throws on a dead internal link or a game id clash. */
export function buildHub(games, { renderer = interimRenderer, base = '/' } = {}) {
  const seen = new Set();
  for (const g of games) {
    if (seen.has(g.id)) throw new Error(`HUB: two games export the id "${g.id}"`);
    seen.add(g.id);
  }
  const pages = [];
  const searchEntries = [];
  for (const g of [...games].sort((a, b) => a.id.localeCompare(b.id))) {
    const drawn = renderer.renderSitePages(g, { robots: g.cleared ? '' : NOINDEX_META });
    for (const key of Object.keys(ROUTES)) {
      if (typeof drawn?.[key] !== 'string') throw new Error(`HUB: renderer ${renderer.name} drew no ${key} page for ${g.id}`);
      const file = `${g.id}/${ROUTES[key]}`;
      pages.push({ file, html: applyRobots(drawn[key], g.cleared, file), game: g.id });
    }
    const d = g.data;
    searchEntries.push({ type: d.name.toLowerCase(), title: d.name, text: 'landing page', anchor: '', href: `${g.id}/index.html` });
    for (const c of d.catalogs) {
      searchEntries.push({ type: `${g.id} wiki`, title: c.title, text: `${d.name} wiki, ${c.rows.length} entries`, anchor: c.id, href: `${g.id}/wiki/index.html#${c.id}` });
      const first = normalizeField(c.fields[0]);
      for (const r of c.rows) {
        const label = r[first.id] === undefined ? r.id : String(r[first.id]);
        searchEntries.push({ type: `${g.id} wiki`, title: label, text: `${d.name}, ${c.title}`, anchor: `${c.id}-${r.id}`, href: `${g.id}/wiki/index.html#${c.id}-${r.id}` });
      }
    }
    for (const e of d.log || []) {
      const anchor = `log-${e.date}-${slug(e.title)}`;
      searchEntries.push({ type: `${g.id} log`, title: e.title, text: `${d.name} dev log ${e.date}`, anchor, href: `${g.id}/log/index.html#${anchor}` });
    }
  }
  const anchors = new Map(pages.map((p) => [p.file, idsOf(p.html)]));
  const assets = games.flatMap((g) => g.assets);
  const assetFiles = new Set(assets.map((a) => a.file));
  const broken = [];
  for (const p of pages) {
    for (const m of withoutComments(p.html).matchAll(/(?:href|src)="([^"]+)"/g)) {
      const target = resolveHref(m[1].replace(/&amp;/g, '&'), p.file);
      if (!target) continue;
      if (!target.file.startsWith(`${p.game}/`)) { broken.push(`${p.file}: ${m[1]} leaves the game's folder`); continue; }
      if (anchors.has(target.file)) {
        if (target.anchor && !anchors.get(target.file).has(target.anchor)) broken.push(`${p.file}: ${target.file} has no #${target.anchor}`);
      } else if (!assetFiles.has(target.file)) broken.push(`${p.file}: no such file ${target.file}`);
    }
  }
  for (const e of searchEntries) {
    const t = resolveHref(e.href, 'index.html');
    if (!anchors.has(t.file) || (t.anchor && !anchors.get(t.file).has(t.anchor))) broken.push(`search-index: ${e.href}`);
  }
  if (broken.length) throw new Error(`HUB: ${broken.length} internal link(s) resolve to nothing:\n  ${broken.join('\n  ')}`);
  return { pages, assets, robots: robotsTxt(games, { base }), searchEntries, anchors, renderer: renderer.name };
}

/** Hub rows leave the shared index by folder before new ones go in, so a
 *  re-run, or a game that left the hub, never leaves duplicates or dead rows.
 *  WHOMP's rows are untouched and keep their order. */
export function mergeSearchIndex(existing, hubEntries, gameIds) {
  const owned = (e) => gameIds.some((id) => e.href.startsWith(`${id}/`));
  return [...existing.filter((e) => !owned(e)), ...hubEntries];
}

// ---------------------------------------------------------------- CLI
async function main() {
  const args = process.argv.slice(2);
  const all = (name) => args.flatMap((a, i) => (a === name && args[i + 1] ? [args[i + 1]] : []));
  const one = (name, dflt) => all(name)[0] ?? dflt;
  const gameDirs = all('--game');
  const outdir = resolve(one('--outdir', SITE_ROOT));
  if (!gameDirs.length) throw new Error('HUB: pass at least one --game <checkout>');
  const allowFixture = args.includes('--allow-fixture');
  const games = gameDirs.map((dir) => loadGame(dir, { allowFixture }));
  const renderer = (await loadKitRenderer(one('--kit'))) || interimRenderer;
  const hub = buildHub(games, { renderer, base: one('--base', '/') });
  for (const f of [...hub.pages.map((p) => ({ file: p.file, body: p.html })), ...hub.assets.map((a) => ({ file: a.file, body: a.bytes })), { file: 'robots.txt', body: hub.robots }]) {
    const dest = join(outdir, ...f.file.split('/'));
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, f.body);
  }
  const indexPath = join(outdir, 'search-index.json');
  const existing = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, 'utf8')) : [];
  writeFileSync(indexPath, JSON.stringify(mergeSearchIndex(existing, hub.searchEntries, games.map((g) => g.id))));
  console.log(`hub: ${games.length} game(s) via ${hub.renderer}`);
  for (const g of games) {
    console.log(`  /${g.id}/ /${g.id}/wiki/ /${g.id}/log/  ${g.cleared ? 'cleared, indexable' : 'NOT cleared: noindex + robots Disallow'}${g.fixture ? '  FIXTURE' : ''}`);
  }
  console.log(`  ${hub.searchEntries.length} search rows merged into ${indexPath}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exit(1); });
}
