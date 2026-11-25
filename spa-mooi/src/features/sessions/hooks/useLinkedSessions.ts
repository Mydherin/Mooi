import { useMemo } from 'react';
import type { Session } from '@/features/sessions/types/Session';
import { useSessionsStore } from '@/stores/sessionsStore';

interface LinkedSessions {
  /** The live session whose agent opened this one; undefined when none did or it is gone. */
  origin: Session | undefined;
  /** The live sessions this session's agent opened, newest first. */
  opened: Session[];
}

/** A session's lineage as the live store holds it, so every view updates as sessions open and close. */
export const useLinkedSessions = (session: Session): LinkedSessions => {
  const sessions = useSessionsStore((state) => state.sessions);
  const originId = session.origin?.sessionId;

  return useMemo(() => ({
    origin: originId ? sessions.find((candidate) => candidate.id === originId) : undefined,
    opened: sessions.filter((candidate) => candidate.origin?.sessionId === session.id),
  }), [sessions, originId, session.id]);
};
