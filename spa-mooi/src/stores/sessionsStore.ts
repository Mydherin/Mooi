import { mergeDeployment } from '@/features/sessions/lib/mergeDeployment';
import type { Session } from '@/features/sessions/types/Session';
import { create } from 'zustand';
import { applySessionEvent, emptyTranscriptState } from '@/features/sessions/lib/applySessionEvent';
import { applySessionToSession } from '@/features/sessions/lib/applySessionToSession';
import type { SessionsState } from '@/stores/types/SessionsState';
import { DEPLOYMENT_ACTIVITY_LIMIT } from '@/features/sessions/lib/deploymentActivityLimit';

/**
 * Deliberately not persisted — server state, same reasoning as `agentsStore`/`projectsStore`.
 * `sessions` is the list surface (project screen, headers); `byId` is the live transcript per
 * session, folded from its SSE stream by `applySessionEvent` — the store never assigns transcript
 * chat state directly, only replays events through it. Deployment progress and preview visit
 * metadata live alongside the transcript; the authoritative snapshot lives only in sessions.
 */
const mergeSession = (current: Session | undefined, incoming: Session): Session => current
  ? { ...(current.lastSeq >= incoming.lastSeq ? current : incoming), deployment: mergeDeployment(current.deployment, incoming.deployment) }
  : incoming;

export const useSessionsStore = create<SessionsState>((set, get) => ({
  sessions: [],
  byId: {},

  setPane: (sessionId, pane) => set((state) => ({
    byId: { ...state.byId, [sessionId]: { ...(state.byId[sessionId] ?? emptyTranscriptState()), pane } },
  })),

  setDeploymentLogsOpen: (sessionId, open) => set((state) => ({
    byId: { ...state.byId, [sessionId]: { ...(state.byId[sessionId] ?? emptyTranscriptState()), deploymentLogsOpen: open } },
  })),

  toggleDeploymentLogs: (sessionId) => set((state) => ({
    byId: { ...state.byId, [sessionId]: { ...(state.byId[sessionId] ?? emptyTranscriptState()),
      deploymentLogsOpen: !(state.byId[sessionId]?.deploymentLogsOpen ?? false) } },
  })),

  setSessions: (sessions) => set((state) => ({ sessions: sessions.map((session) =>
    mergeSession(state.sessions.find((current) => current.id === session.id), session)) })),

  syncSessions: (sessions, projectId) => set((state) => {
    const inScope = (session: Session) => !projectId || session.projectId === projectId;
    const incomingIds = new Set(sessions.map((session) => session.id));
    const removed = state.sessions.filter((session) => inScope(session) && !incomingIds.has(session.id));
    const byId = { ...state.byId };
    removed.forEach((session) => delete byId[session.id]);
    return {
      byId,
      sessions: [
        ...sessions.map((session) => mergeSession(state.sessions.find((current) => current.id === session.id), session)),
        ...state.sessions.filter((session) => !inScope(session)),
      ],
    };
  }),

  setDeployment: (sessionId, snapshot) => set((state) => ({
    sessions: state.sessions.map((session) => session.id === sessionId
      ? { ...session, deployment: mergeDeployment(session.deployment, snapshot) } : session),
  })),

  markPreviewOpened: (sessionId, operationId) => set((state) => ({
    byId: { ...state.byId, [sessionId]: { ...(state.byId[sessionId] ?? emptyTranscriptState()), previewOpenedOperationId: operationId } },
  })),

  upsertSession: (session) =>
    set((state) => ({
      sessions: [mergeSession(state.sessions.find((current) => current.id === session.id), session),
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
      let transcript = applySessionEvent(state.byId[sessionId] ?? emptyTranscriptState(), event);
      if (event.type === 'deployment.activity' && event.seq > (state.byId[sessionId]?.lastSeq ?? 0)) {
        const activity = transcript.deploymentActivityOperationId === event.data.operationId
          ? transcript.deploymentActivity : [];
        transcript = { ...transcript, deploymentActivityOperationId: event.data.operationId,
          deploymentActivity: activity.some((item) => item.index === event.data.index) ? activity
            : [...activity, { ...event.data, at: event.at }].sort((a, b) => a.index - b.index).slice(-DEPLOYMENT_ACTIVITY_LIMIT) };
      }
      const current = state.sessions.find((session) => session.id === sessionId);
      const hasSession = Boolean(current);
      if (current && event.type === 'deployment.progress' && event.seq > current.lastSeq
          && event.data.operationId === current.deployment.operationId
          && (current.deployment.state === 'starting' || current.deployment.state === 'stopping')) {
        transcript = { ...transcript, deploymentProgress: event.data };
      }

      const deployment = current ? applySessionToSession(current, event).deployment : undefined;
      if (deployment && (transcript.deploymentProgress?.operationId !== deployment.operationId
          || (deployment.state !== 'starting' && deployment.state !== 'stopping'))) {
        transcript = { ...transcript, deploymentProgress: null };
      }

      return {
        byId: { ...state.byId, [sessionId]: transcript },
        sessions: hasSession
          ? state.sessions.map((session) => (session.id === sessionId ? { ...applySessionToSession(session, event),
            ...(transcript.pending.length && !event.type.startsWith('deployment.') ? { status: 'waiting' as const } : {}) } : session))
          : event.type === 'session.sync' ? [...state.sessions, event.data.session as unknown as Session] : state.sessions,
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

  resetTranscript: (sessionId) => set((state) => ({ byId: { ...state.byId, [sessionId]: {
    ...emptyTranscriptState(), deploymentLogsOpen: state.byId[sessionId]?.deploymentLogsOpen ?? false,
    pane: state.byId[sessionId]?.pane ?? 'conversation',
  } } })),

  clear: () => set({ sessions: [], byId: {} }),
}));
