import type { ProductionRunState } from './ProductionRunState';

/** The live deployment of a project; its output arrives separately through the stream. */
export interface ProductionSnapshot {
  state: ProductionRunState;
  operationId: string | null;
  message: string | null;
  releaseTag: string | null;
  releaseUrl: string | null;
  releaseCommit: string | null;
  startedAt: string | null;
  updatedAt: string;
}
