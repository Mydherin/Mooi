import type { AgentConnection } from '@/features/agents/types/AgentConnection';

export const accountName = (account: AgentConnection): string =>
  account.name || account.accountLabel || account.label;
