# whomp-site

The public WHOMP page: a short pitch (`index.html`), the real development log
(`log.html`), how the thing gets made (`built-in-the-open.html`), and the wiki
(`wiki*.html`).

## Four surfaces

- **`index.html`** is the short public landing page. Four sections, and every
  fact on all four is derived: a hero with one play button per release track, a
  section that says what a run actually is, the newest release lines, and what is
  being built next. It is deliberately small. It does not grow into the log.
- **`log.html`** is the real dev log. It opens with the day by day story, then
  the two views of what shipped, then known bugs and what is in flight.
- **`built-in-the-open.html`** is the pitch: how WHOMP gets made, said to
  somebody who does not work here. It is the only page whose copy is written
  rather than derived, and every claim on it is pinned to a rule in the game
  repo. See "The pitch, and why it cannot quietly become false" below.
- **`wiki.html`** plus one page per roster is the wiki. Every value on it is
  generated from the game's own registries. See "The wiki" below.

All four carry Open Graph and Twitter card tags, so a link to any of them
unfurls as something rather than as a bare URL. The card image is the canonical
`public/icons/icon-512.png`, copied byte-for-byte from the game at build time
exactly as `whomp-icon.svg` is, and the card type is `summary` to match it. A
screenshot was the alternative and was not taken: a hand-taken hero shot on a
landing page for a build that moves most days is a promise about a version that
shipped weeks ago.

### The landing page

Nothing on it is typed twice.

| What it says | Where it read it |
|---|---|
| The length of a run, the final horde, the hold | `runModes.classic` in `data/game-data.json` |
| Worlds, enemies, characters, cores, weapons | the domain counts in the same artifact |
| Both play button URLs | `src/core/releaseChannel.ts`, the audited channel table |
| What each track is serving | each track's own `version.json`, measured at build time |
| The five newest release lines | the same `conciseShown` array `log.html` renders |
| The arcs | `docs/CAMPAIGN.md` |
| What is coming | `docs/train/WISHLIST.md`, joined to authored lines |
| The tagline rotation | `src/ui/mainMenu.ts` `TAGLINES` |

**A run is twenty minutes, not twenty eight.** `docs/GAME_SPEC.md` still opens
its run-structure section with "28-minute Classic runs". The registry the game
actually plays on banks at `bankAtElapsedSec: 1200`, and the wiki has been
publishing 20:00 and 18:00 off that same artifact for weeks. The landing page
derives from the registry, and `tests/generatedSite.test.mjs` cross-checks the
figure it printed against the clock on `wiki-modes.html`, because two surfaces of
one site disagreeing about the length of a run is the exact drift this repo
exists to prevent. The spec doc is the thing that is stale.

**What is coming is derived rows joined to authored lines.** The rows come from
the game's own wishlist, which is what makes the section retire itself: a want
leaving that queue removes its teaser with nobody remembering to, and a teaser
for work that already shipped is worse than no teaser. The lines are authored in
`PIPELINE_TEASERS` in `bin/landing.mjs` for the same reason the backlog blurbs
are authored: the row titles are lane names, several of them are defect reports,
and a page that publishes those has published an engineering backlog to
strangers. A want with no line is skipped and counted, never guessed at.

**Neither play button carries a verdict.** The old chip compared the live Stable
sha against the sha the site was generated from and lit a gold "a deploy is
pending" dot whenever they differed. They differ by design, so it was on
permanently, at the top of the page, and a permanent warning is wallpaper. Each
track now states the version it is serving and the build that came from. The dot
means measured or not measured, which is the only binary state that exists here.

## The day by day story

`log.html` opens with one card per calendar day over the same seven-day window
the full feed covers, newest first, **including the days nothing shipped on**.

The two views underneath it are both lists, and neither could answer "what
happened yesterday", because neither has a day in it that nothing landed on. A
stranger who followed somebody else's link is not looking for a changelog.

`bin/devlog.mjs` composes it, and it inherits the law `bin/patch-notes.mjs` is
built on, unchanged:

> This file never writes a sentence about the game.

What it composes are sentences about the **shape** of a day, from counts it
read: `132 changes landed: 88 new, 41 fixed, 3 performance.` Those are facts
about the log, not claims about the game. Anything that is a claim about the
game arrives already written by a person, and is quoted: the release headline
out of the game's own patch notes, or a line out of the game repo's nightly
file. A generator that cannot compose a sentence about the game cannot compose
a wrong one.

