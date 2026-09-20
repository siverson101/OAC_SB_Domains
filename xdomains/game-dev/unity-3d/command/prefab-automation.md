---
id: prefab-automation
summary: Validate and propose prefab patch JSON ops with a mandatory dry run, then hand a confirmed apply to the live Unity CLI.
family: act
mode: both
description: Propose prefab patch ops offline, record a dry-run receipt, and refuse a non-dry run without confirm and a prior dry run.
inputs: { projectRoot: "string", opencodeDir: "string", prefab: "string", opsFile: "string", opsJson: "string", dryRun: "boolean", confirm: "boolean", gate: "boolean" }
outputs: { mode: "string", patchId: "string", ops: "array", unsupported: "array", command: "string", escalation: "object", gate: "object" }
sideEffects: ["writes .opencode/project-data/act/prefab-dryrun.json receipt", "live apply mutates the prefab asset through the Unity CLI"]
safetyGate: { mutates: true, requiresApproval: true, dryRunFirst: true }
uses: [scene-editing]
provides: [prefab-automation]
requires: [unity-project]
usedBy: [scene-editing]
versionCompatibility: { unity: ["6.0", "6.3", "6.5", "LTS+"] }
---

# prefab-automation

Implements the ADR-0018 `prefab patch` flow. The offline pass validates the ops and proposes them
without touching the prefab:

```bash
node .opencode/xdomains/scripts/unity/unity-act.mjs \
  --project-root . --opencode-dir .opencode --ability prefab-automation \
  --prefab Assets/Prefabs/Player.prefab --ops .aibridge/patch_ops/player.json --dryRun true --json
```

- Supported ops: `ensure_child`, `ensure_component`, `set_property`, `set_properties`, `set_array`,
  `append_array`, `clear_array`.
- A dry run mutates nothing, records a receipt keyed by prefab + ops, and returns the exact
  `unity command prefab patch ... --dryRun true` invocation.
- A non-dry run is **refused** without `--confirm`, and **refused** without a recorded dry run for the
  same ops. When both hold, the result is `ready` and carries the apply command.
- Unsupported ops escalate to `unity-yaml-editing`; the result never invents an op.

Object references use the patch shapes `{ "$gameObject": "Player/HP" }`, `{ "$component": { ... } }`,
`{ "$asset": "Assets/..." }`, `{ "$guid": "..." }` or `null`.
