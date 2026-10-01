import type { BackupAction } from './BackupAction';
import type { BackupRunState } from './BackupRunState';
import type { RestoreTarget } from './RestoreTarget';

/** The live backup operation of a project; its output arrives separately through the stream. */
export interface BackupSnapshot {
  state: BackupRunState;
  operationId: string | null;
  action: BackupAction | null;
  target: RestoreTarget | null;
  backupId: string | null;
  /** The name backup.sh stores it under. */
  backupKey: string | null;
  backupCreatedAt: string | null;
  releaseTag: string | null;
  message: string | null;
  startedAt: string | null;
  updatedAt: string;
}
