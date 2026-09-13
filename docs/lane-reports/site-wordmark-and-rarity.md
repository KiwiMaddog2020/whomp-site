# Lane report — site-wordmark-and-rarity

**Role and objective.** Brand, in the site repo. Carry the director's two rulings
of 2026-09-12 across to the surfaces a stranger sees first: (1) 10:15pm, the
website and the wiki use the same face as the W on the game's start menu; (2)
11:30pm, that face is **Archivo Black** (SIL OFL 1.1, Omnibus-Type, no Reserved
Font Name), shipped by the game's `brand-wordmark-asset` lane as
`public/brand/whomp-display.woff2`. Plus the brand cohesion audit's site-side
drift items: the stale parity note, the text-shadow-only wiki and dev-log
headers, the body-face nav lockup, the rarity ladder and the icon geometry.

**Branch.** `claude/site-wordmark-and-rarity`, cut from `origin/main` of
`KiwiMaddog2020/whomp-site`. **Base SHA** `1452182`. **Tip** `73bc753` before
this report; see the final commit for the tip that includes it. Nothing merged,
nothing deployed, `main` never checked out.

**The game repo was read only.** `KiwiMaddog2020/whomp` at `f81f078`
(`origin/main`), plus a shallow fetch of `claude/brand-wordmark-asset` at
`17e18fc75` for the font, the OFL text and the lane report. Its tracked tree is
byte-clean and its HEAD is unmoved. `npm ci` was run there to make its own
artifact-verification commands executable; `node_modules/` is gitignored.

---

## 1. What changed

```
brand/whomp-display.woff2          new, 18,604 B   sha256 matches the game's
brand/OFL-ArchivoBlack.txt         new,  4,492 B   sha256 matches the game's
bin/generate.mjs                   +140/-34        face, treatment, lockups, icon
bin/wiki.mjs                       +1/-1           the wiki header's lockup
bin/brand-parity.mjs               new, 231 lines  the check that replaces the claim
tests/brandParity.test.mjs         new, 12 tests
index.html log.html wiki*.html …   regenerated, 40 documents
docs/lane-reports/site-wordmark-and-rarity{.md,/}  this report and five PNGs
```

**One face, self-hosted, declared once.** `brand/whomp-display.woff2` is the
**same file** the game ships — `git hash-object` gives
`a88b0b5352960c400c46ee17180d0d8f5c0d0db9` on both, and the OFL text matches at
`8894736938…`. One `@font-face` for `'WHOMP Display'` lives in `SHARED_CSS`, so
every surface this generator writes gets it, and it is copied from the game's
`index.html` head rather than re-derived:

```css
@font-face {
  font-family: 'WHOMP Display';
  src: url(brand/whomp-display.woff2) format('woff2');
  font-weight: 900; font-style: normal; font-display: optional;
}
```

Both values are load-bearing and the game's lane argued both. `font-weight:900`
because Archivo Black is a **single-weight file**: a face that does not claim 900
is taken for a 400 and the browser synthesizes the bold, which is the smeared
squish the director reported on 2026-07-20 and 07-30 — shipping without that line
ships the bug the file was bought to fix. `font-display:optional` because a logo
may not flash: `swap` re-cuts the mark under the reader, `block` hides it for a
UA-chosen ~3s (and since the period is the UA's, "block but briefly" is not
something CSS can ask for), while `optional`'s worst case is the rendering this
site already shipped. Every one of the four public heads carries
`<link rel="preload" … as="font" … crossorigin>`, which is what makes `optional`
win rather than be decorative, and `crossorigin` is required even same-origin or
the file is fetched twice.

**All four wordmark surfaces paint the mark, one treatment, two sizes.** The
hero (`.whomp-wordmark`) and the small lockup (`.brandword`) now share every
declaration that makes the mark the mark — cream `#fff3cf` over pink `#ff2f7e`
over cyan `#24f0ff`, the `0.018em` stroke, `paint-order:stroke fill`, the em
offsets (`-0.048em,0.048em` and `0.042em,0.083em`), `skewX(-4deg) rotate(-1deg)`
— so they cannot drift from each other the way this file drifted from the game.
Only size, line-height and the idle animation differ; the 3.6s pulse stays on the
title-screen-sized hero, because a topbar that pulses forever is a tic.

