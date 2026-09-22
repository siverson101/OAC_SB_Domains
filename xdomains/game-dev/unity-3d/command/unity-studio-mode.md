---
id: unity-studio-mode
summary: Swap the installed agent hierarchy between Lean and Full Studio, backing up the current agent set and preserving project-data, context, commands, abilities, recipes and config.
family: compose
mode: offline
description: The canonical studio-mode swap (ADR-0013). Reads the current `.opencode/unity-studio.json` mode, backs up the installed agent set to a timestamped directory under `.opencode/backups/unity-studio-mode/`, installs the requested hierarchy through the Phase 4 apply engine (`merge-domains.js --studio-mode`), and refreshes the registry. Only the agent set changes; an unknown or absent mode refuses loudly and writes nothing.
inputs: { projectRoot: "string", opencodeDir: "string", mode: "lean|full" }
outputs: { status: "string", previousMode: "string", studioMode: "string", backupDir: "string?", registry: "string" }
sideEffects: ["writes a timestamped backup under .opencode/backups/unity-studio-mode/", "replaces the installed agent set", "rewrites .opencode/unity-studio.json studioMode", "regenerates .opencode/registry.json and .opencode/context/unity-3d/registry.md"]
safetyGate: { mutates: true, requiresEditor: false, writesState: true }
uses: []
provides: [unity-studio-mode, studio-mode-swap]
requires: [unity-studio-config]
testPlan: ["Swap lean to full and confirm the full-studio agents install and the lean agents are gone", "Swap back and confirm shared context/commands/abilities are unchanged and no namespaced duplicates appear", "Confirm an unknown or absent mode refuses and writes nothing"]
versionCompatibility: { unity: ["6.0", "6.3", "6.5", "LTS+"] }
---

# unity-studio-mode

Swap the installed agent hierarchy in place. Lean and Full Studio are mutually exclusive
(ADR-0013); this is the one canonical swap and it reuses the Phase 4 apply engine rather than
reimplementing selection.

## Usage

```
/unity-studio-mode <lean|full>
```

Example: `/unity-studio-mode full`

## Workflow

1. Read the current mode from `.opencode/unity-studio.json` (default `lean`).
2. Back up the installed agent set and the mode config to
   `.opencode/backups/unity-studio-mode/<timestamp>/` so a failed swap is recoverable.
3. Remove the current hierarchy's agents and install the requested one via
   `merge-domains.js --mode replace --studio-mode <mode>`.
4. Refresh the registry so it reflects the new mode.

```bash
node .opencode/xdomains/game-dev/unity-3d/scripts/unity-studio-mode.js \
  --opencode-dir .opencode --mode full --json
```

## Preservation

Project-data, context, commands, abilities, recipes and config are common to both hierarchies and
are preserved; only the agent set changes. Installing the same mode is a clean re-apply.

## Refusal

An unknown or absent mode refuses loudly (exit code 2) before anything is written. The swap only
proceeds for `lean` or `full`.
