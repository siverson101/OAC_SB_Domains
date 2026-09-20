---
id: platform-info
summary: Resolve Unity build targets, predefined platform symbols and version-gate defines from an offline table.
family: sense
mode: offline
description: Resolve Unity build targets, predefined platform symbols and version-gate defines from an offline table.
inputs: { projectRoot: "string", opencodeDir: "string", query: "string" }
outputs: { table: "object", platforms: "array", versionDefines: "array", project: "object", activeDefines: "array" }
sideEffects: []
uses: [context/unity/platform-defines.json]
provides: [platform-info]
requires: [platform-defines]
versionCompatibility: { unity: ["6.0", "6.3", "6.5", "LTS+"] }
---

# platform-info

Looks up `xdomains/context/unity/platform-defines.json` for build targets, predefined symbols
(`UNITY_ANDROID`, `UNITY_STANDALONE_WIN`, …) and version-gate defines
(`UNITY_6000_0_OR_NEWER`). It also resolves the project's configured target platform from
`project-settings.json` into the symbols that will be defined.

## Runs offline

```bash
node .opencode/xdomains/scripts/unity/unity-sense.mjs \
  --project-root . --opencode-dir .opencode --ability platform-info --query Android --json
```

Editor-free; missing table or settings degrade to `unavailable`/`unknown`.
