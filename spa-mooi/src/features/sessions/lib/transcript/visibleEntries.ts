import { isProviderPlaceholder } from '@/features/sessions/lib/isProviderPlaceholder';
import type { TranscriptEntry } from '@/features/sessions/types/TranscriptEntry';

/**
 * The rows the conversation shows. An assistant turn with nothing to read (only provider
 * placeholders, or thinking from a provider that does not show it) stays hidden, except the one
 * still streaming while the agent works, which names what it is doing.
 */
export const visibleEntries = (entries: TranscriptEntry[], working: boolean, showThinking: boolean): TranscriptEntry[] =>
  entries.filter((entry) => entry.kind !== 'assistant' || (entry.streaming && working) || entry.result
    || entry.blocks.some((block) => block.kind === 'step' || block.kind === 'session'
      || ((block.kind !== 'thinking' || showThinking) && block.text.trim() && !isProviderPlaceholder(block.text))));

/** The words of a finished turn, for copying: what the agent told the user, without its activity. */
export const turnText = (entry: Extract<TranscriptEntry, { kind: 'assistant' }>): string =>
  entry.blocks.flatMap((block) => block.kind === 'text' && block.text.trim() && !isProviderPlaceholder(block.text) ? [block.text.trim()] : [])
    .join('\n\n');
