---
id: uitk-interaction
summary: Inspect the UI Toolkit visual tree and dispatch clicks in the running Player through the Unity CLI live channel.
family: run
mode: live
description: Read the UI Toolkit tree and click elements (uitk_tree, uitk_click) in a live Editor/Player. Fail-soft to unavailable without a live channel.
inputs: { projectRoot: "string", opencodeDir: "string", operation: "uitk_tree|uitk_click" }
outputs: { status: "string", operation: "string", transport: "string", data: "object" }
sideEffects: ["uitk_click may mutate Player UI state"]
safetyGate: { mutates: false, requiresEditor: true, requiresApproval: false }
uses: [gather-unity-context]
provides: [uitk-interaction]
requires: [unity-cli]
usedBy: [unity-change-loop]
versionCompatibility: { unity: ["6.0", "6.3", "6.5", "LTS+"] }
---

# uitk-interaction

Interacts with UI Toolkit in the running Player: read the visual tree (`uitk_tree`) and dispatch
clicks on named elements (`uitk_click`), over the Unity CLI live channel.

```bash
node .opencode/xdomains/scripts/unity/unity-run.mjs \
  --project-root . --opencode-dir .opencode \
  --ability uitk-interaction --operation uitk_tree --json
```

Fail-soft: with no live channel/Editor the ability reports `unavailable` and never throws.
