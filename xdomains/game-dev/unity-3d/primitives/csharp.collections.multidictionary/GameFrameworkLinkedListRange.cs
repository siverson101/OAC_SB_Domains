// Derived from https://github.com/Alex-Rachel/TEngine (MIT).
using System;
using System.Collections;
using System.Collections.Generic;
using System.Runtime.InteropServices;

namespace TEngine
{
    [StructLayout(LayoutKind.Auto)]
    public readonly struct GameFrameworkLinkedListRange<T> : IEnumerable<T>, IEnumerable
    {
        private readonly LinkedListNode<T> _first;
        private readonly LinkedListNode<T> _terminal;

        public GameFrameworkLinkedListRange(LinkedListNode<T> first, LinkedListNode<T> terminal)
        {
            if (first == null || terminal == null || first == terminal) throw new Exception("Range is invalid.");
            _first = first;
            _terminal = terminal;
        }

        public bool IsValid => _first != null && _terminal != null && _first != _terminal;
        public LinkedListNode<T> First => _first;
        public LinkedListNode<T> Terminal => _terminal;

        public int Count
        {
            get
            {
                if (!IsValid) return 0;
                int count = 0;
                for (LinkedListNode<T> current = _first; current != null && current != _terminal; current = current.Next)
                {
                    count++;
                }
                return count;
            }
        }

        public bool Contains(T value)
        {
            for (LinkedListNode<T> current = _first; current != null && current != _terminal; current = current.Next)
            {
                if (current.Value.Equals(value)) return true;
            }
            return false;
        }

        public Enumerator GetEnumerator() { return new Enumerator(this); }
        IEnumerator<T> IEnumerable<T>.GetEnumerator() { return GetEnumerator(); }
        IEnumerator IEnumerable.GetEnumerator() { return GetEnumerator(); }

        [StructLayout(LayoutKind.Auto)]
        public struct Enumerator : IEnumerator<T>, IEnumerator
        {
            private readonly GameFrameworkLinkedListRange<T> _gameFrameworkLinkedListRange;
            private LinkedListNode<T> _current;
            private T _currentValue;

            internal Enumerator(GameFrameworkLinkedListRange<T> range)
            {
                if (!range.IsValid) throw new Exception("Range is invalid.");
                _gameFrameworkLinkedListRange = range;
                _current = _gameFrameworkLinkedListRange._first;
                _currentValue = default(T);
            }

            public T Current => _currentValue;
            object IEnumerator.Current => _currentValue;
            public void Dispose() { }

            public bool MoveNext()
            {
                if (_current == null || _current == _gameFrameworkLinkedListRange._terminal) return false;
                _currentValue = _current.Value;
                _current = _current.Next;
                return true;
            }

            void IEnumerator.Reset()
            {
                _current = _gameFrameworkLinkedListRange._first;
                _currentValue = default(T);
            }
        }
    }
}
