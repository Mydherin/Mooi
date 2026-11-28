import { useCallback, useEffect, useRef } from 'react';
import { fetchChanges } from '@/features/sessions/api/sessionsApi';
import type { SessionStatus } from '@/features/sessions/types/SessionStatus';
import { useSessionsStore } from '@/stores/sessionsStore';

/**
 * Seeds the changes panel with a direct `fetchChanges` rather than waiting for a replayed
 * `changes.updated` to survive inside the server's bounded event log, so a reopened session or a
 * second browser tab shows the right diff immediately; the stream keeps it fresh from there on.
 * It reloads once the workspace is provisioned and after the stream reconnects (events may be lost).
 */
export const useSessionChangesSeed = (sessionId: string | undefined, status: SessionStatus | undefined): void => {
  const streamState = useSessionsStore((state) => sessionId ? state.byId[sessionId]?.streamState : undefined);
  const previousStatus = useRef<SessionStatus | undefined>(undefined);
  const previousStreamState = useRef<string | undefined>(undefined);

  const refresh = useCallback(async () => {
    if (!sessionId) return;
    const store = useSessionsStore.getState();
    const requestSeq = store.byId[sessionId]?.lastSeq ?? 0;
    store.setChangesLoading(sessionId);
    try {
      const changes = await fetchChanges(sessionId);
      useSessionsStore.getState().setChanges(sessionId, changes, requestSeq);
    } catch (failure) {
      useSessionsStore.getState().setChangesError(sessionId, (failure as Error).message, requestSeq);
    }
  }, [sessionId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (previousStatus.current === 'provisioning' && status === 'ready') void refresh();
    previousStatus.current = status;
  }, [refresh, status]);

  useEffect(() => {
    if (previousStreamState.current === 'reconnecting' && streamState === 'open') void refresh();
    previousStreamState.current = streamState;
  }, [refresh, streamState]);
};
