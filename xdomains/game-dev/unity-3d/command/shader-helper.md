---
id: shader-helper
summary: Emit fresh ShaderLab/HLSL shader templates (built-in unlit, URP unlit/lit, fullscreen blit).
family: act
mode: offline
description: Produce fresh Unity shader templates for a named shader; writes only when confirm and an output path are supplied.
inputs: { projectRoot: "string", opencodeDir: "string", template: "string", name: "string", out: "string", dryRun: "boolean", confirm: "boolean" }
outputs: { template: "string", language: "string", fileName: "string", content: "string", written: "boolean", outPath: "string" }
sideEffects: ["writes a .shader file only when --confirm is supplied with --out"]
safetyGate: { dryRunFirst: true, requireConfirm: true }
uses: [gather-unity-context]
provides: [shader-helper]
requires: [unity-project]
versionCompatibility: { unity: ["6.0", "6.3", "6.5", "LTS+"] }
---

# shader-helper

Emits **fresh** ShaderLab/HLSL templates authored for OAC. Templates: `unlit`, `urp-unlit`,
`urp-lit`, `fullscreen`.

```bash
node .opencode/xdomains/scripts/unity/unity-act.mjs \
  --project-root . --opencode-dir .opencode --ability shader-helper \
  --template urp-unlit --name OacGlow --json
```

Use `platform-info` and `asset-intelligence` first to confirm the render pipeline before picking a
template. Without `--out` the content is returned and nothing is written; writing requires
`--out <dir> --dryRun false --confirm`.
