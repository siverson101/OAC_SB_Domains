<!-- Context: unity-2d/examples/mono-behaviour-templates | Priority: medium | Version: 1.0 | Updated: 2026-09-17 -->

# MonoBehaviour Templates (Unity 2D)

## Player Controller (2D, physics)
```csharp
using UnityEngine;

public class PlayerController2D : MonoBehaviour
{
    [Header("Movement")]
    [SerializeField] private float _moveSpeed = 5f;
    [SerializeField] private float _jumpForce = 6f;

    [Header("Checks")]
    [SerializeField] private Transform _groundCheck;
    [SerializeField] private LayerMask _groundMask;

    private Rigidbody2D _rb;

    private void Awake() => _rb = GetComponent<Rigidbody2D>();

    private void FixedUpdate()
    {
        float h = Input.GetAxisRaw("Horizontal");
        bool grounded = Physics2D.OverlapCircle(_groundCheck.position, 0.1f, _groundMask);

        if (grounded && Input.GetButton("Jump"))
        {
            _rb.AddForce(Vector2.up * _jumpForce, ForceMode2D.Impulse);
        }

        _rb.linearVelocity = new Vector2(h * _moveSpeed, _rb.linearVelocity.y);
    }
}
```

## Camera Follow (LateUpdate)
```csharp
public class CameraFollow2D : MonoBehaviour
{
    [SerializeField] private Transform _target;
    [SerializeField] private Vector3 _offset = new Vector3(0f, 1f, -10f);
    [SerializeField] private float _smooth = 8f;

    private void LateUpdate()
    {
        if (_target == null) return;
        Vector3 desired = _target.position + _offset;
        transform.position = Vector3.Lerp(transform.position, desired, _smooth * Time.deltaTime);
    }
}
```

## Testable Movement (pure logic, EditMode-friendly)
```csharp
public static class MovementMath2D
{
    public static Vector2 ClampedVelocity(Vector2 input, float speed) =>
        Vector2.ClampMagnitude(input, 1f) * speed;
}
```
Use this pattern so EditMode tests can assert logic without a scene.
