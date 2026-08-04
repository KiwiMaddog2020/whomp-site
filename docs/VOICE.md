# The WHOMP wiki voice

The wiki is generated from the game's files, so left alone it inherits the
language of field names. This file is the correction. Read it before you write
any player-facing string in `bin/wiki.mjs` or `bin/generate.mjs`.

The tone is not invented here. It already exists, in the game, and every rule
below is derived from copy that shipped. The evidence is quoted so you can
check the derivation rather than trust it.

## Where the voice comes from

The locked tone, `docs/GAME_SPEC.md` (Tone bullet):

> deadpan-dry text ("It's a hammer."), loud WHOMP announcer. Straight-man/loud-man.

The wiki is the straight man. The announcer is not on this site.

**Title screen taglines**, `src/ui/mainMenu.ts` (`TAGLINES`):
"It's a hammer." / "The horde is a physics object." / "The ghosts started it." /
"Cardio, with consequences." / "Politely violent." / "The ghosts are unionizing.
Whomp faster." / "The crowd is never satisfied. Try anyway." / "Whomp first. Ask
questions never."

**Weapons**, `src/data/weapons.ts`:
Photon Scythe, "Reaps the front and both flanks. No survivors, no paperwork."
Lightning Strike, "The sky files a grievance. Directly."
Storm Sentry, "Deploys a small opinionated cloud. It roves. It zaps."
Faultline, "The ground remembers. It heaves them up, then lets go."
Hellscatter, "The second volley is the punchline."
Ring of Ruin, "One ring was apparently not enough ruin."

**Characters**, `src/data/characters.ts`:
"Made of glass. Hexes anyway." / "Heavy boots. Comes down like a dropped wrench."
/ "First week on the job. Never stops running." / "Never fights alone.
Technically."

**Worlds**, `src/data/levels.ts`:
Scorchdune, "Bring water. It won't help." / Mirage Flats, "Some of it is even
real." / Hellmouth, "Abandon all hope."

**Run end**, `src/ui/resultsScreen.ts`: a win is "THE CROWD IS SATISFIED.", a
loss is "YOU GOT WHOMPED.", a sealed Maw is "THE MAW IS SEALED."

**Shop**, `src/ui/shopPanel.ts`: "No refunds. He was very clear about that."

**Loading tips**, `src/data/campfireLines.ts`: "Your build caps at four weapons
and four tomes. Commitment is a stat." / "Reroll and Banish are limited. Regret
is not." / "The portals were here first. We added signage."

## The twelve rules

1. **Two sentences.** The second undercuts, complicates or deflates the first.
   Never explain past sentence two.
2. **Humor is understatement, bluntness and precision.** Never wordplay, never
   exclamation, never zany.
3. **Treat the fantastical as mundane and the mundane as faintly
   bureaucratic.** "No paperwork." "Files a grievance." "We added signage."
4. **Verbs carry the image.** No adjective piles. "Heaves them up, then lets go"
   beats "powerful ground attack."
5. **Third person to describe a thing. Second person only to instruct a
   reader.**
6. **Plain, concrete, physical vocabulary.** Hammer, wrench, thread, fire,
   ground, crater. Not "exposes", "artifact", "semantics", "contract".
7. **Never marketing-enthusiastic.** A win is "THE CROWD IS SATISFIED", not
   "You win!"
8. **Uncontracted by default.** A contraction is a rare deliberate choice.
9. **Every line is a finished sentence with terminal punctuation.** No trailing
   off.
10. **Reference material is allowed to be flat and useful.** Roughly one turn of
    voice per section, not per sentence. A page of forced jokes is worse than a
    plain one.
11. **Never be meta about the document.** The game never says "this guide
    prints". The tailor says "Sit down. These are yours now."
12. **Never name the machinery to the reader.** No "field", "registry",
    "artifact", "contract", "semantics", "schema" in player-facing copy. Those
    words belong in the source comments, where they are correct and useful.

House law, enforced by the game's own tests and by this repo: **no em dashes, no
en dashes, no exclamation marks.**

## What you may not rewrite

