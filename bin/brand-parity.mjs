#!/usr/bin/env node
/** BRAND PARITY: the site and the game paint the same mark, proved rather than
 *  remembered.
 *
 *  WHY THIS FILE EXISTS. On 2026-07-30 the game dropped 'system-ui' and
 *  '-apple-system' from the wordmark's stack to escape a Chromium
 *  variable-font interpolation bug. The site did not. The comment in
 *  bin/generate.mjs went on claiming both surfaces "stay identical" for six
 *  weeks, and nobody noticed, because the only symptom of a wrong font stack is
 *  a letterform, and nobody diffs letterforms. That is the same class of failure
 *  as a hand-copied colour table: a cache with no invalidation.
 *
 *  So parity is a CHECK now, not a sentence. Every claim this site makes about
 *  matching the game is pinned here to the game's own file, and a drift fails
 *  the build the way a dropped arc does.
 *
 *  WHAT IS PINNED, and against what:
 *    1. the font FILE      brand/whomp-display.woff2 against the game's
 *                          public/brand/whomp-display.woff2, by sha256 over the
 *                          bytes. Same file or it is not the same letterform.
 *    2. the OFL text       brand/OFL-ArchivoBlack.txt, same way. The licence
 *                          travels with the font; shipping the face without it
 *                          is the one thing SIL OFL 1.1 actually forbids.
 *    3. the @font-face     family, weight and display, against the game's
 *                          index.html head. font-weight:900 is the one that
 *                          matters: Archivo Black is a single-weight file, and a
 *                          face that does not claim 900 is taken for a 400 and
 *                          gets a SYNTHESIZED, smeared bold -- the exact squish
 *                          the director reported twice.
 *    4. the STACK          --wordmark-font against the game's
 *                          WHOMP_WORDMARK_FONT, normalised for whitespace only.
 *
 *  AND THE RARITY LADDER, which is the half that needs the most explaining.
 *
 *  THE GAME HAS TWO RARITY PALETTES AND THEY DISAGREE. src/data/relics.ts holds
 *  RELIC_RARITY_COLOR (the relic ladder) and src/ui/whompOfferTheme.ts holds
 *  WHOMP_RARITY_INK (the weapon and passive ladder). They agree on `uncommon`
 *  and on nothing else. The wiki paints relic pills, and relics are the only
 *  domain it paints by rarity at all, so it follows RELIC_RARITY_COLOR -- and it
 *  already did, derived at build time by parseRelicRarityInk, never transcribed.
 *
 *  The 2026-09-12 brand cohesion audit read this as the site disagreeing with
 *  the game and asked for the wiki to be re-pointed at WHOMP_RARITY_INK. That
 *  would paint relics in the weapon ladder and put the wiki at odds with the
 *  surface it documents: the game's own shop and relic UI draw relics with
 *  RELIC_RARITY_COLOR. The disagreement is real, but it is GAME-SIDE, between
 *  two game tables, and this repo does not get to settle it -- exactly as the
 *  long note in bin/generate.mjs has said since the ladder was first derived.
 *
 *  So this file does the thing that is actually in scope and actually protects
 *  the reader: it pins the wiki's rendered ladder to the game table the site
 *  follows (a real WARNING if that ever drifts), and it reports the game-side
 *  divergence as a NOTE every run so it stays visible and attributed upstream
 *  instead of being quietly re-decided here. That is this repo's own two
 *  severity law: wrong and ours is a warning, true and owned upstream is a note.
 *
 *  USAGE: node bin/brand-parity.mjs [--repo ../whomp] [--outdir .]
 *  Exit 0 clean, 1 on any WARNING. NOTEs never fail it.
 */
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};
const REPO = resolve(arg('--repo', join(SITE_ROOT, '../whomp')));
const OUTDIR = resolve(arg('--outdir', SITE_ROOT));

const warnings = [];
const notes = [];
const warn = (m) => { warnings.push(m); console.warn(`SITE WARNING: ${m}`); };
const note = (m) => { notes.push(m); console.log(`SITE NOTE: ${m}`); };
const ok = (m) => console.log(`  ok  ${m}`);

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const collapse = (s) => String(s).replace(/\s+/g, '');
const readIf = (path) => (existsSync(path) ? readFileSync(path, 'utf8') : null);

