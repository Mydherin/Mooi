import type { Project } from '@/features/projects/types/Project';
import type { DeploymentSnapshot } from '@/features/sessions/types/DeploymentSnapshot';

/**
 * Deploy and preview belong to web applications only. A deployment that is still alive, or left
 * resources behind, stays reachable anyway: a project re-marked mid-deploy must still be stoppable.
 */
export const deploymentAvailable = (project: Project, deployment: DeploymentSnapshot | undefined): boolean =>
  project.webApplication
  || deployment?.state === 'starting'
  || deployment?.state === 'running'
  || deployment?.state === 'stopping'
  || Boolean(deployment?.cleanupRequired);
