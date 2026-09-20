#!/usr/bin/env bash
#
# Validates the xdomain layout: manifests, hooks, and absence of plugin-era references.
#
# Run: bash tests/test-domain-hooks.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
XD="$ROOT/xdomains"

fail() { echo "FAIL: $1" >&2; exit 1; }
pass() { echo "ok: $1"; }

# --- manifests exist and use the domain schema -----------------------------
for meta in "$XD"/game-dev/*/sb-domain.json; do
    [ -f "$meta" ] || fail "no sb-domain.json found"
done

if command -v node >/dev/null 2>&1; then
    for meta in "$XD"/game-dev/*/sb-domain.json; do
        meta_native="$meta"
        if command -v cygpath >/dev/null 2>&1; then
            meta_native="$(cygpath -w "$meta")"
        fi
        node -e '
            const m = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
            if (typeof m.domain !== "string") throw new Error("domain must be a string");
            if (typeof m.subdomain !== "string") throw new Error("subdomain must be a string");
            if (m.domains || m.subdomains) throw new Error("array domain/subdomain fields must be gone");
            if (m.subdomainContext) throw new Error("subdomainContext must be gone");
        ' "$meta_native" || fail "invalid manifest: $meta"
    done
    pass "manifests use the domain schema"
fi

# --- expected hooks exist --------------------------------------------------
for sd in unity-2d unity-3d; do
    for f in \
        hooks/instead/stage-3-identify-use-cases.md \
        hooks/instead/stage-4-assess-complexity.md \
        hooks/instead/stage-5-identify-integrations.md \
        hooks/instead/stage-7-generate-system.md; do
        [ -f "$XD/game-dev/$sd/$f" ] || fail "missing hook: $sd/$f"
    done
done
pass "all expected hooks present"

# --- every hook begins with YAML frontmatter --------------------------------
for f in "$XD"/game-dev/*/hooks/*/*.md; do
    [ -f "$f" ] || continue
    first_line="$(head -n 1 "$f")"
    [ "$first_line" = "---" ] || fail "hook missing frontmatter: $f"
done
pass "hooks have frontmatter"

# --- no plugin-era references remain ---------------------------------------
if grep -rq "selected_plugin\|merge-plugins\.js\|\.opencode/plugins/" "$XD"/game-dev; then
    fail "plugin-era reference remains under xdomains/game-dev"
fi
pass "no plugin-era references remain"

# --- no dead hooks/<subdomain>/ override dirs ------------------------------
if find "$XD"/game-dev -type d -path "*/hooks/unity-2d" -o -type d -path "*/hooks/unity-3d" | grep -q .; then
    fail "dead hooks/<subdomain>/ override dir present"
fi
pass "no dead override dirs"

echo "All domain hook tests passed"
