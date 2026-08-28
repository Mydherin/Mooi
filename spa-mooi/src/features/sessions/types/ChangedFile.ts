import type { ChangeKind } from '@/features/sessions/types/ChangeKind';

export interface ChangedFile {
  id: string;
  path: string;
  kind: ChangeKind;
  added: number;
  removed: number;
}
