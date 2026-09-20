// Dispatcher for the six Act abilities (Phase 2 Step 2.4).
import { detectUnityCli } from './gate';
import { patternLibrary } from './patterns';
import { prefabAutomation } from './prefab';
import { sceneEditing } from './scene';
import { inputAutomation, scriptScaffolding, shaderHelper } from './templates';
import type { ActOptions } from './types';

export type ActResult =
  | ReturnType<typeof prefabAutomation>
  | ReturnType<typeof sceneEditing>
  | ReturnType<typeof patternLibrary>
  | ReturnType<typeof scriptScaffolding>
  | ReturnType<typeof shaderHelper>
  | ReturnType<typeof inputAutomation>;

export function runAct(options: ActOptions): ActResult {
  const cliAvailable = options.gate ? detectUnityCli() : null;

  switch (options.ability) {
    case 'scene-editing':
      return sceneEditing(options, cliAvailable);
    case 'prefab-automation':
      return prefabAutomation(options, cliAvailable);
    case 'script-scaffolding':
      return scriptScaffolding(options);
    case 'shader-helper':
      return shaderHelper(options);
    case 'pattern-library':
      return patternLibrary(options);
    case 'input-automation':
      return inputAutomation(options);
    default: {
      const exhaustive: never = options.ability;
      throw new Error(`unsupported Act ability: ${String(exhaustive)}`);
    }
  }
}
