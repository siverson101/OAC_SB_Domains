---
id: contract-aware-design
summary: Validate capability frontmatter against the unified contract schema (xdomains/context/capability-contract.schema.json) and report each invalid field.
family: compose
mode: offline
description: Parse the contract frontmatter of every capability markdown file and validate it against the unified capability contract schema (ADR-0012), reporting per-capability errors so a design can be checked without reading every file.
inputs: { projectRoot: "string", capabilitiesDir: "string?", schema: "string?" }
outputs: { status: "string", schemaPath: "string", capabilitiesDir: "string", checked: "number", valid: "number", invalid: "number", results: "array" }
sideEffects: []
safetyGate: { mutates: false, requiresEditor: false }
uses: []
provides: [contract-aware-design, contract-validation]
requires: [capability-contract-schema]
usedBy: [unity-3d-orchestrator]
versionCompatibility: { unity: ["6.0", "6.3", "6.5", "LTS+"] }
---

# contract-aware-design

Validates each capability's frontmatter against `xdomains/context/capability-contract.schema.json`
(ADR-0012) using the same `parseFrontmatter` + `validateContract` code the registry build uses, so
the design and the registry agree.

```bash
node .opencode/xdomains/scripts/unity/unity-compose.mjs \
  --project-root . --opencode-dir .opencode \
  --ability contract-aware-design \
  --capabilities-dir xdomains/game-dev/unity-3d/command --json
```

Each result reports `id`, `family`, `mode`, `ok` and any `errors` (missing `id`/`summary`, invalid
`family`/`mode`, wrong field types). Offline, read-only and fail-soft: a missing schema or directory
reports `unavailable`.
