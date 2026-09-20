<!-- Context: unity-3d/knowledge/middleware/addressables | Priority: high | Version: 1.0 | Updated: 2026-09-20 | Unity: 6.0,6.3,6.5,LTS+ -->

# Addressables

Package: `com.unity.addressables`. A content-management layer that loads assets by address/label and
manages reference-counted lifetimes across local and remote bundles.

## Model
- Assets are marked **Addressable** and grouped into **Groups**; groups build into bundles and a
  content catalog.
- Load by **address** (string), **label** (set), or direct `AssetReference`.
- Every load returns an `AsyncOperationHandle`; the handle owns a reference count.

## Core API
- `Addressables.LoadAssetAsync<T>(key)` / `LoadAssetsAsync<T>(keys)`.
- `Addressables.InstantiateAsync(key, parent)` for prefab instances; pair with
  `Addressables.ReleaseInstance(go)`.
- `Addressables.Release(handle)` decrements the count; release exactly once per handle.
- `handle.Status`, `handle.PercentComplete`, and `handle.Completed` track progress; await
  `handle.Task`.
- `Addressables.LoadSceneAsync` / `UnloadSceneAsync` for addressable scenes.
- `AsyncOperationHandle` structs must be stored and released; do not let them go out of scope while
  the asset is in use.

## Groups and Content
- Local vs remote groups: remote groups need a hosting URL and content update (catalog) flow.
- Use **labels** for set-based loading (for example, a `Preload` label).
- **Content update builds** only work when the catalog is not changed in incompatible ways; keep a
  stable group layout.
- Prefer `AssetReference` fields over raw address strings so the Editor validates references.

## Failure Handling
- Loads can fail offline or on a missing remote catalog; check `handle.Status` and surface the error.
- A failed load still needs its handle released.

## Testing
- Use `Addressables` in PlayMode tests with a local catalog; avoid remote groups in CI.

> Verify against primary sources: Addressables APIs and catalog behaviour change between package
> versions (1.x vs 2.x). Confirm against the installed Addressables docs.