/* THE GAME CHECKOUT IS OPTIONAL HERE, and that is deliberate rather than lax.
 * The font landed in the game on branch claude/brand-wordmark-asset and has not
 * reached main; a site build against a main checkout would otherwise fail on the
 * absence of a file the game has not published yet. A missing game-side source is
 * a NOTE naming the branch. Once it lands, every pin below becomes live with no
 * edit here -- the check gets STRICTER by the game moving, never looser. */
const gameHas = (rel) => existsSync(join(REPO, rel));

console.log('brand parity: the site and the game paint one mark');

// ---------------------------------------------------------------- 1 + 2. the shipped files
const FILE_PINS = [
  { site: 'brand/whomp-display.woff2', game: 'public/brand/whomp-display.woff2', what: 'the wordmark face' },
  { site: 'brand/OFL-ArchivoBlack.txt', game: 'public/brand/OFL-ArchivoBlack.txt', what: "Archivo Black's SIL OFL 1.1 text" },
];
for (const pin of FILE_PINS) {
  const sitePath = join(OUTDIR, ...pin.site.split('/'));
  if (!existsSync(sitePath)) {
    warn(`${pin.site} is missing from the site. ${pin.what} is served from this repo, so the file has to be in it.`);
    continue;
  }
  const siteHash = sha256(readFileSync(sitePath));
  if (!gameHas(pin.game)) {
    note(`${pin.game} is not in the game checkout at ${REPO}, so ${pin.site} could not be byte-compared. It landed on the game's claude/brand-wordmark-asset branch and reaches main when that lane does; this pin goes live on its own when it does.`);
    continue;
  }
  const gameHash = sha256(readFileSync(join(REPO, ...pin.game.split('/'))));
  if (siteHash !== gameHash) {
    warn(`${pin.site} is not the same file as the game's ${pin.game} (site sha256 ${siteHash.slice(0, 12)}, game ${gameHash.slice(0, 12)}). Copy the game's file across; two builds of one face are two faces.`);
  } else {
    ok(`${pin.site} is byte-identical to the game's (sha256 ${siteHash.slice(0, 12)}, ${readFileSync(sitePath).length} B)`);
  }
}

// ---------------------------------------------------------------- 3. the @font-face
const siteGenerator = readFileSync(join(SITE_ROOT, 'bin/generate.mjs'), 'utf8');
const faceBlock = (source) => {
  const block = source.split(/@font-face\s*\{/)[1]?.split('}')[0] ?? '';
  return {
    family: (block.match(/font-family:\s*'([^']+)'/) || [])[1] ?? '',
    weight: (block.match(/font-weight:\s*(\d+)/) || [])[1] ?? '',
    display: (block.match(/font-display:\s*([a-z]+)/) || [])[1] ?? '',
    src: (block.match(/url\(([^)]+)\)/) || [])[1] ?? '',
  };
};
const siteFace = faceBlock(siteGenerator);
if (siteFace.family !== 'WHOMP Display' || siteFace.weight !== '900' || siteFace.display !== 'optional') {
  warn(`the site's @font-face is ${JSON.stringify(siteFace)}. It must declare family 'WHOMP Display', font-weight:900 and font-display:optional. 900 is not boilerplate: Archivo Black is a single-weight file and a face that does not claim 900 gets a synthesized, smeared bold.`);
} else {
  ok(`@font-face declares 'WHOMP Display' 900 optional, src ${siteFace.src}`);
}
if (!siteGenerator.includes('rel="preload"') || !siteGenerator.includes('as="font"') || !/crossorigin/.test(siteGenerator)) {
  warn('the site head has no crossorigin font preload. Without it font-display:optional loses its race on a cold load and the face never paints; without crossorigin the file is fetched twice.');
} else {
  ok('the head preloads the face with crossorigin');
}

const gameIndex = readIf(join(REPO, 'index.html'));
if (gameIndex && /@font-face/.test(gameIndex)) {
  const gameFace = faceBlock(gameIndex);
  for (const key of ['family', 'weight', 'display']) {
    if (siteFace[key] !== gameFace[key]) {
      warn(`@font-face ${key} is "${siteFace[key]}" on the site and "${gameFace[key]}" in the game's index.html. The declaration is copied from the game and must stay copied.`);
    }
  }
  if (siteFace.family === gameFace.family && siteFace.weight === gameFace.weight && siteFace.display === gameFace.display) {
    ok("the @font-face matches the game's index.html declaration");
  }
} else {
  note(`no @font-face found in ${REPO}/index.html, so the declaration could not be compared against the game's. It lands with the game's claude/brand-wordmark-asset branch.`);
}

