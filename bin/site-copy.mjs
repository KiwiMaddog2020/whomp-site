/** THE LANDING PAGE'S AND THE DEV LOG'S OWN WORDS, AND THE LOG'S WINDOW, IMPORTABLE.
 *
 *  Moved out of bin/generate.mjs (game-sites-s1-r2, 2026-11-01) so the kit's site
 *  module can render WHOMP's index.html and log.html from the same words and the
 *  same rules instead of a second copy of them (whomp-kit tools/site-whomp.mjs,
 *  landingAndLog). Nothing here changed when it moved: a plain run of
 *  bin/generate.mjs writes the same bytes it wrote before, and
 *  tests/siteCopy.test.mjs holds the pieces.
 *
 *  What lives here:
 *    - the copy: the title tagline, the framing prose of index.html's sections
 *      and log.html's, their titles, descriptions and footers. Strings that the
 *      page source wraps keep their line breaks and indentation exactly as the
 *      template had them; `plain` collapses them for a reader that is not HTML.
 *    - the window: FEED_WINDOW_DAYS and the git log reading that buckets the
 *      player-visible commits by day (feedDays).
 *    - the concise entries: notes/<date>.md parsing and the merge with the
 *      game's release notes (readNotes, conciseModel).
 *    - the day-by-day story over that window (dayByDay), which is
 *      bin/devlog.mjs's buildStory fed the way the generator feeds it.
 *
 *  What does not: the markup, the CSS and every number, which stay in
 *  bin/generate.mjs and the modules it already imports. */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { buildStory, windowDates } from './devlog.mjs';

/* ----------------------------------------------------------------- text helpers */

export const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'x';

/** Source docs in the game repo were written for engineers and sometimes carry
 *  an em dash. NO EM DASHES ANYWHERE is a site law, so any text pulled from a
 *  source doc goes through this before it reaches HTML. */
const EM_DASH = String.fromCharCode(8212);
const EN_DASH = String.fromCharCode(8211);
export const noEmDash = (s) => String(s)
  .replace(new RegExp(`\\s*${EM_DASH}\\s*`, 'g'), ', ')
  .replace(new RegExp(`\\s*${EN_DASH}\\s*`, 'g'), '-')
  .replace(new RegExp(EM_DASH, 'g'), '-')
  .replace(new RegExp(EN_DASH, 'g'), '-');

/** Strips markdown decoration (bold, backticks) from text lifted out of a repo
 *  doc, then runs it through noEmDash. Used for bug-inventory / backlog text
 *  that was authored for engineers, not for the inline markdown in notes/. */
