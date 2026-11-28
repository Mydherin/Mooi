import type { TranscriptStep } from '@/features/sessions/types/TranscriptStep';

/** What an expanded step shows besides its line: the diff it made, or its input without bookkeeping. */

/** Codex items carry their own bookkeeping next to the input; none of it helps the reader. */
const NOISE_KEYS = new Set(['id', 'type', 'status', 'aggregatedOutput', 'exitCode', 'durationMs', 'commandActions', 'processId']);

/** The edit as unified-diff-like lines (`+`, `-`, `@@`), from a patch, edit pairs or a whole written file. */
export const diffLines = (step: TranscriptStep): string[] | null => {
  const { input } = step;
  if (typeof input.diff === 'string' && input.diff.trim()) return input.diff.split('\n');
  const pairs = Array.isArray(input.edits) ? input.edits as Record<string, unknown>[] : [input];
  if (pairs.some((pair) => typeof pair.old_string === 'string' || typeof pair.new_string === 'string')) {
    return pairs.flatMap((pair, index) => [
      ...(index > 0 ? ['@@'] : []),
      ...String(pair.old_string ?? '').split('\n').filter(Boolean).map((line) => `-${line}`),
      ...String(pair.new_string ?? '').split('\n').filter(Boolean).map((line) => `+${line}`),
    ]);
  }
  if (step.name === 'Write' && typeof input.content === 'string') return input.content.split('\n').map((line) => `+${line}`);
  return null;
};

export const readableInput = (step: TranscriptStep): Record<string, unknown> =>
  Object.fromEntries(Object.entries(step.input).filter(([key]) => !NOISE_KEYS.has(key)));

export type DiffLineTone = 'added' | 'removed' | 'hunk' | 'context';

export const diffLineTone = (line: string): DiffLineTone =>
  line.startsWith('+') && !line.startsWith('+++') ? 'added'
    : line.startsWith('-') && !line.startsWith('---') ? 'removed'
      : line.startsWith('@@') ? 'hunk' : 'context';
