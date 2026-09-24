import { mergeDeployment } from './mergeDeployment';
import type { Session } from '@/features/sessions/types/Session';
import type { SessionEvent } from '@/features/sessions/types/SessionEvent';
import type { SessionStatus } from '@/features/sessions/types/SessionStatus';

/**
 * Patches the subset of `Session` that the same event stream also determines server-side —
 * `status`, `detail`, `pending`, `updatedAt`, `lastSeq` — mirroring `record()` in
 * `mic-sessions/features/sessions.py` so the session list and header badge stay live while a
 * session's stream is open, without a refetch (server and client fold the same events
 * the same way).
 */
export const applySessionToSession = (session: Session, event: SessionEvent): Session => {
  const { type, data, at, seq } = event;
  if (type === 'session.sync') {
    const incoming = data.session as unknown as Session;
    return seq >= session.lastSeq ? { ...incoming, deployment: mergeDeployment(session.deployment, incoming.deployment) } : session;
  }
  if (seq <= session.lastSeq || type === 'history.reset') return session;
  if (type === 'deployment.updated') {
    return { ...session, lastSeq: seq, deployment: mergeDeployment(session.deployment, data) };
  }
  if (type === 'deployment.progress' || type === 'deployment.activity') return { ...session, lastSeq: seq };
  const patch: Partial<Session> = { updatedAt: at, lastSeq: seq };

  if (type === 'session.status') {
    patch.status = (data.status as SessionStatus | undefined) ?? session.status;
    patch.detail = (data.detail as string | null | undefined) ?? null;
  } else if (type === 'session.configuration') {
    patch.model = String(data.model ?? session.model);
    patch.effort = (data.effort as string | null | undefined) ?? null;
  } else if (type === 'permission.request' || type === 'question.request') {
    patch.status = 'waiting';
    patch.pending = {
      kind: type === 'permission.request' ? 'permission' : 'question',
      requestId: String(data.requestId),
    };
  } else if (type === 'permission.resolved' || type === 'question.resolved') {
    patch.status = 'working';
    patch.pending = null;
  } else if (type === 'turn.result') {
    patch.status = 'ready';
    patch.pending = null;
  }

  return { ...session, ...patch };
};
