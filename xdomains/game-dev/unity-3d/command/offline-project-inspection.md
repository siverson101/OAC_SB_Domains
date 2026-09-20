---
id: offline-project-inspection
summary: Digest the six Phase 2a offline readers (compile, logs, settings, asmdefs, tests, deprecations) with no Editor.
family: sense
mode: offline
description: Digest the six Phase 2a offline readers (compile, logs, settings, asmdefs, tests, deprecations) with no Editor.
inputs: { projectRoot: "string", opencodeDir: "string" }
outputs: { compile: "object", logs: "object", settings: "object", assemblies: "object", tests: "object", deprecations: "object" }
sideEffects: []
uses: [gather-unity-context]
provides: [offline-project-inspection]
requires: [project-data]
versionCompatibility: { unity: ["6.0", "6.3", "6.5", "LTS+"] }
---

# offline-project-inspection

Summarises the six offline producers — `compile-state`, `log-digest`, `project-settings`,
`asmdef-map`, `test-inventory` and `deprecation-scan` — into a single inspection result. This is
the fast "what is the project doing right now?" read used when the Editor is closed.

## Runs offline

```bash
node .opencode/xdomains/scripts/unity/unity-sense.mjs \
  --project-root . --opencode-dir .opencode --ability offline-project-inspection --json
```

Each section reports `unavailable`/`unknown` when its source JSON is absent; the command never
launches Unity.
