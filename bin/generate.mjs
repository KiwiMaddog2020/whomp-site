#!/usr/bin/env node
/** THE WHOMP SITE GENERATOR, the generated spine.
 *
 *  "Generated spine, authored highlights": a job derives deploys, the live sha,
 *  the campaign arcs and the known-bug counts FROM THE REPO, so the site cannot
 *  go stale or lie, and Kevin writes short human notes on top for the part a
 *  machine cannot pick: which changes actually mattered to a player.
 *
 *  IT NEVER TOUCHES THE GAME REPO. It reads. The site lives in its own repo on
 *  GitHub Pages precisely so a site edit can never bump the game's build sha,
 *  which the net handshake compares EXACTLY and which would lock out every peer
 *  mid-session.
 *
 *  THREE SURFACES, from one run:
 *    index.html  : the short public landing page. Mark, tagline, live build
 *                  chip, play button, arcs. Never grows.
 *    log.html    : the real dev log, sidebar, search, filters, and the two-view
 *                  toggle (Kevin's authored CONCISE notes vs the generated FULL
 *                  raw engineering log).
 *    wiki*.html  : the generated encyclopedia, controlled-sim evidence, and
 *                  canonical visual associations from three verified artifacts.
 *  All read a shared search-index.json written alongside them, built at
 *  generate time from everything on the page: notes, commits, known bugs, arcs.
 *
 *  KNOWN BUGS, director change 2026-07-30: publishing individual tester reports
 *  verbatim on a public URL is not the same thing as publishing a changelog, and
 *  testers did not sign up for that. The public page gets an AGGREGATE ONLY
 *  summary (fixed/open totals, an area breakdown, a severity shape, one or two
 *  authored sentences), all counts derived by keyword classifier over the
 *  OPEN table, never a hand list of report ids. The real per-report text stays
 *  out of both log.html's public section and search-index.json. See
 *  parseOpenBugs / classifyBugArea / classifyBugSeverity below.
 *
 *  GATING, director change 2026-07-30: the log is PUBLIC for now (testers should
 *  be able to just reach it), but the sign-in control still works and a single
 *  GATING_ENABLED flag right below (not in log.html's own script anymore, this
 *  file is now the one place to flip it) turns real gating back on later, AND
 *  controls whether the OWNER-ONLY per-report bug section even gets generated.
 *  See the comment on that constant and on ownerBugSection further down.
 *
 *  USAGE: node bin/generate.mjs [--repo ../whomp] [--outdir .] [--offline]
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { writeFileSync, readFileSync, readdirSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { resolve, join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listTrackedGeneratedFiles } from './generated-output-git.mjs';
import { buildWiki, rosterSpecs, visualOutputPath, WIKI_CSS } from './wiki.mjs';

const SITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};
const REPO = resolve(arg('--repo', '../whomp'));
const OUTDIR = resolve(arg('--outdir', SITE_ROOT));
const OFFLINE = args.includes('--offline');
/* THE DEPLOY KNOWS WHAT IT SHIPPED; THE NETWORK DOES NOT, YET. Fetching
 * version.json right after a deploy races GitHub Pages propagation, and the loser
 * is the site confidently reporting the PREVIOUS build as live. So the deploy
 * ritual passes what it just shipped and no fetch happens at all. Everything else
 * (a cron, a hand run) still fetches, which is correct for them because they have
 * no privileged knowledge. */
const SHA_ARG = arg('--sha', '');
const VERSION_ARG = arg('--version', '');
const LIVE_URL = 'https://kiwimaddog2020.github.io/whomp-play';

/* GATING, single flag, one place to flip. Director change 2026-07-30: the log
 * is public today, so this is false. It drives two things at once:
 *   1. the runtime switch in log.html's own script (interpolated in below),
 *      which is what real reader gating turns on later.
 *   2. whether the OWNER-ONLY per-report bug detail is generated AT ALL. When
 *      this is false, the generator never builds that section's markup or
 *      data, so there is nothing to hide with CSS, it is genuinely absent
 *      from log.html and search-index.json. See the ownerBugSection comment
 *      near the bugs section below for how it turns on later, and the real
 *      caveat about static hosting once it does. */
const GATING_ENABLED = false;
const OWNER_EMAIL = 'kevinmadson@protonmail.com';

const git = (...a) => execFileSync('git', ['-C', REPO, ...a], { encoding: 'utf8' }).trim();

// ---------------------------------------------------------------- text helpers
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'x';

/** Source docs in the game repo were written for engineers and sometimes carry
 *  an em dash. NO EM DASHES ANYWHERE is a site law, so any text pulled from a
 *  source doc goes through this before it reaches HTML. */
const EM_DASH = String.fromCharCode(8212);
const EN_DASH = String.fromCharCode(8211);
const noEmDash = (s) => String(s)
  .replace(new RegExp(`\\s*${EM_DASH}\\s*`, 'g'), ', ')
  .replace(new RegExp(`\\s*${EN_DASH}\\s*`, 'g'), '-')
  .replace(new RegExp(EM_DASH, 'g'), '-')
  .replace(new RegExp(EN_DASH, 'g'), '-');

/** Strips markdown decoration (bold, backticks) from text lifted out of a repo
 *  doc, then runs it through noEmDash. Used for bug-inventory / backlog text
 *  that was authored for engineers, not for the inline markdown in notes/. */
const cleanDoc = (s) => noEmDash(String(s).replace(/\*\*/g, '').replace(/`([^`]*)`/g, '$1').replace(/\s+/g, ' ').trim());

/** Minimal inline markdown for notes/*.md body text: escape first, then apply
 *  **bold** and ||spoiler|| on the escaped (safe) string. No other markdown is
 *  supported on purpose: notes are prose, not documents. */
const mdInline = (s) => noEmDash(esc(s))
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/\|\|(.+?)\|\|/g, '<span class="spoiler" tabindex="0" role="button" aria-label="Spoiler, click to reveal">$1</span>');

// ---------------------------------------------------------------- derive: the game's own content
/* data/game-data.json is the game repo's SHARED DATA LAYER: every registry in
 * src/data, emitted verbatim, plus the `refs` inversions that exist in no single
 * source file ("which levels does the Wraith spawn in" is stored on the level,
 * not on the enemy). It is generated by whomp/bin/data-layer.mjs and pinned
 * against live src/data by whomp/tests/dataLayer.test.mjs, so it cannot drift
 * from what the game actually runs on.
 *
 * THIS IS THE ONLY WAY THE WIKI IS ALLOWED TO KNOW A NUMBER. A wiki page that
 * retypes a weapon's damage is a cache with no invalidation, which is the exact
 * failure this whole file exists to stop repeating.
 *
 * LOUD ON MISSING, same law as parseGameTaglines above: if the artifact is gone
 * or its schema moved, the run stops. A wiki that silently renders an empty
 * roster is worse than a build that refuses, because nobody notices the first
 * one until a reader does. */
/* VERIFY BEFORE CONSUME. These artifacts are committed caches of canonical
 * game data and simulation evidence, so schema checks alone are not enough:
 * schema-valid stale JSON would still let the wiki publish a confident lie.
 * Run each artifact owner's deterministic pin before this process reads any
 * artifact. execFileSync is intentionally fail-closed; a non-zero exit stops
 * generation before any output can be written. The visual artifact uses its
 * full rerender verification gate because source-valid PNG metadata alone does
 * not authenticate the canonical runtime render bytes. */
function verifyGameArtifact(script, flag, artifact) {
  const scriptPath = join(REPO, 'bin', script);
  if (!existsSync(scriptPath)) {
    throw new Error(`Cannot verify ${artifact}: ${scriptPath} does not exist.`);
  }
  console.log(`verifying ${artifact}: node bin/${script} ${flag}`);
  try {
    execFileSync(process.execPath, [scriptPath, flag], { cwd: REPO, stdio: 'inherit' });
  } catch (error) {
    const status = Number.isInteger(error?.status) ? ` (exit ${error.status})` : '';
    throw new Error(`Refusing to build the wiki: ${artifact} failed its canonical verification${status}.`, { cause: error });
  }
}

const gameTreeStatus = git('status', '--porcelain=v1', '--untracked-files=all');
if (gameTreeStatus) {
  const changedPaths = gameTreeStatus.split('\n').map((line) => line.slice(3)).filter(Boolean);
  throw new Error(`Refusing to label dirty source data as game@HEAD. Commit or otherwise clear the game checkout first. Dirty paths: ${changedPaths.join(', ')}`);
}

verifyGameArtifact('data-layer.mjs', '--check', 'data/game-data.json');
verifyGameArtifact('tier-engine.mjs', '--verify', 'data/tier-rankings.json');
verifyGameArtifact('wiki-visuals.mjs', '--verify', 'data/wiki-visuals.json');

const DATA_PATH = join(REPO, 'data/game-data.json');
if (!existsSync(DATA_PATH)) {
  throw new Error(`No data layer at ${DATA_PATH}. The wiki pages derive every number from it and will not invent one. Run "node bin/data-layer.mjs" in the game repo, or drop the wiki pages from this generator.`);
}
const gameData = JSON.parse(readFileSync(DATA_PATH, 'utf8'));
if (gameData.schema !== 9) {
  throw new Error(`data/game-data.json is schema ${gameData.schema}, this generator requires schema 9. Read the game repo's data/README.md and update bin/wiki.mjs rather than shipping pages built against a shape that moved.`);
}

const TIER_PATH = join(REPO, 'data/tier-rankings.json');
if (!existsSync(TIER_PATH)) {
  throw new Error(`No measured tier artifact at ${TIER_PATH}. Run "node bin/tier-engine.mjs" in the game repo; the wiki will not replace measurements with hand-ranked tiers.`);
}
const tierData = JSON.parse(readFileSync(TIER_PATH, 'utf8'));
if (tierData.schema !== 2) {
  throw new Error(`data/tier-rankings.json is schema ${tierData.schema}, this generator understands schema 2. Update bin/wiki.mjs and this consumer before publishing a moved measurement contract.`);
}

const VISUAL_PATH = join(REPO, 'data/wiki-visuals.json');
if (!existsSync(VISUAL_PATH)) {
  throw new Error(`No visual encyclopedia artifact at ${VISUAL_PATH}. Run "node bin/wiki-visuals.mjs" in the game repo; the wiki will not invent or manually map game art.`);
}
const visualData = JSON.parse(readFileSync(VISUAL_PATH, 'utf8'));
if (visualData.schema !== 1) {
  throw new Error(`data/wiki-visuals.json is schema ${visualData.schema}, this generator understands schema 1. Update bin/wiki.mjs and this consumer before publishing a moved visual contract.`);
}

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const safeGeneratedPath = (path) => typeof path === 'string' && path.length > 0
  && path.split('/').every((part) => /^[a-z0-9][a-z0-9._-]*$/.test(part) && part !== '.' && part !== '..');
const portable = (path) => path.split(sep).join('/');
const sha256Bytes = (bytes) => createHash('sha256').update(bytes).digest('hex');
const pngDimensions = (bytes, label) => {
  if (!Buffer.isBuffer(bytes) || bytes.length < 24 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)
    || bytes.subarray(12, 16).toString('ascii') !== 'IHDR') {
    throw new Error(`Visual source ${label} is not a valid PNG envelope.`);
  }
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
};
const visualAssets = (visualData.entries || []).flatMap((entry) => (entry.variants || []).map((variant) => {
  const file = visualOutputPath(variant.path);
  if (!safeGeneratedPath(file) || !file.startsWith('wiki-assets/')) {
    throw new Error(`Visual output path ${file} is outside the generated wiki-assets namespace.`);
  }
  const source = join(REPO, ...variant.path.split('/'));
  if (!existsSync(source)) throw new Error(`Visual source asset is missing: ${source}`);
  const bytes = readFileSync(source);
  const dimensions = pngDimensions(bytes, variant.path);
  if (bytes.length !== variant.byteSize || sha256Bytes(bytes) !== variant.sha256
    || dimensions.width !== variant.width || dimensions.height !== variant.height) {
    throw new Error(`Visual source asset does not match manifest bytes, hash or dimensions: ${variant.path}`);
  }
  return { file, source, bytes, variant };
}));
if (new Set(visualAssets.map((asset) => asset.file)).size !== visualAssets.length) {
  throw new Error('Visual manifest maps more than one source variant to the same generated output path.');
}

const DESKTOP_ICON_PATH = join(REPO, 'public/icons/icon.svg');
if (!existsSync(DESKTOP_ICON_PATH)) {
  throw new Error(`No canonical WHOMP desktop icon at ${DESKTOP_ICON_PATH}. The wiki navigation will not redraw or approximate it.`);
}
const desktopIconSvg = readFileSync(DESKTOP_ICON_PATH, 'utf8');

