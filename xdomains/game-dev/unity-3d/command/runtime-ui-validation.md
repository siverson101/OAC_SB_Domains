---
id: runtime-ui-validation
summary: Snapshot, find, click and key the running Player's UI through the Unity CLI live channel to validate runtime behaviour.
family: run
mode: live
description: Drive runtime UI validation (ui_snapshot, ui_find, ui_click, ui_key) against a live Editor/Player. Fail-soft to unavailable without a live channel.
inputs: { projectRoot: "string", opencodeDir: "string", operation: "ui_snapshot|ui_find|ui_click|ui_key" }
outputs: { status: "string", operation: "string", transport: "string", data: "object" }
sideEffects: ["ui_click/ui_key may mutate Player UI state"]
safetyGate: { requiresEditor: true, requiresApproval: false }
uses: [gather-unity-context]
provides: [runtime-ui-validation]
requires: [unity-cli]
usedBy: [unity-change-loop]
versionCompatibility: { unity: ["6.0", "6.3", "6.5", "LTS+"] }
---

# runtime-ui-validation

Validates the running Player's UI by snapshotting the screen, finding elements, and dispatching
clicks/keys over the Unity CLI live channel (`ui_snapshot`, `ui_find`, `ui_click`, `ui_key`). It is
the observe stage's live counterpart for visual changes.

```bash
node .opencode/xdomains/scripts/unity/unity-run.mjs \
  --project-root . --opencode-dir .opencode \
  --ability runtime-ui-validation --operation ui_snapshot --json
```

Fail-soft: with no live channel/Editor the ability reports `unavailable` and never throws.
