# Lane: site-hero-v2

Local Mac lane, `whomp-site` only. Objective: place the director-signed v2
marketing hero, the new 4:5 phone hero and the v2 link card on the landing page.
The game repo and its worktrees were never modified.

**Verdict: PLACED, checks green except one failure that predates this lane
and has nothing to do with it (below). Not pushed and not published.**

## Authority

- Director pass 13 (2026-09-29 1:20 am) signed three masters:
  - `website-hero-v2`, sha256 `83886c0b798e4dc059ecb75563a24c7ecb5e62f59e0a031dceff2ae1e9d31bc4`
  - `website-hero-mobile-v2`, sha256 `bf4c25e33dc3327b99ecf40821437eb9006207aabb643ffb5a3264c9d814d094`
  - `share-card-v2`, sha256 `9772e0f111f1a2ff0196b619dd42d478e1b6cf41c2acf738469f33a75da040ec`
- Board v90 site-go-live (12:12 pm): "publish when the placement lands and
  passes its checks".
- Kit (read-only): the game repo's briefs worktree,
  `docs/train/kits/marketing-kit-2026-09-28/`. The kit's integration notes are
  in `docs/CODEX-HANDOFF-v2.md`, pointers 4 to 6.

## Branch

| | |
|---|---|
| branch | `claude/site-hero-v2`, worktree `/Users/kevin/whomp-worktrees/site-hero-v2` |
| base | `3b69698`, the unmerged v1 placement tip (`claude/marketing-hero-2026-09-28`), itself on whomp-site `main` `7efceee` |
| commits | `5c2e490` assets, `4a709e0` hero, `46f4382` card, `67c4f61` README, then this report |

The branch was cut at the v1 tip by the conductor's ruling (b), after the
house merge guard refused a fast-forward merge into a lane checkout. So the
branch carries the four v1 commits under this lane's. Landing it into `main` is
the site's own door, from the canonical checkout.

## Files

| file | change |
|---|---|
| `brand/hero/website-hero-{800x450,1200x675,1600x900}.<hash>.{webp,jpg}` | six new wide exports |
| `brand/hero/website-hero-mobile-{720x900,1080x1350}.<hash>.{webp,jpg}` | four new 4:5 phone exports |
| `brand/share-card-1200x630.0c4b793b.jpg` | new card |
| `bin/landing.mjs` | `HERO_ART` is v2; new `HERO_ART_MOBILE`, `HERO_MOBILE_MEDIA`, `HERO_MOBILE_SIZES`; `heroPicture` emits the phone sources first; `SHARE_CARD` is v2 |
| `bin/generate.mjs` | one CSS rule, `@media (max-width:759.98px){.hero-art img{aspect-ratio:4/5}}`, plus comments |
| `index.html` | the same three changes by hand: the picture element, the CSS rule and the card URLs |
| `tests/landing.test.mjs`, `tests/generatedSite.test.mjs` | tests for the signed bytes, the hashed names, v1 left untouched, the source order and boxes, the frozen alt, the 4:5 rule, and the 900px rule still in place |
| `README.md` | the hero and card paragraph |

The six unhashed v1 hero files and `brand/share-card-1200x630.jpg` are still
in the tree with their bytes unchanged, and a test pins that. No other page
changed. Log, wiki and pitch keep `whomp-icon-512.png` as a `summary` card.

## Hashes

The copy was eleven literal `cp` commands, then `shasum -a 256`. Every copy
matches its `package: WHOMP-marketing-kit-2026-09-28-v2` row in the kit's
`metadata/exports.json` on sha256, and the kit rows also match on byte count.

