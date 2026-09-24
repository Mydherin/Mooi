import type { DeploymentSnapshot } from '@/features/sessions/types/DeploymentSnapshot';

// REST has no sequence number. Keep the backend timestamp's sub-millisecond precision.
const revision = (at: string): string => {
  const milliseconds = Date.parse(at);
  const fraction = at.match(/\.(\d+)/)?.[1] ?? '';
  return `${milliseconds.toString().padStart(16, '0')}${fraction.padEnd(9, '0').slice(3, 9)}`;
};

export const mergeDeployment = (current: DeploymentSnapshot, incoming: DeploymentSnapshot): DeploymentSnapshot =>
  revision(incoming.updatedAt) > revision(current.updatedAt) ? incoming : current;
