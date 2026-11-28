import { memo } from 'react';
import { ShieldCheck } from 'lucide-react';
import { backupPath } from '@/app/paths';
import type { Backup } from '@/features/backups/types/Backup';
import { OperationStateBadge } from '@/features/production/components/operation/OperationStateBadge';
import type { Project } from '@/features/projects/types/Project';
import { Badge } from '@/shared/components/data-display/Badge';
import { Initials } from '@/shared/components/data-display/Initials';
import { ListRow } from '@/shared/components/data-display/ListRow';
import { formatRelativeTime } from '@/shared/utils/formatRelativeTime';

interface BackupProjectCardProps {
  project: Project;
  latest: Backup | undefined;
  count: number;
}

/** A project on the backups landing: its latest backup and outcome, opening its backup view. */
export const BackupProjectCard = memo(({ project, latest, count }: BackupProjectCardProps) => (
  <ListRow to={backupPath(project.id)} leading={<Initials value={project.name} size="md" />} title={project.name}
    subtitle={latest ? <><span className="font-mono text-ink-muted">{latest.releaseTag}</span> · {formatRelativeTime(latest.startedAt)}
      {count > 1 ? ` · ${count} backups` : ''}</> : 'Set up backups'}
    trailing={latest ? latest.state === 'succeeded' && latest.verifiedAt ? <Badge tone="success" icon={ShieldCheck}>Verified</Badge>
      : <OperationStateBadge state={latest.state} /> : <Badge>No backups</Badge>} />
));
BackupProjectCard.displayName = 'BackupProjectCard';
