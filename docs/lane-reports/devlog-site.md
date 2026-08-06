# devlog-site

Lane: `claude/devlog-site` on `whomp-site`, based on `main` at `c45e558`
(the landing step-up, already merged). The game repo was read and never written.

The dev log was a feed. It is now the story of the build, and there is a second
page that says how the build works.

---

## What was built

**The day by day story**, `log.html#story`, first section, above the two lists
that were there. One card per calendar day across the same seven-day window the
full feed covers, newest first, **including the days nothing shipped on**.

Both existing views are lists, and neither can answer "what happened yesterday",
because neither has a day in it that nothing landed on. A stranger who followed
somebody else's link is not looking for a changelog.

**`built-in-the-open.html`**, the pitch. Six sections explaining lanes, gates,
guards, the stop and the two tracks, in the game's voice, to somebody who does
not work here.

**One top bar**, hoisted out of `index.html` so the second public page is not a
second bar to get wrong.

## What derives from where

| What the story says | Where it read it |
|---|---|
| The run of days, and which are quiet | the calendar, drawn by the same function that bounds `git log` |
| What a day was made of | the kind counts of that day's player-visible commits |
| What was cut that day | `whomp/src/data/patchNotes.ts`, the release's own headline |
| Which day a release was actually cut on | the same file's date, matched against the entry's version |
| Whether a note replaces a release | the existing `conciseShown` merge, unchanged |
| The night's line | `whomp/docs/train/nightly.md`, when it exists and if it reads |

| What the pitch says | Where it earned it |
|---|---|
| Ten claims about how work moves | `whomp/docs/CLOUD_LANE_RULES.md` and `whomp/AGENTS.md`, one pin each |
| How many lanes have landed | the file count of `whomp/docs/claims/retired/*.claims` |
| When the first commit was | the game repo's root commit |
| What each track is serving | unchanged, the existing per-track measurement |

## The three rules this lane did not break

**Nothing composes a sentence about the game.** `bin/devlog.mjs` inherits the
law `bin/patch-notes.mjs` is built on. It writes sentences about the SHAPE of a
day, from counts it read (`132 changes landed: 88 new, 41 fixed, 3 performance.`),
which are facts about the log rather than claims about the game. Everything that
is a claim about the game is quoted from a human: a release headline, or a
nightly line.

**Quiet days stay on the page.** A feed built only from days that had commits
reads as though every day had commits, which is the same class of untruth as a
trailing window reading like a lifetime total. Today's window happens to have
none; the shape is tested against a constructed one.

**The pitch is authored, and its right to speak is derived.** A process is not a
number in a catalog, so no amount of parsing turns it into a sentence a stranger
would read. Instead each claim names the file in the game repo that makes it
true and the patterns that must still be found there. A rule that moves drops
the claim from the page and raises a `SITE WARNING`. That is the opposite
severity from a stale arc, deliberately: an arc's prose belongs to the game
repo, a pitch sentence is this repo's prose about the game repo's rules, so the
one-line fix is here.

Pins are matched with **whitespace collapsed**. Both source docs wrap at about
eighty-eight characters and two of the fourteen quotations straddle a line break,
so a per-line matcher finds twelve and calls the other two missing. That is the
identical defect that ended two campaign arcs on a comma, arriving in a new file.

## `docs/train/nightly.md` does not exist yet

The brief named it as a source "when it has entries". It has no file. The reader
is written for exactly that: a missing file yields nothing, the site does not
change on the night one appears, and the parser is tested against fixtures
rather than against a file that does not exist.

The contract is the shape `docs/train/autoland-*.md` already writes in, so a
nightly file is a rename away rather than a new discipline.

**A line is published only if a stranger could read it.** Every nightly line
written so far names branches, files, commits and machinery, because it was
written for the person running the train. Publishing it verbatim is the same
mistake the known-bugs section already refused on the director's instruction:
raw internal text on a public URL, shipped because it happened to be nearby. A
line is refused for quoting code, naming a branch, a file or a commit, naming
the machinery, breaking house law, or not finishing its sentence. Refusals are
`SITE NOTE`, because that prose belongs to the game repo.

`lane`, `gate`, `track`, `build`, `release`, `preview` and `stable` are
deliberately not refused. They are the words the pitch page teaches, the site
already prints them in public copy, and refusing them would refuse the only
nightly lines worth publishing.

## Verified, not assumed

| Claim | How | Result |
|---|---|---|
| Every pinned rule is still in the game repo | `verifyPins` against `../whomp` | 10 of 10 |
| Two quotations straddle a line break | per-line match vs collapsed match | true, and pinned as a guard |
| A retired claims file is one merged lane | `whomp/docs/claims/README.md` | true, retiring is part of the merge and reuse is non-overwriting |
| The feed window and the story window agree | one function draws both | no day reported outside the window |
| An entry's date is not always its release date | `notes/2026-07-30.md` declares `0.5.0`, dated the 25th | true, so cuts are counted by version match |
| `docs/train/nightly.md` exists | `find` over the game repo | **no**, and the reader is built for its absence |
| The game's current main can generate the site | full run at `cbed6606` | **no**, see the blocker below |

