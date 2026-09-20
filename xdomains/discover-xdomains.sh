#!/usr/bin/env bash
set -euo pipefail

# Read-only discovery of extra domains (xdomains).
#
# Scans xdomains/<domain>/<sub-domain>/sb-domain.json and prints every sub-domain
# found. Discovery never executes domain code.
#
# Run: bash .opencode/xdomains/discover-xdomains.sh

xdomains_dir="$(cd "$(dirname "$0")" && pwd)"

found=0
for meta in "$xdomains_dir"/*/*/sb-domain.json; do
    [ -f "$meta" ] || continue
    found=$((found + 1))

    dir="$(dirname "$meta")"
    domain="$(jq -r '.domain // empty' "$meta" 2>/dev/null || true)"
    subdomain="$(jq -r '.subdomain // empty' "$meta" 2>/dev/null || true)"
    display="$(jq -r '.displayName // .name // empty' "$meta" 2>/dev/null || true)"

    [ -n "$domain" ] || domain="$(basename "$(dirname "$dir")")"
    [ -n "$subdomain" ] || subdomain="$(basename "$dir")"
    [ -n "$display" ] || display="$subdomain"

    echo "Found sub-domain: ${domain}/${subdomain} -> ${display}"
    echo "  Path: ${dir}"
done

if [ "$found" -eq 0 ]; then
    echo "No xdomains found under: $xdomains_dir"
fi
