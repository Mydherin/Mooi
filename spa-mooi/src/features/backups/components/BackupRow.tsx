import { memo, useState } from 'react';
import { ArchiveRestore, Eye, FlaskConical, ShieldCheck, Trash2 } from 'lucide-react';
import type { Backup } from '@/features/backups/types/Backup';
import { OperationStateIcon } from '@/features/production/components/operation/OperationStateIcon';
import { Menu } from '@/shared/components/overlays/menu/Menu';
import { useLongPress } from '@/shared/gestures/useLongPress';
import { formatDate } from '@/shared/utils/formatDate';
import { formatRelativeTime } from '@/shared/utils/formatRelativeTime';
import { formatTime } from '@/shared/utils/formatTime';

interface BackupRowProps {
  backup: Backup;
  deployedRelease: string | null;
  /** Another operation runs or the configuration is not active: actions wait. */
  locked: boolean;
  onOpen: (backup: Backup) => void;
  onVerify: (backup: Backup) => void;
  onRestore: (backup: Backup) => void;
  onDelete: (backup: Backup) => void;
}

/** One backup: when, which release and whether it was proven; tapping opens it, its actions live in its menu (also on long press). */
export const BackupRow = memo(({ backup, deployedRelease, locked, onOpen, onVerify, onRestore, onDelete }: BackupRowProps) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const press = useLongPress(() => setMenuOpen(true));
  const usable = backup.state === 'succeeded';
  const matches = backup.releaseTag === deployedRelease;
  const when = `${formatDate(backup.startedAt)} · ${formatTime(backup.startedAt)}`;
  const restoreHint = !usable ? 'Only a successful backup can be restored'
    : !matches ? `Production runs ${deployedRelease ?? 'no release'}; deploy ${backup.releaseTag} first` : 'Into production';

  return (
    <li className="flex min-h-16 min-w-0 items-center gap-1 bg-surface pr-2">
      <button type="button" {...press} onClick={() => onOpen(backup)} aria-label={`View backup of ${when}`}
        className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pl-4 text-left outline-none active:bg-surface-2 hover-device:hover:bg-surface-2/60 focus-visible:bg-surface-2">
        <OperationStateIcon state={backup.state} />
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-body font-medium text-ink tabular-nums">{when}</span>
            {backup.verifiedAt ? <ShieldCheck role="img" aria-label="Verified" className="size-4 shrink-0 text-success" /> : null}
          </span>
          <span className="mt-0.5 block truncate text-footnote text-ink-subtle">
            <span className={matches ? 'font-mono text-ink-muted' : 'font-mono'}>{backup.releaseTag}</span>
            {' · '}{backup.state === 'running' ? 'running' : formatRelativeTime(backup.startedAt)}
            {backup.restoredAt ? ` · restored ${formatRelativeTime(backup.restoredAt)}` : ''}
          </span>
        </span>
      </button>
      <Menu label={`Backup of ${when} actions`} open={menuOpen} onOpenChange={setMenuOpen} sections={[
        { id: 'main', items: [
          { id: 'open', label: 'View details', icon: Eye, onSelect: () => onOpen(backup) },
          { id: 'verify', label: 'Verify', description: 'In a disposable instance', icon: FlaskConical, disabled: locked || !usable, onSelect: () => onVerify(backup) },
          { id: 'restore', label: 'Restore', description: restoreHint, icon: ArchiveRestore, disabled: locked || !usable || !matches, onSelect: () => onRestore(backup) },
        ] },
        { id: 'danger', items: [{ id: 'delete', label: 'Delete backup', icon: Trash2, destructive: true, disabled: locked || backup.state === 'running', onSelect: () => onDelete(backup) }] },
      ]} />
    </li>
  );
});
BackupRow.displayName = 'BackupRow';
