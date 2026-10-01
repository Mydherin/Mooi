import type { BackupAction } from '@/features/backups/types/BackupAction';
import type { RestoreTarget } from '@/features/backups/types/RestoreTarget';

/** A short human name for one kind of operation. */
export const backupOperationLabel = (action: BackupAction | null, target: RestoreTarget | null): string => {
  if (action === 'backup') return 'Backup';
  if (action === 'delete') return 'Deletion';
  if (action === 'restore') return target === 'production' ? 'Production restore' : 'Verification restore';
  return 'Operation';
};
