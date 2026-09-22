# Unity 3D (game-dev sub-domain)

## Overview
Unity 3D sub-domain of the `game-dev` domain. Ships an orchestrator, 7 specialist subagents,
19 commands (lifecycle, domain, runtime loops and the workflow catalog), and a function-based context library. Installed
under `.opencode/xdomains/game-dev/unity-3d/`; applied into `.opencode/` by `/build-context-system`.

## Contents
- Manifest: `sb-domain.json`
- Shared context: `context/domain/unity-common.md` (declared in `sharedContext`)
- Starter context: `context/domain/unity-3d.md`
- Agent: `agent/unity-3d-orchestrator.md`
- Subagents: `agent/subagents/unity/{implementer,scene,uitk,animator,shadervfx,artasset,qa}.md`
- Commands: `command/{unity-setup,unity-brainstorm,unity-plan,unity-implement,unity-debug,unity-polish,unity-review,unity-scene,unity-test,unity-build,unity-architecture,unity-animator,unity-vfx,unity-ase,uitk,unity-runtime-target,unity-prefab-sweep,unity-performance,workflow-catalog}.md`
- Context library: `context/unity-3d/{navigation.md,concepts,guides,lookup,examples,errors,workflows}`
- Hooks: `hooks/instead/stage-{3,4,5,7}-*.md`
- Projection: `context-projections.json` + `scripts/build-project-context.js`

## Applying

```bash
node .opencode/xdomains/merge-domains.js \
  --domain-dir .opencode/xdomains/game-dev/unity-3d \
  --opencode-dir .opencode \
  --mode extend
```

## Hooks

| Hook | Purpose |
|------|---------|
| `instead/stage-3-identify-use-cases.md` | Unity 3D use cases and workflows |
| `instead/stage-4-assess-complexity.md` | agent count, 3D systems, test methodology, UI |
| `instead/stage-5-identify-integrations.md` | Unity CLI / DevTools / native build surfaces |
| `instead/stage-7-generate-system.md` | apply assets, project project data, adapt, deliver |

## Related
- Domain docs: `../README.md` (game-dev), `../../README.md` (xdomains)
- Registry and provenance: `registry.md`
