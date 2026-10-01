import type { BackupState } from './BackupState';

/** One recorded backup of a production release, as kept by mic-mooi. */
export interface Backup {
  id: string;
  projectId: string;
  sessionId: string | null;
  releaseTag: string;
  state: BackupState;
  startedAt: string;
  finishedAt: string | null;
  /** Last successful restore into a disposable verification instance. */
  verifiedAt: string | null;
  /** Last successful restore into production. */
  restoredAt: string | null;
}
