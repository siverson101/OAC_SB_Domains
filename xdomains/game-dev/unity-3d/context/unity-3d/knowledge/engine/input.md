<!-- Context: unity-3d/knowledge/engine/input | Priority: high | Version: 1.0 | Updated: 2026-09-20 | Unity: 6.0,6.3,6.5,LTS+ -->

# Input (Unity 6.x)

Scope: the **Input System** package (recommended) and the legacy Input Manager. Detect which the
project uses via `project-settings.json` (`activeInputHandler`) before generating input code.

## Input System (`com.unity.inputsystem`)
- Define an **Input Actions asset**: Action Maps -> Actions -> Bindings. Generate a C# wrapper class
  for type-safe access.
- Subscribe with `performed`/`canceled` callbacks and enable the map; disable it when the context ends.
- Read continuous values with `ReadValue<Vector2>()`; use `Interactions` (Hold, Tap, MultiTap) and
  `Processors` (Normalize, Invert, Deadzone) instead of hand-rolled timing.
- Player Input component offers `Send Messages`, `Invoke Unity Events`, and `Invoke C# Events` modes;
  the C# Events mode is the most testable.
- Device changes arrive via `InputSystem.onDeviceChange`; support hot-plugging gamepads.

## Legacy Input Manager
- `Input.GetAxis`, `Input.GetButton`, `Input.GetKey`, `Input.mousePosition`.
- Only use legacy input when the project already relies on it; do not mix the two in one action path.
- The `activeInputHandler` project setting selects `Input Manager (Old)`, `Input System Package (New)`,
  or `Both`.

## Conventions
- Centralise input in a thin service/adapter; gameplay code consumes intents, not raw device reads.
- Name actions by intent (`Move`, `Jump`, `Interact`), not by key.
- Remap controls from the Actions asset at runtime; persist rebinds with `PerformInteractiveRebinding`.

## Testing
- Feed synthetic input in PlayMode tests via `InputTestFixture` and `InputSystem.QueueStateEvent`.
- Keep input handling separate from simulation so logic is testable without devices.

> Verify against primary sources: Input System APIs, control paths and package versions change between
> releases. Confirm against the Input System package docs for the version in use.
