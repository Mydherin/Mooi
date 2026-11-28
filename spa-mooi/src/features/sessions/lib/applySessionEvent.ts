import { DEPLOYMENT_LOG_LIMIT } from './deploymentLogLimit';
import { emptyTranscriptState } from './transcript/emptyTranscriptState';
import { activityNotice, clearedNotice, compactionNotice, mergeNotice, settleProgressNotices } from './transcript/noticeEntries';
import { permissionRequest, questionRequest, requestText, resolutionText, withPendingRequest } from './transcript/pendingRequests';
import {
  closeOpenEntry,
  isOpenAssistantEntry,
  newTurnEntry,
  withOpenedSessionBlock,
  withResolvedStep,
  withStepBlock,
  withTextBlock,
} from './transcript/turnEntries';
import type { ChangesSummary } from '@/features/sessions/types/ChangesSummary';
import type { ImageAttachment } from '@/features/sessions/types/ImageAttachment';
import type { SessionEvent } from '@/features/sessions/types/SessionEvent';
import type { SessionTranscriptState } from '@/features/sessions/types/SessionTranscriptState';

export { emptyTranscriptState };

const images = (value: unknown): ImageAttachment[] => Array.isArray(value) ? value as ImageAttachment[] : [];

/**
 * The pure fold turning one SSE event into the next transcript state. Mirrors `record()` in
 * `mic-sessions/features/sessions.py` for the parts the SPA also has to derive — `waiting` on a
 * request, closing the open turn on its resolution or on `turn.result` — so server and client can
 * never disagree. Safe to replay: folding the same ordered events from empty state
 * always produces the same result.
 *
 * An `assistant` entry spans a whole turn, not a single SDK message: the Claude Agent SDK can emit
 * several internal `AssistantMessage`s before `turn.result` (text, then a tool call, then more
 * text), and their blocks all append, in order, to the same entry (see `transcript/turnEntries`).
 * Only one turn can run at a time in a session.
 */
