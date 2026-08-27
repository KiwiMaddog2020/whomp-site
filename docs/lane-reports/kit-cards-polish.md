# Lane: kit-cards-polish

Role: SITE write lane, class `site`. Runner claude, model opus.

Objective, from the director at 2026-08-26 23:11, over a screenshot of the six
card `Your kit` grid: "i want to update the content on these cards to sound more
human and i also want them to have about the same amount of content in each card
so they take up roughly the same amount of space and have the text vertically
centered within to make good use of the space in the cards."

Three parts, all three landed: the copy, the even weight, the centring.

## Branch and bases

| | |
|---|---|
| branch | `claude/kit-cards-polish`, in `whomp-site` only |
| whomp-site base | `b71a8b39ff90b3c0228d8a88885582ffe017c477` (`main` at lane start) |
| whomp read at | `fd34ea7ed6da2bde7db89d9d2bf5bddb8ec1f1ef`, read only, never branched or written |
| worked in | a worktree, not the shared checkout. See "The collision" below |
| pushed | no |

## Files changed

| file | what |
|---|---|
| `bin/landing.mjs` | `kitCards`: all six bodies rewritten, the relics kicker shortened to one line, and the doc comment above it now carries the even-weight law |
| `bin/generate.mjs` | `.kit` gains `justify-content:center` and even `18px` padding; the grid comment carries the centring ruling |
| `docs/lane-reports/kit-cards-polish.md` | this |
| `docs/lane-reports/kit-cards-polish/kit-before.png` | the section as `main` renders it |
| `docs/lane-reports/kit-cards-polish/kit-after.png` | the section as this branch renders it |

**No generated output is committed on this branch, deliberately.** Regenerating
today moves the whole site from `game@028f7a4aa` to `game@fd34ea7ed`: 39
documents, the search index, two character PNGs and one new expedition PNG, none
of it this lane's work. Artifacts land last, once, at integration. The
regeneration was run here to prove the change and then reverted; `git status` on
this branch is two source files, one report and two screenshots.

## The six cards, in full

The stat line, the kind, the title and the kicker keep their shape. Every figure
below still arrives from the game through `kitShape`; not one is typed into
prose, and `tests/landing.test.mjs` proves it by doctoring the kit and grepping
for survivors.

**THE CORE** · `One of 12` / `Aimed`
> The one you aim.
>
> You pick your core at the door, and it sits in a slot the draft can never
> touch. Everything else you carry fires on its own, and this is the one weapon
> that waits for you to point it.

**THE ARSENAL** · `4 slots` / `Automatic`
> 4 that fire themselves.
>
> Room for 4, pulled from 45 weapons that keep their own time and never ask
> permission. 6 of them have an end form, and getting there takes a maxed
> weapon, its paired tome, and a boss chest.

**THE TOMES** · `4 slots` / `Passive`
> 4 that bend the math.
>
> 4 more slots, filled out of 17 tomes. None of them fires at anything. They
> decide how hard the rest of your build hits and how often, and the right stack
> is worth more than another weapon.

**THE WHOMP** · `Every 40 seconds` / `On Q`
> The button the game is named after.
>
> You come down on Q and the ground does the arguing. It is yours from the first
> second of the run, it comes back every 40 seconds on a bare build, and plenty
> of what you pick up shortens that wait.

**YOUR CHARACTER** · `One of 20` / `Picked first`
> Each one cheats differently.
>
> All 20 are open on a fresh save, so the first pick of the run is a real one.
> Every one of them carries a rule that is always on and a signature move nobody
> else gets to press.

**THE RELICS** · `34 to find` / `Not drafted`
> The run picks these, not you.
>
> Not one of the 34 ever shows up on a level up card. They come out of chests,
> and out of the machines that eat one relic and vend a better one, so a run can
> hand you a build you never drafted.

### What moved in the voice

