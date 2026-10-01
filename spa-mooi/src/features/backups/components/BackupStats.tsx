import { CalendarClock, DatabaseBackup, FileCode2, ShieldCheck } from 'lucide-react';
import type { Backup } from '@/features/backups/types/Backup';
import type { BackupOverview } from '@/features/backups/types/BackupOverview';
import { WorkspaceStat } from '@/features/sessions/components/workspaces/WorkspaceStat';
import { formatRelativeTime } from '@/shared/utils/formatRelativeTime';

interface BackupStatsProps {
  overview: BackupOverview;
  backups: Backup[];
  hasMore: boolean;
}

/** Four numbers that answer "am I protected, and can I restore what runs today?" at a glance. */
export const BackupStats = ({ overview, backups, hasMore }: BackupStatsProps) => {
  const latest = backups.find((backup) => backup.state === 'succeeded');
  const restorable = backups.filter((backup) => backup.state === 'succeeded' && backup.releaseTag === overview.deployedRelease).length;
  const verified = backups.find((backup) => backup.verifiedAt);
  const missing = overview.environment.filter((variable) => variable.required && !variable.configured).length;
  const configuration = overview.active ? overview.hasDraft ? 'Active + draft' : 'Active' : overview.configured ? 'Draft' : 'None';
  const count = `${backups.filter((backup) => backup.state === 'succeeded').length}${hasMore ? '+' : ''}`;

  return (
    <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
      <WorkspaceStat icon={CalendarClock} label="Latest backup" value={latest ? formatRelativeTime(latest.startedAt) : '—'}
        hint={latest ? `Release ${latest.releaseTag}` : 'No successful backup yet'} />
      <WorkspaceStat icon={DatabaseBackup} label="Backups" value={count}
        hint={overview.deployedRelease ? `${restorable} for ${overview.deployedRelease}` : 'Nothing deployed'} />
      <WorkspaceStat icon={ShieldCheck} label="Last verified" value={verified?.verifiedAt ? formatRelativeTime(verified.verifiedAt) : '—'}
        hint={verified ? 'Restored into a disposable instance' : 'Verify a backup to prove it restores'} />
      <WorkspaceStat icon={FileCode2} label="Configuration" value={configuration}
        hint={missing > 0 ? `${missing} variable${missing === 1 ? '' : 's'} missing` : `${overview.environment.length} variable${overview.environment.length === 1 ? '' : 's'} · rev ${overview.revision}`} />
    </div>
  );
};
