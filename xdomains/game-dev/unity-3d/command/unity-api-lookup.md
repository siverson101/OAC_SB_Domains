---
id: unity-api-lookup
summary: Look up Unity engine/middleware API symbols and replacements from an offline JSON quick reference.
family: sense
mode: offline
description: Look up Unity engine/middleware API symbols and replacements from an offline JSON quick reference.
inputs: { projectRoot: "string", opencodeDir: "string", query: "string" }
outputs: { table: "object", query: "string", matchCount: "number", matches: "array" }
sideEffects: []
uses: [context/unity/unity-api-quickref.json]
provides: [unity-api-lookup]
requires: [unity-api-quickref]
versionCompatibility: { unity: ["6.0", "6.3", "6.5", "LTS+"] }
---

# unity-api-lookup

Searches `xdomains/context/unity/unity-api-quickref.json` by symbol, namespace, summary or
replacement. Use it to confirm an API's shape and to catch deprecated members (for example
`FindObjectOfType` → `FindFirstObjectByType`) before writing code.

## Runs offline

```bash
node .opencode/xdomains/scripts/unity/unity-sense.mjs \
  --project-root . --opencode-dir .opencode --ability unity-api-lookup --query FindObjectOfType --json
```

No Editor or network. If the table is missing the result is `unavailable` with an explanatory
error; an unmatched query returns `unknown`.
