// Dispatcher for the four Compose abilities (Phase 2 Step 2.7).
import { runCiStatusBaseline, type CiStatusBaselineResult } from './ci-status-baseline';
import { runContractAwareDesign, type ContractAwareResult } from './contract-aware-design';
import { runCoordinationBoard, type CoordinationBoardResult } from './coordination-board';
import { runPrimitiveComposition, type PrimitiveCompositionResult } from './primitive-composition';
import type { ComposeOptions } from './types';

export type ComposeResult =
  | CoordinationBoardResult
  | PrimitiveCompositionResult
  | ContractAwareResult
  | CiStatusBaselineResult;

export async function runCompose(options: ComposeOptions): Promise<ComposeResult> {
  switch (options.ability) {
    case 'coordination-board':
      return runCoordinationBoard(options);
    case 'primitive-composition':
      return runPrimitiveComposition(options);
    case 'contract-aware-design':
      return runContractAwareDesign(options);
    case 'ci-status-baseline':
      return runCiStatusBaseline(options);
    default:
      return runCoordinationBoard({ ...options, ability: 'coordination-board' });
  }
}
