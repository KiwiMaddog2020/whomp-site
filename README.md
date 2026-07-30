# whomp-site

The public WHOMP page: a short pitch (`index.html`) and the real development log
(`log.html`).

## Two surfaces

- **`index.html`** is the short public landing page: mark, tagline, live build
  chip, play button, arcs. It is deliberately small and never grows.
- **`log.html`** is the real dev log: sidebar, search, filters, and a toggle
  between two views of what shipped.

## Two views inside the log

- **Concise** (default) is Kevin's own notes, one file per update in `notes/`.
  A machine cannot pick highlights, so this view is only ever what a human
  decided was worth saying.
- **Full** is the generated feed straight from `git log`, labelled honestly as
  the raw engineering log. Nothing is cleaned up for the reader.

The log also carries a **known bugs** list (parsed from the game repo's
verified `docs/BUG_INVENTORY.md`, OPEN items only) and an **in flight** section
(the campaign arcs plus a few backlog teasers), and a small generated
**search index** covering all of it.

## Gating

Director change 2026-07-30: the log is **public** for now, no sign-in required
to read it, so early testers can just reach it. The sign-in control (reused
from the game's accounts worker) still works on both pages. `log.html` keeps a
single `GATING_ENABLED` switch in its own script, off by default, that already
wraps the page's content in a `.gated-section` ready to hide behind sign-in
later, no template rewrite needed. See the comment next to that switch.

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
node bin/generate.mjs --repo ../whomp                # writes index.html, log.html, search-index.json
node bin/generate.mjs --repo ../whomp --offline       # skip the live sha fetch
bin/deploy-site.sh                                    # regenerate and push to GitHub Pages
```

The page says so plainly when it could not reach the live build, rather than
inventing a sha.

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

- The daily cron and the per-deploy refresh: today `bin/deploy-site.sh` is run by
  hand.
- The shared data layer with A11 (wiki) and A13 (memory index). All three derive
  from the same registries and repo state, and three separate derivations would
  drift within a week.
- Real gating, see the Gating section above.
