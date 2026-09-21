---
id: primitive-composition
summary: Read primitive.yaml composition (depends-on via requires.primitives, wire-through events, and the compatiblePrimitives/conflictsWith graph) and report edges, conflicts, cycles and unresolved references.
family: compose
mode: offline
description: Discover every primitive.yaml under a primitives directory, build the composition graph, and report depends-on edges, wire-through events, compatibility/conflict pairs, dependency cycles and references to unknown primitives. Offline and fail-soft.
inputs: { projectRoot: "string", primitivesDir: "string?" }
outputs: { status: "string", primitivesDir: "string", report: "object" }
sideEffects: []
safetyGate: { mutates: false, requiresEditor: false }
uses: []
provides: [primitive-composition, composition-graph]
requires: [primitives-dir]
testPlan: ["Build the graph and confirm depends-on and event edges", "Confirm a conflictsWith pair is reported", "Confirm a dependency cycle is detected"]
versionCompatibility: { unity: ["6.0", "6.3", "6.5", "LTS+"] }
---

# primitive-composition

Reads the composition declared by `primitive.yaml` (the unity-skills primitive contract) and turns
it into a graph:

- **depends-on** — `requires.primitives[]` becomes a `requires` edge; a reference to an unknown
  primitive is reported under `unresolved`.
- **wire-through events** — `wireThroughEvents` / `events[]` become `event` edges.
- **compatibility graph** — `compatiblePrimitives[]` becomes `compatible` edges and
  `conflictsWith[]` becomes `conflicts` edges plus a de-duplicated `conflicts[]` list.
- **cycles** — dependency cycles in the `requires` graph are reported.

```bash
node .opencode/xdomains/scripts/unity/unity-compose.mjs \
  --project-root . --opencode-dir .opencode \
  --ability primitive-composition --primitives-dir xdomains/game-dev/unity-3d/primitives --json
```

Offline, read-only and fail-soft: a missing primitives directory reports `unavailable` with an empty
report and never throws.
