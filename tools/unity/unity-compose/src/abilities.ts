// Dispatcher for the six Compose abilities (Phase 2 Step 2.7, Phase 5 Step 5.3).
import { runCiStatusBaseline, type CiStatusBaselineResult } from './ci-status-baseline';
import { runContractAwareDesign, type ContractAwareResult } from './contract-aware-design';
import { runCoordinationBoard, type CoordinationBoardResult } from './coordination-board';
import { runPlanFeature, type PlanFeatureResult } from './plan-feature';
import { runPrimitiveComposition, type PrimitiveCompositionResult } from './primitive-composition';
import { runTestPlan, type TestPlanResult } from './test-plan';
import { runWorkflowCatalog, type WorkflowCatalogResult } from './workflow-catalog';
import type { ComposeOptions } from './types';

export type ComposeResult =
  | CoordinationBoardResult
  | PrimitiveCompositionResult
  | ContractAwareResult
  | CiStatusBaselineResult
  | PlanFeatureResult
  | TestPlanResult
  | WorkflowCatalogResult;

// async because the coordination board queues on --wait-seconds.
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
    case 'plan-feature':
      return runPlanFeature(options);
    case 'test-plan':
      return runTestPlan(options);
    case 'workflow-catalog':
      return runWorkflowCatalog(options);
    default: {
      const exhaustive: never = options.ability;
      throw new Error(`unsupported Compose ability: ${String(exhaustive)}`);
    }
  }
}
