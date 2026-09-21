/*
Copyright 2015 Pim de Witte All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

using UnityEngine;
using System.Collections;
using System.Collections.Generic;
using System;

namespace UnityEncyclopedia.Primitives.System
{
    /// Author: Pim de Witte (pimdewitte.com) and contributors
    /// Modified by UnityEncyclopedia to fix Coroutine allocation overhead and lock-blocking during execution.
    /// <summary>
    /// A thread-safe class which holds a queue with actions to execute on the next Update() method.
    /// It can be used to make calls to the main thread for things such as UI Manipulation in Unity.
    /// </summary>
    public class UnityMainThreadDispatcher : MonoBehaviour
    {
        private static readonly Queue<Action> _executionQueue = new Queue<Action>();
        private static readonly List<Action> _executionQueueCopy = new List<Action>();

        public void Update()
        {
            lock (_executionQueue)
            {
                if (_executionQueue.Count == 0)
                {
                    return;
                }

                while (_executionQueue.Count > 0)
                {
                    _executionQueueCopy.Add(_executionQueue.Dequeue());
                }
            }

            // Execute outside of the lock to prevent blocking background threads
            // and to avoid issues if the actions themselves take a long time to run.
            for (int i = 0; i < _executionQueueCopy.Count; i++)
            {
                try
                {
                    _executionQueueCopy[i].Invoke();
                }
                catch (Exception e)
                {
                    Debug.LogError($"[UnityMainThreadDispatcher] Exception during execution: {e}");
                }
            }
            _executionQueueCopy.Clear();
        }

        /// <summary>
        /// Locks the queue and adds the IEnumerator to the queue
        /// </summary>
        /// <param name="action">IEnumerator function that will be executed from the main thread.</param>
        public void Enqueue(IEnumerator action)
        {
            lock (_executionQueue)
            {
                _executionQueue.Enqueue(() => { StartCoroutine(action); });
            }
        }

        /// <summary>
        /// Locks the queue and adds the Action to the queue
        /// </summary>
        /// <param name="action">function that will be executed from the main thread.</param>
        public void Enqueue(Action action)
        {
            lock (_executionQueue)
            {
                _executionQueue.Enqueue(action);
            }
        }


        private static UnityMainThreadDispatcher _instance = null;

        public static bool Exists()
        {
            return _instance != null;
        }

        public static UnityMainThreadDispatcher Instance()
        {
            if (!Exists())
            {
                throw new Exception("UnityMainThreadDispatcher could not find the UnityMainThreadDispatcher object. Please ensure you have added the MainThreadExecutor Prefab to your scene.");
            }

            return _instance;
        }


        void Awake()
        {
            if (_instance == null)
            {
                _instance = this;
                DontDestroyOnLoad(this.gameObject);
            }
        }

        void OnDestroy()
        {
            if (_instance == this)
            {
                _instance = null;
            }
        }
    }
}
