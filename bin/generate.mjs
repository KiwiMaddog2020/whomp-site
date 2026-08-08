#!/usr/bin/env node
/** THE WHOMP SITE GENERATOR, the generated spine.
 *
 *  "Generated spine, authored highlights": a job derives deploys, the live sha,
 *  the campaign arcs and the known-bug counts FROM THE REPO, so the site cannot
 *  go stale or lie, and the part a machine cannot pick, which changes actually
 *  mattered to a player, is always a human's words.
 *
 *  WHERE THOSE WORDS COME FROM, changed 2026-08-05: the concise view used to
 *  wait for notes/<date>.md, a second act of writing that only Kevin could
 *  perform, and it spent six shipping days empty because of it. It now reads the
 *  game's own release notes (whomp/src/data/patchNotes.ts), which are authored
 *  by hand at release time and already ship to players in the title screen's
 *  WHAT'S NEW panel. The human is still the one picking; they are picking once
 *  instead of twice. An authored notes/<date>.md still replaces the generated
 *  entry for that day, completely. See "derive: one concise entry per release"
 *  below and the header of bin/patch-notes.mjs.
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
import { buildStory, readableNights, windowDates } from './devlog.mjs';
import { listTrackedGeneratedFiles } from './generated-output-git.mjs';
import {
  buildPipelineTeasers, kitCards, kitShape, localDay, parseArcs, parseBuildSlots,
  parseChannelMode, parseReleaseChannelUrls, renderableArcs, runShape,
} from './landing.mjs';
import { pinWarning, trainScale, verifyPins } from './pitch.mjs';
import { fetchLiveVersion, normalizeSuppliedLiveVersion } from './live-version.mjs';
import { KEY_CHANGE_CAP, readPatchReleases } from './patch-notes.mjs';
import {
  buildWiki, EXPLAINER_FILE, EXPLAINER_SLUG, EXPLAINER_TITLE, rosterSpecs, visualOutputPath, WIKI_CSS,
} from './wiki.mjs';

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

/* WHERE THE SITE ITSELF LIVES. Only the social-card tags need it: og:url and the
 * absolute image URL an unfurler fetches, neither of which can be relative. It
 * is the same origin bin/deploy-site.sh prints when it finishes. */
const SITE_URL = 'https://kiwimaddog2020.github.io/whomp-site';

/* WARNINGS ARE A GATE, NOT A CONSOLE DECORATION, AND THAT ONLY WORKS IF THEY
 * ARE RARE. bin/regenerate-and-verify.sh fails the run on a non-zero WARNING
 * count, which is how a dropped arc or a teaser for work that already shipped
 * becomes a red lane instead of a line nobody read in a deploy log.
 *
 * SO THERE ARE TWO SEVERITIES, and the split is the whole point. A gate that is
 * red on the first day for something the lane cannot fix teaches everyone to
 * ignore it, which is the same defect as the permanent gold "a deploy is
 * pending" dot this train just retired, arriving from the other direction.
 *
 *   WARNING  the page is wrong or incomplete AND this repo can fix it, or the
 *            fix is one line in a file a person can open today. Fails the gate.
 *   NOTE     true, worth saying, owned upstream. The game's roadmap describing
 *            an arc with last Thursday in it is real rot and the fix belongs in
 *            the game repo; the site refuses to rewrite the game's prose, so it
 *            reports and moves on. Never fails the gate.
 *
 * Anything printed through either must name the file a human has to open. */
const warnings = [];
const siteNotes = [];
const warn = (message) => {
  warnings.push(message);
  console.warn(`SITE WARNING: ${message}`);
};
const note = (message) => {
  siteNotes.push(message);
  console.warn(`SITE NOTE: ${message}`);
};

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

/* The same mark as a raster, for the social card. An unfurler will not render
 * SVG, so the one place the site needs a bitmap is exactly here. Read as bytes
 * and written untouched, same contract as every wiki-assets copy: the site never
 * redraws, rescales or re-encodes canonical game art. */
const SOCIAL_ICON_PATH = join(REPO, 'public/icons/icon-512.png');
if (!existsSync(SOCIAL_ICON_PATH)) {
  throw new Error(`No canonical 512px WHOMP icon at ${SOCIAL_ICON_PATH}. The social card image is copied from the game and is never redrawn or rescaled here.`);
}
const socialIconBytes = readFileSync(SOCIAL_ICON_PATH);

// ---------------------------------------------------------------- derive: identity
const pkg = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8'));
/* AUTHORED, deliberately NOT derived from package.json. The repo description is
 * written for developers and name-drops the two games WHOMP gets compared to,
 * which the director cut as "a bit much" for a public page: leading with someone
 * else's games sells theirs, not ours. This is the one string on the site that is
 * marketing copy rather than repo truth, so it lives here and Kevin owns it. */
const TAGLINE = 'A 3D horde-survivor where one weapon is yours to aim.';

/* Provenance names the exact checkout whose artifacts were just verified, not
 * whatever commit the local `main` ref happens to point at. Deploy normally
 * consumes main, but explicit --repo worktrees must not be mislabeled. */
const headSha = git('rev-parse', '--short', 'HEAD');

/* AND THE FEED READS `main`, WHICH IS THE OTHER HALF OF THE SAME SENTENCE.
 *
 * Every page here stamps `game@<HEAD>` in its footer, and the `git log` below
 * that builds the day by day story and the raw feed asks `main` instead. On an
 * ordinary checkout sitting on main those are one commit and nobody notices.
 * On a detached checkout, a worktree, or a clone whose branch has moved, they
 * are two, and the page then states a provenance its own feed does not match.
 *
 * FOUND BY LOOKING AT THE RENDER, 2026-08-06, not by reasoning: a site built
 * from a checkout detached at 7c74385c inside a clone whose main pointed 34
 * commits later published a footer reading game@7c74385c above a story counting
 * 727 changes, seven of which were not in that tree. Every check passed. The
 * page was internally consistent and externally false, which is precisely the
 * failure this repo exists to refuse, arriving through the one door nothing was
 * watching.
 *
 * A WARNING RATHER THAN A THROW, because the situation is legitimate (this is
 * how a preview build off a worktree is supposed to work) and the fix is one
 * command in the checkout being read. What is not legitimate is publishing it
 * without saying so. */
const mainSha = (() => {
  try { return git('rev-parse', '--short', 'main'); } catch { return null; }
})();
if (mainSha && mainSha !== headSha) {
  warn(`${REPO} is checked out at ${headSha} but its main ref is at ${mainSha}. Every page stamps the first and the shipped feed is read from the second, so this build would publish a provenance its own dev log does not match. Check out main there, or move main, before publishing.`);
}

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

// ---------------------------------------------------------------- derive: the two release tracks
/* BOTH PLAY BUTTONS POINT WHERE THE GAME SAYS. src/core/releaseChannel.ts holds
 * the audited channel table the game itself links between tracks with, so the
 * site reads it rather than keeping a second copy that goes wrong the next time
 * a track moves. The Stable URL used to be a hand-typed constant right here. */
const RELEASE_CHANNEL_PATH = join(REPO, 'src/core/releaseChannel.ts');
if (!existsSync(RELEASE_CHANNEL_PATH)) {
  throw new Error(`No ${RELEASE_CHANNEL_PATH}. Both play buttons are read from the game's audited release-channel table and will not be hand-typed here.`);
}
const TRACK_URL = parseReleaseChannelUrls(readFileSync(RELEASE_CHANNEL_PATH, 'utf8'));

/* THE CHANNEL MODE IS THE GAME'S FLAG, read from the same tree the buttons are
 * (director, 2026-08-07 15:57: one deploy for a while, feature off, not
 * removed). In single mode this page shows one play button and one live chip,
 * and names no track, because the game itself names none
 * (releaseChannelLabelForPlayer returns null everywhere in single mode). A
 * tree without the flag predates it, and that tree IS the dual era. */
const CHANNEL_MODE_PATH = join(REPO, 'src/core/channelMode.ts');
const channelMode = existsSync(CHANNEL_MODE_PATH)
  ? parseChannelMode(readFileSync(CHANNEL_MODE_PATH, 'utf8'))
  : 'dual';

// ---------------------------------------------------------------- derive: what is actually live
/* The live sha is the ONLY proof of live (deploy-verification law), so the site
 * reports it as measured, and says so plainly when it could not measure it.
 *
 * TWO TRACKS ARE MEASURED NOW, not one. Until 2026-08-06 this page fetched
 * Stable, printed its sha, compared it against the wiki's source sha and lit a
 * gold "a deploy is pending" dot whenever they differed. They differ BY DESIGN:
 * Stable is the weekly promotion and the site regenerates off main, so the dot
 * was on permanently and was the first thing a stranger read. A comparison
 * between two things that are supposed to be different is not a status, and it
 * is replaced by what each track is actually serving.
 *
 * --sha/--version still speak for Stable only, because that is the track the
 * deploy ritual that passes them publishes. Preview is always measured. */
let live = null;
if (SHA_ARG) {
  live = normalizeSuppliedLiveVersion(SHA_ARG, VERSION_ARG || pkg.version);
} else if (!OFFLINE && channelMode === 'dual') {
  live = await fetchLiveVersion(`${TRACK_URL.stable}version.json`, 'stable');
}
const previewLive = OFFLINE ? null : await fetchLiveVersion(`${TRACK_URL.preview}version.json`, 'preview');
/* Single mode: one track, and its label is not a channel name, because the
 * player never meets a second channel to distinguish it from. The measured
 * endpoint wins over a supplied --sha, same preference as before. */
const tracks = channelMode === 'single'
  ? [{ channel: 'preview', label: 'Live', url: TRACK_URL.preview, live: previewLive ?? live }]
  : [
    { channel: 'preview', label: 'Preview', url: TRACK_URL.preview, live: previewLive },
    { channel: 'stable', label: 'Stable', url: TRACK_URL.stable, live },
  ];
