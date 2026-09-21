import { create } from 'zustand';
import { applySessionEvent, emptyTranscriptState } from '@/features/sessions/lib/applySessionEvent';
import { applySessionToSession } from '@/features/sessions/lib/applySessionToSession';
import type { SessionsState } from '@/stores/types/SessionsState';

/**
 * Deliberately not persisted — server state, same reasoning as `agentsStore`/`projectsStore`.
 * `sessions` is the list surface (project screen, headers); `byId` is the live transcript per
 * session, folded from its SSE stream by `applySessionEvent` — the store never assigns transcript
 * state directly, only replays events through it.
 */
export const useSessionsStore = create<SessionsState>((set, get) => ({
  sessions: [],
  byId: {},

  setSessions: (sessions) => set({ sessions }),

  upsertSession: (session) =>
    set((state) => ({
      sessions: [state.sessions.find((current) => current.id === session.id && current.lastSeq >= session.lastSeq) ?? session,
        ...state.sessions.filter((current) => current.id !== session.id)],
    })),

  removeSession: (sessionId) =>
    set((state) => {
      const { [sessionId]: _removed, ...rest } = state.byId;
      return { sessions: state.sessions.filter((session) => session.id !== sessionId), byId: rest };
    }),

  ensureTranscript: (sessionId) => {
    if (get().byId[sessionId]) {
      return;
    }

    set((state) => ({ byId: { ...state.byId, [sessionId]: emptyTranscriptState() } }));
  },

  applyEvent: (sessionId, event) =>
    set((state) => {
      const transcript = applySessionEvent(state.byId[sessionId] ?? emptyTranscriptState(), event);
      const hasSession = state.sessions.some((session) => session.id === sessionId);

      return {
        byId: { ...state.byId, [sessionId]: transcript },
        sessions: hasSession
          ? state.sessions.map((session) => (session.id === sessionId ? { ...applySessionToSession(session, event),
            ...(transcript.pending.length ? { status: 'waiting' as const } : {}) } : session))
          : state.sessions,
      };
    }),

  setStreamState: (sessionId, streamState) =>
    set((state) => ({
      byId: { ...state.byId, [sessionId]: { ...(state.byId[sessionId] ?? emptyTranscriptState()), streamState } },
    })),

  setChanges: (sessionId, changes, requestSeq = Number.MAX_SAFE_INTEGER) =>
    set((state) => {
      const current = state.byId[sessionId] ?? emptyTranscriptState();
      if (current.changesEventSeq > requestSeq) return state;
      const failed = changes.status === 'error';
      return {
        byId: {
          ...state.byId,
          [sessionId]: {
            ...current,
            changes: failed ? current.changes : changes,
            changesStatus: failed ? 'error' : 'ready',
            changesError: failed ? changes.error ?? 'Could not calculate changes.' : null,
          },
        },
      };
    }),

  setChangesLoading: (sessionId) =>
    set((state) => {
      const current = state.byId[sessionId] ?? emptyTranscriptState();
      return {
        byId: {
          ...state.byId,
          [sessionId]: { ...current, changesStatus: 'loading', changesError: null },
        },
      };
    }),

  setChangesError: (sessionId, error, requestSeq = Number.MAX_SAFE_INTEGER) =>
    set((state) => {
      const current = state.byId[sessionId] ?? emptyTranscriptState();
      if (current.changesEventSeq > requestSeq) return state;
      return {
        byId: {
          ...state.byId,
          [sessionId]: { ...current, changesStatus: 'error', changesError: error },
        },
      };
    }),

  resetTranscript: (sessionId) => set((state) => ({ byId: { ...state.byId, [sessionId]: emptyTranscriptState() } })),

  clear: () => set({ sessions: [], byId: {} }),
}));
