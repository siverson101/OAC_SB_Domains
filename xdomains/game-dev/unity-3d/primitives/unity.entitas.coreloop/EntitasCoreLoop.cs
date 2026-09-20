using UnityEngine;
using Entitas;

/// <summary>
/// A strict ECS core loop for the Entitas framework.
/// This MonoBehaviour manages the lifecycle of an Entitas Systems group,
/// ensuring that Initialize, Execute, Cleanup, and TearDown are called
/// at the correct times in the Unity game loop.
/// </summary>
public class EntitasCoreLoop : MonoBehaviour
{
    private Systems _systems;

    private void Start()
    {
        // Typically, Contexts are passed to the systems to allow them to query entities.
        // If you're using Entitas code generation, you might use Contexts.sharedInstance.
        
        _systems = CreateSystems();
        
        // Call Initialize() on all IInitializeSystem instances
        _systems.Initialize();
    }

    private void Update()
    {
        // Execute runs the core logic for all IExecuteSystem instances
        _systems.Execute();
        
        // Cleanup runs all ICleanupSystem instances after execution (e.g., to destroy marked entities)
        _systems.Cleanup();
    }

    private void OnDestroy()
    {
        if (_systems != null)
        {
            // TearDown cleans up all ITearDownSystem instances when the game or object is destroyed
            _systems.TearDown();
            
            // Optionally clear reactive systems depending on use case
            _systems.ClearReactiveSystems();
        }
    }

    /// <summary>
    /// Override or modify this method to return the root Systems instance for your game.
    /// </summary>
    /// <returns>The root Systems object containing all feature systems.</returns>
    protected virtual Systems CreateSystems()
    {
        // Example: return new GameFeaturesSystems(Contexts.sharedInstance);
        return new Systems(); 
    }
}
