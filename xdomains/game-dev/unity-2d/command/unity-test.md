---
description: Run Unity tests (EditMode/PlayMode) and summarize results
---

# Unity Test Command

Routes to the Unity 2D Orchestrator → UnityQA to run the **quality-gate** test stages.

## Usage

```
/unity-test [scope]
```

`scope` optional: feature, class, or empty for full run.

Example: `/unity-test PlayerController`

## Workflow

1. Load context: `.opencode/context/unity-2d/lookup/validation-rules.md` + `guides/build-cli.md`
2. Run compile checks (dotnet/csc or Unity CLI)
3. Run Unity Test Runner via batch mode (`-runTests`) — EditMode first, PlayMode as applicable
4. Report pass/fail per test assembly with evidence (XML/log locations)

## Success Criteria

- [ ] Compile clean
- [ ] Targeted tests pass
- [ ] Failures reported with log tail (no silent success)
