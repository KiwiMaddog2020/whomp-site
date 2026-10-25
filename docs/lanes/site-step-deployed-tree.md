# site-step-deployed-tree (whomp-site half)

**VERDICT: DONE.** Cloud lane, deploy-tooling, 2026-10-25. Pairs with whomp
`claude/site-step-deployed-tree`. **This branch must merge first.** The whomp
half sets `WHOMP_GAME_REPO`. A site checkout without this branch ignores the
variable and keeps reading `../whomp`, so landing the whomp half alone changes
nothing and breaks nothing.

- Branch: `claude/site-step-deployed-tree`, off `origin/main` @ `72513222a66629888008c1864eae7929b4f39660`
- Change commit: `788ffe51d379f44151d2b3177bdfb6141b6cd1b8`

## Why

The game's deploy runs `bin/deploy-site.sh` as its site step. That script hardcoded
`GAME_REPO="../whomp"`, and `bin/generate.mjs` runs `wiki-visuals --verify`
(plus `data-layer --check` and `tier-engine --verify`) against it. On the Mac,
`../whomp` is the canonical checkout, and the lander keeps merging `src/data` rows
into it mid-wave. The train builds and gates its own clone, a different tree. So
the 6:56 pm 2026-10-24 deploy's site step refused (411) while checking a tree it
had not deployed. Measured by lane `wiki-visuals-inventory-1024`.

## What changed (788ffe51)

- `bin/game-repo.mjs` (new): `resolveGameRepo(args, env, cwd)` checks `--repo`
  first, then `WHOMP_GAME_REPO`, then `../whomp`. A relative path resolves
  against cwd, the same way `--repo` always did.
- `bin/generate.mjs`: `REPO` now comes from `resolveGameRepo`. An explicit
  `--repo` behaves exactly as before.
- `bin/deploy-site.sh`: parses `--offline` and `--repo PATH` in any order. It
  picks the game tree with the same precedence. An override is resolved against
  the caller's directory and made absolute. With no override it falls back to
  `../whomp`, unchanged. The tree is passed to the generator, printed as
  `game tree: <path>`, and named in the commit message (`main@<sha>`). Two small
  tightenings:
  - An unknown argument now refuses. Before, it was silently ignored, so a
    misspelled `--ofline` ran online.
  - The checkout check is `-e .git`, not `-d`, so a clone made with
    `git worktree add` (which has a `.git` file) is accepted.
  - Today's callers pass only `--offline` or nothing: whomp `deploy-train.sh`,
    `deploy-preview.sh` and the recovery lines in `deploy-play.sh`.
- `tests/deploySiteGameRepo.test.mjs` (new, 6 tests). Each test runs the real
  script on a throwaway copy of the site whose stub generator records the
  `--repo` it was handed. The cases:
  - unset reads `../whomp`
  - `WHOMP_GAME_REPO` set reads that tree
  - `--repo` beats the env, and a relative path resolves against the caller
  - a tree that is not a checkout refuses before the generator runs
  - an unknown argument refuses
  - the resolver's precedence

## Verification

- `node --test tests/deploySiteGameRepo.test.mjs`: `# tests 6` / `# pass 6` / `# fail 0`.
- The same file run against `origin/main`'s `bin/deploy-site.sh`: 4 of the 6
  fail (`not ok 2` to `not ok 5`), so the tests do detect the old behaviour.
- `WHOMP_REPO=/home/user/whomp node --test tests/*.test.mjs`: `# tests 186` /
  `# pass 183` / `# fail 1` / `# skipped 2`.
  - The one failure is `generatedSite.test.mjs` "the committed story still
    describes a window that includes today": `the newest day in the story is
    2026-10-24 and the window no longer reaches today`. This is a date-freshness
    check, and it fails the same way on an `origin/main` worktree (`not ok 19`,
    `# fail 1`). This diff does not touch the story. The cure is the next site
    regenerate.
- `bash -n bin/deploy-site.sh`: clean.

No deploy, no publish, no merge. Publication approval is still required for any
site push to `main`.

FOLLOW-UP: site-step-deployed-tree land this whomp-site branch before (or with) the whomp branch of the same name; the whomp half is inert until it does.