// ---------------------------------------------------------------- 4. the stack
const siteStack = (siteGenerator.match(/--wordmark-font:\s*([^;]+);/) || [])[1] ?? '';
if (!siteStack) {
  warn('no --wordmark-font token found in bin/generate.mjs. The wordmark stack is written down once, in :root, so this check can find it.');
} else if (/system-ui|-apple-system/.test(siteStack)) {
  warn(`--wordmark-font contains 'system-ui' or '-apple-system': ${siteStack}. The game dropped both on 2026-07-30 because Chromium mis-interpolates its variable system font at weight 900 from their mere presence in the list, at any position. They cannot sit here as a fallback.`);
}
const themePath = join(REPO, 'src/ui/whompOfferTheme.ts');
const theme = readIf(themePath);
if (theme && /WHOMP_WORDMARK_FONT/.test(theme)) {
  const gameStack = (theme.match(/WHOMP_WORDMARK_FONT\s*=\s*`([^`]+)`/) || [])[1] ?? '';
  if (gameStack && collapse(gameStack) !== collapse(siteStack)) {
    warn(`the wordmark stack differs from the game's WHOMP_WORDMARK_FONT.\n    site: ${siteStack}\n    game: ${gameStack}\n  This is the exact drift that went unnoticed from 2026-07-30 to 2026-09-12.`);
  } else if (gameStack) {
    ok('--wordmark-font matches the game\'s WHOMP_WORDMARK_FONT exactly');
  }
} else {
  note(`WHOMP_WORDMARK_FONT is not in ${themePath}, so the stack could not be compared against the game's. It lands with the game's claude/brand-wordmark-asset branch.`);
}

// ---------------------------------------------------------------- the rarity ladder
/* Parsed the same narrow way bin/wiki.mjs parses the relic table, and on purpose:
 * a shape this cannot read must fail loudly rather than be guessed at. */
const inkTable = (source, name) => {
  const text = String(source || '');
  const block = text.split(new RegExp(`export const ${name}\\b[^=]*=\\s*(?:Object\\.freeze\\()?\\{`))[1]?.split(/\n?\}/)[0] ?? '';
  /* A rung may be written as a hex literal or as a reference to a palette
   * constant in the same file (WHOMP_RARITY_INK spells rare and epic as
   * WHOMP_CYAN and WHOMP_VIOLET). Resolving one hop of indirection is the
   * difference between reporting the divergence as 2 rungs and as the 4 it
   * really is. Deliberately ONE hop and same-file only: anything deeper is a
   * shape this should not guess at, and an unresolved rung is simply absent
   * rather than wrong. */
  const constants = Object.fromEntries(
    [...text.matchAll(/export const ([A-Z][A-Z0-9_]*)\s*=\s*'(#[0-9a-fA-F]{6})'/g)].map((m) => [m[1], m[2].toLowerCase()]),
  );
  return Object.fromEntries(
    [...block.matchAll(/([A-Za-z_$][\w$]*)\s*:\s*(?:'(#[0-9a-fA-F]{6})'|([A-Z][A-Z0-9_]*))/g)]
      .map((m) => [m[1], m[2] ? m[2].toLowerCase() : constants[m[3]]])
      .filter(([, hex]) => hex),
  );
};