export const cleanDoc = (s) => noEmDash(String(s).replace(/\*\*/g, '').replace(/`([^`]*)`/g, '$1').replace(/\s+/g, ' ').trim());

/** A wrapped source string as a reader sees it: one space for every run of whitespace. */
export const plain = (s) => String(s).replace(/\s+/g, ' ').trim();

/* ---------------------------------------------------------------------- the copy */

/* THE TAGLINE IS THE ONE MARKETING LINE. The game's own one-line description is
 * written for developers and name-drops the two games WHOMP gets compared to,
 * which the director cut as "a bit much" for a public page: leading with someone
 * else's games sells theirs, not ours. This is the one string on the site that is
 * marketing copy rather than repo truth, so it lives here and Kevin owns it. */
export const TAGLINE = 'A 3D horde-survivor where one weapon is yours to aim.';

export const indexTitle = () => `WHOMP: ${TAGLINE}`;
export const indexDescription = (runMinutes) => `${TAGLINE} A ${runMinutes} minute run in a browser tab, built in the open with the dev log public.`;

/** The provenance line every page's footer opens with, before the sha. */
export const FOOTER_LEAD = 'Every number on this page came straight out of the game, read at';

/** How many dev log entries the landing page shows, one line each. */
export const LANDING_LOG_ENTRIES = 5;

/** index.html's sections, in page order. A function takes the number its sentence carries. */
export const LANDING_COPY = {
  run: {
    title: 'What a run does to you',
    ledes: [
      'Fifteen minutes, and every one of them wants you dead. The horde arrives from all sides at once,\n    gems spray everywhere, and your build snowballs from one shaky weapon into a rolling catastrophe with your name\n    on it. By the end the screen is mostly explosions. You are in there somewhere, allegedly in charge.',
      'Nothing to download, nothing to install, and nobody here wants your email address. Click it and you\n    are already being chased.',
    ],
    tallyNote: 'Everything currently in there with you, hostile and otherwise.',
    /** The run tally's chips: [key in runShape's result, label after the number]. */
    tally: [['worlds', 'worlds'], ['enemies', 'enemies'], ['characters', 'characters'], ['cores', 'aimed cores'], ['weapons', 'weapons']],
  },
  kit: {
    title: 'Your kit',
    lede: (offer) => `Every level up offers ${offer}. You keep one, the other ${offer - 1} are gone for good.`,
  },
  shipped: {
    title: 'What just shipped',
    lede: (entries) => `The last ${entries} things that changed, in the words they were written in on the day.\n    The dev log has the rest, including the days that went badly.`,
    more: 'Read the whole dev log',
  },
  next: {
    title: 'What we are building',
    lede: 'The big pieces, in the order we are actually building them rather than the order we promised.',
  },
  pipeline: {
    title: 'Coming down the pipeline',
    lede: (queued, shown) => `Wanted, written down, not started. ${queued} things are in that queue and these are\n    ${shown} of them.`,
    tag: 'QUEUED',
  },
};

/** log.html's title, top bar and sections, in page order. */
export const LOG_COPY = {
  title: 'WHOMP dev log',
  subtag: 'Built by one person and a crew of AI agents. This is the real log.',
  description: 'The WHOMP dev log: what shipped, what is still broken, and what is coming next.',
  story: {
    title: 'Day by day',
    link: { href: 'built-in-the-open.html', text: 'How a change gets from a lane to your browser.' },
    /** A story day's link to an authored note with no version. */
    writtenUp: 'Written up',
  },
  shipped: {
    title: 'Shipped',
    concise: 'Concise',
    full: 'Full log',
    all: 'All',
    earlierReleases: (n) => `${n} earlier release${n === 1 ? '' : 's'} not shown here.`,
    earlierDays: (n) => `${n} earlier active days not shown here.`,
    lede: "Two ways to read it. Concise is one entry per release, in the words it was written\n      in for players, with Kevin's own note in its place on any day he wrote one. Full is every commit,\n      unedited, including the ones nobody would put in a release note.",
  },
  bugs: { title: 'Known bugs' },
  flight: {
    title: 'In flight',
    lede: "What is on somebody's desk right now, as opposed to what is on the wish list.",
    tag: 'IN FLIGHT',
    queued: (count) => `${count} item${count === 1 ? '' : 's'} queued`,
  },
  /** Under a release card when its fixes are capped; under a day of the full feed when it is. */
  moreFixes: (hidden) => `${hidden} more fix${hidden === 1 ? '' : 'es'} shipped in this release. The full log has all of them.`,
  moreThatDay: (hidden) => `+ ${hidden} more that day, not shown`,
  /** The footer's provenance count, beside the build stamp. */
  stat: ({ total, windowDays, activeDays, filtered }) => `${total} player-visible changes in the last ${windowDays} days, across ${activeDays} active days, ${filtered} internal-only commits filtered out`,
};

/* HOW A READER TELLS THE CONCISE ENTRIES APART: a source chip beside the date and
 * version chips. Both kinds are labelled, so neither reads as the exception. */
export const SOURCE_LABEL = {
  authored: 'written for the log',
  release: 'from the release notes',
  /* A DAY THAT SHIPPED UNDER A VERSION THAT DID NOT MOVE, and it gets its own
   * label rather than borrowing the release one. Two cards chipped v0.7.12 with
   * different dates and different words in them is a reader's fair question, and
   * this label is the answer: the version held, the content kept arriving. The
   * words still come from the game's own release notes and are still authored by
   * a person, which is why the label names the RELATIONSHIP rather than a second
   * source. See the header of bin/patch-notes.mjs. */
  addition: 'added under this version',
};

/* -------------------------------------------------------------------- the window */

/** The full feed and the day-by-day story cover this many calendar days. */
export const FEED_WINDOW_DAYS = 7;

export const PLAYER_VISIBLE = /^(feat|fix|balance|perf|style)(\(|:)/;
export const NOISE = /^(docs|chore|test|refactor|merge|revert)(\(|:)/i;
export const KIND_LABEL = { feat: 'New', fix: 'Fixed', balance: 'Balance', perf: 'Performance', style: 'Polish' };
export const KIND_INK = { feat: '--cyan', fix: '--pink', balance: '--violet', perf: '--gold', style: '--gold' };

/** The window's dates, newest first, and its first day, for `git log --since`. */
export function feedWindow(referenceDay, windowDays = FEED_WINDOW_DAYS) {
  const dates = windowDates(referenceDay, windowDays);
  return { dates, start: dates[dates.length - 1] };
}

/** The `git log` arguments the feed reads, from the window's first day. */
export const feedLogArgs = (windowStart) => ['log', 'main', '--date=short-local', '--pretty=%h\x1f%ad\x1f%s', `--since=${windowStart} 00:00:00`];

/** Lines of that `git log` into the player-visible changes by date, and how many noise commits were filtered. */
export function feedDays(rawLines) {
  const days = new Map();
  let filtered = 0;
  for (const line of rawLines) {
    const [sha, date, subject] = line.split('\x1f');
    if (!subject) continue;
    if (!PLAYER_VISIBLE.test(subject)) { if (NOISE.test(subject)) filtered++; continue; }
    const m = subject.match(/^(\w+)(?:\(([^)]+)\))?:\s*(.+)$/);
    if (!m) continue;
    if (!days.has(date)) days.set(date, []);
    days.get(date).push({ sha, kind: m[1], scope: noEmDash(m[2] || ''), text: noEmDash(m[3]) });
  }
  return { days, filtered };
}

/* ------------------------------------------------------------- the concise entries */

/** A notes/<date>.md file: front matter (version, date, title) and the body. */
export function parseNote(raw, fallbackDate) {
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

export const BUCKET_NAMES = ['New', 'Better', 'Fixed', 'Coming'];
const BUCKET_RE = new RegExp(`^##\\s+(${BUCKET_NAMES.join('|')})\\s*$`, 'i');