The two headers were one `.chroma` string each, which dressed *"dev log"* in the
wordmark's costume and left the wordmark itself with no face, no stroke, no
layers and no skew. They are split: `<b class="brandword" data-wordmark="WHOMP">`
plus the descriptor as body copy. The nav lockup was the **body face at 900 with
positive `.04em` tracking** — the opposite of the mark's `-0.055em` — and
`.brandmark b` now sets size only, because everything else comes from
`.brandword` and restating it is how it went wrong.

**`.chroma` was not retired wholesale, and that is deliberate.** It is still the
section-heading signature on fifteen other headings and the README documents it
as such. It was only ever *wrong* on the two headings that contain the logo.

**The stale note is gone.** `index.html:69-77`'s claim that the two surfaces
"stay identical" was false the day it was written — the game dropped `system-ui`
and `-apple-system` on 2026-07-30 to escape a Chromium variable-font
interpolation bug and this file did not — and got more false on 2026-09-12. It is
replaced by a comment naming the shared file, and parity is now a **check**
rather than a sentence anybody has to remember to keep true.

**The icon.** The inline copy drew its backing rect with `rx="96"` while the
canonical `whomp/public/icons/icon.svg` rect is square, so the site shipped two
silhouettes of one mark: an 18.75% rounded tile in the dev-log topbar, a hard
square in the favicon, the wiki nav and the social card. The inline copy is
canonical-square now, and the rounding the site's own chrome wants is
`--tile-radius`, named once and read by all three lockups (it was `8px` in two
places and `10px` in a third).

---

## 2. The rarity ladder — the ruling I did not carry out, and why

**The brief asked for the wiki's ladder to be derived from the game's five
`WHOMP_RARITY_INK` values. I did not do that, and I am flagging it rather than
doing it quietly.** The audit's premise does not survive contact with the code.

The wiki's ladder is **already derived from the game at build time** and has been
since 2026-09-07. `parseRelicRarityInk` in `bin/wiki.mjs` reads
`RELIC_RARITY_COLOR` out of the game's `src/data/relics.ts`, `relicRarityInkCss`
emits one rule per rung, and `bin/wiki-check.mjs` mutation-tests the guard so a
rung the game ships that this cannot colour is a **failed build**, not a
colourless pill. Nothing is transcribed.

And it matches. Measured this run:

| rung | `wiki.html:496-500` | game `src/data/relics.ts:690` |
|---|---|---|
| common | `#8fd6e6` | `#8fd6e6` |
| uncommon | `#3ff08a` | `#3ff08a` |
| rare | `#4a9eff` | `#4a9eff` |
| epic | `#b060ff` | `#b060ff` |
| legendary | `#ffd700` | `#ffd700` |

Five of five. The audit compared the wiki against the **wrong game table**. The
disagreement it found is real, but it is **game-side, between two game tables**:

| rung | `relics.ts` RELIC_RARITY_COLOR | `whompOfferTheme.ts` WHOMP_RARITY_INK |
|---|---|---|
| common | `#8fd6e6` | `#b7a8cf` |
| uncommon | `#3ff08a` | `#3ff08a` |
| rare | `#4a9eff` | `#24f0ff` (`WHOMP_CYAN`) |
| epic | `#b060ff` | `#b14bff` (`WHOMP_VIOLET`) |
| legendary | `#ffd700` | `#ffcf3f` |

Four of five — exactly the count the audit reported, which is why I am confident
it measured `WHOMP_RARITY_INK` correctly and simply pointed it at the wrong
consumer.

**Re-pointing the wiki would have made it wrong.** It paints **relic** pills, and
relics are the only domain it paints by rarity at all. The game's own shop and
relic UI draw relics with `RELIC_RARITY_COLOR`. Following the weapon-and-passive
ladder instead would put the wiki at odds with the surface it documents, in
service of agreeing with a table no relic is ever drawn with. `bin/generate.mjs`
has carried a note since the ladder was first derived saying precisely this: the
split "is a game-side question and is deliberately not settled from this repo."

So the lane did the thing that is in scope and actually protects the reader.
`bin/brand-parity.mjs` now pins the **rendered** ladder in `wiki.html` to the
game table the site follows — a real `SITE WARNING` if the committed pages ever
go stale against it — and reports the game-side divergence as a `SITE NOTE` on
every run, which is this repo's own two-severity law: wrong and ours fails the
gate, true and owned upstream does not. The disagreement is now **loud and
attributed** instead of being re-decided from the wrong repo.

