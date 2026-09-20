using UnityEngine;

namespace Game.Config
{
    /// <summary>
    /// Scene-level handle to a shared <see cref="GameConfig"/> asset. Assign the asset in the
    /// Inspector; consumers read through <see cref="Config"/> instead of searching Resources.
    /// </summary>
    public sealed class ConfigProvider : MonoBehaviour
    {
        [SerializeField] private GameConfig _config;

        public GameConfig Config => _config;

        public bool IsValid => _config != null;

        private void Awake()
        {
            if (!IsValid)
            {
                Debug.LogError($"{nameof(ConfigProvider)} has no GameConfig assigned.", this);
            }
        }
    }
}
