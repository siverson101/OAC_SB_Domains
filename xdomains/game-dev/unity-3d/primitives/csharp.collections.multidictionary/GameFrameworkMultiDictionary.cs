// Derived from https://github.com/Alex-Rachel/TEngine (MIT).
using System;
using System.Collections;
using System.Collections.Generic;
using System.Runtime.InteropServices;

namespace TEngine
{
    public sealed class GameFrameworkMultiDictionary<TKey, TValue> : IEnumerable<KeyValuePair<TKey, GameFrameworkLinkedListRange<TValue>>>, IEnumerable
    {
        private readonly GameFrameworkLinkedList<TValue> _linkedList;
        private readonly Dictionary<TKey, GameFrameworkLinkedListRange<TValue>> _dictionary;

        public GameFrameworkMultiDictionary()
        {
            _linkedList = new GameFrameworkLinkedList<TValue>();
            _dictionary = new Dictionary<TKey, GameFrameworkLinkedListRange<TValue>>();
        }

        public int Count => _dictionary.Count;

        public GameFrameworkLinkedListRange<TValue> this[TKey key]
        {
            get
            {
                GameFrameworkLinkedListRange<TValue> range = default(GameFrameworkLinkedListRange<TValue>);
                _dictionary.TryGetValue(key, out range);
                return range;
            }
        }

        public void Clear()
        {
            _dictionary.Clear();
            _linkedList.Clear();
        }

        public bool Contains(TKey key) { return _dictionary.ContainsKey(key); }

        public bool Contains(TKey key, TValue value)
        {
            GameFrameworkLinkedListRange<TValue> range = default(GameFrameworkLinkedListRange<TValue>);
            if (_dictionary.TryGetValue(key, out range)) return range.Contains(value);
            return false;
        }

        public bool TryGetValue(TKey key, out GameFrameworkLinkedListRange<TValue> range) { return _dictionary.TryGetValue(key, out range); }

        public void Add(TKey key, TValue value)
        {
            GameFrameworkLinkedListRange<TValue> range = default(GameFrameworkLinkedListRange<TValue>);
            if (_dictionary.TryGetValue(key, out range))
            {
                _linkedList.AddBefore(range.Terminal, value);
            }
            else
            {
                LinkedListNode<TValue> first = _linkedList.AddLast(value);
                LinkedListNode<TValue> terminal = _linkedList.AddLast(default(TValue));
                _dictionary.Add(key, new GameFrameworkLinkedListRange<TValue>(first, terminal));
            }
        }

        public bool Remove(TKey key, TValue value)
        {
            GameFrameworkLinkedListRange<TValue> range = default(GameFrameworkLinkedListRange<TValue>);
            if (_dictionary.TryGetValue(key, out range))
            {
                for (LinkedListNode<TValue> current = range.First; current != null && current != range.Terminal; current = current.Next)
                {
                    if (current.Value.Equals(value))
                    {
                        if (current == range.First)
                        {
                            LinkedListNode<TValue> next = current.Next;
                            if (next == range.Terminal)
                            {
                                _linkedList.Remove(next);
                                _dictionary.Remove(key);
                            }
                            else
                            {
                                _dictionary[key] = new GameFrameworkLinkedListRange<TValue>(next, range.Terminal);
                            }
                        }
                        _linkedList.Remove(current);
                        return true;
                    }
                }
            }
            return false;
        }

        public bool RemoveAll(TKey key)
        {
            GameFrameworkLinkedListRange<TValue> range = default(GameFrameworkLinkedListRange<TValue>);
            if (_dictionary.TryGetValue(key, out range))
            {
                _dictionary.Remove(key);
                LinkedListNode<TValue> current = range.First;
                while (current != null)
                {
                    LinkedListNode<TValue> next = current != range.Terminal ? current.Next : null;
                    _linkedList.Remove(current);
                    current = next;
                }
                return true;
            }
            return false;
        }

        public Enumerator GetEnumerator() { return new Enumerator(_dictionary); }
        IEnumerator<KeyValuePair<TKey, GameFrameworkLinkedListRange<TValue>>> IEnumerable<KeyValuePair<TKey, GameFrameworkLinkedListRange<TValue>>>.GetEnumerator() { return GetEnumerator(); }
        IEnumerator IEnumerable.GetEnumerator() { return GetEnumerator(); }

        [StructLayout(LayoutKind.Auto)]
        public struct Enumerator : IEnumerator<KeyValuePair<TKey, GameFrameworkLinkedListRange<TValue>>>, IEnumerator
        {
            private Dictionary<TKey, GameFrameworkLinkedListRange<TValue>>.Enumerator _enumerator;
            internal Enumerator(Dictionary<TKey, GameFrameworkLinkedListRange<TValue>> dictionary)
            {
                if (dictionary == null) throw new Exception("Dictionary is invalid.");
                _enumerator = dictionary.GetEnumerator();
            }
            public KeyValuePair<TKey, GameFrameworkLinkedListRange<TValue>> Current => _enumerator.Current;
            object IEnumerator.Current => _enumerator.Current;
            public void Dispose() { _enumerator.Dispose(); }
            public bool MoveNext() { return _enumerator.MoveNext(); }
            void IEnumerator.Reset() { ((IEnumerator<KeyValuePair<TKey, GameFrameworkLinkedListRange<TValue>>>)_enumerator).Reset(); }
        }
    }
}
