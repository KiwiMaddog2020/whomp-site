# site-and-community (whomp-site half)

**Role:** cloud write lane. **Objective:** move the W into a nav bar, derive an
Upcoming section from something true, and add a short honest pitch for what
happens to a report after a player sends it.

The branding proposal and the full lane report live in the GAME repo on the
branch of the same name, at `docs/design/COMMUNITY_AND_BRAND.md` and
`docs/lane-reports/site-and-community.md`. This file is the site-side record,
because the two repositories have two branches and two sets of SHAs.

## Identity

| | |
|---|---|
| repo | `kiwimaddog2020/whomp-site` |
| branch | `claude/site-and-community` |
| base SHA | `14867ee9f17a840e54e0ba28dc8afdfe9d5f08bc` (`origin/main`) |
| commits | `3e8a134` claims, `082df9d` the change, `00196d5` README, this report last |
| game repo read at | `bcff1d6e0c8eb7c999828e6a6a60edd1d48193e4` |

## Files changed

| file | what |
|---|---|
| `bin/index-page.mjs` | new. The whole landing page, as a pure function of measured inputs. |
| `bin/upcoming.mjs` | new. Which cut releases are still ahead of live, and the CAMPAIGN arcs parse. |
| `tests/indexPage.test.mjs` | new. 15 tests, renders the page from fixtures and reads it back. |
| `tests/upcoming.test.mjs` | new. 17 tests over the two derivations. |
| `bin/generate.mjs` | four hunks, listed below. |
| `README.md` | the Upcoming source, and the half of the report loop that is not built. |
| `docs/claims/site-and-community.claims` | ownership. |

### The exact hunks in the shared `bin/generate.mjs`

1. two added imports (`parseArcs`, `selectUpcomingReleases`, `indexPage`)
2. `arcCards` grows one option, `{ showWhen = true }`, default unchanged
3. the arcs parse block is replaced by a call to `parseArcs`
4. the inline `indexHtml` template (66 lines) is replaced by a `selectUpcomingReleases`
   call and an `indexPage` call (21 lines)

Nothing else in that file moved. No registry, no plugin list, no shared type.

## The three asks

**1. The W moved.** It sits at the left of a new `<nav class="topnav">` with the
Wiki and Dev log links and the sign-in control, at 44px. The 112px copy above
the title is gone, so the page carries exactly one mark instead of two at two
sizes saying the same word. It is deliberately not a link: on the wiki the mark
returns you to the hub because you are somewhere else, and on the home page a
link to the page you are on is a small lie about where it goes. The svg keeps
`aria-hidden` and the `<h1>` carries the name.

**2. Upcoming is derived from cut releases**, `src/data/patchNotes.ts` compared
against the live Stable version. The argument for that source over the work
queue is in `bin/upcoming.mjs`'s header and in README. Four states, each with
its own sentence, each pinned in both directions.

**3. The report pitch** describes the loop that exists and says plainly that the
per-report lookup does not. `tests/indexPage.test.mjs` pins that sentence.

## Two things fixed that were not asked for

Both were visible in the rendered page and both are public-copy defects.

- **Arc descriptions stopped mid-sentence.** The ARCS match is anchored per
  line, so an arc wrapping onto a second indented line published only its first
  line. Live today: A6 ends on a comma after "(7 themed)," and A9 ends on a
  dangling plus. Nothing was truncated on purpose and nothing said so.
- **A trailing "per THE_LAB_ARC.md"** reached a public page. `VOICE.md` rule 12
  forbids naming the machinery to a reader outright. Only that trailing clause
  is dropped; the director's sentence in front of it survives.

## Verified

```
node --test tests/*.test.mjs      67 pass, 0 fail   (5 suites: the 3 that existed, plus 2 new)
node --check bin/generate.mjs     exit 0
```

Rendered at 1180px and 390px through Chromium and looked at. Neither width
scrolls sideways (`scrollWidth === clientWidth` at both).

**Mutation-verified, five guards, each broken on purpose and restored:**

| mutation | result |
|---|---|
| put the mark back above the title | 3 red |
| replace the honesty sentence with "Follow your report from start to finish" | 1 red |
| let the landing page print arc dates again | 1 red |
| remove the wrapped-bullet fold | 2 red |
| stop stripping the trailing doc pointer | 1 red |
| all restored | 67 pass |

## Assumed, not verified

**The generator was never run end to end, because it cannot be run today.** It
refuses unless three game artifacts verify fresh, and on `whomp` `main` at
`bcff1d6e` all three are stale. Measured, with the reasons:

```
node bin/data-layer.mjs --check    exit 1   domains.enemies.order[57]: committed "glacierBull", src/data "borealisk"
node bin/tier-engine.mjs --verify  exit 1   STALE (fingerprint): fd6a6d37... vs cf429bbd...
node bin/wiki-visuals.mjs --verify exit 1   7 evolution entries: source-derived identity has drifted
```

So what is proven is that `indexPage()` and `upcoming.mjs` produce the right
page from the right inputs, and that `bin/generate.mjs` parses. What is NOT
proven is the wiring between them at runtime. It is four hunks and it is
readable, but nobody has watched it execute.

`index.html` is therefore **not regenerated in this branch** and is stale
against its own generator. That is deliberate: hand-editing generated output is
worse, and every deploy path regenerates before staging.

## Residuals

| residual | destination |
|---|---|
| three stale game artifacts block every site regeneration and the site half of `bin/deploy-play.sh` | the artifact owners, before any deploy |
| runtime wiring unproven | falls out for free on the first regeneration after the artifacts are fresh |
| `index.html` stale against the generator | the deploy regenerates it |
| CAMPAIGN arc prose is engineer language on a public page ("S1 Thu, S2 Fri/weekend", "L0 secret entry to L3") | the director owns CAMPAIGN.md; flagged, not touched |

## Next action

Land the artifact refresh first, then regenerate this branch and look at the
real `index.html` before any publication. **Publication approval is still
required and was not given.** Nothing here was deployed.
