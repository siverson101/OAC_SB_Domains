---
id: runtime-debugging
summary: Read runtime logs/errors from the running Player through the Unity CLI live channel, and run arbitrary Player code only behind an explicit approval gate.
family: run
mode: live
description: Surface runtime logs and errors (get_logs --logType Error) from a live Editor/Player. Arbitrary runtime code execution (execute-code) is approval-gated per ADR-0018. Fail-soft to unavailable without a live channel.
inputs: { projectRoot: "string", opencodeDir: "string", operation: "get_logs|execute-code", code: "string?" }
outputs: { status: "string", operation: "string", transport: "string", data: "object", approval: "object" }
sideEffects: ["read-only log reads", "approval-gated runtime code execution may mutate Player state"]
safetyGate: { requiresEditor: true, requiresApproval: true }
uses: [gather-unity-context]
provides: [runtime-debugging]
requires: [unity-cli]
usedBy: [unity-change-loop]
versionCompatibility: { unity: ["6.0", "6.3", "6.5", "LTS+"] }
---

# runtime-debugging

Reads runtime logs and errors from the running Editor/Player over the Unity CLI live channel
(`unity command get_logs --logType Error`). The concrete `cli`/`mcp` transport is a seam that lands
later; until then, or without a live Editor, the ability reports `unavailable` (fail-soft) and never
throws.

```bash
node .opencode/xdomains/scripts/unity/unity-run.mjs \
  --project-root . --opencode-dir .opencode \
  --ability runtime-debugging --operation get_logs --json
```

**Runtime code execution** (`--operation execute-code`) runs arbitrary C# in the Player and is
unsafe, so it sits behind an explicit approval gate (ADR-0018):

```bash
node .opencode/xdomains/scripts/unity/unity-run.mjs \
  --project-root . --opencode-dir .opencode \
  --ability runtime-debugging --operation execute-code \
  --code "return 1 + 1;" --approve-code-execution --json
```

Without `--approve-code-execution` the call is `refused` before any channel is touched.
