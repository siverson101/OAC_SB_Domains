---
id: script-scaffolding
summary: Emit fresh C# and asmdef scaffolding templates (MonoBehaviour, ScriptableObject, EditorWindow, tests, interfaces, enums).
family: act
mode: offline
description: Produce fresh Unity C# scaffolding for a named type; writes only when confirm and an output path are supplied.
inputs: { projectRoot: "string", opencodeDir: "string", template: "string", name: "string", namespace: "string", out: "string", dryRun: "boolean", confirm: "boolean" }
outputs: { template: "string", language: "string", fileName: "string", content: "string", written: "boolean", outPath: "string" }
sideEffects: ["writes a .cs/.asmdef file only when --confirm is supplied with --out"]
safetyGate: { dryRunFirst: true, requireConfirm: true }
uses: [gather-unity-context]
provides: [script-scaffolding]
requires: [unity-project]
versionCompatibility: { unity: ["6.0", "6.3", "6.5", "LTS+"] }
---

# script-scaffolding

Emits **fresh** templates authored for OAC — no content is copied from Unity-Developer-Tools
(CC BY-NC-ND, design reference only). Templates: `monobehaviour`, `scriptable-object`,
`editor-window`, `test`, `asmdef`, `interface`, `enum`.

```bash
node .opencode/xdomains/scripts/unity/unity-act.mjs \
  --project-root . --opencode-dir .opencode --ability script-scaffolding \
  --template monobehaviour --name PlayerController --namespace Game.Player --json
```

Without `--out` the content is returned and nothing is written. Writing requires `--out <dir>` plus
`--dryRun false --confirm`; a dry run reports the target path but writes nothing.
