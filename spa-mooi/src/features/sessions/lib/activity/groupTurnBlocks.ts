import { isProviderPlaceholder } from '@/features/sessions/lib/isProviderPlaceholder';
import type { TranscriptBlock } from '@/features/sessions/types/TranscriptBlock';
import type { TranscriptStep } from '@/features/sessions/types/TranscriptStep';

export type ActivityBlock = Extract<TranscriptBlock, { kind: 'thinking' | 'step' }>;

/**
 * How a turn reads: what the agent says to the user stands on its own, and everything it does in
 * between — thinking, tool calls, commands — folds into one activity block. Each message the agent
 * writes closes the block before it; the next action opens a new one (as in Codex and Claude Code).
 * A generated image is output, not activity, so it also stands on its own, and so does a session
 * the agent opened.
 */
export type TurnSegment =
  | { kind: 'text'; key: string; block: Extract<TranscriptBlock, { kind: 'text' }> }
  | { kind: 'image'; key: string; step: TranscriptStep }
  | { kind: 'session'; key: string; block: Extract<TranscriptBlock, { kind: 'session' }> }
  | { kind: 'activity'; key: string; blocks: ActivityBlock[] };

export const blockKey = (block: TranscriptBlock): string =>
  block.kind === 'step' ? `step-${block.step.toolUseId}` : `${block.kind}-${block.id}`;

export const groupTurnBlocks = (blocks: TranscriptBlock[], showThinking: boolean): TurnSegment[] => {
  const segments: TurnSegment[] = [];
  for (const block of blocks) {
    if (block.kind === 'text') {
      if (block.text.trim() && !isProviderPlaceholder(block.text)) segments.push({ kind: 'text', key: blockKey(block), block });
      continue;
    }
    if (block.kind === 'session') {
      segments.push({ kind: 'session', key: blockKey(block), block });
      continue;
    }
    if (block.kind === 'thinking' && (!showThinking || !block.text.trim())) continue;
    if (block.kind === 'step' && block.step.name === 'ImageGeneration') {
      segments.push({ kind: 'image', key: blockKey(block), step: block.step });
      continue;
    }
    const last = segments[segments.length - 1];
    // A group keeps the key of its first block, so it keeps its identity (and open state) as it grows.
    if (last?.kind === 'activity') last.blocks = [...last.blocks, block];
    else segments.push({ kind: 'activity', key: blockKey(block), blocks: [block] });
  }
  return segments;
};
