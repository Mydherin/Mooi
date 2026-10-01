import type { Backup } from './Backup';

export interface BackupsResponse {
  backups: Backup[];
  hasMore: boolean;
}
