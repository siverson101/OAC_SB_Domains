---
description: "Unity toolchain and integration questions"
requires: [selected_subdomain]
---

# Stage 5 — Unity integrations

Replaces the built-in integration questions.

Ask which Unity and tooling surfaces the system should use:

1. Unity CLI (`unity command --project-path={projectPath} ...`) for build, test, play, capture.
2. DevTools (`devtools.cmd compile|verify|test|build-native|status ... --json`).
3. Native plugin builds (for example a GraphicsCapture `.sln`).
4. Whether mutating Unity CLI calls should prefer `dry_run` while exploring.

## Capture

- `integrations[]`
- `native_builds` (bool)
- `prefer_dry_run` (bool)

The project scan itself is not performed here; it is consumed during Stage 7 from project data.
