// Context: unity-3d/snippets/object-pool | Standards-Version: 1.0 | Priority: medium | Updated: 2026-09-20 | Unity: 6.0,6.3,6.5,LTS+
// Language: csharp
// Drop-in: copy the class into any runtime assembly. No package dependencies.
// Rule: prewarm during a loading screen; release instead of Destroy to avoid GC spikes.

using System.Collections.Generic;
using UnityEngine;

namespace Game.Snippets
{
    /// <summary>
    /// Minimal component pool. Pre-instantiates a fixed number of inactive instances and reuses
    /// them, avoiding per-spawn allocation and the GC spikes that follow.
    /// </summary>
    /// <typeparam name="T">Component type to pool. Its GameObject is activated on Get and hidden on Release.</typeparam>
    public sealed class ComponentPool<T> where T : Component
    {
        private readonly T _prefab;
        private readonly Transform _parent;
        private readonly Stack<T> _available = new Stack<T>();

        public ComponentPool(T prefab, Transform parent, int prewarm = 0)
        {
            _prefab = prefab;
            _parent = parent;

            for (int i = 0; i < prewarm; i++)
            {
                T instance = Object.Instantiate(_prefab, _parent);
                instance.gameObject.SetActive(false);
                _available.Push(instance);
            }
        }

        public T Get()
        {
            T instance = _available.Count > 0 ? _available.Pop() : Object.Instantiate(_prefab, _parent);
            instance.gameObject.SetActive(true);
            return instance;
        }

        public void Release(T instance)
        {
            if (instance == null)
            {
                return;
            }

            instance.gameObject.SetActive(false);
            _available.Push(instance);
        }
    }
}
