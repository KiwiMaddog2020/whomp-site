# Lane wiki-bestiary-honors-exclusions

## Change
`bin/wiki-check.mjs` now builds `visualExcludedKeys` from every policy's `excludedIds` and, for those entries, no longer demands a canonical visual association. It requires the opposite: no `visualByKey` entry and no `data-visual-key` in the card. Every other entry in a visual-policy domain gets the unchanged checks.

**Which option, and why: allow in wiki-check, not omit from the pages.** `generate.mjs` and `wiki.mjs` never drop excluded ids from the roster. The pages still render `riftHeart`, `lockwright` and the other excluded ids as cards, and `renderWikiVisual` already returns `''` for an entry with no visual. Coverage (0b44d85) already treats excludedIds as "visual owed: none". The checker was the only place still demanding a picture. Leaving the cards out would also change search, counts and hub numbers, a bigger change than the lane asked for.

A non-excluded entry without a visual still fails. The manifest guards in `wiki.mjs` (`Wiki visual contract failed`) reject it before wiki-check's own requirement is reached.

## Tests
`tests/wikiCheckExclusions.test.mjs`, 2 tests:
1. wiki-check passes with riftHeart (excluded) carrying no visual. It fails without the fix with the production error `WIKI CONTRACT: wiki-bestiary.html entry riftHeart has no canonical visual association`.
2. Dropping a non-excluded entry's visual (blob) still fails.

`WHOMP_REPO=/home/user/whomp node --test tests/*.test.mjs` (`node --test tests/` itself errors, since it treats the directory as a module):
```
# tests 180
# pass 177
# fail 1
# skipped 2
```
- The 1 failure is `generatedSite.test.mjs` "the committed story still describes a window that includes today" (newest story day 2026-10-21). It is unrelated and pre-existing, and needs `bin/regenerate-and-verify.sh`.
- The 2 skips are my new tests. In this container `generate.mjs` cannot finish, because `wiki-visuals.mjs --verify` needs an isolated Chrome (the bundled Chromium refuses to run as root). Without it the tests skip with that reason.
- Run with `WIKI_OUTDIR=/tmp/wikiout` (a wiki generated with only the visuals verify line commented out, that edit not committed): `# tests 2 # pass 2 # fail 0 # skipped 0`.

## Generate
`WHOMP_REPO=/home/user/whomp node bin/generate.mjs --outdir <tmp>` with the same uncommitted skip of the visuals byte-verify (line 214): exit 0, wiki-check passed, last lines `search index: 1373 entries` / `warnings: 0, notes: 0`. The full unmodified run stops at `wiki-visuals: FAILED: Error: no isolated Chrome binary found`, then with the Chromium given, `Running as root without --no-sandbox is not supported`. In real CI, with a usable Chrome, that step is unchanged by this lane.

## VERDICT PARTIAL
The fix is verified end to end except for the visuals byte-verify, which cannot run in this container. Not merged and not deployed.
