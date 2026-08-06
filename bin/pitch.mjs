/** THE PITCH: how this game gets made, said to somebody who does not work here.
 *
 *  Every other page on this site derives its copy, and that is why none of them
 *  can rot. This one cannot work that way. "Work goes out in lanes" is not a
 *  number in a catalog, it is a description of a process, and no amount of
 *  parsing turns a process into a sentence a stranger would read.
 *
 *  SO THE SENTENCES ARE WRITTEN AND THE CLAIMS ARE PINNED. Each one below names
 *  the file in the game repo that makes it true and a pattern that has to still
 *  be found there. The prose is authored; the right to publish it is derived.
 *  Change the way the studio works, and the pattern stops matching, and the
 *  build turns the lane red until somebody either fixes the sentence or explains
 *  where the rule went. That is the same bargain the wiki's pinned copy already
 *  makes in bin/wiki-check.mjs, applied to a page about the process instead of a
 *  page about a weapon.
 *
 *  IT IS A WARNING AND NOT A NOTE, which is the opposite call from the arcs. An
 *  arc describing itself with last Thursday is the game repo's prose and this
 *  repo may not rewrite it. A pitch sentence is THIS repo's prose about the game
 *  repo's rules, so when the rule moves, the one-line fix is here. Warnings fail
 *  bin/regenerate-and-verify.sh; notes do not.
 *
 *  WHAT IS DELIBERATELY NOT ON THE PAGE. Branch names, lane slugs, commit shas,
 *  file paths, gate names and anything else a reader would have to work here to
 *  parse. docs/VOICE.md rule 12 forbids naming the machinery, and a pitch that
 *  opens with a directory listing is not a pitch. The page teaches five words
 *  (lane, gate, guard, track, deploy) and uses no others.
 */

/**
 * Each pin: the sentence the page is allowed to print, the file that earns it,
 * and every pattern that must still be found in that file.
 *
 * The patterns are matched against the source with WHITESPACE COLLAPSED, and
 * that is load-bearing rather than tidy. Both source docs wrap prose at about
 * eighty-eight characters, so half of these quotations straddle a line break in
 * the file. A per-line match finds twelve of fourteen and calls the other two
 * missing, which is the identical defect that truncated two campaign arcs
 * mid-sentence for a fortnight. Fold first, then look.
 */
export const PITCH_PINS = [
  {
    id: 'claimed-first',
    claim: 'A lane writes down which files it is allowed to touch before it touches any of them.',
    source: 'docs/CLOUD_LANE_RULES.md',
    evidence: [/docs\/claims/, /\*\*first\*\*/, /one glob per line/],
  },
  {
    id: 'one-writer',
    claim: 'Two lanes are never handed the same file, because the day they were, the tree stopped building and nothing looked wrong until somebody took an upgrade.',
    source: 'AGENTS.md',
    evidence: [/one writer per path/, /A shared type change is its own wave/],
  },
  {
    id: 'tests-ran',
    claim: 'A run of tests that reported nothing is a failed run. Zero is not a pass.',
    source: 'docs/CLOUD_LANE_RULES.md',
    evidence: [/A run reporting zero tests is a FAILURE/],
  },
  {
    id: 'negative-test',
    claim: 'A new check has to be made to fail on purpose before anybody believes it works.',
    source: 'docs/CLOUD_LANE_RULES.md',
    evidence: [/negative test that fires it \*\*on purpose\*\*/],
  },
  {
    id: 'reviewer',
    claim: 'Anything touching accounts, saves, other players or the deploy is read by somebody who did not write it.',
    source: 'AGENTS.md',
    evidence: [/independent reviewer/, /accounts, saves/],
  },
  {
    id: 'correct-negative',
    claim: 'A lane that proves its own job was based on something untrue, and stops, has finished. Three did that in one day, and all three were right.',
    source: 'docs/CLOUD_LANE_RULES.md',
    evidence: [/A correct negative is a complete deliverable/, /Three lanes did exactly that/],
  },
  {
    id: 'preview-first',
    claim: 'Every build that goes green goes to the preview track. The weekly one is only ever a preview build that already proved itself.',
    source: 'AGENTS.md',
    evidence: [/Preview is the default publication target/, /deliberate promotion/],
  },
  {
    id: 'approval',
    claim: 'Nothing ships because it is ready. It ships because a person named that exact build and said to ship it.',
    source: 'AGENTS.md',
    evidence: [/Pushing or deploying always requires explicit approval/],
  },
  {
    id: 'house-law',
    claim: 'No em dashes in anything a player can read. A machine checks that one, which is the whole point.',
    source: 'docs/CLOUD_LANE_RULES.md',
    evidence: [/No em dashes in any copy a player can read/],
  },
  {
    id: 'mechanism',
    claim: 'A rule nobody can check is a note. Every rule on this page is a check that can fail, and most of them were written the day after they were needed.',
    source: 'docs/CLOUD_LANE_RULES.md',
    evidence: [/a law without a mechanism is a note/i],
  },
];

