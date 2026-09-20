using Arch.Core;
using UnityEngine;
using System.Runtime.CompilerServices;

namespace Arch.UnityPrimitives
{
    public struct Position
    {
        public Vector2 Value;
    }

    public struct Velocity
    {
        public Vector2 Value;
    }

    public sealed class MovementSystem
    {
        private readonly World _world;
        private readonly QueryDescription _entitiesToMove = new QueryDescription().WithAll<Position, Velocity>();
        private readonly Rect _viewport;

        public MovementSystem(World world, Rect viewport)
        {
            _world = world;
            _viewport = viewport;
        }

        private readonly struct Move : IForEach<Position, Velocity>
        {
            private readonly float _deltaTime;

            public Move(float deltaTime)
            {
                _deltaTime = deltaTime;
            }

            [MethodImpl(MethodImplOptions.AggressiveInlining)]
            public void Update(ref Position pos, ref Velocity vel)
            {
                pos.Value += _deltaTime * vel.Value;
            }
        }

        private struct Bounce : IForEach<Position, Velocity>
        {
            private Rect _viewport;

            public Bounce(Rect viewport)
            {
                _viewport = viewport;
            }

            [MethodImpl(MethodImplOptions.AggressiveInlining)]
            public void Update(ref Position pos, ref Velocity vel)
            {
                if (pos.Value.x >= _viewport.xMax) vel.Value.x = -Mathf.Abs(vel.Value.x);
                if (pos.Value.y >= _viewport.yMax) vel.Value.y = -Mathf.Abs(vel.Value.y);
                if (pos.Value.x <= _viewport.xMin) vel.Value.x = Mathf.Abs(vel.Value.x);
                if (pos.Value.y <= _viewport.yMin) vel.Value.y = Mathf.Abs(vel.Value.y);
            }
        }

        public void Update(float deltaTime)
        {
            var movementJob = new Move(deltaTime);
            _world.InlineParallelQuery<Move, Position, Velocity>(in _entitiesToMove, ref movementJob);

            var bounceJob = new Bounce(_viewport);
            _world.InlineParallelQuery<Bounce, Position, Velocity>(in _entitiesToMove, ref bounceJob);
        }
    }
}
