<!-- Context: unity-3d/lookup/csharp-conventions | Priority: high | Version: 1.0 | Updated: 2026-09-07 -->

# C# Conventions (Unity)

## Naming
- **Types** (classes, structs, enums, interfaces): PascalCase. Interfaces: `I` prefix.
- **Methods, properties, public fields**: PascalCase.
- **Private fields**: camelCase with `_` prefix (`_speed`); `[SerializeField] private` for inspector-exposed state.
- **Constants**: PascalCase.
- **File name** must match the public class name (`PlayerController.cs` → `PlayerController`).

## MonoBehaviour Structure
```csharp
public class PlayerController : MonoBehaviour
{
    [SerializeField] private float _speed = 5f;
    private Rigidbody _rb;

    private void Awake() => _rb = GetComponent<Rigidbody>();

    private void FixedUpdate()
    {
        // physics movement via MovePosition / AddForce
    }
}
```

## Rules
- Cache `GetComponent` in `Awake`/`Start`; never per-frame.
- Use `FixedUpdate` for physics, `Update` for frame logic, `LateUpdate` for camera follow.
- Prefer Unity events/serialized references over polling.
- Null-check serialized references before use; log actionable messages.
- Keep methods small and focused; no unrelated whitespace/ordering changes.

## Editor Code
- Editor scripts live under an `Editor/` folder or `Editor` asmdef; extend `EditorWindow`, `CustomEditor`, or static menu via `MenuItem`.
