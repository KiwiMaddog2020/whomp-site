# game-sites-s3

VERDICT: PARTIAL. The hub is built and tested, but it renders through an interim renderer and a fixture export: kit S1 (`origin/claude/game-sites-s1`) did not exist when this ran, and Pinball's S2 exporter has no go yet. No deploy, no push to main, the live site untouched.

Go: Kevin, desk chat, 2026-10-24 20:15:46Z, `go whomp game sites 3eeb60943e S1 S3` (desk inbox M46, receipt PASS). Plan: whomp `docs/studio-os/plans/GAME_SITES_2026-10-24.md` at `3eeb60943e`.

## Routes
For every game checkout passed as `--game` that ships `site/site-data.json`:

| Route | File |
|---|---|
| `/<game>/` | `<game>/index.html` (landing: name, icon, play button, catalogs, Next) |
| `/<game>/wiki/` | `<game>/wiki/index.html` (one table per catalog, every cell read from the export, anchors `#<catalog>` and `#<catalog>-<row>`) |
| `/<game>/log/` | `<game>/log/index.html` (exported `log` entries newest first, `next`; "No entries exported yet." when there are none) |

Plus `robots.txt` and the game's rows appended to the one `search-index.json` (same 5-key row shape as WHOMP's; WHOMP's rows unchanged and first; re-runs replace by folder rather than duplicate).

- `bin/hub.mjs`: contract check, loader, interim renderer, noindex/robots rules, link check, search rows, CLI (`node bin/hub.mjs --game <dir> --outdir <dir> [--kit <whomp-kit>] [--allow-fixture] [--base /]`).
- `bin/generate.mjs`: takes the same flags and runs the hub only when `--game` is given (+26 lines, every use guarded by `hub`), so a plain run writes what it wrote before.
- Hidden until cleared: only a literal `"nameCleared": true` in the game's `game.kit.json` clears it. Otherwise every page gets `<meta name="robots" content="noindex">` in `<head>` (the hub adds it whatever the renderer drew, and refuses a cleared page that still carries one), and robots.txt has `Disallow: /<game>/`. A missing `game.kit.json` counts as not cleared.
- Fixtures never ship: an export with `"fixture": true` is refused unless `--allow-fixture` is passed, and every page drawn from one has a FIXTURE banner.

## What waits on S1 and S2
- **S1 (kit `site/`):** the hub loads `<kit>/site/index.mjs` through `--kit` when it exports `renderSitePages(game) -> {landing, wiki, log}`, and otherwise uses the interim renderer. The kit renderer has to keep the anchor ids above, because the search rows link to them (the hub refuses a renderer that drops them; there is a test for that). The contract fields `log` and `next` are this hub's reading of "dev logs, automatic"; S1's schema decides them, and `siteDataProblems` follows it. `nameCleared` is not in the kit's `game-kit.schema.json` yet (`additionalProperties: false`), so S1 or S5 has to add it before any game can set it.
- **S2 (Pinball exporter):** Pinball is piloted with `tests/fixtures/game-sites/pinball/` (placeholder rows, `"fixture": true`, name "Pinball (fixture)", play URL `fixture.invalid`). No Pinball facts appear in any page. When S2 lands, pass Pinball's checkout as `--game`.
- **Deploy (not this lane):** `bin/deploy-site.sh` is unchanged and passes no `--game`. A robots.txt only works at the host root (`playwhomp.com/robots.txt`), and the GitHub Pages project path does not give it one, so the noindex meta is what hides the pages until the hub is served from playwhomp.com. Wiring `--game` into the deploy belongs with Kevin's deploy go. A game that later leaves the hub leaves its folder behind: the retirement sweep only covers `wiki*`.
- The on-site search includes uncleared games' rows, as the brief asks ("one search index across games"). The index sits at the root and is not under the Disallow. If that counts as unhidden, filter on `cleared` in `buildHub`.

## Tests (verbatim totals)
`node --test tests/hub.test.mjs`: `# tests 24  # pass 24  # fail 0  # skipped 0`

`node --test tests/*.test.mjs` (whole suite): `# tests 204  # pass 201  # fail 1  # skipped 2`. On main before this lane it was `# tests 180  # pass 177  # fail 1  # skipped 2`. The single failure on both is #57, "the committed story still describes a window that includes today" (`the newest day in the story is 2026-10-21`). That test depends on the date and fails on main the same way.

WHOMP unchanged (quoted from the tests):
- `ok - a hub run into the site leaves every WHOMP page byte-identical to main, and WHOMP's search rows fact-identical`: 39 outputs from `origin/main` (every root `*.html`, both icons) compared byte for byte after a two-game hub run. `search-index.json` minus the hub rows deep-equals main's.
- `ok - this branch changes no WHOMP output file against main`: `git diff --name-only origin/main` over every WHOMP output and `wiki-assets` is empty.

Negative tests were made to fail on purpose. With `applyRobots` mutated to strip noindex, 4 tests failed. With `Disallow` mutated to `Allow`, 1 failed. Both mutations were reverted.

`bin/wiki-check.mjs` stays green. It was run with `--repo` = whomp at `3f85c6f084` (the sha the committed site was generated from) on a copy of the site with the Pinball fixture hub output and its manifest entries added: EXIT 0, the same result as on main's output. A full `bin/generate.mjs` run could not complete in this container, which is the known gate: `wiki-visuals.mjs --verify` needs `vite`, and there is no `node_modules` in the whomp clone. So the `generate.mjs` wiring is held by the source-shape test and was not exercised end to end.

Preview: built locally only (`node bin/hub.mjs --game tests/fixtures/game-sites/pinball --outdir <scratch> --allow-fixture`). At 390 px all three pages render with no horizontal scroll and `meta robots = noindex`.

## Files
`bin/hub.mjs` (new), `bin/generate.mjs`, `tests/hub.test.mjs` (new), `tests/fixtures/game-sites/` (new), `docs/claims/game-sites-s3.claims`, this note.
