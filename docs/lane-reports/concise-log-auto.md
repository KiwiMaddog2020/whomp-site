# concise-log-auto

Lane: `claude/concise-log-auto` on `whomp-site`, based on a freshly fetched
`origin/main` (`326b03c`). The game repo was read and never written.

The concise dev log was not broken. It was unfed. It now feeds itself from the
place a human already picks highlights, and an authored note still wins.

---

## The source, and why

**Chosen: `whomp/src/data/patchNotes.ts`, `PATCH_RELEASES`.** The premise in the
brief held up under checking, and I checked it rather than trusting it.

The constraint the generator states, and the one the whole design has to
respect:

> a machine cannot pick highlights, so nothing lands here except a human
> deciding it was worth saying, and that is what keeps this view from ever
> filling with noise.

`PATCH_RELEASES` is where that human decision already happens. Per release it
carries `headline` (its own doc comment calls it "One-line release banner"),
`keyChanges` ("Digest highlights shown by default. Keep this to four or
fewer"), `bugFixes` ("Short, player-facing bug-fix list"), plus `fullChanges`
and `pleaseTest`. Every string is written by a person, in player-facing
language, when the release is cut, and it already ships to players in the title
screen's WHAT'S NEW panel (`src/ui/patchNotes.ts`). The curation is not being
requested a second time; it is being carried across.

What I verified rather than assumed:

| Claim | How it was checked | Result |
|---|---|---|
| `keyChanges` is capped at four | `whomp/tests/patchNotes.test.ts:138`, `expect(r.keyChanges.length).toBeLessThanOrEqual(4)` | true |
| The cap is honoured in practice | parsed all 8 releases | all 8 carry exactly 4 |
| The text is player-facing | read 0.6.0, 0.6.1, 0.6.2, 0.5.0 in full | yes, and written for players, not engineers |
| Same Vancouver date means same version | `whomp/bin/release-channel.mjs:386`, `if (livePreview.releaseDate === calendar.date) return livePreview.gameVersion;` else `patch + 1` at `:86` | true, so per-release is the right cadence and per-deploy would duplicate |
| House law holds in the source data | scanned the `PATCH_RELEASES` body for em dash, en dash, exclamation | 0, 0, 0 |
| Patch notes are in the generated data layer | `data/game-data.json` domain list | **no** — they are not, so the site must read the `.ts` |

**Rejected: `git log`.** Not on taste, on structure. The FULL view already *is*
`git log`. A concise view built from commits is that view with fewer words, and
the toggle would offer a reader two doors into the same room. That is the road
`PLAN.md` records Kevin as having already been down.

**Rejected: `fullChanges`.** It is the exhaustive shipped ledger, seventeen
entries on 0.6.1. It is read for shape validation and then deliberately dropped.
`tests/patchNotes.test.mjs` pins that it never reaches the view.

**Rejected: `pleaseTest`.** It is a tester checklist, not a "coming next" list,
and `patchNotes.ts`'s own header says the live interactive version was
relocated into the game's TESTER panel (`src/data/testerItems.ts`). The site
republishing it would be a second, staler copy.

---

## How the noise guard survives with no human in the loop

There is no approval queue, no review UI, no draft state and no badge, per the
ruling. So the guard has to be structural. Four things carry it:

**1. The generator cannot write a sentence about the game.** This is the
load-bearing one. `bin/patch-notes.mjs` parses, validates and refuses.
`bin/generate.mjs` escapes, groups and frames. Every claim a visitor reads in a
generated entry was authored in the game repo by a person. The only sentence the
machine emits that nobody wrote is the truncation line, which is about the page
rather than about the game. **A generator that cannot compose a sentence about
the game cannot compose a wrong one**, which is what makes publishing without
review safe rather than merely cheap.

**2. The four-item cap is enforced on this side too.** The game's test protects
the game's What's New panel, not this view. `KEY_CHANGE_CAP` in
`bin/patch-notes.mjs` fails the site build if the game repo ever raises its cap.
The guard is not borrowed from another repo's test staying green.

**3. `bugFixes` is capped where the source does not cap it.** 0.6.0 carries ten,
and ten fix lines under four highlights is the drift back into a full list. The
site shows four and says how many more shipped, never silently. Source order is
the release author's own ordering, not a machine ranking, and the page never
claims the four shown are the important four.

**4. Empty is an error, not an empty list.** A parse yielding zero releases
throws; a concise view that reaches render with no entries throws; and after
`log.html` is built, every derived entry's anchor is checked to actually be in
it. A clean run that publishes nothing is the specific failure this surface is
prone to, and it now has three separate refusals in its way.

That last one is not hypothetical. **The first draft of my own reader anchored
on the name `PATCH_RELEASES`, found the `[` in `: readonly PatchRelease[] =`,
parsed a perfectly valid empty array, and returned zero releases.** It exited
cleanly. Only the empty-parse refusal caught it. That bug is now a named test.

### What a reader can tell, and why they should be able to

Every entry carries a third chip beside its date and version: **`written for the
log`** or **`from the release notes`**.

Both kinds are labelled, not just the generated one. If only generated entries
carried a mark, the mark would be doing two jobs — naming a source and flagging
an exception — and the second job is the one that reads as an apology. Two
neutral labels are symmetric, so neither is the deviation. It is provenance in
the same register as the build stamp and the wiki's "read out of the game at
build time" line, which is a habit this site already has.

This is also the concrete reason there is no `unreviewed` badge: with no review
path it could never be removed, and a permanent apology on every entry is worse
than no entry.

---

## Hand-written notes still win, completely

A note replaces the generated entry for the **day it is dated** and for the
**version it declares**. Both keys, and this is the one place I diverged from
the brief's wording (which specified the date). Date alone is provably not
enough, on live data:

- `notes/2026-07-30.md` declares `version: 0.5.0`.
- `PATCH_RELEASES` dates 0.5.0 to **2026-07-25**, and the duel fixes that note
  is actually about are in 0.6.0.

On a date-only key nothing is suppressed and the page renders **two entries
chipped `v0.5.0` with different content in them**. Two entries claiming one
version is worse than either being missing. Version alone is not enough either,
because the field is optional and a note written on release day without one
still has to replace that day.

The cost is stated in the code and here: a note that names a version takes that
version's slot, so 0.5.0's release notes are not published while that note
declares it. Deleting the `version:` line from the front matter publishes both.
Nothing to turn off, no flag to remember.

---

## The backfill entry, quoted in full

`notes/2026-08-05.md`. One entry for the whole week, not one per day. It is a
hand-written note, so it exercises precedence against live data: it suppresses
the generated 0.6.2 entry and carries 0.6.2's content itself.

Neutral studio voice, not an impression of Kevin. No em dashes, no en dashes, no
exclamation marks, uncontracted. It says the gap happened in its first sentence.

````markdown
---
version: 0.6.2
date: 2026-08-05
title: A week of releases, caught up in one entry
---

This log went quiet for six days while three releases shipped. That is the gap,
and this entry closes it. From today each release writes its own entry here as
it is cut, so a week like this one cannot go unrecorded again.

The three are 0.6.0 on July 31, 0.6.1 on August 4, and 0.6.2 today. The two
older ones have their own entries below this one. This entry is the week.

## New

- **Two snow worlds are reachable.** Frostreach Pines and Shiverpeak Summit sit
  behind the Frost Gate, so a run now goes hearth, desert, frost, void. They
  borrow desert enemies for this release while their own roster is built.
- **Build tracks.** Stable is the recommended weekly build, Preview is the
  latest fully green one. Each installs as its own app with its own on-device
  progress, and online rooms now match on both track and exact build, so a
  Stable player and a Preview player cannot start a divergent match by accident.
- **Your core weapon reads more of your build.** The scattergun and the longbow
  respond to victims, arc and area, so four upgrade paths that previously did
  nothing for them now change how they fire. Cores also declare an element, and
  committing a build to one sharpens what that element does rather than handing
  you a flat bonus.
- **Duels and arena matches end on a scope-out screen.** Both sides, side by
  side, with what each was running and how the fight actually went.

## Better

- Mouse look is the default for mouse and keyboard. The camera turns the way it
  does in a shooter and the cursor stays parked above your character. There is a
  Cursor Height slider in Settings, and click to aim is still under Controls.
- Starfall no longer lands in the opening minutes. The first shard falls after
  five minutes and the crown after nine, so an early lucky pickup cannot decide
  the run.

## Fixed

- **Duels stop dragging.** Lifesteal and health regeneration were both measured
  against unscaled health while every damage number in a duel was scaled, so the
  safety cap never bound and every seat healed at the same flat rate whatever it
  drafted. Both are fixed, and in testing every stalemate resolved.
- **The laser telegraphs its return sweep.** The second pass used to arrive with
  no warning, which made a readable attack read as a random one.
- **Co-op runs have sound.** Hits, pickups, level ups and everything else were
  silent for every player in a co-op game.
- **The challenge bell and its reward drop were silent and now are not.**
- The snow levels no longer grow meadow clover and gold flowers on the ice.
- The village has cats.

## Coming

- The snow tier gets enemies of its own, so the frost worlds stop borrowing from
  the desert.
- ||A boss to close the snow tier out.||
````

Every claim in it traces to a `PATCH_RELEASES` entry for 0.6.0, 0.6.1 or 0.6.2,
or to work merged on game `main` in the case of the two Coming lines
(`c27dbaf merge(snow): the snow tier gets enemies of its own`,
`67477ce merge(borealisk-boss)`). One deliberate deviation from `docs/VOICE.md`:
rule 11 says never be meta about the document, and this entry opens by naming
its own gap. The brief required an entry that does not pretend the gap did not
happen, and a dev log acknowledging a quiet week is a different genre from a
wiki page describing a weapon.

---

## What the generator actually produced

Run against a probe checkout (see blockers below), inspected, then discarded:

```
concise log: 8 releases read (at most 4 highlights each), 2 authored notes,
             6 generated, 8 entries published
site: 1461 anchors, all internal links resolve
search index: 928 entries
```

`log.html`'s concise pane, read back out of the emitted file:

| anchor | date | version | source | highlights + fixes shown | truncation line |
|---|---|---|---|---|---|
| `note-2026-08-05` | 2026-08-05 | v0.6.2 | written for the log | 14 | — |
| `release-0-6-1` | 2026-08-04 | v0.6.1 | from the release notes | 8 | 2 more fixes |
| `release-0-6-0` | 2026-07-31 | v0.6.0 | from the release notes | 8 | 6 more fixes |
| `note-2026-07-30` | 2026-07-30 | v0.5.0 | written for the log | 7 | — |
| `release-0-4-0` | 2026-07-20 | v0.4.0 | from the release notes | 8 | — |
| `release-0-3-0` | 2026-07-18 | v0.3.0 | from the release notes | 8 | — |
| `release-0-2-1` | 2026-07-17 | v0.2.1 | from the release notes | 7 | — |
| `release-0-2-0` | 2026-07-17 | v0.2.0 | from the release notes | 8 | — |

Eight `<article class="notecard">` elements in the concise pane, against one
before this lane. Both suppressions fired on live data: 0.6.2 by date and
version, 0.5.0 by version. Em dashes, en dashes and exclamation marks in the
rendered concise pane: **0, 0, 0**.

Search index gained `release` (6), `highlights` (24) and `fixed` (25) rows and
is built from what the page renders, so a hit can never scroll to nothing.

---

## Tests

`node --test tests/*.test.mjs`, all green:

| file | tests | result |
|---|---|---|
| `tests/generatedOutputGit.test.mjs` | 6 | pass (pre-existing) |
| `tests/liveVersion.test.mjs` | 8 | pass (pre-existing) |
| `tests/patchNotes.test.mjs` | 21 | pass (new) |
| **total** | **35** | **35 pass, 0 fail** |

Note: `node --test tests/` fails on this Node with a module-resolution error
against the directory form. `node --test tests/*.test.mjs` is the working
invocation. That is pre-existing and not caused by this lane.

The 21 new tests cover: the type-annotation trap that produced a silent empty
parse; refusal on zero releases and on a missing export; the four-highlight cap
in both directions; `fullChanges` and `pleaseTest` never reaching the view;
duplicate and misordered versions; two releases sharing a date; and prose
containing escaped apostrophes, brackets and braces, which is why the reader is
a real literal parser and not a regex sweep or an `eval`.

---

## The full log's staleness: diagnosed, not fixed, and here is exactly why

The brief's framing was that the full log "runs to 08-04 only because the site
has not been regenerated since". That is right, and the cause is more specific
than "nobody ran it":

**Site regeneration is already wired into the game's deploy path — but only the
Stable one.** `whomp/bin/deploy-play.sh:311-368` regenerates, stages from the
generator's own `.site-outputs` manifest, commits and pushes, and treats a
failure as an incomplete release rather than a warning. That work is done and it
works.

**`whomp/bin/deploy-preview.sh` never publishes the site.** At lines 61-73 it
computes `SITE_DIR`, runs the generator into `mktemp -d`, and then `rm -rf`s the
output. It is a preflight that proves the generator still consumes the game, and
nothing more.

**And the cadence is now Preview-first.** `src/data/patchNotes.ts`'s header
records Kevin, 2026-08-04: Preview is the latest fully green build and the first
successful Preview publication on a new Vancouver date advances the patch
version; Stable is the weekly promotion. So most deploys now go through the one
path that refreshes nothing. 0.6.2 shipped to Preview twice on 2026-08-05; the
committed `log.html` carries a build stamp of `2026-08-04 19:32 UTC`. That is
the whole gap.

**The fix is roughly eight lines and it is in the game repo, which this lane may
only read.** `deploy-preview.sh` already has `SITE_DIR` and already invokes the
generator; it needs `deploy-play.sh`'s publish block (branch gate, real
`--outdir`, `.site-outputs` staging, commit, push) in place of the temp-dir
preflight, with the same non-fatal-to-the-game ordering. Owner: whoever holds
the game's deploy-tooling lane. Per `whomp/CLAUDE.md`, a deploy-tooling change
must update the shared guard/report scripts, their cross-runtime tests and
`docs/CLAUDE_CODEX_HANDOFF.md` in the same train.

