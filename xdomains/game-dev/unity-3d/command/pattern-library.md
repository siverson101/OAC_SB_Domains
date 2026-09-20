---
id: pattern-library
summary: Read the shipped programming-pattern catalog and surface cross-pattern conflicts for an enabled set.
family: act
mode: offline
description: Read xdomains/context/programming-patterns.json (categories, patterns, conflictsWith) and report conflicts instead of silently choosing.
inputs: { projectRoot: "string", opencodeDir: "string", query: "string", category: "string", pattern: "string", enabled: "array" }
outputs: { table: "object", categories: "array", matches: "array", selected: "object", conflicts: "array" }
sideEffects: []
safetyGate: "none (read-only)"
uses: [gather-unity-context]
provides: [pattern-library]
requires: [programming-patterns]
usedBy: [unity-architecture]
versionCompatibility: { unity: ["6.0", "6.3", "6.5", "LTS+"] }
---

# pattern-library

Reads `xdomains/context/programming-patterns.json`: categories (with `selection` and
`mutuallyExclusive`) and patterns (with `conflictsWith` / `pairsWellWith`). Read-only and offline.

```bash
node .opencode/xdomains/scripts/unity/unity-act.mjs \
  --project-root . --opencode-dir .opencode --ability pattern-library --pattern tdd --json
```

Filter with `--query`, `--category` or `--pattern`. Pass `--enabled tdd,bdd` to surface conflicts: a
requested pattern that conflicts with an enabled one is reported rather than silently chosen. A
missing table reports `unavailable`; an unmatched filter reports `unknown`.
