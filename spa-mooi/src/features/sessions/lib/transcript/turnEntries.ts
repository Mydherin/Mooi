import { isProviderPlaceholder } from '@/features/sessions/lib/isProviderPlaceholder';
import type { ImageAttachment } from '@/features/sessions/types/ImageAttachment';
import type { OpenedSession } from '@/features/sessions/types/OpenedSession';
import type { TranscriptBlock } from '@/features/sessions/types/TranscriptBlock';
import type { TranscriptEntry } from '@/features/sessions/types/TranscriptEntry';
import type { TranscriptStep } from '@/features/sessions/types/TranscriptStep';

/*
 * Immutable updates of the assistant turn entries. An `assistant` entry spans a whole turn: every
 * block of the turn appends to whichever entry is last in `entries` while still `streaming`, so
 * only that entry (and the array) changes identity — every other row keeps its reference and its
 * memoised render while the turn streams.
 */

type AssistantEntry = Extract<TranscriptEntry, { kind: 'assistant' }>;
type TextLikeBlock = Extract<TranscriptBlock, { kind: 'text' | 'thinking' }>;

export const isOpenAssistantEntry = (entry: TranscriptEntry | undefined): entry is AssistantEntry =>
  entry !== undefined && entry.kind === 'assistant' && entry.streaming;

const isTextLikeBlock = (block: TranscriptBlock): block is TextLikeBlock =>
  block.kind === 'text' || block.kind === 'thinking';

export const newTurnEntry = (seq: number, at: string, blocks: TranscriptBlock[]): AssistantEntry => ({
  id: `turn-${seq}`,
  kind: 'assistant',
  at,
  streaming: true,
  blocks,
  result: null,
});

const replaceLast = (entries: TranscriptEntry[], entry: TranscriptEntry): TranscriptEntry[] => [...entries.slice(0, -1), entry];

/** Closes the currently open turn, if any — a no-op when the last entry is not an open assistant one. */
export const closeOpenEntry = (entries: TranscriptEntry[], patch: Partial<AssistantEntry> = {}): TranscriptEntry[] => {
  const last = entries[entries.length - 1];
  if (!isOpenAssistantEntry(last)) return entries;

  return replaceLast(entries, { ...last, streaming: false,
    blocks: last.blocks.map((block) => block.kind === 'step' && block.step.status === 'running'
      ? { ...block, step: { ...block.step, status: 'failed', summary: 'Turn ended before a tool result was received.' } }
      : block), ...patch });
};

/**
 * Appends (`*.delta`) or replaces (`*.message`, the SDK's authoritative final text) one text or
 * thinking block on the open turn, starting a new turn entry when none is open.
 */
export const withTextBlock = (
  entries: TranscriptEntry[],
  seq: number,
  at: string,
  blockKind: 'text' | 'thinking',
  messageId: string,
  text: string,
  mode: 'append' | 'replace',
): TranscriptEntry[] => {
  const matches = (block: TranscriptBlock) => isTextLikeBlock(block) && block.kind === blockKind && block.id === messageId;
  const empty = !text.trim() || (blockKind === 'text' && isProviderPlaceholder(text));
  const last = entries[entries.length - 1];

  // A final empty block replaces any provisional placeholder received in deltas.
  if (mode === 'replace' && empty) {
    if (!isOpenAssistantEntry(last)) return entries;
    return replaceLast(entries, { ...last, blocks: last.blocks.filter((block) => !matches(block)) });
  }
  if (!text) return entries;

  const buildBlocks = (blocks: TranscriptBlock[]): TranscriptBlock[] => {
    const index = blocks.findIndex(matches);
    const current = blocks[index];
    if (current && isTextLikeBlock(current)) {
      const nextText = mode === 'append' ? current.text + text : text;
      return blocks.map((block, position) => position === index ? { ...current, text: nextText } : block);
    }
    return [...blocks, { kind: blockKind, id: messageId, text }];
  };

  if (isOpenAssistantEntry(last)) return replaceLast(entries, { ...last, blocks: buildBlocks(last.blocks) });
  return [...entries, newTurnEntry(seq, at, buildBlocks([]))];
};

export const withStepBlock = (entries: TranscriptEntry[], seq: number, at: string, step: TranscriptStep): TranscriptEntry[] => {
  const last = entries[entries.length - 1];
  if (!isOpenAssistantEntry(last)) return [...entries, newTurnEntry(seq, at, [{ kind: 'step', step }])];
  if (last.blocks.some((item) => item.kind === 'step' && item.step.toolUseId === step.toolUseId)) return entries;
  return replaceLast(entries, { ...last, blocks: [...last.blocks, { kind: 'step', step }] });
};

/** A session the agent opened shows where it happened: inside the open turn, or as a turn of its own. */
export const withOpenedSessionBlock = (entries: TranscriptEntry[], seq: number, at: string, opened: OpenedSession): TranscriptEntry[] => {
  const block: TranscriptBlock = { kind: 'session', id: `${seq}`, opened };
  const last = entries[entries.length - 1];
  if (isOpenAssistantEntry(last)) return replaceLast(entries, { ...last, blocks: [...last.blocks, block] });
  return [...entries, { ...newTurnEntry(seq, at, [block]), streaming: false }];
};

/**
 * Finds the step by `toolUseId` — searching every turn, not just the open one, since a slow tool
 * can still be resolving after its turn has otherwise moved on.
 */
export const withResolvedStep = (
  entries: TranscriptEntry[],
  toolUseId: string,
  status: 'done' | 'failed',
  summary: string,
  images: ImageAttachment[],
): TranscriptEntry[] => {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (entry.kind !== 'assistant') continue;
    const blockIndex = entry.blocks.findIndex((block) => block.kind === 'step' && block.step.toolUseId === toolUseId);
    const block = entry.blocks[blockIndex];
    if (block?.kind !== 'step') continue;

    const blocks = [...entry.blocks];
    blocks[blockIndex] = { kind: 'step', step: { ...block.step, status, summary, images } };
    const next = [...entries];
    next[index] = { ...entry, blocks };
    return next;
  }
  return entries;
};
