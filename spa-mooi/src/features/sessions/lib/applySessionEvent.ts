import { isProviderPlaceholder } from './isProviderPlaceholder';
import type { SessionPendingRequest } from '@/features/sessions/types/SessionPendingRequest';
import type { AgentQuestion } from '@/features/sessions/types/AgentQuestion';
import type { ChangesSummary } from '@/features/sessions/types/ChangesSummary';
import type { SessionEvent } from '@/features/sessions/types/SessionEvent';
import type { SessionTranscriptState } from '@/features/sessions/types/SessionTranscriptState';
import type { TranscriptBlock } from '@/features/sessions/types/TranscriptBlock';
import type { TranscriptEntry } from '@/features/sessions/types/TranscriptEntry';
import type { TranscriptStep } from '@/features/sessions/types/TranscriptStep';

/**
 * A fresh transcript always starts at `seq` 0 — even for a session that already has history —
 * because the client has replayed nothing yet: `useSessionStream` opens with `after: 0`, and the
 * server's replay reconstructs every entry from scratch. Only a stream that drops and
 * reconnects mid-mount resumes from a later `seq`, and that resume lives inside
 * `openSessionStream` itself, not here.
 */
export const emptyTranscriptState = (): SessionTranscriptState => ({
  entries: [],
  pending: [],
  changes: null,
  changesStatus: 'idle',
  changesError: null,
  changesEventSeq: 0,
  lastSeq: 0,
  streamState: 'closed',
});

type AssistantEntry = Extract<TranscriptEntry, { kind: 'assistant' }>;
type TextLikeBlock = Extract<TranscriptBlock, { kind: 'text' | 'thinking' }>;

const isOpenAssistantEntry = (entry: TranscriptEntry | undefined): entry is AssistantEntry =>
  entry !== undefined && entry.kind === 'assistant' && entry.streaming;

const isTextLikeBlock = (block: TranscriptBlock): block is TextLikeBlock =>
  block.kind === 'text' || block.kind === 'thinking';

const newTurnEntry = (seq: number, at: string, blocks: TranscriptBlock[]): AssistantEntry => ({
  id: `turn-${seq}`,
  kind: 'assistant',
  at,
  streaming: true,
  blocks,
  result: null,
});

/** Closes the currently open turn, if any — a no-op when the last entry is not an open assistant one. */
const closeOpenEntry = (entries: TranscriptEntry[], patch: Partial<AssistantEntry> = {}): TranscriptEntry[] => {
  const last = entries[entries.length - 1];

  if (!isOpenAssistantEntry(last)) {
    return entries;
  }

  return [...entries.slice(0, -1), { ...last, streaming: false,
    blocks: last.blocks.map((block) => block.kind === 'step' && block.step.status === 'running'
      ? { ...block, step: { ...block.step, status: 'failed', summary: 'Turn ended before a tool result was received.' } }
      : block), ...patch }];
};

/**
 * Appends (`assistant.delta` / `thinking.delta`) or replaces (`assistant.message` /
 * `thinking.message`, the SDK's authoritative final text) one text/thinking block on the open turn,
 * starting a new turn entry when none is open.
 */
const withTextBlock = (
  entries: TranscriptEntry[],
  seq: number,
  at: string,
  blockKind: 'text' | 'thinking',
  messageId: string,
  text: string,
  mode: 'append' | 'replace',
): TranscriptEntry[] => {
  const empty = !text.trim() || (blockKind === 'text' && isProviderPlaceholder(text));
  // A final empty block replaces any provisional placeholder received in deltas.
  if (mode === 'replace' && empty) {
    const last = entries[entries.length - 1];
    if (!isOpenAssistantEntry(last)) return entries;
    return [...entries.slice(0, -1), { ...last, blocks: last.blocks.filter((block) =>
      !(isTextLikeBlock(block) && block.kind === blockKind && block.id === messageId)) }];
  }
  if (!text) return entries;

  const buildBlocks = (blocks: TranscriptBlock[]): TranscriptBlock[] => {
    const index = blocks.findIndex((block) => isTextLikeBlock(block) && block.kind === blockKind && block.id === messageId);
    const lastBlock = blocks[index];

    if (lastBlock && isTextLikeBlock(lastBlock) && lastBlock.kind === blockKind && lastBlock.id === messageId) {
      const nextText = mode === 'append' ? lastBlock.text + text : text;
      return blocks.map((block, i) => i === index ? { ...lastBlock, text: nextText } : block);
    }

    return [...blocks, { kind: blockKind, id: messageId, text }];
  };

  const last = entries[entries.length - 1];

  if (isOpenAssistantEntry(last)) {
    return [...entries.slice(0, -1), { ...last, blocks: buildBlocks(last.blocks) }];
  }

  return [...entries, newTurnEntry(seq, at, buildBlocks([]))];
};

