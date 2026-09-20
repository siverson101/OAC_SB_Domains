<!-- Context: unity-3d/knowledge/engine/physics | Priority: high | Version: 1.0 | Updated: 2026-09-20 | Unity: 6.0,6.3,6.5,LTS+ -->

# Physics (Unity 6.x)

Scope: the PhysX-backed 3D physics system. 2D physics uses a separate Box2D-backed module.

## Bodies and Colliders
- `Rigidbody` makes a GameObject physics-driven: `Mass`, `Drag`, `AngularDrag`, `UseGravity`, and
  `IsKinematic`.
- Colliders: `BoxCollider`, `SphereCollider`, `CapsuleCollider`, `MeshCollider`, and `TerrainCollider`.
  Compound colliders are child colliders under one Rigidbody.
- `CharacterController` is a non-Rigidbody controller for player movement; it resolves collisions but
  is not affected by forces.

## Movement
- Move dynamic bodies in `FixedUpdate` with `Rigidbody.MovePosition`/`MoveRotation` or `AddForce`.
- Never set `transform.position` on a non-kinematic Rigidbody: it teleports and breaks interpolation.
- Enable **interpolation** on the Rigidbody to smooth rendered motion at a low fixed rate.

## Queries and Callbacks
- Queries: `Physics.Raycast`, `Physics.SphereCast`, `Physics.OverlapSphere`, and the `NonAlloc`/`List`
  overloads. Reuse buffers; avoid per-frame allocations.
- Callbacks: `OnCollisionEnter/Stay/Exit` for solid contacts, `OnTriggerEnter/Stay/Exit` for triggers.
- Use **layers** and the collision matrix to limit contacts and query cost; use `LayerMask` in queries.

## Settings and Tuning
- Fixed timestep defaults to 0.02 s (`Time.fixedDeltaTime`). Lower it for fast action, raise it to
  reduce cost; keep it stable to avoid tunnelling.
- Continuous collision detection prevents fast movers from passing through geometry at extra cost.
- Set `Rigidbody.maxDepenetrationVelocity` and solver iterations only when diagnosing jitter or
  explosions.

## Determinism and Scale
- PhysX is not deterministic across platforms; do not rely on it for lockstep simulation.
- Keep 1 world unit = 1 metre; very small or very large objects lose precision.

> Verify against primary sources: solver defaults, deprecations and new APIs change between editor
> versions. Confirm against the Physics manual for the version in use.
