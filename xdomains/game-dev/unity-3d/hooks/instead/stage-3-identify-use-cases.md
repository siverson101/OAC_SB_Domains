---
description: "Unity use-case and workflow questions"
requires: [selected_subdomain]
---

# Stage 3 — Unity use cases

Replaces the built-in use-case questions.

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

Then record the version baseline (offline, fail-soft). This is the Session-Start Version Check: it
compares the Editor version, packages and Unity CLI against the stored baselines and writes only the
baseline files under `.opencode/project-data/version-baselines/`. It never fails a build; if the
script or a Unity project is absent, warn and continue.

```bash
node .opencode/xdomains/scripts/unity/version-drift.mjs \
  --project-root . \
  --opencode-dir .opencode \
  --if-due --max-age-hours 24
```

Ask the user to describe the Unity work this system should support:

1. The top 3-5 tasks (for example: "implement a player controller", "assemble a scene and
   prefabs safely", "author UI Toolkit screens", "run EditMode/PlayMode tests", "set up a
   batch-mode build").
2. For each task, its complexity: simple / moderate / complex.
3. Any sequencing between tasks (for example: scene assembly before tests, implementation
   before validation).

## Capture

- `use_cases[]` (name, description, complexity)
- `complexity_map{}`
- `workflow_dependencies[]`

Emit the same shape the built-in Stage 3 would, so Stage 6 can summarize it unchanged.
