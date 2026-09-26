import type { AgentConnection } from '@/features/agents/types/AgentConnection';
import type { ModelDefaults } from '@/features/agents/types/ModelDefaults';

export const toModelDefaults = (connection: AgentConnection): ModelDefaults => ({
  session: { model: connection.sessionModel ?? '', effort: connection.sessionEffort ?? '' },
  deployment: { model: connection.deploymentModel ?? '', effort: connection.deploymentEffort ?? '' },
});
