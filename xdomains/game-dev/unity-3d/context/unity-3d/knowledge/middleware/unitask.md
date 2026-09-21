<!-- Context: unity-3d/knowledge/middleware/unitask | Priority: high | Version: 1.0 | Updated: 2026-09-20 | Unity: 6.0,6.3,6.5,LTS+ -->

# UniTask (Cysharp)

Package: `com.cysharp.unitask`. An allocation-light async/await integration for Unity that resumes on
the player loop instead of the .NET thread pool.

## When to Use
- Use UniTask when the project already ships it and needs allocation-free async with Unity timing.
- For brand-new single-await code on Unity 6, `Awaitable` is built in and needs no dependency. Do not
  introduce UniTask solely for one await; see `../engine/foundations.md`.

## Core API
- `UniTask` is the awaitable unit; `UniTask<T>` carries a result.
- `await UniTask.Delay(ms)`, `await UniTask.Yield()`, `await UniTask.NextFrame()` for timing.
- `UniTask.WhenAll`, `WhenAny`, `WhenEach` compose multiple tasks.
- `async UniTaskVoid` is a fire-and-forget entry point; always call `.Forget()` on ignored tasks so
  exceptions surface instead of disappearing.
- Cancellation flows through `CancellationToken`; use `GetCancellationTokenOnDestroy()` or link a
  token to the component lifetime.
- `IUniTaskAsyncEnumerable<T>` provides async LINQ-style streams.

## Rules
- Do not block on `.Result` or `.Wait()`; it deadlocks the player loop.
- Do not `await` on the main thread from background code without `UniTask.SwitchToMainThread()`.
- Release `AsyncOperationHandle`s and pooled resources before the token cancels.
- `UniTaskTracker` (Editor window) shows in-flight tasks; use it to find leaks.

## Interaction with Addressables
- Addressables returns `AsyncOperationHandle`, not a task. Await it with
  `await handle.Task` (or the UniTask `ToUniTask` adapter) and still release the handle.

## Testing
- Tests can `await` UniTask directly; use `UniTask.Delay` with a short frame budget and a timeout token
  so a hung task fails rather than stalls the run.

> Verify against primary sources: UniTask API surface tracks its own releases and the Unity version.
> Confirm against the installed UniTask package README/CHANGELOG.