Every card is two sentences now, which the arsenal and the relics were not. The
arsenal lost the clause that made it a wall ("never ask you for permission" to
"never ask permission", "it only arrives if you max the weapon, carry its paired
tome, and open a boss chest" to "getting there takes a maxed weapon, its paired
tome, and a boss chest"). The tomes grew the sentence it was missing: it used to
assert that a tome changes what a build is worth without ever saying how, and it
now says hits harder and more often before it says worth.

The relics card lost its second kicker sentence, which was the only kicker on
the grid that wrapped to two lines and pushed its whole card down. "The run
picks these, not you" says the same thing in one line and answers THE CORE's
"The one you aim" across the grid.

The whomp card's last clause was the least human sentence in the section:
"before anything you are carrying cuts into that" is a caveat written from
inside the cooldown code. It is now "on a bare build, and plenty of what you
pick up shortens that wait", which is the same fact from the player's side.

House law holds: no em or en dashes, no exclamations, no contractions, no
machinery words, every line a finished sentence. `tests/landing.test.mjs`
asserts all five of those over every card and passes.

## The numbers: checked against the game, nothing stale

The director asked for a check on 12 cores, 45 weapons, 17 tomes, 20 characters,
34 relics and a 40 second WHOMP. **All six were already correct and none needed
fixing**, because none of them is typed on this page. `kitShape` reads the
roster sizes off `data/game-data.json`, the slot sizes off
`src/sim/progression.ts`, and the WHOMP's key and cooldown off the ultimate
registry, and it throws rather than guess when any of them is missing.

Read at `game@fd34ea7ed`:

| card figure | value | read from |
|---|---|---|
| cores | 12 | `domains.coreWeapons.count` |
| weapons | 45 | `domains.weapons.count` |
| weapon slots | 4 | `WEAPON_SLOTS` |
| tomes | 17 | `domains.passives.count` |
| tome slots | 4 | `PASSIVE_SLOTS` |
| evolutions | 6 | `domains.evolutions.count` |
| characters | 20 | `domains.characters.count` |
| relics | 34 | `domains.relics.count` |
| WHOMP key | Q | the ultimate's input slot |
| WHOMP cooldown | 40s | the held ultimate's cooldown |
| offer size | 3 | `OFFER_SIZE` |

The generator's own summary line agrees: `kit: 1 of 12 cores aimed, 4 of 45
weapons and 4 of 17 tomes held, the WHOMP on Q every 40s, 20 characters`.

## Even weight and centring, measured

Measured in a real engine at a 1280px viewport, where the 940px wrap puts three
288px cards across, which is the grid the director screenshotted.

**Before** (`main@b71a8b3`):

| card | body lines | kicker lines | card height | air above | air below |
|---|---|---|---|---|---|
| core | 4 | 1 | 260 | 17 | 64 |
| arsenal | 6 | 1 | 260 | 17 | 19 |
| tomes | 4 | 1 | 260 | 17 | 64 |
| whomp | 6 | 1 | 306 | 17 | 65 |
| character | 4 | 1 | 306 | 17 | 109 |
| relics | 7 | 2 | 306 | 17 | 19 |

Two rows of different heights, a three line spread in the bodies, one kicker
wrapping, and up to 109px of dead space under a card whose text sat pinned to
the top of it.

**After** (this branch):

| card | body lines | kicker lines | card height | air above | air below |
|---|---|---|---|---|---|
| core | 5 | 1 | 262 | 30 | 30 |
| arsenal | 6 | 1 | 262 | 19 | 19 |
| tomes | 5 | 1 | 262 | 30 | 30 |
| whomp | 6 | 1 | 262 | 19 | 19 |
| character | 5 | 1 | 262 | 30 | 30 |
| relics | 6 | 1 | 262 | 19 | 19 |

All six cards the same height, both rows the same height, bodies within one
rendered line of each other, every kicker on one line, and air above equals air
below on every card. The section is also shorter than it was.

Body lengths, for whoever writes the seventh card: 183, 188, 188, 196, 175, 191
characters. The band is 175 to 196 and holding it is what keeps the rows level
before the centring has anything to correct.

The centring is `justify-content:center` on `.kit`, which is already a column
flex box, plus `padding:16px 18px 18px` going to an even `padding:18px`. An
off-centre box inside a centred one is the centring undone by a shorthand.

### Screenshots

| | |
|---|---|
| before | `docs/lane-reports/kit-cards-polish/kit-before.png` |
| after | `docs/lane-reports/kit-cards-polish/kit-after.png` |

Both are the real generated `<section id="kit">` with the page's own stylesheet,
captured headless at 1280x880 at 2x. The pane could not be used: it was hidden
for this run, so every screenshot through it came back a black frame.

## Gates

| gate | result |
|---|---|
| `node --test tests/landing.test.mjs` | 34/34 pass |
| `node --test tests/*.test.mjs` after a full regeneration | 130/130 pass |
| `bin/regenerate-and-verify.sh` step 2, the generator | wrote 39 documents and 357 verified visual variants, exit 0 |
| `bin/regenerate-and-verify.sh` step 3, the warning gate | **FAILED, and it fails identically on unmodified `main`. See the blocker.** |

No pinned test count moved. The run-length pin was re-pointed on 2026-08-25 to
parse the number rather than the sentence, and this lane does not touch the run
lede, so it needed nothing. The kit pins that did have to hold, and did:
`cards.length % 3`, the relics card's `not one of` / `chest` / `level up`
clauses, the tomes card still ending on `worth`, the two cards not closing on
one sentence, the doctored-kit sweep, and the earned-WHOMP variant still naming
its cooldown.

## Blockers

**1. `bin/regenerate-and-verify.sh` is red on `main` today, for a reason that is
not this lane.** The generator raises two warnings:

```
SITE WARNING: 2026-08-16 carries player-visible commits that fall outside the 7
day window the story draws, so that day is in the feed and not in the story.
SITE WARNING: 2026-08-06 carries player-visible commits that fall outside the 7
day window the story draws, so that day is in the feed and not in the story.
```

Step 3 turns any `SITE WARNING` into a failed gate, so the one-command verify
cannot pass for anybody right now. **Proved pre-existing rather than assumed:**
the two source files this lane touches were reverted in the worktree, the
generator was run against pristine `main` sources at `game@fd34ea7ed`, and the
same two warnings came back word for word. The feed and the story are reckoned
in one clock in `bin/generate.mjs` and they have come apart. Owner: whoever holds
the dev log lane. It does not gate this branch's correctness, and the suite that
reads the files just written is green.

**2. The shared checkout `/Users/kevin/whomp-site` is a second lane's workspace
right now.** See below. Nothing here needs the integrator to act, but a lane
firing into that directory should expect company.

**3. `claude/wiki-curation` is editing `bin/landing.mjs` too, and it changes what
these cards say.** Read out of the shared checkout's working tree at 23:36, so
uncommitted and still moving: that lane is replacing `kitShape`'s domain count
with a live count that subtracts retired defs, under its ruling
`2026-08-26-wiki-curation`. Nine automatic weapons are retired, so **THE
ARSENAL's "pulled from 45 weapons" becomes "pulled from 36 weapons"** the moment
both lanes are in the tree, and the same subtraction reaches any other card whose
roster has a retirement in it.

Two things follow for the integrator. The merge itself should be clean: their
hunks land at lines 36, 357 and 428 and every line this lane touches is below
459, in `kitCards` and its doc comment, which they do not enter. But the
**director signed off on 45 in the ask, and he will read 36 on the page**, so
that is a ruling to surface rather than a merge to wave through. The card copy
needs no rewrite either way: the figure is interpolated, and 36 and 45 are both
two digits, so the measured line counts above hold.

## The collision

Recorded because the near miss was real, not because anything is broken.

The lane opened `claude/kit-cards-polish` off `main` in `/Users/kevin/whomp-site`
with a clean tree. Partway through, a second lane created and checked out
`claude/wiki-curation` in the same directory and began editing `bin/wiki.mjs`
under a director ruling of its own about wiki captions and retired weapons. The
shared checkout's `HEAD` had moved off this branch, and the full regeneration run
here therefore baked that lane's in-flight `bin/wiki.mjs` into 39 generated
documents that neither lane had reviewed.

What was done about it, in order: the two source edits were saved as a patch; a
dedicated worktree was created for `claude/kit-cards-polish`; the patch was
applied there and everything below was measured, generated and gated in that
worktree against a clean `bin/wiki.mjs`; and the shared checkout was put back
exactly as it was found, which is `bin/wiki.mjs` modified by the other lane and
one untracked PNG of theirs, both untouched. Their work was backed up before the
restore and was not lost. This lane never committed in the shared checkout and
never touched their branch.
