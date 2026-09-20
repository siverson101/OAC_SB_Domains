#!/usr/bin/env bash
#
# Tests xdomains/discover-xdomains.sh
#
# Run: bash tests/test-discover-xdomains.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DISCOVER="$ROOT/xdomains/discover-xdomains.sh"

fail() { echo "FAIL: $1" >&2; exit 1; }
pass() { echo "ok: $1"; }

if ! command -v jq >/dev/null 2>&1; then
    echo "jq not found; skipping discover tests"
    exit 0
fi

out="$(bash "$DISCOVER")"

echo "$out" | grep -q "game-dev/unity-2d" || fail "unity-2d not discovered"
echo "$out" | grep -q "game-dev/unity-3d" || fail "unity-3d not discovered"
pass "discovers both sub-domains under game-dev"

echo "All discover tests passed"