## The blocker, owned by the game repo

At `cbed6606`, `bin/tier-engine.mjs --verify` reports `data/tier-rankings.json`
**stale** against `src/data`: the source-contract digest, two file hashes and the
sweep fingerprint all disagree with the live runtime. The site generator refuses
a stale artifact before it writes anything, so the site cannot be built from the
game's current main at all.

`7c74385c` verifies clean, and the only commit touching `src/data` between them
is `68c8421e feat(duel): the 15-18 window is ratified, and the witness gets its
tripwire`.

**Owner:** the game repo. **Fix:** `node bin/tier-engine.mjs` there, and commit
the regenerated artifact. **Evidence:** the verifier's own output, quoted above.
This lane read the game repo and did not write to it, so it did not run the
sweep. Everything below was therefore verified at `7c74385c`.

## The provenance split, found by looking at the render

Every page stamps `game@<HEAD>` in its footer. The `git log` that builds the
story and the raw feed asks `main`. On an ordinary checkout sitting on main
those are one commit and nobody notices.

This lane read the game repo through a clean local clone, because the working
copy was dirty from a concurrent lane and the generator refuses a dirty source.
Detached at `7c74385c` inside a clone whose `main` had moved 34 commits on, the
site published a footer reading `game@7c74385c` above a story counting 727
changes, seven of which were not in that tree. Every check passed. The page was
internally consistent and externally false, which is exactly the failure this
repo exists to refuse, arriving through the one door nothing was watching.

It was caught by opening the render and reading the number, not by reasoning.

`bin/generate.mjs` now compares the two and raises a `SITE WARNING` naming both
shas when they disagree, which fails the gate. A warning rather than a throw:
building from a worktree is legitimate, publishing it without saying so is not.
Fired on purpose against a checkout detached at `7c74385c` with `main` at
`cbed6606`, and it named both.

## Verification

- `bin/regenerate-and-verify.sh --offline --repo <clean 7c74385c checkout, HEAD and main aligned>`, **exit 0**
- **119 tests, 119 pass, 0 fail, 0 skipped**, across seven suites
- Generator: `0 warnings, 1 note` (the arc A5 schedule, owned upstream and known)
- `39 documents` written, up from 38
- Story: 7 days, 0 quiet, 7 releases cut across 4 of them, 0 nightly lines
- Pitch: 10 of 10 claims earned, 6 sections, 337 lanes landed since 2026-07-11

New tests: `tests/devlog.test.mjs` (20), `tests/pitch.test.mjs` (10), plus 12 in
`tests/generatedSite.test.mjs`.

**Every new guard was fired on purpose before it was believed.** Remove a day
from the middle of the run, or swap two adjacent days, and the no-gaps check
goes red. Age the whole story by a month and the window no longer reaches today.
Miscount one tally chip and it disagrees with the sentence beside it. Truncate a
shape sentence, or leave a pitch paragraph trailing, and the finished-sentence
check catches both. Strip the pinned claims off the pitch, drop its scale
sentence, print "worktree" on it, or slip "last week" into it, and each has a
check of its own that fires. Gut a pinned rule in a source file and the verifier
names the file and where to fix the sentence.

## The acceptance sentence

Open `log.html` and the first thing on it is a run of seven dated cards, one per
day including the days nothing shipped, each saying what landed and linking what
was cut; click "How a change gets from a lane to your browser" and the page that
opens explains the lanes, gates and tracks without naming a single branch, file
or commit.

## Residuals

- **The daily cron is now the most load-bearing gap in the repo**, and it is the
  same one the landing lane left. The story publishes a window anchored to the
  day it was generated, so a week without a run puts a page in front of readers
  whose central sentence has entirely gone by. Step 1 of the run reports the
  drift and the drift suite refuses a window that no longer reaches today, which
  makes the gap loud. Neither closes it. **Destination:** the scheduler entry, in
  the game repo.
- **`data/tier-rankings.json` is stale on the game's main.** Destination: the
  game repo, `node bin/tier-engine.mjs`. Until then the site cannot regenerate.
- **`docs/train/nightly.md` does not exist.** Destination: the game repo's
  overnight train. The site needs no change on the night it appears; the eight
  refusal reasons are the contract it should be written against.
- **The pitch is a reading column in a 940px wrap**, so a wide screen leaves the
  right third empty. Left alone on purpose: `index.html` has the same measure and
  the same wrap, and inventing a second column width for one page is a decision
  for the director rather than a lane. **Destination:** his eye.
- **The `--repo` provenance split is now loud, not closed.** A build off a
  worktree or a detached checkout still reads its feed from `main` and stamps
  `HEAD`; the guard refuses to publish silently but does not make the two agree.
  **Destination:** whoever next wants a preview build off a branch.
- **A day with four releases on it renders four rows**, uncapped. True today
  (0.6.3 through 0.6.6 all carry 2026-08-06) and honest, but there is no ceiling
  and no said-out-loud remainder if a day ever carries ten. **Destination:** a
  cap plus its remainder line, if a burst day ever makes it read badly.
