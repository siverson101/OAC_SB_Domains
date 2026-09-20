// Context: unity-3d/snippets/event-channel | Standards-Version: 1.0 | Priority: medium | Updated: 2026-09-20 | Unity: 6.0,6.3,6.5,LTS+
// Language: csharp
// Drop-in: create channel assets via the Create menu; assign the same asset to producer and consumer.
// Rule: always unsubscribe in OnDisable to avoid leaks from destroyed subscribers.

using System;
using UnityEngine;

namespace Game.Snippets
{
    /// <summary>
    /// ScriptableObject-based pub/sub channel. Producers and consumers reference the same asset
    /// instead of each other, so scenes and systems stay decoupled.
    /// </summary>
    [CreateAssetMenu(menuName = "Game/Events/Void Channel", fileName = "VoidEventChannel")]
    public sealed class VoidEventChannel : ScriptableObject
    {
        public event Action Raised;

        public void Raise()
        {
            Raised?.Invoke();
        }
    }

    /// <summary>Null-safe subscribe/unsubscribe helpers for <see cref="VoidEventChannel"/>.</summary>
    public static class VoidEventChannelExtensions
    {
        public static void Subscribe(this VoidEventChannel channel, Action handler)
        {
            if (channel != null && handler != null)
            {
                channel.Raised += handler;
            }
        }

        public static void Unsubscribe(this VoidEventChannel channel, Action handler)
        {
            if (channel != null && handler != null)
            {
                channel.Raised -= handler;
            }
        }
    }
}
