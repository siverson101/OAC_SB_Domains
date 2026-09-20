<!-- Context: unity-3d/examples/mono-behaviour-templates | Priority: medium | Version: 1.0 | Updated: 2026-09-07 -->

# MonoBehaviour Templates

## Player Controller (3D, physics)
```csharp
using UnityEngine;

public class PlayerController : MonoBehaviour
{
    [Header("Movement")]
    [SerializeField] private float _moveSpeed = 5f;
    [SerializeField] private float _rotationSpeed = 10f;
    [SerializeField] private float _jumpForce = 6f;

    [Header("References")]
    [SerializeField] private Camera _camera;

    private Rigidbody _rb;
    private bool _grounded;

    private void Awake()
    {
        _rb = GetComponent<Rigidbody>();
        Cursor.lockState = CursorLockMode.Locked;
    }

    private void FixedUpdate()
    {
        Vector3 input = new Vector3(Input.GetAxisRaw("Horizontal"), 0f, Input.GetAxisRaw("Vertical"));
        Vector3 move = (transform.right * input.x + transform.forward * input.z).normalized;
        _rb.MovePosition(_rb.position + move * _moveSpeed * Time.fixedDeltaTime);
    }
}
```

## Camera Follow (LateUpdate)
```csharp
public class CameraFollow : MonoBehaviour
{
    [SerializeField] private Transform _target;
    [SerializeField] private Vector3 _offset = new Vector3(0f, 2f, -5f);
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
public static class MovementMath
{
    public static Vector3 ClampedVelocity(Vector3 input, float speed) =>
        Vector3.ClampMagnitude(input, 1f) * speed;
}
```
Use this pattern so EditMode tests can assert logic without a scene.
