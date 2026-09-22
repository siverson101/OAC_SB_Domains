---
id: unity-plan
summary: Plan a Unity 3D feature before implementing — write the plan artifact (context, design, test cases, testing decisions) and assemble the per-feature test plan.
family: compose
mode: offline
description: The Pre-Production entry point. Routes to the Unity 3D Orchestrator to produce .opencode/plans/<slug>.md via plan-feature (TDD-gated, Testability PASS/WARN/FAIL) and .opencode/test-plans/<slug>.md via test-plan. Offline; writes only under .opencode/.
inputs: { projectRoot: "string", opencodeDir: "string", feature: "string", context: "string?", design: "string?", testCases: "string", testingDecisions: "string?", testability: "PASS|WARN|FAIL", tradeOffs: "string?", abilities: "array?" }
outputs: { status: "string", planPath: "string?", testPlanPath: "string?", testability: "string?" }
sideEffects: ["writes .opencode/plans/<slug>.md", "writes .opencode/test-plans/<slug>.md"]
safetyGate: { mutates: false, requiresEditor: false, writesState: true }
uses: [plan-feature, test-plan, primitive-composition, contract-aware-design]
provides: [unity-plan, plan-artifact, test-plan-artifact]
requires: [unity-studio-config, test-cases]
versionCompatibility: { unity: ["6.0", "6.3", "6.5", "LTS+"] }
---

# unity-plan

Plan the work and its tests before implementing. Routes to the Unity 3D Orchestrator to run the
**Pre-Production** phase of the lifecycle catalog (ADR-0016).

## Usage

```
/unity-plan {feature}
```

Example: `/unity-plan player-jump`

## Context

1. `.opencode/context/unity-3d/navigation.md` (always)
2. `workflows/feature-delivery.md`
3. `lookup/csharp-conventions.md` + `lookup/validation-rules.md`

## Workflow

1. `plan-feature` — assemble Context, Implementation Design, Test Cases, Testing Decisions, the
   Testability Assessment and Known Trade-offs into `.opencode/plans/<slug>.md`. TDD-gated; a
   Testability `FAIL` loops back once then aborts and writes no plan.
2. `test-plan` — assemble `.opencode/test-plans/<slug>.md` from the capability contracts named by
   `--abilities` (no hand-maintained feature mapping).
3. Confirm the plan and test plan with the user before implementation.

## Success Criteria

- [ ] Plan artifact written (or a Testability loopback reported)
- [ ] Test plan written from capability contracts
- [ ] Seams and test cases agreed with the user
