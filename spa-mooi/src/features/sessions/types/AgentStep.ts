import type { AgentStepKind } from '@/features/sessions/types/AgentStepKind';
import type { AgentStepStatus } from '@/features/sessions/types/AgentStepStatus';

export interface AgentStep {
  id: string;
  kind: AgentStepKind;
  target: string;
  status: AgentStepStatus;
  meta?: string;
  added?: number;
  removed?: number;
}
