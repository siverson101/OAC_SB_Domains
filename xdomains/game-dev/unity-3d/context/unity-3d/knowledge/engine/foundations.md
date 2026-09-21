<!-- Context: unity-3d/knowledge/engine/foundations | Priority: critical | Version: 1.0 | Updated: 2026-09-20 | Unity: 6.0,6.3,6.5,LTS+ -->

# Engine Foundations (Unity 6.x)

Scope: the runtime object model, scripting lifecycle, and project structure that every other
engine topic builds on. Version selection is handled by `../version-dispatch.md`.

## Object Model
- A **Scene** is a graph of **GameObjects**; each GameObject carries **Components**.
- `MonoBehaviour` is the script component; `ScriptableObject` is a serializable data container that
  is not attached to a GameObject.
- Prefabs are reusable templates. **Prefab Variants** inherit a base prefab and override fields;
  overrides are tracked so a base change propagates.
- Scene and prefab assets are YAML text. Prefer targeted component-field edits over whole-file
  rewrites; re-open the scene in the Editor after an external edit.

## Scripting Lifecycle
- Order: `Awake` -> `OnEnable` -> `Start` -> `FixedUpdate` (physics) -> `Update` -> `LateUpdate` ->
  `OnDisable` -> `OnDestroy`. See `../../lookup/lifecycle-order.md` for the machine-readable table.
- Cache component references in `Awake`/`Start`; never call `GetComponent` per frame.
- `FixedUpdate` runs on the fixed timestep; `Update` runs once per rendered frame; `LateUpdate` runs
  after all `Update` calls (camera follow).

## Async and Scheduling
- Unity 6 ships `Awaitable` for allocation-light async work that resumes on the player loop; prefer it
  over new coroutines for single-await flows.
- Coroutines remain valid for frame-spread sequences. `Awaitable`/`UniTask` compose better with
  cancellation and error propagation.
- Pool and reuse hot objects; allocate during load, not per frame.

## Project Structure
- `Assets/` holds authored content; `Packages/manifest.json` declares package dependencies;
  `ProjectSettings/` holds project configuration.
- **Assembly definitions** (`.asmdef`) partition compilation. Keep runtime and test assemblies
  separate; tests use `*.Tests.asmdef` with `testAssemblies: true`.
- `Library/` and `Temp/` are generated and must never be edited or committed.

## Architecture Defaults
- Prefer composition over inheritance; keep MonoBehaviours thin and move logic into plain C#.
- Use `ScriptableObject` for data and event channels; use dependency injection only when the project
  already adopts a container (see `../middleware/dependency-injection.md`).
- Enable nullable reference types and treat compiler warnings as actionable.

> Verify against primary sources: confirm lifecycle, package and API claims against the Unity manual
> and the project's exact editor version before relying on them.
