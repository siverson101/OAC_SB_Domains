<!-- Context: unity-3d/knowledge/middleware/soap | Priority: medium | Version: 1.0 | Updated: 2026-09-20 | Unity: 6.0,6.3,6.5,LTS+ -->

# SOAP (ScriptableObject Architecture Pattern)

SOAP is an architecture pattern, not a single package. It uses `ScriptableObject` assets as shared
data containers and event channels so systems communicate without direct references.

## Building Blocks
- **Variable assets**: a `ScriptableObject` wrapping a value (for example `FloatVariable`) with an
  `OnChanged` event. Consumers read `.Value` and subscribe to changes.
- **Event channels**: a `GameEvent` asset that raises a payload; listeners implement a handler and
  register/unregister on enable/disable.
- **Runtime sets**: a `RuntimeSet<T>` asset tracking active instances (enemies, targets) for systems
  that need the live collection.
- **Listeners**: MonoBehaviour bridges that subscribe an inspector-assigned response to an event.

## Rules
- Reset mutable SO state on `OnEnable`/`OnDisable` (and via `OnAfterDeserialize` in the Editor) so
  play sessions do not leak values between runs.
- Never mutate a shared variable asset at runtime without resetting it; values persist in the Editor.
- Subscribe in `OnEnable`, unsubscribe in `OnDisable`; a destroyed listener must not stay registered.
- Use event channels for cross-system decoupling; use plain C# events for intra-system communication.
- Do not use SOAP to smuggle mutable global state; keep assets as data + channels, not god objects.

## Relationship to Other Middleware
- Overlaps with FlowFramework events and DI. The pattern resolver surfaces the conflict; do not
  combine SOAP channels and a DI event bus for the same concern.

## Testing
- SOAP assets are plain objects: create a test instance with `ScriptableObject.CreateInstance<T>()`
  and assert value/event behaviour in EditMode tests.
- Remember to destroy created assets in `[TearDown]`.

> Verify against primary sources: SOAP is a community pattern with many variants. Confirm the exact
> base classes against the project's own implementation.