export const applySessionEvent = (state: SessionTranscriptState, event: SessionEvent): SessionTranscriptState => {
  const { seq, at, type, data } = event;
  if (type === 'history.reset') {
    return { ...emptyTranscriptState(), pane: state.pane, previewOpenedOperationId: state.previewOpenedOperationId,
      deploymentLog: state.deploymentLog, deploymentLogOpen: state.deploymentLogOpen, streamState: state.streamState, lastSeq: seq,
      entries: [{ id: `gap-${seq}`, kind: 'error', at, text: String(data.message) }] };
  }
  if (type === 'session.sync') {
    if (seq < state.lastSeq) return state;
    const status = (data.session as { status?: string } | undefined)?.status;
    return { ...state, lastSeq: seq, pending: data.pending as SessionTranscriptState['pending'],
      entries: status && status !== 'working' && status !== 'waiting' ? closeOpenEntry(state.entries) : state.entries };
  }
  if (seq <= state.lastSeq) return state;
  if (event.type === 'deployment.log') {
    const log = event.data;
    const current = state.deploymentLog[0]?.operationId === log.operationId ? state.deploymentLog : [];
    return { ...state, lastSeq: seq, deploymentLog: current.some((batch) => batch.index === log.index) ? current
      : [...current, log].sort((a, b) => a.index - b.index).slice(-DEPLOYMENT_LOG_LIMIT) };
  }

  const next: SessionTranscriptState = { ...state, lastSeq: seq };
  const text = (blockKind: 'text' | 'thinking', id: string, value: string, mode: 'append' | 'replace') => {
    next.entries = withTextBlock(next.entries, seq, at, blockKind, id, value, mode);
  };
  const changesPending = () => {
    next.changesStatus = 'loading';
    next.changesError = null;
  };

  switch (type) {
    case 'message.user':
      next.entries = [...closeOpenEntry(next.entries), { id: String(data.messageId), kind: 'user', at,
        text: String(data.text ?? ''), images: images(data.images) }];
      break;
    case 'assistant.delta':
    case 'assistant.message':
    case 'thinking.delta':
    case 'thinking.message':
      text(type.startsWith('thinking') ? 'thinking' : 'text', String(data.messageId), String(data.text ?? ''),
        type.endsWith('delta') ? 'append' : 'replace');
      break;
    case 'tool.use':
      next.entries = withStepBlock(next.entries, seq, at, {
        toolUseId: String(data.toolUseId),
        name: String(data.name),
        title: String(data.title ?? data.name),
        input: (data.input as Record<string, unknown> | undefined) ?? {},
        status: 'running',
        summary: null,
        images: [],
      });
      break;
    case 'tool.result':
      next.entries = withResolvedStep(next.entries, String(data.toolUseId), data.isError ? 'failed' : 'done',
        String(data.summary ?? ''), images(data.images));
      changesPending();
      break;
    case 'permission.request':
    case 'question.request': {
      const kind = type === 'permission.request' ? 'permission' : 'question';
      text('text', `request-${data.requestId}`, requestText(data, kind), 'replace');
      next.pending = withPendingRequest(next.pending, kind === 'permission' ? permissionRequest(data) : questionRequest(data));
      break;
    }
    case 'permission.resolved':
    case 'question.resolved':
      text('text', `answer-${data.requestId}`, resolutionText(data), 'replace');
      next.pending = next.pending.filter((request) => request.requestId !== String(data.requestId));
      break;
    case 'turn.result': {
      const entries = isOpenAssistantEntry(next.entries[next.entries.length - 1])
        ? next.entries : [...next.entries, newTurnEntry(seq, at, [])];
      next.entries = closeOpenEntry(entries, {
        result: {
          terminalReason: (data.terminalReason as string | null | undefined) ?? null,
          subtype: (data.subtype as string | null | undefined) ?? null,
          durationMs: (data.durationMs as number | null | undefined) ?? null,
          costUsd: (data.costUsd as number | null | undefined) ?? null,
          usage: (data.usage as Record<string, unknown> | null | undefined) ?? null,
        },
      });
      next.pending = [];
      changesPending();
      break;
    }
    case 'session.status': {
      const status = data.status as string | undefined;
      if (status === 'failed' || status === 'closed') next.pending = [];
      if (status !== 'working' && status !== 'waiting') next.entries = closeOpenEntry(next.entries);
      break;
    }
    case 'changes.updated': {
      const payload = data as unknown as ChangesSummary;
      next.changesEventSeq = seq;
      if (payload.status === 'error') {
        next.changesStatus = 'error';
        next.changesError = payload.error ?? 'Could not calculate changes.';
      } else {
        next.changes = payload;
        next.changesStatus = 'ready';
        next.changesError = null;
      }
      break;
    }
    case 'session.cleared':
      next.entries = [clearedNotice(seq, at)];
      next.pending = [];
      break;
    case 'session.compaction': {
      const phase = String(data.phase);
      const previous = phase === 'started' ? next.entries : settleProgressNotices(next.entries);
      next.entries = [...closeOpenEntry(previous), compactionNotice(seq, at, phase)];
      break;
    }
    case 'merge.completed':
      next.lastMerge = { targetBranch: String(data.targetBranch), commit: String(data.commit), seq };
      next.entries = [...closeOpenEntry(next.entries),
        mergeNotice(seq, at, String(data.targetBranch), String(data.commit), String(data.message ?? '') || null)];
      break;
    case 'session.opened':
      next.entries = withOpenedSessionBlock(next.entries, seq, at, {
        sessionId: String(data.sessionId),
        branch: String(data.branch),
        title: typeof data.title === 'string' && data.title ? data.title : null,
        prompt: String(data.prompt ?? ''),
      });
      break;
    case 'agent.activity': {
      const notice = activityNotice(seq, at, String(data.kind), String(data.description ?? '') || null);
      if (notice) next.entries = [...closeOpenEntry(next.entries), notice];
      else if (data.kind === 'conversation_reset') text('text', `activity-${seq}`, String(data.description ?? data.summary ?? ''), 'replace');
      break;
    }
    case 'error':
      next.entries = [...closeOpenEntry(next.entries),
        { id: `error-${seq}`, kind: 'error', at, text: String(data.message ?? 'Something went wrong') }];
      break;
    default:
      break;
  }

  return next;
};
