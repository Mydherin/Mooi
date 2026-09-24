import type { DeploymentEvent } from './DeploymentEvent';
import type { SessionEventType } from './SessionEventType';

export type SessionEvent = DeploymentEvent | {
  seq: number;
  at: string;
  type: Exclude<SessionEventType, 'deployment.updated' | 'deployment.progress' | 'deployment.activity'>;
  data: Record<string, unknown>;
};
