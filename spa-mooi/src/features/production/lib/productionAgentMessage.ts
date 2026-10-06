import type { ProductionAgentIntent } from '@/features/production/types/ProductionAgentIntent';

/** The user's request of a production chat; the platform sends it inside its visible deployment brief. */
export const productionAgentMessage = (intent: ProductionAgentIntent, prompt: string, failedRelease?: string | null): string => {
  const request = prompt.trim();
  if (intent === 'migrate') return `Migrate the legacy production Compose currently generated in Platform files to a tracked docker-compose.yml at the repository root. Read the active and draft documents and the existing repository first. Preserve services, deployment identity, volumes and data. Replace inline configuration and secrets with environment interpolation, saving existing production values through the platform environment API and reusing inherited development values. Keep DEPLOYMENT.md, deploy.sh and status.sh in the platform; adjust deploy.sh to consume the Compose from the selected release and reference every required variable so missing values are detected. Show the repository changes and ask for commit approval before publishing. Finish with a successful real test deployment; leave the active configuration intact until it succeeds.${request ? `\n\n${request}` : ''}`;
  if (intent === 'setup') return `Set up the production deployment of this project.\n\n${request}`;
  if (intent === 'update') return `Update the current production deployment configuration.\n\n${request}`;
  return `The last production deployment${failedRelease ? ` of ${failedRelease}` : ''} failed. Read its detail, find the cause and fix the configuration.${request ? `\n\n${request}` : ''}`;
};