const relicsSource = readIf(join(REPO, 'src/data/relics.ts'));
if (!relicsSource) {
  note(`no ${REPO}/src/data/relics.ts, so the rendered rarity ladder could not be checked against the game.`);
} else {
  const gameLadder = inkTable(relicsSource, 'RELIC_RARITY_COLOR');
  const wikiHtml = readIf(join(OUTDIR, 'wiki.html'));
  if (Object.keys(gameLadder).length === 0) {
    warn('RELIC_RARITY_COLOR could not be parsed from the game. The wiki ladder is read from the game rather than kept here, so a shape this cannot read stops the run.');
  } else if (!wikiHtml) {
    note('wiki.html has not been generated yet, so the rendered ladder was not compared. Run bin/generate.mjs first.');
  } else {
    const rendered = Object.fromEntries(
      [...wikiHtml.matchAll(/\.wtag\.ink-rarity-([a-z0-9-]+)\{color:(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2].toLowerCase()]),
    );
    const missing = Object.keys(gameLadder).filter((rung) => !(rung in rendered));
    const wrong = Object.entries(gameLadder).filter(([rung, hex]) => rendered[rung] && rendered[rung] !== hex);
    if (missing.length) {
      warn(`the game ships rarity rungs the generated wiki does not paint: ${missing.join(', ')}. Regenerate, or fix parseRelicRarityInk in bin/wiki.mjs.`);
    }
    for (const [rung, hex] of wrong) {
      warn(`wiki.html paints rarity "${rung}" ${rendered[rung]} but the game's RELIC_RARITY_COLOR says ${hex}. The ladder is derived, so this means the committed pages are stale: run bin/regenerate-and-verify.sh.`);
    }
    if (!missing.length && !wrong.length) {
      ok(`all ${Object.keys(gameLadder).length} rarity rungs match the game's RELIC_RARITY_COLOR (${Object.entries(gameLadder).map(([k, v]) => `${k} ${v}`).join(', ')})`);
    }
  }

  /* The game-side divergence, reported every run so it cannot go quiet. */
  const themeLadder = theme ? inkTable(theme, 'WHOMP_RARITY_INK') : {};
  if (Object.keys(themeLadder).length) {
    const shared = Object.keys(themeLadder).filter((rung) => rung in gameLadder);
    const differ = shared.filter((rung) => themeLadder[rung] !== gameLadder[rung]);
    if (differ.length) {
      note(
        `the game carries TWO rarity ladders and they disagree on ${differ.length} of ${shared.length} shared rungs `
        + `(${differ.map((rung) => `${rung}: relics ${gameLadder[rung]} vs theme ${themeLadder[rung]}`).join('; ')}). `
        + 'src/data/relics.ts RELIC_RARITY_COLOR is the relic ladder and is what this wiki paints relic pills with, because relics are the only domain it paints by rarity and the game\'s own shop draws them the same way. '
        + 'src/ui/whompOfferTheme.ts WHOMP_RARITY_INK is the weapon and passive ladder. Unifying them is a game-side decision and is deliberately not made from this repo.',
      );
    }
  } else if (theme) {
    note('WHOMP_RARITY_INK could not be parsed from the game theme, so the two-ladder divergence could not be re-measured this run.');
  }
}

// ---------------------------------------------------------------- the mark's geometry
/* One drawing of the mark, one silhouette. The site inlines the W for the dev
 * log's topbar and serves it as a file everywhere else; the two were different
 * shapes because the inline copy had a rounded backing rect and the canonical
 * file does not. Any rounding is the site's chrome and lives in --tile-radius. */
const canonicalIcon = readIf(join(REPO, 'public/icons/icon.svg'));
const inlineRect = (siteGenerator.match(/<rect width="512" height="512"([^>]*)\/>/) || [])[1] ?? '';
if (/\brx=/.test(inlineRect)) {
  warn(`the site's inline mark draws its backing rect with${inlineRect.trim() ? ` ${inlineRect.trim()}` : ' an rx'}, but the canonical whomp/public/icons/icon.svg rect is square. Two silhouettes of one mark. Chrome rounding belongs in --tile-radius.`);
} else {
  ok('the inline mark uses the canonical square geometry');
}
if (canonicalIcon && /\brx=/.test(canonicalIcon)) {
  note('the canonical game icon has grown an rx. The site follows it; re-check the inline copy above.');
}
if (!/--tile-radius/.test(siteGenerator)) {
  warn('no --tile-radius token in bin/generate.mjs. The chrome tile radius is named once so two lockups cannot round the same mark differently.');
} else {
  ok('--tile-radius names the chrome tile radius once');
}

// ---------------------------------------------------------------- verdict
console.log('');
if (warnings.length) {
  console.error(`brand parity: ${warnings.length} WARNING(s), ${notes.length} note(s)`);
  process.exit(1);
}
console.log(`brand parity: clean (${notes.length} note(s))`);
