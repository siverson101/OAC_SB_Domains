---
id: project-status
summary: Aggregate Unity project identity, version, compile and gate state from .opencode/project-data without an Editor.
family: sense
mode: offline
description: Aggregate Unity project identity, version, compile and gate state from .opencode/project-data without an Editor.
inputs: { projectRoot: "string", opencodeDir: "string" }
outputs: { status: "object", identity: "object", compile: "object", gate: "object", structure: "object", packages: "object" }
sideEffects: []
uses: [gather-unity-context]
provides: [project-status]
requires: [project-data]
versionCompatibility: { unity: ["6.0", "6.3", "6.5", "LTS+"] }
---

# project-status

Reads the aggregated state written by `gather-unity-context` and `project-scan` under
`.opencode/project-data/` and reports identity, compile and gate state in one result. No Editor,
no Unity CLI, no network.

## Runs offline

```bash
node .opencode/xdomains/scripts/unity/unity-sense.mjs \
  --project-root . --opencode-dir .opencode --ability project-status --json
```

Reads `scan-result.json`, `unity-project.json`, `gate-state.json`, `compile-state.json`,
`project-structure.json` and `unity-package-list.json`. Missing files are reported as
`unavailable`/`unknown`; nothing is thrown. Run `gather-unity-context` first to populate the
inputs.
