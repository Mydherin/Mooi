import type { DeploymentErrorCode } from './DeploymentErrorCode';

export interface DeploymentReason {
  code: DeploymentErrorCode;
  message: string;
}
