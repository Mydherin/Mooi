import type { DiffPreview } from '@/features/sessions/types/DiffPreview';

export interface FileDiffPayload {
  path: string;
  diff: string;
  /** Absent from producers that only ever return text diffs. */
  preview?: DiffPreview;
  /** The diff was cut at a line boundary for being too long. */
  truncated?: boolean;
}
