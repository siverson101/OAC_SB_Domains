using UnityEngine;

namespace Game.Config
{
    /// <summary>
    /// Designer-tunable configuration shared across scenes. Values are clamped in OnValidate and
    /// exposed through get-only properties so runtime code cannot mutate the asset.
    /// </summary>
    [CreateAssetMenu(menuName = "Game/Config/Game Config", fileName = "GameConfig")]
    public sealed class GameConfig : ScriptableObject
    {
        [SerializeField, Min(0f)] private float _moveSpeed = 5f;
        [SerializeField, Min(1)] private int _maxEntities = 256;

        public float MoveSpeed => _moveSpeed;
        public int MaxEntities => _maxEntities;

        private void OnValidate()
        {
            _moveSpeed = Mathf.Max(0f, _moveSpeed);
            _maxEntities = Mathf.Max(1, _maxEntities);
        }
    }
}
