import type { ChangesSummary } from '@/features/sessions/types/ChangesSummary';
import type { ChangesLoadStatus } from '@/features/sessions/types/ChangesLoadStatus';
import type { MergeCompletion } from '@/features/sessions/types/MergeCompletion';
import type { SessionPendingRequest } from '@/features/sessions/types/SessionPendingRequest';
import type { SessionStreamState } from '@/features/sessions/lib/openSessionStream';
import type { TranscriptEntry } from '@/features/sessions/types/TranscriptEntry';

export interface SessionTranscriptState {
  deploymentActivity: import('./DeploymentActivity').DeploymentActivity[];
  deploymentActivityOperationId: string | null;
  pane: import('./WorkspacePane').WorkspacePane;
  deploymentLogsOpen: boolean;
  deploymentProgress: import('./DeploymentProgress').DeploymentProgress | null;
  previewOpenedOperationId: string | null;
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
