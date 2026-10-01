/** BACKUP.md, backup.sh, restore.sh and delete.sh: stored only in the platform, never in the repository. */
export interface BackupFiles {
  manifest: string;
  backupScript: string;
  restoreScript: string;
  deleteScript: string;
}
