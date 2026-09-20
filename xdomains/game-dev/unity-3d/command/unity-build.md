---
description: Run a Unity batch-mode build for a target platform and report output/errors
---

# Unity Build Command

Routes to the Unity 3D Orchestrator → UnityQA/UnityImplementer to run a **batch-mode build**.

## Usage

```
/unity-build {platform}
```

Platforms: `Win64` (default), `Android`, `iOS`, `StandaloneOSX`, etc.

Example: `/unity-build Win64`

## Workflow

1. Load context: `.opencode/context/unity-3d/guides/build-cli.md` + `lookup/validation-rules.md`
2. Confirm an Editor build script exists (see `examples/editor-utilities.md`); create via `UnityImplementer` if missing
3. Run Unity batch-mode build for the target platform
4. Report exit code, output path, log location, and first errors
5. On failure: report → propose → request approval before fixing

## Success Criteria

- [ ] Build exits 0 (or blocking errors reported)
- [ ] Output path reported
- [ ] Log tail captured
