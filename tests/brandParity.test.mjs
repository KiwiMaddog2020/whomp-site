/** BRAND PARITY over the generated pages, plus the check script itself.
 *
 *  bin/brand-parity.mjs is the full check and needs a game checkout to compare
 *  against. This suite is the half that needs nothing but the files a visitor is
 *  served, so it runs in CI, on a fresh clone, and inside the per-deploy hook the
 *  game repo already calls (`node --test tests/*.test.mjs`) without anybody
 *  wiring a second command anywhere.
 *
 *  WHAT IT IS FOR. The wordmark drifted between the game and this site for six
 *  weeks in 2026 and the only thing that would have caught it was somebody
 *  looking at a letterform. Every assertion below is one a reader would make with
 *  their eyes, written down so a machine makes it on every run instead.
 *
 *  A missing file is a SKIP, same law as tests/generatedSite.test.mjs: a clone
 *  that has not generated yet has nothing to drift from, and a suite that is red
 *  on checkout is a suite people learn to ignore.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const SITE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => (existsSync(join(SITE_ROOT, file)) ? readFileSync(join(SITE_ROOT, file), 'utf8') : null);

const index = read('index.html');
const log = read('log.html');
const wiki = read('wiki.html');
const pitch = read('built-in-the-open.html');
const generated = index && log && wiki && pitch;
const options = generated ? {} : { skip: 'the site has not been generated in this checkout' };

/** The four pages a stranger can land on from somebody else's link. Every one of
 *  them paints the wordmark somewhere, so every one of them has to carry the
 *  face: a page that preloads nothing renders the fallback tail and the visitor
 *  sees a different logo from the one on the page they came from. */
const publicPages = () => [['index.html', index], ['log.html', log], ['wiki.html', wiki], ['built-in-the-open.html', pitch]];

test('the face ships in this repo, at the size the game ships', () => {
  const font = join(SITE_ROOT, 'brand/whomp-display.woff2');
  assert.ok(existsSync(font), 'brand/whomp-display.woff2 is missing; the site self-hosts the face rather than linking somebody else CDN');
  const bytes = readFileSync(font);
  assert.equal(bytes.subarray(0, 4).toString('ascii'), 'wOF2', 'brand/whomp-display.woff2 is not a woff2 envelope');
  /* The game's lane measured 18,604 B and capped its own suite at 60 KB, chosen
   * so any candidate the director picked from would fit and nothing heavier: a
   * file that outgrows that stops winning font-display:optional's ~100ms race,
   * and a logo that loses that race never paints at all for that load. */
  assert.ok(statSync(font).size <= 60 * 1024, `the face is ${statSync(font).size} B, over the 60 KB ceiling that keeps it winning the optional race`);
});

test("the face's licence travels with it", () => {
  const ofl = read('brand/OFL-ArchivoBlack.txt');
  assert.ok(ofl, 'brand/OFL-ArchivoBlack.txt is missing; SIL OFL 1.1 requires the licence to ship with the font');
  assert.match(ofl, /SIL OPEN FONT LICENSE/i);
});

test('every public page preloads the face, with crossorigin', options, () => {
  for (const [name, html] of publicPages()) {
    assert.match(html, /<link rel="preload" href="brand\/whomp-display\.woff2" as="font" type="font\/woff2" crossorigin>/,
      `${name} does not preload the wordmark face. font-display:optional without a preload is decorative: the fetch does not start until the rule is first used and a cold load renders the fallback for the life of the document.`);
  }
});