const withStepBlock = (entries: TranscriptEntry[], seq: number, at: string, step: TranscriptStep): TranscriptEntry[] => {
  const block: TranscriptBlock = { kind: 'step', step };
  const last = entries[entries.length - 1];

  if (isOpenAssistantEntry(last)) {
    return [...entries.slice(0, -1), { ...last, blocks: last.blocks.some((item) => item.kind === 'step' && item.step.toolUseId === step.toolUseId) ? last.blocks : [...last.blocks, block] }];
  }

  return [...entries, newTurnEntry(seq, at, [block])];
};

/** Finds the step by `toolUseId` — searching every turn, not just the open one, since a slow tool
 * can still be resolving after its turn has otherwise moved on. */
const withResolvedStep = (
  entries: TranscriptEntry[],
  toolUseId: string,
  status: 'done' | 'failed',
  summary: string,
): TranscriptEntry[] => {
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const entry = entries[i];

    if (entry.kind !== 'assistant') {
      continue;
    }

    const blockIndex = entry.blocks.findIndex((block) => block.kind === 'step' && block.step.toolUseId === toolUseId);

    if (blockIndex === -1) {
      continue;
    }

    const block = entry.blocks[blockIndex];

    if (block.kind !== 'step') {
      continue;
    }

    const nextBlocks = [...entry.blocks];
    nextBlocks[blockIndex] = { kind: 'step', step: { ...block.step, status, summary } };

    const nextEntries = [...entries];
    nextEntries[i] = { ...entry, blocks: nextBlocks };
    return nextEntries;
  }

  return entries;
};

/**
 * The pure fold turning one SSE event into the next transcript state. Mirrors `record()` in
 * `mic-sessions/features/sessions.py` for the parts the SPA also has to derive — `waiting` on a
 * request, closing the open turn on its resolution or on `turn.result` — so server and client can
 * never disagree. Safe to replay: folding the same ordered events from empty state
 * always produces the same result.
 *
 * An `assistant` entry spans a whole turn, not a single SDK message: the Claude Agent SDK can emit
 * several internal `AssistantMessage`s before `turn.result` (text, then a tool call, then more
 * text), and their blocks all append, in order, to the same entry — whichever one is last in
 * `entries` while still `streaming`. Only one turn can run at a time in a session.
 */
