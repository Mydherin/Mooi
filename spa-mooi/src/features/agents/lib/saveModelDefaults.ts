import { saveAgentDefaultModels } from '@/features/agents/api/agentsApi';
import type { AgentConnection } from '@/features/agents/types/AgentConnection';
import type { ModelDefaults } from '@/features/agents/types/ModelDefaults';

export const saveModelDefaults = (id: string, defaults: ModelDefaults): Promise<AgentConnection> =>
  saveAgentDefaultModels(id, defaults.session.model || null, defaults.session.effort || null,
    defaults.deployment.model || null, defaults.deployment.effort || null);
