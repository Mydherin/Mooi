import type { FactoryPhase } from '@/features/factory/types/FactoryPhase';

/** Done and total milestones of some phases; a phase not expanded yet counts for nothing. */
export const countMilestones = (phases: FactoryPhase[]): { done: number; total: number } => {
  const milestones = phases.flatMap((phase) => phase.milestones);
  return { done: milestones.filter((milestone) => milestone.status === 'done').length, total: milestones.length };
};