**A site-side cron is not an available substitute.** `README.md` already lists
"The daily cron" under Not done yet, and `bin/deploy-site.sh`'s own comments
explain the shape: this repo has no `.github/workflows` and Pages serves a
branch directly. A workflow here would have to clone the **private** game repo
to run the generator, which needs a cross-repo token that does not exist today.
That is a real decision, not a missing line of YAML.

---

## Blockers hit, and why no regenerated site output is committed

I generated the site end to end and read `log.html` back. I am **not** committing
the regenerated output, and each reason on its own is disqualifying:

1. **The game's own artifacts are stale on `main` right now.**
   `node bin/tier-engine.mjs --verify` reports `STALE (published contracts)` and
   `STALE (fingerprint)`, and `wiki-visuals --verify` fails on
   `evolutions:goldReaver`. `src/data` moved after the last re-sweep — `c27dbaf
   merge(snow): the snow tier gets enemies of its own` landed after `80882cc
   chore(artifacts): re-fingerprint wiki visuals after the 0.6.2 note
   amendment`. `bin/generate.mjs` fails closed on this by design, so **the site
   cannot be regenerated from game `main` by anyone today**, and `deploy-play.sh`
   runs the same three gates, so a Stable publish is blocked on it too. This is
   pre-existing and independent of this lane. It is the most urgent thing in
   this report.
