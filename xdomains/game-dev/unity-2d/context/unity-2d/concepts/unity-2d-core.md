<!-- Context: unity-2d/concepts/unity-2d-core | Priority: high | Version: 1.0 | Updated: 2026-09-17 -->

# Unity 2D Core Concepts

## Scene-GameObject-Component Model
- A **Scene** (.unity) is a hierarchy of **GameObjects** in 2D world space.
- Every GameObject carries **Components** (MonoBehaviours, Collider2D, SpriteRenderer, Rigidbody2D) that define behavior.
- Prefabs are reusable GameObject templates; **Prefab Variants** override fields of a base prefab.

## Key 2D Systems
- **Transform**: position/rotation/scale. 2D gameplay normally varies X/Y and the Z rotation only.
- **Physics 2D**: `Rigidbody2D` (dynamic/kinematic/static), `Collider2D` (Box/Circle/Capsule/Polygon/Edge), `Collision2D`/triggers. Step in `FixedUpdate`.
- **Rendering**: `SpriteRenderer` + Sprites + Materials. The **URP 2D Renderer** is the modern pipeline; Built-in uses the Sprites/Default shader.
- **Camera**: usually **orthographic**; pixel-perfect via the Pixel Perfect Camera (2D package).
- **Sorting**: `Sorting Layer` + `Order in Layer`, or Transparency Sort Mode for Y-sorting.
- **Animation**: Animator + Animation Controller, Sprite (flipbook) clips, Sprite Library/Resolver for swaps.
- **Tilemaps**: Tilemap + TilemapRenderer + TilemapCollider2D for level geometry.
- **Input**: New Input System (Input Actions) is recommended over the legacy Input Manager.

## Execution Order Essentials
- `Awake` → `OnEnable` → `Start` → `FixedUpdate` (physics 2D) → `Update` (frame) → `LateUpdate` (camera) → `OnDisable`/`OnDestroy`.
- Cache component references in `Awake`/`Start`; never `GetComponent` per frame.

## Common Pitfalls
- Moving a physics body via `transform` (use `Rigidbody2D.MovePosition` / `AddForce` / `linearVelocity`).
- Mixing 3D and 2D physics components (`Rigidbody` vs `Rigidbody2D`) on the same object.
- Blurry sprites from wrong Pixels Per Unit, filter mode, or compression.
- Scene/prefab edits as raw text rewrites → use targeted component-field edits.
- Forgetting to re-open the scene in Unity after external `.unity`/`.prefab` edits.
