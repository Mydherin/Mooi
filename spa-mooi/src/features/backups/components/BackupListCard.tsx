import { BackupRow } from '@/features/backups/components/BackupRow';
import type { Backup } from '@/features/backups/types/Backup';
import { Button } from '@/shared/components/actions/Button';
import { ListGroup } from '@/shared/components/data-display/ListGroup';
import { Alert } from '@/shared/components/feedback/Alert';
import { Skeleton } from '@/shared/components/feedback/Skeleton';

interface BackupListCardProps {
  backups: Backup[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  deployedRelease: string | null;
  locked: boolean;
  onLoadMore: () => void;
  onOpen: (backup: Backup) => void;
  onVerify: (backup: Backup) => void;
  onRestore: (backup: Backup) => void;
  onDelete: (backup: Backup) => void;
}

/** Every backup of the project, newest first: dated, tied to its release and ready to verify, restore or delete. */
export const BackupListCard = ({ backups, loading, error, hasMore, deployedRelease, locked, onLoadMore, ...actions }: BackupListCardProps) => (
  <div className="flex min-w-0 flex-col gap-2">
    <ListGroup title="Backups" action={backups.length > 0 ? <span className="text-caption text-ink-subtle tabular-nums">{backups.length}{hasMore ? '+' : ''}</span> : undefined}
      footer={backups.length === 0 && !loading && !error ? 'Every backup appears here with its date, time and release.' : undefined}>
      {error ? <li className="p-3"><Alert tone="danger">{error}</Alert></li>
        : loading && backups.length === 0 ? <li aria-busy className="p-4"><Skeleton lines={2} /></li>
          : backups.length === 0 ? <li className="px-4 py-3.5 text-callout text-ink-muted">No backups yet.</li>
            : backups.map((backup) => <BackupRow key={backup.id} backup={backup} deployedRelease={deployedRelease} locked={locked} {...actions} />)}
    </ListGroup>
    {hasMore ? <Button variant="ghost" size="sm" loading={loading} onClick={onLoadMore} className="self-center">Load older backups</Button> : null}
  </div>
);
