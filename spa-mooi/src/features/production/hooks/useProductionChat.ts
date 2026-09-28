import { useCallback, useMemo, useState } from 'react';
import { createSession } from '@/features/sessions/api/sessionsApi';
import type { Session } from '@/features/sessions/types/Session';
import { useSessionsStore } from '@/stores/sessionsStore';

export interface ProductionChatRequest {
  provider: string;
  connectionId: string;
  model: string;
  effort: string | null;
  message: string;
}

interface UseProductionChat {
  chat: Session | undefined;
  starting: boolean;
  error: string | null;
  start: (request: ProductionChatRequest) => Promise<Session | null>;
  clearError: () => void;
}

/**
 * The project's production chat, if one is live. Starting a new one replaces the previous chat on
 * the server; the first message is delivered as soon as the agent is ready.
 */
export const useProductionChat = (projectId: string | undefined): UseProductionChat => {
  const sessions = useSessionsStore((state) => state.sessions);
  const chat = useMemo(() => sessions.find((session) => session.projectId === projectId && session.kind === 'production'
    && session.status !== 'closed'), [sessions, projectId]);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async (request: ProductionChatRequest): Promise<Session | null> => {
    if (!projectId) return null;
    setStarting(true);
    setError(null);
    try {
      const session = await createSession({ projectId, kind: 'production', provider: request.provider,
        connectionId: request.connectionId, model: request.model, effort: request.effort, initialMessage: request.message });
      const store = useSessionsStore.getState();
      store.sessions.filter((item) => item.projectId === projectId && item.kind === 'production' && item.id !== session.id)
        .forEach((item) => store.removeSession(item.id));
      store.upsertSession(session);
      return session;
    } catch (failure) {
      setError((failure as Error).message);
      return null;
    } finally {
      setStarting(false);
    }
  }, [projectId]);

  const clearError = useCallback(() => setError(null), []);

  return { chat, starting, error, start, clearError };
};
