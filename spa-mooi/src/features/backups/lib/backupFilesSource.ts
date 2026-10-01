import { fetchBackupChanges, fetchBackupDocuments } from '@/features/backups/api/backupsApi';

/** Where the backup platform files and their pending changes are read from. */
export const BACKUP_FILES_SOURCE = { fetchDocuments: fetchBackupDocuments, fetchChanges: fetchBackupChanges };
