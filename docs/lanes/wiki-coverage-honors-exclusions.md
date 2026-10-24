# wiki-coverage-honors-exclusions

VERDICT: PARTIAL (fix and tests done and green; the full `bin/generate.mjs` run could not complete in this container, see below)

## Change
- `bin/wiki.mjs` `visualManifestViolations` (now exported for tests): the per-policy coverage comparison
  now expects `domain ids - policy.excludedIds`. Each `excludedIds` item must have an id that is in the
  game-data domain, a unique id, and a reason of `pending-concept` or `unfielded`. An id missing from
  `expectedIds` without an exclusion still fails; an excluded id absent from game data fails.
- WHOMP already emits this: `data/wiki-visuals.json` policy `enemies` carries
  `excludedIds` = riftHeart (pending-concept), lockwright, asterism, eclipsewarden (unfielded)
  (written by `bin/wiki-visuals.mjs`). No WHOMP follow-up needed. No other contract line changed.
- Test: `tests/wikiCoverageExclusions.test.mjs` (6 tests) against WHOMP main `75979a0`.

## Test lines (verbatim, node --test)
```
ok 1 - current WHOMP data passes the coverage comparison with its declared exclusions
ok 2 - an id missing from expectedIds with no exclusion still fails
ok 3 - dropping a declared exclusion fails, so the id cannot go silently missing
ok 4 - an excluded id that is not in game data fails
ok 5 - an id both expected and excluded fails
ok 6 - an exclusion without a reason fails
```
Tests-first note: before the change the test file could not run at all (`visualManifestViolations` was not exported).

Whole suite (`node --test tests/*.test.mjs`): before the fix 168 pass / 4 fail (167, 169, 172 in
wikiTierEvidence, which call `buildWiki` on WHOMP data and hit the enemies coverage violation, plus 57);
after the fix 177 pass / 1 fail. The remaining failure is #57 "the committed story still describes a window that
includes today", a date-dependent test unrelated to this change (it fails identically without it).
`wikiTierEvidence` test 12 runs `buildWiki` on WHOMP's real game-data and wiki-visuals, so the full visual
contract passes on current WHOMP data.

## wiki.mjs on WHOMP data, the deploy-site.sh way
`node bin/generate.mjs --repo ../whomp --offline` stopped before the wiki step, at the generator's canonical
gate: `node ../whomp/bin/wiki-visuals.mjs --verify` -> `Cannot find package 'vite'` (WHOMP has no node_modules in this
container; installing there would touch WHOMP, and that gate is the byte-exact rerender this container cannot
produce per the wiki-visuals-enemies-coverage lane). data-layer and tier-engine verifies passed. So the
end-to-end result is the `buildWiki` test above, not a full generate. The real check is the next Preview deploy.

## Premise check
Nothing wrong; the manifest already expressed both exclusion classes. Not deployed; WHOMP untouched.