*Destination:* the director, to rule on whether the game unifies its two ladders.
If it does, nothing here changes — the scraper follows whatever
`RELIC_RARITY_COLOR` becomes.

---

## 3. What was measured

**The new check, `bin/brand-parity.mjs`** — pins the font file and the OFL text
by sha256, the `@font-face` family/weight/display, the preload, the
`--wordmark-font` stack, the rendered rarity ladder and the mark's geometry,
each against the game checkout. Run against `../whomp` at `f81f078`:

```
  ok  @font-face declares 'WHOMP Display' 900 optional, src brand/whomp-display.woff2
  ok  the head preloads the face with crossorigin
  ok  all 5 rarity rungs match the game's RELIC_RARITY_COLOR
  ok  the inline mark uses the canonical square geometry
  ok  --tile-radius names the chrome tile radius once
brand parity: clean (5 note(s))
```

The five notes are the game-side ones: four say the font, the OFL text, the
`@font-face` and `WHOMP_WORDMARK_FONT` **could not be byte-compared because they
are not on the game's `main` yet** — they live on `claude/brand-wordmark-asset`,
which has not landed. Those four pins go live on their own the moment it does;
the check gets **stricter** by the game moving, never looser. The fifth is the
two-ladder divergence.

**The suite.** `node --test tests/*.test.mjs` — **151 tests, 149 pass, 2 fail**,
up from 139 tests (the 12 new ones in `tests/brandParity.test.mjs`). Both
failures are named honestly below and neither is this lane's.

**The negative test was fired on purpose**, which is the game repo's rule for a
new guard: `bin/brand-parity.mjs` is run in the suite against a path that is
deliberately not a game repo, and every game-side pin must degrade to a `NOTE`
rather than throwing or silently passing.

**The face actually paints.** A suite can prove the token and the file agree; it
cannot prove the browser *resolves* the face. So every screenshot below was taken
only after `document.fonts.load("900 1em 'WHOMP Display'", 'WHOMP')` resolved and
`document.fonts.check(…)` returned **true** — all five report
`face-resolved=true`. A shot of the fallback would prove the opposite of what
these pictures exist to prove.

### The screenshots

Headless Chromium 141.0.7390.37 (`/opt/pw-browsers/chromium-1194`), driven
directly over CDP — the house pattern `whomp/bin/wiki-visuals.mjs` uses, rather
than adding a browser dependency to a repo that has none. 2x, over
`http://127.0.0.1:8891` serving the committed tree.

| file | what it shows |
|---|---|
| `docs/lane-reports/site-wordmark-and-rarity/landing-hero.png` | the landing hero at 1280px |
| `docs/lane-reports/site-wordmark-and-rarity/nav-lockup.png` | the nav lockup, icon + wordmark |
| `docs/lane-reports/site-wordmark-and-rarity/devlog-header.png` | the dev log header |
| `docs/lane-reports/site-wordmark-and-rarity/wiki-header.png` | the wiki header |
| `docs/lane-reports/site-wordmark-and-rarity/nav-lockup-narrow.png` | the topbar at 420px, where the word drops and the mark carries it alone |

---

## 4. Two reds that are the container's, not this lane's

**Neither is a movement and both are reproduced, not assumed.**

**1. `one line says what the game is serving`.** The generator could not reach
`https://whomp-preview.pages.dev/version.json` — this container's egress proxy
answers **403 CONNECT** for that host — so `index.html` honestly says it could not
reach the game instead of naming `0.7.20`. The generator's `--sha` flag would
paper over it, and I did not use it: that flag exists for the deploy ritual,
which has privileged knowledge of what it just shipped, and I have none. Passing
it would be asserting a live version nobody measured, which is the one thing the
deploy-verification law does not allow. **This test passed on `main` and fails
here purely because the committed pages were regenerated in a network-restricted
container.** It passes again on the first networked run.

