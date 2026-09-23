---
id: ugui-interaction
summary: Hint alias for ui-interaction with stack=ugui.
family: run
mode: live
description: Hint alias. Resolves to the ui-interaction ability with the UGUI stack hint; it has no separate runtime behaviour.
inputs: { projectRoot: "string", opencodeDir: "string", operation: "uitk_tree|uitk_click" }
outputs: { status: "string", operation: "string", transport: "string", data: "object" }
sideEffects: ["a click operation may mutate Player UI state"]
safetyGate: { mutates: false, requiresEditor: true, requiresApproval: false }
uses: [gather-unity-context]
provides: [ugui-interaction]
requires: [ui-interaction]
usedBy: [unity-change-loop]
versionCompatibility: { unity: ["6.0", "6.3", "6.5", "LTS+"] }
---

# ugui-interaction (hint alias)

This is a hint alias for `ui-interaction`. It carries no separate implementation: call
`ui-interaction` with the UGUI stack hint.

```bash
node .opencode/xdomains/scripts/unity/unity-run.mjs \
  --project-root . --opencode-dir .opencode \
  --ability ui-interaction --operation uitk_tree --stack ugui --json
```
