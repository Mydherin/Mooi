import type { DeploymentActivity } from './DeploymentActivity';
import type { DeploymentSnapshot } from './DeploymentSnapshot';
import type { DeploymentProgress } from './DeploymentProgress';

export type DeploymentEvent = { seq: number; at: string } & (
  | { type: 'deployment.activity'; data: DeploymentActivity }
  | { type: 'deployment.updated'; data: DeploymentSnapshot }
  | { type: 'deployment.progress'; data: DeploymentProgress }
);
