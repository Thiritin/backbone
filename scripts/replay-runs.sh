#!/usr/bin/env bash
# Replays each run file with the build it was made with: scripts/replay-runs.sh <out dir> <run.json>...
# Writes <out dir>/<run>.json for every run that verifies. A run whose build is not on main fails.
# KEEP_GOING=1 leaves failed runs out and exits 0, for rebuilding the leaderboard.
set -uo pipefail
out=$1
shift
mkdir -p "$out"
root=$(pwd)
base=${BASE:-origin/main}
builds=${RUNNER_TEMP:-/tmp}/builds
status=0
for f in "$@"; do
  if [[ ! "$f" =~ ^leaderboard/[A-Za-z0-9._-]+\.run\.json$ ]]; then
    echo "$f: run files are named leaderboard/<company>-<seed>.run.json"
    status=1
    continue
  fi
  v=$(node -p "String(require('$root/$f').version)")
  dir=$builds/$v
  if [[ ! "$v" =~ ^[0-9a-f]{7,40}$ ]] || ! git merge-base --is-ancestor "$v" "$base" 2>/dev/null; then
    echo "$f: build $v is not on main"
    status=1
    continue
  fi
  if [ ! -d "$dir" ]; then
    git worktree add -q --detach "$dir" "$v" && (cd "$dir" && npm ci --silent --no-audit --no-fund) || { status=1; continue; }
  fi
  name=$(basename "$f" .run.json)
  if ! (cd "$dir" && npx tsx scripts/replay.ts --json "$root/$f") > "$out/$name.json"; then
    rm -f "$out/$name.json"
    status=1
  fi
done
[ -n "${KEEP_GOING:-}" ] && exit 0
exit $status
