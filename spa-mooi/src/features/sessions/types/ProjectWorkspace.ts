import type { DeploymentState } from '@/features/sessions/types/DeploymentState';
import type { SessionStatus } from '@/features/sessions/types/SessionStatus';

/** One session's clone as it sits on disk right now. */
export interface ProjectWorkspace {
  sessionId: string;
  status: SessionStatus;
  branch: string;
  baseBranch: string;
  path: string | null;
  baseCommit: string | null;
  headCommit: string | null;
  headBranch: string | null;
  dirtyFiles: number;
  sizeBytes: number;
  createdAt: string;
  deploymentState: DeploymentState;
  previewUrl: string | null;
}
