---
id: ui-interaction
summary: Inspect and interact with the project's UI (UI Toolkit / UGUI) in the running Player through the Unity CLI live channel.
family: run
mode: live
description: Read the UI tree and dispatch clicks on named elements in a live Editor/Player. The `stack` hint (uitk|ugui|mixed) selects which UI system to target. Fail-soft to unavailable without a live channel.
inputs: { projectRoot: "string", opencodeDir: "string", stack: "uitk|ugui|mixed", operation: "uitk_tree|uitk_click" }
outputs: { status: "string", operation: "string", transport: "string", data: "object" }
sideEffects: ["a click operation may mutate Player UI state"]
safetyGate: { mutates: false, requiresEditor: true, requiresApproval: false }
uses: [gather-unity-context]
provides: [ui-interaction]
requires: [unity-cli]
usedBy: [unity-change-loop]
versionCompatibility: { unity: ["6.0", "6.3", "6.5", "LTS+"] }
---

# ui-interaction

Interacts with the project's UI in the running Player: read the tree (`uitk_tree`) and dispatch
clicks on named elements (`uitk_click`), over the Unity CLI live channel. The `--stack` hint
(`uitk` | `ugui` | `mixed`) selects which UI system to target; `mixed` projects must pass it.

```bash
node .opencode/xdomains/scripts/unity/unity-run.mjs \
  --project-root . --opencode-dir .opencode \
  --ability ui-interaction --operation uitk_tree --stack uitk --json
```

Fail-soft: with no live channel/Editor the ability reports `unavailable` and never throws. A `live`
route means the CLI channel was **selected**, not that the call succeeded.

`uitk-interaction` and `ugui-interaction` are hint aliases: they resolve to this ability with
`--stack uitk` / `--stack ugui` respectively.
