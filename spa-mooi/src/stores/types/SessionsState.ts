import type { SessionStreamState } from '@/features/sessions/lib/openSessionStream';
import type { ChangesSummary } from '@/features/sessions/types/ChangesSummary';
import type { Session } from '@/features/sessions/types/Session';
import type { SessionEvent } from '@/features/sessions/types/SessionEvent';
import type { SessionTranscriptState } from '@/features/sessions/types/SessionTranscriptState';

export interface SessionsState {
  sessions: Session[];
  byId: Record<string, SessionTranscriptState>;
  setSessions: (sessions: Session[]) => void;
  upsertSession: (session: Session) => void;
  removeSession: (sessionId: string) => void;
  ensureTranscript: (sessionId: string) => void;
  applyEvent: (sessionId: string, event: SessionEvent) => void;
  setStreamState: (sessionId: string, streamState: SessionStreamState) => void;
  setChanges: (sessionId: string, changes: ChangesSummary, requestSeq?: number) => void;
  setChangesLoading: (sessionId: string) => void;
  setChangesError: (sessionId: string, error: string, requestSeq?: number) => void;
  resetTranscript: (sessionId: string) => void;
  clear: () => void;
}
