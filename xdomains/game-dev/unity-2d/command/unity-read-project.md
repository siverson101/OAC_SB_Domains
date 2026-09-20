---
description: Scan the Unity project (identity, packages, preferences, files) and write project data
---

# Unity Read Project

Read-only discovery of the Unity project so agents and later stages have real project state.

```bash
node .opencode/xdomains/scripts/unity/scan-project.mjs \
  --project-root . \
  --opencode-dir .opencode
```

Writes `.opencode/project-data/` (identity, packages, preferences, files, scan summary) and
`.opencode/xdomains/context/project/` (raw packages, combined `project.json`). Add
`--non-interactive` for CI. Fail-soft.

For the full Unity context (structure, commands, pipeline, Unity CLI MCP, gate), run `gather-unity-context`.