**The quiet days are the honest part.** A feed built only from days that had
commits reads as though every day had commits, which is the same class of
untruth as a trailing window that reads like a lifetime total.

**An entry dated a day is not a release cut that day.** A hand-written note
carries the date it was *written*, and `notes/2026-07-30.md` declares `0.5.0`,
which shipped on the 25th. So the sentence that counts releases counts only
entries whose version the game's own patch notes date to that exact day. Every
entry keeps its link regardless: a link is about where to read more.

### `docs/train/nightly.md`, when it exists

The game repo's overnight train has no nightly file yet. The reader is written
for that: a missing file yields nothing, and the site does not change on the
night one appears.

The contract is the shape `docs/train/autoland-*.md` already writes in, so a
nightly file is a rename away rather than a new discipline:

```markdown
## 2026-08-06 04:45 autoland
- The snow worlds got their own enemies.
```

A level-two heading carrying an ISO date, anything else on that line ignored,
lines underneath it. Several headings may carry the same date; a night that ran
twice is still one night.

**A line is published only if a stranger could read it.** Every nightly line
written so far names branches, files, commits and machinery, because it was
written for the person running the train, and publishing it verbatim is the
same mistake the known-bugs section already refused: raw internal text on a
public URL, shipped because it happened to be nearby. A line is refused for
quoting code, naming a branch, a file or a commit, naming the machinery
(`docs/VOICE.md` rule 12), breaking house law on dashes and exclamations, or
not finishing its sentence. Refusals are `SITE NOTE`, never `SITE WARNING`:
that prose belongs to the game repo and this one does not rewrite it.

`lane`, `gate`, `track`, `build`, `release`, `preview` and `stable` are
deliberately **not** refused. They are the words `built-in-the-open.html`
exists to teach, the site already prints them in public copy, and refusing them
would refuse the only nightly lines worth publishing.

## The pitch, and why it cannot quietly become false

`built-in-the-open.html` explains the gated train itself: lanes, gates, guards,
the two tracks, and what a lane that stops is worth. It is the reason to follow
the project rather than a record of it, which is why it is a page with its own
card and not a section of the log.

Every other page here derives its copy, and that is why none of them can rot.
This one cannot work that way: "work goes out in lanes" is a process, and no
amount of parsing turns a process into a sentence a stranger would read.

**So the sentences are written and the right to print them is derived.** Each
claim in `PITCH_PINS` (`bin/pitch.mjs`) names the file in the game repo that
makes it true and the patterns that must still be found there:

| The page says | Because the game repo still says |
|---|---|
| A lane writes down which files it may touch first | `docs/CLOUD_LANE_RULES.md`, the claims rule |
| Two lanes are never handed the same file | `AGENTS.md`, one writer per path |
| A run of tests that reported nothing is a failed run | `docs/CLOUD_LANE_RULES.md`, zero tests is a FAILURE |
| A new check must be made to fail on purpose | `docs/CLOUD_LANE_RULES.md`, the negative-test rule |
| Accounts, saves and the deploy get an outside reader | `AGENTS.md`, independent reviewer |
| A lane that disproves its own job has finished | `docs/CLOUD_LANE_RULES.md`, the correct negative |
| Green builds go to Preview, Stable is promoted | `AGENTS.md`, the publication contract |
| Nothing ships without a person naming that build | `AGENTS.md`, publication approval |

A rule that moves stops matching, the claim is **dropped from the page**, and
the run raises a `SITE WARNING`. That is the opposite severity from a stale arc,
and deliberately: an arc's prose belongs to the game repo, a pitch sentence is
this repo's prose about the game repo's rules, so the one-line fix is here.

The patterns are matched with **whitespace collapsed**, which is load-bearing
rather than tidy. Both source docs wrap prose at about eighty-eight characters,
so two of the fourteen quotations straddle a line break in the file. A per-line
matcher finds twelve and calls the other two missing, which is the identical
defect that ended two campaign arcs on a comma.

The one number on the page counts **lanes**, not commits: commits are already
counted twice elsewhere here and a third count of the same thing proves nothing
new. One retired claims file is exactly one merged lane, because the game repo's
own `docs/claims/README.md` makes retiring part of the merge and makes a reused
slug non-overwriting. It states a count and a date and no relative anchor, since
"N days ago" is computed at build time and wrong from the second generation on.