for (const track of tracks) {
  if (!track.live && !OFFLINE) note(`${track.label} did not answer at ${track.url}version.json, so the page says its build is unverified rather than naming one.`);
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
 * a UTC boundary is a different day for most of the evening in this timezone.
 * `--date=short-local` (2026-08-07): plain `--date=short` prints each commit
 * in its own RECORDED offset, not the viewer's clock, and the cloud lanes
 * commit in UTC, so an evening's merged lane work self-dated tomorrow and
 * fell outside a window drawn in local days. The -local suffix is the one
 * clock both halves are reckoned in. The first run generated
 * "751 changes in the last 7 days ... across 6 active days" — a seven-day window
 * that had quietly become six, off by exactly the UTC offset. The window and the
 * dates it is compared against have to be reckoned in the same clock.
 *
 * THE SUBTRACTION IS CALENDAR ARITHMETIC NOW, not `Date.now() - 6 * 86400000`,
 * and the reason is the day-by-day story below. That subtraction is off by an
 * hour on the two days a year the clocks move, which is harmless for a `--since`
 * bound and is NOT harmless for a story that renders one card per calendar day:
 * the feed would carry a commit dated one day outside the range the story drew,
 * and the story would report its own source as out of window. One function now
 * produces both, so the two cannot disagree about what seven days means. */
const REFERENCE_DAY = localDay();
const STORY_DATES = windowDates(REFERENCE_DAY, FEED_WINDOW_DAYS);
const windowStart = STORY_DATES[STORY_DATES.length - 1];
const RAW = git(
  'log', 'main', '--date=short-local', '--pretty=%h\x1f%ad\x1f%s',
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
 * rather than a second hand-maintained roadmap that drifts within a week.
 *
 * THE PARSE MOVED TO bin/landing.mjs (2026-08-06) and grew three jobs, because
 * the roadmap being one source of truth did not stop the PAGE from lying about
 * it. It folded wrapped lines so A6 and A9 stopped mid-list, it printed
 * "Wed 7/30" for a week after that Wednesday, and it printed "next week" on a
 * static page. Those are text rules, text rules rot silently, and the only way
 * to keep eyes on them is to make them testable. See tests/landing.test.mjs.
 *
 * REFERENCE_DAY is derived up beside the feed window now, because the day-by-day
 * story reads one card per calendar day and has to be reckoned in the same clock
 * the `git log` bound was. */
const campaignPath = join(REPO, 'docs/CAMPAIGN.md');
const parsedArcs = existsSync(campaignPath)
  ? parseArcs(readFileSync(campaignPath, 'utf8')).map((a) => ({ ...a, name: cleanDoc(a.name), when: cleanDoc(a.when), what: cleanDoc(a.what) }))
  : [];
const arcRender = renderableArcs(parsedArcs, REFERENCE_DAY);
const arcs = arcRender.cards;
for (const gone of arcRender.dropped) {
  warn(`Arc ${gone.id} ${gone.name} was left off the page: ${gone.reason} Fix the line in ${REPO}/docs/CAMPAIGN.md.`);
}
/* WHAT THE SITE MAY NOT FIX. An arc whose own description is a schedule
 * ("S1 Thu, S2 Fri/weekend, Deck later.") cannot be repaired by dropping a
 * clause without destroying the sentence, and rewriting the game's roadmap prose
 * here would make this repo a second author of it. So it is reported, every run,
 * naming the arc and the file, and the fix lands in the game repo. */
for (const stale of arcRender.expiredBody) {
  note(`Arc ${stale.id} ${stale.name} describes itself with a schedule that has passed: "${stale.what}" The site will not rewrite the game's roadmap; fix the line in ${REPO}/docs/CAMPAIGN.md.`);
}

// ---------------------------------------------------------------- derive: what a run is
/* THE ONE NUMBER A LANDING PAGE FOR THIS GAME HAS TO GET RIGHT. See runShape in
 * bin/landing.mjs for why it comes out of the mode registry and not out of
 * docs/GAME_SPEC.md, which still describes a run eight minutes longer than the
 * one the game actually plays. */
const run = runShape(gameData);

// ---------------------------------------------------------------- derive: what you carry
/* THE FIVE THINGS A PLAYER HOLDS, and the one place the site has to read the
 * game's CODE rather than its data layer to say so. Roster sizes are domain
 * counts like every other number on this page; how many of each you may hold at
 * once is a constant in src/sim/progression.ts and appears in no artifact. See
 * parseBuildSlots and kitShape in bin/landing.mjs. */
const PROGRESSION_PATH = join(REPO, 'src/sim/progression.ts');
if (!existsSync(PROGRESSION_PATH)) {
  throw new Error(`No ${PROGRESSION_PATH}. The kit section states how many weapons and tomes a build holds, read from the game's own constants, and will not hand-type them.`);
}
const kit = kitShape(gameData, parseBuildSlots(readFileSync(PROGRESSION_PATH, 'utf8')));

// ---------------------------------------------------------------- derive: what is coming
/* The game's own queue, read as rows, said as sentences. buildPipelineTeasers
 * carries the whole argument for why the rows are derived and the sentences are
 * authored; the short version is that a row title is a lane name, several of
 * them are defect reports, and a landing page that publishes those has published
 * an engineering backlog to strangers. */
const WISHLIST_PATH = join(REPO, 'docs/train/WISHLIST.md');
let pipeline = { cards: [], unwritten: [], orphaned: [], queued: 0 };
if (existsSync(WISHLIST_PATH)) {
  pipeline = buildPipelineTeasers(readFileSync(WISHLIST_PATH, 'utf8'));
  for (const file of pipeline.orphaned) {
    warn(`The landing page carries a teaser for ${file}, which has left docs/train/WISHLIST.md. Either it shipped, in which case delete its entry from PIPELINE_TEASERS in bin/landing.mjs, or the wishlist moved.`);
  }
} else {
  warn(`No ${WISHLIST_PATH}, so the landing page has nothing to say about what is coming. The queue moved.`);
}
/* Shown at most six, and the rest are SAID rather than dropped, same
 * no-silent-caps law as the feed's "+N more that day, not shown". */
const PIPELINE_SHOWN = 6;
const pipelineCards = pipeline.cards.slice(0, PIPELINE_SHOWN);

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

/* BUCKET_NAMES is the parsing vocabulary for AUTHORED notes: the four headings
 * Kevin may write in notes/*.md. BUCKET_INK is the DISPLAY map and carries one
 * more, "Highlights", which no authored note can produce because it is not in
 * BUCKET_NAMES. Generated release entries use it for keyChanges, which mix new
 * and improved and would be a lie under either "New" or "Better". */
const BUCKET_NAMES = ['New', 'Better', 'Fixed', 'Coming'];
const BUCKET_RE = new RegExp(`^##\\s+(${BUCKET_NAMES.join('|')})\\s*$`, 'i');
const BUCKET_INK = { New: '--cyan', Better: '--violet', Fixed: '--pink', Coming: '--gold', Highlights: '--cyan' };

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

// ------------------------------------------- derive: one concise entry per release
/* THE GUARD MOVED, IT DID NOT VANISH (Kevin 2026-08-05: "i would like a system
 * where i do not have to approve the drafts. if we can get the voice right and
 * convey the release info that is the goal. i do not want too many additional
 * systems to maintain manually and the value is not there for this yet.")
 *
 * The comment on parseNote above is still the law of this view: a machine
 * cannot pick highlights. What this block does is find the place a human ALREADY
 * picked them. whomp/src/data/patchNotes.ts carries, per release, a headline and
 * a keyChanges list capped at four, written in player-facing language when the
 * release is cut and shipped to players in the title screen's WHAT'S NEW panel.
 * That is the same property notes/*.md existed to supply, already being produced
 * once as part of shipping. Nothing here composes a sentence about the game; see
 * the header of bin/patch-notes.mjs for why that is the load-bearing part.
 *
 * WHY NOT git log. Because the full view already is git log, and a concise view
 * sourced from commits is that view with fewer words. The toggle would offer a
 * reader two doors into the same room.
 *
 * NO APPROVAL QUEUE, NO DRAFT STATE, NO BADGE. Ruled out on cost: an approval
 * surface only Kevin can operate is a weekly tax with no second beneficiary, and
 * an "unreviewed" mark with no review path would be permanent and would read as
 * an apology on every entry. */
const releases = readPatchReleases(REPO);

/* HAND-WRITTEN WINS, COMPLETELY. A note replaces the generated entry for the
 * DAY it is dated and for the VERSION it declares. Both keys, because both are
 * explicit acts by the author and neither alone is enough:
 *
 *   DATE alone is not enough. notes/2026-07-30.md declares `version: 0.5.0`
 *   while PATCH_RELEASES dates 0.5.0 to 2026-07-25, so on the date key nothing
 *   is suppressed and the page renders two entries chipped v0.5.0 with
 *   different content in them. Two entries claiming one version is worse than
 *   either of them being missing.
 *
 *   VERSION alone is not enough either. The field is optional, and a note
 *   written on release day without one still has to replace that day's entry.
 *
 * A date can cover two releases (0.2.0 and 0.2.1 are both 2026-07-17, from
 * before the current one-release-per-Vancouver-date cadence) and a note on such
 * a day replaces both, which is what "Kevin wrote that day's entry" means.
 *
 * THE COST, SAID OUT LOUD: a note that names a version takes that version's
 * slot, so the release notes for it are not published. That is the contract
 * working, not a bug, but it does mean a note carrying the wrong version number
 * hides a release. Deleting the `version:` line from the front matter publishes
 * both; there is nothing to turn off and no flag to remember. */
const authoredDates = new Set(notes.map((n) => n.date));
const authoredVersions = new Set(notes.map((n) => n.version).filter(Boolean));

/* bugFixes is not capped at the source the way keyChanges is (0.6.0 carries
 * ten), and ten fix lines under four highlights is the drift back into a full
 * list that this view cannot survive. So it is capped HERE, and the remainder
 * is said out loud rather than silently dropped: same no-silent-caps law as the
 * "+N more that day, not shown" line in the full feed. The order is the order
 * the release author wrote them in, which is an authored ordering and not a
 * machine ranking; the page never claims the shown four are the important four,
 * only that there are more and where they are. */
const BUG_FIXES_SHOWN = 4;
/* A ceiling on the whole view, for the same reason the full feed has one. It is
 * above the full view's reach on purpose (that view holds 30 days; this holds
 * roughly two months of releases at the current cadence), because a summary
 * that remembers less than the raw log is the wrong way round. */
const CONCISE_RELEASES_CAP = 24;

const releaseEntries = releases
  .filter((r) => !authoredDates.has(r.date) && !authoredVersions.has(r.version))
  .map((r) => ({
    kind: 'release',
    date: r.date,
    version: r.version,
    anchor: `release-${slug(r.version)}`,
    title: cleanDoc(r.headline),
    keyChanges: r.keyChanges.map(cleanDoc),
    bugFixes: r.bugFixes.map(cleanDoc),
  }));

const authoredEntries = notes.map((n) => ({
  kind: 'authored',
  date: n.date,
  version: n.version,
  anchor: `note-${n.date}`,
  title: n.title,
  intro: n.intro,
  buckets: n.buckets,
}));

/* Newest first, and version breaks a date tie so the two 2026-07-17 releases
 * do not render in whatever order the sort happened to leave them. */
const conciseEntries = [...authoredEntries, ...releaseEntries]
  .sort((a, b) => b.date.localeCompare(a.date) || String(b.version).localeCompare(String(a.version)));
const conciseShown = conciseEntries.slice(0, CONCISE_RELEASES_CAP);
const conciseDropped = conciseEntries.length - conciseShown.length;

/* LOUD ON EMPTY. This is the failure this whole lane exists to end: a generator
 * that runs clean, exits zero, and publishes a concise view with nothing in it.
 * readPatchReleases already refuses a zero-release parse, so reaching here empty
 * would mean the merge above dropped everything. */
if (conciseShown.length === 0) {
  throw new Error('The concise dev log has no entries to publish. Every release was filtered out and no authored note survived, which would ship a blank default view. Fix the merge in bin/generate.mjs rather than publishing an empty page.');
}

// ------------------------------------------------- derive: the day by day story
/* THE THIRD READING OF THE SAME TWO ARRAYS. Concise is one entry per release,
 * Full is git log with the noise removed, and neither of them can answer "what
 * happened yesterday" because neither has a day in it that nothing shipped on.
 * The story does: one card per calendar day across the same window the feed
 * covers, quiet days included, newest first.
 *
 * It composes nothing about the game. See the header of bin/devlog.mjs for why
 * that boundary is the whole design, and bin/patch-notes.mjs for where the rule
 * came from. What it composes are sentences about the SHAPE of a day, off counts
 * it read; what it quotes are the release headline and the nightly line, both
 * written by a person.
 *
 * THE NIGHTLY FILE DOES NOT EXIST YET. docs/train/nightly.md in the game repo is
 * the place the overnight train would write, and it is read here optionally so
 * that the first night it appears needs no site change. Every line it carries is
 * refused unless a stranger could read it; the refusals are NOTES, because that
 * prose belongs to the game repo and this one does not rewrite it. */
const nightlyPath = join(REPO, 'docs/train/nightly.md');
const nights = readableNights(existsSync(nightlyPath) ? readFileSync(nightlyPath, 'utf8') : '');
/* AN ENTRY DATED THAT DAY IS NOT A RELEASE CUT THAT DAY. A hand-written note
 * carries the date it was WRITTEN, and notes/2026-07-30.md declares 0.5.0, which
 * shipped on the 25th. So an entry is marked as a cut only when the game's own
 * patch notes date that exact version to that exact day; the story's sentence
 * about how many releases were cut counts those, and every entry keeps its link
 * regardless, because a link is about where to read more. */
const cutOn = new Set(releases.map((r) => `${r.date}|${r.version}`));
const releasesByDate = new Map();
for (const entry of conciseShown) {
  if (!releasesByDate.has(entry.date)) releasesByDate.set(entry.date, []);
  releasesByDate.get(entry.date).push({ ...entry, cut: cutOn.has(`${entry.date}|${entry.version}`) });
}
const story = buildStory({
  lastDay: REFERENCE_DAY,
  windowDays: FEED_WINDOW_DAYS,
  changesByDate: days,
  releasesByDate,
  nightsByDate: nights.byDate,
});
/* The window and the feed are drawn by one function now (see THE SUBTRACTION IS
 * CALENDAR ARITHMETIC above `git log`), so this should be unreachable. It is
 * kept because the alternative to reporting it is dropping a day of shipped work
 * on the floor with nobody told, and that is exactly the class of silence this
 * whole file argues against. */
for (const date of story.outside) {
  warn(`${date} carries player-visible commits that fall outside the ${FEED_WINDOW_DAYS} day window the story draws, so that day is in the feed and not in the story. The two are reckoned in one clock in bin/generate.mjs; find where they came apart.`);
}
for (const held of nights.trimmed) {
  note(`${held.date} in ${REPO}/docs/train/nightly.md carries ${held.held} more readable line${held.held === 1 ? '' : 's'} than the story shows. Shorten the night or accept that the rest stays off the page.`);
}
for (const gone of nights.refused) {
  note(`A line dated ${gone.date} in ${REPO}/docs/train/nightly.md is not published because ${gone.reason}: "${gone.line}" The site will not rewrite the game's prose; write the line for a reader or leave it where it is.`);
}

// ------------------------------------------------------ derive: the pitch's right to speak
/* built-in-the-open.html is the only page on this site whose copy is authored
 * rather than derived, because it describes a process and a process is not a
 * number in a catalog. What IS derived is the right to print each sentence: every
 * claim names a file in the game repo and the patterns that must still be found
 * there. See the header of bin/pitch.mjs.
 *
 * A claim that stops being earned is DROPPED from the page and WARNED about, the
 * same call renderableArcs makes for an arc that trails off and for the same
 * reason: publishing an unearned claim is the failure, and taking the whole site
 * down over one sentence is not the fix. */
const readGameDoc = (path) => (existsSync(join(REPO, path)) ? readFileSync(join(REPO, path), 'utf8') : null);
const pitch = verifyPins(readGameDoc);
for (const pin of [...pitch.missingSource, ...pitch.missingEvidence]) warn(pinWarning(pin, REPO));

/* ONE NUMBER, AND IT COUNTS LANES RATHER THAN COMMITS. Commits are already
 * counted twice on this site and a third count of the same thing proves nothing
 * new. A retired claims file is exactly one merged lane: the game repo's own
 * docs/claims/README.md makes retiring part of the merge and makes a reused slug
 * non-overwriting, so the file count is the lane count. */
const retiredClaimsDir = join(REPO, 'docs/claims/retired');
const landedLanes = existsSync(retiredClaimsDir)
  ? readdirSync(retiredClaimsDir).filter((f) => f.endsWith('.claims')).length
  : 0;
const rootCommits = git('rev-list', '--max-parents=0', 'HEAD').split('\n').filter(Boolean);
const firstDay = rootCommits
  .map((sha) => git('log', '-1', '--date=short-local', '--pretty=%ad', sha))
  .sort()[0] || '';
const scale = trainScale({ landedLanes, firstDay });
if (!scale.ok) warn(`The page about how this game is built cannot state its scale: ${scale.reason}. Look at ${REPO}/docs/claims/retired before publishing a pitch with a hole where its one number goes.`);

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

/* THE CARD, on all three surfaces (finding 7, 2026-08-06). A link to any page on
 * this site unfurled as a bare URL in every chat window, every DM and every post
 * it was ever pasted into, because none of the three carried a single og: or
 * twitter: tag. That is the cheapest reach this project has and it was off.
 *
 * THE IMAGE IS THE CANONICAL ICON, copied byte-for-byte out of the game's own
 * public/icons/icon-512.png at build time, exactly as whomp-icon.svg already is.
 * The alternative was a hand-taken screenshot, and a screenshot on a landing page
 * for a build that changes most days is a promise about a version that shipped
 * weeks ago. A 512-square icon is honest, it is already the brand reference by
 * director ruling, and it never goes stale.
 *
 * summary, NOT summary_large_image, for the same reason: the card matches the
 * asset. A square icon stretched into a 2:1 banner looks like a mistake, and
 * claiming a large image the site does not have is the wrong kind of confident. */
const SOCIAL_IMAGE = 'whomp-icon-512.png';
const socialTags = ({ title, description, path }) => {
  const url = `${SITE_URL}/${path === 'index.html' ? '' : path}`;
  return `<meta property="og:type" content="website">
<meta property="og:site_name" content="WHOMP">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(`${SITE_URL}/${SOCIAL_IMAGE}`)}">
<meta property="og:image:width" content="512">
<meta property="og:image:height" content="512">
<meta property="og:image:alt" content="The WHOMP mark: a chromatic cream W on a dark violet square.">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(`${SITE_URL}/${SOCIAL_IMAGE}`)}">
<link rel="canonical" href="${esc(url)}">`;
};

/* THE STALE DOT IS GONE, AND IT WAS NOT LYING, WHICH IS WHY IT HAD TO GO.
 *
 * It compared the Stable build's sha against the sha this site was generated
 * from and went gold whenever they differed, under the words "a deploy is
 * pending". They differ by design: Stable is a deliberate weekly promotion and
 * the site regenerates off main every time the game deploys, so the two agree
 * only in the minutes after a promotion. The dot was on permanently, at the top
 * of the page, and a permanent warning is not a status. It is wallpaper, and
 * once a reader learns to ignore it, it cannot tell them anything ever again.
 *
 * What replaces it is not a softer warning, it is a different question. Each
 * track says which version it is serving and which build that came from. There
 * is no verdict, because there was never a verdict to give: neither number is
 * wrong. The dot now means "this was measured just now" and dims when the track
 * did not answer, which is the only binary state that actually exists here. */
const trackChip = (track) => `<span class="chip">
    <span class="dot${track.live ? '' : ' unknown'}" aria-hidden="true"></span>
    ${esc(track.label)} ${track.live
      ? `<b>${esc(track.live.version)}</b> · <code>${esc(track.live.sha)}</code>`
      : '<b>unverified</b> · did not answer'}</span>`;
const liveChip = () => tracks.map(trackChip).join('\n  ');

/* One colophon sentence, shared by every page that carries it. Single mode
 * names no track, because the game itself names none. */
const servingLine = () => (tracks.every((t) => t.live)
  ? channelMode === 'single'
    ? `The game is serving <code>${esc(tracks[0].live.version)}</code>.`
    : `${tracks.map((t) => `${t.label} is serving <code>${esc(t.live.version)}</code>`).join(' and ')}.`
  : channelMode === 'single'
    ? 'The game could not be reached at generation time, so this page names no live version.'
    : 'One of the two tracks could not be reached at generation time, so this page names no version for it.');

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
.chip code{font-family:var(--mono);font-size:.92em;color:var(--dim)}
.dot{width:8px;height:8px;border-radius:50%;background:var(--cyan);box-shadow:0 0 0 3px rgba(36,240,255,.16);flex:none}
/* Measured or not measured. There is no third state and no verdict; see the
   comment on trackChip for why the gold dot that used to compare the live sha
   against the wiki source was retired rather than recoloured. */
.dot.unknown{background:var(--dim);box-shadow:0 0 0 3px rgba(141,132,161,.14)}

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
/* A card that does nothing on hover reads as a picture of a card. These lift by
   one pixel and warm their rim, which is the same gesture the play button makes
   and the smallest one that still registers. */
.arc:hover{border-color:rgba(255,243,207,.2);background:rgba(255,243,207,.045)}
@media (prefers-reduced-motion:no-preference){
  .arc{transition:border-color .14s ease,background .14s ease,transform .14s ease}
  .arc:hover{transform:translateY(-1px)}
}
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
   pages had no protection at all.

   CLIP, NOT HIDDEN, AND THE DIFFERENCE IS LOAD BEARING. overflow-x:hidden makes
   the element a scroll container, and a scroll container on html/body silently
   defeats position:sticky for EVERY descendant on the page: the wiki's sticky
   search band scrolled away with the document and looked simply unimplemented.
   overflow-x:clip clips exactly the same overflow without becoming a scroll
   container, so the sideways-scroll floor this rule exists for is unchanged and
   sticky positioning works again. Verified on all three surfaces. */
html,body{max-width:100%;overflow-x:clip}
`;

/* SEARCH, shared by log.html and every wiki page. Kept OUT of SHARED_CSS on
 * purpose: index.html has no search box and should not carry a dozen rules it
 * never uses. Was inline in log.html until the wiki arrived and needed the same
 * widget; extracted rather than copied, because two copies of a search box is
 * how one of them quietly stops matching the other. */
const SEARCH_CSS = `
.searchwrap{position:relative;max-width:1180px;margin:22px auto 0;padding:0 24px}
.searchlabel{display:flex;align-items:center;gap:8px;margin:0 0 7px;color:var(--body);font-size:.76rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase}
/* The shortcut is only worth having if a reader knows it is there, so the key is
   printed on the label rather than left to be discovered. */
.searchkey{border:var(--edge);border-radius:5px;padding:1px 6px;font-family:var(--mono);font-size:.72rem;
  font-weight:700;letter-spacing:0;color:var(--dim);background:rgba(255,243,207,.05);text-transform:none;line-height:1.5}
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
  <input class="searchbox" id="search" type="search" placeholder="${esc(placeholder)}" autocomplete="off" spellcheck="false"
    aria-label="Search WHOMP"
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

/* REACHABLE FROM THE KEYBOARD, ANYWHERE ON THE PAGE. These pages are long enough
 * that "scroll back up and click the box" is the real cost of a search, and both
 * keys are what a reader who has used any other documentation site will already
 * try. Never steals a keystroke that was going somewhere else: any field, any
 * contenteditable surface and any modified "/" is left alone. */
const typingTarget = (el) => !!el && (el.isContentEditable
  || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
document.addEventListener('keydown', (e) => {
  const shortcut = (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey)
    || ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey) && !e.altKey);
  if (!shortcut || typingTarget(e.target)) return;
  e.preventDefault();
  searchInput.focus();
  searchInput.select();
});
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
const wikiPage = ({ title, description, body, script, file }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="icon" href="${FAVICON}">
${socialTags({ title, description, path: file || 'wiki.html' })}
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

/* The outer disclosure. Above 760px its summary is dressed as the plain section
   heading it replaced (same gold, same tracking as .wside-h) and the count sits
   on the right, so the sidebar keeps the silhouette it already had. Below 760px
   it becomes a real, tappable row. */
.wside-all{border:0}
.wside-all>summary{display:flex;align-items:center;justify-content:space-between;gap:10px;cursor:pointer;
  padding:14px 12px 6px;color:var(--gold);font-size:.7rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;
  border-radius:8px;list-style:none}
.wside-all>summary::-webkit-details-marker{display:none}
.wside-all>summary span{color:var(--dim);font-size:.65rem;font-variant-numeric:tabular-nums;font-weight:700}
.wside-all>summary:hover{background:rgba(255,243,207,.04)}
.wside-all>summary:focus-visible{outline:2px solid var(--cyan);outline-offset:2px}
.wside-all-body{display:flex;flex-direction:column;gap:2px}

.wiki-home{display:flex;align-items:center;gap:11px;text-decoration:none;flex:none}
.wiki-home-icon{display:block;width:46px;height:46px;flex:none;border-radius:10px}
.wiki-home-copy{display:flex;min-width:0;flex-direction:column;line-height:1.15}
.wiki-home-copy b{color:var(--cream);font-size:1.02rem;letter-spacing:.02em}
.wiki-home-copy span{color:var(--dim);font-size:.72rem;margin-top:3px}
.wiki-home:hover .wiki-home-copy b{color:#fff}
.wiki-home:hover .wiki-home-icon{transform:translateY(-1px)}
.wiki-home:focus-visible{outline:2px solid var(--cyan);outline-offset:3px;border-radius:12px}
@media (prefers-reduced-motion:no-preference){.wiki-home-icon{transition:transform .12s ease}}
@media(max-width:760px){
  .wside{display:block;border:var(--edge);border-radius:12px;padding:6px;background:rgba(255,243,207,.02)}
  .wside-all>summary{padding:12px;min-height:44px;background:rgba(255,243,207,.03)}
  .wside-all[open]>summary{color:var(--cream);margin-bottom:2px}
  .wside-section summary{padding:12px}
  .wside-links{padding-left:8px}
  .wside-links a{padding:10px 12px}
}
.brand{display:flex;align-items:center;gap:12px;text-decoration:none;min-width:0}
.brand h1{font-size:1.6rem;margin:0}
.subtag{color:var(--dim);font-size:.85rem;margin:3px 0 0}
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

const SEARCH_PLACEHOLDER = 'Search the wiki and the dev log';

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

/* THE MARK AND THE NAME, IN THE TOP BAR OF EVERY PAGE (director ask, 2026-08-05).
 * MOVED here from the top of the sidebar rather than drawn a second time:
 * bin/wiki-check.mjs pins the canonical icon to EXACTLY ONE `wiki-home` link per
 * page, and it also forbids `<svg class="wm">` in page-header content, so a second
 * mark is not something this file is allowed to add even if it wanted to. Both
 * guards survive the move untouched, which is the point of moving instead of
 * adding: the icon a reader sees at the top is still the one canonical asset read
 * out of the game's public/icons/icon.svg at build time. */
const wikiBrand = `
    <a class="wiki-home" href="wiki.html" aria-label="WHOMP wiki home">
      <img class="wiki-home-icon" src="whomp-icon.svg" alt="" width="46" height="46">
      <span class="wiki-home-copy"><b>WHOMP</b><span>Wiki home</span></span>
    </a>`;

/* The section list is wrapped in one more disclosure, the SAME details/summary
 * part the sections themselves already use, for one reason: on a narrow screen
 * the sidebar sits above the content and used to cost half a phone screen before
 * the reader reached the page they opened. Closed, it costs one row.
 *
 * Its summary replaces the static "Wiki" heading that stood here, so on a wide
 * screen the sidebar reads exactly as it did. NAV_SCRIPT opens it above 760px.
 * With no script at all it stays open, because `open` is in the markup: the
 * failure mode is a long sidebar, never an unreachable one. */
const wikiNav = (here) => `
    <details class="wside-all" open>
      <summary>Wiki <span>${wikiRosterNav.length}</span></summary>
      <div class="wside-all-body">
        <a href="wiki.html"${currentNavAttrs(here === '')}>All guides</a>
        <a href="${EXPLAINER_FILE}"${currentNavAttrs(here === EXPLAINER_SLUG)}>${esc(EXPLAINER_TITLE)}</a>
        ${wikiNavSections.map((section) => {
          const containsCurrent = section.rosters.some((r) => r.slug === here);
          return `<details class="wside-section${containsCurrent ? ' is-current-section' : ''}"${containsCurrent ? ' open' : ''}>
          <summary>${esc(section.name)} <span>${section.rosters.length}</span></summary>
          <div class="wside-links">
            ${section.rosters.map((r) => `<a href="wiki-${esc(r.slug)}.html"${currentNavAttrs(here === r.slug)}>${esc(r.title)}</a>`).join('\n            ')}
          </div>
        </details>`;
        }).join('\n        ')}
        <span class="wside-h">Elsewhere</span>
        <a href="log.html#views">Dev log</a>
        <a href="index.html">&larr; Back to WHOMP</a>
      </div>
    </details>`;

/* WIKI NAVIGATION BEHAVIOR, on every wiki page rather than only the rosters.
 * The mobile-navigation sync used to live in the roster page's own script, so
 * wiki.html and the explainer never ran it. That was the whole of the hub's
 * narrow-screen bug: they render a sidebar nobody had taught to collapse.
 *
 * Two rules, and nothing else: the outer disclosure is open above 760px and shut
 * below it, and the section holding the current page stays open at every width so
 * opening the drawer lands a reader where they already are.
 *
 * It also owns the sticky search band's .is-stuck flag, for the reason given on
 * .wsearchband in WIKI_CSS. Read-only against scrollY and toggled on a class, so
 * it never measures layout and never writes a style. */
const NAV_SCRIPT = `
const navAll = document.querySelector('.wside-all');
const navNarrow = window.matchMedia('(max-width:760px)');
function syncWikiNav() {
  if (navAll) navAll.open = !navNarrow.matches;
}
syncWikiNav();
navNarrow.addEventListener?.('change', syncWikiNav);

const stuckRoot = document.documentElement;
let stuckFrame = 0;
function syncStuck() {
  stuckFrame = 0;
  stuckRoot.classList.toggle('is-stuck', window.scrollY > 8);
}
syncStuck();
window.addEventListener('scroll', () => {
  if (!stuckFrame) stuckFrame = requestAnimationFrame(syncStuck);
}, { passive: true });
`;

const wiki = buildWiki({
  D: gameData,
  T: tierData,
  V: visualData,
  esc,
  page: wikiPage,
  chrome: {
    AUTHBAR, wordmark, liveChip, searchMarkup, SEARCH_SCRIPT, SEARCH_PLACEHOLDER,
    wikiBrand, wikiNav, NAV_SCRIPT, headSha, buildStamp,
  },
});

// ============================================================== INDEX.HTML
/* The short public landing page. It is still short and it still never grows into
 * the log, but "mark, tagline, chip, button, arcs" was not enough of a page: a
 * stranger could read all of it and still not know that a run is twenty minutes,
 * that one weapon is aimed, that it opens in a tab, or that a Preview track
 * exists at all. Five sections now, each of them derived:
 *
 *   the hero      two play buttons, one per release track, each carrying the
 *                 version that track is actually serving right now
 *   the run       what twenty minutes of this game is, off the mode registry
 *   your kit      the five things you take in, as five offer cards
 *   what shipped  the newest concise log entries, the same source log.html uses
 *   what is next  the campaign arcs, plus the game's own queue as teasers
 *
 * THE RUN SECTION IS AN INTRO NOW, not four cards (director, 2026-08-07). It
 * had been carrying the whole pitch on its own: the clock, the aimed weapon,
 * the draft and the no-install promise, four cards deep, before a reader had
 * been told what they would actually be holding. The clock and the promise stay
 * as two short paragraphs, and the cards that were describing a kit are
 * replaced by the kit.
 *
 * NOTHING ON IT IS TYPED TWICE. The clock comes out of runModes, the roster
 * sizes out of the domain counts, the shipped lines out of the release notes,
 * the arcs out of CAMPAIGN.md, the teasers out of the wishlist, the play URLs
 * out of releaseChannel.ts and the versions off the two live endpoints. The
 * authored half is the framing sentences, and they state no magnitude. */
/* No version badge on the button: the director cut it 2026-08-07 ("remove the
 * version numbering from the play the preview button"). The number still lives
 * in the tracks line's Stable link, where a tester looking for it looks. */
const trackButton = (track, kind) => `<a class="play ${kind}" href="${esc(track.url)}">
      ${channelMode === 'single' ? 'PLAY WHOMP'
    : track.channel === 'preview' ? 'PLAY THE PREVIEW' : 'PLAY STABLE'}
    </a>`;

/* THE KIT CARD IS THE GAME'S OFFER CARD, in HTML and at rest. Every in-run
 * offer the player has ever taken rides one anatomy (whomp/src/ui/offerCard.ts):
 * a meta row of two small labels, a title, the line under it, and a footer that
 * says what changes. So the five cards that tell a stranger what they would be
 * holding wear that anatomy instead of a fourth kind of box invented here. The
 * words and the numbers both come from kitCards in bin/landing.mjs; nothing on
 * this side of the file may type a figure. */
const kitCard = (card) => `
    <div class="kit" id="kit-${esc(card.id)}">
      <div class="kit-meta"><span>${esc(card.count)}</span><span>${esc(card.kind)}</span></div>
      <h3>${esc(card.title)}</h3>
      <p class="kit-line">${esc(card.line)}</p>
      <p>${esc(card.body)}</p>
    </div>`;

/* The dev log, on the landing page, one line each. Same entries log.html renders
 * in its concise view, from the same array, so the two cannot disagree: this is
 * a window onto that view rather than a second feed with its own rules. The
 * headline is the release's own one-line banner, written by a person for players
 * when the release was cut, and nothing here shortens it. */
const LANDING_LOG_ENTRIES = 5;
const landingLog = conciseShown.slice(0, LANDING_LOG_ENTRIES).map((e) => `
    <a class="logline" href="log.html#${esc(e.anchor)}">
      <span class="logline-when">${esc(e.date)}${e.version ? ` &middot; v${esc(e.version)}` : ''}</span>
      <span class="logline-what">${esc(e.title)}</span>
    </a>`).join('');

const teaserCards = pipelineCards.map((t) => `
    <div class="arc">
      <div class="id">QUEUED</div>
      <h4>${esc(t.title)}</h4>
      <p>${esc(t.line)}</p>
    </div>`).join('');

/* ------------------------------------------------------------ THE PUBLIC CHROME
 * The sticky bar, the mark and the nav strip, HOISTED out of index.html because
 * built-in-the-open.html is a second page a stranger lands on directly and two
 * copies of a top bar is two top bars to get wrong. index.html and log.html
 * still keep their own bespoke heads (log.html's carries a large page-specific
 * style block, and neither is worth the churn of a rewrite whose only benefit is
 * symmetry), so what is shared here is the chrome and not the page.
 *
 * ONE MARK PER PAGE, AND IT IS THE CANONICAL FILE. The <img> points at the icon
 * copied byte-for-byte out of the game at build time, exactly as the wiki's own
 * top bar does. Nothing here draws a second W: bin/wiki-check.mjs pins the wiki
 * side of that law and tests/generatedSite.test.mjs pins this side, on every page
 * that carries this bar. */
/* Wiki and Dev log left this bar 2026-08-07: the hero carries them as buttons
 * again ("remove the wiki and dev log from the nav menu now that we have
 * separate buttons for them"), and one destination should have one home. */
const NAV_DESTINATIONS = [
  { href: 'index.html#run', label: 'The run', on: 'index.html' },
  { href: 'index.html#shipped', label: 'What shipped', on: 'index.html' },
  { href: 'index.html#next', label: "What's next", on: 'index.html' },
  { href: 'built-in-the-open.html', label: "How it's made" },
];
/* On its own page an in-page section link stays a bare fragment, so the browser
 * scrolls instead of reloading; from anywhere else it needs the filename. */
const navHref = (item, here) => (item.on && item.on === here ? item.href.slice(item.href.indexOf('#')) : item.href);
const landingTopBar = (here) => `
<div class="topbar">
  <div class="topbar-inner">
    <a class="brandmark" href="index.html" aria-label="WHOMP home">
      <img src="${FAVICON}" alt="" width="34" height="34">
      <b>WHOMP</b>
    </a>
    <nav class="navlinks" aria-label="Sections">
      ${NAV_DESTINATIONS.map((item) => `<a href="${esc(navHref(item, here))}"${item.href === here ? ' aria-current="page"' : ''}>${esc(item.label)}</a>`).join('\n      ')}
    </nav>
    ${AUTHBAR}
  </div>
</div>`;

const LANDING_CHROME_CSS = `
.wrap{max-width:940px;margin:0 auto;padding:0 24px 110px}

/* ---------------------------------------------------------------- THE TOP BAR
   THE MARK MOVED HERE (director, 2026-08-06: "move the logo from above the
   header to the left side of the navmenu"). It used to sit centred above the
   wordmark, which meant the page opened with the W drawn twice at two sizes,
   fourteen pixels apart, and pushed the button below the fold on a laptop. In
   the bar it does the job a mark does: it says which site this is while you read
   something else, and it takes the hero's vertical space back.

   It is the SAME canonical asset the wiki's top bar uses, <img> against the icon
   copied byte-for-byte from the game at build time, not a second inline drawing
   of it. One mark, one file, one place it can ever be wrong. */
.topbar{position:sticky;top:0;z-index:30;background:rgba(6,4,14,.82);
  border-bottom:1px solid rgba(255,243,207,.07);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
.topbar-inner{max-width:940px;margin:0 auto;padding:11px 24px;display:flex;align-items:center;gap:20px}
.brandmark{display:flex;align-items:center;gap:10px;text-decoration:none;flex:none}
.brandmark img{display:block;width:34px;height:34px;border-radius:8px}
.brandmark b{color:var(--cream);font-size:1.02rem;font-weight:900;letter-spacing:.04em}
.brandmark:hover b{color:#fff}
.brandmark:focus-visible{outline:2px solid var(--cyan);outline-offset:3px;border-radius:10px}
.navlinks{display:flex;align-items:center;justify-content:center;gap:4px;flex:1;min-width:0;overflow-x:auto;
  -webkit-overflow-scrolling:touch;scrollbar-width:none}
.navlinks::-webkit-scrollbar{display:none}
.navlinks a{color:var(--dim);text-decoration:none;font-size:.78rem;font-weight:800;letter-spacing:.1em;
  text-transform:uppercase;padding:9px 11px;border-radius:8px;white-space:nowrap}
.navlinks a:hover{color:var(--cream);background:rgba(255,243,207,.05)}
.navlinks a[aria-current="page"]{color:var(--cream)}
.navlinks a:focus-visible{outline:2px solid var(--cyan);outline-offset:2px}
.topbar .authbar{padding:0;flex:none}
/* The strip scrolls, the bar does not, and sign-in stays reachable. Hiding the
   only control on the page at 700px was the easy answer and the wrong one. */
@media (max-width:700px){
  .topbar-inner{gap:10px;padding:9px 14px}
  .brandmark b{display:none}
  .navlinks a{padding:9px 8px;font-size:.74rem}
}
`;

const INDEX_TITLE = `WHOMP: ${TAGLINE}`;
const INDEX_DESCRIPTION = `${TAGLINE} A ${run.minutes} minute run in a browser tab, built in the open with the dev log public.`;

const indexHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(INDEX_TITLE)}</title>
<meta name="description" content="${esc(INDEX_DESCRIPTION)}">
<link rel="icon" href="${FAVICON}">
${socialTags({ title: INDEX_TITLE, description: INDEX_DESCRIPTION, path: 'index.html' })}
<style>
${SHARED_CSS}
${LANDING_CHROME_CSS}
/* ------------------------------------------------------------ THE STAR DRIFT
   Lifted from drafts/a-cabinet.html, at roughly half its opacity, because the
   draft was a full-bleed attract mode and this page is a column of text on a
   dark ground. Two tiled sheets on different periods so the parallax never
   resolves into one moving grid.

   IT IS MASKED TO THE TOP OF THE PAGE. Stars behind body copy is a texture
   fighting a paragraph; stars behind the wordmark is the title screen. The mask
   fades them out over the first 1100 pixels, so the hero has weather and the
   reading has none. Fixed, one composited layer, no scroll listener. */
.stars,.stars2{position:fixed;inset:-40% -10% auto -10%;height:150vh;z-index:0;pointer-events:none;
  background-repeat:repeat;
  -webkit-mask-image:linear-gradient(180deg,#000 0,#000 380px,transparent 1100px);
  mask-image:linear-gradient(180deg,#000 0,#000 380px,transparent 1100px)}
.stars{
  background-image:
    radial-gradient(3px 3px at 18% 22%,rgba(255,255,255,.95) 0 22%,rgba(255,255,255,.16) 45%,transparent 70%),
    radial-gradient(2.4px 2.4px at 62% 8%,rgba(255,243,207,.9) 0 24%,rgba(255,243,207,.14) 48%,transparent 70%),
    radial-gradient(3.4px 3.4px at 84% 41%,rgba(255,255,255,.9) 0 20%,rgba(255,255,255,.15) 44%,transparent 70%),
    radial-gradient(3px 3px at 34% 67%,rgba(197,130,255,.95) 0 22%,rgba(177,75,255,.18) 46%,transparent 70%),
    radial-gradient(2.6px 2.6px at 9% 84%,rgba(255,255,255,.8) 0 24%,rgba(255,255,255,.12) 48%,transparent 70%),
    radial-gradient(3px 3px at 71% 78%,rgba(120,245,255,.9) 0 22%,rgba(36,240,255,.16) 46%,transparent 70%);
  background-size:420px 420px;animation:drift 190s linear infinite;opacity:.42}
.stars2{
  background-image:
    radial-gradient(2px 2px at 44% 12%,rgba(255,255,255,.7) 0 26%,transparent 62%),
    radial-gradient(2px 2px at 88% 62%,rgba(255,255,255,.6) 0 26%,transparent 62%),
    radial-gradient(2.4px 2.4px at 26% 48%,rgba(255,120,180,.7) 0 24%,transparent 62%),
    radial-gradient(1.8px 1.8px at 12% 36%,rgba(255,255,255,.5) 0 28%,transparent 64%);
  background-size:250px 250px;animation:drift 320s linear infinite reverse;opacity:.3}
@keyframes drift{to{transform:translate3d(-420px,150px,0)}}
@media (prefers-reduced-motion:reduce){.stars,.stars2{animation:none}}
/* The bar keeps its own z-index:30 and its own stacking context from
   position:sticky. Only the column needs lifting off the star layer. */
.wrap{position:relative;z-index:1}

/* ------------------------------------------------------------------ THE HERO */
header{padding:64px 0 8px;text-align:center}
/* Tagline typography lifted from the game's .whomp-mainmenu__tagline: weight
   700, letter-spacing .03em, italic, the same dimmed-white ink. Font-size
   stays the site's own responsive clamp (the game's is a fixed 16px in a
   fixed-size menu panel, not a full-bleed hero) rather than pinned to 16px. */
.tag{font-size:clamp(1.05rem,3.2vw,1.3rem);color:rgba(255,255,255,0.72);margin:20px auto 0;max-width:34ch;
  font-weight:700;font-style:italic;letter-spacing:0.03em}
.spec{margin:14px auto 0;max-width:56ch;color:var(--body);font-size:clamp(.95rem,1.9vw,1.06rem);text-wrap:balance}

/* THE BUTTON, in the shape the game's own START row uses when it is the active
   item: the sweep as fill, dark ink, no border, a flat plinth under it. The
   loud one is the newest build that went green, which is what a visitor
   arriving today should press; in dual mode Stable keeps a real button rather
   than a text link, because it is a real choice and not a footnote. */
.cta{display:flex;gap:16px;justify-content:center;flex-wrap:wrap;margin-top:34px}
.play{display:inline-flex;align-items:center;gap:12px;padding:17px 34px;border-radius:14px;border:0;
  text-decoration:none;font-weight:900;letter-spacing:.08em;font-size:clamp(.98rem,2vw,1.14rem);
  transition:transform .12s ease,box-shadow .12s ease,background .12s ease}
.play em{font-style:normal;opacity:.66;font-weight:800;font-size:.74em;letter-spacing:.1em}
.play.loud{background:var(--sweep);color:#0a0714;box-shadow:0 7px 0 #7a1440,0 16px 30px -12px rgba(255,47,126,.55)}
.play.loud:hover{transform:translateY(3px);box-shadow:0 4px 0 #7a1440,0 10px 22px -12px rgba(255,47,126,.5)}
.play.quiet{color:var(--cream);border:2px solid rgba(255,243,207,.2);background:rgba(255,243,207,.05);
  box-shadow:0 5px 0 rgba(0,0,0,.42)}
.play.quiet:hover{background:rgba(255,243,207,.12);transform:translateY(3px);box-shadow:0 2px 0 rgba(0,0,0,.42)}
.play:focus-visible{outline:2px solid var(--cyan);outline-offset:4px}
.tracks{margin:22px auto 0;max-width:58ch;color:var(--dim);font-size:.88rem}
.tracks b{color:var(--body);font-weight:800}
.chips{justify-content:center;margin-top:22px}

/* ---------------------------------------------------------------- THE FLOOR */
section{margin-top:78px}
h2{font-size:1.65rem;margin:0 0 6px}
.lede{color:var(--dim);margin:0 0 22px;font-size:.95rem;max-width:64ch}

/* THE KIT GRID. min() rather than a bare minimum, so five cards land three and
   two on a wide screen and still collapse to a single column on a phone without
   the track needing a media query of its own. The card itself is the game's
   offer card at rest: meta row, title, the line under it, then what changes. */
.kits{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))}
.kit{display:flex;flex-direction:column;border:var(--edge);border-radius:14px;padding:16px 18px 18px;
  background:rgba(255,243,207,.025)}
.kit-meta{display:flex;justify-content:space-between;gap:10px;margin-bottom:10px;
  font-size:.68rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase}
.kit-meta span:first-child{color:var(--gold)}
.kit-meta span:last-child{color:var(--dim)}
.kit h3{margin:0 0 4px;color:var(--cream);font-size:1.05rem;font-weight:900;letter-spacing:-.01em}
.kit .kit-line{margin:0 0 9px;color:var(--body);font-size:.92rem}
.kit p{margin:0;color:var(--dim);font-size:.87rem}
.kit:hover{border-color:rgba(255,243,207,.2);background:rgba(255,243,207,.045)}
@media (prefers-reduced-motion:no-preference){
  .kit{transition:border-color .14s ease,background .14s ease,transform .14s ease}
  .kit:hover{transform:translateY(-1px)}
}
/* The chips inherit the hero's centring; under a left-aligned grid they have to
   take it back or the row reads as belonging to something else. */
.tally{display:flex;flex-wrap:wrap;gap:10px;margin-top:10px;justify-content:flex-start}
/* One line of framing over the tally, so the row of bare counts is introduced
   rather than dumped. Footnote register, quieter than a lede. */
.tallynote{margin:22px 0 0;color:var(--dim);font-size:.86rem}

/* One line per release, date on the left, the release's own headline on the
   right. A row, not a card: five cards would be a second dev log on the page. */
.loglines{display:flex;flex-direction:column;border:var(--edge);border-radius:14px;overflow:hidden;
  background:rgba(255,243,207,.025)}
.logline{display:flex;gap:16px;align-items:baseline;padding:13px 20px;text-decoration:none;color:var(--body);
  border-top:1px solid rgba(255,243,207,.06)}
.logline:first-child{border-top:0}
.logline:hover,.logline:focus-visible{background:rgba(36,240,255,.07);outline:none}
.logline:focus-visible{box-shadow:inset 2px 0 0 var(--cyan)}
.logline-when{flex:none;width:9.5rem;color:var(--dim);font-size:.78rem;letter-spacing:.03em;
  font-variant-numeric:tabular-nums}
.logline-what{flex:1;min-width:0;font-size:.94rem;overflow-wrap:break-word}
.logline:hover .logline-what{color:var(--cream)}
.more{margin-top:14px;font-size:.88rem}
@media (max-width:560px){
  .logline{flex-direction:column;gap:4px}
  .logline-when{width:auto}
}
</style>
</head>
<body>
<div class="stars" aria-hidden="true"></div>
<div class="stars2" aria-hidden="true"></div>

${landingTopBar('index.html')}

<div class="wrap">

<header>
  <h1 class="whomp-wordmark" data-wordmark="WHOMP">WHOMP</h1>
  <p class="tag" id="hero-tagline">${esc(gameTaglines[0])}</p>
  <script>document.getElementById('hero-tagline').textContent=(${JSON.stringify(gameTaglines)})[Math.min(${gameTaglines.length}-1,Math.max(0,Math.floor(Math.random()*${gameTaglines.length})))];</script>
  <div class="cta">
    ${trackButton(tracks[0], 'loud')}
    <a class="play quiet" href="wiki.html">WIKI</a>
    <a class="play quiet" href="log.html">DEV LOG</a>
  </div>
  <div class="chips">${liveChip()}</div>
</header>

<section id="run">
  <div class="rule"></div>
  <h2 class="chroma">What a run does to you</h2>
  <p class="lede">${run.minutes} minutes, one weapon you aim yourself, and a horde that keeps finding out the ground
    is optional. The final horde turns up at ${run.finalHorde} and does not thin out, because thinning out is not what
    it does. Hold it for ${run.holdMinutes} minutes, bank at ${run.bank}, and then
    ${run.endless ? 'walk away clean, or stay in and find out how much worse it gets' : 'the run is over'}.</p>
  <p class="lede">Nothing to download, nothing to install, and nobody here wants your email address. Click it and you
    are already being chased.</p>
  <p class="tallynote">Everything currently in there with you, hostile and otherwise.</p>
  <div class="chips tally">
    <span class="chip"><b>${run.worlds}</b> worlds</span>
    <span class="chip"><b>${run.enemies}</b> enemies</span>
    <span class="chip"><b>${run.characters}</b> characters</span>
    <span class="chip"><b>${run.cores}</b> aimed cores</span>
    <span class="chip"><b>${run.weapons}</b> weapons</span>
  </div>
</section>

<section id="kit">
  <div class="rule"></div>
  <h2 class="chroma">Your kit</h2>
  <p class="lede">Five things go in with you, and you aim exactly one of them. Every level up offers ${kit.offer} more,
    you keep one, and the other ${kit.offer - 1} are gone for good.</p>
  <div class="kits">${kitCards(kit).map(kitCard).join('')}</div>
</section>

<section id="shipped">
  <div class="rule"></div>
  <h2 class="chroma">What just shipped</h2>
  <p class="lede">The last ${LANDING_LOG_ENTRIES} things that changed, in the words they were written in on the day.
    The dev log has the rest, including the days that went badly.</p>
  <div class="loglines">${landingLog}</div>
  <p class="more"><a href="log.html#views">Read the whole dev log</a></p>
</section>

<section id="next">
  <div class="rule"></div>
  <h2 class="chroma">What we are building</h2>
  <p class="lede">The big pieces, in the order we are actually building them rather than the order we promised.</p>
  <div class="arcs">${arcCards(arcs)}</div>
</section>
${pipelineCards.length ? `
<section id="pipeline">
  <div class="rule"></div>
  <h2 class="chroma">Coming down the pipeline</h2>
  <p class="lede">Wanted, written down, not started. ${pipeline.queued} things are in that queue and these are
    ${pipelineCards.length} of them.</p>
  <div class="arcs">${teaserCards}</div>
</section>` : ''}

<footer>
  Every number on this page came straight out of the game, read at <code>game@${esc(headSha)}</code> on ${esc(buildStamp)}.
  ${servingLine()}
</footer>

</div>
${AUTH_SCRIPT()}
</body>
</html>`;

// ============================================================== LOG.HTML
// The real dev log: sidebar, search, filters, and the two-view toggle.
//   CONCISE (default) = one entry per release, from the game's own release
//                        notes, with an authored notes/<date>.md replacing the
//                        generated entry for any day Kevin wrote one. The
//                        product.
//   FULL              = the generated feed from git log. Labelled honestly as
//                        the raw engineering log, so it reads as a door left
//                        open rather than as noise.

/* HOW A READER TELLS THEM APART: a source chip, alongside the date and version
 * chips that were already there. It says where the words came from, in the same
 * register as the build stamp and the "read out of the game at build time"
 * provenance line the wiki carries on every page.
 *
 * BOTH kinds are labelled, not just the generated one. If only generated
 * entries carried a mark, the mark would be doing two jobs at once, naming a
 * source and flagging an exception, and the second job is the one that reads as
 * an apology. Two neutral labels are symmetric, so neither is the deviation.
 * This is also why there is no "unreviewed" badge: with no review path it would
 * be permanent, and a permanent apology on every entry is worse than no entry. */
const SOURCE_LABEL = {
  authored: 'written for the log',
  release: 'from the release notes',
};

const LOG_DESCRIPTION = 'The WHOMP dev log: what shipped, what is still broken, and what is coming next.';

const bucketBlock = (name, html) => `
    <div class="bucket">
      <h4 style="color:var(${BUCKET_INK[name] || '--cream'})">${esc(name)}</h4>
      ${html}
    </div>`;

const list = (items) => `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;

/* The generated body is quotation, not composition. Every string below arrives
 * from PATCH_RELEASES already written by a human for players; this function
 * escapes it, groups it, and stops. The only sentence it can emit that a person
 * did not write is the truncation line, which is about the page rather than
 * about the game. */
const releaseBody = (e) => {
  const shown = e.bugFixes.slice(0, BUG_FIXES_SHOWN);
  const hidden = e.bugFixes.length - shown.length;
  const more = hidden > 0
    ? `<p class="bucket-more">${hidden} more fix${hidden === 1 ? '' : 'es'} shipped in this release. The full log has all of them.</p>`
    : '';
  return `<div class="buckets">
    ${bucketBlock('Highlights', list(e.keyChanges))}
    ${shown.length ? bucketBlock('Fixed', `${list(shown)}${more}`) : ''}
  </div>`;
};

const authoredBody = (e) => `
    ${e.intro.map(renderBlock).join('')}
    <div class="buckets">${e.buckets.map((b) => bucketBlock(b.name, b.blocks.map(renderBlock).join(''))).join('')}</div>`;

const entryCard = (e) => `
  <article class="notecard" id="${esc(e.anchor)}">
    <div class="notecard-head">
      <span class="notecard-date">${esc(e.date)}</span>
      ${e.version ? `<span class="notecard-version">v${esc(e.version)}</span>` : ''}
      <span class="notecard-source">${esc(SOURCE_LABEL[e.kind])}</span>
    </div>
    <h3 class="chroma" style="font-size:1.4rem">${esc(e.title)}</h3>
    ${e.kind === 'authored' ? authoredBody(e) : releaseBody(e)}
  </article>`;

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

/* THE DAY, AS A CARD. Three things can be on it and only the first is always
 * there: what the day was made of (composed here, from counts), what was cut
 * that day (the release's own headline, written by a person for players), and
 * what the night wrote (the game repo's own line, published only if a stranger
 * could read it). See the header of bin/devlog.mjs for why that split is the
 * whole design.
 *
 * A QUIET DAY IS STILL A CARD. It is dimmed and it says so, because a run of
 * days with the empty ones removed reads as though there were none. */
const storyCard = (day) => `
    <article class="storyday${day.quiet ? ' is-quiet' : ''}" id="day-${esc(day.date)}">
      <div class="storyday-head">
        <span class="storyday-when">${esc(day.date)}</span>
        <span class="storyday-kinds">${day.kinds.map((k) => `<span class="storyday-kind" style="background:var(${KIND_INK[k.kind] || '--dim'})">${esc(KIND_LABEL[k.kind] || k.kind)} ${k.count}</span>`).join('')}</span>
      </div>
      <p class="storyday-shape">${esc(day.shape)}</p>
      ${day.releases.map((r) => `<a class="storyday-release" href="#${esc(r.anchor)}">
        <b>${r.version ? `v${esc(r.version)}` : 'Written up'}</b><span>${esc(r.title)}</span>
      </a>`).join('')}
      ${day.nightly.map((line) => `<p class="storyday-night">${esc(line)}</p>`).join('')}
    </article>`;

const logHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>WHOMP dev log</title>
<meta name="description" content="${esc(LOG_DESCRIPTION)}">
<link rel="icon" href="${FAVICON}">
${socialTags({ title: 'WHOMP dev log', description: LOG_DESCRIPTION, path: 'log.html' })}
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

/* THE DAY BY DAY STORY. A column of days rather than a grid of cards: the days
   are consecutive and a grid would let a reader's eye take them in any order,
   which is the one thing a chronology cannot survive. */
.storydays{display:flex;flex-direction:column;gap:12px}
.storyday{border:var(--edge);border-radius:14px;padding:16px 20px;background:rgba(255,243,207,.025)}
.storyday-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.storyday-when{color:var(--dim);font-size:.78rem;letter-spacing:.04em;font-variant-numeric:tabular-nums}
.storyday-kinds{display:flex;flex-wrap:wrap;gap:6px}
.storyday-kind{color:#0a0714;font-size:.68rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase;
  padding:3px 8px;border-radius:999px}
.storyday-shape{margin:8px 0 0;color:var(--body);font-size:.95rem}
.storyday-release{display:flex;gap:10px;align-items:baseline;margin-top:10px;padding:9px 12px;border-radius:10px;
  text-decoration:none;color:var(--body);background:rgba(36,240,255,.06)}
.storyday-release b{flex:none;color:var(--cream);font-family:var(--mono);font-size:.8rem}
.storyday-release:hover,.storyday-release:focus-visible{background:rgba(36,240,255,.12);outline:none}
.storyday-release:focus-visible{box-shadow:inset 2px 0 0 var(--cyan)}
.storyday-night{margin:10px 0 0;color:var(--dim);font-size:.9rem;border-left:2px solid rgba(255,243,207,.14);padding-left:12px}
/* A day with nothing on it is dimmed, never dropped. Removing it is what made
   the feed read as though every day had something on it. */
.storyday.is-quiet{background:none;border-style:dashed}
.storyday.is-quiet .storyday-shape{color:var(--dim);font-size:.88rem}

.notecard{border:var(--edge);border-radius:16px;padding:22px 24px;margin-bottom:18px;background:rgba(255,243,207,.025)}
.notecard-head{display:flex;gap:10px;align-items:center;margin-bottom:6px}
.notecard-date{color:var(--dim);font-size:.78rem;letter-spacing:.04em;text-transform:uppercase}
.notecard-version{color:var(--dim);font-size:.78rem;font-family:var(--mono)}
/* Provenance, not a badge. Same weight and colour as the date beside it, so it
   reads as the third fact in a row of facts rather than as a verdict on the
   entry it sits above. It never gets a border, a background or an accent ink. */
.notecard-source{color:var(--dim);font-size:.78rem;letter-spacing:.04em}
.bucket-more{margin-top:8px;color:var(--dim);font-size:.82rem}
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
    <a href="#story">Day by day</a>
    <a href="#shipped">Shipped</a>
    <a href="#bugs">Known bugs</a>
    <a href="#flight">In flight</a>
    <span class="wside-h" style="padding:14px 12px 6px;color:var(--gold);font-size:.7rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase">Wiki</span>
    <a href="wiki.html">All rosters</a>
    <a href="built-in-the-open.html">How it's made</a>
    <a href="index.html">&larr; Back to WHOMP</a>
  </nav>

  <main class="main">
  <!-- GATING OFF (director, 2026-07-30): the log is public so testers with no
       account can reach it. Sign-in above still works. To re-gate later, flip
       GATING_ENABLED to true in the script at the bottom of this file, it
       already hides everything inside .gated-section behind the same
       getUser() check the authbar uses, no template change required. -->
  <div class="gated-section" id="gated-content">

  <!-- THE STORY GOES FIRST, and the two lists that were here before it go under
       it. A stranger who followed a link from a post is not looking for a
       changelog, they are asking what has been happening, and the two views
       below could only answer that by making them count. -->
  <section id="story">
    <div class="rule"></div>
    <h2 class="chroma">Day by day</h2>
    <p class="lede">${story.summary.map(esc).join(' ')}
      <a href="built-in-the-open.html">How a change gets from a lane to your browser.</a></p>
    <div class="storydays">${story.days.map(storyCard).join('')}</div>
  </section>

  <section id="shipped">
    <div class="rule"></div>
    <h2 class="chroma">Shipped</h2>
    <p class="lede">Two ways to read it. Concise is one entry per release, in the words it was written
      in for players, with Kevin's own note in its place on any day he wrote one. Full is every commit,
      unedited, including the ones nobody would put in a release note.</p>

    <!-- id="views": the nav's Dev log link targets this, so arriving from anywhere
         lands ON the Concise / Full choice rather than above it. -->
    <div class="viewtoggle" id="views" role="tablist">
      <button class="vtab is-active" data-view="concise" type="button" role="tab" aria-selected="true">Concise</button>
      <button class="vtab" data-view="full" type="button" role="tab" aria-selected="false">Full log</button>
    </div>

    <div class="viewpane" id="view-concise">
      ${conciseShown.map(entryCard).join('')}
      ${conciseDropped > 0 ? `<p class="lede">${conciseDropped} earlier release${conciseDropped === 1 ? '' : 's'} not shown here.</p>` : ''}
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
    <p class="lede">What is on somebody's desk right now, as opposed to what is on the wish list.</p>
    <div class="arcs">${arcCards(arcs)}${backlogTeasers.map(flightCard).join('')}</div>
  </section>

  </div>
  </main>
</div>

<footer style="max-width:1180px;margin:0 auto;padding:0 24px 40px">
  Every number on this page came straight out of the game, read at <code>game@${esc(headSha)}</code> on ${esc(buildStamp)}.
  ${/* Same retirement as the hero chip on index.html, for the same reason: this
        line compared the live Stable sha against the sha the site was generated
        from and called the difference a pending deploy. The two are supposed to
        differ. What each track is serving is a fact; the gap between them was
        never a status. See the comment on trackChip. */ ''}
  ${servingLine()}
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

// ================================================== BUILT-IN-THE-OPEN.HTML
/* THE PITCH. Every other page here answers a question about the game. This one
 * answers a question about the project, and it is the only page on the site
 * whose copy is authored rather than derived, because a process is not a number
 * in a catalog and no amount of parsing turns one into a sentence.
 *
 * WHAT IS DERIVED IS THE RIGHT TO PRINT IT. Every load-bearing sentence is a pin
 * in bin/pitch.mjs naming the file in the game repo that makes it true. A rule
 * that moves stops matching, the claim is dropped from the page, and the lane
 * goes red until somebody fixes the sentence. The FRAME lines below are the only
 * unpinned prose on the page and they are deliberately the kind that cannot go
 * stale: what a lane is, what the page is about to say. Anything with a fact in
 * it is a pin.
 *
 * WHY IT IS A PAGE AND NOT A SECTION OF THE LOG. It is the reason to follow the
 * project rather than a record of it, a stranger arrives at it from a link
 * somebody else pasted, and it needs its own card when they do. log.html is
 * already three sections long.
 *
 * NO MACHINERY (docs/VOICE.md rule 12). No branch names, no paths, no shas, no
 * gate names. The page teaches five words and uses no others: lane, gate, guard,
 * track, deploy. tests/pitch.test.mjs holds every claim to that. */
const claimById = new Map(pitch.verified.map((pin) => [pin.id, pin.claim]));
const PITCH_SECTIONS = [
  {
    id: 'crew',
    eyebrow: 'The short version',
    heading: 'One person, and a crew that does not get tired',
    frame: [
      'WHOMP is made by one person directing a crew of AI agents. The crew does the typing.',
      scale.ok ? `Work goes out in lanes. ${scale.sentence}` : 'Work goes out in lanes.',
    ],
    pins: [],
  },
  {
    id: 'lane',
    eyebrow: 'The lane',
    heading: 'One job, and a written list of what it may touch',
    frame: ['A lane is one job, done in a fresh copy of the game by an agent that has never seen this project and will never see it again.'],
    pins: ['claimed-first', 'one-writer'],
  },
  {
    id: 'gate',
    eyebrow: 'The gate',
    heading: 'Finished is not a word the lane gets to use',
    frame: ['A lane says it is done. That is where the argument starts.'],
    pins: ['tests-ran', 'negative-test', 'reviewer'],
  },
  {
    id: 'stop',
    eyebrow: 'The stop',
    heading: 'The most useful lane of that week wrote no code',
    frame: ['A lane is handed a premise along with its job, and the premise is sometimes wrong.'],
    pins: ['correct-negative'],
  },
  {
    id: 'tracks',
    eyebrow: 'The deploy',
    heading: 'Two tracks, and the careful one is second',
    frame: ['There are two places to play this, and both of them are a link.'],
    pins: ['preview-first', 'approval'],
  },
  {
    id: 'holds',
    eyebrow: 'Why it holds',
    heading: 'A rule that cannot fail is not a rule',
    frame: [],
    pins: ['mechanism', 'house-law'],
  },
];
const pitchSections = PITCH_SECTIONS
  .map((section) => ({ ...section, lines: [...section.frame, ...section.pins.map((id) => claimById.get(id)).filter(Boolean)] }))
  .filter((section) => section.lines.length);

const PITCH_FILE = 'built-in-the-open.html';
const PITCH_TITLE = 'WHOMP: built in the open';
const PITCH_DESCRIPTION = 'How WHOMP gets made: one lane at a time, through gates that can fail, onto two tracks, with the dev log public the whole way.';

const pitchHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(PITCH_TITLE)}</title>
<meta name="description" content="${esc(PITCH_DESCRIPTION)}">
<link rel="icon" href="${FAVICON}">
${socialTags({ title: PITCH_TITLE, description: PITCH_DESCRIPTION, path: PITCH_FILE })}
<style>
${SHARED_CSS}
${LANDING_CHROME_CSS}
/* h1 keeps the browser's default block margin unless it is told not to, which
   on a phone reads as a hundred and fifty pixels of nothing between the bar and
   the title. The padding here is the whole of the space above it. */
header{padding:44px 0 8px}
header h1{margin:0}
.pitchlede{margin:18px 0 0;max-width:60ch;color:var(--body);font-size:clamp(1rem,2vw,1.12rem)}
.chips{margin-top:24px}
section{margin-top:64px}
.eyebrow{display:block;color:var(--gold);font-size:.72rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase}
/* Wide enough that every section heading lands on one line at this column
   width. The chromatic offset is a signature for a short heading and turns into
   noise across two lines of it, so the wrap point is the thing being set here,
   not the measure. */
h2{font-size:1.5rem;margin:6px 0 14px;max-width:48ch}
.pitchbody p{margin:0 0 14px;max-width:66ch;color:var(--body);font-size:.98rem}
.pitchbody p:last-child{margin-bottom:0}
/* The first line of a section carries it, so it is the one that gets the ink.
   Every line after it is the same weight, because a page of emphasis has none. */
.pitchbody p:first-child{color:var(--cream)}
.pitchtail{margin-top:64px;padding:22px 24px;border:var(--edge);border-radius:16px;background:rgba(255,243,207,.025)}
.pitchtail p{margin:0 0 12px;max-width:66ch}
.pitchtail p:last-child{margin-bottom:0}
.pitchtail a{font-weight:700}
</style>
</head>
<body>
${landingTopBar(PITCH_FILE)}

<div class="wrap">

<header>
  ${/* No eyebrow above this one. The nav strip already marks this page as where
       you are, and a label repeating it is the same word twice on one screen. */ ''}
  <h1 class="chroma">Built in the open</h1>
  <p class="pitchlede">${esc(PITCH_DESCRIPTION)}</p>
  <div class="chips">${liveChip()}</div>
</header>

${pitchSections.map((section) => `
<section id="${esc(section.id)}">
  <div class="rule"></div>
  <span class="eyebrow">${esc(section.eyebrow)}</span>
  <h2 class="chroma">${esc(section.heading)}</h2>
  <div class="pitchbody">${section.lines.map((line) => `<p>${esc(line)}</p>`).join('')}</div>
</section>`).join('')}

<div class="pitchtail">
  <p>The dev log on this site is not written for it. It is built out of the same releases and the same
    changes the work actually produced, so it says what happened rather than what somebody remembered.</p>
  <p><a href="log.html#story">Read what landed, day by day.</a> Or look up what is waiting for you in the
    <a href="wiki.html">wiki</a>. Or skip all of it and <a href="index.html">play the thing</a>.</p>
</div>

<footer>
  Every number on this page came straight out of the game, read at <code>game@${esc(headSha)}</code> on ${esc(buildStamp)}.
  ${servingLine()}
</footer>

</div>
${AUTH_SCRIPT()}
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
/* Indexed from conciseShown, not from `notes`, so search covers exactly what
 * the page renders. A release that is past CONCISE_RELEASES_CAP is not on the
 * page, so a hit on it would scroll to nothing. */
for (const e of conciseShown) {
  const anchor = e.anchor;
  if (e.kind === 'authored') {
    searchIndex.push({ type: 'note', title: e.title, text: e.intro.join(' ').replace(/[*|]/g, ''), anchor, href: logHref(anchor) });
    for (const b of e.buckets) {
      for (const block of b.blocks) {
        searchIndex.push({ type: b.name.toLowerCase(), title: e.title, text: block.replace(/[*|]/g, '').slice(0, 200), anchor, href: logHref(anchor) });
      }
    }
    continue;
  }
  searchIndex.push({ type: 'release', title: e.title, text: `v${e.version} ${e.date}`, anchor, href: logHref(anchor) });
  for (const c of e.keyChanges) {
    searchIndex.push({ type: 'highlights', title: e.title, text: c.slice(0, 200), anchor, href: logHref(anchor) });
  }
  for (const f of e.bugFixes.slice(0, BUG_FIXES_SHOWN)) {
    searchIndex.push({ type: 'fixed', title: e.title, text: f.slice(0, 200), anchor, href: logHref(anchor) });
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
/* The pitch is indexed by SECTION rather than by claim, one row each. A claim
 * that is dropped for losing its evidence takes its words out of search with it,
 * because the row is built from the lines that survived. Search finding a
 * sentence the page no longer prints is the same defect as a dead anchor. */
for (const section of pitchSections) {
  searchIndex.push({
    type: 'how it is made', title: section.heading, text: section.lines.join(' ').slice(0, 240),
    anchor: section.id, href: `${PITCH_FILE}#${section.id}`,
  });
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
  { file: PITCH_FILE, html: pitchHtml },
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
/* THE CONCISE VIEW ACTUALLY REACHED THE PAGE. Stated directly rather than left
 * to the href sweep below, which only proves it as a side effect of every
 * concise entry also emitting a search row. This surface's whole failure mode is
 * a run that exits zero having rendered nothing into the view a visitor sees
 * first, and the check for that should not be a coincidence of another check. */
const conciseAnchors = emittedAnchors.get('log.html');
const missingEntries = conciseShown.filter((e) => !conciseAnchors.has(e.anchor));
if (missingEntries.length) {
  throw new Error(`log.html is missing ${missingEntries.length} concise entr${missingEntries.length === 1 ? 'y' : 'ies'} that were derived for it: ${missingEntries.map((e) => `${e.kind} ${e.version || e.date}`).join(', ')}. The generator ran clean and published a view with holes in it, which is the failure this check exists to refuse.`);
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
  { file: PITCH_FILE, body: pitchHtml },
  { file: 'search-index.json', body: JSON.stringify(searchIndex) },
  { file: 'whomp-icon.svg', body: desktopIconSvg },
  /* The social card's image. Bytes, not text, so the raster reaches the write
   * step untouched; see SOCIAL_ICON_PATH for why the card is the canonical icon
   * rather than a screenshot. */
  { file: SOCIAL_IMAGE, body: socialIconBytes },
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
console.log(`  ${arcs.length} arcs, ${backlogTeasers.length} backlog teasers, ${openBugs.length} open bugs`);
console.log(`  landing: a run is ${run.minutes} minutes (final horde ${run.finalHorde}, ${run.holdMinutes} minute hold, bank ${run.bank}), ${LANDING_LOG_ENTRIES} log lines, ${pipelineCards.length} of ${pipeline.queued} queued wants teased${pipeline.unwritten.length ? `, ${pipeline.unwritten.length} with no teaser line yet` : ''}`);
console.log(`  kit: 1 of ${kit.cores} cores aimed, ${kit.weaponSlots} of ${kit.weapons} weapons and ${kit.tomeSlots} of ${kit.tomes} tomes held, the WHOMP on ${kit.whomp.slot} every ${kit.whomp.seconds}s, ${kit.characters} characters`);
for (const track of tracks) {
  console.log(`  track ${track.label}: ${track.live ? `${track.live.version} at ${track.live.sha}` : 'unverified'}  ${track.url}`);
}
/* The concise view's counts are printed separately and in full because this is
 * the surface that used to fail silently. "8 releases read, 1 authored note,
 * 8 entries published" is a sentence an operator can check against the page. */
console.log(`  concise log: ${releases.length} releases read (at most ${KEY_CHANGE_CAP} highlights each), ${notes.length} authored note${notes.length === 1 ? '' : 's'}, ${releaseEntries.length} generated, ${conciseShown.length} entries published${conciseDropped > 0 ? `, ${conciseDropped} older not shown` : ''}`);
/* The story and the pitch print in full for the same reason the concise view
 * does: these are the surfaces whose failure mode is a page that renders, exits
 * zero and says less than it did yesterday. "7 days, 2 of them quiet" and "10 of
 * 10 claims still earned" are sentences an operator can check by looking. */
const nightlyPublished = [...nights.byDate.values()].reduce((n, lines) => n + lines.length, 0);
const releasesInWindow = story.days.reduce((n, day) => n + day.releases.length, 0);
const pitchClaims = pitch.verified.length + pitch.missingSource.length + pitch.missingEvidence.length;
console.log(`  story: ${story.days.length} days, ${story.days.filter((d) => d.quiet).length} of them quiet, ${releasesInWindow} release${releasesInWindow === 1 ? '' : 's'} cut in the window, ${nightlyPublished} nightly line${nightlyPublished === 1 ? '' : 's'} published${nights.refused.length ? `, ${nights.refused.length} held back as unreadable` : ''}`);
console.log(`  pitch: ${pitch.verified.length} of ${pitchClaims} claims still earned by the game repo, ${pitchSections.length} sections published${scale.ok ? `, ${scale.landedLanes} lanes landed since ${scale.firstDay}` : ', no scale stated'}`);
console.log(`  wiki: ${wiki.rosters.length} rosters, ${wiki.rosters.map((r) => `${r.title} ${r.entries.length}`).join(', ')}`);
console.log(`  site: ${[...emittedAnchors.values()].reduce((n, s) => n + s.size, 0)} anchors, all internal links resolve`);
if (wiki.gaps.length) {
  console.log(`  wiki: ${wiki.gaps.length} enum value(s) with no written explanation yet, shown as the bare value:`);
  for (const g of wiki.gaps) console.log(`    ${g}`);
}
console.log(`  search index: ${searchIndex.length} entries`);
/* THE LAST LINE IS THE ONE THE GATE READS. bin/regenerate-and-verify.sh fails
 * on a non-zero count here, so a dropped arc, an orphaned teaser or a track that
 * did not answer turns a lane red instead of scrolling past in a deploy log. The
 * generator still exits zero, because none of those should stop a publish. */
console.log(`  warnings: ${warnings.length}, notes: ${siteNotes.length}`);
