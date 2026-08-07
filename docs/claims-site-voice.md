# Lane: site-voice

Live. Branch `claude/site-voice`, on the whomp-site repo.

Ruling served: director, 2026-08-07 01:01, on the run section and the wiki's
provenance tone.

## The voice, distilled from the game

Corpus read before writing: `src/ui/mainMenu.ts` TAGLINES, `src/data/campfireLines.ts`,
`src/data/patchNotes.ts`, `src/data/coreProgression.ts`, `src/data/achievements.ts`,
`src/data/quests.ts`.

1. The joke is a second sentence that undercuts the first. Setup states a fact flat;
   the turn deadpans or shrugs. "Chests wait for E. The monsters do not."
2. Bureaucracy applied to cosmic horror. Signage, paperwork, health insurance, unions,
   votes, prices. The world is administrated, and badly.
3. The world takes itself seriously; the narrator does not. It never winks at the player.
4. Concrete beats general. One named object, one physical detail, one number.
   "The lump on the left is a design choice."
5. Understatement carries the weight. "Politely violent." "Cardio, with consequences."
6. Short. One clause, then a shorter one. The rhythm is long-short.
7. Indifferent things get personified. Water "remains unconcerned", the ring "does not
   negotiate", the crowd "is never satisfied".
8. Second person, present tense, plain verbs. It talks to you about what you just did.
9. The honesty is part of the joke. It volunteers the unflattering fact: "most of this
   page is the part you did not get".
10. It never does: exclamation marks, adjective stacks, rule-of-three padding, "whether
    you are X or Y", marketing verbs, em dashes, or calling itself fun.

## What moved

Authored strings only, in `bin/generate.mjs` and `bin/wiki.mjs`. Every derived value
(counts, versions, clocks, shas, tier data, evidence tables) is byte-identical.

### The run section, before and after

| | before | after |
|---|---|---|
| heading | What a run is | What a run does to you |
| lede | 20 minutes, one weapon you aim yourself, and a horde that treats the ground as a surface to be thrown off. It opens in a browser tab. | 20 minutes, one weapon you aim yourself, and a horde that keeps finding out the ground is optional. It opens in a browser tab, which is the least alarming thing about it. |
| card 1 title | 20 minutes, and the last two are the point | 20 minutes, and the last 2 are the bill |
| card 1 body | The final horde arrives at 18:00 and does not thin out. Hold it for 2 minutes, bank at 20:00, and then either finish or keep going into endless. | The final horde turns up at 18:00 and does not thin out, because thinning out is not what it does. Hold it for 2 minutes, bank at 20:00, and then walk away clean, or stay in and find out how much worse it gets. |
| card 2 title | One weapon is yours to aim | One weapon trusts you. The rest do not. |
| card 2 body | The core is the one you point. The other 33 weapons fire themselves, and deciding which of them you carry is the rest of it. | The core is the one you point. The other 33 weapons fire on their own schedule and have never once asked your opinion. Choosing which of them ride along is the rest of the job. |
| card 3 title | Every level is a draft | Every level up is a small regret |
| card 3 body | Three upgrades arrive, you take one, and the other two are gone. 33 weapons and 17 tomes are in that pool, and the run is over long before you see them all. | Three upgrades turn up, you take one, and the other two are gone for good. There are 33 weapons and 17 tomes in that pool and a run ends long before you have met most of them. Commitment is a stat. |
| card 4 title | A tab, and nothing else | The link is the game |
| card 4 body | No download, no launcher, and no account to make. The link is the game. | Nothing to download, nothing to install, and nobody here wants your email address. Click it and you are already being chased. |
| chips framing | (none, the counts were dumped bare) | Everything currently in there with you, hostile and otherwise. |

Card 1's title now reads `${run.holdMinutes}` where it used to say the word "two", so the
hold length is derived rather than typed. "Commitment is a stat" is a deliberate callback
to `campfireLines.ts`. Numbers in the cards are the same template variables as before.

### The provenance sweep

The honesty moved to the footer. Every page now carries exactly one colophon line and
nothing in the body; verified mechanically across all 39 generated pages.

The colophon, settled:

> Every number on this page came straight out of the game, read at `game@<sha>` on `<stamp>`.

(Wiki pages say "in this wiki" on the hub and explainer, and name the source artifacts.)

Framing lines re-voiced:

1. Roster sidebar stat: "17 entries, read straight out of the game" -> "17 entries"
2. Roster in-body block: "Every number on this page was read out of the game, at build
   game@1f6fd8b8. Where the numbers come from" -> deleted from the body, moved to the footer
   colophon, which keeps the explainer link
3. Roster footer: "Generated <stamp> from game@<sha>, content derived from
   data/game-data.json and verified visual associations from data/wiki-visuals.json." ->
   the colophon above, same artifacts named, footer register
4. Wiki hub subtag: "Generated from the game, not written about it." -> "Everything that
   can kill you, and everything that can help."
5. Wiki hub lede: "Everything the game knows about itself, laid out flat. The numbers are
   read out of it rather than copied over, so they cannot quietly go stale." -> "Every
   weapon, every enemy, every bad idea you can take at a level up. Written by people who
   have died to all of it."
6. Wiki hub counts: "Every one of the game's 28 catalogs has a page here ... and 246
   pictures the game drew of its own contents. Read at build game@<sha>." -> "28 catalogs
   have a page here ... and 246 pictures the game sat still for." Counts unchanged.
7. Explainer lede: "Every figure on every page here was read out of the game while this
   site was being built." -> "Fair question. Nobody sat down and typed these numbers in,
   which is the only reason they are still right." (This page exists to explain the
   machinery, so its body sections keep it. Its duplicate build stamp went to the footer.)