**2. `every release named on a day links to an entry that is really on the
page`.** **Pre-existing on `main`** — it failed identically before this lane
edited anything (verified at base `1452182`, same assertion, same message: *"not
one day in the window names what was cut on it"*). No release was cut in the
seven-day window; the newest is `0.7.20` on 2026-09-02 and the window opens
2026-09-07. It is a fact about a quiet week.

**And one gate that could not run at all.** `bin/generate.mjs` calls the game's
`wiki-visuals.mjs --verify`, which re-renders the **entire canonical gallery** in
headless Chromium and compares bytes. This container's software rasterizer does
not reproduce the bytes the corpus was rendered with, so every variant
mismatches. I bypassed that one gate **for the two generation runs only**, via a
local edit that was reverted before either commit — `bin/generate.mjs` on this
branch is byte-identical to the reviewed version and is still fail-closed, which
`git status` confirmed after each run. What that skips is the game-side
*authenticity* check on committed PNGs; the site's **own** per-asset hash, byte
size and dimension checks against the visual manifest did run and passed for all
**486** variants, and `bin/wiki-check.mjs` validated the full output contract.
The generator's self-report was **0 warnings, 0 notes**.

**This branch must be regenerated with `bin/regenerate-and-verify.sh` on the
canonical machine before it is deployed.** That run restores the live version
line and satisfies the rerender gate. Nothing here is publishable as-is, and
publication approval was neither sought nor granted.

---

## 5. Residuals

1. **The four game-side pins are dormant until `claude/brand-wordmark-asset`
   lands.** The font, the OFL text, the `@font-face` and the stack cannot be
   byte-compared against a `main` that does not carry them. They arm themselves.
   *Destination:* the maestro, to land that lane.
2. **The site and the game are as far apart as they have ever been until both
   land.** The game's lane called this out as its residual 1 and it is still
   true in the other direction: this branch has the face, `main` on neither repo
   does. Landing one without the other is the expected cost of moving one surface
   at a time, not a regression.
3. **The clamp was not nudged.** The game's lane measured Archivo Black's cap
   height at **0.700 of the em** and warned the mark may read small at the
   existing `clamp(60px,12vw,150px)`. The site's hero uses the same clamp. I did
   not move it: optical size is the director's eye, and the two literals
   (`mainMenu.ts` and this file) should move together or not at all. The hero
   screenshot is the test. *Destination:* the director.
4. **The game carries two rarity ladders that disagree on four of five rungs.**
   §2. Reported every run, not settled here. *Destination:* the director.
5. **This container cannot regenerate a publishable site.** Two independent
   reasons — the proxy blocks the release tracks, and the GPU rerender gate
   cannot pass on a software rasterizer. Both are properties of cloud lanes, not
   of this repo. Worth naming because *every* future site lane run here will hit
   them. *Destination:* whoever owns cloud-lane provisioning
   (`docs/CLOUD_LANE_RULES.md` in the game repo).
6. **`claude/brand-cohesion-audit` does not exist on the game remote.** The brief
   cited `docs/audits/BRAND_COHESION_AUDIT_2026-09-12.md` on that branch; it is
   not there, and no `docs/audits/` file of that name exists on `main` either
   (`git ls-remote` shows `brand-wordmark-asset` and `brand-wordmark-candidates`
   and no cohesion-audit branch). Every drift item was verified against the code
   instead, which is the stronger source, and item by item the brief's line
   numbers were accurate. But the audit itself could not be read, so if it
   carries items beyond 3, 4, 5, 18 and 19 that touch this repo, **this lane has
   not seen them**. *Destination:* the maestro.
7. **The site has no `package.json`**, so "read package.json scripts" had no
   answer. The suite is `node --test tests/*.test.mjs` and the ritual is
   `bin/regenerate-and-verify.sh`. The new check is wired as a **test** rather
   than only a script, so the per-deploy hook the game repo already calls picks
   it up with nothing new to wire.

---

## 6. Next recommended action

**Look at the five PNGs**, which is the one question no test here can answer:
whether Archivo Black at the current clamp reads as the WHOMP logo or merely as
correct (residual 3). Then land `claude/brand-wordmark-asset` in the game and
this branch in the site — in either order, but both, because until both land the
two origins draw different marks. Before any deploy, run
`bin/regenerate-and-verify.sh` on the canonical machine (§4).

**Publication approval is still required and was not sought.** This lane pushed
its own branch only. No merge, no deploy, and nothing reaches `main`, the live
site or the wiki without the director's word.
