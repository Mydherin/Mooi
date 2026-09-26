import type { SessionUsage } from './SessionUsage';
import type { DeploymentSnapshot } from './DeploymentSnapshot';
import type { AgentCapabilities } from '@/features/sessions/types/AgentCapabilities';
import type { PendingRequest } from '@/features/sessions/types/PendingRequest';
import type { SessionStatus } from '@/features/sessions/types/SessionStatus';

export interface Session {
  id: string;
  projectId: string;
  projectFullName: string;
  provider: string;
  connectionId: string;
  model: string;
  effort?: string | null;
  providerLabel: string;
  branch: string;
  baseBranch: string;
  status: SessionStatus;
  detail: string | null;
  createdAt: string;
  updatedAt: string;
  lastSeq: number;
  usage?: SessionUsage;
  pending: PendingRequest | null;
  capabilities: AgentCapabilities;
  deployment: DeploymentSnapshot;
  /** The session's own clone on the sessions pod; null until provisioning has cloned it. */
  workspacePath: string | null;
  baseCommit: string | null;
}
