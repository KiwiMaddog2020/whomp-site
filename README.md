# whomp-site

The public WHOMP page: a short pitch (`index.html`), the real development log
(`log.html`), and the wiki (`wiki*.html`).

## Three surfaces

- **`index.html`** is the short public landing page: mark, tagline, live build
  chip, play button, arcs. It is deliberately small and never grows.
- **`log.html`** is the real dev log: sidebar, search, filters, and a toggle
  between two views of what shipped.
- **`wiki.html`** plus one page per roster is the wiki. Every value on it is
  generated from the game's own registries. See "The wiki" below.

## Two views inside the log

- **Concise** (default) is Kevin's own notes, one file per update in `notes/`.
  A machine cannot pick highlights, so this view is only ever what a human
  decided was worth saying.
- **Full** is the generated feed straight from `git log`, labelled honestly as
  the raw engineering log. Nothing is cleaned up for the reader.

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

It only ever **reads** the game repo. Kevin writes short human notes on top; the
machine is not trusted to say why something mattered.

```bash
node bin/generate.mjs --repo ../whomp                # writes every page + search-index.json
node bin/generate.mjs --repo ../whomp --offline       # skip the live sha fetch
bin/deploy-site.sh                                    # regenerate and push to GitHub Pages
```

The page says so plainly when it could not reach the live build, rather than
inventing a sha.

## The wiki

`bin/wiki.mjs` builds `wiki.html` (the hub) plus one page per roster: weapons,
core weapons, and the bestiary. It is imported by `bin/generate.mjs`, so there
is still one entry point, one palette, one search index and one write step. It
is a separate module only because it grows per roster while the generator grows
per dev-log feature: two different reasons to change.

**Everything factual on those pages comes from the game repo's shared data
layer, `data/game-data.json`.** That artifact is generated by the game's
`bin/data-layer.mjs` and pinned against live `src/data` by its
`tests/dataLayer.test.mjs`, so a wiki page cannot fall behind a balance change.
The generator refuses to run at all if the artifact is missing or its schema
moved, rather than shipping an empty roster nobody notices.

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
- **No enemy speed.** Basic and special kinds are re-banded by
  `bandedEnemySpeed()` before the game uses the registry value, and that
  function is not in the data layer. The raw field is a speed nobody meets.
- **No boss or miniboss health and damage.** The boss director replaces them at
  spawn from its own table.
- **No core weapon combat numbers.** Every clip size, reload and multiplier is a
  module-private constant in the game's combat code. `meterPips` is the one
  exception, and only because the game's suite pins it against the real value.
- **No core evolutions.** `coreWeapons.ts` carries an `evolutionName` per core
  and the game's own picker advertises it, but nothing implements it.

Times ARE converted into minutes of real play, because the conversion is
derivable: spawn and boss schedules are measured on the game's pace clock, and
every run mode's `paceScale` is in the artifact. The generator refuses to
convert if the modes ever disagree or a value sits past the pacing bank, and
prints the raw schedule figure instead.

### Adding a roster

1. add an entry to `rosterSpecs()` in `bin/wiki.mjs`
2. write its `card(e)`
3. that is all

The page chrome, filter bar, sort control, comparison meters, search entries,
sidebar, hub card, the hub's self-updating "not built yet" list and the
generator's cross-link check are all driven off that one object. Neither deploy
script needs touching: they stage from the manifest the generator writes.

### The output manifest

`bin/generate.mjs` writes `.site-outputs`, a plain list of the files it just
wrote, and both deploy paths stage from it. It is gitignored, because it is a
build-time handoff rather than site content.

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
  there by design, so a site hiccup can never read as a failed game deploy.
- The rest of the wiki. Three rosters have pages; nineteen indexed registries do
  not, and `wiki.html` lists them with live counts so the gap maintains itself.
  Relics (36) and passives, the tomes (17), are the natural next pair: the
  weapon pages already link tome names that have nowhere to land yet.
- Per-entry flavour notes. The plumbing is live and proven (`data/authored/` in
  the game repo, keyed by entry id, orphans go red in its suite), and 0 of 313
  are written, deliberately: that voice is the director's.
- Real gating, see the Gating section above.

The shared data layer is **done**, and it is what the wiki is built on.
