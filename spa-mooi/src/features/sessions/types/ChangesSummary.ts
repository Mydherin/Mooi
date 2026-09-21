import type { ChangedFile } from '@/features/sessions/types/ChangedFile';
import type { ChangesStatus } from '@/features/sessions/types/ChangesStatus';

export interface ChangesSummary {
  status?: ChangesStatus;
  error?: string | null;
  branch: string;
  baseBranch: string;
  added: number;
  removed: number;
  files: ChangedFile[];
}