2. **This container's game clone is shallow.** 311 commits, and every authored
   date on `main` is 2026-08-04 or 2026-08-05. The full feed generated here is
   `77 player-visible changes ... across 2 active days` against the committed
   page's seven days. Committing that would have silently gutted the full log
   while fixing the concise one.
3. **The visual gate is not reproducible in this container.** It re-renders 321
   PNGs and compares bytes. This container's Chromium produces different bytes,
   and it needs `--no-sandbox` to start as root at all. Committing re-rendered
   assets would break the game repo's manifest pin.

To get real evidence anyway, I copied the game checkout to a scratch directory
outside both repos, pinned it at `3819cc98` (the last commit where
`data-layer --check` and `tier-engine --verify` both pass and 0.6.2's notes are
present), re-fingerprinted the visuals there for this container's renderer, and
generated into a scratch `--outdir`. **The game repo was not modified: no
commit, no branch, no file, no `node_modules`.** All scratch has been deleted.

---

## Verified vs assumed

**Verified by measurement or by reading the source:**

- Every row of the source-choice table above.
- `PATCH_RELEASES` parses to 8 releases, all with exactly 4 `keyChanges`.
- `notes/` held exactly one file, `2026-07-30.md`, dated six days before the run.
- The committed `log.html` build stamp is `2026-08-04 19:32 UTC` and its full
  feed ends at 2026-08-04; its concise pane held one `notecard-date`.
