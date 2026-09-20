---
id: asset-intelligence
summary: Deduce project asset usage, packages, input and platform signals from offline project-data.
family: sense
mode: offline
description: Deduce project asset usage, packages, input and platform signals from offline project-data.
inputs: { projectRoot: "string", opencodeDir: "string" }
outputs: { assetCounts: "object", totalAssets: "number", packages: "object", input: "object", platform: "object", signals: "array" }
sideEffects: []
uses: [gather-unity-context, scan-project]
provides: [asset-intelligence]
requires: [project-data]
versionCompatibility: { unity: ["6.0", "6.3", "6.5", "LTS+"] }
---

# asset-intelligence

Combines `project-structure.json`, `unity-package-list.json`, `project-files.json`,
`project-pref.json`, `project-settings.json` and `asmdef-map.json` to describe what the project
actually uses — asset categories, installed packages, input backend, scripting backend and target
platform. Editor-free and read-only.

## Runs offline

```bash
node .opencode/xdomains/scripts/unity/unity-sense.mjs \
  --project-root . --opencode-dir .opencode --ability asset-intelligence --json
```

Missing inputs degrade to `null`/`unknown` fields rather than failing. Feed the result into the
orchestrator before planning a feature so it respects the project's real packages and input path.
