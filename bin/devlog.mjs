/** THE STORY OF THE BUILD, and the rule that it is never written by hand.
 *
 *  log.html has always had two views and both of them are LISTS. Concise is one
 *  entry per release, Full is git log with the noise taken out. A stranger who
 *  found the game and wanted to know what has been happening got a list of
 *  releases going back six weeks and a wall of commit subjects, and had to do
 *  the arithmetic themselves. Neither view ever answers "what happened
 *  yesterday", because neither view has a day in it that nothing shipped on.
 *
 *  So this module builds the third thing: a DAY BY DAY narrative over the same
 *  window the full feed already covers. One entry per calendar day, including
 *  the quiet ones, newest first.
 *
 *  THE LAW IT INHERITS, from bin/patch-notes.mjs, unchanged and load-bearing:
 *
 *    THIS FILE NEVER WRITES A SENTENCE ABOUT THE GAME.
 *
 *  Everything it composes is a sentence about the SHAPE of a day, built from
 *  counts it read: how many changes landed and what kinds they were. Those are
 *  facts about the log, not claims about the game, and a generator that cannot
 *  compose a sentence about the game cannot compose a wrong one. Anything that
 *  is a claim about the game arrives already written by a human: a release
 *  headline out of the game's own patch notes, or a line out of the game repo's
 *  nightly file. This module quotes those. It never edits them and never
 *  invents one.
 *
 *  WHY THE QUIET DAYS ARE IN IT. They are the honest part. A feed built only
 *  from days that had commits reads as though every day had commits, which is
 *  the same class of untruth as a trailing window that reads as a lifetime
 *  total (see THE COUNT IS NOT NAVIGATION in bin/generate.mjs). A run of seven
 *  cards where two of them say nothing landed is a true week. Six cards is not.
 *
 *  EVERY SENTENCE THIS FILE EMITS IS FINISHED. docs/VOICE.md rule 9 forbids
 *  trailing off, tests/generatedSite.test.mjs reads the rendered page back and
 *  checks it, and tests/devlog.test.mjs checks the composer directly, because
 *  the page test can only see the shapes that happened to be generated today.
 */
import { trailsOff } from './landing.mjs';

/* ------------------------------------------------------------- the day's shape */

/** The five player-visible commit kinds, as a reader meets them. These are
 *  CATEGORY labels rather than count nouns on purpose: "9 fixed, 2 new" holds
 *  at any count, where "9 fixes, 1 fixes" does not, and a tally that has to
 *  inflect is a tally with a bug waiting in it. */
const TALLY = { feat: 'new', fix: 'fixed', balance: 'balance', perf: 'performance', style: 'polish' };

/** Read when a day is made of one kind only, where the tally form would repeat
 *  the total it just said ("12 changes landed: 12 fixed"). */
const ONLY = { feat: 'new work', fix: 'fixes', balance: 'balance', perf: 'performance work', style: 'polish' };

/** Read when a day is one single change, where every plural above is wrong. */
const ONE = { feat: 'new', fix: 'a fix', balance: 'a balance change', perf: 'a performance change', style: 'polish' };

/** Stable ordering for equal counts, so two kinds that tie do not swap places
 *  between two runs over the same data and produce a diff that means nothing. */
const KIND_ORDER = ['feat', 'fix', 'balance', 'perf', 'style'];
const kindRank = (kind) => {
  const at = KIND_ORDER.indexOf(kind);
  return at === -1 ? KIND_ORDER.length : at;
};

