import type { ChangesSummary } from '@/features/sessions/types/ChangesSummary';
import type { ChangesLoadStatus } from '@/features/sessions/types/ChangesLoadStatus';
import type { MergeCompletion } from '@/features/sessions/types/MergeCompletion';
import type { SessionPendingRequest } from '@/features/sessions/types/SessionPendingRequest';
import type { SessionStreamState } from '@/features/sessions/lib/openSessionStream';
import type { TranscriptEntry } from '@/features/sessions/types/TranscriptEntry';

export interface SessionTranscriptState {
  pane: import('./WorkspacePane').WorkspacePane;
  previewOpenedOperationId: string | null;
  /** Compose output of the latest start operation, folded from `deployment.log`. */
  deploymentLog: import('./DeploymentLog').DeploymentLog[];
  deploymentLogOpen: boolean;
  entries: TranscriptEntry[];
  pending: SessionPendingRequest[];
  changes: ChangesSummary | null;
  changesStatus: ChangesLoadStatus;
  changesError: string | null;
  changesEventSeq: number;
  lastMerge: MergeCompletion | null;
  lastSeq: number;
  streamState: SessionStreamState;
}