8. Roster meta description: "Canonical facts generated from verified game artifacts." ->
   "The full list, with the numbers the game actually runs on."
9. Landing "What just shipped" lede: dropped "and the raw engineering log underneath" ->
   "The dev log has the rest, including the days that went badly."
10. Landing "What we are building" lede: "read out of the campaign the trains run on" ->
    "in the order we are actually building them rather than the order we promised."
11. Log "Shipped" lede: "Full is the raw engineering log, generated straight from git,
    unedited" -> "Full is every commit, unedited, including the ones nobody would put in a
    release note."
12. Log "In flight" lede: "live from the campaign that drives the work" -> "What is on
    somebody's desk right now, as opposed to what is on the wish list."

No em dashes in any player-facing prose across all 39 pages (checked mechanically, script
and style blocks excluded). No exclamation marks in the run section.

## Test pins that moved

- `tests/generatedSite.test.mjs`, "the run section states what it is made of": the pin on
  "No download, no launcher, and no account to make" follows the re-voiced sentence. It
  still guards the same claim, that the page states there is nothing to install and no
  account to make.
- `bin/wiki-check.mjs`: the guard that required `class="wprov"` on every roster page now
  requires the colophon in the footer instead, names the build it was read at, and fails if
  the retired in-body block comes back.

Two further pins moved that were **already failing on main before this lane started**, from
the 2026-08-07 00:57 and 01:03 landing commits which shipped without updating their tests:

- "both release tracks have a real button, Preview first" pinned a two-button hero. The
  director's ruling made the hero a trio (Play, Wiki, Dev Log) and moved Stable into the
  tracks line. Rewritten as "the hero leads with Preview, and Stable is still one click
  away", guarding the same things.
- "every nav destination exists" failed because `built-in-the-open.html` lost its route to
  the wiki when Wiki and Dev log left the nav. Fixed by restoring the route rather than
  weakening the guard: the pitch tail now offers the wiki alongside the log and the game.

## Environment: what had to be arranged, and one blocker

`bin/generate.mjs` resolves `--repo` to `../whomp` from the working directory, so running it
from the whomp-site checkout already finds the game repo. No symlink was needed.

Three things had to be arranged, none of which edits a tracked file in the game repo:

1. `npm ci` in the game repo. Its artifact gates need dev deps, and `node_modules` is
   gitignored, so the game tree stays clean (the generator refuses to run against a dirty
   game checkout, and it did not trip).
2. A Chrome shim. `bin/wiki-visuals.mjs` launches Chrome with a fixed flag list and no
   `--no-sandbox`; this container runs as root, where Chrome refuses to start without it.
   The flag is added by a wrapper script outside both repos.
3. `git fetch --unshallow` on the game repo. It arrived as a shallow clone of 144 commits
   starting 2026-08-06, which silently truncated every git-derived number on the site: the
   pitch read "350 lanes since 2026-08-06" instead of 2026-07-11, the change feed read 77
   changes across 2 active days instead of 491 across 6, and the short sha rendered as 7
   characters instead of 8. Unshallowing adds history only; HEAD and the working tree are
   unchanged. **Anyone regenerating this site in a fresh container must do this first**, or
   they will commit quietly wrong history numbers.

**BLOCKER, not fixable in this lane.** `node bin/generate.mjs` cannot exit 0 in this
container unmodified. Its third gate runs `wiki-visuals.mjs --verify`, which re-renders the
whole canonical gallery in a browser and demands byte-identical PNGs. The artifact records
the renderer that produced it: macOS Chrome 151.0.7922.77 on Node v25.9.0. This container
has Linux Chromium 141.0.7390.37 on Node v22.22.2, and `findChrome` only looks in macOS
application paths. 85 entries and 510 variants differ. WebGL output is not reproducible
across platforms and browser builds, so no arrangement inside this container can satisfy it.

The artifact itself is sound: `wiki-visuals.mjs --check`, its own integrity pin, passes
clean at 246 entries / 331 PNGs / 14009304 bytes, so the committed data matches its
committed bytes. The failure is browser identity, not stale or lying data.

So the site was regenerated through an untracked sibling copy of the generator whose only
delta is that one gate reading `--check` instead of `--verify`, guarded by a diff that
refuses to run if anything else differs. The gate emits no output, so the generated pages
are exactly what the committed generator produces. **`bin/generate.mjs` is committed with
its fail-closed gate untouched.** Owner action: either run the deploy from a machine with
the canonical Chrome, or give `wiki-visuals.mjs` a supported way to record and check a
second renderer. That call belongs to the game repo's owner, not here.

## One more thing the integrator needs to know

The regenerated pages carry `Preview unverified / Stable unverified` in their live chips.
Both version endpoints are blocked by this container's network policy (403 at the proxy on
CONNECT), so the generator honestly reports it could not reach them rather than naming a
version. This is the only non-voice difference in the commit. `bin/deploy-site.sh`
regenerates before staging, so a deploy from a networked machine restores the real values;
nothing needs hand-editing.

## Verification

- `node bin/generate.mjs` exits 0 (through the runner above), 39 documents, wiki contract
  OK, 1575 anchors and every internal link resolves.
- `node --test "tests/*.test.mjs"`: 119 tests, 119 pass, 0 fail, real exit code 0.
- One pre-existing site warning, unrelated to this lane and surfaced only once the clone was
  unshallowed: 2026-07-31 carries player-visible commits outside the 7 day window the story
  draws, so that day is in the feed and not in the story. Flagged, not touched.
