import type { BackupFiles } from '@/features/backups/types/BackupFiles';
import type { PlatformDocumentField } from '@/features/platform/types/PlatformDocumentField';

/** The four platform documents in the order they are shown. */
export const BACKUP_DOCUMENTS: PlatformDocumentField<BackupFiles>[] = [
  { name: 'BACKUP.md', key: 'manifest', summary: 'What is backed up and how' },
  { name: 'backup.sh', key: 'backupScript', summary: 'Creates and checks a backup' },
  { name: 'restore.sh', key: 'restoreScript', summary: 'Restores into a test instance or production' },
  { name: 'delete.sh', key: 'deleteScript', summary: 'Removes a stored backup' },
];