- The concise pane now renders 8 entries with the anchors, chips, counts and
  truncation lines tabulated above, read back out of the emitted HTML.
- 0 em dashes, 0 en dashes, 0 exclamation marks in the rendered concise pane.
- 35/35 tests pass; the 21 new ones are listed above.
- `deploy-play.sh` publishes the site; `deploy-preview.sh` deletes its output.
- Both artifact gates fail on game `main`; both pass at `3819cc98`.
- The shallow clone and its effect on the full feed.

**Assumed, and worth a second pair of eyes:**

- That `bugFixes` source order is close enough to authored priority for "show
  the first four" to be fair. It is the author's own ordering and the page says
  how many are hidden, but nothing pins it. If it turns out the important fix is
  routinely last, the cap needs a different rule, not a bigger number.
- That the neutral studio voice reads as intended. I read
  `notes/2026-07-30.md` and `docs/VOICE.md` for register and length, but voice
  is the one thing in this lane that no test can hold.
- `CONCISE_RELEASES_CAP = 24` is a judgement call, not a measurement. It is
  above the full view's 30-day reach on purpose, and is inert today at 8
  entries.
- That publishing the complete release history (back to 0.2.0) is wanted. It is
  what "one entry per release version" produces with nothing else said, and it
  makes the concise view a real record rather than a recent-news box, but it is
  more than the brief strictly asked for and is one constant away from being
  narrower.

