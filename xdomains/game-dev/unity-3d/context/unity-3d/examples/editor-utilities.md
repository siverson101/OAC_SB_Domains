<!-- Context: unity-3d/examples/editor-utilities | Priority: medium | Version: 1.0 | Updated: 2026-09-07 -->

# Editor Utilities

## Batch-Mode Build Method (Editor asmdef)
```csharp
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEngine;

public static class BuildScript
{
    private static readonly string[] Scenes =
    {
        "Assets/_Project/Scenes/Main.unity"
    };

    public static void Build()
    {
        string target = GetArg("-buildTarget") ?? "Win64";
        string output = GetArg("-outputPath") ?? "Builds/" + target;

        BuildReport report = BuildPipeline.BuildPlayer(
            Scenes, output, BuildTargetFromString(target), BuildOptions.None);

        if (report.summary.result != BuildResult.Succeeded)
            throw new System.Exception("Build failed: " + report.summary);
    }

    private static string GetArg(string name)
    {
        string[] args = System.Environment.GetCommandLineArgs();
        for (int i = 0; i < args.Length - 1; i++)
            if (args[i] == name) return args[i + 1];
        return null;
    }

    private static BuildTarget BuildTargetFromString(string s) =>
        (BuildTarget)System.Enum.Parse(typeof(BuildTarget), s);
}
```

## MenuItem Utility Pattern
```csharp
public static class SceneTools
{
    [MenuItem("Tools/Log Active Scene")]
    public static void LogActiveScene()
    {
        Debug.Log(UnityEngine.SceneManagement.SceneManager.GetActiveScene().path);
    }
}
```

## Usage
- Build: `Unity -batchmode -quit -projectPath <path> -executeMethod BuildScript.Build -buildTarget Win64 -outputPath Builds/Win64 -logFile -`
