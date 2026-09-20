<!-- Context: unity-3d/knowledge/middleware/dependency-injection | Priority: medium | Version: 1.0 | Updated: 2026-09-20 | Unity: 6.0,6.3,6.5,LTS+ -->

# Dependency Injection (VContainer / Zenject)

Scope: the two common DI containers for Unity. Detect which (if any) the project uses from
`Packages/manifest.json` before generating container code. If neither is installed, prefer plain
constructor injection and ScriptableObject wiring over adding a container.

## VContainer
- Package: `jp.hadashikick.vcontainer`. Performance-focused, low-allocation, integrates with the
  player loop.
- Compose in a `LifetimeScope` MonoBehaviour: override `Configure(IContainerBuilder builder)` and
  `builder.Register<TInterface, TImpl>(Lifetime.Singleton)`.
- Injection: constructor injection for plain classes, `[Inject]` methods/fields for MonoBehaviours,
  `IObjectResolver` for runtime resolution. Use `[Inject]` sparingly; prefer constructor injection.
- Scopes: `Application`, `Scene`, and prefab/child scopes. Register a type in exactly one scope.
- Entry points implement `IStartable`, `ITickable`, `IInitializable`, or `IDisposable`.

## Zenject / Extenject
- Package: `com.svermeulen.extenject` (community continuation of Zenject).
- Compose with installers: `MonoInstaller`/`ScriptableObjectInstaller` bound to a `SceneContext` or
  `ProjectContext`.
- Binding: `Container.Bind<TInterface>().To<TImpl>().AsSingle()`; use `AsTransient` for per-resolve.
- Injection: `[Inject]` on constructors, fields, methods, and properties.
- `[Inject]` on MonoBehaviours runs after `Awake` but before `Start`; do not assume DI state in `Awake`.

## Shared Rules
- Bind interfaces, not concrete types, at the seam you want to substitute in tests.
- Avoid service locator patterns and global static access to the container; inject explicitly.
- Do not resolve the same dependency in `Update`; resolve once and cache.
- Keep the container at the composition root (a scene/application scope), not scattered across
  gameplay classes.

## Testing
- Both containers support building a container in a test fixture and resolving the system under test
  with test doubles bound in place of real services.
- Prefer testing systems through their constructor dependencies rather than resolving the whole graph.

> Verify against primary sources: VContainer and Extenject APIs and Unity compatibility differ per
> release. Confirm against the installed package docs.
