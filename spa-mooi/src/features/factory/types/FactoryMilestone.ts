import type { FactoryMilestoneStatus } from '@/features/factory/types/FactoryMilestoneStatus';

/** A milestone as its front matter says (its own branch's, for the one in progress). */
export interface FactoryMilestone {
  id: string;
  title: string;
  status: FactoryMilestoneStatus;
  depends: string[];
  /** Failed end-to-end test cycles so far. */
  attempts: number;
  test: 'none' | 'passed' | 'failed';
}
