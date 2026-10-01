import type { BackupOperation } from './BackupOperation';

/** One operation with the exact script it ran and its redacted output. */
export interface BackupOperationDetail {
  operation: BackupOperation;
  script: string;
  message: string | null;
  logs: string[];
}
