using UnityEngine;

namespace Game.Features
{
    /// <summary>
    /// Runtime entry point for a single feature. Owns its state and exposes explicit
    /// Enable/Disable methods so a composition root can drive it without reflection.
    /// Both transitions are idempotent.
    /// </summary>
    public sealed class FeatureBehaviour : MonoBehaviour
    {
        [SerializeField] private bool _activeOnStart = true;

        private bool _isActive;

        public bool IsActive => _isActive;

        private void Start()
        {
            if (_activeOnStart)
            {
                Enable();
            }
        }

        private void OnDisable()
        {
            Disable();
        }

        public void Enable()
        {
            if (_isActive)
            {
                return;
            }

            _isActive = true;
            OnFeatureEnabled();
        }

        public void Disable()
        {
            if (!_isActive)
            {
                return;
            }

            _isActive = false;
            OnFeatureDisabled();
        }

        private void OnFeatureEnabled()
        {
        }

        private void OnFeatureDisabled()
        {
        }
    }
}
