# Unity 2D (game-dev sub-domain)

## Overview
Unity 2D sub-domain of the `game-dev` domain. Ships an orchestrator, 7 specialist subagents,
9 commands, and a function-based context library. Installed under
`.opencode/xdomains/game-dev/unity-2d/`; applied into `.opencode/` by `/build-context-system`.

## Contents
- Manifest: `sb-domain.json`
- Shared context: `context/domain/unity-common.md` (declared in `sharedContext`)
- Starter context: `context/domain/unity-2d.md`
- Agent: `agent/unity-2d-orchestrator.md`
- Subagents: `agent/subagents/unity/{implementer,scene,uitk,animator,shadervfx,artasset,qa}.md`
- Commands: `command/{unity-feature,unity-scene,unity-test,unity-build,unity-architecture,unity-animator,unity-vfx,unity-ase,uitk}.md`
- Context library: `context/unity-2d/{navigation.md,concepts,guides,lookup,examples,errors,workflows}`
- Hooks: `hooks/instead/stage-{3,4,5,7}-*.md`
- Projection: `context-projections.json` + `scripts/build-project-context.js`

## Applying

```bash
node .opencode/xdomains/merge-domains.js \
  --domain-dir .opencode/xdomains/game-dev/unity-2d \
  --opencode-dir .opencode \
  --mode extend
```

## Hooks

| Hook | Purpose |
|------|---------|
| `instead/stage-3-identify-use-cases.md` | Unity 2D use cases and workflows |
| `instead/stage-4-assess-complexity.md` | agent count, 2D systems, test methodology, UI |
| `instead/stage-5-identify-integrations.md` | Unity CLI / DevTools surfaces |
| `instead/stage-7-generate-system.md` | apply assets, project project data, adapt, deliver |

## Related
- Domain docs: `../README.md` (game-dev), `../../README.md` (xdomains)
- Registry and provenance: `registry.md`
