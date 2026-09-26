import type { DeploymentState } from '@/features/sessions/types/DeploymentState';
import type { SessionDisplayStatus } from '@/features/sessions/types/SessionDisplayStatus';
import type { SessionStatus } from '@/features/sessions/types/SessionStatus';

/**
 * The agent outranks the deployment: a session that works, waits or failed says so first. Only an
 * idle agent lets the deployment speak, so `ready` becomes `deploying` or `deployed`.
 */
export const sessionDisplayStatus = (status: SessionStatus, deployment?: DeploymentState): SessionDisplayStatus => {
  if (status !== 'ready') return status;
  if (deployment === 'starting') return 'deploying';
  if (deployment === 'running') return 'deployed';
  return status;
};
