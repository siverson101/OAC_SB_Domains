// Context: unity-3d/snippets/cached-component-lookup | Standards-Version: 1.0 | Priority: high | Updated: 2026-09-20 | Unity: 6.0,6.3,6.5,LTS+
// Language: csharp
// Drop-in: paste into a MonoBehaviour. No package dependencies.
// Rule: resolve references once in Awake; never call GetComponent in Update.

using UnityEngine;

namespace Game.Snippets
{
    /// <summary>
    /// Caches component references once during Awake instead of resolving them every frame.
    /// Fails loudly and disables itself when a required reference is missing, rather than
    /// throwing a NullReferenceException later.
    /// </summary>
    public sealed class CachedComponentLookup : MonoBehaviour
    {
        [SerializeField] private Rigidbody _body;
        [SerializeField] private Renderer _renderer;

        private Transform _transform;

        private void Awake()
        {
            _transform = transform;

            if (_body == null && !TryGetComponent(out _body))
            {
                Debug.LogError($"{nameof(CachedComponentLookup)} requires a Rigidbody.", this);
                enabled = false;
                return;
            }

            if (_renderer == null)
            {
                TryGetComponent(out _renderer);
            }
        }

        private void FixedUpdate()
        {
            if (_body == null)
            {
                return;
            }

            _body.MovePosition(_body.position + _transform.forward * Time.fixedDeltaTime);
        }
    }
}
