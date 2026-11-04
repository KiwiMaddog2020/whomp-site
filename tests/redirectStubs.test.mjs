/** The github.io pages send each visitor to the matching playwhomp.com/about
 *  page (game lane site-to-about). See bin/redirect-stubs.mjs. */
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { NEW_SITE_URL, stubHtml, stubTarget, writeStubs } from '../bin/redirect-stubs.mjs';

test('each old page maps to its new address', () => {
  assert.equal(stubTarget('index.html'), `${NEW_SITE_URL}/`);
  assert.equal(stubTarget('log.html'), `${NEW_SITE_URL}/log`);
  assert.equal(stubTarget('wiki.html'), `${NEW_SITE_URL}/wiki`);
  assert.equal(stubTarget('wiki-relics.html'), `${NEW_SITE_URL}/wiki-relics`);
  assert.equal(stubTarget('built-in-the-open.html'), `${NEW_SITE_URL}/built-in-the-open`);
  assert.throws(() => stubTarget('../x.html'));
});

test('a stub redirects three ways to the same address, keeping query and anchor', () => {
  const html = stubHtml('wiki-relics.html');
  const to = `${NEW_SITE_URL}/wiki-relics`;
  assert.ok(html.includes(`<meta http-equiv="refresh" content="0; url=${to}">`));
  assert.ok(html.includes(`<link rel="canonical" href="${to}">`));
  assert.ok(html.includes(`location.replace("${to}" + location.search + location.hash)`));
  assert.ok(html.includes('<meta name="robots" content="noindex">'));
  assert.ok(!html.includes('github.io'));
});

test('writeStubs keeps every page path and writes the MOVED marker', () => {
  const from = mkdtempSync(join(tmpdir(), 'stubs-from-'));
  const out = mkdtempSync(join(tmpdir(), 'stubs-out-'));
  try {
    for (const f of ['index.html', 'log.html', 'wiki.html', 'wiki-relics.html', 'built-in-the-open.html']) writeFileSync(join(from, f), 'page');
    writeFileSync(join(from, 'search-index.json'), '[]');
    const written = writeStubs({ from, outdir: out });
    assert.deepEqual(written, ['built-in-the-open.html', 'index.html', 'log.html', 'wiki-relics.html', 'wiki.html', 'MOVED']);
    assert.deepEqual(readdirSync(out).sort(), ['MOVED', 'built-in-the-open.html', 'index.html', 'log.html', 'wiki-relics.html', 'wiki.html']);
    assert.equal(readFileSync(join(out, 'MOVED'), 'utf8'), `${NEW_SITE_URL}/\n`);
  } finally {
    rmSync(from, { recursive: true, force: true });
    rmSync(out, { recursive: true, force: true });
  }
});

test('refuses a partial set', () => {
  const from = mkdtempSync(join(tmpdir(), 'stubs-partial-'));
  try {
    writeFileSync(join(from, 'index.html'), 'page');
    assert.throws(() => writeStubs({ from, outdir: from }), /log\.html/);
  } finally {
    rmSync(from, { recursive: true, force: true });
  }
});
