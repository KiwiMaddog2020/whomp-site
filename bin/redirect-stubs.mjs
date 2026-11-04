#!/usr/bin/env node
/** THE MOVE TO playwhomp.com/about (game lane site-to-about; Kevin, desk chat
 *  11-03 4:02 pm, "sites at game/about").
 *
 *  The pages are built by the game's Preview deploy now (its bin/build-about.mjs
 *  runs this repo's generator into dist/about/). GitHub Pages serves this repo
 *  as files and has no server redirects, so every page this repo used to serve
 *  is replaced, AT ITS OWN PATH, by a stub that sends the visitor to the
 *  matching new page three ways at once:
 *    - a meta refresh (works with script off),
 *    - a canonical link (tells a search engine where the page lives now),
 *    - one line of script, location.replace, which keeps ?query and #anchor so a
 *      deep link like wiki-relics.html#warm-brick lands on the same card.
 *
 *  Paths: index.html -> /about/, x.html -> /about/x (Cloudflare Pages serves
 *  x.html at /x). Then it writes MOVED, the marker bin/generate.mjs and
 *  bin/deploy-site.sh read so no later run regenerates over the stubs.
 *
 *  Run ONCE, by hand, after playwhomp.com/about is live and smoked:
 *    node bin/redirect-stubs.mjs            # rewrites this checkout's root
 *    node bin/redirect-stubs.mjs --outdir D # writes the stubs into D instead
 *  It prints the exact paths it wrote, for an explicit `git add`. */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const NEW_SITE_URL = 'https://playwhomp.com/about';
export const MOVED_FILE = 'MOVED';

/** The new address of one old page. */
export function stubTarget(file) {
  if (!/^[a-z0-9][a-z0-9-]*\.html$/.test(file)) throw new Error(`not a site page: ${file}`);
  const page = file.slice(0, -'.html'.length);
  return page === 'index' ? `${NEW_SITE_URL}/` : `${NEW_SITE_URL}/${page}`;
}

const attr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** The stub for one old page. */
export function stubHtml(file) {
  const to = stubTarget(file);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>WHOMP has moved</title>
<meta name="robots" content="noindex">
<link rel="canonical" href="${attr(to)}">
<meta http-equiv="refresh" content="0; url=${attr(to)}">
<script>location.replace(${JSON.stringify(to)} + location.search + location.hash);</script>
</head>
<body style="margin:0;background:#151023;color:#f4ecd8;font:16px/1.5 system-ui,sans-serif">
<p style="padding:24px">This page lives at <a style="color:#f4ecd8" href="${attr(to)}">${attr(to.replace('https://', ''))}</a> now.</p>
</body>
</html>
`;
}

/** The pages this repo serves: every root .html file. */
export function sitePages(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && /^[a-z0-9][a-z0-9-]*\.html$/.test(e.name))
    .map((e) => e.name)
    .sort();
}

export function writeStubs({ from = SITE_ROOT, outdir = SITE_ROOT } = {}) {
  const pages = sitePages(from);
  for (const required of ['index.html', 'log.html', 'wiki.html']) {
    if (!pages.includes(required)) throw new Error(`${required} is not in ${from}; refusing to write a partial set of stubs`);
  }
  mkdirSync(outdir, { recursive: true });
  for (const page of pages) writeFileSync(join(outdir, page), stubHtml(page));
  writeFileSync(join(outdir, MOVED_FILE), `${NEW_SITE_URL}/\n`);
  return [...pages, MOVED_FILE];
}

function main(argv) {
  const i = argv.indexOf('--outdir');
  const outdir = i >= 0 && argv[i + 1] ? resolve(argv[i + 1]) : SITE_ROOT;
  if (outdir === SITE_ROOT && existsSync(join(SITE_ROOT, MOVED_FILE))) {
    console.log('already moved: MOVED exists; the stubs are in place');
    return;
  }
  const written = writeStubs({ from: SITE_ROOT, outdir });
  console.log(`wrote ${written.length} files to ${outdir}:`);
  for (const f of written) console.log(f);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
