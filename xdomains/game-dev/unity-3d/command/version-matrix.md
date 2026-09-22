---
id: version-matrix
summary: Report the detected Unity editor version, its dispatch key, per-version feature flags, and the compatibility of declared capabilities.
family: sense
mode: offline
description: Map the detected editor version to a dispatch key (6.0/6.3/6.5/LTS+), read the per-version feature flags from xdomains/context/unity/version-matrix.json, and check every declared capability's versionCompatibility against the detected version.
inputs: { projectRoot: "string", opencodeDir: "string", commandDir: "string?" }
outputs: { detected: "object", matrix: "object", compatibility: "object", sources: "object" }
sideEffects: []
uses: [context/unity/version-matrix.json]
provides: [version-matrix]
requires: [project-data]
versionCompatibility: { unity: ["6.0", "6.3", "6.5", "LTS+"] }
---

# version-matrix

Centralises the version-gated seams. It reads the editor version from
`ProjectSettings/ProjectVersion.txt` (falling back to `.opencode/project-data/`), maps it to a
dispatch key (`6000.0` → `6.0`, `6000.3` → `6.3`, `6000.5` → `6.5`, newer → `LTS+`) and reports the
feature flags that apply from `xdomains/context/unity/version-matrix.json`.

It also checks every command's declared `versionCompatibility` against the detected version. A
capability that declares an incompatible range is reported with `incompatible` and a reason — the
ability never throws.

## Runs offline

```bash
node .opencode/xdomains/scripts/unity/unity-sense.mjs \
  --project-root . --opencode-dir .opencode --ability version-matrix --json
```

Editor-free; a missing matrix or an absent/malformed version degrades to `unavailable`/`unknown`.
The feature flags are OAC guidance, not a substitute for the Unity manual and the project's
`Packages/manifest.json` for the exact editor version.
