---
description: "Unity 2D use-case and workflow questions"
requires: [selected_subdomain]
---

# Stage 3 — Unity 2D use cases

Replaces the built-in use-case questions for the `unity-2d` sub-domain.

## Project scan (run first, fail-soft)

Run the shared project scanner so the questions below can use real project state. If the script or
a Unity project is absent, warn and continue with the generic questions.

```bash
node .opencode/xdomains/scripts/unity/scan-project.mjs \
  --project-root . \
  --opencode-dir .opencode
```

The scanner writes raw project data to `.opencode/project-data/` and intermediate files to
`.opencode/xdomains/context/project/`, then prints a `scan-result.json` summary (project name,
Unity version, packages, preferences, input flags). Use it to inform the questions and Stage 4.

Then gather the full Unity context (project structure, toolchain, commands, pipeline, Unity CLI MCP, and —
when the Editor is available — the verification gate). Also fail-soft:

```bash
node .opencode/xdomains/scripts/unity/gather-unity-context.mjs \
  --project-root . \
  --opencode-dir .opencode
```

Ask the user to describe the 2D work this system should support:

1. The top 3-5 tasks, for example:
   - 2D gameplay C# (movement, Rigidbody2D physics, state machines)
   - sprite and animation work (Sprite Library, Animator, flipbooks)
   - scene and prefab assembly (safe YAML edits, GUID-preserving)
   - UI Toolkit or UGUI screens
   - Tilemap level editing
   - art/asset import (sprite atlases, pixel-perfect settings)
   - EditMode/PlayMode tests and batch-mode builds
2. For each task, its complexity: simple / moderate / complex.
3. Sequencing, for example: implement → test → validate, or scene assembly before QA.

## Capture

- `use_cases[]` (name, description, complexity)
- `complexity_map{}`
- `workflow_dependencies[]`
