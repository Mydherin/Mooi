import type { FactoryStep } from '@/features/factory/types/FactoryStep';

/** What a step worked on: `phase/milestone`, a phase, or a change request (analysts have no target). */
export const factoryStepTarget = (step: FactoryStep): string =>
  step.milestoneId ? `${step.phaseId}/${step.milestoneId}` : step.phaseId ?? 'Change request';
