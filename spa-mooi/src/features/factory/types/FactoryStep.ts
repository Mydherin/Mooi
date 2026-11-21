import type { FactoryRole } from '@/features/factory/types/FactoryRole';

/** One journaled step of the loop: a fresh session with one role and one target. */
export interface FactoryStep {
  id: string;
  role: Exclude<FactoryRole, 'chat'>;
  phaseId: string | null;
  milestoneId: string | null;
  sessionId: string | null;
  branch: string | null;
  model: string | null;
  baseCommit: string | null;
  headCommit: string | null;
  status: 'running' | 'completed' | 'continue' | 'failed' | 'blocked' | 'interrupted';
  summary: string | null;
  peakContextPercent: number | null;
  startedAt: string;
  finishedAt: string | null;
}