Item names, item descriptions, flavor text, quest lines, achievement blurbs,
loading tips and image alt text arrive from `data/game-data.json` and
`data/wiki-visuals.json`. That is the game's copy, authored in the game repo.
You may re-present it, quote it, and give it more prominence. You may not
rewrite it here. If a game string is wrong, fix it in the game repo.

## Before and after

Ten pairs from real site copy. The "before" column is what the generator
emitted before this pass.

**1. Power soft knees, page lede.**

> Before: The root powerCeiling contract exposes its knee and factor fields.
> This guide prints the exact field names and values alongside the artifact's
> own semantics.

> After: Permanent power does not climb forever. Past a certain point attack
> speed and crit both start paying you less for the same investment, and these
> four numbers are where that happens.

Broke rules 6, 11 and 12 at once: it named its own machinery, was meta about
itself, and reached for Latinate abstraction where a physical sentence was
available.

**2. Power soft knees, tagline.**

> Before: 4 exported permanent-power dials, without an invented build result.

> After: Four dials that decide where getting stronger stops paying.

The disclaimer belongs in the omissions line, not in the tagline. A tagline is
what the page is, not what it refuses to do.

**3. Power soft knees, group note.**

> Before: Every field in powerCeiling.config, in source order.

> After: All four, in the order the game keeps them.

Rule 12. "powerCeiling.config" is a path, not a sentence.

**4. Weapons, tagline.**

> Before: The half of your build that fires itself.

> After: unchanged.

Already correct. Concrete, two beats, no machinery. Leave good copy alone.

**5. Cosmetics, lede.**

> Before: Cosmetic styles are complete source palettes. Each card shows
> availability, achievement route when one exists, and the exact body, rim and
> accent values stored by the registry.

> After: A style is three colors: body, rim and accent. It changes nothing about
> the run, which is the point of it.

Before was a table of contents for the page the reader is already looking at.
Rules 10 and 11.

**6. Cosmetics, group note.**

> Before: Achievement-linked styles.

> After: Earned by doing something specific. The achievement that pays out is on
> the card.

A fragment is not a sentence (rule 9), and it answered nothing the group title
had not already said.

**7. Shared provenance block, every page.**

> Before: Canonical fields and measurements on this page are read from a
> verified generated artifact at build time, against game@abc1234. Player-facing
> labels and explanations are either artifact semantics or source-audited
> editorial context; they never introduce an unsourced magnitude. The generator
> refuses stale artifacts, missing domains, missing entries and dead relations
> before it writes a page.

> After: Every number here was read out of the game at build time, from
> game@abc1234. Where it came from, and what that is worth.

Thirty-two copies of a legal notice is not trust, it is noise. One plain
sentence plus a link to a page that actually explains itself is.

**8. Empty filter state.**

> Before: No entries match these filters.

> After: Nothing here matches all of that at once.

Same fact. One of them sounds like a form validation error.

**9. Hub lede.**

> Before: Every player-facing catalog in the generated public data layer, plus
> the controlled automatic-weapon measurements the simulation can honestly
> support.

> After: Everything the game knows about itself, laid out. The numbers come
> straight out of it, so they are right until somebody changes them, and then
> they are right again.

Rule 12 twice ("data layer", "controlled"), and the honest thing it was trying
to say got buried.

**10. Image caption.**

> Before: Presentation: Isolated production render, neutral toyMeadow
> presentation palette, fixed gallery lighting and bounds-fit front camera,
> neutral frame, not an in-game screenshot or live-world lighting.

> After: How it was made: the game drew this on its own, alone, on a plain
> background with fixed light, seen from the front. It is not a screenshot, and
> it is not how the thing looks in a live world.

Every claim survives. None of them needs the word "presentation" three times.

## Applying this

- Chrome copy (page ledes, taglines, group notes, empty states, footers) is
  yours. Rewrite it.
- Anything interpolated from `D.domains.*`, `T.*` or `V.*` is the game talking.
  Leave it.
- Some strings are pinned by `bin/wiki-check.mjs`. Change the copy and its pin
  in the same commit, and keep what the pin was protecting. Several pins are
  regression guards against a specific earlier wrong claim: the guard survives
  the rewrite even when the wording does not. If you cannot tell what a pin is
  protecting, leave the copy alone and say so.
