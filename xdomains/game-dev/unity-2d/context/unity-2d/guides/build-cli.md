<!-- Context: unity-2d/guides/build-cli | Priority: high | Version: 1.0 | Updated: 2026-09-07 -->

# Unity CLI Build & Validation

Use the Unity editor in **batch mode** for headless builds/tests. Path: `<UnityEditor>/Unity.exe` (Windows) or `Unity` (macOS/Linux).

## Batch-Mode Build
```bash
Unity -batchmode -quit -projectPath <path> \
  -executeMethod <Namespace.BuildClass.BuildMethod> \
  -buildTarget <Win64|Android|iOS|StandaloneOSX> \
  -logFile -
```
Requires an Editor script (see `examples/editor-utilities.md`) exposing a static build method that sets scenes and output path.

## Batch-Mode Tests
```bash
Unity -batchmode -quit -projectPath <path> \
  -runTests -testPlatform EditMode \
  -testResults results.xml -logFile -
```
`PlayMode` tests may require a running editor/device context.

## Import-Only Run (re-import + quit)
```bash
Unity -batchmode -quit -projectPath <path> -logFile -
```

## Exit Codes
- `0` = success. Non-zero = failure — always surface the log tail and failing test XML.

## Conventions
- Always report output path and the first errors.
- After external scene/prefab writes, run an import-only pass so Unity regenerates `.meta`/caches.
- See `lookup/validation-rules.md` for pass criteria.
