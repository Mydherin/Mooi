import type { ProductionEnvironmentVariable } from './ProductionEnvironmentVariable';
import type { ProductionSnapshot } from './ProductionSnapshot';

export interface ProductionOverview {
  /** A draft or an active configuration exists, so a deployment can run. */
  configured: boolean;
  /** An active configuration exists: at least one deployment succeeded with it. */
  deployed: boolean;
  hasDraft: boolean;
  revision: number;
  environment: ProductionEnvironmentVariable[];
  snapshot: ProductionSnapshot;
  chatSessionId: string | null;
}