/** Counts per kind, largest first. */
export function dayShape(changes) {
  const counts = new Map();
  for (const change of changes || []) {
    const kind = change?.kind;
    if (!kind) continue;
    counts.set(kind, (counts.get(kind) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([kind, count]) => ({ kind, count }))
    .sort((a, b) => b.count - a.count || kindRank(a.kind) - kindRank(b.kind));
}

/**
 * One finished sentence describing what a day was made of.
 *
 * Three forms, and the split is grammar rather than taste. A day of one change
 * cannot take a plural, a day of one kind must not restate its own total, and
 * everything else is a tally. All three end in a full stop, because docs/VOICE.md
 * rule 9 is checked over this page by tests/generatedSite.test.mjs and a sentence
 * that trails off there is the exact defect the landing page just stopped having.
 */
export function shapeSentence(kinds) {
  const total = kinds.reduce((sum, k) => sum + k.count, 0);
  if (total === 0) return 'Nothing player-visible landed.';
  if (kinds.length === 1) {
    const [only] = kinds;
    if (total === 1) return `One change landed, and it was ${ONE[only.kind] || only.kind}.`;
    return `${total} changes landed, all of them ${ONLY[only.kind] || only.kind}.`;
  }
  const tally = kinds.map((k) => `${k.count} ${TALLY[k.kind] || k.kind}`).join(', ');
  return `${total} changes landed: ${tally}.`;
}

/* --------------------------------------------------------------- the calendar */

/** Every date in the window, newest first, as YYYY-MM-DD. The window is a
 *  CALENDAR range and not a rolling 7x24h one, for the same reason the feed's
 *  is (see THE WINDOW IS A TIMEFRAME in bin/generate.mjs): a rolling window
 *  spans eight dates and a page that says seven days would then show eight. */
export function windowDates(lastDay, days) {
  const [y, m, d] = String(lastDay).split('-').map(Number);
  const out = [];
  for (let back = 0; back < days; back += 1) {
    const at = new Date(Date.UTC(y, m - 1, d - back));
    out.push([
      at.getUTCFullYear(),
      String(at.getUTCMonth() + 1).padStart(2, '0'),
      String(at.getUTCDate()).padStart(2, '0'),
    ].join('-'));
  }
  return out;
}

/* ------------------------------------------------------- the game repo's nights */

/**
 * docs/train/nightly.md IN THE GAME REPO, when it has entries.
 *
 * THE CONTRACT, and it is deliberately the shape the train already writes in:
 * a level-two heading carrying an ISO date, optionally followed by anything
 * else on the same line, then lines underneath it. docs/train/autoland-*.md is
 * written exactly like that today ("## 2026-08-06 04:45 autoland"), so a
 * nightly file is a rename away rather than a new discipline. Several headings
 * may carry the same date; a night that ran twice is still one night.
 *
 * IT DOES NOT EXIST YET, and this module is written for that. A missing file
 * yields nothing and the story is built entirely from what already ships. That
 * is the whole reason the parser lives here with a suite rather than inline in
 * a generator nobody can unit test: the first time the file appears will be a
 * night nobody is watching, and it has to be right without a rehearsal.
 */
export function parseNightly(source) {
  const byDate = new Map();
  let current = null;
  for (const raw of String(source || '').split('\n')) {
    const heading = /^##\s+(\d{4}-\d{2}-\d{2})\b/.exec(raw);
    if (heading) { current = heading[1]; if (!byDate.has(current)) byDate.set(current, []); continue; }
    if (/^#{1,6}\s/.test(raw)) { current = null; continue; }
    if (!current) continue;
    const line = raw.replace(/^\s*[-*+]\s+/, '').trim();
    if (line) byDate.get(current).push(line);
  }
  return [...byDate.entries()]
    .filter(([, lines]) => lines.length)
    .map(([date, lines]) => ({ date, lines }));
}

/**
 * WORDS A STRANGER SHOULD NOT MEET ON A PAGE ABOUT A GAME.
 *
 * docs/VOICE.md rule 12 forbids naming the machinery to a reader, and every
 * nightly line ever written so far names it constantly, because it was written
 * for the person running the train. Publishing it verbatim is the same mistake
 * the known-bugs section already refused on the director's instruction: raw
 * internal text on a public URL, shipped because it happened to be nearby.
 *
 * So a nightly line is QUOTED ONLY IF IT READS. Everything else is counted and
 * reported, never rewritten, because the copy belongs to the game repo and a
 * site that edits it is a second author of it.
 *
 * WHAT IS NOT ON THIS LIST, on purpose: lane, gate, track, build, release,
 * preview, stable. Those are the words built-in-the-open.html exists to teach,
 * the site already prints them in public copy, and refusing them here would
 * refuse the only nightly lines worth publishing.
 */
const MACHINERY = /\b(?:field|registry|artifact|contract|semantics|schema|repo|repository|branch|commit|commits|rebase|worktree|typecheck|tsc|vitest|refactor|regression|stacktrace|maestro|autoland|integrator|backlog|changelog|diff|merge|merged|claims)\b/i;
const BRANCH = /\b(?:claude|codex|origin|main|site|feature|hotfix)\/[A-Za-z0-9._-]+/;
const FILENAME = /\b[\w.-]+\.(?:md|markdown|ts|tsx|js|mjs|cjs|json|sh|ya?ml|html|css|png|svg)\b/i;
const SHA = /\b[0-9a-f]{7,40}\b/;
const HOUSE_LAW = /[—–!]/;

/** null when the line may be published, otherwise the reason it may not, phrased
 *  so the reported note names what a human has to change. */
export function unreadableReason(line) {
  const text = String(line || '').trim();
  if (!text) return 'it is empty';
  if (text.includes('`')) return 'it quotes code';
  if (BRANCH.test(text)) return 'it names a branch';
  if (FILENAME.test(text)) return 'it names a file';
  if (SHA.test(text)) return 'it names a commit';
  if (MACHINERY.test(text)) return `it names the machinery ("${MACHINERY.exec(text)[0]}")`;
  if (HOUSE_LAW.test(text)) return 'it breaks house law on dashes and exclamations';
  if (trailsOff(text)) return 'it does not finish its sentence';
  return null;
}

/** A ceiling per night, said out loud when it bites, same no-silent-caps law as
 *  the feed's per-day cap and the concise view's bug-fix cap. Two lines is a
 *  paragraph; ten is the full log arriving through a side door. */
export const NIGHTLY_LINES_SHOWN = 2;

/**
 * Reads the nightly source into what the story may print, plus both ways it can
 * be wrong. `refused` is a line the site would not publish, `trimmed` is a night
 * with more readable lines than the cap allows. Both are reported by the
 * generator as notes rather than warnings: the fix is in the game repo's prose
 * and this repo does not write that.
 */
export function readableNights(source, shown = NIGHTLY_LINES_SHOWN) {
  const byDate = new Map();
  const refused = [];
  const trimmed = [];
  for (const night of parseNightly(source)) {
    const kept = [];
    for (const line of night.lines) {
      const reason = unreadableReason(line);
      if (reason) { refused.push({ date: night.date, line, reason }); continue; }
      kept.push(line);
    }
    if (kept.length > shown) trimmed.push({ date: night.date, held: kept.length - shown });
    if (kept.length) byDate.set(night.date, kept.slice(0, shown));
  }
  return { byDate, refused, trimmed };
}

/* ------------------------------------------------------------------ the story */

/**
 * The whole narrative, one entry per calendar day in the window.
 *
 * `changesByDate` and `releasesByDate` are the generator's own derived maps, so
 * the story cannot disagree with the feed or the concise view about a day: it is
 * a third reading of the same two arrays rather than a third source.
 *
 * `outside` is the honesty valve. A commit dated outside the window means the
 * window and the log were reckoned in two different clocks, which has happened
 * here before (see the LOCAL date comment above `git log`), and it is reported
 * rather than silently dropped on the floor.
 */
export function buildStory({
  lastDay, windowDays, changesByDate, releasesByDate = new Map(), nightsByDate = new Map(),
}) {
  const dates = windowDates(lastDay, windowDays);
  const inWindow = new Set(dates);
  const outside = [...changesByDate.keys()].filter((date) => !inWindow.has(date)).sort().reverse();

  const days = dates.map((date) => {
    const changes = changesByDate.get(date) || [];
    const kinds = dayShape(changes);
    return {
      date,
      total: changes.length,
      kinds,
      shape: shapeSentence(kinds),
      quiet: changes.length === 0,
      releases: releasesByDate.get(date) || [],
      nightly: nightsByDate.get(date) || [],
    };
  });

  const active = days.filter((day) => !day.quiet).length;
  const total = days.reduce((sum, day) => sum + day.total, 0);
  /* A DAY'S ENTRIES ARE NOT A DAY'S RELEASES, and the summary counts the second.
   * A hand-written note is dated the day it was WRITTEN, and one of them
   * (notes/2026-07-30.md, declaring 0.5.0, which shipped on the 25th) is five
   * days adrift of the release it covers. Counting entries would have called
   * that a release cut on the 30th. So the caller marks an entry `cut` only when
   * the game's own patch notes date that version to that day, and the sentence
   * that says "releases were cut" counts exactly those. Everything with an entry
   * still gets its link, because a link is about where to read more and not
   * about what happened. */
  const releaseDays = days.filter((day) => day.releases.some((r) => r.cut)).length;
  const releaseCount = days.reduce((sum, day) => sum + day.releases.filter((r) => r.cut).length, 0);

  return { days, outside, summary: summarySentences({ total, active, windowDays, releaseCount, releaseDays }) };
}

/**
 * The lede over the day list: what the window held, then the beat that
 * complicates it. docs/VOICE.md rule 1, and the second sentence is always the
 * one a reader would ask for next, which is whether any of it reached them.
 *
 * A window with nothing in it is a real state (a week off, a week of nothing but
 * docs commits) and it gets its own pair rather than a sentence full of zeroes.
 */
export function summarySentences({ total, active, windowDays, releaseCount, releaseDays }) {
  if (total === 0) {
    return [
      `Nothing player-visible landed in the last ${windowDays} days.`,
      'The work in that window was writing, tidying and tests, none of which a player would notice.',
    ];
  }
  const first = `${total} player-visible changes landed in the last ${windowDays} days, across ${active} of them.`;
  if (releaseCount === 0) {
    return [first, 'None of those days ended in a release, so none of it has reached a player yet.'];
  }
  const releases = releaseCount === 1 ? 'One release was cut' : `${releaseCount} releases were cut`;
  const when = releaseDays === 1 ? 'on one of those days' : `across ${releaseDays} of those days`;
  return [first, `${releases} ${when}, and that is the part a player can already play.`];
}

/** Every sentence this module composes, for the suite to sweep. Nothing renders
 *  from this; it exists so a new template cannot be added without the
 *  finished-sentence law being applied to it. */
export function composedSentences(story) {
  return [...story.summary, ...story.days.map((day) => day.shape)];
}
