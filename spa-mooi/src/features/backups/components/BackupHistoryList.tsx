import { memo } from 'react';
import { ShieldCheck } from 'lucide-react';
import type { Backup } from '@/features/backups/types/Backup';
import { OperationStateBadge } from '@/features/production/components/operation/OperationStateBadge';
import { OperationStateIcon } from '@/features/production/components/operation/OperationStateIcon';
import type { Project } from '@/features/projects/types/Project';
import { ListGroup } from '@/shared/components/data-display/ListGroup';
import { ListRow } from '@/shared/components/data-display/ListRow';
import { formatDate } from '@/shared/utils/formatDate';
import { formatRelativeTime } from '@/shared/utils/formatRelativeTime';
import { formatTime } from '@/shared/utils/formatTime';

interface BackupHistoryListProps {
  backups: Backup[];
  projects: Map<string, Project>;
  onOpen: (backup: Backup) => void;
}

const HistoryRow = memo(({ backup, project, onOpen }: { backup: Backup; project: Project | undefined; onOpen: (backup: Backup) => void }) => (
  <ListRow onClick={() => onOpen(backup)} chevron leading={<OperationStateIcon state={backup.state} />}
    title={<span className="inline-flex max-w-full min-w-0 items-center gap-1.5"><span className="truncate">{project?.name ?? 'Removed project'}</span>
      {backup.verifiedAt ? <ShieldCheck role="img" aria-label="Verified" className="size-4 shrink-0 text-success" /> : null}</span>}
    subtitle={<><span className="font-mono text-ink-muted">{backup.releaseTag}</span> · {formatDate(backup.startedAt)} {formatTime(backup.startedAt)} · {formatRelativeTime(backup.startedAt)}</>}
    trailing={<OperationStateBadge state={backup.state} className="max-sm:hidden" />} />
));
HistoryRow.displayName = 'BackupHistoryRow';

/** Every recorded backup across projects, newest first; the detail leads on to its project. */
export const BackupHistoryList = ({ backups, projects, onOpen }: BackupHistoryListProps) => (
  <ListGroup>
    {backups.map((backup) => <HistoryRow key={backup.id} backup={backup} project={projects.get(backup.projectId)} onOpen={onOpen} />)}
  </ListGroup>
);
