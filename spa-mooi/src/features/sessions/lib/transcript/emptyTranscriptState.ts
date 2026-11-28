import type { SessionTranscriptState } from '@/features/sessions/types/SessionTranscriptState';

/**
 * A fresh transcript always starts at `seq` 0 — even for a session that already has history —
 * because the client has replayed nothing yet: `useSessionStream` opens with `after: 0`, and the
 * server's replay reconstructs every entry from scratch. Only a stream that drops and
 * reconnects mid-mount resumes from a later `seq`, and that resume lives inside
 * `openSessionStream` itself, not here.
 */
export const emptyTranscriptState = (): SessionTranscriptState => ({
  pane: 'conversation',
  previewOpenedOperationId: null,
  deploymentLog: [],
  deploymentLogOpen: false,
  entries: [],
  pending: [],
  changes: null,
  changesStatus: 'idle',
  changesError: null,
  changesEventSeq: 0,
  lastMerge: null,
  lastSeq: 0,
  streamState: 'closed',
});
