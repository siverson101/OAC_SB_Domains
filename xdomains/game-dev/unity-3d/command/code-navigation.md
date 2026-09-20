---
id: code-navigation
summary: Offline symbol and declaration lookup over project C# source and asmdefs, returning file:line results.
family: sense
mode: offline
description: Offline symbol and declaration lookup over project C# source and asmdefs, returning file:line results.
inputs: { projectRoot: "string", opencodeDir: "string", query: "string", assetFolder: "string" }
outputs: { query: "string", scannedFiles: "number", symbolCount: "number", matchCount: "number", assemblies: "object", matches: "array" }
sideEffects: []
uses: [gather-unity-context, asmdef-map]
provides: [code-navigation]
requires: [project-source]
versionCompatibility: { unity: ["6.0", "6.3", "6.5", "LTS+"] }
---

# code-navigation

Walks `.cs` files under the project's Assets folder, extracts namespace/type/method/member
declarations and reports each as `file:line`. Files are attributed to their owning assembly using
the Phase 2a asmdef reader. This is the offline substitute for a live code index — no Editor.

## Runs offline

```bash
node .opencode/xdomains/scripts/unity/unity-sense.mjs \
  --project-root . --opencode-dir .opencode --ability code-navigation --query PlayerController --json
```

The Assets folder is taken from `scan-result.json` (or `--asset-folder`). A missing Assets folder
reports `unknown`; an empty source tree reports `unavailable`. Results are capped at 200 matches
and flagged `truncated` when the cap is hit.
