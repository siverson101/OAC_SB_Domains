---
id: input-automation
summary: Emit fresh Input System data — .inputactions documents, action-map JSON, and a C# input reader.
family: act
mode: offline
description: Produce fresh Input System .inputactions/JSON/C# templates; writes only when confirm and an output path are supplied.
inputs: { projectRoot: "string", opencodeDir: "string", template: "string", name: "string", namespace: "string", map: "string", out: "string", dryRun: "boolean", confirm: "boolean" }
outputs: { template: "string", language: "string", fileName: "string", content: "string", written: "boolean", outPath: "string" }
sideEffects: ["writes an .inputactions/.json/.cs file only when --confirm is supplied with --out"]
safetyGate: { mutates: true, requiresApproval: true, dryRunFirst: true }
uses: [asset-intelligence]
provides: [input-automation]
requires: [unity-project]
versionCompatibility: { unity: ["6.0", "6.3", "6.5", "LTS+"] }
---

# input-automation

Emits **fresh** Input System templates authored for OAC. Templates: `input-actions` and
`player-input-actions` (`.inputactions` documents), `input-map-json` (raw action data) and
`input-reader` (a C# MonoBehaviour that drives an `InputActionAsset`).

```bash
node .opencode/xdomains/scripts/unity/unity-act.mjs \
  --project-root . --opencode-dir .opencode --ability input-automation \
  --template input-actions --name GameControls --map Player --json
```

Check `asset-intelligence` first: the legacy Input Manager and the Input System are mutually
exclusive backends. Without `--out` the content is returned and nothing is written; writing requires
`--out <dir> --dryRun false --confirm`.