export const applySessionEvent = (state: SessionTranscriptState, event: SessionEvent): SessionTranscriptState => {
  const { seq, at, type, data } = event;
  if (type === 'history.reset') {
    return { ...emptyTranscriptState(), streamState: state.streamState, lastSeq: seq,
      entries: [{ id: `gap-${seq}`, kind: 'error', at, text: String(data.message) }] };
  }
  if (type === 'session.sync') {
    if (seq < state.lastSeq) return state;
    const status = (data.session as { status?: string } | undefined)?.status;
    return { ...state, lastSeq: seq, pending: data.pending as SessionPendingRequest[],
      entries: status && status !== 'working' && status !== 'waiting'
        ? closeOpenEntry(state.entries) : state.entries };
  }
  if (seq <= state.lastSeq) return state;
  let entries = state.entries;
  let pending = state.pending;
  let changes = state.changes;
  let changesStatus = state.changesStatus;
  let changesError = state.changesError;
  let changesEventSeq = state.changesEventSeq;

  switch (type) {
    case 'message.user': {
      entries = closeOpenEntry(entries);
      entries = [...entries, { id: String(data.messageId), kind: 'user', at, text: String(data.text ?? '') }];
      break;
    }
    case 'assistant.delta': {
      entries = withTextBlock(entries, seq, at, 'text', String(data.messageId), String(data.text ?? ''), 'append');
      break;
    }
    case 'assistant.message': {
      entries = withTextBlock(entries, seq, at, 'text', String(data.messageId), String(data.text ?? ''), 'replace');
      break;
    }
    case 'thinking.delta': {
      entries = withTextBlock(entries, seq, at, 'thinking', String(data.messageId), String(data.text ?? ''), 'append');
      break;
    }
    case 'thinking.message': {
      entries = withTextBlock(entries, seq, at, 'thinking', String(data.messageId), String(data.text ?? ''), 'replace');
      break;
    }
    case 'tool.use': {
      entries = withStepBlock(entries, seq, at, {
        toolUseId: String(data.toolUseId),
        name: String(data.name),
        title: String(data.title ?? data.name),
        input: (data.input as Record<string, unknown> | undefined) ?? {},
        status: 'running',
        summary: null,
      });
      break;
    }
    case 'tool.result': {
      entries = withResolvedStep(
        entries,
        String(data.toolUseId),
        data.isError ? 'failed' : 'done',
        String(data.summary ?? ''),
      );
      changesStatus = 'loading';
      changesError = null;
      break;
    }
    case 'permission.request': {
      entries = withTextBlock(entries, seq, at, 'text', `request-${data.requestId}`,
        `Approval requested: ${String(data.title ?? data.toolName)}`, 'replace');
      pending = [...pending.filter((request) => request.requestId !== String(data.requestId)), {
        kind: 'permission',
        requestId: String(data.requestId),
        toolName: String(data.toolName),
        title: String(data.title ?? data.toolName),
        input: (data.input as Record<string, unknown> | undefined) ?? {},
      }];
      break;
    }
    case 'question.request': {
      entries = withTextBlock(entries, seq, at, 'text', `request-${data.requestId}`,
        ((data.questions as AgentQuestion[]) ?? []).map((question) => question.question).join('\n'), 'replace');
      pending = [...pending.filter((request) => request.requestId !== String(data.requestId)), {
        kind: 'question',
        requestId: String(data.requestId),
        questions: (data.questions as AgentQuestion[] | undefined) ?? [],
      }];
      break;
    }
    case 'permission.resolved':
    case 'question.resolved': {
      entries = withTextBlock(entries, seq, at, 'text', `answer-${data.requestId}`,
        data.answers ? Object.entries(data.answers as Record<string, string | string[]>).map(([question, answer]) => `**${question}**\n\n${Array.isArray(answer) ? answer.join(', ') : answer}`).join('\n\n') : `Decision: ${String(data.decision ?? 'resolved')}`, 'replace');
      pending = pending.filter((request) => request.requestId !== String(data.requestId));
      break;
    }
    case 'turn.result': {
      if (!isOpenAssistantEntry(entries[entries.length - 1])) {
        entries = [...entries, newTurnEntry(seq, at, [])];
      }
      entries = closeOpenEntry(entries, {
        result: {
          terminalReason: (data.terminalReason as string | null | undefined) ?? null,
          subtype: (data.subtype as string | null | undefined) ?? null,
          durationMs: (data.durationMs as number | null | undefined) ?? null,
          costUsd: (data.costUsd as number | null | undefined) ?? null,
          usage: (data.usage as Record<string, unknown> | null | undefined) ?? null,
        },
      });
      pending = [];
      changesStatus = 'loading';
      changesError = null;
      break;
    }
    case 'session.status': {
      const status = data.status as string | undefined;

      if (status === 'failed' || status === 'closed') pending = [];
      if (status !== 'working' && status !== 'waiting') {
        entries = closeOpenEntry(entries);
      }

      break;
    }
    case 'changes.updated': {
      const payload = data as unknown as ChangesSummary;
      changesEventSeq = seq;
      if (payload.status === 'error') {
        changesStatus = 'error';
        changesError = payload.error ?? 'Could not calculate changes.';
      } else {
        changes = payload;
        changesStatus = 'ready';
        changesError = null;
      }
      break;
    }
    case 'agent.activity': {
      if (data.kind === 'conversation_reset') {
        entries = withTextBlock(entries, seq, at, 'text', `activity-${seq}`,
          String(data.description ?? data.summary ?? ''), 'replace');
      }
      break;
    }
    case 'error': {
      entries = [
        ...closeOpenEntry(entries),
        { id: `error-${seq}`, kind: 'error', at, text: String(data.message ?? 'Something went wrong') },
      ];
      break;
    }
    default:
      break;
  }

  return {
    ...state,
    entries,
    pending,
    changes,
    changesStatus,
    changesError,
    changesEventSeq,
    lastSeq: seq,
  };
};
