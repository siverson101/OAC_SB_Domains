using NUnit.Framework;
using UnityEngine;

namespace Game.Features.Tests
{
    public sealed class FeatureBehaviourTests
    {
        private GameObject _go;
        private FeatureBehaviour _feature;

        [SetUp]
        public void SetUp()
        {
            _go = new GameObject("Feature");
            _feature = _go.AddComponent<FeatureBehaviour>();
        }

        [TearDown]
        public void TearDown()
        {
            Object.DestroyImmediate(_go);
        }

        [Test]
        public void Enable_SetsIsActive()
        {
            _feature.Enable();

            Assert.IsTrue(_feature.IsActive);
        }

        [Test]
        public void Enable_IsIdempotent()
        {
            _feature.Enable();
            _feature.Enable();

            Assert.IsTrue(_feature.IsActive);
        }

        [Test]
        public void Disable_ClearsIsActive()
        {
            _feature.Enable();

            _feature.Disable();

            Assert.IsFalse(_feature.IsActive);
        }
    }
}
