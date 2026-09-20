---
description: Run Unity EditMode/PlayMode tests and report the verification gate
---

# Unity Run Tests

Run the project's tests. Prefer the running Editor; if none is open, the gather script starts one
with `-automated` and stops it again afterwards.

```bash
node .opencode/xdomains/scripts/unity/gather-unity-context.mjs \
  --project-root . \
  --opencode-dir .opencode \
  --gate
```

Results land in `.opencode/project-data/unity-verification-report.json` and `gate-state.json`; the
raw runs are kept in `.opencode/.scratch/<sub-domain>/run-tests-*.json`. Report the gate verdict and
per-mode counts.
