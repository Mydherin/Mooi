import type { ChangeKind } from '@/features/sessions/types/ChangeKind';

export interface ChangedFile {
  path: string;
  change: ChangeKind;
  added: number;
  removed: number;
}
