import type { PlatformEnvironmentVariable } from '@/features/platform/types/PlatformEnvironmentVariable';
import type { BackupSnapshot } from './BackupSnapshot';

export interface BackupOverview {
  /** All four documents exist, as a draft or active. */
  configured: boolean;
  /** An active configuration exists: it passed a backup and a verification restore. */
  active: boolean;
  hasDraft: boolean;
  revision: number;
  environment: PlatformEnvironmentVariable[];
  snapshot: BackupSnapshot;
  chatSessionId: string | null;
  /** The live chat's documents passed their proof since its last draft, so it can be closed. */
  chatTested: boolean;
  /** The release production runs: new backups belong to it; only its backups restore into production. */
  deployedRelease: string | null;
}
