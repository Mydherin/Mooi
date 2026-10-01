import type { ProductionAgentIntent } from '@/features/production/types/ProductionAgentIntent';

/** The user's request of a production chat; the platform sends it inside its visible deployment brief. */
export const productionAgentMessage = (intent: ProductionAgentIntent, prompt: string, failedRelease?: string | null): string => {
  const request = prompt.trim();
  if (intent === 'setup') return `Set up the production deployment of this project.\n\n${request}`;
  if (intent === 'update') return `Update the current production deployment configuration.\n\n${request}`;
  return `The last production deployment${failedRelease ? ` of ${failedRelease}` : ''} failed. Read its detail, find the cause and fix the configuration.${request ? `\n\n${request}` : ''}`;
};
