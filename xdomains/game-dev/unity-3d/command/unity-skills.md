---
id: unity-skills
summary: Install, disable, or report the optional Unity Technologies `unity-skills` repository (user-initiated, gitignored vendor path, no redistribution).
family: compose
mode: both
description: Optional Unity skills integration (ADR-0019). `install` prompts for consent, downloads Unity-Technologies/skills into a gitignored vendor path, verifies LICENSE.md (Unity Companion License), ensures the path is gitignored, records the choice in unity-studio.json, and re-applies so the apply engine resolves the sk agent variants. `off` disables and re-applies the base agents; `status` reports the install state. The download is the only network step and runs only with explicit consent.
inputs: { projectRoot: "string", opencodeDir: "string", install: "bool", off: "bool", status: "bool", uiStack: "uitk|ugui|mixed", ref: "string" }
outputs: { vendorPath: "string", installed: "bool", licenseVerified: "bool", commit: "string|null", uiStack: "string", enabled: "bool", gitignoreUpdated: "bool", action: "string|null" }
sideEffects: ["writes .opencode/unity-studio.json", "downloads into .opencode/xdomains/vendor/unity-skills/ (gitignored)", "may update .gitignore"]
safetyGate: { mutates: true, requiresEditor: false, requiresApproval: true, writesState: true }
uses: []
provides: [unity-skills]
requires: []
usedBy: []
versionCompatibility: { unity: ["6.0", "6.3", "6.5", "LTS+"] }
---

# unity-skills

Optional, user-initiated install of Unity Technologies' `unity-skills` repository (ADR-0019). This
repository never redistributes the Work; it is downloaded into a gitignored vendor path and the agent
variants reference it by path only.

```bash
# Report
node .opencode/xdomains/scripts/unity/unity-skills.mjs \
  --project-root . --opencode-dir .opencode --status --json

# Install (explicit consent)
node .opencode/xdomains/scripts/unity/unity-skills.mjs \
  --project-root . --opencode-dir .opencode --install --yes --ui-stack uitk

# Disable
node .opencode/xdomains/scripts/unity/unity-skills.mjs \
  --project-root . --opencode-dir .opencode --off
```

Verification: `LICENSE.md` must exist in the downloaded repository and contain "Unity Companion
License" and a Unity Technologies copyright line; otherwise the partial download is removed and the
install is refused. The vendor path (`.opencode/xdomains/vendor/`) is added to `.gitignore`.
