using System;
using System.Collections;
using System.Collections.Generic;
using System.Runtime.InteropServices;

namespace TEngine
{
    public sealed class GameFrameworkLinkedList<T> : ICollection<T>, IEnumerable<T>, ICollection, IEnumerable
    {
        private readonly LinkedList<T> _linkedList;
        private readonly Queue<LinkedListNode<T>> _cachedNodes;

        public GameFrameworkLinkedList()
        {
            _linkedList = new LinkedList<T>();
            _cachedNodes = new Queue<LinkedListNode<T>>();
        }

        public int Count => _linkedList.Count;
        public int CachedNodeCount => _cachedNodes.Count;
        public LinkedListNode<T> First => _linkedList.First;
        public LinkedListNode<T> Last => _linkedList.Last;
        public bool IsReadOnly => ((ICollection<T>)_linkedList).IsReadOnly;
        public object SyncRoot => ((ICollection)_linkedList).SyncRoot;
        public bool IsSynchronized => ((ICollection)_linkedList).IsSynchronized;

        public LinkedListNode<T> AddAfter(LinkedListNode<T> node, T value)
        {
            LinkedListNode<T> newNode = AcquireNode(value);
            _linkedList.AddAfter(node, newNode);
            return newNode;
        }

        public void AddAfter(LinkedListNode<T> node, LinkedListNode<T> newNode) { _linkedList.AddAfter(node, newNode); }

        public LinkedListNode<T> AddBefore(LinkedListNode<T> node, T value)
        {
            LinkedListNode<T> newNode = AcquireNode(value);
            _linkedList.AddBefore(node, newNode);
            return newNode;
        }

        public void AddBefore(LinkedListNode<T> node, LinkedListNode<T> newNode) { _linkedList.AddBefore(node, newNode); }

        public LinkedListNode<T> AddFirst(T value)
        {
            LinkedListNode<T> node = AcquireNode(value);
            _linkedList.AddFirst(node);
            return node;
        }

        public void AddFirst(LinkedListNode<T> node) { _linkedList.AddFirst(node); }

        public LinkedListNode<T> AddLast(T value)
        {
            LinkedListNode<T> node = AcquireNode(value);
            _linkedList.AddLast(node);
            return node;
        }

        public void AddLast(LinkedListNode<T> node) { _linkedList.AddLast(node); }

        public void Clear()
        {
            LinkedListNode<T> current = _linkedList.First;
            while (current != null)
            {
                ReleaseNode(current);
                current = current.Next;
            }
            _linkedList.Clear();
        }

        public void ClearCachedNodes() { _cachedNodes.Clear(); }
        public bool Contains(T value) { return _linkedList.Contains(value); }
        public void CopyTo(T[] array, int index) { _linkedList.CopyTo(array, index); }
        public void CopyTo(Array array, int index) { ((ICollection)_linkedList).CopyTo(array, index); }
        public LinkedListNode<T> Find(T value) { return _linkedList.Find(value); }
        public LinkedListNode<T> FindLast(T value) { return _linkedList.FindLast(value); }

        public bool Remove(T value)
        {
            LinkedListNode<T> node = _linkedList.Find(value);
            if (node != null)
            {
                _linkedList.Remove(node);
                ReleaseNode(node);
                return true;
            }
            return false;
        }

        public void Remove(LinkedListNode<T> node)
        {
            _linkedList.Remove(node);
            ReleaseNode(node);
        }

        public void RemoveFirst()
        {
            LinkedListNode<T> first = _linkedList.First;
            if (first == null) throw new Exception("First is invalid.");
            _linkedList.RemoveFirst();
            ReleaseNode(first);
        }

        public void RemoveLast()
        {
            LinkedListNode<T> last = _linkedList.Last;
            if (last == null) throw new Exception("Last is invalid.");
            _linkedList.RemoveLast();
            ReleaseNode(last);
        }

        public Enumerator GetEnumerator() { return new Enumerator(_linkedList); }

        private LinkedListNode<T> AcquireNode(T value)
        {
            LinkedListNode<T> node = null;
            if (_cachedNodes.Count > 0)
            {
                node = _cachedNodes.Dequeue();
                node.Value = value;
            }
            else
            {
                node = new LinkedListNode<T>(value);
            }
            return node;
        }

        private void ReleaseNode(LinkedListNode<T> node)
        {
            node.Value = default(T);
            _cachedNodes.Enqueue(node);
        }

        void ICollection<T>.Add(T value) { AddLast(value); }
        IEnumerator<T> IEnumerable<T>.GetEnumerator() { return GetEnumerator(); }
        IEnumerator IEnumerable.GetEnumerator() { return GetEnumerator(); }

        [StructLayout(LayoutKind.Auto)]
        public struct Enumerator : IEnumerator<T>, IEnumerator
        {
            private LinkedList<T>.Enumerator _enumerator;
            internal Enumerator(LinkedList<T> linkedList)
            {
                if (linkedList == null) throw new Exception("Linked list is invalid.");
                _enumerator = linkedList.GetEnumerator();
            }
            public T Current => _enumerator.Current;
            object IEnumerator.Current => _enumerator.Current;
            public void Dispose() { _enumerator.Dispose(); }
            public bool MoveNext() { return _enumerator.MoveNext(); }
            void IEnumerator.Reset() { ((IEnumerator<T>)_enumerator).Reset(); }
        }
    }
}