// ---------------------------------------------------------------- derive: identity
const pkg = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8'));
/* AUTHORED, deliberately NOT derived from package.json. The repo description is
 * written for developers and name-drops the two games WHOMP gets compared to,
 * which the director cut as "a bit much" for a public page: leading with someone
 * else's games sells theirs, not ours. This is the one string on the site that is
 * marketing copy rather than repo truth, so it lives here and Kevin owns it. */
const TAGLINE = 'A 3D horde-survivor where you aim it yourself.';

/* Provenance names the exact checkout whose artifacts were just verified, not
 * whatever commit the local `main` ref happens to point at. Deploy normally
 * consumes main, but explicit --repo worktrees must not be mislabeled. */
const headSha = git('rev-parse', '--short', 'HEAD');

// ---------------------------------------------------------------- derive: title screen wordmark + slogans
/* Director change 2026-07-30: "copy the title from the title screen EXACTLY"
 * and "use the same rotating slogans... under the title". Both come straight
 * out of whomp/src/ui/mainMenu.ts, the game's own source of truth, so this
 * page can never drift from what the title screen actually says or does.
 * TAGLINES is parsed out of the exported array rather than hand-copied, same
 * derive-not-duplicate reasoning as arcs/bugs above: the strings are the
 * game's own authored copy, and a hand-copy is exactly the kind of thing that
 * goes stale the next time someone tunes a line in the game. */
