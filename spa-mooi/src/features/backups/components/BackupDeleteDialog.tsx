import { useState } from 'react';
import { Eraser, Trash2 } from 'lucide-react';
import type { Backup } from '@/features/backups/types/Backup';
import { Button } from '@/shared/components/actions/Button';
import { Alert } from '@/shared/components/feedback/Alert';
import { Dialog } from '@/shared/components/overlays/dialog/Dialog';
import { formatDate } from '@/shared/utils/formatDate';
import { formatTime } from '@/shared/utils/formatTime';

interface BackupDeleteDialogProps {
  backup: Backup;
  /** delete.sh can run: an active configuration exists and nothing else is running. */
  canRunScript: boolean;
  onClose: () => void;
  onDelete: () => Promise<void>;
  onForget: () => Promise<void>;
}

/** Deleting runs delete.sh against the stored data; forgetting only drops the record, for data already gone. */
export const BackupDeleteDialog = ({ backup, canRunScript, onClose, onDelete, onForget }: BackupDeleteDialogProps) => {
  const [busy, setBusy] = useState<'delete' | 'forget' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (kind: 'delete' | 'forget') => {
    setBusy(kind); setError(null);
    try { await (kind === 'delete' ? onDelete() : onForget()); }
    catch (failure) { setError((failure as Error).message); setBusy(null); }
  };

  return <Dialog open onClose={onClose} dismissible={!busy} title="Delete backup"
    description={`Backup of ${formatDate(backup.startedAt)} at ${formatTime(backup.startedAt)}, release ${backup.releaseTag}.`}
    footer={<>
      <Button variant="ghost" icon={Eraser} loading={busy === 'forget'} onClick={() => void run('forget')} disabled={busy === 'delete'} className="sm:mr-auto">
        Remove record only</Button>
      <Button variant="ghost" onClick={onClose} disabled={busy !== null}>Cancel</Button>
      <Button variant="danger" icon={Trash2} loading={busy === 'delete'} onClick={() => void run('delete')} disabled={busy === 'forget' || !canRunScript}>
        Delete backup</Button>
    </>}>
    <ul className="flex list-disc flex-col gap-1.5 pl-5 text-callout text-ink-muted">
      <li>delete.sh permanently removes the stored data; the record disappears once it succeeds.</li>
      <li>Remove the record only when its data is already gone, e.g. a backup that failed before storing anything.</li>
      {!canRunScript ? <li className="text-danger">delete.sh cannot run now: wait for the running operation, or set up backups again.</li> : null}
    </ul>
    {error ? <Alert tone="danger" className="mt-4">{error}</Alert> : null}
  </Dialog>;
};
