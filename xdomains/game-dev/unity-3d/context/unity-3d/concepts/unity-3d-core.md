<!-- Context: unity-3d/concepts/unity-3d-core | Priority: high | Version: 1.0 | Updated: 2026-09-07 -->

# Unity 3D Core Concepts

## Scene-GameObject-Component Model
- A **Scene** (.unity) is a hierarchy of **GameObjects** in world space.
- Every GameObject carries **Components** (MonoBehaviours, Colliders, Renderers, Rigidbodies) that define behavior.
- Prefabs are reusable GameObject templates; **Prefab Variants** override fields of a base prefab.

## Key 3D Systems
- **Transform**: position/rotation/scale (3D). Movement via `transform.position`, `Transform.Translate`, or physics.
- **Physics**: `Rigidbody` (dynamic), `Collider` (sphere/capsule/box/mesh), `CharacterController`. Fixed updates in `FixedUpdate`.
- **Rendering**: MeshRenderers + Materials + Shaders. **URP** (Universal Render Pipeline) is the default modern pipeline.
- **Lighting**: Light components, lightmaps (baked Global Illumination), reflection probes, post-processing volume.
- **Cameras**: one active camera; Cinemachine for cinematic framing.
- **Input**: New Input System (Input Actions) is recommended over legacy Input Manager.
- **Animation**: Animator + Animation Controller (state machine), AnimationClips, Avatar masks.

## Execution Order Essentials
- `Awake` → `OnEnable` → `Start` → `FixedUpdate` (physics) → `Update` (frame) → `LateUpdate` (cameras) → `OnDisable`/`OnDestroy`.
- Cache component references in `Awake`/`Start`; never `GetComponent` per frame.

## Common Pitfalls
- Modifying `transform` inside physics code (use `Rigidbody.MovePosition`/`AddForce`).
- Scene/prefab edits as raw text rewrites → use targeted component-field edits.
- Forgetting to re-open the scene in Unity after external `.unity`/`.prefab` edits.