function parseGameTaglines() {
  const path = join(REPO, 'src/ui/mainMenu.ts');
  if (!existsSync(path)) return [];
  const raw = readFileSync(path, 'utf8');
  const block = raw.split(/export const TAGLINES: readonly string\[\] = \[/)[1]?.split(/\n\];/)[0] ?? '';
  return [...block.matchAll(/'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g)]
    .map((m) => (m[1] ?? m[2]).replace(/\\'/g, "'").replace(/\\"/g, '"'));
}
const gameTaglines = parseGameTaglines();
if (gameTaglines.length === 0) {
  throw new Error('No TAGLINES parsed from whomp/src/ui/mainMenu.ts. The title screen file moved or its export shape changed, fix parseGameTaglines rather than shipping an empty rotation.');
}

// ---------------------------------------------------------------- derive: what is actually live
/* The live sha is the ONLY proof of live (deploy-verification law), so the site
 * reports it as measured, and says so plainly when it could not measure it. */
let live = null;
if (SHA_ARG) {
  live = { sha: SHA_ARG, version: VERSION_ARG || pkg.version, builtAt: null };
} else if (!OFFLINE) {
  try {
    const r = await fetch(`${LIVE_URL}/version.json`, { signal: AbortSignal.timeout(8000) });
    if (r.ok) live = await r.json();
  } catch { /* offline build; the page says so rather than inventing a sha */ }
}

// ---------------------------------------------------------------- derive: the full shipped feed
/* Conventional-commit subjects are the source. Docs/chore/test commits are not
 * player-visible and are filtered out, so the feed reads as changes rather than
 * as a commit log. The count of what was filtered is kept and shown, because a
 * silently truncated feed reads as "that was everything" when it was not
 * (no-silent-caps law). This is the FULL view's raw material; log.html labels
 * it honestly as the raw engineering log, unedited. */
/* ── THE WINDOW IS A TIMEFRAME, NOT A COMMIT COUNT (director, 2026-08-01) ───
 * "Reword it to say what it is - a recent window... let's change it to a
 * timeframe though." So the DERIVATION moved, not just the wording: a sentence
 * that says "the last 7 days" over a number computed from the last 2000 commits
 * would be a second version of the same defect, agreeing by luck until the pace
 * changed.
 *
 * WHY SEVEN, AND WHY THE BOUNDARY IS MIDNIGHT. Measured against the repo on
 * 2026-08-01 rather than chosen for the round number:
 *
 *     window        player-visible   active days   raw commits
 *     -n 2000                891           7          2000     <- what it was
 *     last 7 days            899           7          2011
 *     last 14 days          1333          14          2840
 *     last 30 days          1664          22          3315     <- ALL of it
 *
 * The repo's first commit is 2026-07-11, so it is 22 days old. A 30-day window
 * is the entire history, which would make the number the cumulative achievement
 * stat the director has just said it is NOT - and it would start silently
 * truncating on day 31, reintroducing the falling number under wording that
 * hides it. Seven days is what the 2000-commit cap has effectively BEEN (2000
 * commits is 2011 in seven days at this pace), so saying it out loud changes
 * what the sentence CLAIMS without changing what it counts: 891 -> 899.
 *
 * WHAT THE LONGER WINDOW WOULD HAVE BOUGHT: a bigger headline and a longer feed.
 * Not taken. The ask was to make the sentence true, not to grow the number, and
 * a 50% larger figure arriving in the same commit would make it impossible to
 * tell which change moved it.
 *
 * THE BOUNDARY IS MIDNIGHT of (today - 6), not `--since=7.days`, and that is
 * load-bearing rather than fussy. A rolling 7x24h window spans EIGHT calendar
 * dates, so the page would have read "across 8 active days" inside "the last 7
 * days" - the same sentence contradicting itself in the same breath. Anchored to
 * a date boundary, the active-day count cannot exceed the window, ever.
 *
 * IT WILL STILL GO DOWN, and that is now correct rather than confusing: a
 * trailing window drops what ages past it, and the sentence says trailing. */
const FEED_WINDOW_DAYS = 7;
/* LOCAL date, not `toISOString()`, and the first run of this code proved why:
 * `git log --date=short` prints dates in LOCAL time, so a UTC boundary is a
 * different day for most of the evening in this timezone. It generated
 * "751 changes in the last 7 days ... across 6 active days" — a seven-day window
 * that had quietly become six, off by exactly the UTC offset. The window and the
 * dates it is compared against have to be reckoned in the same clock. */
const windowStartDate = new Date(Date.now() - (FEED_WINDOW_DAYS - 1) * 86400000);
const windowStart = [
  windowStartDate.getFullYear(),
  String(windowStartDate.getMonth() + 1).padStart(2, '0'),
  String(windowStartDate.getDate()).padStart(2, '0'),
].join('-');
const RAW = git(
  'log', 'main', '--date=short', '--pretty=%h\x1f%ad\x1f%s',
  `--since=${windowStart} 00:00:00`,
).split('\n');
const PLAYER_VISIBLE = /^(feat|fix|balance|perf|style)(\(|:)/;
const NOISE = /^(docs|chore|test|refactor|merge|revert)(\(|:)/i;
const KIND_LABEL = { feat: 'New', fix: 'Fixed', balance: 'Balance', perf: 'Performance', style: 'Polish' };
const KIND_INK = { feat: '--cyan', fix: '--pink', balance: '--violet', perf: '--gold', style: '--gold' };

const days = new Map();
let filtered = 0;
for (const line of RAW) {
  const [sha, date, subject] = line.split('\x1f');
  if (!subject) continue;
  if (!PLAYER_VISIBLE.test(subject)) { if (NOISE.test(subject)) filtered++; continue; }
  const m = subject.match(/^(\w+)(?:\(([^)]+)\))?:\s*(.+)$/);
  if (!m) continue;
  if (!days.has(date)) days.set(date, []);
  days.get(date).push({ sha, kind: m[1], scope: noEmDash(m[2] || ''), text: noEmDash(m[3]) });
}
const allDays = [...days.entries()].sort((a, b) => b[0].localeCompare(a[0]));
const totalShipped = [...days.values()].reduce((n, d) => n + d.length, 0);

/* ── THE COUNT IS NOT NAVIGATION, and it is not a milestone either ───────────
 *
 * These three numbers used to be printed inside log.html's <nav class="side">.
 * Director, 2026-08-01: "that '901 player visible changes...' part doesn't need
 * to be in the navigation section." It never did — nothing about it is
 * clickable and it goes nowhere. It is PROVENANCE, so it now sits in the footer
 * beside the build stamp, which is the other sentence about where this page
 * came from. Its two mobile CSS overrides went with it: they existed only to
 * stop a 70-character sentence being the widest thing in a nowrap flex strip,
 * and out of the strip there is nothing to override.
 *
 * NOTHING HERE IS HARDCODED — the "confirm it is still 901" question has an
 * answer and the answer is no. All three are recomputed from `git log` on every
 * run; the committed log.html was simply older than the repo. It read 890 on
 * 2026-08-02 against 901 the day before.
 *
 * AND IT WENT DOWN, WHICH IS THE PART WORTH KNOWING. The feed is built from a
 * fixed TRAILING WINDOW, not from the whole history. Ninety commits landed
 * between those two generations; the ninety that aged off the tail were
 * feature-heavy and the ninety that arrived were docs and chore, so
 * player-visible fell by 11 and filtered rose by 11. The sentence read like a
 * cumulative achievement stat and was not one.
 *
 * RULED, 2026-08-01: "Reword it to say what it is — a recent window... let's
 * change it to a timeframe though." Done, and done in the DERIVATION as well as
 * the wording — see THE WINDOW IS A TIMEFRAME above `git log`, which carries the
 * measurements the seven days were picked on. The sentence now names the window
 * it counts, so the number falling is the window working rather than a stat
 * mysteriously losing ground. A lifetime count was the other option and was not
 * taken: it is a different claim about the project, and it is not what was
 * asked for. */

/* index.html only needs the headline numbers. log.html's full view gets the
 * real feed, capped per day so a burst day (150+ commits) reads as a feed
 * rather than a wall, with the drop count said out loud. */
const LOG_DAYS_CAP = 30;
const PER_DAY_CAP = 20;
const fullFeed = allDays.slice(0, LOG_DAYS_CAP);
const renderedChanges = fullFeed.flatMap(([, changes]) => changes.slice(0, PER_DAY_CAP));

// ---------------------------------------------------------------- derive: the arcs, from CAMPAIGN
/* CAMPAIGN.md IS the train. Parsing its ARCS block keeps one source of truth
 * rather than a second hand-maintained roadmap that drifts within a week. */
let arcs = [];
const campaignPath = join(REPO, 'docs/CAMPAIGN.md');
if (existsSync(campaignPath)) {
  const c = readFileSync(campaignPath, 'utf8');
  const block = c.split(/^## ARCS$/m)[1]?.split(/^## /m)[0] ?? '';
  arcs = [...block.matchAll(/^- (A\d+) ([^:(]+?)(?:\s*\(([^)]+)\))?:\s*(.+)$/gm)]
    .map((m) => ({ id: m[1], name: cleanDoc(m[2]), when: cleanDoc(m[3] || ''), what: cleanDoc(m[4]) }));
}

// ---------------------------------------------------------------- derive: known bugs, OPEN only
/* docs/BUG_INVENTORY.md is a VERIFIED per-item triage, not a hand-list of
 * standing debts, CAMPAIGN's old debt list is what went stale (reports
 * 141/142 marked open when both were fixed and wired), which is exactly the
 * failure mode this file exists to stop repeating. Only the OPEN table is
 * parsed; NOT-A-BUG / SUPERSEDED / NEEDS-KEVIN rows are not player-facing bugs. */
function parseOpenBugs() {
  const path = join(REPO, 'docs/BUG_INVENTORY.md');
  if (!existsSync(path)) return [];
  const raw = readFileSync(path, 'utf8');
  const block = raw.split(/^## OPEN\b[^\n]*\n/m)[1]?.split(/^## /m)[0] ?? '';
  const rows = [...block.matchAll(/^\|([^\n|]+)\|([^\n|]+)\|([^\n|]+)\|([^\n|]+)\|\s*$/gm)];
  const bugs = [];
  for (const m of rows) {
    const id = m[1].trim();
    if (/^-+$/.test(id) || /^id$/i.test(id)) continue;
    const what = cleanDoc(m[2]);
    const why = cleanDoc(m[3]);
    const evidence = cleanDoc(m[4]);
    bugs.push({ id, what, why, evidence, freshlyFiled: /^untriaged$/i.test(evidence) });
  }
  return bugs;
}
const openBugs = parseOpenBugs();

/* The FIXED/OPEN totals come straight from the inventory's own "Headline
 * counts" table rather than a hand count anywhere in this file, so the
 * published ratio can never drift from the source of truth. */
function parseHeadlineCounts() {
  const path = join(REPO, 'docs/BUG_INVENTORY.md');
  if (!existsSync(path)) return { fixed: null, open: null };
  const raw = readFileSync(path, 'utf8');
  const block = raw.split(/^## Headline counts$/m)[1]?.split(/^## /m)[0] ?? '';
  const grab = (label) => {
    const m = block.match(new RegExp(`\\|\\s*\\*\\*${label}\\*\\*\\s*\\|\\s*(\\d+)\\s*\\|`));
    return m ? Number(m[1]) : null;
  };
  return { fixed: grab('FIXED'), open: grab('OPEN') };
}
const bugHeadline = parseHeadlineCounts();
const totalOpenBugs = openBugs.length;
const totalFixedBugs = bugHeadline.fixed;
if (bugHeadline.open !== null && bugHeadline.open !== totalOpenBugs) {
  console.warn(`WARNING: BUG_INVENTORY headline says ${bugHeadline.open} OPEN, but ${totalOpenBugs} OPEN rows were parsed. Counts may be stale, check the OPEN table.`);
}

/* AGGREGATE ONLY, derived by keyword match over each report's own "what" /
 * "why" / "evidence" text, never by a hand list of report ids. A hand list
 * of ids-to-category is exactly the staleness failure this project already
 * got burned by once (CAMPAIGN's STANDING DEBTS, see the header comment on
 * parseOpenBugs above), so the classifier reads the same way every time the
 * inventory changes, no id ever gets looked up individually. This function
 * and classifySeverity below are the ONLY things allowed to see each report's
 * text; everything downstream of them is counts only. */
const BUG_AREAS = ['world and hub', 'combat', 'multiplayer', 'interface', 'performance', 'audio'];
function classifyBugArea(b) {
  const t = `${b.what} ${b.why} ${b.evidence}`.toLowerCase();
  if (/\b(coop|co-op|duel|multiplayer|seat|desync|online match|lobby)\b/.test(t)) return 'multiplayer';
  if (/\b(sound|audio|music|sfx|volume|mute)\b/.test(t)) return 'audio';
  if (/\b(fps|frame rate|framerate|lag|stutter|performance|freeze)\b/.test(t)) return 'performance';
  if (/\b(minimap|hud|menu|share card|sign in|settings)\b/.test(t)) return 'interface';
  if (/\b(boss|miniboss|elite|hero|skin|wand|staff|weapon)\b/.test(t)) return 'combat';
  return 'world and hub';
}
function classifyBugSeverity(b) {
  const t = `${b.what} ${b.why} ${b.evidence}`.toLowerCase();
  if (/invisible wall|phantom wall/.test(t)) return 'recurring';
  if (/not a defect|suggestion, not|feature request|queued feature/.test(t)) return 'suggestion';
  return 'polish';
}
const bugAreaCounts = BUG_AREAS.map((area) => ({ area, count: openBugs.filter((b) => classifyBugArea(b) === area).length }));
const SEVERITY_LABEL = { recurring: 'Recurring class, several spots', polish: 'Single spot, visual polish', suggestion: 'Suggestion, not a defect' };
const severityCounts = { recurring: 0, polish: 0, suggestion: 0 };
for (const b of openBugs) severityCounts[classifyBugSeverity(b)]++;
const bugSeverityCounts = Object.entries(severityCounts).map(([key, count]) => ({ key, label: SEVERITY_LABEL[key], count }));

/* IF the data actually supports it: no open report uses crash/stuck/softlock
 * language, and most of what is open is polish or a suggestion rather than a
 * recurring class. Both are checked here, not assumed, so the authored line
 * below only claims what this run's data backs up. */
const noBlockingLanguage = !openBugs.some((b) => /\bcrash(?:es|ed)?\b|\bcan(?:'t|not) (?:play|progress|continue)\b|\bstuck\b|\bsoft.?lock\b/i.test(`${b.what} ${b.why} ${b.evidence}`));
const polishShare = totalOpenBugs > 0 ? (severityCounts.polish + severityCounts.suggestion) / totalOpenBugs : 0;
const bugFraming = (totalFixedBugs !== null && noBlockingLanguage && polishShare >= 0.6)
  ? `We have fixed ${totalFixedBugs} reports so far and ${totalOpenBugs} are still open. Most of what is left is small visual polish, corners of the map, a stray floating triangle, that kind of thing, not anything that stops you from playing.`
  : `We have fixed ${totalFixedBugs ?? '?'} reports so far and ${totalOpenBugs} are still open. We are working through the rest now.`;

// ---------------------------------------------------------------- derive: also in flight, from BACKLOG_INVENTORY
/* BACKLOG_INVENTORY.md is an engineer-facing sweep (line-numbers, file paths,
 * size estimates). Rather than publish that language, each known category gets
 * one authored marketing line and a REAL, DERIVED count of queued items, so the
 * count can never drift stale even though the sentence is hand-written. An
 * unrecognised category is skipped rather than guessed at. */
function parseBacklogTeasers() {
  const path = join(REPO, 'docs/BACKLOG_INVENTORY.md');
  if (!existsSync(path)) return [];
  const raw = readFileSync(path, 'utf8');
  const BLURB = {
    'MULTIPLAYER': 'Head-to-head and co-op keep getting real: more seats, smoother reconnects, fairer arenas.',
    'BALANCE / PVP': 'Fight-by-fight tuning keeps going. Every duel should feel earned, not endless.',
    'HUB / WORLD': 'The hub keeps getting fixed and dressed up, corner by corner.',
    'PERFORMANCE': 'Keeping the game fast on more machines, not just the strong ones.',
    'FEEDBACK / TESTER-FACING': 'Turning what you tell us into the next build, faster.',
  };
  const sections = raw.split(/^## /m).slice(1);
  const out = [];
  for (const sec of sections) {
    const header = sec.match(/^\d+\.\s*([^\n]+)/);
    if (!header) continue;
    const name = header[1].trim();
    const blurb = BLURB[name];
    if (!blurb) continue; // stale/superseded/lane-hygiene/not-a-build-item sections, and anything new, get skipped rather than guessed at
    const count = sec.split('\n').filter((l) => /^\|/.test(l) && !/^\|\s*-+\s*\|/.test(l) && !/^\|\s*Item\s*\|/i.test(l)).length;
    out.push({ name: cleanDoc(name), blurb, count });
  }
  return out;
}
const backlogTeasers = parseBacklogTeasers();

// ---------------------------------------------------------------- derive: Kevin's authored notes
/* notes/<YYYY-MM-DD>.md, one file per update, simple front matter (version,
 * date, title). This is the CONCISE view's entire source. A machine cannot pick
 * highlights, so nothing lands here except a human deciding it was worth
 * saying, and that is what keeps this view from ever filling with noise. */
function parseNote(raw, fallbackDate) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return null;
  const [, fmRaw, body] = m;
  const fm = {};
  for (const line of fmRaw.split('\n')) {
    const mm = line.match(/^(\w+):\s*(.*)$/);
    if (mm) fm[mm[1]] = mm[2].trim().replace(/^['"]|['"]$/g, '');
  }
  return { version: fm.version || '', date: fm.date || fallbackDate, title: fm.title || fallbackDate, body };
}

const BUCKET_NAMES = ['New', 'Better', 'Fixed', 'Coming'];
const BUCKET_RE = new RegExp(`^##\\s+(${BUCKET_NAMES.join('|')})\\s*$`, 'i');
const BUCKET_INK = { New: '--cyan', Better: '--violet', Fixed: '--pink', Coming: '--gold' };

function parseBody(body) {
  const lines = body.split('\n');
  const intro = [];
  const buckets = [];
  let current = null;
  let buf = [];
  const flush = () => {
    const text = buf.join('\n').trim();
    buf = [];
    if (!text) return;
    (current ? current.blocks : intro).push(text);
  };
  for (const line of lines) {
    const bm = line.match(BUCKET_RE);
    if (bm) {
      flush();
      const name = BUCKET_NAMES.find((n) => n.toLowerCase() === bm[1].toLowerCase());
      current = { name, blocks: [] };
      buckets.push(current);
      continue;
    }
    if (line.trim() === '') { flush(); continue; }
    buf.push(line);
  }
  flush();
  return { intro, buckets };
}

/** A block is one blank-line-separated chunk of the note body. Bullet items can
 *  wrap across multiple source lines (readable line width in the .md file), so
 *  a continuation line (no leading "- ") folds into the item above it rather
 *  than becoming its own paragraph or leaking a stray "- " into the HTML. */
function renderBlock(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return '';
  const isList = /^-\s+/.test(lines[0]);
  if (!isList) return `<p>${mdInline(lines.join(' '))}</p>`;
  const items = [];
  for (const line of lines) {
    if (/^-\s+/.test(line)) items.push(line.replace(/^-\s+/, ''));
    else if (items.length) items[items.length - 1] += ' ' + line;
  }
  return `<ul>${items.map((i) => `<li>${mdInline(i)}</li>`).join('')}</ul>`;
}

const NOTES_DIR = join(SITE_ROOT, 'notes');
let notes = [];
if (existsSync(NOTES_DIR)) {
  notes = readdirSync(NOTES_DIR)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
    .map((f) => {
      const parsed = parseNote(readFileSync(join(NOTES_DIR, f), 'utf8'), f.replace(/\.md$/, ''));
      if (!parsed) return null;
      const { intro, buckets } = parseBody(parsed.body);
      return { ...parsed, file: f, intro, buckets };
    })
    .filter(Boolean)
    .sort((a, b) => b.date.localeCompare(a.date));
}

const buildStamp = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

// ---------------------------------------------------------------- the W, lifted verbatim from public/icons/icon.svg
/* Same geometry, same chromatic offsets, same cream face. The icon IS the
 * brand reference (director ruling), so the site does not redraw it. */
const W_PATH = 'M81 139 L175 374 L256 251 L337 374 L431 139';
const wordmark = (size, id) => `
<svg class="wm" viewBox="0 0 512 512" width="${size}" height="${size}" aria-hidden="true" focusable="false">
  <defs><radialGradient id="g${id}" cx="50%" cy="50%" r="72%">
    <stop offset="0%" stop-color="#1e0e2a"/><stop offset="100%" stop-color="#06040e"/>
  </radialGradient></defs>
  <rect width="512" height="512" rx="96" fill="url(#g${id})"/>
  <g fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="${W_PATH}" stroke="#24f0ff" stroke-width="59" transform="translate(14,26)"/>
    <path d="${W_PATH}" stroke="#ff2f7e" stroke-width="59" transform="translate(-16,16)"/>
    <path d="${W_PATH}" stroke="#151023" stroke-width="69"/>
    <path d="${W_PATH}" stroke="#fff3cf" stroke-width="59"/>
  </g>
</svg>`;
const FAVICON = 'whomp-icon.svg';

const liveChip = () => `<span class="chip"><span class="dot${live && live.sha === headSha ? '' : ' stale'}" aria-hidden="true"></span>
  ${live ? `live <b>${esc(live.sha)}</b> · ${live.sha === headSha ? 'current wiki source' : 'different from wiki source'}` : 'live build <b>unverified</b> · offline provenance'}</span>
  <span class="chip">version <b>${esc(live?.version ?? pkg.version)}</b></span>`;

const arcCards = (list) => list.map((a) => `
    <div class="arc" id="flight-${slug(a.name)}">
      <div class="id">${esc(a.id)}${a.when ? ` &middot; ${esc(a.when)}` : ''}</div>
      <h4>${esc(a.name)}</h4>
      <p>${esc(a.what)}</p>
    </div>`).join('');

// ---------------------------------------------------------------- shared CSS
/* THE PALETTE IS THE APP ICON'S, AT FULL SATURATION, ON DARK.
   Director ruling: candy pastels and four pink-free alternatives were rejected.
   The pink is load-bearing in the blend, so it is never desaturated or replaced. */
const SHARED_CSS = `
:root{
  --ink:#06040e; --lift:#1e0e2a; --outline:#151023;
  --pink:#ff2f7e; --cyan:#24f0ff; --violet:#b14bff; --gold:#ffcf3f;
  --cream:#fff3cf; --body:#cfc6dd; --dim:#8d84a1;
  --sweep:linear-gradient(90deg,var(--pink),var(--cyan));
  --font:'Segoe UI',system-ui,-apple-system,sans-serif;
  --mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  --edge:1px solid rgba(255,243,207,.10);
}
*{box-sizing:border-box}
html,body{margin:0}
body{
  background:radial-gradient(ellipse 120% 80% at 50% -10%,var(--lift),var(--ink) 60%) no-repeat,var(--ink);
  color:var(--body); font-family:var(--font); line-height:1.6;
  -webkit-font-smoothing:antialiased; min-height:100vh;
}
a{color:var(--cyan)}
button{font-family:var(--font)}

/* THE CHROMATIC OFFSET IS THE SIGNATURE, carried from the icon to type:
   cyan right-and-down, pink left-and-down, cream face on top. Flat offsets,
   zero blur, matching the de-BOO flat-plinth doctrine the game already uses. */
.chroma{
  color:var(--cream); font-weight:900; letter-spacing:-.02em;
  text-shadow:.055em .05em 0 var(--cyan), -.055em .035em 0 var(--pink);
}

/* THE WORDMARK, lifted verbatim from whomp/src/ui/mainMenu.ts's
   .whomp-mainmenu__wordmark rule (the title screen). Same font stack, same
   clamp(60px,12vw,150px), same weight 900 (NEVER 1000: the game's own
   comment explains 1000 exceeds the heaviest real weight of the system
   fallback, so Mac Safari's SF substitution synthesizes a squished bold).
   The retro chromatic layering is two ::before/::after copies of the word
   via content:attr(data-wordmark), every offset and shadow expressed in em
   rather than px so the layering scales WITH the clamped font-size and holds
   together at every viewport width instead of drifting apart. SACRED, same
   as the game's own comment on this block: a frozen copy, not a reference,
   do not tokenize.

   NOTE 2026-07-30: a Chromium variable-font interpolation fix briefly replaced
   this stack with a static Black face. The director judged the resulting face
   worse and it was reverted, here and in the game together, so both surfaces
   stay identical. The squish and seam report on narrow Android is therefore
   still OPEN, and any future fix must preserve this face rather than swap it. */
.whomp-wordmark{font-family:'Segoe UI',system-ui,-apple-system,sans-serif;
  position:relative;isolation:isolate;z-index:2;font-size:clamp(60px,12vw,150px);font-weight:900;
  letter-spacing:-0.055em;line-height:0.82;margin:0;color:#fff3cf;-webkit-text-stroke:0.018em #151023;
  /* PAINT ORDER IS LOAD BEARING. letter-spacing is negative, so glyphs OVERLAP,
     and a per-glyph stroke would otherwise draw the M's dark outline straight
     across the O's cream face. That is the seam the director reported, not a
     font problem. paint-order lays every stroke down first, so they merge into
     one silhouette, then every fill on top of all of them. Tight tracking and
     the outline both survive; the lines through the letters do not. */
  paint-order:stroke fill;
  text-shadow:0 0.018em 0 #fff,0 0.06em 0 #181126,0 0.107em 0.167em rgba(0,0,0,.55);
  transform:skewX(-4deg) rotate(-1deg);animation:whomp-wordmark-hit 3.6s cubic-bezier(.2,.9,.25,1) infinite;}
.whomp-wordmark::before,.whomp-wordmark::after{content:attr(data-wordmark);position:absolute;inset:0;z-index:-1;-webkit-text-stroke:0;color:#ff2f7e;}
.whomp-wordmark::before{transform:translate(-0.048em,0.048em);text-shadow:-0.042em 0.042em 0 #5f174d;}
.whomp-wordmark::after{color:#24f0ff;transform:translate(0.042em,0.083em);text-shadow:0.036em 0.042em 0 #116a79;z-index:-2;}
@keyframes whomp-wordmark-hit{
  0%,8%,100%{transform:skewX(-4deg) rotate(-1deg) scale(1);}
  2%{transform:skewX(-4deg) rotate(-1deg) scale(1.06,.88) translateY(8px);}
  5%{transform:skewX(-4deg) rotate(-1deg) scale(.98,1.04) translateY(-3px);}
}
@media(prefers-reduced-motion:reduce){.whomp-wordmark{animation:none;}}

.chips{display:flex;flex-wrap:wrap;gap:10px}
.chip{
  display:inline-flex;align-items:center;gap:8px;padding:7px 14px;border-radius:999px;
  border:var(--edge);background:rgba(255,243,207,.04);font-size:.82rem;color:var(--body);
  font-variant-numeric:tabular-nums;
}
.chip b{color:var(--cream);font-weight:700}
.dot{width:8px;height:8px;border-radius:50%;background:var(--cyan);box-shadow:0 0 0 3px rgba(36,240,255,.16)}
.dot.stale{background:var(--gold);box-shadow:0 0 0 3px rgba(255,207,63,.16)}

.btn{
  display:inline-block;padding:13px 26px;border-radius:12px;text-decoration:none;
  font-weight:700;color:var(--ink);background:var(--sweep);border:0;cursor:pointer;
  box-shadow:0 4px 0 #7a1440; transition:transform .12s ease,box-shadow .12s ease;font-size:1rem;
}
.btn:hover{transform:translateY(2px);box-shadow:0 2px 0 #7a1440}
.btn.ghost{background:none;color:var(--cream);border:var(--edge);box-shadow:0 4px 0 rgba(0,0,0,.4)}
.btn.small{padding:9px 18px;font-size:.82rem;box-shadow:none}

.rule{height:3px;border-radius:2px;background:var(--sweep);opacity:.85;margin-bottom:26px;max-width:120px}

.arcs{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}
.arc{border:var(--edge);border-radius:14px;padding:16px 18px;background:rgba(255,243,207,.025)}
.arc .id{color:var(--gold);font-weight:800;font-size:.8rem;letter-spacing:.06em}
.arc h4{margin:4px 0 6px;color:var(--cream);font-size:1rem}
.arc p{margin:0;font-size:.88rem;color:var(--dim)}

/* SIGN-IN, reused from the game's own accounts worker so one account covers
   both surfaces. Same worker, same client id, same session shape. */
.authbar{display:flex;justify-content:flex-end;align-items:center;gap:12px;padding:16px 0 0}
.authbar-name{color:var(--cream);font-weight:700;font-size:.85rem}

.spoiler{cursor:pointer;border-radius:4px;padding:0 2px;background:rgba(255,243,207,.08);color:transparent;text-shadow:0 0 0 transparent;transition:color .12s ease}
.spoiler::selection{color:transparent}
.spoiler.revealed{color:var(--cream);background:none}
.spoiler:not(.revealed)::after{content:"spoiler, click to reveal";color:var(--dim);font-style:italic}
.spoiler.revealed::after{content:""}

footer{margin-top:80px;padding-top:24px;border-top:var(--edge);color:var(--dim);font-size:.82rem;text-align:center}
footer code{color:var(--body)}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}

/* NOTHING may make the page itself scroll sideways, on ANY page. A floor rather
   than a fix: the per-element fixes are real but the next long token will arrive
   somewhere nobody predicted, and this was reported twice on mobile before it got
   one. Lives in SHARED_CSS because the second report was on the log while the wiki
   pages had no protection at all. */
html,body{max-width:100%;overflow-x:hidden}
`;

/* SEARCH, shared by log.html and every wiki page. Kept OUT of SHARED_CSS on
 * purpose: index.html has no search box and should not carry a dozen rules it
 * never uses. Was inline in log.html until the wiki arrived and needed the same
 * widget; extracted rather than copied, because two copies of a search box is
 * how one of them quietly stops matching the other. */
const SEARCH_CSS = `
.searchwrap{position:relative;max-width:1180px;margin:22px auto 0;padding:0 24px}
.searchlabel{display:block;margin:0 0 7px;color:var(--body);font-size:.76rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase}
.searchbox{width:100%;padding:14px 18px;border-radius:12px;border:var(--edge);background:rgba(255,243,207,.04);
  color:var(--cream);font-family:var(--font);font-size:1rem}
.searchbox::placeholder{color:var(--dim)}
.searchbox:focus{outline:2px solid var(--cyan);outline-offset:2px}
.sr-panel{position:absolute;left:24px;right:24px;top:calc(100% + 6px);background:var(--lift);border:var(--edge);
  border-radius:12px;max-height:60vh;overflow:auto;z-index:20;box-shadow:0 12px 32px rgba(0,0,0,.5);display:none}
.sr-panel.open{display:block}
.sr-empty{padding:16px;color:var(--dim);font-size:.88rem}
.sr-item{display:block;padding:12px 16px;border-top:1px solid rgba(255,243,207,.06);text-decoration:none;color:var(--body)}
.sr-item:first-child{border-top:0}
.sr-item:hover,.sr-item:focus,.sr-item.is-active,.sr-item[aria-selected="true"]{background:rgba(36,240,255,.08);outline:none}
.sr-kind{display:inline-block;font-size:.68rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase;
  color:var(--gold);margin-right:8px}
.sr-title{color:var(--cream)}
.sr-status{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;
  overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}
`;

const searchMarkup = (placeholder) => `
<div class="searchwrap" role="search">
  <label class="searchlabel" for="search">Search WHOMP</label>
  <input class="searchbox" id="search" type="search" placeholder="${esc(placeholder)}" autocomplete="off" spellcheck="false"
    role="combobox" aria-autocomplete="list" aria-haspopup="listbox" aria-expanded="false"
    aria-controls="sr-panel" aria-describedby="sr-status">
  <div class="sr-panel" id="sr-panel" role="listbox" aria-label="Search results"></div>
  <p class="sr-status" id="sr-status" role="status" aria-live="polite" aria-atomic="true">Enter at least two characters to search.</p>
</div>`;

/* The search index is ONE file shared by every page, so every entry carries a
 * full href (page + anchor) rather than a bare anchor. A result can therefore
 * point at another page, which is the whole reason a reader can type "wraith"
 * on the dev log and land on the bestiary card.
 *
 * `onSamePageHit` is a snippet the host page can run when the target
 * turns out to be on the CURRENT page, for pages that have to reveal it first.
 * log.html uses it to switch to the Full view before jumping to a commit row;
 * the wiki pages use it to clear an active filter that would otherwise leave
 * the reader staring at a card that is display:none. */
const SEARCH_SCRIPT = (onSamePageHit = '') => `
const searchInput = document.getElementById('search');
const srPanel = document.getElementById('sr-panel');
const searchStatus = document.getElementById('sr-status');
const SEARCH_LIMIT = 30;
let searchIndex = [];
let searchState = 'loading';
let renderedHits = [];
let activeResult = -1;
const ENTRY_HASH_PATTERN = /^#e-[A-Za-z0-9._-]+$/;

function searchEntryTarget(hash = location.hash) {
  if (!ENTRY_HASH_PATTERN.test(hash)) return null;
  const target = document.getElementById(hash.slice(1));
  return target?.matches('[id^="e-"][tabindex="-1"]') ? target : null;
}

function focusSearchEntryHash() {
  const target = searchEntryTarget();
  if (target) target.focus({ preventScroll: true });
}

window.addEventListener('hashchange', focusSearchEntryHash);
queueMicrotask(focusSearchEntryHash);

function setSearchStatus(message) {
  if (searchStatus) searchStatus.textContent = message;
}

function setSearchOpen(open) {
  srPanel.classList.toggle('open', open);
  searchInput.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (!open) {
    activeResult = -1;
    searchInput.removeAttribute('aria-activedescendant');
  }
}

function showSearchMessage(message, announcement = message) {
  renderedHits = [];
  activeResult = -1;
  searchInput.removeAttribute('aria-activedescendant');
  srPanel.replaceChildren();
  const empty = document.createElement('div');
  empty.className = 'sr-empty';
  empty.setAttribute('role', 'option');
  empty.setAttribute('aria-disabled', 'true');
  empty.textContent = message;
  srPanel.append(empty);
  setSearchStatus(announcement);
  setSearchOpen(true);
}

const normalized = (value) => String(value || '').trim().toLowerCase();
const hasWordPrefix = (value, query) => value.split(/\\s+/).some((word) => word.startsWith(query));

/* Ranking is deliberately source-aware. Exact and prefix title matches are
 * always first; after those, a generated wiki route/card beats a generic
 * change-log body match. This is what makes a short query such as "core" land
 * on Core weapons and its cards instead of a commit that happened to say core. */
function searchRank(item, query) {
  const title = normalized(item.title);
  const text = normalized(item.text);
  const type = normalized(item.type);
  const wikiResult = normalized(item.href).startsWith('wiki');
  if (title === query) return 0;
  if (title.startsWith(query)) return 10;
  if (wikiResult && hasWordPrefix(title, query)) return 20;
  if (wikiResult && title.includes(query)) return 30;
  if (wikiResult && (text.startsWith(query) || type.startsWith(query))) return 40;
  if (wikiResult && (hasWordPrefix(text, query) || hasWordPrefix(type, query))) return 45;
  if (wikiResult) return 50;
  if (title.includes(query)) return 60;
  if (text.startsWith(query) || type.startsWith(query) || hasWordPrefix(text, query) || hasWordPrefix(type, query)) return 70;
  return type === 'change' ? 90 : 80;
}

function setActiveResult(next) {
  const options = [...srPanel.querySelectorAll('.sr-item')];
  if (!options.length) return;
  activeResult = (next + options.length) % options.length;
  options.forEach((option, index) => {
    const active = index === activeResult;
    option.classList.toggle('is-active', active);
    option.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  const selected = options[activeResult];
  searchInput.setAttribute('aria-activedescendant', selected.id);
  selected.scrollIntoView({ block: 'nearest' });
}

function renderResults(query) {
  const q = query.trim().toLowerCase();
  if (q.length < 2) {
    renderedHits = [];
    srPanel.replaceChildren();
    setSearchOpen(false);
    setSearchStatus('Enter at least two characters to search.');
    return;
  }
  if (searchState === 'loading') {
    showSearchMessage('Loading the search index...', 'Search is still loading.');
    return;
  }
  if (searchState === 'error') {
    showSearchMessage('Search is unavailable right now. Reload the page to try again.', 'Search could not load. Reload the page to try again.');
    return;
  }

  const ranked = searchIndex
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => normalized(item.title + ' ' + item.text + ' ' + item.type).includes(q))
    .sort((a, b) => searchRank(a.item, q) - searchRank(b.item, q)
      || normalized(a.item.title).localeCompare(normalized(b.item.title))
      || a.index - b.index);
  renderedHits = ranked.slice(0, SEARCH_LIMIT).map(({ item }) => item);
  if (renderedHits.length === 0) {
    showSearchMessage('No matches for "' + query.trim() + '". Try a weapon, character, world, or dev-log term.', 'No search results for ' + query.trim() + '.');
    return;
  }

  activeResult = -1;
  searchInput.removeAttribute('aria-activedescendant');
  srPanel.replaceChildren();
  renderedHits.forEach((item, index) => {
    const link = document.createElement('a');
    link.className = 'sr-item';
    link.id = 'sr-option-' + index;
    link.href = String(item.href || '');
    link.tabIndex = -1;
    link.setAttribute('role', 'option');
    link.setAttribute('aria-selected', 'false');
    const kind = document.createElement('span');
    kind.className = 'sr-kind';
    kind.textContent = String(item.type || 'result');
    const title = document.createElement('span');
    title.className = 'sr-title';
    title.textContent = String(item.title || 'Untitled');
    link.append(kind, title);
    srPanel.append(link);
  });
  const shown = renderedHits.length;
  const total = ranked.length;
  setSearchStatus((shown < total ? 'Showing ' + shown + ' of ' + total : total) + (total === 1 ? ' search result' : ' search results') + ' for ' + query.trim() + '.');
  setSearchOpen(true);
}
searchInput.addEventListener('input', (e) => renderResults(e.target.value));
searchInput.addEventListener('focus', (e) => { if (e.target.value.trim().length >= 2) renderResults(e.target.value); });
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    if (searchInput.value.trim().length < 2) return;
    e.preventDefault();
    if (!srPanel.classList.contains('open')) renderResults(searchInput.value);
    const direction = e.key === 'ArrowDown' ? 1 : -1;
    setActiveResult(activeResult < 0 ? (direction > 0 ? 0 : renderedHits.length - 1) : activeResult + direction);
    return;
  }
  if (e.key === 'Enter' && renderedHits.length && srPanel.classList.contains('open')) {
    e.preventDefault();
    const options = [...srPanel.querySelectorAll('.sr-item')];
    const selected = options[activeResult >= 0 ? activeResult : 0];
    selected?.click();
    return;
  }
  if (e.key === 'Escape') {
    if (srPanel.classList.contains('open')) e.preventDefault();
    setSearchOpen(false);
    setSearchStatus('Search suggestions closed.');
  }
  if (e.key === 'Tab') setSearchOpen(false);
});
document.addEventListener('click', (e) => { if (!e.target.closest('.searchwrap')) setSearchOpen(false); });
srPanel.addEventListener('click', (e) => {
  const a = e.target.closest('.sr-item');
  if (!a) return;
  setSearchOpen(false);
  const href = a.getAttribute('href') || '';
  let destination = null;
  try { destination = new URL(href, location.href); } catch { /* malformed index href: normal navigation owns the failure */ }
  const sameDocument = destination && destination.origin === location.origin
    && destination.pathname === location.pathname && destination.search === location.search;
  const target = sameDocument ? searchEntryTarget(destination.hash) : null;
  if (target) {
    ${onSamePageHit}
    target.focus({ preventScroll: true });
  }
});

fetch('./search-index.json')
  .then((response) => {
    if (!response.ok) throw new Error('Search index returned HTTP ' + response.status);
    return response.json();
  })
  .then((data) => {
    if (!Array.isArray(data)) throw new Error('Search index is not an array');
    searchIndex = data;
    searchState = 'ready';
    if (document.activeElement === searchInput && searchInput.value.trim().length >= 2) renderResults(searchInput.value);
  })
  .catch(() => {
    searchIndex = [];
    searchState = 'error';
    if (document.activeElement === searchInput && searchInput.value.trim().length >= 2) renderResults(searchInput.value);
  });
`;

const AUTH_SCRIPT = (idSuffix = '') => `
<script type="module">
import { getUser, onChange, signIn, signOut } from './bin/auth.js';
const show = (el, visible) => { if (el) el.style.display = visible ? '' : 'none'; };
function renderAuth(user) {
  const signedIn = user !== null;
  show(document.getElementById('ab-signedout'), !signedIn);
  show(document.getElementById('ab-signedin'), signedIn);
  if (signedIn) {
    const name = user.displayName || user.email;
    const el = document.getElementById('ab-name');
    if (el) el.textContent = name;
  }
  window.__whompUser = user;
  document.dispatchEvent(new CustomEvent('whomp-auth', { detail: user }));
}
async function runSignIn(button) {
  button.disabled = true;
  try { await signIn(); } finally { button.disabled = false; }
}
document.getElementById('ab-signin')?.addEventListener('click', (e) => runSignIn(e.currentTarget));
document.getElementById('ab-signout')?.addEventListener('click', () => signOut());
onChange(renderAuth);
renderAuth(getUser());
</script>`;

const AUTHBAR = `
<div class="authbar">
  <span id="ab-signedout">
    <button id="ab-signin" class="btn ghost small" type="button">Sign in</button>
  </span>
  <span id="ab-signedin" style="display:none">
    <span class="authbar-name" id="ab-name"></span>
    <button id="ab-signout" class="btn ghost small" type="button">Sign out</button>
  </span>
</div>`;

// ============================================================== THE WIKI
/* The derived content pages. bin/wiki.mjs owns what a weapon card says; this
 * file owns the chrome every page on the site shares, so the wiki cannot drift
 * into looking like a different site. One entry point, one palette, one search
 * index, one write step.
 *
 * The wiki was split into its own module rather than inlined here because it
 * grows per roster and this file grows per dev-log feature. Two different
 * reasons to change, so two files. */

/** The shared page skeleton, used by every wiki page. index.html and log.html
 *  predate it and keep their own bespoke heads, deliberately: neither is worth
 *  the churn of a rewrite whose only benefit is symmetry, and log.html's head
 *  carries a large page-specific style block anyway. */
const wikiPage = ({ title, description, body, script }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="icon" href="${FAVICON}">
<style>
${SHARED_CSS}
${SEARCH_CSS}
${WIKI_CSS}
.wside-section{border-top:1px solid rgba(255,243,207,.06)}
.wside-section summary{display:list-item;list-style-position:inside;padding:10px 12px;color:var(--gold);cursor:pointer;
  font-size:.7rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;border-radius:8px}
.wside-section summary:hover{background:rgba(255,243,207,.04)}
.wside-section summary::marker{color:var(--cyan)}
.wside-section summary span{float:right;color:var(--dim);font-size:.65rem;font-variant-numeric:tabular-nums}
.wside-section[open] summary{color:var(--cream)}
.wside-links{padding:0 0 5px 7px}
.wside-section summary:focus-visible{outline:2px solid var(--cyan);outline-offset:2px}
.wside a.wiki-home{display:flex;align-items:center;gap:10px;padding:7px 10px 12px;margin:0 0 4px;border-bottom:var(--edge)}
.wiki-home-icon{display:block;width:46px;height:46px;flex:none;border-radius:10px}
.wiki-home-copy{display:flex;min-width:0;flex-direction:column;line-height:1.15}
.wiki-home-copy b{color:var(--cream);font-size:.94rem;letter-spacing:.02em}
.wiki-home-copy span{color:var(--dim);font-size:.72rem;margin-top:4px}
@media(max-width:760px){
  .wside{display:block;border:var(--edge);border-radius:12px;padding:8px;background:rgba(255,243,207,.02)}
  .wside a.wiki-home{width:100%;padding:8px 10px 13px}
  .wside-section summary{padding:12px}
  .wside-links{padding-left:8px}
  .wside-links a{padding:10px 12px}
}
.brand{display:flex;align-items:center;gap:12px;text-decoration:none}
.brand .wm{margin:0}
.brand h1{font-size:1.6rem;margin:0}
.subtag{color:var(--dim);font-size:.85rem;margin:2px 0 0}
h2{font-size:1.5rem;margin:0 0 6px}
.lede{color:var(--dim);margin:0 0 20px;font-size:.92rem;max-width:78ch}
footer a{color:var(--cyan);text-decoration:none}
</style>
</head>
<body>
<a class="skip-link" href="#wiki-main">Skip to wiki content</a>
${body}
${AUTH_SCRIPT()}
<script type="module">
${script}
</script>
</body>
</html>`;

const SEARCH_PLACEHOLDER = 'Search wiki guides, cards, and the dev log...';

/* The wiki's own sidebar. It lives here rather than in wiki.mjs because it names
 * the pages that are NOT rosters too, and because "you are here" is page chrome.
 *
 * The roster list is resolved before the pages are built, so every page can link
 * to every other one including the ones rendered after it. rosterSpecs() is pure
 * and cheap, so calling it once for the nav and once inside buildWiki costs
 * nothing and buys a nav that is not reading half-initialised mutable state. Add
 * a roster and it appears in the sidebar of every existing page for free. */
const wikiRosterNav = rosterSpecs(gameData, esc, tierData, visualData)
  .map((r) => ({ slug: r.slug, title: r.title, section: r.section }));
const wikiNavSections = [];
for (const roster of wikiRosterNav) {
  let section = wikiNavSections.find((candidate) => candidate.name === roster.section);
  if (!section) {
    section = { name: roster.section, rosters: [] };
    wikiNavSections.push(section);
  }
  section.rosters.push(roster);
}
const currentNavAttrs = (current) => current ? ' class="is-here" aria-current="page"' : '';
const wikiNav = (here) => `
    <a class="wiki-home" href="wiki.html" aria-label="WHOMP wiki home">
      <img class="wiki-home-icon" src="whomp-icon.svg" alt="" width="46" height="46">
      <span class="wiki-home-copy"><b>WHOMP</b><span>Wiki home</span></span>
    </a>
    <span class="wside-h">Wiki</span>
    <a href="wiki.html"${currentNavAttrs(here === '')}>All guides</a>
    ${wikiNavSections.map((section) => {
      const containsCurrent = section.rosters.some((r) => r.slug === here);
      return `<details class="wside-section${containsCurrent ? ' is-current-section' : ''}"${containsCurrent ? ' open' : ''}>
      <summary>${esc(section.name)} <span>${section.rosters.length}</span></summary>
      <div class="wside-links">
        ${section.rosters.map((r) => `<a href="wiki-${esc(r.slug)}.html"${currentNavAttrs(here === r.slug)}>${esc(r.title)}</a>`).join('\n        ')}
      </div>
    </details>`;
    }).join('\n    ')}
    <span class="wside-h">Elsewhere</span>
    <a href="log.html#views">Dev log</a>
    <a href="index.html">&larr; Back to WHOMP</a>`;

const wiki = buildWiki({
  D: gameData,
  T: tierData,
  V: visualData,
  esc,
  page: wikiPage,
  chrome: {
    AUTHBAR, wordmark, liveChip, searchMarkup, SEARCH_SCRIPT, SEARCH_PLACEHOLDER,
    wikiNav, headSha, buildStamp,
  },
});

// ============================================================== INDEX.HTML
// The short public landing page. Mark, tagline, live build chip, play button,
// arcs. That is the whole page, on purpose: it never grows. Everything else
// (the log, known bugs, in-flight work, search) lives on log.html.
const indexHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>WHOMP: ${esc(TAGLINE)}</title>
<meta name="description" content="${esc(TAGLINE)} Built in the open, with the dev log public.">
<link rel="icon" href="${FAVICON}">
<style>
${SHARED_CSS}
.wrap{max-width:860px;margin:0 auto;padding:0 24px 96px}
header{padding:56px 0 40px;text-align:center}
.wm{display:block;margin:0 auto 22px;filter:drop-shadow(0 8px 0 rgba(0,0,0,.45))}
/* Tagline typography lifted from the game's .whomp-mainmenu__tagline: weight
   700, letter-spacing .03em, italic, the same dimmed-white ink. Font-size
   stays the site's own responsive clamp (the game's is a fixed 16px in a
   fixed-size menu panel, not a full-bleed hero) rather than pinned to 16px. */
.tag{font-size:clamp(1.05rem,3.2vw,1.3rem);color:rgba(255,255,255,0.72);margin:18px auto 0;max-width:34ch;
  font-weight:700;font-style:italic;letter-spacing:0.03em}
.chips{justify-content:center;margin-top:26px}
.cta{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;margin-top:34px}
.doorway{text-align:center;color:var(--dim);font-size:.92rem;margin-top:18px}
h2{font-size:1.65rem;margin:0 0 6px}
section{margin-top:64px}
</style>
</head>
<body>
<div class="wrap">

${AUTHBAR}

<header>
  ${wordmark(112, 'h')}
  <h1 class="whomp-wordmark" data-wordmark="WHOMP">WHOMP</h1>
  <p class="tag" id="hero-tagline">${esc(gameTaglines[0])}</p>
  <script>document.getElementById('hero-tagline').textContent=(${JSON.stringify(gameTaglines)})[Math.min(${gameTaglines.length}-1,Math.max(0,Math.floor(Math.random()*${gameTaglines.length})))];</script>
  <div class="chips">${liveChip()}</div>
  <div class="cta">
    <a class="btn" href="${LIVE_URL}/">Play the current build</a>
    <a class="btn ghost" href="wiki.html">Browse the wiki</a>
    <a class="btn ghost" href="log.html">Read the dev log</a>
  </div>
  <p class="doorway">The wiki is every weapon, core and enemy, generated from the game's own
    data. The dev log is every build: what shipped, what's still broken, what's next.</p>
</header>

<section>
  <div class="rule"></div>
  <h2 class="chroma">What we are building</h2>
  <div class="arcs">${arcCards(arcs)}</div>
</section>

<footer>
  Generated ${esc(buildStamp)} from <code>game@${esc(headSha)}</code>.
  ${live ? `Live build <code>${esc(live.sha)}</code>${live.sha === headSha ? ' (current)' : ' (a deploy is pending)'}.`
         : 'Live build could not be reached at generation time, so no live sha is claimed.'}
</footer>

</div>
${AUTH_SCRIPT()}
</body>
</html>`;

// ============================================================== LOG.HTML
// The real dev log: sidebar, search, filters, and the two-view toggle.
//   CONCISE (default) = notes/*.md, Kevin's own words. The product.
//   FULL              = the generated feed from git log. Labelled honestly as
//                        the raw engineering log, so it reads as a door left
//                        open rather than as noise.
const noteCard = (n) => {
  const id = `note-${esc(n.date)}`;
  const introHtml = n.intro.map(renderBlock).join('');
  const bucketsHtml = n.buckets.map((b) => `
    <div class="bucket">
      <h4 style="color:var(${BUCKET_INK[b.name] || '--cream'})">${esc(b.name)}</h4>
      ${b.blocks.map(renderBlock).join('')}
    </div>`).join('');
  return `
  <article class="notecard" id="${id}">
    <div class="notecard-head">
      <span class="notecard-date">${esc(n.date)}</span>
      ${n.version ? `<span class="notecard-version">v${esc(n.version)}</span>` : ''}
    </div>
    <h3 class="chroma" style="font-size:1.4rem">${esc(n.title)}</h3>
    ${introHtml}
    <div class="buckets">${bucketsHtml}</div>
  </article>`;
};

const dayBlock = (date, changes) => {
  const shown = changes.slice(0, PER_DAY_CAP);
  const hidden = changes.length - shown.length;
  const rows = shown.map((c) => `
    <div class="row" data-kind="${esc(c.kind)}" id="chg-${esc(c.sha)}">
      <span class="kind" style="background:var(${KIND_INK[c.kind] || '--dim'})">${esc(KIND_LABEL[c.kind] || c.kind)}</span>
      <span class="what">${esc(c.text)}${c.scope ? ` <span class="scope">(${esc(c.scope)})</span>` : ''}</span>
      <span class="sha">${esc(c.sha)}</span>
    </div>`).join('');
  const more = hidden > 0 ? `<div class="row more">+ ${hidden} more that day, not shown</div>` : '';
  return `
  <div class="day">
    <h4>${esc(date)}</h4>
    ${rows}${more}
  </div>`;
};

/* OWNER-ONLY, per-report detail. Never used on the public page, only inside
 * ownerBugSection below, which only exists in the output at all when
 * GATING_ENABLED is true at build time. */
const bugRow = (b) => `
  <div class="bugrow" id="bug-${slug(b.id)}">
    <div class="bugrow-head">
      <span class="bugtag">#${esc(b.id)}</span>
      ${b.freshlyFiled ? '<span class="bugtag new">just filed</span>' : ''}
    </div>
    <p class="bugwhat">${esc(b.what)}</p>
    ${b.why ? `<p class="bugwhy">${esc(b.why)}</p>` : ''}
  </div>`;

/* OWNER-ONLY VIEW, built now, kept dark. Guarded at BUILD TIME, not just in
 * the browser: while GATING_ENABLED is false (today), this whole block is the
 * empty string, so openBugs' per-report what/why text never reaches logHtml
 * or search-index.json at all, there is nothing for a browser to download and
 * nothing a CSS rule is hiding. That is the difference between this and the
 * anti-pattern the director called out explicitly: shipping the raw text and
 * hiding it with CSS.
 *
 * TO TURN IT ON LATER: flip GATING_ENABLED to true at the top of this file
 * and regenerate. That restores the runtime check below (OWNER_EMAIL against
 * the signed-in identity from auth.js), so only Kevin's own signed-in session
 * reveals #owner-bugs. Read this caveat first though: GitHub Pages has no
 * server-side auth, every generated file is fetchable by its raw URL by
 * anyone who knows to look, signed in or not. The DOM check stops a casual
 * tester from seeing it in the rendered page, it is not real access control.
 * Before ever using this for genuinely sensitive detail, move the per-report
 * text behind the accounts worker as an authenticated endpoint instead of a
 * static file. */
const ownerBugSection = GATING_ENABLED ? `
  <section id="owner-bugs" class="gated-section" hidden>
    <div class="rule"></div>
    <h2 class="chroma">Owner detail</h2>
    <p class="lede">Full per-report bug text. Signed-in owner only, never part of what testers get.</p>
    ${openBugs.length ? openBugs.map(bugRow).join('') : '<p class="lede">Nothing open right now.</p>'}
  </section>` : '';

const flightCard = (t) => `
  <div class="arc" id="flight-${slug(t.name)}">
    <div class="id">IN FLIGHT</div>
    <h4>${esc(t.name)}</h4>
    <p>${esc(t.blurb)}</p>
    <p style="margin-top:8px;color:var(--dim);font-size:.78rem">${t.count} item${t.count === 1 ? '' : 's'} queued</p>
  </div>`;

const logHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>WHOMP dev log</title>
<meta name="description" content="The WHOMP development log: what shipped, what's known-broken, and what's coming next.">
<link rel="icon" href="${FAVICON}">
<style>
${SHARED_CSS}
.topbar{max-width:1180px;margin:0 auto;padding:0 24px}
.topbar-row{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;padding:20px 0 0}
.brand{display:flex;align-items:center;gap:12px;text-decoration:none}
.brand .wm{margin:0}
.brand h1{font-size:1.6rem;margin:0}
.subtag{color:var(--dim);font-size:.85rem;margin:2px 0 0}

${SEARCH_CSS}
.shell{max-width:1180px;margin:0 auto;padding:28px 24px 96px;display:flex;gap:36px;align-items:flex-start}
.side{width:220px;flex:none;position:sticky;top:20px;display:flex;flex-direction:column;gap:4px}
.side a{display:block;padding:9px 12px;border-radius:8px;color:var(--body);text-decoration:none;font-size:.92rem}
.side a:hover{background:rgba(255,243,207,.05);color:var(--cream)}
/* .stat sits in the FOOTER now, beside the build stamp, where a sentence about
   provenance belongs. It spent its life in the nav pretending to be a link. */
footer .stat{margin-top:10px;font-size:.78rem;opacity:.82}
.main{flex:1;min-width:0}

section{margin-top:56px}
section:first-child{margin-top:0}
h2{font-size:1.5rem;margin:0 0 6px}
.lede{color:var(--dim);margin:0 0 20px;font-size:.92rem}

.viewtoggle{display:flex;gap:8px;margin-bottom:18px}
.vtab{padding:9px 18px;border-radius:999px;border:var(--edge);background:none;color:var(--dim);cursor:pointer;font-size:.88rem;font-weight:700}
.vtab.is-active{color:var(--ink);background:var(--sweep);border-color:transparent}
.viewpane[hidden]{display:none}

.notecard{border:var(--edge);border-radius:16px;padding:22px 24px;margin-bottom:18px;background:rgba(255,243,207,.025)}
.notecard-head{display:flex;gap:10px;align-items:center;margin-bottom:6px}
.notecard-date{color:var(--dim);font-size:.78rem;letter-spacing:.04em;text-transform:uppercase}
.notecard-version{color:var(--dim);font-size:.78rem;font-family:var(--mono)}
.notecard p{margin:10px 0}
.notecard ul{margin:8px 0;padding-left:20px}
.notecard li{margin:6px 0}
.buckets{display:grid;gap:14px;margin-top:16px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}
.bucket h4{margin:0 0 6px;font-size:.82rem;letter-spacing:.05em;text-transform:uppercase}
.bucket ul{margin:0;padding-left:18px;font-size:.92rem}
.bucket li{margin:5px 0}
.bucket p{margin:0;font-size:.92rem}

.filters{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}
.chipf{padding:7px 14px;border-radius:999px;border:var(--edge);background:none;color:var(--dim);cursor:pointer;font-size:.8rem}
.chipf.is-active{color:var(--cream);border-color:var(--cyan)}

.day{border:var(--edge);border-radius:14px;padding:18px 20px;margin-bottom:14px;background:rgba(255,243,207,.025)}
.day h4{margin:0 0 12px;font-size:.85rem;color:var(--dim);font-weight:600;letter-spacing:.04em;text-transform:uppercase}
.row{display:flex;gap:12px;padding:7px 0;border-top:1px solid rgba(255,243,207,.06);align-items:baseline}
.row:first-of-type{border-top:0}
.row[data-hidden="1"]{display:none}
.kind{flex:none;font-size:.66rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;
  padding:3px 8px;border-radius:6px;min-width:64px;text-align:center;color:var(--ink)}
/* min-width:0 is load-bearing, not decoration: a flex:1 item defaults to
   min-width:auto, which floors it at its own content's intrinsic width. A raw
   git subject can contain a long unbroken token (an ALL_CAPS_CONSTANT, a path)
   wide enough on its own to push the row past the viewport, and BODY has
   nothing clipping it, so that overflow becomes a page-wide horizontal
   scrollbar (director bug 2026-07-30, Full log view on mobile). min-width:0
   lets the row's real content still wrap, so the FIX is wrapping text, not a
   scroll box, per the no-body-scroll rule below. overflow-wrap is the same
   fix one layer down, for the rare single token wider than the column even
   after that. */
.what{flex:1;min-width:0;overflow-wrap:break-word}
.what .scope{color:var(--dim);font-size:.86rem}
.sha{flex:none;font-family:var(--mono);font-size:.76rem;color:var(--dim)}
.row.more{color:var(--dim);font-size:.83rem;font-style:italic;justify-content:center}

.bugrow{border:var(--edge);border-radius:12px;padding:14px 18px;margin-bottom:10px;background:rgba(255,243,207,.025)}
.bugrow-head{display:flex;gap:8px;margin-bottom:6px}
.bugtag{font-family:var(--mono);font-size:.74rem;color:var(--gold)}
.bugtag.new{color:var(--cyan)}
.bugwhat{margin:0 0 4px;color:var(--cream)}
.bugwhy{margin:0;color:var(--dim);font-size:.86rem}

/* AGGREGATE bug summary, counts only, no per-report anything. */
.bugtotals{margin-bottom:20px}
.bugareas{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));margin-bottom:16px}
.bugarea{border:var(--edge);border-radius:12px;padding:14px 16px;background:rgba(255,243,207,.025)}
.bugarea-count{display:block;color:var(--cream);font-size:1.7rem;font-weight:800;font-variant-numeric:tabular-nums}
.bugarea-name{display:block;color:var(--dim);font-size:.8rem;margin-top:2px}
.bugseverity{display:flex;flex-wrap:wrap;gap:8px}
.bugseverity span{padding:7px 14px;border-radius:999px;border:var(--edge);color:var(--dim);font-size:.8rem}
.bugseverity span b{color:var(--cream)}

/* GATING SWITCH lives in the script below (GATING_ENABLED). This wrapper is
   what a real gate would hide; today it renders unconditionally. */
.gated-section{}

@media (max-width:700px){
  .shell{flex-direction:column;gap:20px}
  /* THE NAV STRIP SCROLLS ITSELF, THE PAGE NEVER DOES. overflow-x:auto on a
     flex row only contains the row if the row is allowed to be narrower than
     its content, and a flex item defaults to min-width:auto, which floors it at
     intrinsic width. Without min-width:0 the strip is as wide as its longest
     child and the PAGE gets the scrollbar instead of the strip. Same defect the
     .what rule fixes one layer down, arriving from a different direction:
     director bug 2026-07-30 was the row, this is the nav (2026-08-01). */
  .side{width:100%;max-width:100%;min-width:0;position:static;flex-direction:row;
    overflow-x:auto;gap:8px;-webkit-overflow-scrolling:touch}
  .side a{white-space:nowrap}
  /* THE .stat OVERRIDE PAIR IS GONE, and its removal is the point rather than a
     tidy-up. It existed because a ~70-character SENTENCE was sitting inside a
     nowrap flex strip, making one unbreakable line the widest thing on the page;
     the fix was to hide it in the strip and re-show it underneath. Both rules
     were a workaround for the sentence being in the nav at all. The director
     moved it to the footer on 2026-08-01 and the workaround has nothing left to
     work around — the sentence now wraps because it is in a normal block, not
     because two rules argue about it at 700px. */
  .buckets{grid-template-columns:1fr}
}
</style>
</head>
<body>

<div class="topbar">
  ${AUTHBAR}
  <div class="topbar-row">
    <a class="brand" href="index.html">
      ${wordmark(48, 'l')}
      <span>
        <h1 class="chroma">WHOMP dev log</h1>
        <p class="subtag">Built by one person and a crew of AI agents. This is the real log.</p>
      </span>
    </a>
    <div class="chips">${liveChip()}</div>
  </div>
</div>

${searchMarkup(SEARCH_PLACEHOLDER)}

<div class="shell">
  <nav class="side">
    <a href="#shipped">Shipped</a>
    <a href="#bugs">Known bugs</a>
    <a href="#flight">In flight</a>
    <span class="wside-h" style="padding:14px 12px 6px;color:var(--gold);font-size:.7rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase">Wiki</span>
    <a href="wiki.html">All rosters</a>
    <a href="index.html">&larr; Back to WHOMP</a>
  </nav>

  <main class="main">
  <!-- GATING OFF (director, 2026-07-30): the log is public so testers with no
       account can reach it. Sign-in above still works. To re-gate later, flip
       GATING_ENABLED to true in the script at the bottom of this file, it
       already hides everything inside .gated-section behind the same
       getUser() check the authbar uses, no template change required. -->
  <div class="gated-section" id="gated-content">

  <section id="shipped">
    <div class="rule"></div>
    <h2 class="chroma">Shipped</h2>
    <p class="lede">Two ways to read it. Concise is Kevin's own notes, written for players. Full is the raw
      engineering log, generated straight from git, unedited, so a curious player can see everything.</p>

    <!-- id="views": the nav's Dev log link targets this, so arriving from anywhere
         lands ON the Concise / Full choice rather than above it. -->
    <div class="viewtoggle" id="views" role="tablist">
      <button class="vtab is-active" data-view="concise" type="button" role="tab" aria-selected="true">Concise</button>
      <button class="vtab" data-view="full" type="button" role="tab" aria-selected="false">Full log</button>
    </div>

    <div class="viewpane" id="view-concise">
      ${notes.length ? notes.map(noteCard).join('') : '<p class="lede">No notes yet. Check back after the next build.</p>'}
    </div>

    <div class="viewpane" id="view-full" hidden>
      <div class="filters" id="kind-filters">
        <button class="chipf is-active" data-kind="all" type="button">All</button>
        ${Object.entries(KIND_LABEL).map(([k, label]) => `<button class="chipf" data-kind="${k}" type="button">${esc(label)}</button>`).join('')}
      </div>
      ${fullFeed.map(([date, changes]) => dayBlock(date, changes)).join('')}
      ${allDays.length > LOG_DAYS_CAP ? `<p class="lede">${allDays.length - LOG_DAYS_CAP} earlier active days not shown here.</p>` : ''}
    </div>
  </section>

  <section id="bugs">
    <div class="rule"></div>
    <h2 class="chroma">Known bugs</h2>
    <p class="lede">${esc(bugFraming)}</p>
    <div class="chips bugtotals">
      <span class="chip">fixed <b>${totalFixedBugs ?? '?'}</b></span>
      <span class="chip">open <b>${totalOpenBugs}</b></span>
    </div>
    <div class="bugareas">
      ${bugAreaCounts.map((a) => `<div class="bugarea"><span class="bugarea-count">${a.count}</span><span class="bugarea-name">${esc(a.area)}</span></div>`).join('')}
    </div>
    <div class="bugseverity">
      ${bugSeverityCounts.map((s) => `<span>${esc(s.label)} <b>${s.count}</b></span>`).join('')}
    </div>
  </section>

  ${ownerBugSection}

  <section id="flight">
    <div class="rule"></div>
    <h2 class="chroma">In flight</h2>
    <p class="lede">What is actively being built, live from the campaign that drives the work.</p>
    <div class="arcs">${arcCards(arcs)}${backlogTeasers.map(flightCard).join('')}</div>
  </section>

  </div>
  </main>
</div>

<footer style="max-width:1180px;margin:0 auto;padding:0 24px 40px">
  Generated ${esc(buildStamp)} from <code>game@${esc(headSha)}</code>.
  ${live ? `Live build <code>${esc(live.sha)}</code>${live.sha === headSha ? ' (current)' : ' (a deploy is pending)'}.`
         : 'Live build could not be reached at generation time, so no live sha is claimed.'}
  <!-- Provenance, beside the provenance. See "THE COUNT IS NOT NAVIGATION" where
       these three numbers are derived, for what the count actually counts. -->
  <div class="stat">${totalShipped} player-visible changes in the last ${FEED_WINDOW_DAYS} days, across ${allDays.length} active days, ${filtered} internal-only commits filtered out</div>
</footer>

${AUTH_SCRIPT()}
<script type="module">
// GATING SWITCH (director, 2026-07-30): the log is public for now, so testers
// can reach it without an account. Sign-in still works above, it just is not
// required to read anything below. This value is set from the same
// GATING_ENABLED at the top of bin/generate.mjs, one flag, flipped in one
// place. Flip it there and regenerate: applyGating() starts hiding
// #gated-content until getUser() returns a signed-in user, the same session
// auth.js already exposes, no template rewrite needed.
const GATING_ENABLED = ${GATING_ENABLED};
function applyGating(user) {
  const el = document.getElementById('gated-content');
  if (!el) return;
  const locked = GATING_ENABLED && user === null;
  el.style.display = locked ? 'none' : '';
}
document.addEventListener('whomp-auth', (e) => applyGating(e.detail));
applyGating(window.__whompUser ?? null);

// OWNER-ONLY VIEW (dark). #owner-bugs only exists in this document at all
// when GATING_ENABLED was true when bin/generate.mjs ran (see ownerBugSection
// there), so while gating is off there is no element here to find and this
// check is a no-op. When it does exist, it still starts hidden and only this
// check reveals it, to the one signed-in identity that matches OWNER_EMAIL.
// Reminder for later, from the generator comment: this is a UI convenience on
// a static host, not real access control, every generated file is reachable
// by its own URL regardless of sign-in state.
const OWNER_EMAIL = ${JSON.stringify(OWNER_EMAIL)};
function applyOwnerGate(user) {
  const el = document.getElementById('owner-bugs');
  if (!el) return;
  const visible = GATING_ENABLED && !!user && user.email === OWNER_EMAIL;
  el.hidden = !visible;
}
document.addEventListener('whomp-auth', (e) => applyOwnerGate(e.detail));
applyOwnerGate(window.__whompUser ?? null);

// ---- view toggle (concise / full) ----
const vtabs = document.querySelectorAll('.vtab');
const panes = { concise: document.getElementById('view-concise'), full: document.getElementById('view-full') };
vtabs.forEach((tab) => tab.addEventListener('click', () => {
  vtabs.forEach((t) => { t.classList.remove('is-active'); t.setAttribute('aria-selected', 'false'); });
  tab.classList.add('is-active'); tab.setAttribute('aria-selected', 'true');
  const view = tab.dataset.view;
  Object.entries(panes).forEach(([k, el]) => { if (el) el.hidden = k !== view; });
}));

// ---- kind filters (full view only) ----
const kindChips = document.querySelectorAll('#kind-filters .chipf');
kindChips.forEach((chip) => chip.addEventListener('click', () => {
  kindChips.forEach((c) => c.classList.remove('is-active'));
  chip.classList.add('is-active');
  const kind = chip.dataset.kind;
  document.querySelectorAll('#view-full .row[data-kind]').forEach((row) => {
    row.dataset.hidden = (kind !== 'all' && row.dataset.kind !== kind) ? '1' : '0';
  });
}));

// ---- spoiler reveal ----
function toggleSpoiler(el) { el.classList.toggle('revealed'); }
document.addEventListener('click', (e) => {
  const t = e.target.closest('.spoiler');
  if (t) toggleSpoiler(t);
});
document.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList?.contains('spoiler')) {
    e.preventDefault();
    toggleSpoiler(e.target);
  }
});

// ---- search, over the generated index: notes, changes, bugs, arcs, in-flight,
// and now every wiki entry too, so a reader can type "wraith" here and land on
// the bestiary card. Cross-page results are why index entries carry a full href.
${SEARCH_SCRIPT(`
  // if the anchor is inside the full log, switch to that view first
  if (panes.full && panes.full.contains(target)) {
    vtabs.forEach((t) => { t.classList.remove('is-active'); t.setAttribute('aria-selected', 'false'); });
    document.querySelector('.vtab[data-view="full"]').classList.add('is-active');
    panes.concise.hidden = true; panes.full.hidden = false;
    document.querySelectorAll('#view-full .row[data-kind]').forEach((row) => { row.dataset.hidden = '0'; });
    kindChips.forEach((c) => c.classList.toggle('is-active', c.dataset.kind === 'all'));
  }`)}
</script>
</body>
</html>`;

// ---------------------------------------------------------------- search index
/* One small JSON file, built at generate time, over everything the page
 * shows: notes, the rendered commit feed, known bugs, arcs and in-flight work.
 * Loaded client-side and filtered live. No service, no dependency.
 *
 * KNOWN BUGS gets exactly one aggregate entry, counts only, same as the
 * public section itself. Per-report text (what/why/evidence) NEVER goes in
 * here, not even inside a GATING_ENABLED check: this file is a static asset
 * fetched with a plain, unauthenticated request, so anything written into it
 * ships to every visitor regardless of sign-in state. The owner-only detail
 * lives only in ownerBugSection's HTML (itself gated at build time), never in
 * this JSON. */
/* EVERY ENTRY CARRIES A FULL HREF, not a bare anchor. One index is shared by
 * log.html and every wiki page now, so a hit found on one page routinely lives
 * on another, and "#anchor" would silently scroll to nothing. `anchor` is kept
 * alongside it because the pages' own reveal logic still keys off the id. */
const logHref = (anchor) => `log.html#${anchor}`;
const searchIndex = [];
for (const n of notes) {
  const anchor = `note-${n.date}`;
  searchIndex.push({ type: 'note', title: n.title, text: n.intro.join(' ').replace(/[*|]/g, ''), anchor, href: logHref(anchor) });
  for (const b of n.buckets) {
    for (const block of b.blocks) {
      searchIndex.push({ type: b.name.toLowerCase(), title: n.title, text: block.replace(/[*|]/g, '').slice(0, 200), anchor, href: logHref(anchor) });
    }
  }
}
for (const c of renderedChanges) {
  searchIndex.push({ type: 'change', title: c.text, text: `${c.kind} ${c.scope}`, anchor: `chg-${c.sha}`, href: logHref(`chg-${c.sha}`) });
}
searchIndex.push({
  type: 'bugs',
  title: 'Known bugs',
  text: `${totalFixedBugs ?? '?'} fixed, ${totalOpenBugs} open. ${bugAreaCounts.map((a) => `${a.area} ${a.count}`).join(', ')}`,
  anchor: 'bugs',
  href: logHref('bugs'),
});
for (const a of arcs) {
  searchIndex.push({ type: 'arc', title: `${a.id} ${a.name}`, text: a.what, anchor: `flight-${slug(a.name)}`, href: logHref(`flight-${slug(a.name)}`) });
}
for (const t of backlogTeasers) {
  searchIndex.push({ type: 'in flight', title: t.name, text: t.blurb, anchor: `flight-${slug(t.name)}`, href: logHref(`flight-${slug(t.name)}`) });
}
searchIndex.push(...wiki.searchEntries);

// ---------------------------------------------------------------- link integrity
/* THE SITE IS A GRAPH AND A GRAPH ROTS AT THE EDGES. Weapon cards link to the
 * ship core built on them, cores link back to their donor weapon, splitters link
 * to what they leave behind, and every one of those hrefs is built from an id in
 * src/data. Rename a weapon there and the relation survives (the data layer
 * re-derives it) but a TYPO here, or a roster that quietly stops emitting a card,
 * produces an anchor that goes nowhere.
 *
 * So every internal wiki link is checked against the ids actually emitted, before
 * anything is written. This is cheap, it is exact, and it fails the build rather
 * than shipping a link that is dead until a reader finds it. Same reasoning as
 * parseGameTaglines throwing on an empty rotation: a generator that cannot do
 * what it was asked says so at the moment it happens.
 *
 * It also covers search-index.json, which is the easier one to get wrong because
 * nothing renders it at build time. */
const emittedDocuments = [
  { file: 'index.html', html: indexHtml },
  { file: 'log.html', html: logHtml },
  ...wiki.pages,
];
const withoutHtmlComments = (html) => html.replace(/<!--[\s\S]*?-->/g, '');
const emittedAnchors = new Map(); // file -> Set of element ids
const duplicateAnchors = [];
for (const p of emittedDocuments) {
  const ids = [...withoutHtmlComments(p.html).matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const uniqueIds = new Set(ids);
  if (uniqueIds.size !== ids.length) {
    const seen = new Set();
    duplicateAnchors.push(...ids.filter((id) => seen.has(id) || !seen.add(id)).map((id) => `${p.file}#${id}`));
  }
  emittedAnchors.set(p.file, uniqueIds);
}
const brokenLinks = duplicateAnchors.map((anchor) => `duplicate id ${anchor}`);
const checkHref = (href, where, currentFile = '') => {
  if (/^(?:https?:|mailto:|data:)/.test(href)) return;
  const [rawFile, anchor] = href.split('#');
  const file = (rawFile || currentFile).replace(/^\.\//, '');
  if (!file.endsWith('.html')) return;
  if (!emittedAnchors.has(file)) { brokenLinks.push(`${where}: no such page ${file}`); return; }
  if (anchor && !emittedAnchors.get(file).has(anchor)) brokenLinks.push(`${where}: ${file} has no #${anchor}`);
};
for (const p of emittedDocuments) {
  for (const m of withoutHtmlComments(p.html).matchAll(/href="([^"]+)"/g)) checkHref(m[1], p.file, p.file);
}
for (const e of searchIndex) checkHref(e.href, 'search-index');
if (brokenLinks.length) {
  throw new Error(`The site emitted ${brokenLinks.length} internal link(s) that resolve to nothing:\n  ${brokenLinks.join('\n  ')}\nFix the generator rather than shipping dead routes or anchors.`);
}

// ---------------------------------------------------------------- write
/* THE OUTPUT MANIFEST. Both deploy paths (this repo's bin/deploy-site.sh and the
 * game repo's bin/deploy-play.sh) stage exactly what the generator wrote, and
 * they used to do it from a hand-typed filename list in two different repos. That
 * list was correct for as long as the site had three files. The moment the wiki
 * added pages, a hand-typed list means the wiki silently stops refreshing on
 * deploy, in a way nobody notices because the deploy still succeeds and the dev
 * log still updates.
 *
 * So the generator writes what it wrote. The deploy scripts read this and stage
 * that, plus any tracked generated wiki route this run retired. It is still an
 * explicit list, never a wildcard add (this repo blocks `git add .` on purpose,
 * and a wildcard would happily commit a stray file), it just is not a list
 * anybody has to remember to update. Roster four costs nothing.
 *
 * The manifest is NOT itself deployed; it is a build-time handoff between the
 * generator and the deploy script, and it is gitignored. */
const OUTPUTS = [
  { file: 'index.html', body: indexHtml },
  { file: 'log.html', body: logHtml },
  { file: 'search-index.json', body: JSON.stringify(searchIndex) },
  { file: 'whomp-icon.svg', body: desktopIconSvg },
  ...wiki.pages.map((p) => ({ file: p.file, body: p.html })),
];
/* Every manifest path is a lowercase, slash-delimited relative path. Nested
   paths are required for the generated visual encyclopedia, but traversal,
   empty segments and shell-significant characters remain impossible. */
for (const o of OUTPUTS) {
  if (!safeGeneratedPath(o.file)) {
    throw new Error(`Output path "${o.file}" is not a safe lowercase generated path.`);
  }
}

/* RETIRED ROUTES ARE OUTPUTS TOO, in the only sense deploy cares about: their
 * deletion must be staged. Both deploy paths consume .site-outputs and call
 * `git add -- <path>`; a tracked path that no longer exists stages its deletion.
 * Enumerate the tracked generated namespace directly, not only files still on
 * disk: a prior interrupted generation may already have removed a route or
 * asset before staging it. Remove only generated wiki filenames that are absent
 * from this exact model, and add only tracked retirements to the staging manifest
 * so an untracked stale preview file cannot make `git add` fail. */
const outputFiles = [...OUTPUTS.map((output) => output.file), ...visualAssets.map((asset) => asset.file)];
const expectedWikiFiles = new Set(outputFiles.filter((file) => /^wiki.*\.html$/.test(file)));
const trackedGeneratedFiles = listTrackedGeneratedFiles(OUTDIR);
const trackedGeneratedWikiFiles = trackedGeneratedFiles.filter((file) => /^wiki.*\.html$/.test(file));
const trackedGeneratedVisualFiles = trackedGeneratedFiles.filter((file) => file.startsWith('wiki-assets/'));
const invalidTrackedGeneratedFiles = trackedGeneratedFiles.filter((file) => !/^wiki.*\.html$/.test(file)
  && !/^wiki-assets\/(?:[a-z0-9][a-z0-9._-]*\/)*[a-z0-9][a-z0-9._-]*\.png$/.test(file));
if (invalidTrackedGeneratedFiles.length) {
  throw new Error(`Tracked generated namespace contains unclassified paths: ${invalidTrackedGeneratedFiles.join(', ')}`);
}
const trackedRetiredWikiFiles = trackedGeneratedWikiFiles.filter((file) => !expectedWikiFiles.has(file));
const staleWikiFilesOnDisk = readdirSync(OUTDIR, { withFileTypes: true })
  .filter((entry) => entry.isFile() && /^wiki.*\.html$/.test(entry.name) && !expectedWikiFiles.has(entry.name))
  .map((entry) => entry.name)
  .sort();
const retiredGeneratedWikiFiles = [...new Set([...staleWikiFilesOnDisk, ...trackedRetiredWikiFiles])].sort();
for (const file of staleWikiFilesOnDisk) unlinkSync(join(OUTDIR, file));
const walkGeneratedFiles = (root, current = root) => {
  if (!existsSync(current)) return [];
  const files = [];
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    const path = join(current, entry.name);
    if (entry.isDirectory()) files.push(...walkGeneratedFiles(root, path));
    else if (entry.isFile()) files.push(portable(relative(OUTDIR, path)));
  }
  return files.sort();
};
const expectedVisualFiles = new Set(visualAssets.map((asset) => asset.file));
const trackedRetiredVisualFiles = trackedGeneratedVisualFiles.filter((file) => !expectedVisualFiles.has(file));
const staleVisualFilesOnDisk = walkGeneratedFiles(join(OUTDIR, 'wiki-assets'))
  .filter((file) => !expectedVisualFiles.has(file));
const retiredVisualFiles = [...new Set([...staleVisualFilesOnDisk, ...trackedRetiredVisualFiles])].sort();
for (const file of staleVisualFilesOnDisk) {
  if (!safeGeneratedPath(file) || !file.startsWith('wiki-assets/')) {
    throw new Error(`Refusing to retire visual output outside wiki-assets: ${file}`);
  }
  unlinkSync(join(OUTDIR, ...file.split('/')));
}
/* Optional template rows interpolate as empty strings. Keep their surrounding
 * indentation out of the committed HTML so generated releases stay clean under
 * `git diff --check`; non-HTML assets (especially the canonical icon) remain
 * byte-for-byte untouched. */
for (const o of OUTPUTS) {
  const body = o.file.endsWith('.html') ? o.body.replace(/[ \t]+$/gm, '') : o.body;
  writeFileSync(join(OUTDIR, o.file), body);
}
for (const asset of visualAssets) {
  const destination = join(OUTDIR, ...asset.file.split('/'));
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, asset.bytes);
}
const stagingManifest = [...new Set([
  ...outputFiles,
  ...trackedRetiredWikiFiles,
  ...trackedRetiredVisualFiles,
])];
if (stagingManifest.some((file) => !safeGeneratedPath(file))) {
  throw new Error('Generated staging manifest contains an unsafe relative path.');
}
writeFileSync(join(OUTDIR, '.site-outputs'), `${stagingManifest.join('\n')}\n`);

/* VALIDATE THE EXACT CANDIDATE RELEASE. Artifact pins above prove the inputs;
 * this consumer-side contract proves those inputs survived as complete routes,
 * cards, anchors and search edges in the files just written. Both established
 * deploy paths call this generator before staging, so a non-zero checker exit
 * stops publication without either deploy script needing a second hand-wired
 * gate. wiki-check imports the wiki model only and cannot recurse here. */
const WIKI_CHECK_PATH = join(SITE_ROOT, 'bin/wiki-check.mjs');
if (!existsSync(WIKI_CHECK_PATH)) {
  throw new Error(`Refusing to publish unchecked wiki output: ${WIKI_CHECK_PATH} does not exist.`);
}
console.log('validating generated wiki contract');
try {
  execFileSync(process.execPath, [WIKI_CHECK_PATH, '--repo', REPO, '--outdir', OUTDIR], {
    cwd: SITE_ROOT,
    stdio: 'inherit',
  });
} catch (error) {
  const status = Number.isInteger(error?.status) ? ` (exit ${error.status})` : '';
  throw new Error(`Refusing to publish generated wiki output: bin/wiki-check.mjs failed${status}.`, { cause: error });
}

console.log(`wrote ${OUTPUTS.length} documents and ${visualAssets.length} verified visual variants to ${OUTDIR}`);
if (retiredGeneratedWikiFiles.length) {
  console.log(`  retired ${retiredGeneratedWikiFiles.length} stale wiki route(s); ${trackedRetiredWikiFiles.length} deletion(s) added to the staging manifest`);
}
if (retiredVisualFiles.length) {
  console.log(`  retired ${retiredVisualFiles.length} stale visual output(s); ${trackedRetiredVisualFiles.length} deletion(s) added to the staging manifest`);
}
console.log(`  game@${headSha}  live=${live ? live.sha : 'unreachable'}`);
console.log(`  ${totalShipped} player-visible changes in the last ${FEED_WINDOW_DAYS} days since ${windowStart}, across ${allDays.length} active days (${filtered} noise commits filtered)`);
console.log(`  ${arcs.length} arcs, ${backlogTeasers.length} backlog teasers, ${openBugs.length} open bugs, ${notes.length} authored notes`);
console.log(`  wiki: ${wiki.rosters.length} rosters, ${wiki.rosters.map((r) => `${r.title} ${r.entries.length}`).join(', ')}`);
console.log(`  site: ${[...emittedAnchors.values()].reduce((n, s) => n + s.size, 0)} anchors, all internal links resolve`);
if (wiki.gaps.length) {
  console.log(`  wiki: ${wiki.gaps.length} enum value(s) with no written explanation yet, shown as the bare value:`);
  for (const g of wiki.gaps) console.log(`    ${g}`);
}
console.log(`  search index: ${searchIndex.length} entries`);
