import type { Backup } from '@/features/backups/types/Backup';
import type { BackupOverview } from '@/features/backups/types/BackupOverview';
import type { BackupSnapshot } from '@/features/backups/types/BackupSnapshot';
import type { BackupStage } from '@/features/backups/types/BackupStage';

/** The live operation wins; then the configuration; then whether the latest backup succeeded. */
export const backupStage = (overview: BackupOverview, snapshot: BackupSnapshot | null, latest: Backup | undefined,
  hasChat: boolean): BackupStage => {
  if (snapshot?.state === 'running') return 'running';
  if (!overview.active) {
    if (hasChat) return 'preparing';
    return overview.deployedRelease ? 'unconfigured' : 'undeployed';
  }
  if (snapshot?.state === 'failed' || latest?.state === 'failed') return 'failed';
  return latest?.state === 'succeeded' ? 'protected' : 'ready';
};
