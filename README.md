# whomp-site

The public WHOMP page: a marketing pitch that doubles as a development log.

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
node bin/generate.mjs --repo ../whomp --out index.html
node bin/generate.mjs --repo ../whomp --offline   # skip the live sha fetch
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

- Sign-in. The gated section renders its real shape but is not wired. It plugs into
  the accounts worker that the game's deploy 46 ships the UI for, so one identity
  spans game and site.
- Deploy. No GitHub repo exists yet; creating and pushing one needs Kevin's word.
- The daily cron and the per-deploy refresh.
- The shared data layer with A11 (wiki) and A13 (memory index). All three derive
  from the same registries and repo state, and three separate derivations would
  drift within a week.
