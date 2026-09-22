#!/usr/bin/env bash
#
# Tests for the xdomain merge engine: xdomains/merge-domains.js
#
# Run: bash tests/test-merge-domains.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MERGE="$ROOT/xdomains/merge-domains.js"
DOMAIN="$ROOT/xdomains/game-dev/unity-3d"

fail() { echo "FAIL: $1" >&2; exit 1; }
pass() { echo "ok: $1"; }

to_native() {
    if command -v cygpath >/dev/null 2>&1; then
        cygpath -w "$1"
    else
        printf '%s' "$1"
    fi
}

if ! command -v node >/dev/null 2>&1; then
    echo "node not found; skipping merge engine tests"
    exit 0
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

MERGE_N="$(to_native "$MERGE")"
DOMAIN_N="$(to_native "$DOMAIN")"
OC_N="$(to_native "$WORK/oc")"

# --- dry-run plans without writing -----------------------------------------
node "$MERGE_N" --domain-dir "$DOMAIN_N" --opencode-dir "$OC_N" --mode extend --dry-run > "$WORK/dry.txt"
[ ! -e "$WORK/oc" ] || fail "dry-run created files"
grep -q "agent/unity-3d-orchestrator.md" "$WORK/dry.txt" || fail "dry-run missing orchestrator"
pass "dry-run plans without writing"

# --- apply copies declared assets and registers metadata --------------------
mkdir -p "$WORK/oc/config"
printf '{\n  "agents": {}\n}\n' > "$WORK/oc/config/agent-metadata.json"

node "$MERGE_N" --domain-dir "$DOMAIN_N" --opencode-dir "$OC_N" --mode extend > "$WORK/apply.txt"

[ -f "$WORK/oc/agent/unity-3d-orchestrator.md" ] || fail "orchestrator not copied"
[ -f "$WORK/oc/agent/subagents/unity/implementer.md" ] || fail "subagent not copied"
[ -f "$WORK/oc/command/unity-implement.md" ] || fail "command not copied"
[ -f "$WORK/oc/context/unity-3d/navigation.md" ] || fail "context not copied"

grep -q '"unity-3d-orchestrator"' "$WORK/oc/config/agent-metadata.json" || fail "agent metadata not registered"
grep -q '"implementer"' "$WORK/oc/config/agent-metadata.json" || fail "subagent metadata not registered"
grep -q '"author": "domain:game-dev/unity-3d"' "$WORK/oc/config/agent-metadata.json" || fail "domain author not recorded"
pass "apply copies assets and registers agents"

# --- extend namespaces collisions ------------------------------------------
node "$MERGE_N" --domain-dir "$DOMAIN_N" --opencode-dir "$OC_N" --mode extend > /dev/null
[ -f "$WORK/oc/agent/unity-3d_unity-3d-orchestrator.md" ] || fail "extend did not namespace collision"
pass "extend namespaces collisions"

# --- missing manifest exits non-zero ---------------------------------------
if node "$MERGE_N" --domain-dir "$(to_native "$WORK")" --opencode-dir "$OC_N" > /dev/null 2>&1; then
    fail "expected non-zero exit for missing manifest"
fi
pass "missing manifest exits non-zero"

echo "All merge engine tests passed"
