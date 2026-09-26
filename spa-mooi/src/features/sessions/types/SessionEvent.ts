import type { DeploymentEvent } from './DeploymentEvent';
import type { SessionEventType } from './SessionEventType';

export type SessionEvent = DeploymentEvent | {
  seq: number;
  at: string;
  type: Exclude<SessionEventType, 'deployment.updated' | 'deployment.log'>;
  data: Record<string, unknown>;
};