## Two views inside the log

- **Concise** (default) is one entry per release version, generated from the
  game repo's `src/data/patchNotes.ts`. A machine still cannot pick highlights,
  so it does not try to: every word in a generated entry was written by a person
  for players when the release was cut, and already ships in the title screen's
  WHAT'S NEW panel. An authored `notes/<date>.md` replaces the generated entry
  for that day, completely.
- **Full** is the generated feed straight from `git log`, labelled honestly as
  the raw engineering log. Nothing is cleaned up for the reader.

### The concise view has no approval step, on purpose

Director change 2026-08-05: *"i would like a system where i do not have to
approve the drafts. if we can get the voice right and convey the release info
that is the goal. i do not want too many additional systems to maintain
manually and the value is not there for this yet."* So there is no queue, no
review UI, no draft state and no "unreviewed" badge (with no review path a
badge would be permanent and would read as an apology on every entry).

What makes an unreviewed publish safe is that **the generator never writes a
sentence about the game**. `bin/patch-notes.mjs` parses, validates and refuses;
`bin/generate.mjs` escapes, groups and frames. Every claim a visitor reads was
authored in the game repo. A generator that cannot compose a sentence about the
game cannot compose a wrong one.

The noise guard that `notes/*.md` used to provide did not vanish, it moved
upstream and is now enforced on both sides:

- `keyChanges` is capped at four per release by the game's own
  `tests/patchNotes.test.ts`, **and independently by `KEY_CHANGE_CAP` in
  `bin/patch-notes.mjs`**, which fails the site build rather than growing a
  fifth highlight if the game repo ever raises its cap.
- `bugFixes` is not capped at the source, so the site shows the first four and
  says how many more shipped. Never a silent truncation.
- `fullChanges` (the exhaustive shipped ledger, seventeen entries on 0.6.1) is
  read for shape validation and then deliberately dropped. Rendering it would
  rebuild the full log with fewer words and kill the view.
- A parse that yields zero releases is an **error**, not an empty list. A
  concise view that renders nothing reads to a visitor as "nothing shipped".