---

## Residuals

1. **The stale game artifacts block every publish path.** See blocker 1. Not
   this lane's to fix, and nothing ships until it is. Owner: the game repo.
2. **The dev-log freshness gate is now armed against an obsolete failure.**
   `deploy-play.sh:67-102` refuses a Stable site refresh once the newest
   `notes/*.md` is more than seven days old with commits since. That gate
   existed because the concise view could go stale in silence. It no longer can
   — it regenerates from the release notes on every run — but the gate still
   measures authored notes only. `notes/2026-08-05.md` resets its clock, so
   **Stable publication is safe until 2026-08-12 and blocked from 2026-08-13**
   unless someone writes another note or exports `DEVLOG_OK=1`. The gate should
   move to measuring the newest *published entry* rather than the newest
   authored file. That is a game-repo change in the same train as the
   `deploy-preview.sh` fix above.
3. **Kevin's 2026-07-30 note declares `version: 0.5.0`, which is very likely
   wrong** (its content is 0.6.0's duel fixes; 0.5.0 shipped 2026-07-25 with the
   boss roster). While it says 0.5.0, the 0.5.0 release notes stay unpublished.
   I did not edit his note. Removing the `version:` line publishes both;
   changing it to `0.6.0` would hide 0.6.0 instead. His call.
4. **The 2026-07-30 note and the generated 0.6.0 entry overlap**, one day apart,
   both about the lifesteal and regen fixes. That is honest duplication rather
   than a defect: he wrote about it the day before the release was cut. Left
   alone deliberately.
5. **`fullChanges` is validated and discarded.** If a future reader wants a
   middle depth between four highlights and the raw git feed, it is sitting
   there parsed. Not built, because nobody asked for a third view.
6. **`node --test tests/` (directory form) fails on this Node version.**
   Pre-existing, not investigated, worked around with the glob form. Worth ten
   minutes from whoever owns the suite.
