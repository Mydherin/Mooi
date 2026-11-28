import { useState } from 'react';
import type { Backup } from '@/features/backups/types/Backup';
import { Checkbox } from '@/shared/components/forms/Checkbox';
import { ConfirmDialog } from '@/shared/components/overlays/confirm/ConfirmDialog';
import { formatDate } from '@/shared/utils/formatDate';
import { formatRelativeTime } from '@/shared/utils/formatRelativeTime';
import { formatTime } from '@/shared/utils/formatTime';

interface BackupRestoreDialogProps {
  backup: Backup;
  projectName: string;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

/** Restoring into production is never implicit: the user reads what it does and confirms it explicitly. */
export const BackupRestoreDialog = ({ backup, projectName, busy, error, onClose, onConfirm }: BackupRestoreDialogProps) => {
  const [understood, setUnderstood] = useState(false);

  return <ConfirmDialog open tone="danger" onClose={onClose} onConfirm={onConfirm} title="Restore into production"
    description={`${projectName} · backup of ${formatDate(backup.startedAt)} at ${formatTime(backup.startedAt)}, release ${backup.releaseTag}.`}
    confirmLabel="Restore production" busy={busy} confirmDisabled={!understood} error={error}>
    <ul className="flex list-disc flex-col gap-1.5 pl-5 text-callout text-ink-muted">
      <li>The production instance is stopped while restore.sh puts this backup back, then started again.</li>
      <li>Everything written after this backup is replaced by its data.</li>
      <li>{backup.verifiedAt ? `It was last verified in a disposable instance ${formatRelativeTime(backup.verifiedAt)}.`
        : 'It has not been verified yet: verifying it first in a disposable instance is safer.'}</li>
    </ul>
    <Checkbox className="mt-4" checked={understood} onChange={setUnderstood} disabled={busy}
      label="I understand production data will be replaced by this backup." />
  </ConfirmDialog>;
};