| file in repo | sha256 | master |
|---|---|---|
| brand/hero/website-hero-800x450.8659c006.webp | 8659c00608dbd51a37c1c602f07fd79a30978484107cd451ab6707c53f5db29b | 83886c0b |
| brand/hero/website-hero-800x450.3ab66b1a.jpg | 3ab66b1a5c3161d7017b58242298b87944899d57e70177cabc359d3ec3322d29 | 83886c0b |
| brand/hero/website-hero-1200x675.afc9e048.webp | afc9e048de6043df144592461211863809e9e17049761679bbaa0853d8861d34 | 83886c0b |
| brand/hero/website-hero-1200x675.316cb4a9.jpg | 316cb4a986904c2e213663d6e7e275b77a92847ea7ae8b620d9f552ae0ee364d | 83886c0b |
| brand/hero/website-hero-1600x900.9eb902df.webp | 9eb902df162d6a5c299a592537966a255a10057adc323ef70efb53ea5be72b84 | 83886c0b |
| brand/hero/website-hero-1600x900.a8550acb.jpg | a8550acb0b2bc28265fb201990adde2cd29ace46e9f8845cde87fa7b0ed1a287 | 83886c0b |
| brand/hero/website-hero-mobile-720x900.d3868d96.webp | d3868d967a28ab23559300f23803e30f99926d7c503e946065a8165a897f5097 | bf4c25e3 |
| brand/hero/website-hero-mobile-720x900.53afe503.jpg | 53afe5030c6ff4d306add1477d7f6db7fb18581759eb03a82e07bdeaa1e75bac | bf4c25e3 |
| brand/hero/website-hero-mobile-1080x1350.7f9860cc.webp | 7f9860ccb321877336eeba5d9f85c80e59141d4f5dec59dec12d96ff3fa4848d | bf4c25e3 |
| brand/hero/website-hero-mobile-1080x1350.89fda3ed.jpg | 89fda3ed9215ba9e117b7c02d3773bfbe37eb380e2dc578e99109feb83b9434f | bf4c25e3 |
| brand/share-card-1200x630.0c4b793b.jpg | 0c4b793be9451d218b29e5c66ab462f6fb2e49649cbf5f93340f4542be44781f | 9772e0f1 |

The short hash in each name is the first eight hex of that file's own sha256.

## What the page does

- **Picture order.**
  1. Phone WebP, `media="(max-width: 759.98px)"`, 720w and 1080w, `sizes="100vw"`, `width="1080" height="1350"`.
  2. Phone JPEG, same media and sizes, so a phone without WebP still gets the crop.
  3. Wide WebP, 800w, 1200w and 1600w.
  4. The wide JPEG `img` fallback, `width="1600" height="900"`, `alt=""`.
- **Why 759.98px.** It stops a fractional width such as 759.5 from falling
  between the queries. Range syntax was avoided because older Safari drops the
  whole source on it.
- **Reserved box.** CSS sets `aspect-ratio:4/5` on the img under the same query,
  so the box does not depend on whether a browser honours width and height on
  a `<source>`.
- **The 900px copy breakpoint is untouched.** So 760 to 900px is the stacked
  layout over the wide art, as the handoff leaves it.
- **Copy unchanged.**
  - The wordmark H1.
  - "Politely violent."
  - "A 3D horde-survivor. Play in your desktop browser."
  - Play WHOMP linking to `https://playwhomp.com/`.
  - The WIKI and DEV LOG row.
- **Card.** `og:image` and `twitter:image` point at
  `https://kiwimaddog2020.github.io/whomp-site/brand/share-card-1200x630.0c4b793b.jpg`,
  1200x630, `summary_large_image`. `og:image:alt` and `twitter:image:alt` are
  the kit's frozen text, word for word, "cyan" included.

## Build

