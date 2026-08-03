#!/usr/bin/env bash
# Regenerate the WHOMP dev-log site and push it live to GitHub Pages.
#
# Modeled on ../whomp/bin/deploy-play.sh, much simpler: this repo IS the Pages
# repo (no separate dist clone to stage), and the generator only ever READS
# the game repo, so there is nothing here that could touch it even by mistake.
#
# Usage: bin/deploy-site.sh [--offline]
set -euo pipefail
cd "$(dirname "$0")/.."
SITE_ROOT="$(pwd)"

# ── GUARD: this script may only ever run inside whomp-site, and may only ever
# push to whomp-site. It must never be able to touch the game repo. ─────────
if [ "$(basename "$SITE_ROOT")" != "whomp-site" ]; then
  echo "ERROR: refusing to run outside whomp-site (cwd resolved to $SITE_ROOT)" >&2
  exit 1
fi
ORIGIN_URL="$(git remote get-url origin 2>/dev/null || echo '')"
case "$ORIGIN_URL" in
  *whomp-site*) ;;
  *) echo "ERROR: origin is not whomp-site ($ORIGIN_URL), refusing to push" >&2; exit 1 ;;
esac

# ── GUARD: publish only from the ref that is actually served. ───────────────
# PAIRED WITH ../whomp/bin/deploy-play.sh (its SITE PUBLISH-BRANCH GATE). Both
# carried the same defect and both were fixed on 2026-08-01; if one changes, the
# other must, because this script is the recovery path the other one recommends.
#
# The defect: commit to whatever branch is checked out, then `git push origin
# main` — pushing a ref that never received the commit. When this repo sat on a
# lane's feature branch the commit went to that branch, the push was a no-op, the
# live dev log never moved, and the script printed "deployed".
#
# This repo publishes from exactly ONE ref: a single remote branch (origin/main),
# no .github/workflows, a .nojekyll file — GitHub Pages serving a branch. So
# committing to the current branch and pushing THAT branch is not the fix either;
# it would be honest and still publish nothing. Refuse instead, before the
# generator runs, so a refusal leaves the branch and working tree untouched.
#
# Not derived from origin/HEAD: that ref is unset here, so a derivation would be
# pure fallback. SITE_PUBLISH_BRANCH is for a real default-branch rename, not for
# silencing this — pointing it at a lane's branch publishes to a ref Pages does
# not serve, which is the original bug.
PUBLISH_BRANCH="${SITE_PUBLISH_BRANCH:-main}"
# symbolic-ref, not `rev-parse --abbrev-ref`: the latter prints the literal
# "HEAD" when detached, naming a branch that does not exist.
CURRENT_BRANCH="$(git symbolic-ref --quiet --short HEAD 2>/dev/null || true)"
if [ -z "$CURRENT_BRANCH" ]; then
  echo "ERROR: whomp-site is on a DETACHED HEAD; only '$PUBLISH_BRANCH' publishes." >&2
  echo "       Refusing before generating, so nothing is orphaned." >&2
  echo "       Recover:  git -C $SITE_ROOT checkout $PUBLISH_BRANCH && $SITE_ROOT/bin/deploy-site.sh" >&2
  exit 1
fi
if [ "$CURRENT_BRANCH" != "$PUBLISH_BRANCH" ]; then
  echo "ERROR: whomp-site is on branch '$CURRENT_BRANCH'; only '$PUBLISH_BRANCH' publishes." >&2
  echo "       A refresh committed to '$CURRENT_BRANCH' reaches no reader, so it is refused" >&2
  echo "       before generating rather than orphaning a commit on another lane's branch." >&2
  echo "       Recover:  git -C $SITE_ROOT checkout $PUBLISH_BRANCH && $SITE_ROOT/bin/deploy-site.sh" >&2
  exit 1
fi

GAME_REPO="../whomp"
if [ ! -d "$GAME_REPO/.git" ]; then
  echo "ERROR: game repo not found at $GAME_REPO (read-only source for the generator)" >&2
  exit 1
fi

OFFLINE_FLAG=()
if [ "${1:-}" = "--offline" ]; then OFFLINE_FLAG=(--offline); fi

# `${a[@]+"${a[@]}"}`, not `"${a[@]}"`. macOS ships bash 3.2.57, where expanding
# an EMPTY array under `set -u` is an unbound-variable error, so the plain form
# killed this script at this line on every run without --offline. That is not a
# theory: whomp-site's history contains ZERO "site: regenerate from main@" commits
# and eight "chore(site): refresh for play build" ones — every site refresh this
# repo has ever had came from ../whomp/bin/deploy-play.sh, and this script, the
# by-hand recovery path, had never once reached the generator.
# Found 2026-08-01 while wiring the publish-branch guard above, whose refusal
# message recommends this script. Fixed rather than reported, because a guard
# that points at a broken recovery is worse than no guard.
node bin/generate.mjs --repo "$GAME_REPO" ${OFFLINE_FLAG[@]+"${OFFLINE_FLAG[@]}"}

# Stage exactly what the generator writes, FROM THE MANIFEST IT WROTE.
#
# Still never a wildcard add: a guard in this repo blocks `git add -A` / `git
# add .` on purpose, and a wildcard would happily commit a stray file. This is
# an explicit list, it just is not a hand-typed one any more.
#
# It used to be `git add index.html log.html search-index.json`, duplicated here
# and in the game repo's bin/deploy-play.sh. That was correct for exactly as long
# as the site had three files. The wiki added pages, and a hand-typed list means
# the new pages silently stop refreshing on deploy while the deploy still reports
# success, which is the worst shape a staleness bug can take.
#
# .site-outputs is gitignored: it is a build-time handoff, not site content.
if [ ! -f .site-outputs ]; then
  echo "ERROR: bin/generate.mjs wrote no .site-outputs manifest, refusing to guess what to stage" >&2
  exit 1
fi
# Line-by-line rather than word-splitting. Revalidate the handoff independently:
# visual assets use safe nested paths, while absolute paths, traversal, empty
# segments and shell-significant characters are refused before git sees them.
while IFS= read -r out; do
  [ -n "$out" ] || continue
  if [[ ! "$out" =~ ^[a-z0-9][a-z0-9._-]*(/[a-z0-9][a-z0-9._-]*)*$ ]]; then
    echo "ERROR: unsafe path '$out' in .site-outputs" >&2
    exit 1
  fi
  git add -- "$out"
done < .site-outputs
if git diff --cached --quiet; then
  echo "site unchanged, nothing to deploy"
  exit 0
fi

GAME_SHA="$(git -C "$GAME_REPO" rev-parse --short HEAD)"
git -c user.name=KiwiMaddog -c user.email=kevinmadson@protonmail.com \
  commit -m "site: regenerate from main@${GAME_SHA}"
# PUSH `HEAD`, NEVER A BRANCH NAME. The guard above already proved HEAD is the
# publish branch, so they are the same ref — but naming HEAD is what makes it
# structurally impossible to commit to one ref and push another. The bug class
# dies here rather than being avoided by a check that could later drift.
git push origin HEAD
# Name the branch that was pushed, so "deployed" can never mean "deployed
# somewhere nobody is looking".
echo "deployed $CURRENT_BRANCH -> https://kiwimaddog2020.github.io/whomp-site/ (allow ~1-2 min + CDN cache)"
