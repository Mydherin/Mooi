import type { FactoryRole } from '@/features/factory/types/FactoryRole';

/** What a session does for its project's Software Factory (`Session.factory`). */
export interface FactoryBinding {
  factoryId: string;
  role: FactoryRole;
  stepId: string | null;
  phaseId: string | null;
  milestoneId: string | null;
}
