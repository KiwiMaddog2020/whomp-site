#!/usr/bin/env bash
# ONE COMMAND: rebuild the whole site from the game repo as it stands right now,
# and prove the result before anybody looks at it.
#
#   bin/regenerate-and-verify.sh [--offline] [--repo ../whomp]
#
# WHY THIS EXISTS. The generator already refuses a great deal: stale artifacts,
# dead links, a concise view with holes in it, a wiki contract that moved. What
# it could not refuse was TEXT going quietly out of date. The landing page
# printed "A3 . Wed 7/30" for a week after that Wednesday and ended two of its
# nine arcs mid-sentence, and every single generation in between exited zero and
# reported success. Nothing was broken. Everything was stale.
#
# So this script is the difference between "the build passed" and "the page is
# still true". It does three things in order and stops at the first failure:
#
#   1. regenerate every surface from the current game checkout
#   2. fail on any SITE WARNING the generator raised (a dropped arc, a teaser
#      for work that has left the queue). SITE NOTE lines are printed and do not
#      fail: they are real rot the site is not allowed to fix, and a gate that is
#      permanently red teaches everyone to ignore it.
#   3. run the whole suite, including the drift tests that read the files just
#      written and check them for expired dates, unfinished sentences, missing
#      social tags and both play buttons.
#
# IT NEVER TOUCHES THE GAME REPO and it never pushes. Publishing is
# bin/deploy-site.sh, deliberately a separate command with its own branch guard.
#
# HOW OFTEN. Whenever the game repo ships, plus once a day even when it does not,
# because half of what this catches is a date passing rather than a commit
# landing. See "Keeping the site true" in README.md for the one-line hook.
set -euo pipefail
cd "$(dirname "$0")/.."
SITE_ROOT="$(pwd)"

if [ "$(basename "$SITE_ROOT")" != "whomp-site" ]; then
  echo "ERROR: refusing to run outside whomp-site (cwd resolved to $SITE_ROOT)" >&2
  exit 1
fi

GAME_REPO="../whomp"
OFFLINE_FLAG=()
while [ "$#" -gt 0 ]; do
  case "$1" in
    --offline) OFFLINE_FLAG=(--offline); shift ;;
    --repo) GAME_REPO="${2:?--repo needs a path}"; shift 2 ;;
    *) echo "ERROR: unknown argument '$1'" >&2; exit 1 ;;
  esac
done

if [ ! -d "$GAME_REPO/.git" ]; then
  echo "ERROR: game repo not found at $GAME_REPO (read-only source for the generator)" >&2
  exit 1
fi

LOG="$(mktemp -t whomp-site-regen)"
# Trap rather than a tidy-up line at the end: this script exits early on purpose
# in three places and a leaked temp file per failed run is its own small rot.
trap 'rm -f "$LOG"' EXIT

echo "== 1/3  regenerating from $GAME_REPO"
# `${a[@]+"${a[@]}"}`, not `"${a[@]}"`: macOS ships bash 3.2.57, where expanding
# an EMPTY array under `set -u` is an unbound-variable error. bin/deploy-site.sh
# carries the same form and the same comment, for the same reason and after the
# same outage.
if ! node bin/generate.mjs --repo "$GAME_REPO" ${OFFLINE_FLAG[@]+"${OFFLINE_FLAG[@]}"} 2>&1 | tee "$LOG"; then
  echo "FAILED: the generator refused. Nothing below ran." >&2
  exit 1
fi
# tee returns the tee exit status, so the generator's own failure has to be read
# off PIPESTATUS or it passes silently through the pipe.
GEN_STATUS="${PIPESTATUS[0]}"
if [ "$GEN_STATUS" -ne 0 ]; then
  echo "FAILED: the generator exited $GEN_STATUS. Nothing below ran." >&2
  exit "$GEN_STATUS"
fi

echo
echo "== 2/3  reading what the generator said about itself"
NOTES="$(grep -c '^SITE NOTE:' "$LOG" || true)"
WARNS="$(grep -c '^SITE WARNING:' "$LOG" || true)"
if [ "$NOTES" -gt 0 ]; then
  echo "$NOTES note(s), owned upstream, not blocking:"
  grep '^SITE NOTE:' "$LOG" | sed 's/^/    /'
fi
if [ "$WARNS" -gt 0 ]; then
  echo
  echo "FAILED: $WARNS warning(s) the site is responsible for:" >&2
  grep '^SITE WARNING:' "$LOG" | sed 's/^/    /' >&2
  exit 1
fi
echo "no warnings"

echo
echo "== 3/3  the suite, including the drift tests over what was just written"
node --test tests/*.test.mjs

echo
echo "site regenerated and verified from $(git -C "$GAME_REPO" rev-parse --short HEAD); publish with bin/deploy-site.sh"