`bin/regenerate-and-verify.sh` and `bin/deploy-site.sh` refuse to run in a
folder not named `whomp-site`, and nothing was renamed. `node bin/generate.mjs`
was **not** run: before writing, it runs the game repo's `data-layer.mjs
--check`, `tier-engine.mjs --verify` and `wiki-visuals.mjs --verify` (a full
rerender) inside the game checkout. This lane may not touch that checkout, and
the Mac was carrying a landing chain.

So, as the v1 lane did, `index.html` was edited by hand and then checked by a
scratch script. The script confirms that the file carries, verbatim:

- the generator's whole hero CSS block (3,594 chars of static template text,
  with nothing interpolated into it)
- the output of `heroPicture()`
- `og:image`, `twitter:image` and `og:image:alt` built from `SHARE_CARD`

It also confirms that no v1 hero or card path is left in `index.html`. The next
real regeneration writes the same hero and card from `bin/landing.mjs`.
`node --check` passes on `bin/generate.mjs` and `bin/landing.mjs`.

## Measurements (headless Chrome 154, CDP)

Setup:

- The worktree was served on `127.0.0.1:8765` with the cache disabled.
- One browser, with runs one after another.
- `layout-shift` entries were counted with a buffered PerformanceObserver that
  was installed before navigation.
- The img box was read at `DOMContentLoaded` ("early") and again 2 s after
  `load` ("final").
- The run was repeated under throttling (1.5 Mbps down, 150 ms latency). In
  that run the art had not finished loading at DOMContentLoaded in every case.

| viewport | DPR | source chosen | img box early | img box final | ratio | CSS aspect-ratio | layout | CLS normal | CLS throttled |
|---|---|---|---|---|---|---|---|---|---|
| 1440x900 | 1 | website-hero-1600x900.9eb902df.webp | 1440x810 | 1440x810 | 1.7778 | auto 1600/900 | band, copy over art | 0 | 0 |
| 960x900 | 1 | website-hero-1200x675.afc9e048.webp | 960x540 | 960x540 | 1.7778 | auto 1600/900 | band, copy over art | 0 | 0 |
| 760x900 | 1 | website-hero-800x450.8659c006.webp | 760x427.5 | 760x427.5 | 1.7778 | auto 1600/900 | stacked, wide art | 0 | 0 |
| 759x900 | 1 | website-hero-mobile-1080x1350.7f9860cc.webp | 759x948.8 | 759x948.8 | 0.8 | 4 / 5 | stacked, 4:5 art | 0 | 0 |
| 390x844 (mobile) | 1 | website-hero-mobile-720x900.d3868d96.webp | 390x487.5 | 390x487.5 | 0.8 | 4 / 5 | stacked, 4:5 art | 0 | 0 |
| 390x844 (mobile) | 3 | website-hero-mobile-1080x1350.7f9860cc.webp | 390x487.5 | 390x487.5 | 0.8 | 4 / 5 | stacked, 4:5 art | 0 | 0 |

- **Header heights:** 810 at 1440, 540 at 960, 903 at 760, 1424.2 at 759 and
  955.4 at 390. In each case the height was the same early and final.
- **Other checks:** no page-level horizontal scroll at any width, and zero
  layout-shift entries in all twelve runs.
- **Copy:** the H1, slogan, description, the three links with their hrefs, and
  the card URLs and alt all read back as listed above.
- **Screenshots:** in the lane's scratch dir, not the repo:
  `.../scratchpad/shots/hero-*.png` (viewport),
  `header-*.png` (the whole hero band per width) and `hero-results*.json`.
  At 390 and 759 they show the full 4:5 crop, uncropped, under the copy.

## Tests

`node --test --test-concurrency=1 tests/*.test.mjs` gives 171 tests: 157
pass, 1 fails and 13 are skipped. The baseline at `3b69698` was 169 tests:
155 pass, 1 fails and 13 are skipped.

- **The failure is the same one in both runs:** "the committed story still
  describes a window that includes today". The committed dev log ends
  2026-09-28 and today is 09-29. The date moved, not this change, and the
  site's regeneration fixes it.
- **The 13 skips** are the generated-output and game-repo tests. They skip
  because no game checkout sits at `../whomp` next to this worktree.
- **The new tests were first run against a mutated scratch copy, and each one
  failed on its mutation:**
  - a byte flipped in a v2 export
  - a byte flipped in a v1 file
  - the media query changed to `760px`
- `bin/brand-parity.mjs` printed only SITE NOTEs, and both are about
  the absent game checkout.

## Could not verify

- **The JPEG path.** Chrome picks WebP, so neither the phone JPEG source nor
  the wide JPEG img was exercised by a browser that lacks WebP.
- **Safari and Firefox,** including whether they honour `width`/`height` on
  `<source>`. The CSS `aspect-ratio:4/5` rule is there for exactly that case.
- **Real phones and real network conditions.** Everything above is headless
  Chrome device emulation.
- **How unfurlers render the new card URL** (X, Bluesky, Discord). That needs
  the published URL.
- **A full regeneration from the game repo** (see Build) and the 13 skipped
  tests.

## Observations, not changed

- At 960 the wordmark overlaps the sky of the art and the DEV LOG button sits
  over the grass. That is the v1 band layout between 900 and roughly 1100px,
  and this lane did not touch it.
- The unhashed v1 files (seven files, 1,282,341 bytes) are now unreferenced. They were never
  served, because v1 never reached `main`. They stay because the brief says
  never to overwrite, and removing them is a later call.

## Publish (not run)

Land `claude/site-hero-v2` into whomp-site `main` from the canonical checkout
(`/Users/kevin/whomp-site`), then run:

```
bin/deploy-site.sh
```

from `/Users/kevin/whomp-site` on `main`. It regenerates from `../whomp`,
stages the generator's `.site-outputs` manifest, commits `site: regenerate from
main@<sha>` and runs `git push origin HEAD`; Pages serves `origin/main`.
`bin/regenerate-and-verify.sh` is the pre-publish proof and never pushes.
