import { openEventStream, type EventStreamState } from '@/features/sessions/lib/openEventStream';
import type { SessionEvent } from '@/features/sessions/types/SessionEvent';

export type SessionStreamState = EventStreamState;

interface OpenSessionStreamOptions {
  sessionId: string;
  after: number;
  onEvent: (event: SessionEvent) => void;
  onState: (state: SessionStreamState) => void;
}

/** The live tail of one session's event log; a vanished session folds into a `closed` status. */
export const openSessionStream = ({ sessionId, after, onEvent, onState }: OpenSessionStreamOptions): (() => void) =>
  openEventStream({
    path: `/sessions/${sessionId}/events`,
    after,
    onFrame: (frame) => onEvent(frame as SessionEvent),
    onState,
    onGone: (lastSeq) => onEvent({ seq: lastSeq + 1, at: new Date().toISOString(), type: 'session.status',
      data: { status: 'closed', detail: 'This session is no longer available.' } } as SessionEvent),
  });
