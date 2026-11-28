import { create } from 'zustand';
import { applySessionEvent, emptyTranscriptState } from '@/features/sessions/lib/applySessionEvent';
import { applySessionToSession } from '@/features/sessions/lib/applySessionToSession';
import { mergeDeployment } from '@/features/sessions/lib/mergeDeployment';
import type { Session } from '@/features/sessions/types/Session';
import type { SessionEvent } from '@/features/sessions/types/SessionEvent';
import type { SessionTranscriptState } from '@/features/sessions/types/SessionTranscriptState';
import type { SessionsState } from '@/stores/types/SessionsState';

/**
 * Deliberately not persisted — server state, same reasoning as `agentsStore`/`projectsStore`.
 * `sessions` is the list surface (project screen, headers), kept live by the player's channel;
 * `byId` is the live transcript per session, folded from its SSE stream by `applySessionEvent` — the
 * store never assigns transcript chat state directly, only replays events through it. Preview visit
 * metadata and the Compose log live alongside the transcript; the authoritative deployment snapshot
 * lives only in sessions.
 *
 * Updates keep references stable when nothing changed (an event older than the session's summary
 * leaves `sessions` untouched), so list subscribers only re-render for real changes.
 */
const mergeSession = (current: Session | undefined, incoming: Session): Session => current
  ? { ...(current.lastSeq >= incoming.lastSeq ? current : incoming), deployment: mergeDeployment(current.deployment, incoming.deployment) }
  : incoming;

/** A session someone is looking at stays on screen, closed, instead of vanishing under them. */
const watched = (state: SessionsState, sessionId: string): boolean =>
  state.byId[sessionId]?.streamState === 'open' || state.byId[sessionId]?.streamState === 'reconnecting';

const closed = (session: Session): Session => ({ ...session, status: 'closed', pending: null });

/** One transcript patched, created empty first when the session has none yet. */
const patchTranscript = (state: SessionsState, sessionId: string,
  patch: (current: SessionTranscriptState) => Partial<SessionTranscriptState>): Pick<SessionsState, 'byId'> => {
  const current = state.byId[sessionId] ?? emptyTranscriptState();
  return { byId: { ...state.byId, [sessionId]: { ...current, ...patch(current) } } };
};

/** The session summary after `event`; the same object when the event changes nothing in it. */
const foldSummary = (session: Session, event: SessionEvent, transcript: SessionTranscriptState): Session => {
  const folded = applySessionToSession(session, event);
  const waiting = transcript.pending.length > 0 && !event.type.startsWith('deployment.');
  return waiting && folded.status !== 'waiting' ? { ...folded, status: 'waiting' } : folded;
};

export const useSessionsStore = create<SessionsState>((set, get) => ({
  sessions: [],
  byId: {},

  setPane: (sessionId, pane) => set((state) => patchTranscript(state, sessionId, () => ({ pane }))),

  setDeploymentLogOpen: (sessionId, open) => set((state) => patchTranscript(state, sessionId, () => ({ deploymentLogOpen: open }))),

  syncSessions: (sessions) => set((state) => {
    const incomingIds = new Set(sessions.map((session) => session.id));
    const gone = state.sessions.filter((session) => !incomingIds.has(session.id));
    const byId = { ...state.byId };
    gone.filter((session) => !watched(state, session.id)).forEach((session) => delete byId[session.id]);
    return {
      byId,
      sessions: [
        ...sessions.map((session) => mergeSession(state.sessions.find((current) => current.id === session.id), session)),
        ...gone.filter((session) => watched(state, session.id)).map(closed),
      ],
    };
  }),

  setDeployment: (sessionId, snapshot) => set((state) => ({
    sessions: state.sessions.map((session) => session.id === sessionId
      ? { ...session, deployment: mergeDeployment(session.deployment, snapshot) } : session),
  })),

  markPreviewOpened: (sessionId, operationId) => set((state) => patchTranscript(state, sessionId, () => ({ previewOpenedOperationId: operationId }))),

  // In place: a known session keeps its position; a new one belongs at the top, like the server's order.
  upsertSession: (session) =>
    set((state) => state.sessions.some((current) => current.id === session.id)
      ? { sessions: state.sessions.map((current) => (current.id === session.id ? mergeSession(current, session) : current)) }
      : { sessions: [session, ...state.sessions] }),

  removeSession: (sessionId) =>
    set((state) => {
      const { [sessionId]: _removed, ...rest } = state.byId;
      return { sessions: state.sessions.filter((session) => session.id !== sessionId), byId: rest };
    }),

  retireSession: (sessionId) => {
    if (!watched(get(), sessionId)) {
      get().removeSession(sessionId);
      return;
    }
    set((state) => ({ sessions: state.sessions.map((session) => (session.id === sessionId ? closed(session) : session)) }));
  },

  ensureTranscript: (sessionId) => {
    if (get().byId[sessionId]) {
      return;
    }

    set((state) => ({ byId: { ...state.byId, [sessionId]: emptyTranscriptState() } }));
  },

  applyEvent: (sessionId, event) =>
    set((state) => {
      const transcript = applySessionEvent(state.byId[sessionId] ?? emptyTranscriptState(), event);
      const current = state.sessions.find((session) => session.id === sessionId);
      const next = current ? foldSummary(current, event, transcript) : undefined;
      const sessions = current
        ? next === current ? state.sessions : state.sessions.map((session) => (session === current && next ? next : session))
        : event.type === 'session.sync' ? [...state.sessions, event.data.session as unknown as Session] : state.sessions;

      return { byId: { ...state.byId, [sessionId]: transcript }, sessions };
    }),

  setStreamState: (sessionId, streamState) => set((state) => patchTranscript(state, sessionId, () => ({ streamState }))),

  // A read that started before the latest change event is stale: it never overwrites newer state.
  setChanges: (sessionId, changes, requestSeq = Number.MAX_SAFE_INTEGER) =>
    set((state) => {
      if ((state.byId[sessionId]?.changesEventSeq ?? 0) > requestSeq) return state;
      const failed = changes.status === 'error';
      return patchTranscript(state, sessionId, (current) => ({
        changes: failed ? current.changes : changes,
        changesStatus: failed ? 'error' : 'ready',
        changesError: failed ? changes.error ?? 'Could not calculate changes.' : null,
      }));
    }),

  setChangesLoading: (sessionId) => set((state) => patchTranscript(state, sessionId, () => ({ changesStatus: 'loading', changesError: null }))),

  setChangesError: (sessionId, error, requestSeq = Number.MAX_SAFE_INTEGER) =>
    set((state) => ((state.byId[sessionId]?.changesEventSeq ?? 0) > requestSeq ? state
      : patchTranscript(state, sessionId, () => ({ changesStatus: 'error', changesError: error })))),

  // The view state (open pane, log drawer) survives a cleared conversation.
  resetTranscript: (sessionId) => set((state) => ({ byId: { ...state.byId, [sessionId]: {
    ...emptyTranscriptState(), deploymentLogOpen: state.byId[sessionId]?.deploymentLogOpen ?? false,
    pane: state.byId[sessionId]?.pane ?? 'conversation',
  } } })),

  clear: () => set({ sessions: [], byId: {} }),
}));
