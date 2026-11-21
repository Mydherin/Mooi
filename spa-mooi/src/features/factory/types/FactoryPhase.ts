import type { FactoryMilestone } from '@/features/factory/types/FactoryMilestone';

export interface FactoryPhase {
  id: string;
  title: string;
  status: 'planned' | 'expanded' | 'done' | 'reopened';
  depends: string[];
  /** Empty until the phase is expanded. */
  milestones: FactoryMilestone[];
}
