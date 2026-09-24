import type { DeploymentAction } from './DeploymentAction';
import type { DeploymentReason } from './DeploymentReason';

export interface DeploymentResult {
  schemaVersion: 1;
  operationId: string;
  action: DeploymentAction;
  success: boolean;
  state: 'running' | 'stopped' | 'failed';
  reason: DeploymentReason | null;
  previewUrl: string | null;
  cleanupRequired: boolean;
}
