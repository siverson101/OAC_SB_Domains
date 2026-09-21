using NUnit.Framework;
using UnityEngine;

namespace Game.Tests
{
    public sealed class SampleEditModeTests
    {
        [TestCase(-10f, 0f, 10f, 0f)]
        [TestCase(5f, 0f, 10f, 5f)]
        [TestCase(42f, 0f, 10f, 10f)]
        public void Clamp_ReturnsValueWithinRange(float value, float min, float max, float expected)
        {
            float result = Mathf.Clamp(value, min, max);

            Assert.AreEqual(expected, result, 1e-4f);
        }
    }
}
