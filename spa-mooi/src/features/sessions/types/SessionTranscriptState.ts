import type { ChangesSummary } from '@/features/sessions/types/ChangesSummary';
import type { ChangesLoadStatus } from '@/features/sessions/types/ChangesLoadStatus';
import type { SessionPendingRequest } from '@/features/sessions/types/SessionPendingRequest';
import type { SessionStreamState } from '@/features/sessions/lib/openSessionStream';
import type { TranscriptEntry } from '@/features/sessions/types/TranscriptEntry';

export interface SessionTranscriptState {
  entries: TranscriptEntry[];
  pending: SessionPendingRequest[];
  changes: ChangesSummary | null;
  changesStatus: ChangesLoadStatus;
  changesError: string | null;
  changesEventSeq: number;
  lastSeq: number;
  streamState: SessionStreamState;
}