test('every public page declares the face at weight 900 and display optional', options, () => {
  for (const [name, html] of publicPages()) {
    const block = html.split(/@font-face\s*\{/)[1]?.split('}')[0] ?? '';
    assert.match(block, /font-family:\s*'WHOMP Display'/, `${name} has no 'WHOMP Display' @font-face`);
    /* 900 is the one that bites. Archivo Black is a SINGLE-WEIGHT file: a face
     * that does not claim 900 is taken for a 400 and the browser synthesizes the
     * bold, which is the smeared, squished mark the director reported on
     * 2026-07-20 and again on 2026-07-30. Shipping without this line ships the
     * bug the file was bought to fix. */
    assert.match(block, /font-weight:\s*900/, `${name}'s @font-face does not claim font-weight:900, so the browser will synthesize a smeared bold from the single-weight file`);
    assert.match(block, /font-display:\s*optional/, `${name}'s @font-face is not font-display:optional, so the logo can flash or vanish`);
  }
});

test('the wordmark stack leads with the real face and keeps the game fallback tail', options, () => {
  const stack = (index.match(/--wordmark-font:\s*([^;]+);/) || [])[1];
  assert.ok(stack, 'index.html carries no --wordmark-font token');
  assert.match(stack, /^'WHOMP Display'/, 'the real face must lead the stack or the fallback wins whenever both resolve');
  /* Dropped by the game on 2026-07-30 and they may not come back: Chromium
   * mis-interpolates its variable system font at weight 900 from their mere
   * PRESENCE in the list, at any position, so they cannot sit here as a net. */
  assert.doesNotMatch(stack, /system-ui|-apple-system/, "the stack contains system-ui or -apple-system, which the game dropped on 2026-07-30 to escape Chromium's variable-font interpolation bug");
  assert.match(stack, /sans-serif$/, 'the stack needs its generic tail so a load that loses the optional race still paints something chosen');
});

test('all four wordmark surfaces paint the mark in the display face', options, () => {
  /* The hero, and the three lockups. Each carries data-wordmark because the two
   * chromatic layers are ::before/::after copies drawn with
   * content:attr(data-wordmark); without the attribute the layers render empty
   * and the mark silently loses its pink and cyan. */
  assert.match(index, /<h1 class="whomp-wordmark" data-wordmark="WHOMP">/, 'the landing hero is not the wordmark element');
  assert.match(index, /<b class="brandword" data-wordmark="WHOMP">WHOMP<\/b>/, 'the landing nav lockup does not paint WHOMP in the display face');
  assert.match(log, /<b class="brandword" data-wordmark="WHOMP">WHOMP<\/b> dev log/, 'the dev log header does not paint WHOMP in the display face');
  assert.match(wiki, /<b class="brandword" data-wordmark="WHOMP">WHOMP<\/b> wiki/, 'the wiki header does not paint WHOMP in the display face');

  for (const [name, html] of publicPages()) {
    const rule = html.split(/\.whomp-wordmark,\.brandword\{/)[1]?.split('}')[0] ?? '';
    assert.match(rule, /font-family:var\(--wordmark-font\)/, `${name} does not draw the wordmark from --wordmark-font`);
    /* Cream over pink over cyan, the stroke, and the skew: the four things that
     * make it the WHOMP mark rather than a heavy word. */
    assert.match(rule, /color:#fff3cf/, `${name}'s wordmark face is not the brand cream`);
    assert.match(rule, /-webkit-text-stroke:0\.018em #151023/, `${name}'s wordmark has lost its outline`);
    assert.match(rule, /paint-order:stroke fill/, `${name}'s wordmark has lost paint-order, so the stroke draws across the letters it overlaps`);
    assert.match(rule, /transform:skewX\(-4deg\) rotate\(-1deg\)/, `${name}'s wordmark has lost the skew`);
    assert.match(html, /\.whomp-wordmark::before,\.brandword::before\{transform:translate\(-0\.048em,0\.048em\)/, `${name} has lost the pink layer's offset`);
    assert.match(html, /\.whomp-wordmark::after,\.brandword::after\{color:#24f0ff/, `${name} has lost the cyan layer`);
  }
});

test('the wordmark surfaces no longer wear the text-shadow-only treatment', options, () => {
  /* .chroma keeps its job as the section-heading signature everywhere else. It
   * was only ever wrong on the two headings that CONTAIN the logo, where it
   * dressed "dev log" in the wordmark's costume and gave the wordmark itself no
   * face, no stroke, no layers and no skew. */
  assert.doesNotMatch(log, /<h1 class="chroma">WHOMP dev log<\/h1>/, 'the dev log header is still the text-shadow-only treatment');
  assert.doesNotMatch(wiki, /<h1 class="chroma">WHOMP wiki<\/h1>/, 'the wiki header is still the text-shadow-only treatment');
  const lockup = index.split(/\.brandmark b\{/)[1]?.split('}')[0] ?? '';
  assert.doesNotMatch(lockup, /font-weight|letter-spacing|color/, 'the nav lockup restates the mark\'s own declarations, which is how it ended up the body face at 900 with positive tracking');
});

test('the stale 2026-07-30 parity claim is gone, and what replaced it is true', options, () => {
  for (const [name, html] of publicPages()) {
    assert.doesNotMatch(html, /so both surfaces\s*\n?\s*stay identical/,
      `${name} still carries the 2026-07-30 note claiming the site and the game stay identical. It stopped being true the same day it was written.`);
  }
  /* The replacement is not prose anybody has to keep true: it names the shared
   * file, and bin/brand-parity.mjs fails the build when the file drifts. */
  assert.match(index, /brand\/whomp-display\.woff2/, 'the wordmark comment should name the shared file it is now pinned to');
});

test('one mark, one silhouette: the inline copy is canonical square', options, () => {
  for (const [name, html] of publicPages()) {
    const rects = [...html.matchAll(/<rect width="512" height="512"([^>]*)\/>/g)].map((m) => m[1]);
    for (const attrs of rects) {
      assert.doesNotMatch(attrs, /\brx=/,
        `${name} draws the mark's backing rect with an rx, but the canonical whomp/public/icons/icon.svg rect is square. Chrome rounding belongs in --tile-radius.`);
    }
  }
});

test('the chrome tile radius is named once and every lockup reads it', options, () => {
  assert.match(index, /--tile-radius:\s*\d/, 'no --tile-radius token');
  for (const [name, html] of publicPages()) {
    const hardRounded = [...html.matchAll(/\.(brandmark img|wiki-home-icon|brand \.wm)\{[^}]*border-radius:\s*(\d+px)/g)];
    assert.equal(hardRounded.length, 0,
      `${name} rounds a mark lockup with a literal radius (${hardRounded.map((m) => `${m[1]} -> ${m[2]}`).join(', ')}) instead of var(--tile-radius)`);
  }
});

test('the rendered rarity ladder is the game table the site follows, in full', options, () => {
  /* Derived from the game's RELIC_RARITY_COLOR at build time, never transcribed.
   * This asserts the SHAPE reached the page -- five rungs, each with a colour and
   * a matching .35-alpha border. bin/brand-parity.mjs is what compares the actual
   * hexes against the game checkout, because only it has one to read. */
  const rungs = [...wiki.matchAll(/\.wtag\.ink-rarity-([a-z0-9-]+)\{color:(#[0-9a-fA-F]{6});border-color:rgba\((\d+),(\d+),(\d+),0\.35\)\}/g)];
  assert.ok(rungs.length >= 5, `the wiki paints ${rungs.length} rarity rungs; the game ships five`);
  for (const [, rung, hex, r, g, b] of rungs) {
    const expected = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    assert.deepEqual([Number(r), Number(g), Number(b)], expected,
      `rarity "${rung}" has a border that is not a faint copy of its own colour, which is a drift only a person looking closely would ever catch`);
  }
});

test('bin/brand-parity.mjs runs, and is honest when it has no game checkout', () => {
  /* Pointed at a path that is deliberately not a game repo: every game-side pin
   * must degrade to a NOTE rather than throwing or silently passing. This is the
   * negative test the game repo's own law asks for -- fired on purpose before the
   * check was believed. */
  const out = execFileSync(process.execPath, [join(SITE_ROOT, 'bin/brand-parity.mjs'), '--repo', join(SITE_ROOT, 'tests')], { encoding: 'utf8' });
  assert.match(out, /SITE NOTE:/, 'with no game checkout every comparison should report as a note');
  assert.doesNotMatch(out, /could not be compared[\s\S]*SITE WARNING: .*byte-compared/, 'a missing game checkout must never raise a warning');
  assert.match(out, /brand parity: clean/, 'the check should exit clean when the only findings are notes');
});
