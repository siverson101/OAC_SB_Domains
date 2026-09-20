---
description: Gather the full Unity context (structure, toolchain, commands, pipeline, Unity CLI MCP, gate) for the project
---

# Gather Unity Context

Run the project gather script and report what it produced. It is fail-soft: if the script or a Unity
project is absent, report that and continue.

```bash
node .opencode/xdomains/scripts/unity/gather-unity-context.mjs \
  --project-root . \
  --opencode-dir .opencode
```

## Outputs

Written to `.opencode/project-data/`:

- `project-structure.json` — runtime vs editor scripts, asmdefs, UXML/USS, scenes, prefabs, models,
  images, sprites, audio, action maps, native libraries, and third-party folders.
- `unity-command-list.json` / `unity-command-schema.json` — Editor/Pipeline commands.
- `unity-pipeline-status.json` — Pipeline package and Editor instances.
- `unity-mcp-status.json` — Unity CLI MCP server/client status.
- `unity-verification-report.json` / `gate-state.json` — compile + EditMode/PlayMode verdict and
  project fingerprint.

Add `--gate` to run the verification gate (compile + tests; requires the Editor). Add
`--non-interactive` for CI.

Report the script's `gateResult`, `baseFolder`, and the files it wrote.