The log also carries a **known bugs** summary (aggregate only: fixed/open
totals, a breakdown by player-facing area, a severity shape, all counts
derived from the game repo's verified `docs/BUG_INVENTORY.md` OPEN table) and
an **in flight** section (the campaign arcs plus a few backlog teasers), and a
small generated **search index** covering all of it.

### Known bugs is aggregate only, on purpose

Director change 2026-07-30: publishing a tester's own report text verbatim on
a public URL is a different thing from publishing a changelog, and testers did
not sign up for that. So the public page never gets per-report text, ids, or
quotes, only counts: total fixed, total open, a breakdown by area (world and
hub, combat, multiplayer, interface, performance, audio) and a severity shape,
plus one or two authored sentences in the site's voice. The area and severity
buckets are derived by a keyword classifier over each report's own text in
`bin/generate.mjs` (`classifyBugArea` / `classifyBugSeverity`), never by a hand
list of report ids mapped to a category, that is exactly the staleness failure
this project already got burned by once (CAMPAIGN's old STANDING DEBTS list).
`search-index.json` gets one aggregate entry for the bugs section too, never
per-report text, because it is a static file fetched without auth by anyone
regardless of sign-in state.

An **owner-only** view of the full per-report detail exists in the generator
(`ownerBugSection` in `bin/generate.mjs`) but is built dark: while
`GATING_ENABLED` is `false`, the generator does not even construct that
section's HTML, so there is nothing in `log.html` or `search-index.json` to
hide with CSS, it is genuinely absent from the payload. See the comment on
`GATING_ENABLED` and on `ownerBugSection` for how it turns on later and the
real caveat about static hosting once it does.

## Gating

Director change 2026-07-30: the log is **public** for now, no sign-in required
to read it, so early testers can just reach it. The sign-in control (reused
from the game's accounts worker) still works on both pages. A single
`GATING_ENABLED` switch at the top of `bin/generate.mjs`, off by default,
drives both the runtime switch in `log.html`'s own script (which already
wraps the page's content in a `.gated-section` ready to hide behind sign-in)
and whether the owner-only bug detail section gets generated at all. See the
comment next to that constant.

## Why it is a separate repo

The game's net handshake compares build sha **exactly** (`src/net/version.ts`), so
any deploy to `whomp-play` locks out every peer who refreshes out of step with their
friends. If the site lived in the game repo, editing a paragraph would bump the
game's build sha and could break a live co-op or duel session. It lives here so a
site change can never delay, break, or invalidate a game deploy.

## Generated spine, authored highlights

`bin/generate.mjs` derives everything factual from the game repo at build time:

- the shipped-changes feed, from `git log` on `main`, filtered to player-visible
  conventional-commit types (`feat` / `fix` / `balance` / `perf` / `style`)
- the live build sha, fetched from the deployed `version.json`, which is the only
  proof of live under the deploy-verification law
- the arcs, parsed from `docs/CAMPAIGN.md`, which is the file that actually drives
  the work, so there is no second roadmap to drift
- the concise log's release entries, parsed from `src/data/patchNotes.ts`, whose
  headline and highlights are hand-written for players at release time

It only ever **reads** the game repo. The machine is still not trusted to say why
something mattered; it is trusted to carry across what a human already said.

```bash
bin/regenerate-and-verify.sh                          # rebuild everything, then prove it
node bin/generate.mjs --repo ../whomp                 # writes every page + search-index.json
node bin/generate.mjs --repo ../whomp --offline       # skip the live sha fetch
bin/deploy-site.sh                                    # regenerate and push to GitHub Pages
```

The page says so plainly when it could not reach a track, rather than inventing
a sha.

## Keeping the site true

The generator has always refused a lot: stale artifacts, dead links, a concise
view with holes in it, a wiki contract that moved. What it could not refuse was
**text going quietly out of date**, which is the failure this site actually has.
The landing page printed `A3 · Wed 7/30` for a week after that Wednesday, ended
two of its nine arcs mid-sentence, and carried a permanent stale dot. Every
generation in between exited zero and reported success. Nothing was broken.
Everything was stale.

`bin/regenerate-and-verify.sh` is the answer, and it is one command:

```bash
bin/regenerate-and-verify.sh              # against ../whomp
bin/regenerate-and-verify.sh --offline    # no network, tracks report unverified
```

Four steps, stopping at the first failure. It says how old the committed pages
were before this run touched them, regenerates every surface, reads what the
generator said about itself, then runs the whole suite including
`tests/generatedSite.test.mjs`, which reads the files just written and checks
them the way a reader would. It never pushes; publication stays
`bin/deploy-site.sh`, with its own branch guard.

**Step 1 cannot fail, and is not decoration.** The dev log now prints one card
per calendar day under the words "the last 7 days", and the only thing that
makes that sentence false is nobody running this. So the run reports how far
behind the committed story had drifted before it fixed it, which is the
measurement of whether the daily hook below is really wired. Step 4 is what
refuses a published window that no longer reaches today, and by then this run
has already repaired it.

### What the drift tests refuse

Every one of these was fired on purpose before it was believed, which is the
game repo's own rule for a new guard and the reason it is worth writing down:

- a card, a story day or a pitch paragraph that ends mid-sentence
- a schedule on the landing page that has already happened
- a story with a hole in its run of days, or two days out of order
- a story whose newest day is old enough that its own window has gone by
- a day whose tally chips disagree with the sentence beside them
- a story that shows a different number of days than its lede claims
- a pitch that lost its pinned claims, its scale, or grew a relative anchor
- a page that names a file, a branch or the machinery to a reader
- an em dash anywhere a visitor can read, an exclamation on either page whose
  copy is written here
- a missing social card, a mark drawn twice, a nav link to nothing

### Two severities, and the split is the point

| | Meaning | Gate |
|---|---|---|
| `SITE WARNING` | the page is wrong or incomplete, and the fix is one line someone can open today | **fails** |
| `SITE NOTE` | true, worth saying, owned upstream | passes |

An arc dropped because its sentence trails off is a warning. A teaser for a want
that has left the wishlist is a warning. A claim on the pitch page whose rule has
moved in the game repo is a warning, because that sentence is this repo's prose
and so is the one-line fix. An arc whose own description contains
last Thursday is a **note**, and so is a nightly line held back for naming a
branch: it is real rot, and the fix belongs in the game
repo, because this repo refuses to rewrite the game's roadmap prose. A gate that
is red on its first day for something the lane cannot fix teaches everyone to
ignore it, which is the same defect as the permanent stale dot, arriving from the
other direction.

### Two hooks the integrator should wire

Neither is wired from here: `bin/deploy-play.sh` and the overnight tick live in
the game repo, and this repo only ever reads it.

**1. Per deploy.** `bin/deploy-play.sh` already regenerates the site as part of
release closure, passing `--sha`/`--version` so the fresh build is not raced
against CDN propagation. That call must not change. Add verification after it,
non-fatal for the same reason the whole refresh block is non-fatal, so a site
hiccup can never read as a failed game deploy:

```bash
(cd "$SITE_DIR" && node --test tests/*.test.mjs >/dev/null 2>&1) \
  || echo "WARNING: whomp-site drift tests failed after the refresh; run bin/regenerate-and-verify.sh there" >&2
```

**2. Once a day, whether or not anything shipped.** This is the half a deploy
hook cannot cover, and it is the half that caught the July dates: those went
stale because a Wednesday passed, not because a commit landed. A site that only
regenerates on deploy is exactly as stale as the last deploy.

```bash
cd /Users/kevin/whomp-site && git checkout main && bin/regenerate-and-verify.sh && bin/deploy-site.sh
```

`bin/deploy-site.sh` exits 0 with "site unchanged, nothing to deploy" on a day
when nothing moved, so running it every night costs one commit only when there is
something to commit.

## The wiki

`bin/wiki.mjs` builds a categorized hub plus one generated guide for every public
domain in the schema-9 game-data contract. Three additional guides expose the
root permanent-power soft knees, controlled automatic-weapon tiers and measured
pair/build search paths. Their current route, catalog, row and pair counts are
reported by the generator from the verified artifacts; none are maintained in
this document.

The module is imported by `bin/generate.mjs`, so there is still one entry point,
one palette, one accessible cross-site search index and one output manifest. It
is separate only because it grows per guide while the generator grows per
dev-log feature: two different reasons to change.

The leading wiki-navigation mark is copied byte-for-byte at build time from the
game's canonical `public/icons/icon.svg`. Wiki pages do not redraw it and do not
repeat it in their content header; the single icon is an accessible link back to
the wiki hub on both desktop and narrow layouts.

**Every factual value or game-art association comes from one of three verified game artifacts:**

- `data/game-data.json` owns the public catalogs, their relations, the
  player-owned WHOMP runtime contract, enemy speed policy, aimed-core
  forgiveness profiles, Shrine movement activation contract, encounter cadence,
  authored character-input semantics and global power ceilings.
- `data/tier-rankings.json` owns controlled automatic-weapon evidence: fixture
  definitions, source fingerprints, samples and spread, exhaustive pairs,
  damage attribution, unlock requirements and measured greedy build paths.
- `data/wiki-visuals.json` owns the complete canonical visual inventory and the
  ID-to-art association. It records source/content fingerprints, provenance and
  licensing classification, meaningful alt text, intrinsic dimensions, hashes,
  responsive portrait variants, isolated render context, limitations and an
  aggregate byte budget. The site never maintains a second visual ID map.

Before reading the files, the site generator runs each game artifact owner's
freshness/authentication command (`data-layer --check`, `tier-engine --verify`
and the visual pipeline's full `wiki-visuals --verify` rerender comparison). It then
runs `bin/wiki-check.mjs`, which mutation-tests the coverage guard and proves
that every domain, route, card, anchor, hub card and search entry reached the
generated output. It also proves that every covered entry renders the correct
visual, copied PNG bytes match their source hash and dimensions, responsive
variants and loading priorities are sound, alt/provenance/limitations remain
visible, and stale or orphaned visual files are retired. An unclassified domain,
stale schema, missing displayed field, misowned ultimate, incomplete fixture or
source fingerprint, invalid loadout, hidden volatile tier span, broken visual,
dead link or retired on-disk route stops the build before deployment. Search
kinds, skip targets, breadcrumbs, facet labels and the compact mobile navigation
are part of the same output contract. Displayed-field guards cover entry values,
independently owned relation backlinks, conditional payloads and route-level
runtime semantics. Mutation probes delete representative scalar, conditional,
relation and root-contract values so those guards are known to fail closed.
Search entry cards are programmatically focusable: a same-page hit reveals and
focuses its card, while load/hashchange focus is restricted to valid `#e-*`
entry targets and never takes focus for unrelated fragments.

The route retained as `wiki-ultimates.html#e-whomp` is titled **WHOMP Ultimate**.
Its player ownership, Q slot and standard-player-run availability come from
`domains.ultimates.runtime`. The artifact separately documents campaign,
headless and co-op player-seat arming, unconditional hub preview, duel and bot
kit policy, plus exact runtime provenance; boss reaction code is explicitly not
treated as ownership.

`wiki-shrine-movement.html` is the complete five-entry live movement-offering
pool for qualifying normal world-shrine activations. `wiki-blessings.html`
documents only the blessing-trio registry, including the legendary-replacement
boundary. The stable `wiki-jump-augments.html` route is explicitly a two-entry
legacy card/progression alias catalog and links each alias to its live Shrine
movement entry; it is an alias surface rather than an acquisition rule or a
complete live pool.

Character weapon ids are presented as **suggested weapons**, following
`characters.runtime.weaponIdentity`; standard solo campaign starts with the
aimed core only. Character health, speed and might use their exported runtime
roles rather than pretending the authored tuple is three final comparable
stats. Run-mode opening HP is labelled **Opening enemy HP bonus**, scoped to
ordinary SpawnDirector waves, with exclusions plus the structured 3:00 pace /
1:48 unified-profile elapsed fade shown separately. World and expedition pages
combine authored tables with automatic-miniboss cadence evidence, but repeat the
artifact limit that identity and actual spawn time are not exported.

Canonical visuals are copied into generated `wiki-assets/` paths. Runtime
portraits are deterministic isolated production renders with transparent
backgrounds, an explicit neutral presentation palette or renderer-owned
materials, fixed gallery lighting/camera and a named neutral frame. The UI calls
them renders, never sprites or in-game screenshots. Palette strips and evolution
compositions are labelled as authored/derived media rather than gameplay
captures. Controlled-sim pages use canonical weapon glyphs and data-native
P10/median/P90 plots with units, sample size and local-scale limitations.

The authored half is small and it is about **meaning, never magnitude**. This
repo may explain what `pierceLine` or `clip` means, because the data layer ships
an enum and a reader needs a sentence. It may not state a damage figure, a fire
rate or a spawn time that it did not read out of the artifact.

### What the pages deliberately do not say

The interesting half of the work. Each roster page carries its own note about
this, because a wiki that just omits a column reads as incomplete, while one
that says "this number exists and here is why printing it would be a lie" reads
as trustworthy:

- **No DPS.** Damage is multiplied by the player's might and crit and the
  interval divided by their attack speed, and half the patterns have no
  "damage times shots per second" semantics at all.
- **No final enemy chase speed.** For basic and special enemies, the wiki
  publishes the authored base and profile-gated live-run base from
  `bandedEnemySpeed()`. The latter still precedes timed and per-instance scaling,
  so it is labelled as a base.
- **No boss or miniboss health, damage, behavior or speed.** Those contextual
  encounter mechanics remain explicitly UNMEASURED because runtime authority is
  private, multi-stage and mode-dependent; partial registry values are not shown.
- **No core weapon combat numbers.** Every clip size, reload and multiplier is a
  module-private constant in the game's combat code. The nine-field aim and
  forgiveness profile is published because schema 9 exports and pins it;
  those fields describe targeting generosity, not damage strength.
- **No core evolutions.** `coreWeapons.ts` carries an `evolutionName` per core
  and the game's own picker advertises it, but nothing implements it.
- **No made-up core-weapon, tome, relic or character tiers.** The evidence
  artifact names those as uncovered and explains why; only measured automatic-
  weapon axes are ranked. These pages call their results controlled simulation,
  not whole-run or human-play meta.
- **No holdout claim for greedy build paths.** Candidate selection and reported
  performance use the same deterministic cohort. The artifact's explicit
  same-cohort selection-bias/no-holdout limitation is printed on the build
  route, so those paths remain measured fixture searches rather than validated
  live-play recommendations.
- **No computed effective permanent power.** The four exported soft-knee dials
  are shown exactly, but the artifact does not contain a build's inputs and
  temporary buffs apply after those curves.

Times ARE converted into minutes of real play, because the conversion is
derivable: spawn and boss schedules are measured on the game's pace clock, and
every run mode's `paceScale` is in the artifact. The generator refuses to
convert if the modes ever disagree or a value sits past the pacing bank, and
prints the raw schedule figure instead.

### Adding a guide

1. add an entry to `rosterSpecs()` in `bin/wiki.mjs`
2. write its `card(e)`
3. that is all

The page chrome, filter bar, sort control, comparison meters, search entries,
categorized sidebar, hub card, source-coverage contract and cross-link check are
all driven off that one object. A new public domain fails generation until a
guide explicitly classifies it. Neither deploy script needs a filename change:
they stage from the manifest the generator writes.

### The output manifest

`bin/generate.mjs` writes `.site-outputs`, a plain list of the files it just
wrote plus any tracked generated wiki route or visual it retired, and both
deploy paths stage from it. Visual variants use safe lowercase nested paths
under `wiki-assets/`; absolute paths, traversal and unsafe segments are refused
independently by generation and deployment. A missing tracked path is
intentional here: `git add -- <path>` stages that output's deletion so an old
page or image cannot survive after leaving the artifact. Tracked generated
paths are enumerated from Git even when a prior interrupted generation already
removed the file, so the next manifest still carries the pending deletion. The
manifest is gitignored because it is a build-time handoff rather than site
content.

This replaced a hand-typed filename list that appeared in **two repos**
(`bin/deploy-site.sh` here and `bin/deploy-play.sh` in the game). That was
correct for exactly as long as the site had three files. Once the wiki added
pages, a hand-typed list would have kept refreshing the dev log while silently
never refreshing the wiki, with the deploy still reporting success. Staging is
still explicit and still never a wildcard add; it just is not a list anybody has
to remember to update.

## Palette

Settled by the director and narrow on purpose. The two references are both in-game
surfaces: the **app icon** (`public/icons/icon.svg` in the game repo) and the
**title screen**. Both live on dark, both carry the WHOMP sweep at full saturation.

- ground `#06040e`, lifted `#1e0e2a`, outline `#151023`
- pink `#ff2f7e`, cyan `#24f0ff`, violet `#b14bff`, gold `#ffcf3f`
- wordmark face is cream `#fff3cf`, not white

The chromatic offset trio from the icon (cyan right-and-down, pink left-and-down,
cream face on top, flat offsets with zero blur) is the signature and is carried onto
type via `.chroma`.

Candy pastels and four pink-free alternatives were rejected. Do not desaturate the
pink or the cyan, and do not replace the pink; it is load-bearing in the blend.

## Not done yet

- The daily cron: today `bin/deploy-site.sh` is run by hand. The per-deploy
  refresh is done, folded into the game's `bin/deploy-play.sh` and non-fatal
  there by design, so a site hiccup can never read as a failed game deploy. The
  command the cron should run now exists and is verified (`Keeping the site true`
  above); what is missing is the scheduler entry, which lives in the game repo.
  **This is now the most load-bearing gap in the repo.** The day by day story
  publishes a window anchored to the day it was generated, so a week without a
  run puts a page in front of readers whose central sentence has entirely gone
  by. `bin/regenerate-and-verify.sh` reports the drift on every run and the
  drift suite refuses a window that no longer reaches today, which makes the gap
  loud. Neither makes it close.
- `docs/train/nightly.md` does not exist in the game repo. The story reads it
  when it appears and needs no site change on the night it does. Until then the
  narrative is the derived shape of each day plus the release headlines, which
  is the whole story on days a release was cut and the bare shape on days one
  was not. The reader, the reader-safety filter and its eight refusals are
  tested against fixtures rather than against a file, which is the point of
  writing them before the file exists.
- A game-repo edit this site cannot make: `docs/CAMPAIGN.md` describes arc A5 as
  "S1 Thu, S2 Fri/weekend, Deck later", which is a schedule with no anchor. The
  generator reports it as a `SITE NOTE` on every run and renders it unchanged,
  because rewriting the game's roadmap prose here would make this repo a second
  author of it.
- Per-entry flavour notes. The plumbing is live and proven (`data/authored/` in
  the game repo, keyed by entry id, orphans go red in its suite). The current
  source-derived numerator and denominator are printed by every build rather
  than frozen in this document. That voice is the director's, so the wiki uses
  canonical registry copy rather than manufacturing a second lore layer.
- Real gating, see the Gating section above.

The public source catalogs are fully routed. Anything added to the game-data
public domain order is withheld from deployment until this repo adds an explicit
guide and the consumer contract turns green again.
