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

GAME_REPO="../whomp"
if [ ! -d "$GAME_REPO/.git" ]; then
  echo "ERROR: game repo not found at $GAME_REPO (read-only source for the generator)" >&2
  exit 1
fi

OFFLINE_FLAG=()
if [ "${1:-}" = "--offline" ]; then OFFLINE_FLAG=(--offline); fi

node bin/generate.mjs --repo "$GAME_REPO" "${OFFLINE_FLAG[@]}"

# Stage exactly what the generator writes. Never a wildcard add: a guard in
# this repo blocks `git add -A` / `git add .` on purpose.
git add index.html log.html search-index.json
if git diff --cached --quiet; then
  echo "site unchanged, nothing to deploy"
  exit 0
fi

GAME_SHA="$(git -C "$GAME_REPO" rev-parse --short HEAD)"
git -c user.name=KiwiMaddog -c user.email=kevinmadson@protonmail.com \
  commit -m "site: regenerate from main@${GAME_SHA}"
git push origin main
echo "deployed -> https://kiwimaddog2020.github.io/whomp-site/ (allow ~1-2 min + CDN cache)"
