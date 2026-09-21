import type { AgentQuestionOption } from '@/features/sessions/types/AgentQuestionOption';

export interface AgentQuestion {
  question: string;
  header: string;
  options: AgentQuestionOption[];
  multiSelect: boolean;
}
