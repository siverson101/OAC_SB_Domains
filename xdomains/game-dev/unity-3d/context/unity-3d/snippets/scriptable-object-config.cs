// Context: unity-3d/snippets/scriptable-object-config | Standards-Version: 1.0 | Priority: high | Updated: 2026-09-20 | Unity: 6.0,6.3,6.5,LTS+
// Language: csharp
// Drop-in: add the CreateAssetMenu attribute to a ScriptableObject subclass. No package dependencies.
// Rule: configuration assets are read-only at runtime; validate them in OnValidate.

using UnityEngine;

namespace Game.Snippets
{
    /// <summary>
    /// Configuration asset shared by scenes and systems. Values are clamped in OnValidate so the
    /// Editor reports bad data before it reaches a build, and exposed through get-only properties
    /// so runtime code cannot mutate them.
    /// </summary>
    [CreateAssetMenu(menuName = "Game/Config/Game Config", fileName = "GameConfig")]
    public sealed class GameConfig : ScriptableObject
    {
        [SerializeField, Min(0f)] private float _gravityScale = 1f;
        [SerializeField, Range(0.01f, 2f)] private float _timeScale = 1f;
        [SerializeField, Min(1)] private int _targetFrameRate = 60;

        public float GravityScale => _gravityScale;
        public float TimeScale => _timeScale;
        public int TargetFrameRate => _targetFrameRate;

        private void OnValidate()
        {
            _targetFrameRate = Mathf.Max(1, _targetFrameRate);
        }
    }
}