/** A note's body as its intro blocks and its bucketed blocks (## New, ## Better, ## Fixed, ## Coming). */
export function parseBody(body) {
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

/** Every notes/<date>.md in `notesDir`, parsed, newest first. */
export function readNotes(notesDir) {
  if (!existsSync(notesDir)) return [];
  return readdirSync(notesDir)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
    .map((f) => {
      const parsed = parseNote(readFileSync(join(notesDir, f), 'utf8'), f.replace(/\.md$/, ''));
      if (!parsed) return null;
      const { intro, buckets } = parseBody(parsed.body);
      return { ...parsed, file: f, intro, buckets };
    })
    .filter(Boolean)
    .sort((a, b) => b.date.localeCompare(a.date));
}

/* bugFixes is not capped at the source the way keyChanges is (0.6.0 carries
 * ten), and ten fix lines under four highlights is the drift back into a full
 * list that this view cannot survive. So it is capped HERE, and the remainder
 * is said out loud rather than silently dropped: same no-silent-caps law as the
 * "+N more that day, not shown" line in the full feed. The order is the order
 * the release author wrote them in, which is an authored ordering and not a
 * machine ranking; the page never claims the shown four are the important four,
 * only that there are more and where they are. */
export const BUG_FIXES_SHOWN = 4;
/* A ceiling on the whole view, for the same reason the full feed has one. It is
 * above the full view's reach on purpose (that view holds 30 days; this holds
 * roughly two months of releases at the current cadence), because a summary
 * that remembers less than the raw log is the wrong way round. */
export const CONCISE_RELEASES_CAP = 24;

/** The concise view: one entry per release, per dated addition and per authored note, newest first. */
export function conciseModel({ releases, notes }) {
  const authoredDates = new Set(notes.map((n) => n.date));
  const authoredVersions = new Set(notes.map((n) => n.version).filter(Boolean));
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
  /* THE DAYS A VERSION NUMBER COULD NOT HOLD, flattened into the same entry shape
   * as everything else so nothing downstream needs to learn a third kind. The
   * landing page's five lines, log.html's cards, the story's per-day links and the
   * search index all read `conciseEntries`; an addition that arrives here as an
   * ordinary entry reaches every one of them for free.
   *
   * FILTERED ON DATE ONLY, and deliberately not on version. A note takes a
   * VERSION's slot (see the block above authoredDates), which is a statement about
   * one release entry. An addition is a different day under that version, and a
   * note written on the 25th has no business suppressing what shipped on the 26th.
   * A note dated the same day as an addition does replace it, because that is what
   * "Kevin wrote that day's entry" has always meant here.
   *
   * `cut` falls out FALSE for every one of these, because cutOn is keyed on
   * date|version out of the release list and no version was cut on an addition's
   * date. That is the honest reading: the day shipped, no release was cut. */
  const additionEntries = releases.flatMap((r) => (r.additions || [])
    .filter((a) => !authoredDates.has(a.date))
    .map((a) => ({
      kind: 'addition',
      date: a.date,
      version: r.version,
      anchor: `release-${slug(r.version)}-${a.date}`,
      title: cleanDoc(a.headline),
      keyChanges: a.changes.map(cleanDoc),
      bugFixes: [],
    })));
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
  const conciseEntries = [...authoredEntries, ...releaseEntries, ...additionEntries]
    .sort((a, b) => b.date.localeCompare(a.date) || String(b.version).localeCompare(String(a.version)));
  const conciseShown = conciseEntries.slice(0, CONCISE_RELEASES_CAP);
  return { releaseEntries, additionEntries, authoredEntries, conciseEntries, conciseShown, conciseDropped: conciseEntries.length - conciseShown.length };
}

/* ------------------------------------------------------------------ the story */

/** The day-by-day story over the window: the feed's days, the concise entries dated in it
 *  (marked `cut` only when the game's own patch notes date that version to that day) and
 *  the nightly lines that read. */
export function dayByDay({ referenceDay, windowDays = FEED_WINDOW_DAYS, days, releases, conciseShown, nightsByDate = new Map() }) {
  const cutOn = new Set(releases.map((r) => `${r.date}|${r.version}`));
  const releasesByDate = new Map();
  for (const entry of conciseShown) {
    if (!releasesByDate.has(entry.date)) releasesByDate.set(entry.date, []);
    releasesByDate.get(entry.date).push({ ...entry, cut: cutOn.has(`${entry.date}|${entry.version}`) });
  }
  return buildStory({ lastDay: referenceDay, windowDays, changesByDate: days, releasesByDate, nightsByDate });
}
