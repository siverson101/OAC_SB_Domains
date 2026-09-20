# Unity - Common Context

This shared context file contains conventions, patterns and guidance that apply across Unity subdomains
(2D, 3D, XR). Keep content focused, with examples and file path guidance.

## Project Layout (Unity)
- Assets/_Project/
  - Scripts/         # C# scripts (MonoBehaviour, Editor scripts)
  - Scenes/          # Scene files (.unity)
  - Prefabs/         # Prefabs and nested Prefabs
  - Art/             # Textures, sprites, models
  - Plugins/         # 3rd-party packages
- Packages/
- ProjectSettings/
- Logs/

## Recommended Agent Abilities
- read_unity_project: Inspect project folder structure and metadata (Packages/ProjectSettings)
- unity_cli_build: Invoke Unity CLI to run builds or batch-mode tasks
- edit_csharp_file: Make safe, targeted edits to C# files and preserve formatting
- run_unity_tests: Run Unity Test Runner (edit-mode, play-mode)

## Typical Unity Tasks
- Create or modify a Scene (.unity)
- Add/modify a MonoBehaviour script (C#)
- Create or update a Prefab and references
- Configure build settings for target platform (PC, Android, iOS, XR)
- Integrate and pin package versions in Packages/manifest.json
- Suggest editor scripts for repetitive tasks

## File Editing Guidelines
- When modifying C#:
  - Use small, focused diffs
  - Preserve coding conventions (use PascalCase for types)
  - Avoid changing unrelated whitespace or ordering
- When modifying scenes/prefabs:
  - Prefer targeted changes (component fields) rather than wholesale scene rewrites
  - Include validation steps to re-open the scene in Unity

## Validation & Local Testing
- After code changes:
  - Run `dotnet` / `csc` checks if available or Unity's compiler via CLI
  - Run unit/editor tests with Unity Test Runner when possible
- For performance-sensitive changes:
  - Provide a list of benchmarks or metrics to validate (FPS, memory budgets)

## Example requests to give to Unity agents
- "Open the Unity project at ./ and add a MonoBehaviour `PlayerController.cs` under Assets/Scripts. Use Rigidbody2D for physics and expose a speed field. Provide unit tests for input handling."
- "Set Android build keystore values and create a development build. Report build output path and errors."
