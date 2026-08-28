import type { DiffLineKind } from '@/features/sessions/types/DiffLineKind';

export interface DiffLine {
  id: string;
  kind: DiffLineKind;
  oldLine: number | null;
  newLine: number | null;
  content: string;
}
