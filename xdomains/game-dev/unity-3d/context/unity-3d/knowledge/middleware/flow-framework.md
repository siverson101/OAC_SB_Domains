<!-- Context: unity-3d/knowledge/middleware/flow-framework | Priority: medium | Version: 1.0 | Updated: 2026-09-20 | Unity: 6.0,6.3,6.5,LTS+ -->

# FlowFramework

Package family: `com.flowframework` (for example `com.flowframework.uicomposition`). A project-level
architecture framework that wires flow/state transitions and decoupled events. Treat the exact API as
project-specific: read the installed package source before generating code.

## Concepts
- **Flow / state graph**: application states and the transitions between them, authored as data and
  driven by a controller rather than scattered `if` branches.
- **Event channels**: publish/subscribe seams that decouple senders from receivers; the same idea as
  the ScriptableObject Architecture Pattern (`soap.md`).
- **Composition**: services and UI are composed at a root scope, not found via global singletons.

## Working with It
- Detect the installed version from `Packages/manifest.json` and read the package's own README/source
  for the current type names before writing code.
- Follow the project's existing flow definitions; do not introduce a second event bus or state machine
  alongside FlowFramework.
- Register/unregister listeners on enable/disable to avoid leaks; the framework does not always do
  this for you.
- Keep flow nodes small and single-purpose; push gameplay detail into plain systems the flow calls.

## Relationship to Other Middleware
- Overlaps with DI (`dependency-injection.md`) and SOAP (`soap.md`). The pattern resolver must surface
  the conflict and let the project choose; do not silently pick one.
- If the project uses FlowFramework for events, prefer its channels over ad-hoc static events.

## Testing
- Flow transitions are data; assert transitions with EditMode tests that drive the controller directly.
- Stub event channels in tests to observe published messages without the full runtime.

> Verify against primary sources: FlowFramework is not a Unity first-party package and its API is
> project-version specific. Always confirm against the installed package source.
