import type { AgentCapabilities } from '@/features/sessions/types/AgentCapabilities';
import type { PendingRequest } from '@/features/sessions/types/PendingRequest';
import type { SessionStatus } from '@/features/sessions/types/SessionStatus';

export interface Session {
  id: string;
  projectId: string;
  projectFullName: string;
  provider: string;
  model: string;
  effort?: string | null;
  providerLabel: string;
  branch: string;
  baseBranch: string;
  title: string;
  status: SessionStatus;
  detail: string | null;
  createdAt: string;
  updatedAt: string;
  lastSeq: number;
  pending: PendingRequest | null;
  capabilities: AgentCapabilities;
}
