import type { ProductionDeploymentState } from './ProductionDeploymentState';
import type { ProductionTarget } from './ProductionTarget';

/** One persisted deployment attempt, as recorded by mic-mooi. */
export interface ProductionDeployment {
  operationId: string;
  projectId: string;
  sessionId: string | null;
  releaseTag: string;
  targets: ProductionTarget[];
  state: ProductionDeploymentState;
  startedAt: string;
  finishedAt: string | null;
}
