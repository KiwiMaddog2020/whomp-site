# Game sites fixtures (step S3)

Stand-in exports for `bin/hub.mjs` while the real ones do not exist. **None of
this is any game's data.** Every `site-data.json` here says `"fixture": true`,
which `bin/hub.mjs` refuses unless `--allow-fixture` is passed (the preview build
and the tests), and every page drawn from one carries a FIXTURE banner.

- `pinball/`: the pilot's route (`/pinball/`), placeholder rows only. Replaced by
  Pinball's own `site/site-data.json` once step S2 (Pinball's exporter) lands.
  Its `game.kit.json` has no `nameCleared`, so it exercises the hidden path.
- `cleared-demo/`: an invented game whose `game.kit.json` carries
  `"nameCleared": true`, so the cleared path (no noindex, no Disallow) is tested.
