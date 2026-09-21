import { useCallback, useEffect, useMemo, useState } from 'react';
import { closeSession, createSession, fetchSessions } from '@/features/sessions/api/sessionsApi';
import type { CreateSessionRequest } from '@/features/sessions/types/CreateSessionRequest';
import type { Session } from '@/features/sessions/types/Session';
import { useSessionsStore } from '@/stores/sessionsStore';

/** Shared empty result, so a hook without a project keeps returning the same reference. */
const NO_SESSIONS: Session[] = [];

interface UseProjectSessions {
  sessions: Session[];
  loading: boolean;
  error: string | null;
  busy: boolean;
  actionError: string | null;
  create: (request: CreateSessionRequest) => Promise<Session | null>;
  close: (sessionId: string) => Promise<boolean>;
  reload: () => void;
  clearActionError: () => void;
}

/**
 * A project's sessions, plus the actions that change them. Loaded per project rather than once for
 * the whole shell (unlike `useProjectsSync`): there is no screen that lists every session across
 * every project, so nothing needs them before the project screen mounts.
 */
export const useProjectSessions = (projectId: string | undefined): UseProjectSessions => {
  /**
   * The selector returns the store's own array and the narrowing happens here on purpose: zustand
   * compares snapshots by identity, so filtering inside the selector hands `useSyncExternalStore` a
   * new array on every render and the subscription re-renders forever.
   */
  const allSessions = useSessionsStore((state) => state.sessions);
  const sessions = useMemo(
    () => (projectId ? allSessions.filter((session) => session.projectId === projectId) : NO_SESSIONS),
    [allSessions, projectId],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    fetchSessions(projectId)
      .then((loaded) => {
        loaded.forEach((session) => useSessionsStore.getState().upsertSession(session));
      })
      .catch((failure: Error) => setError(failure.message))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const create = useCallback(async (request: CreateSessionRequest): Promise<Session | null> => {
    setBusy(true);
    setActionError(null);

    try {
      const session = await createSession(request);

      useSessionsStore.getState().upsertSession(session);

      return session;
    } catch (failure) {
      setActionError((failure as Error).message);

      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  const close = useCallback(async (sessionId: string): Promise<boolean> => {
    setBusy(true);
    setActionError(null);

    try {
      await closeSession(sessionId);
      useSessionsStore.getState().removeSession(sessionId);

      return true;
    } catch (failure) {
      setActionError((failure as Error).message);

      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const clearActionError = useCallback(() => setActionError(null), []);

  return { sessions, loading, error, busy, actionError, create, close, reload: load, clearActionError };
};
