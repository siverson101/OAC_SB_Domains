---
description: "Unity 2D toolchain and integration questions"
requires: [selected_subdomain]
---

# Stage 5 — Unity 2D integrations

Replaces the built-in integration questions for the `unity-2d` sub-domain.

Ask which surfaces the system should use:

1. Unity CLI for build, test (`run_tests`), play (`editor_play`), and capture (`capture_game_view`).
2. DevTools (`devtools.cmd compile|verify|test|build-native|status ... --json`).
3. Whether mutating Unity CLI calls should prefer `dry_run` while exploring (recommended: yes).
4. Whether a native plugin build is part of the workflow (usually not for 2D).

## Capture

- `integrations[]`
- `native_builds` (bool)
- `prefer_dry_run` (bool)
