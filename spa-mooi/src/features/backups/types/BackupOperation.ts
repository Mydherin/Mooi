import type { BackupAction } from './BackupAction';
import type { BackupState } from './BackupState';
import type { RestoreTarget } from './RestoreTarget';

export interface BackupOperation {
  operationId: string;
  backupId: string;
  action: BackupAction;
  target: RestoreTarget | null;
  state: BackupState;
  startedAt: string;
  finishedAt: string | null;
}
