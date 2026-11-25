import type { SessionUsage } from './SessionUsage';
import type { DeploymentSnapshot } from './DeploymentSnapshot';
import type { DeploymentSetup } from './DeploymentSetup';
import type { FactoryBinding } from '@/features/factory/types/FactoryBinding';
import type { AgentCapabilities } from '@/features/sessions/types/AgentCapabilities';
import type { PendingRequest } from '@/features/sessions/types/PendingRequest';
import type { SessionKind } from '@/features/sessions/types/SessionKind';
import type { SessionOrigin } from '@/features/sessions/types/SessionOrigin';
import type { SessionStatus } from '@/features/sessions/types/SessionStatus';

export interface Session {
  id: string;
  kind: SessionKind;
  projectId: string;
  projectFullName: string;
  provider: string;
  connectionId: string;
  model: string;
  effort?: string | null;
  /** Context percent at which the session hands its work over to a fresh conversation; `null` is off. */
  contextHandover?: number | null;
  providerLabel: string;
  /** The provider adapter the agent runs on, e.g. `cli` labelled "Claude CLI". */
  adapter?: string;
  adapterLabel?: string;
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
  deploymentSetup?: DeploymentSetup | null;
  /** The project's setup passed its test and the workspace holds a root Compose file: Deploy runs it directly. */
  deploymentConfigured?: boolean;
  /** The session's own clone on the sessions pod; null until provisioning has cloned it. */
  workspacePath: string | null;
  baseCommit: string | null;
  /** Failed with its agent and workspace intact: reconnecting resumes the conversation. */
  recoverable?: boolean;
  /** Set when the session belongs to the project's Software Factory: its chat or one step of the loop. */
  factory?: FactoryBinding | null;
  /** What the session is for, when another session's agent opened it and named the task. */
  title?: string | null;
  /** The session whose agent opened this one; null for sessions the player opened. */
  origin?: SessionOrigin | null;
}
