import type { AgentStep } from '@/features/sessions/types/AgentStep';
import type { ChatRole } from '@/features/sessions/types/ChatRole';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  author: string;
  time: string;
  text: string;
  steps?: AgentStep[];
}
