import type { DeploymentActivityKind } from './DeploymentActivityKind';
import type { DeploymentActivityLevel } from './DeploymentActivityLevel';
import type { DeploymentActivitySource } from './DeploymentActivitySource';

export interface DeploymentActivity {
  operationId: string;
  index: number;
  at: string;
  source: DeploymentActivitySource;
  level: DeploymentActivityLevel;
  phase: string | null;
  kind: DeploymentActivityKind;
  title: string;
  detail: string | null;
  status: 'running' | 'done' | 'failed' | null;
  toolId: string | null;
}
