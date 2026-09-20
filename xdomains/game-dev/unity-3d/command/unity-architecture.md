---
description: Review or design Unity 3D project architecture, folder layout, and performance budgets
---

# Unity Architecture Command

Run directly by the Unity 3D Orchestrator to analyze/design project architecture.

## Usage

```
/unity-architecture [area]
```

`area` optional: `structure` (folder layout), `performance` (budgets), `review` (current state), or empty for full overview.

Example: `/unity-architecture review`

## Workflow

1. Load context: `.opencode/context/unity-3d/concepts/project-layout.md` + `lookup/performance-budgets.md` + `navigation.md`
2. Inspect the Unity project structure (Assets/, Packages/, ProjectSettings/) and key scripts
3. Assess against layout conventions, architecture clarity, and performance budgets
4. Produce recommendations: folder reorganization, asmdefs, dependency structure, budget targets
5. Confirm before applying structural changes

## Success Criteria

- [ ] Current state assessed against standards
- [ ] Clear, prioritized recommendations
- [ ] Changes applied only after approval
