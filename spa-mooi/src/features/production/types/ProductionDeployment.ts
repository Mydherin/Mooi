import type { ProductionDeploymentState } from './ProductionDeploymentState';

/** One persisted deployment attempt, as recorded by mic-mooi. */
export interface ProductionDeployment {
  operationId: string;
  projectId: string;
  sessionId: string | null;
  releaseTag: string;
  state: ProductionDeploymentState;
  startedAt: string;
  finishedAt: string | null;
}
