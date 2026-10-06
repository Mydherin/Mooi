import type { PlatformEnvironmentVariable } from '@/features/platform/types/PlatformEnvironmentVariable';
import type { ProductionSnapshot } from './ProductionSnapshot';

export interface ProductionOverview {
  /** A draft or an active configuration exists, so a deployment can run. */
  configured: boolean;
  /** Compatibility hint for deployments that generate Compose inside Platform files. */
  needsComposeMigration: boolean;
  /** An active configuration exists: at least one deployment succeeded with it. */
  deployed: boolean;
  hasDraft: boolean;
  revision: number;
  environment: PlatformEnvironmentVariable[];
  snapshot: ProductionSnapshot;
  chatSessionId: string | null;
  /** The live chat's configuration succeeded in a real deployment since its last draft, so it can be closed. */
  chatTested: boolean;
}