/** docs/VOICE.md rule 9 and the house dash law, applied to this file's own
 *  prose. Nothing here is derived, so nothing here is protected by the checks
 *  that guard derived copy, which makes it the likeliest place on the site for a
 *  trailing comma or a stray dash to survive. */
const FINISHED = /[.?]$/;
const BANNED = /[—–!]/;

/** Every pin whose sentence breaks house law before it is ever published.
 *  Separate from the evidence sweep because it needs no game repo at all: it is
 *  a fact about this file, checkable in a unit test on a machine with no game
 *  checkout on it. */
export function malformedPins(pins = PITCH_PINS) {
  const bad = [];
  for (const pin of pins) {
    if (!FINISHED.test(pin.claim.trim())) bad.push({ id: pin.id, reason: 'the sentence does not finish' });
    if (BANNED.test(pin.claim)) bad.push({ id: pin.id, reason: 'the sentence breaks house law on dashes and exclamations' });
    if (!pin.evidence.length) bad.push({ id: pin.id, reason: 'the claim is pinned to nothing' });
  }
  return bad;
}

const flatten = (source) => String(source).replace(/\s+/g, ' ');

/**
 * Checks every pin against the game repo as it stands right now.
 *
 * `read` takes a repo-relative path and returns the file's text, or null when
 * there is no such file. Both failures are reported separately, because they
 * mean different things to whoever has to fix them: a missing FILE is usually a
 * rename and the fix is one path, a missing PATTERN is a rule that actually
 * changed and the fix is a sentence.
 */
export function verifyPins(read, pins = PITCH_PINS) {
  const verified = [];
  const missingSource = [];
  const missingEvidence = [];
  const cache = new Map();
  for (const pin of pins) {
    if (!cache.has(pin.source)) {
      const raw = read(pin.source);
      cache.set(pin.source, raw === null || raw === undefined ? null : flatten(raw));
    }
    const source = cache.get(pin.source);
    if (source === null) { missingSource.push(pin); continue; }
    const unmatched = pin.evidence.filter((pattern) => !pattern.test(source));
    if (unmatched.length) { missingEvidence.push({ ...pin, unmatched }); continue; }
    verified.push(pin);
  }
  return { verified, missingSource, missingEvidence };
}

/** The sentence the generator prints when a pin stops being earned. It names
 *  the claim, the file and what stopped matching, because a warning that does
 *  not say which file to open is a warning nobody acts on. */
export function pinWarning(pin, repoLabel) {
  if (pin.unmatched) {
    return `The pitch page claims "${pin.claim}" on the strength of ${repoLabel}/${pin.source}, which no longer contains ${pin.unmatched.map((p) => p.toString()).join(' or ')}. Either the rule moved or it changed; fix the sentence in bin/pitch.mjs rather than publishing a claim about how the game is made that is no longer true.`;
  }
  return `The pitch page claims "${pin.claim}" on the strength of ${repoLabel}/${pin.source}, and there is no such file. Find where it went and repoint the pin in bin/pitch.mjs.`;
}

/* ------------------------------------------------------------------- the scale */

/**
 * The one number on the page, and it is a count of lanes rather than of
 * commits, because commits are already counted twice elsewhere on this site and
 * a third count of the same thing is not evidence of anything.
 *
 * A retired claims file is one merged lane, exactly. The game repo's own
 * docs/claims/README.md makes retiring part of the merge rather than a later
 * tidy-up, and it makes reuse of a slug non-overwriting, so the file count is
 * the lane count and not an approximation of it.
 *
 * NO RELATIVE ANCHOR. "N days ago" is the defect the landing page just stopped
 * having: it is computed at build time and printed on a static page, so it is
 * wrong from the second generation onward. The first day is stated as a date and
 * the reader does the subtraction, or does not.
 *
 * IT REPORTS RATHER THAN THROWS, same call renderableArcs makes for the same
 * reason. The blast radius of throwing is the whole site over one sentence.
 */
export function trainScale({ landedLanes, firstDay }) {
  if (!Number.isInteger(landedLanes) || landedLanes <= 0) {
    return { ok: false, reason: 'no merged lane was counted, so the page will not print a scale it did not read' };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(firstDay || ''))) {
    return { ok: false, reason: 'the first commit has no date, so the page will not print one' };
  }
  return {
    ok: true,
    landedLanes,
    firstDay,
    sentence: `${landedLanes} of them have landed since the first commit, on ${firstDay}.`,
  };
}
