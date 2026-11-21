import type { FactoryPauseReason } from '@/features/factory/types/FactoryPauseReason';
import type { FactoryPlan } from '@/features/factory/types/FactoryPlan';
import type { FactoryRunConfig } from '@/features/factory/types/FactoryRunConfig';
import type { FactoryStatus } from '@/features/factory/types/FactoryStatus';
import type { FactoryStep } from '@/features/factory/types/FactoryStep';

/** A project's Software Factory: its operational state; the plan itself lives in the repository. */
export interface Factory {
  id: string;
  projectId: string;
  status: FactoryStatus;
  pauseReason: FactoryPauseReason | null;
  /** What the factory needs from the user, or why it paused. */
  attention: string | null;
  runConfig: FactoryRunConfig | null;
  chatSessionId: string | null;
  plan: FactoryPlan | null;
  planCommit: string | null;
  activeStep: FactoryStep | null;
  openChangeRequests: number;
  revision: number;
  createdAt: string;
  updatedAt: string;
}
