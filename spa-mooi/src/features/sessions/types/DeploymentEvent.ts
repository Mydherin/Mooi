import type { DeploymentSnapshot } from './DeploymentSnapshot';

import type { DeploymentLog } from './DeploymentLog';

export type DeploymentEvent = { seq: number; at: string } & (
  | { type: 'deployment.updated'; data: DeploymentSnapshot }
  | { type: 'deployment.log'; data: DeploymentLog }
);
