# Lane wiki-coverage-honors-exclusions (site)

VERDICT: BLOCKED (brief step 1 stop condition met; nothing changed in bin/wiki.mjs or tests)

## Commits
- This report only. No code change.

## What step 1 found
Read WHOMP main's `data/wiki-visuals.json` (blob ebd2cf63 tree) and searched the generator side.

- Top-level keys: contentFingerprint, coverage, entries, generator, performanceBudget, policies, provenance,
  registryFingerprint, renderer, schema, sourceFiles, sourceFingerprint, surfaceInventory, unavailable.
  No key mentions excluded, pending or unfielded ids, at any depth.
- `policies[domain=enemies]` carries only `domain`, `strategy: runtime-render` and `expectedIds` (62 ids).
  `asterism`, `eclipsewarden`, `lockwright` and `riftHeart` are in neither `expectedIds` nor `entries`.
- `surfaceInventory` (11 surfaces: coreWeapons, utilities, shipCores, bossVariants, minibossWorldSkins,
  shipFragments, shipSystems, vfx, spritesAndSheets, models, screenshotsAndFixtures) has no `enemies` row
  and no row with `entryIds` naming these four.
- The exclusions live only in WHOMP source: `wikiEnemyUnfielded` and `WIKI_VISUAL_PENDING_CONCEPT_KINDS` in
  `src/data/wikiVisuals.ts`. The manifest does not echo them, so the site cannot honour them from the manifest.

The check at bin/wiki.mjs:3736-3744 compares `policy.expectedIds` to `visualDomainIds(D.domains[domain])`
(every key of game-data's domain entries). Game data still lists the four, so the enemies policy fails.
Making the site compare "domain ids minus manifest-marked exclusions" requires the manifest to mark them.

## What WHOMP must emit (one-line follow-up)
In `bin/wiki-visuals.mjs`, add to each policy an `excludedIds` array of
`{ id, reason: 'unfielded' | 'pending-concept' }` (enemies: asterism, eclipsewarden, lockwright as `unfielded`,
riftHeart as `pending-concept`), derived from the same `wikiEnemyUnfielded` / `WIKI_VISUAL_PENDING_CONCEPT_KINDS`
filters the generator already applies, then regenerate `data/wiki-visuals.json`.
Once that lands, the site lane is: expected = domain ids minus `excludedIds` ids; every `excludedIds` id must
exist in game data; `expectedIds` must equal that set. Tests: today's WHOMP data passes; an id missing with no
exclusion fails; an excluded id absent from game data fails.

## Not done
- No tests written, no wiki.mjs run against WHOMP data (nothing to run until the manifest carries the field).
- No deploy, no wrangler, WHOMP untouched, sacred files and witnesses untouched.

## Premise check
The brief said "if the manifest already lists them ... use that". It does not. The failing deploy message
(enemies policy does not exactly cover its domain) is consistent with this reading.
