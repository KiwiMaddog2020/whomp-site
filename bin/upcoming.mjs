/** WHAT IS COMING NEXT, derived rather than maintained.
 *
 *  Director, 2026-08-06: "i also want our page here to automatically update
 *  upcoming features based on future deploys etc. I want this to update
 *  automatically like our dev log and wiki."
 *
 *  ── THE SOURCE, AND WHY THIS ONE ───────────────────────────────────────────
 *  Four sources could have answered "what is coming", and three of them publish
 *  wishes:
 *
 *    docs/CODEX_HANDOFFS/queue/   briefs waiting to be dispatched. Measured on
 *                                 2026-08-06: 18 briefs, 18 of them past their
 *                                 six-hour fuse and 0 dispatchable. A brief is a
 *                                 request for work, and a request can be
 *                                 withdrawn, superseded or simply never picked
 *                                 up. Publishing one is a promise made by
 *                                 somebody who has not started.
 *    docs/BACKLOG_INVENTORY.md    an engineer-facing sweep of everything anybody
 *                                 noticed. Same problem, larger.
 *    docs/claims/*.claims         work a lane owns right now. Closer, because
 *                                 somebody is holding the paths. Still not a
 *                                 promise: a lane is allowed to come back and
 *                                 say the premise was false, and three of them
 *                                 did exactly that on 2026-08-04.
 *    src/data/patchNotes.ts       a release that has been CUT. The version is
 *                                 stamped, the highlights are written, and the
 *                                 code they describe is merged. <- this one
 *
 *  So the section is built from releases that exist in the game's own release
 *  notes and are NEWER than the live Stable build. Two things follow, and both
 *  are the point:
 *
 *    Nothing reaches the page until the work is done. A feature that is queued
 *    and then dropped was never on the page, because queues are not read here.
 *    A cut release that is later pulled loses its entry the moment the game repo
 *    amends its notes, which is the same build the site refreshes on.
 *
 *    It moves on deploys, by itself. Promoting a release to Stable makes it the
 *    live version, so it stops being upcoming and starts being shipped. Cutting
 *    the next one puts the next one here. Nobody edits a list.
 *
 *  ── WHAT IT CANNOT DO ──────────────────────────────────────────────────────
 *  It cannot say anything when the live build could not be measured, and it does
 *  not try. `state: 'unknown'` is a distinct answer from "nothing is coming",
 *  because an offline generation run must not publish either claim.
 *
 *  It also never composes a sentence about the game. Every string it hands back
 *  was written by a person in the game repo, for players, at the moment the
 *  release was cut. Same law as bin/patch-notes.mjs, for the same reason: a
 *  generator that cannot write a wrong sentence about the game is what makes an
 *  unreviewed publish safe.
 */

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

/** THE FURTHER-OUT HALF, from docs/CAMPAIGN.md's ARCS block.
 *
 *  CAMPAIGN.md is the file the work is actually driven from, so parsing it keeps
 *  one roadmap rather than a second that drifts inside a week. It lives here
 *  beside the near half because they are one section on the page and one
 *  question for the reader.
 *
 *  Two things are corrected on the way out, and neither is a rewrite of the
 *  director's sentence:
 *
 *    A WRAPPED BULLET IS ONE BULLET. The match is per line, so an arc whose
 *    description runs onto an indented second line used to publish only the
 *    first line of it. On 2026-08-06 that put two cards on the public landing
 *    page whose text stopped mid-sentence, one on a comma and one on a dangling
 *    plus. Nothing was truncated on purpose and nothing said so, which is the
 *    worst version of a cap.
 *
 *    A TRAILING "per FILE.md" IS A NOTE TO A COLLEAGUE. Naming the machinery to
 *    a reader is the one thing docs/VOICE.md forbids outright, and a filename is
 *    not something a player can act on. Only that trailing clause is dropped.
 *
 *  @param {string} source     the whole CAMPAIGN.md text
 *  @param {(s:string)=>string} cleanDoc  the generator's own doc-text cleaner
 */
export function parseArcs(source, cleanDoc) {
  const block = String(source).split(/^## ARCS$/m)[1]?.split(/^## /m)[0] ?? '';
  const unwrapped = block.replace(/\n[ \t]+(?=\S)/g, ' ');
  const arcText = (s) => cleanDoc(s).replace(/[;,]?\s*per\s+[A-Za-z0-9_./-]+\.md\.?\s*$/i, '.');
  return [...unwrapped.matchAll(/^- (A\d+) ([^:(]+?)(?:\s*\(([^)]+)\))?:\s*(.+)$/gm)]
    .map((m) => ({ id: m[1], name: cleanDoc(m[2]), when: cleanDoc(m[3] || ''), what: arcText(m[4]) }));
}

/** Newest-first is the source contract, but sorting by position would trust the
 *  file's order for a comparison against a version that did not come out of the
 *  file at all. So the compare is real. */
export function compareVersions(a, b) {
  const pa = String(a).match(SEMVER);
  const pb = String(b).match(SEMVER);
  if (!pa) throw new Error(`Upcoming: "${a}" is not strict major.minor.patch semver, so it cannot be compared against the live build.`);
  if (!pb) throw new Error(`Upcoming: "${b}" is not strict major.minor.patch semver, so it cannot be compared against the live build.`);
  for (let i = 1; i <= 3; i += 1) {
    const d = Number(pa[i]) - Number(pb[i]);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

/** How many waiting releases the page will show at once. In practice this is
 *  one, occasionally two. The cap exists so a long gap between Preview and
 *  Stable cannot turn the landing page into a second changelog, and the count
 *  it drops is returned rather than swallowed (no-silent-caps law). */
export const UPCOMING_CAP = 3;

/**
 * @param {object} input
 * @param {Array<{version:string,date:string,headline:string,keyChanges:string[]}>} input.releases
 *        Parsed release notes, newest first (bin/patch-notes.mjs guarantees the shape).
 * @param {string|null} input.liveVersion  The measured live Stable version, or null.
 * @returns {{state:'unknown'|'current'|'ahead'|'waiting', shown:Array, dropped:number}}
 */
export function selectUpcomingReleases({ releases, liveVersion, cap = UPCOMING_CAP }) {
  if (!Array.isArray(releases)) throw new Error('Upcoming: releases must be an array.');
  if (!Number.isInteger(cap) || cap < 1) throw new Error('Upcoming: cap must be a positive integer.');

  if (liveVersion === null || liveVersion === undefined || liveVersion === '') {
    return { state: 'unknown', shown: [], dropped: 0 };
  }

  const newer = releases.filter((r) => compareVersions(r.version, liveVersion) > 0);

  if (newer.length === 0) {
    /* The live build is either exactly the newest cut release, or newer than
     * every release the notes carry. The second case means the game shipped a
     * version its own notes do not describe, which is a real condition worth
     * naming separately even though the page says the same neutral thing for
     * both: it is the shape a missed release-notes entry takes. */
    const known = releases.some((r) => compareVersions(r.version, liveVersion) === 0);
    return { state: known ? 'current' : 'ahead', shown: [], dropped: 0 };
  }

  /* Newest first, by version rather than by the order they arrived in. */
  const sorted = [...newer].sort((a, b) => compareVersions(b.version, a.version));
  return { state: 'waiting', shown: sorted.slice(0, cap), dropped: Math.max(0, sorted.length - cap) };
}
