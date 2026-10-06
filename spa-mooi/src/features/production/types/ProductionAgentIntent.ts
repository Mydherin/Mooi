/** Why a production chat is being started: first setup, a requested change or a failed deployment. */
export type ProductionAgentIntent = 'setup' | 'update' | 'fix' | 'migrate';
