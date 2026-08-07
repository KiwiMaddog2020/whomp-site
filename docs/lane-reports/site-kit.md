# Lane: site-kit

Role: cloud SITE write lane, class `site`. Runner claude, model opus.
Objective: the approved landing rework. The run-facts section compresses to a
tight intro, and YOUR KIT lands under it as five cards in the game's own
offer-card language.

## Branch and bases

| | |
|---|---|
| branch | `claude/site-kit`, in `whomp-site` only |
| whomp-site base | `902137fd1788bc97165034530e22216e1e696a85` (`origin/main`, fetched at lane start, and the merge base of this branch) |
| whomp base read | `ad7fd3937db064c8d689ac209fc5a7862ef868ba`, the container's checkout HEAD |
| whomp origin/main | `98404bae817231a9ede42095212bd0a919ae962a`, five commits ahead of that checkout |
| final code SHA | `9af2c32` |
| this report | the commit after it, and the branch tip |

**The five commits the game checkout is behind do not touch anything this lane
read.** `git diff --stat ad7fd39 98404ba` over `data/game-data.json`,
`src/sim/progression.ts`, `src/data/ultimates.ts`, `src/data/coreWeapons.ts`,
`src/data/characters.ts`, `src/ui/offerCard.ts` and `src/core/releaseChannel.ts`
is empty: all five are routing-hook and claims commits. Every fact below is
therefore current as of `origin/main` `98404ba`, not merely as of the clone. The
game checkout was never modified, branched or pushed.

## Files changed

| file | what |
|---|---|
| `bin/landing.mjs` | `parseBuildSlots`, `kitShape`, `kitCards`. New, additive; nothing existing moved |
| `bin/generate.mjs` | the run section compresses; the kit section, its card and its CSS; the retired `.fact` card and CSS; one derivation and one summary line |
| `tests/landing.test.mjs` | 10 new cases over the three new functions |
| `tests/generatedSite.test.mjs` | `cardSentences` reads the card track rather than the card |
| `docs/claims/site-kit.claims` | the ownership contract, written first |
| `docs/lane-reports/site-kit.md` | this |

No deploy script, no `main`, no force push, no merge. Nothing intentionally left
dirty: `git status --porcelain` is empty at the final commit.

## What the page says now

The run section is two short paragraphs over the tally chips: the clock
(`20 minutes`, final horde `18:00`, a `2` minute hold, bank `20:00`, all off the
mode registry as before) and the no-install promise, which is the one hard claim
that section owed and is pinned. The four fact cards are gone, because three of
them were describing a kit that was not on the page.

Under it, `Your kit`, five cards:

| meta row | title | line | grounded in |
|---|---|---|---|
| One of 8 · Aimed | THE CORE | The one you aim. | `domains.coreWeapons.count`, `src/data/coreWeapons.ts` |
| 4 slots · Automatic | THE ARSENAL | 4 that fire themselves. | `WEAPON_SLOTS`, `domains.weapons.count`, `domains.evolutions.count` |
| 4 slots · Passive | THE TOMES | 4 that bend the math. | `PASSIVE_SLOTS`, `domains.passives.count` |
| Every 50 seconds · On Q | THE WHOMP | The button the game is named after. | `domains.ultimates` entry and runtime |
| One of 11 · Picked first | YOUR CHARACTER | Each one cheats differently. | `domains.characters`, its `innateId` and `signatureId` |

## VERIFIED versus ASSUMED

**VERIFIED, with the game-repo file each card's facts came from.**

- **THE CORE.** Eight cores: `data/game-data.json` `domains.coreWeapons.count`,
  emitted from `src/data/coreWeapons.ts#CORE_WEAPONS`. "A slot of its own that
  the draft cannot reach" is that file's own header: a "DEDICATED 5TH SLOT",
  "not a draftable card", "never competes for an auto slot", "a slot the draft
  cannot reach". "You pick a core at the door" is
  `src/ui/coreWeaponPicker.ts`, whose two hosts are named there as the
  run-entry loadout screen `src/ui/startingWeaponSelect.ts` and the hub forge.
  "The one weapon that waits for you to point it" is the aimed-core policy in
  `domains.coreWeapons.aimPolicy`, provenanced to `src/sim/forgiveness.ts`.
