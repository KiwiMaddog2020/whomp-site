# SITE GLOW-UP PLAN (director rapid-fire, 2026-07-30)

Decisions are ratified. This is the build order for the next session.

> Historical plan status (2026-08-03): the generated bug source and shared wiki
> data layer described as open below are now shipped. Public-log gating remains
> a separate director decision; it is not a missing wiki-data surface.

## The decisions

1. **Two surfaces.** A short public landing that never grows, and `/log` as a real
   app shell with a sidebar, search and filters.
2. **The log is ENTIRELY GATED.** Only Kevin and signed-in testers. The public
   surface is a pitch and a play button, nothing more.
3. **Two views inside the log, toggled freely:** a concise synopsis and the full
   detail, so a reader can skim or dive on one topic at will.
4. **Search covers everything generated:** changes, known bugs, in-flight work,
   arcs.
5. **Notes are one markdown file per deploy** in this repo (`notes/2026-07-30.md`).
   Kevin writes prose, the generator merges it. Revisable later, no format to
   learn, never touches the game repo.

## The architecture decision that falls out of #3

> "the concise points have to truly be the concise highlights or no one will read
> it, I know it haha. been down that road before."

He is right, and it settles how the two views are built. **A machine cannot pick
highlights.** No heuristic over 277 commits knows which three mattered; every
"top N by heuristic" degrades into a second full list with extra steps, which is
exactly the road he has already been down.

So the two views are not one dataset filtered twice. They are **two different
sources**, which is A12's founding "generated spine, authored highlights" split
finally doing real work:

| View | Source | Who writes it | Fails how |
|---|---|---|---|
| **Concise** | `notes/<date>.md` | Kevin, prose | Stays empty if unwritten. Never bloats. |
| **Full** | `git log`, generated | The machine | Complete by construction. Never lies. |

The concise view is **structurally incapable** of filling with noise, because
nothing can add to it except a human deciding something was worth saying. That is
the whole trick, and it is why this survives contact with a 150-commit day.

The dive-in path is the join between them: a note names a topic, and the topic
expands to the generated commits behind it. Notes reference scopes (`coop`, `fx`,
`balance`) and the generator resolves each to its real commits, so "read more"
lands on evidence rather than on another summary.

## Type: match the game exactly, and know what "exactly" means

Verified in `src/ui/whompOfferTheme.ts` and `src/ui/mainMenu.ts`:

- Title wordmark and body: `'Segoe UI',system-ui,-apple-system,sans-serif`
- Title weight: **900, never 1000** — the main menu documents that synthesized bold
  at 1000 squishes on the Mac/Safari SF fallback
- Wordmark size: `clamp(60px,12vw,150px)`, and the retro layering scales WITH the
  clamped size so the offsets hold at every width
- Mono, for diagnostics only: `ui-monospace,SFMono-Regular,Menlo,Consolas,monospace`
- `Impact` is a deliberate one-off for drawn wordmarks, not for copy

**Do not ship a webfont.** `'Segoe UI'` is a Windows face, so on Kevin's Mac the
game itself already falls through to SF. Loading a webfont would make the site
identical across platforms and therefore DIFFERENT from the game on Windows, where
the game gets real Segoe UI. Using the identical stack is the only thing that makes
the site and the game agree **on the same machine**, which is the sense of "exactly"
that a reader can actually perceive. The site already uses this stack; the glow-up
adds the 900 weight and the size-scaled layering.

## VOICE: the concise view is written for gamers, not engineers

Director, 2026-07-30: testers are mostly gamers, so treat them like customers. Get
them excited about what is new and what is coming, and tell them plainly what got
fixed. Humanized, no AI tells, and **no em dashes anywhere**.

This resolves the tension the two-source split creates. The generated feed is
engineer language by nature ("fix(coop): the input conflict detector was blind to
the whole aimed-core half"), and no automatic rewrite of that is going to be both
accurate and readable. So:

- **The concise view is the product.** It is the default, it is authored, and it is
  the only thing most testers will ever read.
- **The full view is labelled for what it is:** the raw engineering log, unedited.
  Framing it honestly turns its density from a failure into the point. Almost no
  studio publishes this, and a curious player opening it should feel let in rather
  than lost. One line of framing above it does that work.

### Rules for the concise view

- Talk to the player. "You" and "your", not "the user" or "players".
- Lead with what changed FOR THEM, not what we did to the code.
- Game words, never code words. "Your health regen", not `duelRegenHps`. "The
  arena", not `duelSim`. No shas, no file paths, no test names, no percentages of
  a constant nobody has heard of.
- Excitement comes from specifics, not adjectives. "Every stalemate disappeared"
  beats "massively improved balance".
- Name bugs plainly, with no drama and no apology tour. Players respect a studio
  that says what broke.
- Short. If a note runs past a short paragraph it belongs in the full view.

### The four buckets

Every concise entry is one of these, and the labels are player-facing:

| Bucket | What goes in it |
|---|---|
| **New** | Content and features a player can go and do |
| **Better** | Feel, quality of life, performance, anything that improves what exists |
| **Fixed** | Bugs, named plainly |
| **Coming** | What is next. Spoiler-gated per the wiki ruling, so unreleased content sits behind click-to-reveal even for signed-in testers |

### A real translation, from tonight

The generated line, which is what the full view shows:

> `balance(pvp): the regen ceiling scales with the fight, and the damage profile
> pays for it`

The concise entry, which is what a tester reads:

> **Fixed. Duels were dragging on.** Everyone was regenerating health at the same
> rate whether they built for it or not, so fights that should have ended kept
> going. That is fixed, and we retuned damage alongside it so hits land harder and
> you can actually see a health bar move. In testing, every single stalemate
> disappeared.

Same fact, no jargon, no em dashes, and it gives a player a reason to care.

## Build order

1. **Split the surfaces.** Landing becomes pitch-only. Move the feed behind the gate.
2. **Sign-in.** Reuse the accounts worker whose UI shipped in deploy 46, so one
   identity spans game and site. This gates everything in `/log`.
3. **The notes pipeline.** `notes/*.md`, front-matter for date and title, merged
   into the generated spine. Ship with the first real note so it is exercised.
4. **The two-view toggle**, with the sources above. Concise is the default landing
   state inside the log.
5. **Search.** Build a small JSON index at generate time over changes, bugs,
   in-flight and arcs. Client-side filter, no service.
6. **Glow-up pass** over both surfaces: the 900 weight, size-scaled chromatic
   layering, flat plinths and zero blur per the de-BOO doctrine, the icon's radial
   ground.

## Historical open items and resolution

- **Resolved:** known bugs and in-flight work needed a real source. At the time
  they would have come from
  CAMPAIGN's standing debts, which the 2026-07-29 audit found had gone stale
  (reports 141/142 listed open when both were fixed and wired). Deriving them from
  a stale hand-list would publish wrong information to testers. This wants the
  A13 staleness test first, or an explicit hand-curated list that admits it is
  one. The site now derives aggregate counts from verified `BUG_INVENTORY.md`.
- **Resolved:** the shared data layer with A11 (wiki) and A13 (memory index).
  Schema 7 now exports every public catalog and the site fails closed when a new
  domain lacks a route.
- **Resolved:** the GitHub Pages repo exists and is deployed through
  `bin/deploy-site.sh` with explicit source-push authorization per release.
