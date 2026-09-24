import type { DeploymentState } from './DeploymentState';
import type { DeploymentResult } from './DeploymentResult';

export interface DeploymentSnapshot {
  state: DeploymentState;
  operationId: string | null;
  phase: string | null;
  previewUrl: string | null;
  result: DeploymentResult | null;
  cleanupRequired: boolean;
  updatedAt: string;
}
