import type { AgentConnectionMode } from '@/features/agents/types/AgentConnectionMode';

/** One agent provider this application knows how to link, exactly as the API reports it. */
export interface AgentProvider {
  id: string;
  label: string;
  modes: AgentConnectionMode[];
  oauthEnabled: boolean;
}
