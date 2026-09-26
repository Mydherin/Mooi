import type { AgentConnection } from '@/features/agents/types/AgentConnection';
import type { SessionProvider } from '@/features/sessions/types/SessionProvider';

/** A connected account next to the live model catalog it reported, or why it could not. */
export interface AccountCatalog {
  connection: AgentConnection;
  catalog: SessionProvider | null;
  error: string | null;
}