- **THE ARSENAL.** Four slots: `src/sim/progression.ts#WEAPON_SLOTS`. 33
  weapons: `domains.weapons.count`, from `src/data/weapons.ts#WEAPONS`. Eight
  end forms and their recipe: `domains.evolutions` (8 rows of
  `baseId` + `passiveId` + `evolvedId`), and the three conditions are the wiki's
  own already-shipped sentence for that domain in `bin/wiki.mjs` ("maxing a
  specific weapon, holding its paired tome, and opening a boss chest").
- **THE TOMES.** Four slots: `src/sim/progression.ts#PASSIVE_SLOTS`. 17 tomes:
  `domains.passives.count`, from `src/data/passives.ts`. "None of them fires at
  anything" is that registry read whole: every one of the 17 is a stat line
  (crit, damage, movement, regen, shield), not a weapon.
- **THE WHOMP.** One ultimate named The Whomp, `cooldownMs` 50000, on slot `Q`:
  `domains.ultimates.entries.whomp` and `domains.ultimates.runtime`, provenanced
  to `src/data/ultimates.ts#ULTIMATES` and `#ULTIMATE_RUNTIME`. "Yours from the
  first second of the run" is that runtime's `availability.fromRunStart: true`
  with `requiresBossKill: false`, whose own semantics line says standard
  campaign runs arm the WHOMP at construction. "Before anything you are carrying
  cuts into that" is the same block: "the displayed cooldown is the registry
  base. Runtime scales it by player cooldown and whompCooldownMult."
- **YOUR CHARACTER.** Eleven characters, all `unlockedFromStart: true`, each
  carrying an `innateId` and a `signatureId`:
  `domains.characters.entries`, from `src/data/characters.ts#CHARACTERS`. The
  always-on rule is `src/data/characterInnates.ts` (11 entries, each with a
  `characterSelectCopy` stating its effect); the signature move is
  `src/data/signatures.ts` (11 entries, one per character).
- **The offer-card language.** `src/ui/offerCard.ts` is the single card anatomy
  behind the level-up draft, shrine blessings, chest reveals, the mystic and
  legendary offerings: a meta row of two small labels, a title, the line under
  it, then the footer that says what changes. The site's card is that anatomy in
  HTML and at rest, which is why the five cards use a meta row rather than the
  retired flat fact card.
- **The lede's `3` and `2`.** `src/sim/progression.ts#OFFER_SIZE` is 3, and the
  page prints `offer` and `offer - 1`; no numeral is typed.

**ASSUMED, and named rather than hidden.**

- The site's own already-audited derivations were reused, not re-derived: the
  run clock out of `domains.runModes.classic`, and the roster tally chips. They
  were verified by the lanes that built them and are unchanged here.
- `src/ui/hud.ts` binds the signature to `R` and the WHOMP to `Q`. Only `Q` is
  published, because `Q` is in the data layer and `R` is not. The character card
  says "a signature move nobody else gets" and names no key on purpose.
- The WHOMP's `radius`, `damage`, `knockback` and `trashStunMs` params exist and
  were read, and none is on the page: the artifact records no unit for them, and
  a landing page that prints "12" next to "meters" would be inventing the second
  word. The card says what the ground does instead.

## Acceptance

A visitor can confirm it by playing: open the Preview link, start a Classic run,
and count what the game hands you. You choose one character out of eleven and
one aimed core out of eight before the run starts, the level-up screen offers
three at a time into four automatic weapon slots and four tome slots drawn from
33 weapons and 17 tomes, and the WHOMP is on Q from the first second with a 50
second base recharge. Those are the five cards on the landing page, in that
order, with those numbers.

## Verification, with real exit codes

| check | command | exit |
|---|---|---|
| tests | `node --test tests/*.test.mjs` | **0**, 129 tests, 129 pass, 0 fail (119 before this lane, plus 10) |
| syntax | `node --check` over all 15 `bin/*.mjs` and `tests/*.mjs` | **0** |
| typecheck | `npx tsc -b` | **1**, `error TS5083: Cannot read file '/home/user/whomp-site/tsconfig.json'` |
| generator | `node bin/generate.mjs` (see the blocker below) | **0**, 39 documents, wiki contract OK, 1621 anchors, every internal link resolves |
| drift over the regenerated pages | the suite again, with the regenerated pages in place | **1**, 128 pass, 1 fail, and the one failure is the network denial below |

**There is no typecheck to run.** `whomp-site` has no `tsconfig.json`, no
`package.json` and no TypeScript in it: every module is plain ESM `.mjs`. `tsc`
therefore fails on a missing config rather than on this lane's code, which is
reported above as measured rather than dressed up as a pass. `node --check` over
every module the site ships is the nearest real equivalent and exits 0.

**No em dashes.** Swept mechanically over all 36 generated HTML pages, with
comments, `<style>` and `<script>` blocks excluded so `!important` is not
mistaken for a reader seeing an exclamation mark: **0 em dashes, 0 en dashes**
across every page, and **0 exclamation marks** on the two surfaces whose copy
this repo writes (`index.html`, `built-in-the-open.html`). The suite pins the
same law and passes. The kit copy carries neither, and its own unit test refuses
either character in any of the five cards.

**A guard that has failed on purpose.** `cardSentences` in the drift suite was
matching a card div and stopping at the first `</div>` inside it, so an arc
card, whose first child is its own id div, contributed nothing: only the flat
fact cards were ever checked, and those left with this rework. It now reads the
card track and captures 15 sentences on the committed page where the old form
captured 4. Fired deliberately by cutting an arc paragraph to "Junction law,
sprite bar," in `index.html`: red, with the sentence quoted. Restored: green.

## The glow-up pass

Run against the rendered section read as a page, not as a diff, then regenerated
and read again. Six things changed:

1. The intro says "final horde" again, which is the game's own word for it.
2. The kit lede was implying a level up hands you a sixth thing. It now reads
   "Five things go in with you, and you aim exactly one of them", then the draft.
3. The tome card was three sentences. House rule 1 is two.
4. The WHOMP's meta row was a bare letter. It carries the recharge and the key,
   which is what the game's own meta row does, and the body lost a comma splice.
5. The character meta row took the core's shape, so "One of 11" sits beside
   "One of 8" and the two cards you actually choose between read as a pair.
6. "Choose from", not "choose between", for a roster of eleven.

Deliberately left alone: the tally chips under the intro, which are the only
place the full roster sizes are said out loud and which the drift suite pins;
the arcs and the queued teasers below, which are another lane's copy; and the
hero, which the director settled this morning.

## Residuals, each with a destination

1. **The regenerated pages are NOT in this branch, on purpose. Destination: the
   integrator's deploy.** This container cannot reach either release track:
   `https://whomp-preview.pages.dev/version.json` and
   `https://kiwimaddog2020.github.io/whomp-play/version.json` both answer 403 at
   the egress proxy on CONNECT, recorded in the proxy's own status endpoint as a
   policy denial, which is not something a lane may route around. The generator
   is honest about it and writes "unverified" for both chips, and the footer
   then says it names no version. That turns the existing pin "one line explains
   what the two tracks are serving" red, and it replaces two measured versions
   on the committed page with a sentence saying they could not be measured.
   Committing that would have shipped a worse page and a red suite to buy
   nothing, since `bin/deploy-site.sh` regenerates before it stages. So the
   generator change is committed and its output is not. **The integrator's
   deploy publishes this section**, and on a networked machine the same run is
   129/129.
2. **`node bin/generate.mjs` still cannot exit 0 in a Linux container.
   Destination: the game repo's owner, unchanged from the site-voice lane.** Its
   third gate is `wiki-visuals.mjs --verify`, which re-renders the canonical
   gallery and demands byte-identical PNGs; the artifact records macOS Chrome
   151.0.7922.77 on Node v25.9.0 and `findChrome` only looks in macOS paths.
   WebGL bytes are not reproducible across platforms. The artifact itself is
   sound: `wiki-visuals.mjs --check` passes clean at 246 entries / 331 PNGs /
   14009304 bytes. So this lane generated through an untracked sibling copy of
   the generator whose only delta is that one flag, diffed before every run to
   prove nothing else differed, and **deleted before this commit**;
   `bin/generate.mjs` is committed with its fail-closed gate untouched. Either
   deploy from a machine with the canonical Chrome, or give `wiki-visuals.mjs` a
   supported way to record a second renderer.
3. **The game clone arrives shallow and must be unshallowed before anyone
   regenerates. Destination: whoever writes the cloud site-lane brief.** This
   container's clone held 186 commits; `git fetch --unshallow` (history only, no
   branch, no push, no working-tree change) brought it to 5138. The site-voice
   lane measured what a shallow clone does to the site's git-derived numbers and
   it is silent and wrong. This is the second lane to have to discover it.
4. **One pre-existing SITE WARNING, not this lane's. Destination: the site's
   feed/story owner.** "2026-07-31 carries player-visible commits that fall
   outside the 7 day window the story draws, so that day is in the feed and not
   in the story." It fails step 3 of `bin/regenerate-and-verify.sh` and predates
   this branch; the site-voice lane flagged the same day. Untouched here.
5. **Two SITE NOTEs, both owned upstream and both correct.** Arc A5 CONTROLLER
   describes itself with a schedule that has passed, which the site refuses to
   rewrite, and the two unreachable tracks from residual 1.

## Next recommended action

Merge, then deploy. The deploy is what regenerates the pages with real live
versions and publishes the section; publication approval for that step is the
integrator's per-run authority and is not implied by this lane.
