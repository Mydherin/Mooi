import type { AgentConnection } from '@/features/agents/types/AgentConnection';
import type { AgentProvider } from '@/features/agents/types/AgentProvider';
import type { AgentsStatus } from '@/features/agents/types/AgentsStatus';

export interface AgentsState {
  providers: AgentProvider[];
  connections: AgentConnection[];
  status: AgentsStatus;
  error: string | null;
  setProviders: (providers: AgentProvider[]) => void;
  setConnections: (connections: AgentConnection[]) => void;
  upsertConnection: (connection: AgentConnection) => void;
  removeConnection: (provider: string) => void;
  setStatus: (status: AgentsStatus) => void;
  setError: (error: string | null) => void;
  clear: () => void;
}
