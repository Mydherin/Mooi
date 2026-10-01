import type { Backup } from './Backup';
import type { BackupOperationDetail } from './BackupOperationDetail';

export interface BackupDetail {
  backup: Backup;
  /** Newest first. */
  operations: BackupOperationDetail[];
}
